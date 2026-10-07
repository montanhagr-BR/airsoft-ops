begin;
insert into auth.users(id,email,is_anonymous) values('99000000-0000-0000-0000-000000000014','trial-test@example.invalid',false);
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000014',true);
do $$ declare first_expiry text; begin
if not (public.my_app_access()->>'allowed')::boolean then raise exception 'New trial denied'; end if;
first_expiry:=public.my_app_access()->>'trial_expires_at';
if first_expiry<>(public.my_app_access()->>'trial_expires_at') then raise exception 'Trial restarted'; end if;
update public.app_trials set expires_at=now()-interval '1 second' where user_id=auth.uid();
if (public.my_app_access()->>'allowed')::boolean then raise exception 'Expired trial accepted'; end if;
begin
 insert into public.game_sessions(join_code,controller_id) values('TST014',auth.uid());
 raise exception 'Expired account created a game';
exception when others then
 if position('7 dias' in SQLERRM)=0 then raise; end if;
end;
insert into public.app_subscriptions(user_id,paid_until) values(auth.uid(),current_date+30);
if not (public.my_app_access()->>'allowed')::boolean then raise exception 'Paid access denied'; end if;
end $$;
rollback;
select 'PASS: 7 day trial, fixed expiry, expired denial, paid access; test data reverted' as result;
