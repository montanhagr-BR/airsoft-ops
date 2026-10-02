begin;

-- Keep existing events. Archived events release a slot; finished events still count.
create or replace function public.enforce_event_limits()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_OP='UPDATE' and new.controller_id is distinct from old.controller_id then
    raise exception 'O organizador da partida nao pode ser alterado.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.controller_id::text, 0));
  if new.status<>'archived' and (TG_OP='INSERT' or old.status='archived') then
    if (select count(*) from public.game_sessions gs where gs.controller_id=new.controller_id
        and gs.status<>'archived' and gs.id<>new.id)>=3 then
      raise exception 'Voce pode manter ate 3 jogos. Arquive um jogo antes de criar outro.';
    end if;
  end if;
  if new.status='running' or coalesce(new.state->>'running','false')='true' then
    if new.status<>'archived' and exists(select 1 from public.game_sessions gs
      where gs.controller_id=new.controller_id and gs.id<>new.id and gs.status<>'archived'
      and (gs.status='running' or coalesce(gs.state->>'running','false')='true')) then
      raise exception 'Apenas um jogo pode estar iniciado por vez. Encerre o jogo atual primeiro.';
    end if;
    new.registration_open:=false;
  end if;
  if TG_OP='INSERT' and new.status='setup' then new.registration_open:=true; end if;
  return new;
end;
$$;
revoke all on function public.enforce_event_limits() from public,anon,authenticated;
drop trigger if exists event_limits on public.game_sessions;
create trigger event_limits before insert or update on public.game_sessions
for each row execute function public.enforce_event_limits();

-- Waiting-list entries do not enroll players or assign teams.
create or replace function public.assign_game_registration(registration_id uuid,assigned_team text,decision text default 'approved')
returns void language plpgsql security definer set search_path=public as $$
begin
  raise exception 'A inscricao antecipada e apenas uma lista de espera. Cadastre e aprove os jogadores no Controle quando entrarem na partida.';
end;
$$;

create or replace function public.my_waitlist_events()
returns table(session_id uuid,join_code text,operation_name text,event_status text,registered_at timestamptz)
language sql stable security definer set search_path=public as $$
  select gs.id,gs.join_code,coalesce(gs.state->>'operationName','Operacao'),gs.status,r.created_at
  from public.game_registrations r join public.game_sessions gs on gs.id=r.session_id
  where r.user_id=auth.uid() and gs.status<>'archived' order by r.created_at desc;
$$;
revoke all on function public.my_waitlist_events() from public,anon;
grant execute on function public.my_waitlist_events() to authenticated;
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
commit;

