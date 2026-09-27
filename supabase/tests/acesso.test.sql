-- Regras de acesso do diário, testadas como cada papel. Rode com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Pessoas: Ana cria o diário; Bia é convidada como cuidadora; Caio como leitor; Davi não tem acesso.
-- A Eva tem convite, mas o e-mail dela não foi confirmado.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@exemplo.com',  now(), '{"full_name":"Ana"}'),
  ('00000000-0000-0000-0000-00000000000b', 'Bia@Exemplo.com',  now(), '{"full_name":"Bia"}'),
  ('00000000-0000-0000-0000-00000000000c', 'caio@exemplo.com', now(), '{"name":"Caio"}'),
  ('00000000-0000-0000-0000-00000000000d', 'davi@exemplo.com', now(), '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'eva@exemplo.com',  null,  '{}');

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.anonimo() returns void language sql as $$
  select set_config('role', 'anon', true), set_config('request.jwt.claims', '{"role":"anon"}', true)
$$;

-- ---- Ana cria o diário e convida -------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.criar_diario('Miguel') $$, 'quem entra pode criar um diário');
create temp table t_diario on commit drop as select id from public.diarios;
grant select on t_diario to authenticated, anon;
select is((select papel from public.membros where user_id = auth.uid()), 'dono', 'quem cria vira dono');
select lives_ok($$ insert into public.convites (diario_id, email, papel)
                   select id, 'bia@exemplo.com', 'cuidador' from t_diario $$, 'o dono convida uma cuidadora');
select lives_ok($$ insert into public.convites (diario_id, email, papel)
                   select id, 'caio@exemplo.com', 'leitor' from t_diario $$, 'o dono convida um leitor');
select lives_ok($$ insert into public.convites (diario_id, email, papel)
                   select id, 'eva@exemplo.com', 'cuidador' from t_diario $$, 'o dono convida alguém sem e-mail confirmado');
select throws_ok($$ insert into public.convites (diario_id, email, papel)
                    select id, 'x@exemplo.com', 'dono' from t_diario $$, '23514', null, 'convite não pode dar o papel de dono');
select lives_ok($$ select public.gravar_dia((select id from t_diario), '2026-09-20',
  '{"refeicoes":{"cafe":{"antes":110,"antesHora":"07:10","insulina":2.5,"comeu":"pão","tags":["Na escola"],
    "criadoPor":"alguem-de-fora","criadoEm":1790000000123,"atualizadoEm":1790000000456}},
    "hipos":[{"id":"h1","hora":"10:00","valor":62,"sintomas":["Tremor"]}],
    "extras":{"x1":{"id":"x1","hora":"22:00","lo":true}}}') $$, 'o dono registra um dia (hipos ainda em lista)');

select is((select dia -> 'refeicoes' -> 'cafe' from public.ler_dias((select id from t_diario))),
  '{"antes":110,"antesHora":"07:10","insulina":2.5,"comeu":"pão","tags":["Na escola"],
    "criadoPor":"00000000-0000-0000-0000-00000000000a","atualizadoPor":"00000000-0000-0000-0000-00000000000a",
    "criadoEm":1790000000123,"atualizadoEm":1790000000456}'::jsonb,
  'a refeição volta igual, com milissegundos exatos e autoria carimbada pelo banco (não pelo navegador)');
select is((select dia -> 'hipos' -> 'h1' ->> 'valor' from public.ler_dias((select id from t_diario))), '62',
  'hipoglicemia gravada em lista volta como mapa por id');
select is((select dia -> 'extras' -> 'x1' -> 'lo' from public.ler_dias((select id from t_diario))), 'true'::jsonb,
  'medição extra com LO');

select lives_ok($$ select public.gravar_sensor((select id from t_diario), '2026-09-20',
  '{"min":[480,15,15],"mg":[120,98,101],"tipo":[0,0,1]}') $$, 'o dono importa um dia do sensor');
select is((select doc - 'atualizadoEm' - 'data' - 'importadoPor' from public.ler_sensor((select id from t_diario))),
  '{"fonte":"LibreView","min":[15,15,480],"mg":[98,101,120],"tipo":[0,1,0]}'::jsonb,
  'as leituras voltam ordenadas por horário, separando leitura automática de escaneamento');
