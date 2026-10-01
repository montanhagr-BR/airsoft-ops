create extension if not exists pgcrypto;

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  controller_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'setup' check (status in ('setup','running','finished','archived')),
  state jsonb not null default '{}'::jsonb,
  state_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  role text not null check (role in ('controller','artifact','player')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','offline')),
  display_name text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, device_id),
  unique (session_id, user_id, role)
);

create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_members_session_idx on public.game_members(session_id);
create index if not exists game_members_last_seen_idx on public.game_members(session_id,last_seen desc);
create index if not exists game_events_session_idx on public.game_events(session_id,id desc);

alter table public.game_sessions enable row level security;
alter table public.game_members enable row level security;
alter table public.game_events enable row level security;

create or replace function public.is_game_member(target_session uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.game_members where session_id=target_session and user_id=auth.uid()) $$;

drop policy if exists "session members can read sessions" on public.game_sessions;
create policy "session members can read sessions" on public.game_sessions for select to authenticated
using (controller_id=auth.uid() or public.is_game_member(id));
drop policy if exists "controller can update session" on public.game_sessions;
create policy "controller can update session" on public.game_sessions for update to authenticated
using (controller_id=auth.uid()) with check (controller_id=auth.uid());
drop policy if exists "members can read roster" on public.game_members;
create policy "members can read roster" on public.game_members for select to authenticated
using (public.is_game_member(session_id));
drop policy if exists "controller can update roster" on public.game_members;
create policy "controller can update roster" on public.game_members for update to authenticated
using (exists(select 1 from public.game_sessions gs where gs.id=game_members.session_id and gs.controller_id=auth.uid()))
with check (exists(select 1 from public.game_sessions gs where gs.id=game_members.session_id and gs.controller_id=auth.uid()));
drop policy if exists "members can read events" on public.game_events;
create policy "members can read events" on public.game_events for select to authenticated
using (public.is_game_member(session_id));
drop policy if exists "members can create own events" on public.game_events;
create policy "members can create own events" on public.game_events for insert to authenticated
with check (user_id=auth.uid() and public.is_game_member(session_id));

create or replace function public.create_game_session(initial_state jsonb default '{}'::jsonb)
returns table(session_id uuid,join_code text)
language plpgsql security definer set search_path=public
as $$
declare new_session_id uuid; new_code text; controller_device text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  controller_device := 'controller-' || auth.uid()::text;
  loop
    new_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.game_sessions gs where gs.join_code=new_code);
  end loop;
  insert into public.game_sessions(join_code,controller_id,state)
  values(new_code,auth.uid(),coalesce(initial_state,'{}'::jsonb)) returning id into new_session_id;
  insert into public.game_members(session_id,user_id,device_id,role,status,display_name)
  values(new_session_id,auth.uid(),controller_device,'controller','approved','Controlador');
  return query select new_session_id,new_code;
end $$;

create or replace function public.join_game(requested_code text,requested_device_id text,requested_role text,requested_name text default '',requested_metadata jsonb default '{}'::jsonb)
returns table(session_id uuid,member_id uuid,member_status text,session_state jsonb)
language plpgsql security definer set search_path=public
as $$
declare target public.game_sessions%rowtype; joined public.game_members%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if requested_role not in ('artifact','player') then raise exception 'Invalid role'; end if;
  if nullif(trim(requested_device_id),'') is null then raise exception 'Device id required'; end if;
  select * into target from public.game_sessions gs where gs.join_code=upper(trim(requested_code)) and gs.status<>'archived';
  if target.id is null then raise exception 'Game not found'; end if;
  insert into public.game_members(session_id,user_id,device_id,role,display_name,metadata)
  values(target.id,auth.uid(),trim(requested_device_id),requested_role,trim(requested_name),coalesce(requested_metadata,'{}'::jsonb))
  on conflict on constraint game_members_session_id_device_id_key do update set user_id=excluded.user_id,role=excluded.role,display_name=excluded.display_name,metadata=excluded.metadata,last_seen=now()
  returning * into joined;
  return query select target.id,joined.id,joined.status,target.state;
end $$;

create or replace function public.touch_game_member(target_member uuid)
returns void language sql security definer set search_path=public
as $$ update public.game_members set last_seen=now() where id=target_member and user_id=auth.uid() $$;

revoke all on public.game_sessions,public.game_members,public.game_events from anon;
grant select,update on public.game_sessions to authenticated;
grant select,update on public.game_members to authenticated;
grant select,insert on public.game_events to authenticated;
grant usage,select on sequence public.game_events_id_seq to authenticated;
revoke all on function public.is_game_member(uuid) from public,anon;
revoke all on function public.create_game_session(jsonb) from public,anon;
revoke all on function public.join_game(text,text,text,text,jsonb) from public,anon;
revoke all on function public.touch_game_member(uuid) from public,anon;
grant execute on function public.is_game_member(uuid) to authenticated;
grant execute on function public.create_game_session(jsonb) to authenticated;
grant execute on function public.join_game(text,text,text,text,jsonb) to authenticated;
grant execute on function public.touch_game_member(uuid) to authenticated;

do $$ begin alter publication supabase_realtime add table public.game_sessions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.game_events; exception when duplicate_object then null; end $$;
