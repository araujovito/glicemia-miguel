# Diário de Glicemia

Antes do uso pela família, siga o [plano de validação](VALIDACAO.md) com dados fictícios em todos os aparelhos que serão usados.

Um controle de glicemia para preencher pelo celular. Foi pensado para acompanhar **uma criança** com diabetes no dia a dia e levar o histórico organizado para as consultas.

O projeto tem duas partes, que funcionam de forma independente:

- **Site:** uma página única para registrar as refeições, as medições e as hipoglicemias, com um resumo pronto para a consulta.
- **Planilha em Excel:** o mesmo controle, para quem prefere trabalhar no Excel. Ela é gerada por um script a partir da folha A4 que a família já preenchia à mão.

> **Aviso:** este projeto serve para **registrar e acompanhar**. Ele não sugere metas, doses de insulina nem tratamentos. Metas de glicemia, doses e decisões de tratamento seguem sempre as orientações da equipe médica responsável.

## Estrutura

```
site/index.html                                 Site (HTML, CSS e JS num único arquivo, sem build)
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
- Cada refeição aceita até 3 **fotos do prato**.
- O **registro de hipoglicemia** guarda horário, valor (ou "LO"), situação, sintomas, o que foi feito e a nova medição. Ele mostra o plano que a família anotou da equipe médica.
- As **medições extras** (ao acordar, ao deitar, de madrugada…) não entram nas médias das refeições.

**Vários cuidadores no mesmo diário**
- Mãe, pai, avó e escola registram no mesmo lugar, cada um no próprio celular, e veem as anotações dos outros na hora.
- Cada registro mostra quem anotou e quem alterou por último ("Anotado por Ana · alterado por João às 14:32").
- Quem não tem permissão para editar vê um aviso logo ao abrir, e o botão Salvar fica desabilitado.
- O topo mostra quando uma alteração está sendo salva e quando foi concluída. Se duas pessoas alterarem o mesmo registro ao mesmo tempo, o site pede que o cuidador escolha entre carregar a versão mais recente ou substituir conscientemente.

**Das outras vezes:** enquanto você escreve o que a criança comeu, aparecem as refeições anteriores com os mesmos alimentos, com a glicemia antes → 2 h, a variação, a insulina e as fotos.

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
- Baixa um arquivo `.json` com todos os registros, as leituras do sensor, o nome, o plano da equipe médica e, se quiser, as fotos.
- Restaura a partir desse arquivo sem apagar nada mais novo:
  - dias que faltam são adicionados;
  - num dia que existe nos dois lados, fica a versão alterada por último;
  - as leituras do sensor são juntadas, como na importação;
  - antes de gravar, o site mostra o que vai acontecer.
- Nas opções de privacidade é possível apagar todos os registros, leituras, fotos e configurações, com confirmação digitada.

**Instalação no celular:** quando servido por HTTPS ou em `localhost`, o diário pode ser instalado como aplicativo. O aplicativo guarda somente os arquivos necessários para abrir a interface; os registros continuam no armazenamento configurado ou no navegador.

### Onde os dados ficam

O site foi feito para rodar como **Artifact do Claude** (claude.ai). Ele usa as capacidades da plataforma por meio de `window.claude.use(...)`:

| Capacidade | Uso |
|---|---|
| `db` | Um registro por dia (`dias/AAAA-MM-DD`), o nome da criança (`config/crianca`) e o plano da equipe médica (`config/plano`) |
| `assets` | Fotos dos pratos |
| `downloads` | Baixar o PDF, o CSV e a cópia de segurança |
| `user` (escopo `profile`) | Saber quem está registrando, mostrar o nome de quem anotou e saber se a pessoa pode editar |

Se essas capacidades não estiverem disponíveis, o site entra em **modo local** e mostra um aviso no topo. Isso acontece, por exemplo, ao abrir o `index.html` direto no navegador. No modo local os dados ficam só naquele navegador (`localStorage`), sem uma senha própria. Não dá para enviar fotos, mas PDF, CSV e cópia de segurança podem ser baixados pelo próprio navegador.

### Como usar

- **Testar no computador:** abra `site/index.html` no navegador. Ele roda em modo local.
- **Usar de verdade:** publique o `index.html` como Artifact no claude.ai com as capacidades `db`, `assets`, `downloads` e `user`. Depois é só abrir o link no celular.
- **Compartilhar com a família:** compartilhe o Artifact pelo claude.ai.
  - Quem vai registrar precisa de permissão para **editar**.
  - Cada pessoa entra com a própria conta. É assim que o site sabe quem anotou cada coisa.
  - O banco é publicado com a regra `read: "interact", write: "interact"`. Por ela, só quem pode participar (Contributor ou acima) lê os registros. Quem recebe o link só para ver abre um diário vazio. Isso é proposital, porque são dados de saúde de uma criança.
  - Para a equipe médica, mande o **relatório em PDF** em vez do link.

### Formato de um dia

```
dias/2026-09-27
  refeicoes: { cafe: {antes, insulina, local, carbo, depois, comeu, obs, tags, fotos, criadoPor, atualizadoPor, criadoEm, atualizadoEm}, lanche: null, ... }
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

