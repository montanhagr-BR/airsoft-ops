begin;
-- Preserve players approved directly in Control when loading planned forces.
create or replace function public.import_registration_forces(target_session uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare target public.game_sessions%rowtype; affected integer; latest_state jsonb;
begin
 select * into target from public.game_sessions where id=target_session for update;
 if auth.uid() is null or target.id is null or target.controller_id<>auth.uid() then raise exception 'Somente o Controle do jogo pode importar as forças.'; end if;
 if target.status<>'setup' then raise exception 'Importe as forças antes de iniciar a partida.'; end if;
 update public.game_registrations set team=planned_team,status=case when planned_team is null then 'pending' else 'approved' end,imported_at=now(),updated_at=now()
 where session_id=target.id and status<>'rejected' and ((planned_team is not null and (status<>'approved' or team is distinct from planned_team or imported_at is null)) or (planned_team is null and status='approved' and imported_at is not null));
 get diagnostics affected=row_count;
 update public.game_sessions set state=jsonb_set(jsonb_set(state,'{team1Name}',to_jsonb(coalesce(registration_force1_name,state->>'team1Name','Força 1'))),'{team2Name}',to_jsonb(coalesce(registration_force2_name,state->>'team2Name','Força 2'))),state_version=state_version+1,updated_at=now()
 where id=target.id returning state into latest_state;
 return jsonb_build_object('imported',affected,'state',latest_state,'state_version',(select state_version from public.game_sessions where id=target.id));
end; $$;

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
    status=decision,planned_team=case when decision='approved' then assigned_team else null end,imported_at=case when decision='approved' then now() else imported_at end,updated_at=now() where id=r.id;
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



commit;
