begin;
create table if not exists public.platform_admins (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.app_subscriptions (user_id uuid primary key references auth.users(id) on delete cascade, plan text not null default 'Mensal', paid_until date, updated_at timestamptz not null default now());
create table if not exists public.app_payments (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), amount numeric(10,2) not null check(amount>0), paid_until date not null, note text not null default '', recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table if not exists public.admin_audit (id bigint generated always as identity primary key, actor uuid not null, action text not null, subject text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
alter table public.app_subscriptions enable row level security;
alter table public.app_payments enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.platform_admins, public.app_subscriptions, public.app_payments, public.admin_audit from anon, authenticated;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.platform_admins where user_id=auth.uid()) $$;
create or replace function public.admin_overview(search_term text default '', page_number int default 0) returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_platform_admin() then raise exception 'Acesso administrativo negado'; end if;
 select jsonb_build_object('total_users',(select count(*) from auth.users where not is_anonymous),'active_subscribers',(select count(*) from public.app_subscriptions where paid_until>=current_date),'recorded_revenue',(select coalesce(sum(amount),0) from public.app_payments),
 'users',coalesce((select jsonb_agg(row_to_json(r)) from (select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','') name,u.created_at,u.last_sign_in_at,s.plan,s.paid_until,case when s.paid_until>=current_date then 'Em dia' when s.paid_until is not null then 'Vencida' else 'Sem pagamento' end subscription_status from auth.users u left join public.app_subscriptions s on s.user_id=u.id where not u.is_anonymous and (coalesce(u.email,'') ilike '%'||left(search_term,100)||'%' or coalesce(u.raw_user_meta_data->>'full_name','') ilike '%'||left(search_term,100)||'%') order by u.created_at desc limit 50 offset greatest(page_number,0)*50) r),'[]'::jsonb),
 'games',coalesce((select jsonb_agg(row_to_json(r)) from (select g.id,g.join_code,g.status,g.created_at,u.email organizer,g.state->>'operationName' name from public.game_sessions g left join auth.users u on u.id=g.controller_id order by g.created_at desc limit 50) r),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(row_to_json(r)) from (select p.id,u.email,p.amount,p.paid_until,p.note,p.created_at from public.app_payments p join auth.users u on u.id=p.user_id order by p.created_at desc limit 50) r),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(row_to_json(r)) from (select a.action,a.subject,a.created_at,u.email actor from public.admin_audit a left join auth.users u on u.id=a.actor order by a.created_at desc limit 50) r),'[]'::jsonb)) into result;
 return result;
end $$;
create or replace function public.admin_record_payment(target_user uuid, payment_amount numeric, valid_until date, payment_note text default '') returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Acesso administrativo negado'; end if;
 if payment_amount is null or payment_amount<=0 or valid_until is null or valid_until<current_date then raise exception 'Informe valor positivo e validade atual ou futura'; end if;
 if not exists(select 1 from auth.users where id=target_user and not is_anonymous) then raise exception 'Usuário inválido'; end if;
 insert into public.app_payments(user_id,amount,paid_until,note,recorded_by) values(target_user,payment_amount,valid_until,left(payment_note,500),auth.uid());
 insert into public.app_subscriptions(user_id,paid_until) values(target_user,valid_until) on conflict(user_id) do update set paid_until=greatest(app_subscriptions.paid_until,excluded.paid_until),updated_at=now();
 insert into public.admin_audit(actor,action,subject,details) values(auth.uid(),'payment_recorded',target_user::text,jsonb_build_object('amount',payment_amount,'paid_until',valid_until));
end $$;
create or replace function public.admin_archive_game(target_game uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Acesso administrativo negado'; end if;
 update public.game_sessions set status='archived',state=state||jsonb_build_object('running',false,'finished',true,'playerRegistrationOpen',false,'endedAt',extract(epoch from now())*1000),state_version=state_version+1 where id=target_game and status<>'archived';
 if not found then raise exception 'Jogo não encontrado ou já arquivado'; end if;
 insert into public.admin_audit(actor,action,subject) values(auth.uid(),'game_archived',target_game::text);
end $$;
revoke all on function public.is_platform_admin(),public.admin_overview(text,int),public.admin_record_payment(uuid,numeric,date,text),public.admin_archive_game(uuid) from public;
grant execute on function public.is_platform_admin(),public.admin_overview(text,int),public.admin_record_payment(uuid,numeric,date,text),public.admin_archive_game(uuid) to authenticated;
commit;
