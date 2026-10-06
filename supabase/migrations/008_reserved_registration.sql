begin;
alter table public.game_sessions add column if not exists registration_capacity integer check (registration_capacity > 0);
alter table public.game_sessions add column if not exists registration_team_choice boolean not null default false;
alter table public.game_registrations add column if not exists requested_team text check (requested_team in ('ct','terrorist'));

create table if not exists public.game_organizers (
 session_id uuid not null references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(session_id,user_id)
);
alter table public.game_organizers enable row level security;
revoke all on public.game_organizers from anon,authenticated;
create or replace function public.is_registration_organizer(target_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (exists(select 1 from public.game_sessions where id=target_session and controller_id=auth.uid())
 or exists(select 1 from public.game_organizers where session_id=target_session and user_id=auth.uid()));
$$;
revoke all on function public.is_registration_organizer(uuid) from public,anon;
grant execute on function public.is_registration_organizer(uuid) to authenticated;
drop policy if exists "own registration or organizer" on public.game_registrations;
create policy "own registration or organizer" on public.game_registrations for select to authenticated
using (user_id=auth.uid() or public.is_registration_organizer(session_id));
create policy "registration organizers read sessions" on public.game_sessions for select to authenticated
using (exists(select 1 from public.game_organizers where session_id=id and user_id=auth.uid()));
create policy "organizers read own grant" on public.game_organizers for select to authenticated using(user_id=auth.uid());
grant select on public.game_organizers to authenticated;

create or replace function public.set_registration_organizer(target_session uuid,organizer_email text,remove_access boolean default false)
returns void language plpgsql security definer set search_path=public as $$
declare account_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.game_sessions where id=target_session and controller_id=auth.uid()) then raise exception 'Somente o dono do jogo pode alterar a equipe de organizadores.'; end if;
 select id into account_id from auth.users where lower(email)=lower(trim(organizer_email));
 if account_id is null then raise exception 'O organizador precisa criar uma conta no app primeiro.'; end if;
 if remove_access then delete from public.game_organizers where session_id=target_session and user_id=account_id;
 else insert into public.game_organizers values(target_session,account_id) on conflict do nothing; end if;
end; $$;
revoke all on function public.set_registration_organizer(uuid,text,boolean) from public,anon;
grant execute on function public.set_registration_organizer(uuid,text,boolean) to authenticated;

create or replace function public.configure_registration(target_session uuid,is_open boolean,capacity integer,team_choice boolean)
returns void language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if not public.is_registration_organizer(target_session) then raise exception 'Acesso restrito aos organizadores deste jogo.'; end if;
 if target.status<>'setup' then raise exception 'Configure as inscrições antes de iniciar a partida.'; end if;
 update public.game_sessions set registration_open=is_open,registration_capacity=capacity,registration_team_choice=team_choice where id=target_session;
end; $$;
revoke all on function public.configure_registration(uuid,boolean,integer,boolean) from public,anon;
grant execute on function public.configure_registration(uuid,boolean,integer,boolean) to authenticated;

create or replace function public.registration_capacity_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype;
begin
 select * into target from public.game_sessions where id=new.session_id for update;
 if new.status<>'rejected' and target.registration_capacity is not null and
 (select count(*) from public.game_registrations where session_id=new.session_id and status<>'rejected' and user_id<>new.user_id)>=target.registration_capacity then
 raise exception 'Vagas esgotadas para esta operação.';
 end if;
 return new;
end; $$;
create trigger registration_capacity_guard before insert or update on public.game_registrations for each row execute function public.registration_capacity_guard();
create or replace function public.registration_settings_guard()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.registration_capacity is not null and new.registration_capacity < (select count(*) from public.game_registrations where session_id=new.id and status<>'rejected') then
 raise exception 'O limite não pode ser menor que o número de vagas já reservadas.';
 end if;
 return new;
