-- Diário de Glicemia: banco para usar o site fora do Claude (Supabase / Postgres).
--
-- Modelo: um diário por criança; cada pessoa entra com a conta Google e tem um papel nele.
--   dono      cria o diário, convida e remove pessoas, apaga tudo
--   cuidador  registra e edita
--   leitor    só vê (ex.: equipe médica)
-- Quem entra pela primeira vez só enxerga um diário se o e-mail dela tiver sido convidado.
--
-- O site conversa direto com o banco (não há servidor próprio). A segurança está nas políticas de
-- Row Level Security abaixo: a chave pública do site só permite o que estas regras permitem.
--
-- Os registros de um dia ficam em tabelas separadas (refeicoes, hipos, extras) penduradas em `dias`.
-- O site envia e recebe cada dia como um objeto JSON (o mesmo formato do banco do Claude); as funções
-- gravar_dia e ler_dias fazem a tradução, numa transação só.

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------

create table public.diarios (
  id                  uuid primary key default gen_random_uuid(),
  nome_crianca        text not null default '' check (char_length(nome_crianca) <= 80),
  plano               text not null default '' check (char_length(plano) <= 5000),
  criado_em           timestamptz not null default now(),
  -- Muda quando "Apagar todos os dados" roda, para os outros aparelhos recarregarem tudo.
  apagado_em          timestamptz
);

create table public.membros (
  diario_id  uuid not null references public.diarios on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  papel      text not null check (papel in ('dono', 'cuidador', 'leitor')),
  -- Nome e e-mail vêm da conta Google e são atualizados a cada entrada; servem para mostrar "anotado por".
  nome       text not null default '',
  email      text not null default '',
  entrou_em  timestamptz not null default now(),
  primary key (diario_id, user_id)
);
create unique index membros_um_dono on public.membros (diario_id) where papel = 'dono';
create index membros_por_usuario on public.membros (user_id);

create table public.convites (
  diario_id      uuid not null references public.diarios on delete cascade,
  email          text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  papel          text not null check (papel in ('cuidador', 'leitor')),
  convidado_por  uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  primary key (diario_id, email)
);

-- Cabeçalho do dia. Toda gravação atualiza `atualizado_em`, e é esta tabela que os outros aparelhos
-- acompanham em tempo real (inclusive quando um registro do dia é apagado).
create table public.dias (
  diario_id      uuid not null references public.diarios on delete cascade,
  data           date not null,
  atualizado_em  timestamptz not null default now(),
  primary key (diario_id, data)
);

create table public.refeicoes (
  diario_id       uuid not null,
  data            date not null,
  refeicao        text not null check (refeicao in ('cafe', 'lanche', 'almoco', 'tarde', 'janta', 'ceia')),
  antes           numeric check (antes between 0 and 1500),
  antes_hora      time,
  antes_em        timestamptz,
  refeicao_hora   time,
  insulina        numeric check (insulina between 0 and 200),
  carbo           numeric check (carbo between 0 and 1000),
  local           text check (local ~ '^[a-z-]{1,20}$'),
  depois          numeric check (depois between 0 and 1500),
  depois_hora     time,
  comeu           text check (char_length(comeu) <= 1000),
  obs             text check (char_length(obs) <= 2000),
  tags            text[] check (cardinality(tags) <= 30),
  criado_por      uuid references auth.users on delete set null,
  atualizado_por  uuid references auth.users on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (diario_id, data, refeicao),
  foreign key (diario_id, data) references public.dias on delete cascade
);

create table public.hipos (
  diario_id       uuid not null,
  data            date not null,
  id              text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  hora            time,
  valor           numeric check (valor between 0 and 1500),
  lo              boolean,
  situacao        text check (char_length(situacao) <= 100),
  sintomas        text[] check (cardinality(sintomas) <= 30),
  tratamento      text check (char_length(tratamento) <= 1000),
  nova            numeric check (nova between 0 and 1500),
  nova_hora       time,
  obs             text check (char_length(obs) <= 2000),
  criado_por      uuid references auth.users on delete set null,
  atualizado_por  uuid references auth.users on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (diario_id, data, id),
  foreign key (diario_id, data) references public.dias on delete cascade
);

