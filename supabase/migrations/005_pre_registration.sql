begin;

alter table public.game_sessions add column if not exists registration_open boolean not null default false;

create table if not exists public.game_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  organization text not null default '' check (char_length(organization) <= 50),
  email text not null check (char_length(email) <= 80),
  phone text not null check (char_length(phone) between 8 and 24),
  emergency_name text not null check (char_length(emergency_name) between 2 and 50),
  emergency_phone text not null check (char_length(emergency_phone) between 8 and 24),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  team text check (team in ('ct','terrorist')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id),
  check (status <> 'approved' or team is not null)
);
create index if not exists game_registrations_roster_idx on public.game_registrations(session_id,created_at,id);
alter table public.game_registrations enable row level security;
drop policy if exists "own registration or organizer" on public.game_registrations;
create policy "own registration or organizer" on public.game_registrations for select to authenticated
using (user_id=auth.uid() or exists(select 1 from public.game_sessions gs where gs.id=session_id and gs.controller_id=auth.uid()));
revoke all on public.game_registrations from anon,authenticated;
grant select on public.game_registrations to authenticated;

create or replace function public.registration_operation(requested_code text)
returns table(session_id uuid,operation_name text,registration_open boolean,team1_name text,team2_name text)
language sql stable security definer set search_path=public
as $$
  select gs.id, coalesce(gs.state->>'operationName','Operacao'),
    gs.registration_open and gs.status='setup',
    coalesce(gs.state->>'team1Name','Time 1'),coalesce(gs.state->>'team2Name','Time 2')
  from public.game_sessions gs where gs.join_code=upper(trim(requested_code)) and gs.status<>'archived';
$$;

create or replace function public.submit_game_registration(requested_code text,profile jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare target public.game_sessions%rowtype; registration_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para se inscrever.'; end if;
  select gs.* into target from public.game_sessions gs where gs.join_code=upper(trim(requested_code)) for update;
  if target.id is null or target.status<>'setup' or not target.registration_open then
    raise exception 'Inscricoes fechadas para esta operacao.';
  end if;
  if coalesce(profile->>'consent','false')<>'true' then raise exception 'Confirme a autorizacao de uso dos dados.'; end if;
  if trim(coalesce(profile->>'email','')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail valido.';
  end if;
  if length(regexp_replace(coalesce(profile->>'phone',''),'[^0-9]','','g'))<8
     or length(regexp_replace(coalesce(profile->>'emergencyPhone',''),'[^0-9]','','g'))<8 then
    raise exception 'Informe telefones validos.';
  end if;
  if exists(select 1 from public.game_registrations r where r.session_id=target.id and r.user_id=auth.uid() and r.status='approved') then
    raise exception 'Inscricao aprovada. Solicite a alteracao ao organizador.';
  end if;
  insert into public.game_registrations(session_id,user_id,name,organization,email,phone,emergency_name,emergency_phone)
  values(target.id,auth.uid(),trim(profile->>'name'),trim(coalesce(profile->>'organization','')),
    trim(profile->>'email'),trim(profile->>'phone'),trim(profile->>'emergencyName'),trim(profile->>'emergencyPhone'))
  on conflict(session_id,user_id) do update set name=excluded.name,organization=excluded.organization,
    email=excluded.email,phone=excluded.phone,emergency_name=excluded.emergency_name,
    emergency_phone=excluded.emergency_phone,status='pending',team=null,consent_at=now(),updated_at=now()
  returning id into registration_id;
  return registration_id;
end;
$$;

create or replace function public.assign_game_registration(registration_id uuid,assigned_team text,decision text default 'approved')
returns void language plpgsql security definer set search_path=public
as $$
declare r public.game_registrations%rowtype; target public.game_sessions%rowtype; roster jsonb; companion_team text;
begin
  select * into r from public.game_registrations where id=registration_id;
  select gs.* into target from public.game_sessions gs where gs.id=r.session_id for update;
  if auth.uid() is null or target.id is null or target.controller_id<>auth.uid() then raise exception 'Somente o organizador pode definir equipes.'; end if;
  if target.status<>'setup' then raise exception 'Organize as equipes antes de iniciar a partida.'; end if;
  select * into r from public.game_registrations where id=registration_id for update;
  if decision not in ('approved','rejected') or (decision='approved' and (assigned_team is null or assigned_team not in ('ct','terrorist'))) then raise exception 'Equipe ou decisao invalida.'; end if;
  if decision='approved' and r.organization<>'' and coalesce((target.state->>'keepOrganizationsTogether')::boolean,true) then
    select existing.team into companion_team from public.game_registrations existing
      where existing.session_id=r.session_id and existing.id<>r.id and existing.status='approved'
      and lower(existing.organization)=lower(r.organization) order by existing.created_at limit 1;
    if companion_team is not null then assigned_team:=companion_team; end if;
  end if;
  update public.game_registrations set team=case when decision='approved' then assigned_team else null end,
    status=decision,updated_at=now() where id=r.id;
  select coalesce(jsonb_agg(player),'[]'::jsonb) into roster from jsonb_array_elements(coalesce(target.state->'players','[]'::jsonb)) player
    where player->>'id'<>'P-'||r.user_id::text;
  if decision='approved' then
    roster:=roster||jsonb_build_array(jsonb_build_object('id','P-'||r.user_id::text,'name',r.name,
      'organization',r.organization,
      'team',assigned_team,'status','approved','approvedAt',extract(epoch from now())*1000,
      'requestedAt',extract(epoch from r.created_at)*1000,'lastSeen',0,'lat',null,'lng',null));
  end if;
  update public.game_sessions set state=jsonb_set(target.state,'{players}',roster),state_version=state_version+1,updated_at=now() where id=target.id;
end;
$$;

revoke all on function public.registration_operation(text) from public;
grant execute on function public.registration_operation(text) to anon,authenticated;
revoke all on function public.submit_game_registration(text,jsonb) from public,anon;
grant execute on function public.submit_game_registration(text,jsonb) to authenticated;
revoke all on function public.assign_game_registration(uuid,text,text) from public,anon;
grant execute on function public.assign_game_registration(uuid,text,text) to authenticated;
commit;