select lives_ok($$ select public.gravar_sensor((select id from t_diario), '2026-09-20', '{"min":[15],"mg":[99]}') $$,
  'importar de novo o mesmo dia substitui as leituras');
select is((select doc -> 'mg' from public.ler_sensor((select id from t_diario))), '[99]'::jsonb, 'só a leitura nova ficou');

-- ---- Bia entra, aceita o convite e registra ---------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-00000000000b');
select is((select papel from public.entrar()), 'cuidador', 'o convite é aceito pelo e-mail, sem diferenciar maiúsculas');
select is((select nome from public.membros where user_id = auth.uid()), 'Bia', 'o nome vem da conta Google');
select is((select count(*)::int from public.convites), 0, 'cuidadora não vê convites');
select lives_ok($$ select public.gravar_dia((select id from t_diario), '2026-09-20',
  '{"refeicoes":{"almoco":{"antes":140,"comeu":"arroz"}}}') $$, 'cuidadora registra outra refeição do mesmo dia');
select is((select jsonb_object_keys(dia -> 'refeicoes') from public.ler_dias((select id from t_diario)) order by 1 limit 1),
  'almoco', 'a gravação parcial não apaga a refeição de outra pessoa');
select is((select count(*)::int from public.refeicoes), 2, 'as duas refeições estão no dia');
select lives_ok($$ select public.gravar_dia((select id from t_diario), '2026-09-20', '{"refeicoes":{"almoco":null}}') $$,
  'null apaga só aquela refeição');
select is((select count(*)::int from public.refeicoes), 1, 'sobrou só o café');
select throws_ok($$ select public.apagar_tudo((select id from t_diario)) $$, '42501', null, 'cuidadora não apaga tudo');
select lives_ok($$ delete from public.membros where papel = 'dono' $$, 'tentar remover o dono não dá erro...');
select is((select count(*)::int from public.membros where papel = 'dono'), 1, '...mas o dono continua');
select lives_ok($$ update public.membros set papel = 'dono' where user_id = auth.uid() $$, 'tentar virar dono não dá erro...');
select is((select papel from public.membros where user_id = auth.uid()), 'cuidador', '...mas o papel não muda');

-- ---- Caio só vê -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-00000000000c');
select is((select papel from public.entrar()), 'leitor', 'leitor entra pelo convite');
select is((select count(*)::int from public.ler_dias((select id from t_diario))), 1, 'leitor vê os dias');
select throws_ok($$ select public.gravar_dia((select id from t_diario), '2026-09-21', '{"refeicoes":{"cafe":{"antes":90}}}') $$,
  '42501', null, 'leitor não registra');
select throws_ok($$ insert into public.refeicoes (diario_id, data, refeicao, antes)
                    select id, '2026-09-20', 'ceia', 90 from t_diario $$, '42501', null, 'leitor não grava direto na tabela');
select lives_ok($$ update public.diarios set plano = 'x' $$, 'leitor tentando mudar o plano não dá erro...');
select is((select plano from public.diarios), '', '...mas o plano não muda');

-- ---- Quem não foi convidado, ou não confirmou o e-mail, não vê nada ---------------------------
select pg_temp.como('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.entrar()), 0, 'sem convite, nenhum diário');
select is((select count(*)::int from public.ler_dias((select id from t_diario))), 0, 'sem convite, não lê registros');
select pg_temp.como('00000000-0000-0000-0000-00000000000e');
select is((select count(*)::int from public.entrar()), 0, 'e-mail não confirmado não aceita convite');
select pg_temp.anonimo();
select throws_ok($$ select * from public.refeicoes $$, '42501', null, 'sem login, nem a tabela abre');

-- ---- Dono apaga tudo ------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.apagar_tudo((select id from t_diario)) $$, 'o dono apaga tudo');
select is((select count(*)::int from public.refeicoes) + (select count(*)::int from public.hipos) + (select count(*)::int from public.dias),
  0, 'registros e dias somem; as pessoas com acesso continuam');

select * from finish();
rollback;