create table public.extras (
  diario_id       uuid not null,
  data            date not null,
  id              text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  hora            time,
  valor           numeric check (valor between 0 and 1500),
  lo              boolean,
  hi              boolean,
  momento         text check (char_length(momento) <= 100),
  obs             text check (char_length(obs) <= 2000),
  criado_por      uuid references auth.users on delete set null,
  atualizado_por  uuid references auth.users on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (diario_id, data, id),
  foreign key (diario_id, data) references public.dias on delete cascade
);

-- Sensor (FreeStyle Libre): um cabeçalho por dia importado e uma linha por leitura.
create table public.sensor_dias (
  diario_id      uuid not null references public.diarios on delete cascade,
  data           date not null,
  fonte          text not null default 'LibreView' check (char_length(fonte) <= 40),
  importado_por  uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  primary key (diario_id, data)
);

create table public.sensor_leituras (
  diario_id  uuid not null,
  data       date not null,
  minuto     smallint not null check (minuto between 0 and 1439),
  -- 0 = leitura automática (a cada 15 min), 1 = escaneamento
  tipo       smallint not null default 0 check (tipo in (0, 1)),
  mg         numeric not null check (mg between 0 and 1500),
  primary key (diario_id, data, minuto, tipo),
  foreign key (diario_id, data) references public.sensor_dias on delete cascade
);

-- ---------------------------------------------------------------------------------------------
-- Papel de quem está logado
-- ---------------------------------------------------------------------------------------------

-- security definer: lê `membros` sem passar pelas políticas dela (evita recursão nas políticas).
create function public.papel_no_diario(p_diario uuid) returns text
language sql stable security definer set search_path = '' as $$
  select papel from public.membros where diario_id = p_diario and user_id = auth.uid()
$$;

create function public.pode_escrever(p_diario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.papel_no_diario(p_diario) in ('dono', 'cuidador'), false)
$$;

-- ---------------------------------------------------------------------------------------------
-- Autoria: sempre carimbada pelo banco com o usuário logado, nunca aceita do navegador.
-- ---------------------------------------------------------------------------------------------

create function public.carimbar_autoria() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_por := auth.uid();
  return new;
end $$;

create trigger autoria before insert or update on public.refeicoes for each row execute function public.carimbar_autoria();
create trigger autoria before insert or update on public.hipos     for each row execute function public.carimbar_autoria();
create trigger autoria before insert or update on public.extras    for each row execute function public.carimbar_autoria();

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------

alter table public.diarios         enable row level security;
alter table public.membros         enable row level security;
alter table public.convites        enable row level security;
alter table public.dias            enable row level security;
alter table public.refeicoes       enable row level security;
alter table public.hipos           enable row level security;
alter table public.extras          enable row level security;
alter table public.sensor_dias     enable row level security;
alter table public.sensor_leituras enable row level security;

-- Sem login, nada: nem leitura.
revoke all on all tables in schema public from anon;

-- diarios: só membros veem; dono e cuidador mudam nome e plano; só o dono apaga.
-- Diários são criados pela função criar_diario, que já inclui quem criou como dono.
revoke insert, update on public.diarios from authenticated;
grant update (nome_crianca, plano) on public.diarios to authenticated;
create policy diarios_ver on public.diarios for select to authenticated
  using (public.papel_no_diario(id) is not null);
create policy diarios_editar on public.diarios for update to authenticated
  using (public.pode_escrever(id)) with check (public.pode_escrever(id));
create policy diarios_apagar on public.diarios for delete to authenticated
  using (public.papel_no_diario(id) = 'dono');

