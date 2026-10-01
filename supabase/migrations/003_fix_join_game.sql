-- Remove a ambiguidade entre a coluna session_id e o campo de retorno.
create or replace function public.join_game(
  requested_code text,
  requested_device_id text,
  requested_role text,
  requested_name text default '',
  requested_metadata jsonb default '{}'::jsonb
)
returns table(
  session_id uuid,
  member_id uuid,
  member_status text,
  session_state jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.game_sessions%rowtype;
  joined public.game_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if requested_role not in ('artifact', 'player') then
    raise exception 'Invalid role';
  end if;

  if nullif(trim(requested_device_id), '') is null then
    raise exception 'Device id required';
  end if;

  select gs.*
  into target
  from public.game_sessions gs
  where gs.join_code = upper(trim(requested_code))
    and gs.status <> 'archived';

  if target.id is null then
    raise exception 'Game not found';
  end if;

  insert into public.game_members(
    session_id,
    user_id,
    device_id,
    role,
    display_name,
    metadata
  )
  values (
    target.id,
    auth.uid(),
    trim(requested_device_id),
    requested_role,
    trim(requested_name),
    coalesce(requested_metadata, '{}'::jsonb)
  )
  on conflict on constraint game_members_session_id_device_id_key
  do update set
    user_id = excluded.user_id,
    role = excluded.role,
    display_name = excluded.display_name,
    metadata = excluded.metadata,
    last_seen = now()
  returning * into joined;

  return query
  select target.id, joined.id, joined.status, target.state;
end;
$$;

revoke all on function public.join_game(text, text, text, text, jsonb)
from public, anon;

grant execute on function public.join_game(text, text, text, text, jsonb)
to authenticated;
