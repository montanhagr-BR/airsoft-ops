begin;
create or replace function public.open_registration_events()
returns table(session_id uuid,join_code text,operation_name text)
language sql stable security definer set search_path=public as $$
 select id,join_code,coalesce(state->>'operationName','Operação') from public.game_sessions where registration_open and status='setup' order by created_at desc limit 100;
$$;
revoke all on function public.open_registration_events() from public,anon;
grant execute on function public.open_registration_events() to authenticated;
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


-- Preserve approvals previously made directly in Controle.
update public.game_registrations r set status='approved', team=player->>'team'
from public.game_sessions gs, lateral jsonb_array_elements(coalesce(gs.state->'players','[]'::jsonb)) player
where r.session_id=gs.id and player->>'id'='P-'||r.user_id::text
and player->>'status'='approved' and player->>'team' in ('ct','terrorist');
create or replace function public.registration_roster_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare roster jsonb; r record; existing jsonb;
begin
 select coalesce(jsonb_agg(player),'[]'::jsonb) into roster from jsonb_array_elements(coalesce(new.state->'players','[]'::jsonb)) player
 where not exists(select 1 from public.game_registrations gr where gr.session_id=new.id and player->>'id'='P-'||gr.user_id::text);
 for r in select * from public.game_registrations where session_id=new.id and status<>'rejected' loop
 select player into existing from jsonb_array_elements(coalesce(new.state->'players','[]'::jsonb)) player where player->>'id'='P-'||r.user_id::text limit 1;
 roster:=roster||jsonb_build_array(coalesce(existing,'{}'::jsonb)||jsonb_build_object('id','P-'||r.user_id::text,'registrationId',r.id,'name',r.name,'organization',r.organization,'email',r.email,'phone',r.phone,'emergencyName',r.emergency_name,'emergencyPhone',r.emergency_phone,'status',r.status,'team',r.team,'requestedAt',extract(epoch from r.created_at)*1000));
 end loop;
 new.state:=jsonb_set(new.state,'{players}',roster); return new;
end; $$;
create trigger registration_roster_guard before update of state on public.game_sessions for each row execute function public.registration_roster_guard();
create or replace function public.registration_refresh_session()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.game_sessions set state=state,state_version=state_version+1,updated_at=now() where id=new.session_id;
 return new;
end; $$;
create trigger registration_refresh_session after insert or update on public.game_registrations for each row execute function public.registration_refresh_session();
update public.game_sessions set state=state,state_version=state_version+1 where status<>'archived';
commit;
