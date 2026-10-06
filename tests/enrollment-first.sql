begin;
do $$
declare owner_id uuid:=gen_random_uuid(); created record; target public.game_sessions%rowtype;
begin
 insert into auth.users(id,email) values(owner_id,owner_id::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 select * into created from public.create_game_session('{"operationName":"Evento antes da configuração","running":false,"finished":false}');
 select * into target from public.game_sessions where id=created.session_id;
 if not target.registration_open or target.status<>'setup' then raise exception 'FAIL inscrições não abriram'; end if;
 if target.state ? 'mode' or target.state ? 'gameSeconds' then raise exception 'FAIL configuração antecipada do jogo'; end if;
 if not exists(select 1 from public.registration_operation(created.join_code) where registration_open) then raise exception 'FAIL link de inscrição indisponível'; end if;
end; $$;
rollback;
select 'PASS: evento criado com inscrições abertas e link disponível, antes de definir modo de jogo ou cronômetros. Dados de teste revertidos.' as resultado;
