begin;
create table if not exists public.game_bomb_devices (
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 id text not null, user_id uuid references auth.users(id), member_device_id text,
 name text not null, type text not null default 'tablet' check(type in ('tablet','phone','notebook')),
 status text not null default 'pending' check(status in ('pending','approved','removed')),
 bomb_id text, requested_at timestamptz not null default now(), approved_at timestamptz,
 last_seen timestamptz not null default now(), primary key(session_id,id)
);
alter table public.game_bomb_devices enable row level security;
revoke all on public.game_bomb_devices from anon,authenticated;
-- Preserve the existing device roster and approvals during upgrade.
insert into public.game_bomb_devices(session_id,id,name,type,status,bomb_id)
select gs.id,d->>'id',coalesce(nullif(d->>'name',''),'Dispositivo'),
 case when d->>'type' in ('tablet','phone','notebook') then d->>'type' else 'tablet' end,
 case when d->>'status'='approved' then 'approved' else 'pending' end,d->>'bombId'
from public.game_sessions gs cross join lateral jsonb_array_elements(coalesce(gs.state->'bombDevices','[]')) d
where nullif(d->>'id','') is not null on conflict do nothing;

create or replace function public.bomb_device_roster_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare roster jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'status',status,
 'bombId',bomb_id,'userId',user_id,'memberDeviceId',member_device_id,
 'requestedAt',extract(epoch from requested_at)*1000,'approvedAt',extract(epoch from approved_at)*1000,
 'lastSeen',extract(epoch from last_seen)*1000) order by requested_at,id),'[]') into roster
 from public.game_bomb_devices where session_id=new.id and status<>'removed';
 new.state=jsonb_set(new.state,'{bombDevices}',roster);return new;
end; $$;
drop trigger if exists bomb_device_roster_guard on public.game_sessions;
create trigger bomb_device_roster_guard before update of state on public.game_sessions
for each row execute function public.bomb_device_roster_guard();

create or replace function public.register_bomb_device(target_session uuid,registration_id text,member_device text,device_name text,device_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype; existing public.game_bomb_devices%rowtype; result jsonb;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if auth.uid() is null or target.id is null or not exists(select 1 from public.game_members where session_id=target.id and user_id=auth.uid() and device_id=member_device and role='artifact') then raise exception 'Entre como Bomba nesta operação antes de cadastrar o aparelho.'; end if;
 select * into existing from public.game_bomb_devices where session_id=target.id and id=registration_id;
 if target.status<>'setup' and not (target.status='running' and existing.status='approved' and existing.user_id is null and existing.member_device_id is null) then raise exception 'Cadastre o dispositivo antes de iniciar a partida.'; end if;
 if length(trim(coalesce(device_name,''))) not between 2 and 40 or device_type not in ('tablet','phone','notebook') or length(coalesce(registration_id,'')) not between 1 and 120 then raise exception 'Informe nome e tipo válidos para o aparelho.'; end if;
 if existing.user_id is not null and existing.user_id<>auth.uid() then raise exception 'Este cadastro pertence a outro operador.'; end if;
 if exists(select 1 from public.game_bomb_devices where session_id=target.id and member_device_id=member_device and id<>registration_id and status<>'removed') then raise exception 'Este aparelho já possui um cadastro nesta operação.'; end if;
 insert into public.game_bomb_devices(session_id,id,user_id,member_device_id,name,type)
 values(target.id,registration_id,auth.uid(),member_device,trim(device_name),device_type)
 on conflict(session_id,id) do update set user_id=excluded.user_id,member_device_id=excluded.member_device_id,
 name=excluded.name,type=excluded.type,status=case when game_bomb_devices.status='removed' then 'pending' else game_bomb_devices.status end,
 bomb_id=case when game_bomb_devices.status='removed' then null else game_bomb_devices.bomb_id end,last_seen=now();
 update public.game_members set display_name=trim(device_name),status=(select case when status='approved' then 'approved' else 'pending' end from public.game_bomb_devices where session_id=target.id and id=registration_id),metadata=coalesce(metadata,'{}')||jsonb_build_object('bombDeviceId',registration_id,'deviceType',device_type) where session_id=target.id and device_id=member_device and user_id=auth.uid() and role='artifact';
 update public.game_sessions set state=state,state_version=state_version+1,updated_at=now() where id=target.id
 returning jsonb_build_object('state',state,'state_version',state_version,'status',status) into result;
 return result;
end; $$;

create or replace function public.assign_bomb_device(target_session uuid,registration_id text,selected_bomb text,remove_device boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype; result jsonb;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if auth.uid() is null or target.id is null or target.controller_id<>auth.uid() then raise exception 'Somente o Controle pode aprovar dispositivos.'; end if;
 if target.status<>'setup' then raise exception 'Organize os dispositivos antes de iniciar a partida.'; end if;
 if not exists(select 1 from public.game_bomb_devices where session_id=target.id and id=registration_id and status<>'removed') then raise exception 'Dispositivo não encontrado.'; end if;
 if not remove_device then
  if not exists(select 1 from jsonb_array_elements(coalesce(target.state->'bombSequence','[]')) b where b->>'id'=selected_bomb) then raise exception 'Escolha uma bomba válida antes de aprovar.'; end if;
  if exists(select 1 from public.game_bomb_devices where session_id=target.id and id<>registration_id and status='approved' and bomb_id=selected_bomb) then raise exception 'Esta bomba já está vinculada a outro dispositivo.'; end if;
 end if;
 update public.game_bomb_devices set status=case when remove_device then 'removed' else 'approved' end,
 bomb_id=case when remove_device then null else selected_bomb end,approved_at=case when remove_device then null else now() end
 where session_id=target.id and id=registration_id;
 update public.game_members set status=case when remove_device then 'rejected' else 'approved' end where session_id=target.id and role='artifact' and device_id=(select member_device_id from public.game_bomb_devices where session_id=target.id and id=registration_id);
 update public.game_sessions set state=state,state_version=state_version+1,updated_at=now() where id=target.id
 returning jsonb_build_object('state',state,'state_version',state_version,'status',status) into result;
 return result;
end; $$;

create or replace function public.touch_bomb_device(target_session uuid,registration_id text,member_device text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.game_members where session_id=target_session and user_id=auth.uid() and device_id=member_device and role='artifact') then return; end if;
 perform 1 from public.game_sessions where id=target_session and status in ('setup','running') for update;
 if not found then return; end if;
 update public.game_bomb_devices set last_seen=now() where session_id=target_session and id=registration_id and user_id=auth.uid() and member_device_id=member_device and status<>'removed';
 if found then update public.game_sessions set state=state,state_version=state_version+1,updated_at=now() where id=target_session; end if;
end; $$;
revoke all on function public.register_bomb_device(uuid,text,text,text,text) from public,anon;
revoke all on function public.assign_bomb_device(uuid,text,text,boolean) from public,anon;
revoke all on function public.touch_bomb_device(uuid,text,text) from public,anon;
grant execute on function public.register_bomb_device(uuid,text,text,text,text),public.assign_bomb_device(uuid,text,text,boolean),public.touch_bomb_device(uuid,text,text) to authenticated;
drop policy if exists "members can create own events" on public.game_events;
create policy "members can create own events" on public.game_events for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.game_members gm where gm.session_id=game_events.session_id and gm.user_id=auth.uid() and gm.device_id=game_events.device_id and gm.role in ('player','artifact')));
commit;
