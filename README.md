# Diário de Glicemia

Antes do uso pela família, siga o [plano de validação](VALIDACAO.md) com dados fictícios em todos os aparelhos que serão usados.

Um controle de glicemia para preencher pelo celular. Foi pensado para acompanhar **uma criança** com diabetes no dia a dia e levar o histórico organizado para as consultas.

O projeto tem duas partes, que funcionam de forma independente:

- **Site:** uma página única para registrar as refeições, as medições e as hipoglicemias, com um resumo pronto para a consulta.
- **Planilha em Excel:** o mesmo controle, para quem prefere trabalhar no Excel. Ela é gerada por um script a partir da folha A4 que a família já preenchia à mão.

> **Aviso:** este projeto serve para **registrar e acompanhar**. Ele não sugere metas, doses de insulina nem tratamentos. Metas de glicemia, doses e decisões de tratamento seguem sempre as orientações da equipe médica responsável.

## Estrutura

```
site/index.html                                 Site (HTML, CSS e a interface, sem build)
site/logic.js                                   Funções puras (cálculos, junções, validação), testáveis sem navegador
site/sw.js, manifest.webmanifest, icon.svg      Instalação como aplicativo e abertura sem internet
site/supabase.js, config.js, vendor/            Ligação com o banco (Supabase), login Google e convites
supabase/migrations/                            Tabelas, regras de acesso (RLS) e funções do banco Postgres
supabase/tests/                                 Testes das regras de acesso (pgTAP)
tests/                                          Testes: lógica, navegador (modo local), modo compartilhado e Supabase
VALIDACAO.md                                    Roteiro manual antes de liberar para a família
planilha/gerar_planilha.py                      Script que monta a planilha a partir da folha A4
planilha/modelo_folha_A4.xlsx                   Folha diária original, para imprimir e preencher à mão
planilha/Controle de Glicemia - Registros.xlsx  Planilha gerada pelo script (vazia)
```

## Site

### O que dá para fazer

**Registrar o dia**
- São 6 refeições: café da manhã, lanche, almoço, café da tarde, janta e ceia.
- Para cada refeição dá para anotar a glicemia antes (mg/dL), a insulina aplicada (unidades), o local da aplicação, o que comeu e bebeu, os carboidratos em gramas (opcional), a glicemia 2 h depois e observações.
- **Pratos frequentes:** o que já foi escrito 2 vezes ou mais naquela refeição aparece como botão, e um toque preenche o prato e os carboidratos.
- **Local da aplicação:** 8 locais (barriga, braço, coxa e nádega, dos dois lados). Cada um mostra quando foi usado pela última vez, para ajudar no rodízio. O site não indica o próximo local.
- Depois de anotar a glicemia antes, aparece o lembrete "2h às HH:MM".
- Os horários da medição antes, da refeição/aplicação e da medição 2 h depois podem ser registrados separadamente.
- Há **etiquetas** de um toque: atividade física, festa/doce, comeu fora, na escola, doente, não comeu tudo, comeu mais que o normal, dormiu mal, nervoso.
- O **registro de hipoglicemia** guarda horário, valor (ou "LO"), situação, sintomas, o que foi feito e a nova medição. Ele mostra o plano que a família anotou da equipe médica.
- As **medições extras** (ao acordar, ao deitar, de madrugada…) não entram nas médias das refeições.

**Vários cuidadores no mesmo diário**
- Mãe, pai, avó e escola registram no mesmo lugar, cada um no próprio celular, e veem as anotações dos outros na hora.
- Cada registro mostra quem anotou e quem alterou por último ("Anotado por Ana · alterado por João às 14:32").
- Quem não tem permissão para editar vê um aviso logo ao abrir, e o botão Salvar fica desabilitado.
- O topo mostra quando uma alteração está sendo salva e quando foi concluída. Se duas pessoas alterarem o mesmo registro ao mesmo tempo, o site pede que o cuidador escolha entre carregar a versão mais recente ou substituir conscientemente.

**Das outras vezes:** enquanto você escreve o que a criança comeu, aparecem as refeições anteriores com os mesmos alimentos, com a glicemia antes → 2 h, a variação e a insulina.

**Histórico:** um cartão por dia, com filtro por etiqueta.

**Sensor de glicose (FreeStyle Libre)**
- Importa o CSV exportado do LibreView (Histórico de glicose → Baixar dados de glicose). O site entende datas dia/mês ou mês/dia, relógio de 24 ou 12 horas, mg/dL ou mmol/L, e vírgula ou ponto e vírgula como separador. Antes de gravar, mostra uma prévia.
- Importar de novo junta as leituras sem duplicar e sem apagar nada.
- A tela de cada dia ganha a curva do sensor, com os escaneamentos e as hipoglicemias registradas marcados.

