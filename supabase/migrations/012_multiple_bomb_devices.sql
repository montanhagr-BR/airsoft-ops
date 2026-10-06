begin;
-- Keep one controller/player membership per account while allowing several physical artifacts.
alter table public.game_members drop constraint if exists game_members_session_id_user_id_role_key;
create unique index if not exists game_members_one_user_role on public.game_members(session_id,user_id,role) where role<>'artifact';
commit;