end; $$;
create trigger registration_settings_guard before update of registration_capacity on public.game_sessions for each row execute function public.registration_settings_guard();

drop function public.registration_operation(text);
create function public.registration_operation(requested_code text)
returns table(session_id uuid,operation_name text,registration_open boolean,team1_name text,team2_name text,registration_capacity integer,registration_team_choice boolean,reserved_count bigint)
language sql stable security definer set search_path=public as $$
 select gs.id,coalesce(gs.state->>'operationName','Operação'),gs.registration_open and gs.status='setup',
 coalesce(gs.state->>'team1Name','Time 1'),coalesce(gs.state->>'team2Name','Time 2'),gs.registration_capacity,gs.registration_team_choice,
 (select count(*) from public.game_registrations where session_id=gs.id and status<>'rejected')
 from public.game_sessions gs where join_code=upper(trim(requested_code)) and gs.status<>'archived';
$$;
revoke all on function public.registration_operation(text) from public;
grant execute on function public.registration_operation(text) to anon,authenticated;

create or replace function public.submit_game_registration(requested_code text,profile jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare target public.game_sessions%rowtype; registration_id uuid; chosen_team text;
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
  chosen_team:=nullif(profile->>'requestedTeam','');
  if chosen_team is not null and (not target.registration_team_choice or chosen_team not in ('ct','terrorist')) then raise exception 'A escolha de time não está disponível para este jogo.'; end if;
  insert into public.game_registrations(session_id,user_id,name,organization,email,phone,emergency_name,emergency_phone,requested_team)
  values(target.id,auth.uid(),trim(profile->>'name'),trim(coalesce(profile->>'organization','')),
    trim(profile->>'email'),trim(profile->>'phone'),trim(profile->>'emergencyName'),trim(profile->>'emergencyPhone'),chosen_team)
  on conflict(session_id,user_id) do update set name=excluded.name,organization=excluded.organization,
    email=excluded.email,phone=excluded.phone,emergency_name=excluded.emergency_name,
    emergency_phone=excluded.emergency_phone,status='pending',team=null,requested_team=excluded.requested_team,consent_at=now(),updated_at=now()
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
  if auth.uid() is null or target.id is null or not public.is_registration_organizer(target.id) then raise exception 'Somente o organizador pode definir equipes.'; end if;
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



create or replace function public.registration_organizer_operation(requested_code text)
returns setof public.game_sessions language sql stable security definer set search_path=public as $$
 select * from public.game_sessions where join_code=upper(trim(requested_code)) and public.is_registration_organizer(id);
$$;
revoke all on function public.registration_organizer_operation(text) from public,anon;
grant execute on function public.registration_organizer_operation(text) to authenticated;
create or replace function public.registration_roster_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare roster jsonb; r record; existing jsonb;
begin
 select coalesce(jsonb_agg(player),'[]'::jsonb) into roster from jsonb_array_elements(coalesce(new.state->'players','[]'::jsonb)) player
 where not exists(select 1 from public.game_registrations gr where gr.session_id=new.id and player->>'id'='P-'||gr.user_id::text);
 for r in select * from public.game_registrations where session_id=new.id and status<>'rejected' loop
 select player into existing from jsonb_array_elements(coalesce(new.state->'players','[]'::jsonb)) player where player->>'id'='P-'||r.user_id::text limit 1;
 roster:=roster||jsonb_build_array(coalesce(existing,'{}'::jsonb)||jsonb_build_object('id','P-'||r.user_id::text,'registrationId',r.id,'name',r.name,'organization',r.organization,'email',r.email,'phone',r.phone,'emergencyName',r.emergency_name,'emergencyPhone',r.emergency_phone,'status',r.status,'team',r.team,'requestedTeam',r.requested_team,'requestedAt',extract(epoch from r.created_at)*1000));
 end loop;
 new.state:=jsonb_set(new.state,'{players}',roster); return new;
end; $$;

commit;
