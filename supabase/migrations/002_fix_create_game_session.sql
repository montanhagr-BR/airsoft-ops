-- Corrige a funcao instalada pela primeira versao da migracao.
-- Pode ser executado sem apagar tabelas ou partidas existentes.
create or replace function public.create_game_session(initial_state jsonb default '{}'::jsonb)
returns table(session_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_session_id uuid;
  new_code text;
  controller_device text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  controller_device := 'controller-' || auth.uid()::text;

  loop
    new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (
      select 1
      from public.game_sessions gs
      where gs.join_code = new_code
    );
  end loop;

  insert into public.game_sessions(join_code, controller_id, state)
  values (new_code, auth.uid(), coalesce(initial_state, '{}'::jsonb))
  returning id into new_session_id;

  insert into public.game_members(
    session_id,
    user_id,
    device_id,
    role,
    status,
    display_name
  )
  values (
    new_session_id,
    auth.uid(),
    controller_device,
    'controller',
    'approved',
    'Controlador'
  );

  return query select new_session_id, new_code;
end;
$$;

revoke all on function public.create_game_session(jsonb) from public, anon;
grant execute on function public.create_game_session(jsonb) to authenticated;