Para executar os testes da lógica compartilhada do site:

```bash
npm test
```

O script lê `planilha/modelo_folha_A4.xlsx` e grava o resultado na mesma pasta.

## Decisões de projeto

- **Não sugere nada de tratamento.** O site registra e resume, mas não calcula dose, não define meta e não classifica um valor como "bom" ou "ruim". O plano para hipoglicemia é texto livre, escrito pela família conforme a orientação da equipe médica.
- **Fotos sem localização.** A foto é recomprimida no próprio aparelho antes de ser salva. Isso diminui o arquivo e remove os metadados, inclusive a localização GPS.
- **Um arquivo só, sem build.** O site é um único HTML que funciona aberto direto ou publicado como Artifact. A única biblioteca externa é o jsPDF, que só é carregado do cdnjs na hora de gerar o PDF.
- **O CSV segue as colunas da planilha Excel.** As 7 primeiras colunas preservam o formato antigo; depois vêm os três horários, carboidratos, local da aplicação e etiquetas, na mesma ordem da planilha.
- **Cada gravação envia só o que mudou.** O site usa `update`, que mescla, em vez de regravar o dia inteiro. Assim, duas pessoas registrando refeições diferentes no mesmo dia não apagam o registro uma da outra. O banco não tem transações, então duas pessoas editando *a mesma* refeição ao mesmo tempo continuam no "último a salvar vence".
- **"Das outras vezes" só mostra, não julga.** A busca compara palavras: ignora acentos e palavras como "com" e "copo", e trata plurais simples. As refeições vêm ordenadas pela semelhança. Não há cor de "bom" ou "ruim", pela mesma regra de não definir metas.
- **Perfis sem metas.** O perfil por refeição e o AGP mostram mediana, faixas de percentis, coeficiente de variação e desvio padrão, sem faixa-alvo, tempo no alvo (TIR) ou GMI. Os dois primeiros dependem de metas que só a equipe médica define. O GMI estimaria a hemoglobina glicada, que o projeto decidiu não estimar. As faixas de 25–75% só aparecem com 4 medições ou mais (5 por hora no AGP), e buracos nos dados interrompem as linhas em vez de inventar valores.
- **Carboidratos e locais são só registro.** O site não relaciona carboidrato com insulina (razão insulina:carboidrato, dose) e não indica o próximo local de aplicação.
- **Sensor pelo arquivo, não por integração.** O LibreView não tem uma API aberta para famílias, e o CSV é a exportação oficial. O leitor localiza as colunas pela posição em relação a "tipo de registro", e não pelo nome de cada uma, para não depender da tradução.
- **A cópia de segurança fica com a família.** Os registros moram num único Artifact, ligado a uma conta. A cópia existe para que o histórico não dependa dessa conta.

## Privacidade

- Este repositório é **privado** e contém só o código e os modelos vazios. **Nenhum dado de saúde fica aqui.** Os registros ficam no armazenamento do Artifact ou no navegador.
- Não coloque aqui exportações (CSV ou PDF), fotos, capturas de tela com registros nem planilhas preenchidas. O `.gitignore` bloqueia esses formatos. As únicas planilhas aceitas são os dois modelos vazios da pasta `planilha/`.
- Para usar a planilha, faça uma cópia **fora** da pasta do projeto e preencha a cópia. Assim o modelo versionado continua vazio.
- O arquivo da cópia de segurança (`copia-glicemia-*.json`) tem os dados de saúde da criança. Guarde num lugar privado. O `.gitignore` bloqueia esse nome de arquivo, mas o mais seguro é nunca salvar a cópia dentro da pasta do repositório.
