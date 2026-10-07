begin;
create table if not exists public.app_trials(user_id uuid primary key references auth.users(id) on delete cascade, started_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '7 days'));
alter table public.app_trials enable row level security;
revoke all on public.app_trials from anon,authenticated;
insert into public.app_trials(user_id) select id from auth.users where not is_anonymous on conflict do nothing;
create or replace function public.my_app_access() returns jsonb language plpgsql security definer set search_path=public as $$
declare trial public.app_trials; paid date; allowed boolean;
begin
 if auth.uid() is null then raise exception 'Entre com sua conta'; end if;
 insert into public.app_trials(user_id) values(auth.uid()) on conflict do nothing;
 select * into trial from public.app_trials where user_id=auth.uid();
 select paid_until into paid from public.app_subscriptions where user_id=auth.uid();
 allowed:=public.is_platform_admin() or trial.expires_at>now() or paid>=current_date;
 return jsonb_build_object('allowed',coalesce(allowed,false),'admin',public.is_platform_admin(),'trial_expires_at',trial.expires_at,'paid_until',paid,'monthly_price',30);
end $$;
revoke all on function public.my_app_access() from public;
grant execute on function public.my_app_access() to authenticated;
create or replace function public.require_app_access() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and not coalesce((public.my_app_access()->>'allowed')::boolean,false) then raise exception 'Seu teste de 7 dias terminou. Assinatura mensal necessÃ¡ria.'; end if;
 return new;
end $$;
revoke all on function public.require_app_access() from public;
drop trigger if exists subscription_access_guard on public.game_sessions;
create trigger subscription_access_guard before insert or update on public.game_sessions for each row execute function public.require_app_access();
drop trigger if exists subscription_access_guard on public.game_members;
create trigger subscription_access_guard before insert or update on public.game_members for each row execute function public.require_app_access();
drop trigger if exists subscription_access_guard on public.game_events;
create trigger subscription_access_guard before insert on public.game_events for each row execute function public.require_app_access();
drop trigger if exists subscription_access_guard on public.game_registrations;
create trigger subscription_access_guard before insert or update on public.game_registrations for each row execute function public.require_app_access();
drop trigger if exists subscription_access_guard on public.game_bomb_devices;
create trigger subscription_access_guard before insert or update on public.game_bomb_devices for each row execute function public.require_app_access();
commit;