-- membros: todos do diário veem quem mais tem acesso (para os nomes em "anotado por").
-- O dono muda o papel de quem não é dono e remove pessoas; qualquer um (menos o dono) pode sair.
-- Ninguém se inclui sozinho: a entrada é pela função entrar, a partir de um convite.
revoke insert, update on public.membros from authenticated;
grant update (papel) on public.membros to authenticated;
create policy membros_ver on public.membros for select to authenticated
  using (public.papel_no_diario(diario_id) is not null);
create policy membros_mudar_papel on public.membros for update to authenticated
  using (public.papel_no_diario(diario_id) = 'dono' and papel <> 'dono')
  with check (papel in ('cuidador', 'leitor'));
create policy membros_remover on public.membros for delete to authenticated
  using (papel <> 'dono' and (public.papel_no_diario(diario_id) = 'dono' or user_id = auth.uid()));

-- convites: só o dono vê, cria e cancela.
create policy convites_dono on public.convites for all to authenticated
  using (public.papel_no_diario(diario_id) = 'dono')
  with check (public.papel_no_diario(diario_id) = 'dono' and convidado_por = auth.uid());

-- Registros: membros leem; dono e cuidador gravam.
do $$
declare t text;
begin
  foreach t in array array['dias', 'refeicoes', 'hipos', 'extras', 'sensor_dias', 'sensor_leituras'] loop
    execute format('create policy %1$s_ver on public.%1$I for select to authenticated using (public.papel_no_diario(diario_id) is not null)', t);
    execute format('create policy %1$s_criar on public.%1$I for insert to authenticated with check (public.pode_escrever(diario_id))', t);
    execute format('create policy %1$s_alterar on public.%1$I for update to authenticated using (public.pode_escrever(diario_id)) with check (public.pode_escrever(diario_id))', t);
    execute format('create policy %1$s_apagar on public.%1$I for delete to authenticated using (public.pode_escrever(diario_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Entrada, criação do diário e exclusão total
-- ---------------------------------------------------------------------------------------------

-- Chamada logo depois do login. Aceita os convites feitos para o e-mail (confirmado) da conta,
-- atualiza nome e e-mail nos diários de que a pessoa já participa e devolve esses diários.
create function public.entrar()
returns table (diario_id uuid, papel text, nome_crianca text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_nome  text;
begin
  if v_uid is null then
    raise exception 'é preciso entrar com uma conta' using errcode = '42501';
  end if;
  select lower(u.email),
         left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 80)
    into v_email, v_nome
    from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is not null then
    insert into public.membros (diario_id, user_id, papel, nome, email)
    select c.diario_id, v_uid, c.papel, v_nome, v_email
      from public.convites c
     where c.email = v_email
    on conflict on constraint membros_pkey do nothing;
    delete from public.convites c where c.email = v_email;
    update public.membros m set nome = v_nome, email = v_email where m.user_id = v_uid;
  end if;

  return query
    select m.diario_id, m.papel, d.nome_crianca
      from public.membros m join public.diarios d on d.id = m.diario_id
     where m.user_id = v_uid
     order by (m.papel = 'dono') desc, m.entrou_em;
end $$;

-- Cria um diário novo com quem chamou como dono. Limite de 3 por pessoa, contra cadastro em massa.
create function public.criar_diario(p_nome_crianca text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'é preciso entrar com uma conta' using errcode = '42501';
  end if;
  if (select count(*) from public.membros m where m.user_id = v_uid and m.papel = 'dono') >= 3 then
    raise exception 'limite de diários atingido' using errcode = '42501';
  end if;
  insert into public.diarios (nome_crianca) values (left(coalesce(p_nome_crianca, ''), 80)) returning id into v_id;
  insert into public.membros (diario_id, user_id, papel, nome, email)
  select v_id, v_uid, 'dono',
         left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 80),
         coalesce(lower(u.email), '')
    from auth.users u where u.id = v_uid;
  return v_id;
end $$;

-- "Apagar todos os dados": só o dono. Remove registros e sensor, limpa nome e plano, e marca
-- apagado_em para que os outros aparelhos abertos recarreguem. As pessoas com acesso continuam.
create function public.apagar_tudo(p_diario uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if public.papel_no_diario(p_diario) is distinct from 'dono' then
    raise exception 'só quem criou o diário pode apagar tudo' using errcode = '42501';
  end if;
  delete from public.dias where diario_id = p_diario;
  delete from public.sensor_dias where diario_id = p_diario;
  update public.diarios set nome_crianca = '', plano = '' where id = p_diario;
  -- apagado_em não é editável pelo site; atualiza como dono da tabela.
  perform public.marcar_apagado(p_diario);
end $$;

create function public.marcar_apagado(p_diario uuid) returns void
language sql security definer set search_path = '' as $$
  update public.diarios set apagado_em = now()
   where id = p_diario and public.papel_no_diario(p_diario) = 'dono'
$$;

-- ---------------------------------------------------------------------------------------------
-- Tradução entre o objeto do dia (JSON do site) e as tabelas
-- ---------------------------------------------------------------------------------------------

-- Conversões tolerantes: um valor de tipo inesperado vira null em vez de derrubar a gravação.
create function public.j_num(j jsonb) returns numeric language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'number' then (j #>> '{}')::numeric end $$;
create function public.j_txt(j jsonb) returns text language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'string' then nullif(j #>> '{}', '') end $$;
create function public.j_hora(j jsonb) returns time language sql immutable set search_path = '' as $$
  select case when public.j_txt(j) ~ '^\d{2}:\d{2}$' then public.j_txt(j)::time end $$;
create function public.j_bool(j jsonb) returns boolean language sql immutable set search_path = '' as $$
  select case when j = 'true'::jsonb then true end $$;
create function public.j_lista(j jsonb) returns text[] language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'array' then
    nullif(array(select x from jsonb_array_elements_text(j) x where x <> ''), '{}'::text[]) end $$;
-- Milissegundos (Date.now() do navegador) <-> timestamptz, sem perder precisão.
create function public.j_ms(j jsonb) returns timestamptz language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'number' then 'epoch'::timestamptz + (j #>> '{}')::numeric * interval '1 millisecond' end $$;
create function public.ms(t timestamptz) returns bigint language sql immutable set search_path = '' as $$
  select round(extract(epoch from t) * 1000)::bigint $$;
create function public.hhmm(t time) returns text language sql immutable set search_path = '' as $$
  select to_char(t, 'HH24:MI') $$;

-- Hipoglicemias e medições extras já foram gravadas como lista; aqui viram mapa {id: registro}.
create function public.j_mapa(j jsonb) returns jsonb language sql immutable set search_path = '' as $$
  select case jsonb_typeof(j)
    when 'object' then j
    when 'array'  then coalesce((select jsonb_object_agg(e ->> 'id', e) from jsonb_array_elements(j) e
                                  where jsonb_typeof(e) = 'object' and e ->> 'id' is not null), '{}'::jsonb)
    else '{}'::jsonb end $$;

-- Grava um dia. p_dia tem o formato do site: {refeicoes: {cafe: {...} | null}, hipos: {id: {...} | null}, extras: {...}}.
-- Cada registro enviado substitui o registro inteiro; null apaga. Com p_substituir, os registros do dia
-- que não vieram em p_dia também são apagados (restauração de cópia, exclusão do dia).
-- Os campos criadoPor/atualizadoPor do JSON são ignorados: o trigger carimba o usuário logado.
create function public.gravar_dia(p_diario uuid, p_data date, p_dia jsonb, p_substituir boolean default false)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_ref jsonb := public.j_mapa(p_dia -> 'refeicoes');
  v_hip jsonb := public.j_mapa(p_dia -> 'hipos');
  v_ext jsonb := public.j_mapa(p_dia -> 'extras');
  k text;
  v jsonb;
begin
  if not public.pode_escrever(p_diario) then
    raise exception 'sem permissão para registrar neste diário' using errcode = '42501';
  end if;

  insert into public.dias (diario_id, data) values (p_diario, p_data)
  on conflict (diario_id, data) do update set atualizado_em = now();

  if p_substituir then
    delete from public.refeicoes r where r.diario_id = p_diario and r.data = p_data
       and coalesce(jsonb_typeof(v_ref -> r.refeicao), 'null') <> 'object';
    delete from public.hipos h where h.diario_id = p_diario and h.data = p_data
       and coalesce(jsonb_typeof(v_hip -> h.id), 'null') <> 'object';
    delete from public.extras x where x.diario_id = p_diario and x.data = p_data
       and coalesce(jsonb_typeof(v_ext -> x.id), 'null') <> 'object';
  end if;

  for k, v in select * from jsonb_each(v_ref) loop
    if jsonb_typeof(v) <> 'object' then
      delete from public.refeicoes r where r.diario_id = p_diario and r.data = p_data and r.refeicao = k;
      continue;
    end if;
    insert into public.refeicoes as r (diario_id, data, refeicao, antes, antes_hora, antes_em, refeicao_hora, insulina, carbo,
                                        local, depois, depois_hora, comeu, obs, tags, criado_em, atualizado_em)
    values (p_diario, p_data, k, public.j_num(v -> 'antes'), public.j_hora(v -> 'antesHora'), public.j_ms(v -> 'antesEm'),
            public.j_hora(v -> 'refeicaoHora'), public.j_num(v -> 'insulina'), public.j_num(v -> 'carbo'),
            public.j_txt(v -> 'local'), public.j_num(v -> 'depois'), public.j_hora(v -> 'depoisHora'),
            public.j_txt(v -> 'comeu'), public.j_txt(v -> 'obs'), public.j_lista(v -> 'tags'),
            coalesce(public.j_ms(v -> 'criadoEm'), now()), coalesce(public.j_ms(v -> 'atualizadoEm'), now()))
    on conflict (diario_id, data, refeicao) do update set
      antes = excluded.antes, antes_hora = excluded.antes_hora, antes_em = excluded.antes_em,
      refeicao_hora = excluded.refeicao_hora, insulina = excluded.insulina, carbo = excluded.carbo,
      local = excluded.local, depois = excluded.depois, depois_hora = excluded.depois_hora,
      comeu = excluded.comeu, obs = excluded.obs, tags = excluded.tags, atualizado_em = excluded.atualizado_em;
  end loop;

  for k, v in select * from jsonb_each(v_hip) loop
    if jsonb_typeof(v) <> 'object' then
      delete from public.hipos h where h.diario_id = p_diario and h.data = p_data and h.id = k;
      continue;
    end if;
    insert into public.hipos (diario_id, data, id, hora, valor, lo, situacao, sintomas, tratamento, nova, nova_hora, obs,
                              criado_em, atualizado_em)
    values (p_diario, p_data, k, public.j_hora(v -> 'hora'), public.j_num(v -> 'valor'), public.j_bool(v -> 'lo'),
            public.j_txt(v -> 'situacao'), public.j_lista(v -> 'sintomas'), public.j_txt(v -> 'tratamento'),
            public.j_num(v -> 'nova'), public.j_hora(v -> 'novaHora'), public.j_txt(v -> 'obs'),
            coalesce(public.j_ms(v -> 'criadoEm'), now()), coalesce(public.j_ms(v -> 'atualizadoEm'), now()))
    on conflict (diario_id, data, id) do update set
      hora = excluded.hora, valor = excluded.valor, lo = excluded.lo, situacao = excluded.situacao,
      sintomas = excluded.sintomas, tratamento = excluded.tratamento, nova = excluded.nova,
      nova_hora = excluded.nova_hora, obs = excluded.obs, atualizado_em = excluded.atualizado_em;
  end loop;

  for k, v in select * from jsonb_each(v_ext) loop
    if jsonb_typeof(v) <> 'object' then
      delete from public.extras x where x.diario_id = p_diario and x.data = p_data and x.id = k;
      continue;
    end if;
    insert into public.extras (diario_id, data, id, hora, valor, lo, hi, momento, obs, criado_em, atualizado_em)
    values (p_diario, p_data, k, public.j_hora(v -> 'hora'), public.j_num(v -> 'valor'), public.j_bool(v -> 'lo'),
            public.j_bool(v -> 'hi'), public.j_txt(v -> 'momento'), public.j_txt(v -> 'obs'),
            coalesce(public.j_ms(v -> 'criadoEm'), now()), coalesce(public.j_ms(v -> 'atualizadoEm'), now()))
    on conflict (diario_id, data, id) do update set
      hora = excluded.hora, valor = excluded.valor, lo = excluded.lo, hi = excluded.hi,
      momento = excluded.momento, obs = excluded.obs, atualizado_em = excluded.atualizado_em;
  end loop;
end $$;

-- Lê os dias no formato do site. Com p_data, só aquele dia. Dias sem nenhum registro não voltam.
create function public.ler_dias(p_diario uuid, p_data date default null)
returns table (data date, dia jsonb)
language sql stable security invoker set search_path = '' as $$
  with
  r as (
    select r.data, max(r.atualizado_em) em,
           jsonb_object_agg(r.refeicao, jsonb_strip_nulls(jsonb_build_object(
             'antes', r.antes, 'antesHora', public.hhmm(r.antes_hora), 'antesEm', public.ms(r.antes_em),
             'refeicaoHora', public.hhmm(r.refeicao_hora), 'insulina', r.insulina, 'carbo', r.carbo,
             'local', r.local, 'depois', r.depois, 'depoisHora', public.hhmm(r.depois_hora),
             'comeu', r.comeu, 'obs', r.obs, 'tags', to_jsonb(r.tags),
             'criadoPor', r.criado_por, 'atualizadoPor', r.atualizado_por,
             'criadoEm', public.ms(r.criado_em), 'atualizadoEm', public.ms(r.atualizado_em)))) obj
      from public.refeicoes r
     where r.diario_id = p_diario and (p_data is null or r.data = p_data)
     group by r.data),
  h as (
    select h.data, max(h.atualizado_em) em,
           jsonb_object_agg(h.id, jsonb_strip_nulls(jsonb_build_object(
             'id', h.id, 'hora', public.hhmm(h.hora), 'valor', h.valor, 'lo', h.lo, 'situacao', h.situacao,
             'sintomas', to_jsonb(h.sintomas), 'tratamento', h.tratamento, 'nova', h.nova,
             'novaHora', public.hhmm(h.nova_hora), 'obs', h.obs,
             'criadoPor', h.criado_por, 'atualizadoPor', h.atualizado_por,
             'criadoEm', public.ms(h.criado_em), 'atualizadoEm', public.ms(h.atualizado_em)))) obj
      from public.hipos h
     where h.diario_id = p_diario and (p_data is null or h.data = p_data)
     group by h.data),
  x as (
    select x.data, max(x.atualizado_em) em,
           jsonb_object_agg(x.id, jsonb_strip_nulls(jsonb_build_object(
             'id', x.id, 'hora', public.hhmm(x.hora), 'valor', x.valor, 'lo', x.lo, 'hi', x.hi,
             'momento', x.momento, 'obs', x.obs,
             'criadoPor', x.criado_por, 'atualizadoPor', x.atualizado_por,
             'criadoEm', public.ms(x.criado_em), 'atualizadoEm', public.ms(x.atualizado_em)))) obj
      from public.extras x
     where x.diario_id = p_diario and (p_data is null or x.data = p_data)
     group by x.data),
  d as (select r.data from r union select h.data from h union select x.data from x)
  select d.data,
         jsonb_build_object(
           'data', to_char(d.data, 'YYYY-MM-DD'),
           'atualizadoEm', public.ms(greatest(r.em, h.em, x.em)),
           'refeicoes', coalesce(r.obj, '{}'::jsonb),
           'hipos', coalesce(h.obj, '{}'::jsonb),
           'extras', coalesce(x.obj, '{}'::jsonb))
    from d left join r on r.data = d.data left join h on h.data = d.data left join x on x.data = d.data
   order by d.data
$$;

-- Grava (substitui) as leituras do sensor de um dia: {min: [...], mg: [...], tipo: [...], fonte}.
create function public.gravar_sensor(p_diario uuid, p_data date, p_doc jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.pode_escrever(p_diario) then
    raise exception 'sem permissão para registrar neste diário' using errcode = '42501';
  end if;
  if jsonb_typeof(p_doc -> 'min') is distinct from 'array' or jsonb_typeof(p_doc -> 'mg') is distinct from 'array'
     or jsonb_array_length(p_doc -> 'min') <> jsonb_array_length(p_doc -> 'mg') then
    raise exception 'leituras do sensor em formato inválido' using errcode = '22023';
  end if;
  insert into public.sensor_dias (diario_id, data, fonte, importado_por, atualizado_em)
  values (p_diario, p_data, coalesce(public.j_txt(p_doc -> 'fonte'), 'LibreView'), auth.uid(), now())
  on conflict (diario_id, data) do update
    set fonte = excluded.fonte, importado_por = excluded.importado_por, atualizado_em = excluded.atualizado_em;
  delete from public.sensor_leituras l where l.diario_id = p_diario and l.data = p_data;
  insert into public.sensor_leituras (diario_id, data, minuto, tipo, mg)
  select p_diario, p_data, (m.v #>> '{}')::smallint, coalesce((p_doc -> 'tipo' ->> (m.i - 1)::int)::smallint, 0),
         (p_doc -> 'mg' ->> (m.i - 1)::int)::numeric
    from jsonb_array_elements(p_doc -> 'min') with ordinality m(v, i)
  on conflict do nothing;
end $$;

create function public.ler_sensor(p_diario uuid)
returns table (data date, doc jsonb)
language sql stable security invoker set search_path = '' as $$
  select s.data,
         jsonb_build_object(
           'data', to_char(s.data, 'YYYY-MM-DD'), 'fonte', s.fonte,
           'atualizadoEm', public.ms(s.atualizado_em), 'importadoPor', s.importado_por,
           'min',  coalesce((select jsonb_agg(l.minuto order by l.minuto, l.tipo) from public.sensor_leituras l where l.diario_id = s.diario_id and l.data = s.data), '[]'::jsonb),
           'mg',   coalesce((select jsonb_agg(l.mg     order by l.minuto, l.tipo) from public.sensor_leituras l where l.diario_id = s.diario_id and l.data = s.data), '[]'::jsonb),
           'tipo', coalesce((select jsonb_agg(l.tipo   order by l.minuto, l.tipo) from public.sensor_leituras l where l.diario_id = s.diario_id and l.data = s.data), '[]'::jsonb))
    from public.sensor_dias s
   where s.diario_id = p_diario
   order by s.data
$$;

-- ---------------------------------------------------------------------------------------------
-- Permissões de execução e tempo real
-- ---------------------------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.papel_no_diario(uuid), public.pode_escrever(uuid), public.entrar(), public.criar_diario(text),
  public.apagar_tudo(uuid), public.gravar_dia(uuid, date, jsonb, boolean), public.ler_dias(uuid, date),
  public.gravar_sensor(uuid, date, jsonb), public.ler_sensor(uuid),
  public.j_num(jsonb), public.j_txt(jsonb), public.j_hora(jsonb), public.j_bool(jsonb), public.j_lista(jsonb),
  public.j_ms(jsonb), public.ms(timestamptz), public.hhmm(time), public.j_mapa(jsonb)
  to authenticated;
-- marcar_apagado só é chamada de dentro de apagar_tudo.
grant execute on function public.marcar_apagado(uuid) to authenticated;

-- Os aparelhos abertos acompanham estas tabelas; o tempo real também respeita as políticas acima.
alter publication supabase_realtime add table public.dias, public.sensor_dias, public.diarios;
