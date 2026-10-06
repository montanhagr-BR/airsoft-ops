begin;
alter table public.game_registrations add column if not exists planned_team text check (planned_team in ('ct','terrorist'));
alter table public.game_registrations add column if not exists imported_at timestamptz;
alter table public.game_sessions add column if not exists registration_force1_name text check (char_length(registration_force1_name) between 1 and 24);
alter table public.game_sessions add column if not exists registration_force2_name text check (char_length(registration_force2_name) between 1 and 24);
-- Preserve forces that were already confirmed before this planning screen existed.
update public.game_registrations set planned_team=team where status='approved' and planned_team is null;

create or replace function public.plan_registration_force(registration_id uuid,force_team text,move_organization boolean default false)
returns integer language plpgsql security definer set search_path=public as $$
declare r public.game_registrations%rowtype; target public.game_sessions%rowtype; affected integer;
begin
 select * into r from public.game_registrations where id=registration_id;
 select * into target from public.game_sessions where id=r.session_id for update;
 if target.id is null or not public.is_registration_organizer(target.id) then raise exception 'Acesso restrito aos organizadores deste jogo.'; end if;
 if target.status<>'setup' then raise exception 'Organize as forças antes de iniciar a partida.'; end if;
 if force_team is not null and force_team not in ('ct','terrorist') then raise exception 'Força inválida.'; end if;
 if r.status='rejected' then raise exception 'A inscrição recusada não pode ser organizada.'; end if;
 update public.game_registrations set planned_team=force_team,updated_at=now()
 where session_id=target.id and status<>'rejected' and
 (id=r.id or (move_organization and r.organization<>'' and lower(trim(organization))=lower(trim(r.organization))));
 get diagnostics affected=row_count;
 return affected;
end; $$;

create or replace function public.name_registration_forces(target_session uuid,force1_name text,force2_name text)
returns void language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if target.id is null or not public.is_registration_organizer(target.id) then raise exception 'Acesso restrito aos organizadores deste jogo.'; end if;
 if target.status<>'setup' then raise exception 'Organize as forças antes de iniciar a partida.'; end if;
 if force1_name is null or force2_name is null or length(trim(force1_name)) not between 1 and 24 or length(trim(force2_name)) not between 1 and 24 then raise exception 'Informe os nomes das duas forças, com até 24 caracteres.'; end if;
 update public.game_sessions set registration_force1_name=trim(force1_name),registration_force2_name=trim(force2_name) where id=target.id;
end; $$;

create or replace function public.registration_force_summary(target_session uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_registration_organizer(target_session) then raise exception 'Acesso restrito aos organizadores deste jogo.'; end if;
 select jsonb_build_object('unassigned',count(*) filter(where planned_team is null and status<>'rejected'),
 'ct',count(*) filter(where planned_team='ct' and status<>'rejected'),
 'terrorist',count(*) filter(where planned_team='terrorist' and status<>'rejected'),
 'rejected',count(*) filter(where status='rejected'),
 'pending_import',count(*) filter(where status<>'rejected' and ((planned_team is not null and status<>'approved') or (status='approved' and team is distinct from planned_team)))) into result
 from public.game_registrations where session_id=target_session;
 return result;
end; $$;

create or replace function public.import_registration_forces(target_session uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype; affected integer; latest_state jsonb;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if auth.uid() is null or target.id is null or target.controller_id<>auth.uid() then raise exception 'Somente o Controle do jogo pode importar as forças.'; end if;
 if target.status<>'setup' then raise exception 'Importe as forças antes de iniciar a partida.'; end if;
 update public.game_registrations set team=planned_team,status=case when planned_team is null then 'pending' else 'approved' end,imported_at=now(),updated_at=now()
 where session_id=target.id and status<>'rejected' and ((planned_team is not null and (status<>'approved' or team is distinct from planned_team or imported_at is null)) or (planned_team is null and status='approved'));
 get diagnostics affected=row_count;
 update public.game_sessions set state=jsonb_set(jsonb_set(state,'{team1Name}',to_jsonb(coalesce(registration_force1_name,state->>'team1Name','Força 1'))),'{team2Name}',to_jsonb(coalesce(registration_force2_name,state->>'team2Name','Força 2'))),state_version=state_version+1,updated_at=now()
 where id=target.id returning state into latest_state;
 return jsonb_build_object('imported',affected,'state',latest_state);
end; $$;

revoke all on function public.plan_registration_force(uuid,text,boolean) from public,anon;
revoke all on function public.name_registration_forces(uuid,text,text) from public,anon;
revoke all on function public.registration_force_summary(uuid) from public,anon;
revoke all on function public.import_registration_forces(uuid) from public,anon;
grant execute on function public.plan_registration_force(uuid,text,boolean) to authenticated;
grant execute on function public.name_registration_forces(uuid,text,text) to authenticated;
grant execute on function public.registration_force_summary(uuid) to authenticated;
grant execute on function public.import_registration_forces(uuid) to authenticated;
commit;