**Resumo para a consulta**
- Médias, mínimas e máximas por refeição, a variação média (2 h − antes), a insulina média e os carboidratos médios.
- Gráfico de barras por refeição. Tocar numa barra mostra o valor e em quantas medições ele se apoia.
- **Perfil por refeição:** como os valores se espalham em cada refeição (menor e maior valor, metade central e mediana), com o coeficiente de variação e o desvio padrão. É a adaptação do AGP para medições de ponta de dedo.
- **Perfil do sensor (AGP):** com as leituras do sensor, todos os dias do período sobrepostos hora a hora, com mediana e faixas de 25–75% e 5–95%, como no relatório AGP que a endocrinologia usa.
- **Locais de aplicação:** quantas vezes cada local foi usado no período e quando foi a última.
- As médias das refeições que tiveram cada etiqueta, além das tabelas de hipoglicemias e de medições extras.
- Exporta o **relatório em PDF** (jsPDF, com os perfis e o AGP), a **planilha em CSV** e um resumo em texto para copiar. O PDF também pode ser gerado só com as leituras do sensor.

**Cópia de segurança**
- Baixa um arquivo `.json` com todos os registros, as leituras do sensor, o nome e o plano da equipe médica. Cópias feitas quando o site ainda guardava fotos continuam aceitas; as fotos delas são ignoradas.
- Restaura a partir desse arquivo sem apagar nada mais novo:
  - dias que faltam são adicionados;
  - num dia que existe nos dois lados, fica a versão alterada por último;
  - as leituras do sensor são juntadas, como na importação;
  - antes de gravar, o site mostra o que vai acontecer.
- Nas opções de privacidade é possível apagar todos os registros, leituras e configurações, com confirmação digitada.

**Instalação no celular:** quando servido por HTTPS ou em `localhost`, o diário pode ser instalado como aplicativo. O aplicativo guarda somente os arquivos necessários para abrir a interface; os registros continuam no armazenamento configurado ou no navegador.

### Onde os dados ficam

Os registros ficam num banco **Postgres no Supabase**, com login Google e convites por e-mail. O projeto do Supabase deve ser criado numa conta pessoal, na região de São Paulo (passo a passo abaixo).

Se `site/config.js` estiver vazio, o site entra em **modo local** e mostra um aviso no topo. Isso acontece, por exemplo, ao abrir o `index.html` direto no navegador. No modo local os dados ficam só naquele navegador (`localStorage`), sem uma senha própria. Serve para testar. PDF, CSV e cópia de segurança são baixados pelo próprio navegador.

A primeira versão rodava como Artifact do Claude. O diário saiu de lá para que os dados de saúde da criança fiquem num projeto da própria família, com login e regras de acesso próprias, sem depender de uma conta de terceiros.

### Como usar

- **Testar no computador:** abra `site/index.html` no navegador. Ele roda em modo local. Para testar com banco, use o Supabase local (abaixo).
- **Usar de verdade:** siga o passo a passo abaixo uma vez e mande o endereço do site para a família. Cada pessoa entra com a própria conta Google, e é assim que o site sabe quem anotou cada coisa.
- **Equipe médica:** pode entrar como leitor, ou receber o **relatório em PDF**.

### Configurar o banco (Supabase)

O site conversa direto com o banco, sem um servidor próprio. Quem protege os dados são as regras de Row Level Security em `supabase/migrations/`. A chave pública do site só consegue fazer o que essas regras permitem:

- **Sem login, nada abre.** Cada pessoa entra com a conta Google.
- **Só entra quem foi convidado.** O dono convida pelo e-mail da conta Google, em Resumo → Pessoas com acesso. O convite só vale para e-mail confirmado.
- **Três papéis por diário:** dono (convida, remove, apaga tudo), cuidador (registra) e leitor (só vê, por exemplo a equipe médica).
- **A autoria é carimbada pelo banco** com a conta logada. Ninguém consegue registrar em nome de outra pessoa.

Passo a passo, uma vez só:

1. **Crie o projeto** em [supabase.com](https://supabase.com), na região **South America (São Paulo)**, porque são dados de saúde de uma criança. O plano gratuito basta. Anote a senha do banco num gerenciador de senhas.
2. **Crie o banco:** instale a CLI (`npx supabase`), rode `npx supabase login`, depois `npx supabase link --project-ref <id-do-projeto>` e `npx supabase db push`. Isso aplica `supabase/migrations/`.
3. **Login Google:**
   - No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um "ID do cliente OAuth" do tipo *Aplicativo da Web*. Em "URIs de redirecionamento autorizados", coloque `https://<id-do-projeto>.supabase.co/auth/v1/callback`.
   - No Supabase, em Authentication → Sign In / Providers → Google, ative e cole o Client ID e o Client Secret.
   - Em Authentication → URL Configuration, coloque o endereço do site em *Site URL* e em *Redirect URLs*.
4. **Aponte o site para o projeto:** em `site/config.js`, preencha `supabaseUrl` e `supabaseAnonKey` com a URL e a chave pública do projeto (Project Settings → API; a "anon" ou a "publishable"). **Nunca** use a chave `service_role` ou `secret`.
5. **Publique a pasta `site/`** num serviço de site estático com HTTPS, por exemplo Cloudflare Pages ou Netlify. Os dois publicam a partir de repositório privado. O GitHub Pages só faz isso no plano pago.
6. **Primeiro acesso:** entre com a sua conta, toque em "Criar um diário" e convide os outros cuidadores. Para trazer registros de uma cópia de segurança (por exemplo, da versão antiga no Claude), use "Restaurar de uma cópia" no Resumo. A autoria dos registros restaurados fica com quem restaurou, porque as contas antigas não existem no Supabase.

Para desenvolver com um Supabase local (precisa de Docker):

```bash
npx supabase start          # sobe Postgres, autenticação, API e tempo real e aplica as migrações
npx supabase test db        # regras de acesso (supabase/tests, pgTAP)
npm run test:supabase       # o site contra o banco local, com várias pessoas ao mesmo tempo
```

### Formato de um dia

```
dias/2026-09-27
  refeicoes: { cafe: {antes, insulina, local, carbo, depois, comeu, obs, tags, criadoPor, atualizadoPor, criadoEm, atualizadoEm}, lanche: null, ... }
  hipos:     { <id>: {hora, valor | lo, situacao, sintomas, tratamento, nova, novaHora, obs, criadoPor, ...} }
  extras:    { <id>: {hora, valor | lo | hi, momento, obs, criadoPor, ...} }
  data, atualizadoEm
```

- `criadoPor` e `atualizadoPor` guardam o id opaco da plataforma, nunca o nome. O nome é buscado na hora de mostrar.
- Um registro apagado vira `null`.
- `local` é uma chave fixa (`barriga-e`, `coxa-d`...), e não o texto mostrado. `carbo` fica em gramas.

As leituras do sensor ficam em outra coleção, um documento por dia:

```
sensor/2026-09-27
  min:  [0, 15, 30, ...]     minuto do dia
  mg:   [118, 121, 125, ...] mg/dL (mmol/L é convertido na importação)
  tipo: [0, 0, 1, ...]       0 = leitura automática, 1 = escaneamento
  data, fonte: "LibreView", atualizadoEm, importadoPor
```

São três listas paralelas, e não uma lista de pares, porque o banco não guarda listas dentro de listas.
- Dias gravados antes da versão com vários cuidadores guardam `hipos` e `extras` como listas. O site lê os dois formatos e converte o dia na primeira alteração.

## Planilha (Excel)

A planilha tem 5 abas:

- *Preencher pelo celular*: 90 dias × 6 refeições.
- *Histórico por dia*
- *Resumo*: com gráficos.
- *Como usar*
- *Folha diária A4*

A aba de preenchimento também possui horários, carboidratos, local da aplicação e etiquetas. As sete primeiras colunas continuam compatíveis com o CSV exportado pelo site, e as colunas seguintes aparecem na mesma ordem nos dois arquivos.

As datas de todas as abas saem da **data do primeiro dia**, que fica na aba *Como usar* e pode ser trocada.

Para gerar a planilha de novo:

```bash
pip install openpyxl
python planilha/gerar_planilha.py
```

Para executar os testes (precisa do Playwright: `npm install`):

```bash
npm test                    # tudo
npm run test:unit           # só a lógica (logic.js), sem navegador
npm run test:browser        # navegador no modo local e na demonstração
npm run test:compartilhado  # navegador no modo compartilhado, com banco simulado e duas pessoas
npm run test:supabase       # site contra um Supabase local (pulado se ele não estiver rodando)
npm run test:banco          # regras de acesso do banco, pgTAP (precisa do Supabase local)
```

Os testes do modo compartilhado simulam o banco com a interface do `supabase.js` (update mescla os registros enviados) e seguram a entrega das gravações, para reproduzir dois aparelhos salvando ao mesmo tempo.

Os testes do Supabase usam um banco de verdade: cada pessoa (dona, cuidadora, leitor, alguém sem convite) abre o site num navegador separado. Como o Google não existe no ambiente local, as contas de teste entram com senha, e a sessão é colocada no navegador antes de o site abrir.

O script lê `planilha/modelo_folha_A4.xlsx` e grava o resultado na mesma pasta.

## Decisões de projeto

- **Não sugere nada de tratamento.** O site registra e resume, mas não calcula dose, não define meta e não classifica um valor como "bom" ou "ruim". O plano para hipoglicemia é texto livre, escrito pela família conforme a orientação da equipe médica.
- **O site fala direto com o banco, e a segurança está no Postgres.** Um servidor próprio seria mais uma coisa para manter e atualizar. Com Row Level Security, cada regra (quem lê, quem grava, quem apaga tudo) fica no banco e é testada em `supabase/tests`. MongoDB e SQLite foram descartados por isso: nenhum dos dois oferece acesso seguro direto do navegador sem uma API no meio.
- **Tabelas separadas, mas o site continua vendo "um dia".** Refeições, hipoglicemias, medições extras e leituras do sensor têm tabelas próprias, com limites de valor. As funções `gravar_dia` e `ler_dias` traduzem as tabelas para um objeto por dia. Esse formato veio da primeira versão, no Claude, e foi mantido: com ele, a troca de banco mexeu só em `site/supabase.js` e no início do `index.html`.
- **Sem fotos dos pratos.** Houve uma versão com até 3 fotos por refeição, mas ela foi retirada: exigia compressão, envio, limpeza das imagens órfãs e cópia em base64, e seria a parte mais trabalhosa de levar o diário para outro banco (um armazenamento de arquivos com regras próprias). O texto de "O que comeu" e as etiquetas já cumprem o papel. Refeições e cópias antigas com o campo `fotos` continuam válidas e o campo é ignorado.
- **Um arquivo só, sem build.** O site é um HTML com dois scripts próprios (`logic.js` e `supabase.js`) e funciona aberto direto ou publicado em qualquer hospedagem estática. A biblioteca do Supabase vai junto em `site/vendor/`. A única externa é o jsPDF, que só é carregado do cdnjs na hora de gerar o PDF.
- **O CSV segue as colunas da planilha Excel.** As 7 primeiras colunas preservam o formato antigo; depois vêm os três horários, carboidratos, local da aplicação e etiquetas, na mesma ordem da planilha.
- **Cada gravação envia só o que mudou.** Cada refeição, hipoglicemia ou medição é uma linha própria, e salvar grava só aquela linha. Assim, duas pessoas registrando refeições diferentes no mesmo dia não apagam o registro uma da outra. Se duas pessoas editam *a mesma* refeição ao mesmo tempo, o site avisa do conflito; quem salvar por último, depois do aviso, vence.
- **"Das outras vezes" só mostra, não julga.** A busca compara palavras: ignora acentos e palavras como "com" e "copo", e trata plurais simples. As refeições vêm ordenadas pela semelhança. Não há cor de "bom" ou "ruim", pela mesma regra de não definir metas.
- **Perfis sem metas.** O perfil por refeição e o AGP mostram mediana, faixas de percentis, coeficiente de variação e desvio padrão, sem faixa-alvo, tempo no alvo (TIR) ou GMI. Os dois primeiros dependem de metas que só a equipe médica define. O GMI estimaria a hemoglobina glicada, que o projeto decidiu não estimar. As faixas de 25–75% só aparecem com 4 medições ou mais (5 por hora no AGP), e buracos nos dados interrompem as linhas em vez de inventar valores.
- **Carboidratos e locais são só registro.** O site não relaciona carboidrato com insulina (razão insulina:carboidrato, dose) e não indica o próximo local de aplicação.
- **Sensor pelo arquivo, não por integração.** O LibreView não tem uma API aberta para famílias, e o CSV é a exportação oficial. O leitor localiza as colunas pela posição em relação a "tipo de registro", e não pelo nome de cada uma, para não depender da tradução.
- **A cópia de segurança fica com a família.** Os registros moram num único projeto do Supabase, ligado a uma conta. A cópia existe para que o histórico não dependa dessa conta.

## Privacidade

- Este repositório é **privado** e contém só o código e os modelos vazios. **Nenhum dado de saúde fica aqui.** Os registros ficam no banco do Supabase ou no navegador (modo local).
- Não coloque aqui exportações (CSV ou PDF), fotos, capturas de tela com registros nem planilhas preenchidas. O `.gitignore` bloqueia esses formatos. As únicas planilhas aceitas são os dois modelos vazios da pasta `planilha/`.
- Para usar a planilha, faça uma cópia **fora** da pasta do projeto e preencha a cópia. Assim o modelo versionado continua vazio.
- O arquivo da cópia de segurança (`copia-glicemia-*.json`) tem os dados de saúde da criança. Guarde num lugar privado. O `.gitignore` bloqueia esse nome de arquivo, mas o mais seguro é nunca salvar a cópia dentro da pasta do repositório.
