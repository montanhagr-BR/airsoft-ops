create or replace function public.rejoin_game_as_controller(requested_code text)
returns table(session_id uuid, join_code text, session_state jsonb)
language plpgsql security definer set search_path = public
as $$
declare target public.game_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select gs.* into target from public.game_sessions gs
  where gs.join_code = upper(trim(requested_code)) and gs.status <> 'archived';
  if target.id is null then raise exception 'Game not found'; end if;
  if target.controller_id <> auth.uid() then raise exception 'Only the room owner can open control'; end if;
  return query select target.id, target.join_code, target.state;
end;
$$;
revoke all on function public.rejoin_game_as_controller(text) from public, anon;
grant execute on function public.rejoin_game_as_controller(text) to authenticated;
