# Diário de Glicemia

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
- Para cada refeição dá para anotar a glicemia antes (mg/dL), a insulina aplicada (unidades), o que comeu e bebeu, a glicemia 2 h depois e observações.
- Depois de anotar a glicemia antes, aparece o lembrete "2h às HH:MM".
- Há **etiquetas** de um toque: atividade física, festa/doce, comeu fora, na escola, doente, não comeu tudo, comeu mais que o normal, dormiu mal, nervoso.
- Cada refeição aceita até 3 **fotos do prato**.
- O **registro de hipoglicemia** guarda horário, valor (ou "LO"), situação, sintomas, o que foi feito e a nova medição. Ele mostra o plano que a família anotou da equipe médica.
- As **medições extras** (ao acordar, ao deitar, de madrugada…) não entram nas médias das refeições.

**Histórico:** um cartão por dia, com filtro por etiqueta.

**Resumo para a consulta**
- Médias, mínimas e máximas por refeição, a variação média (2 h − antes) e a insulina média.
- Gráfico de barras por refeição.
- As médias das refeições que tiveram cada etiqueta, além das tabelas de hipoglicemias e de medições extras.
- Exporta o **relatório em PDF** (jsPDF), a **planilha em CSV** (com as mesmas colunas da planilha Excel) e um resumo em texto para copiar.

### Onde os dados ficam

O site foi feito para rodar como **Artifact do Claude** (claude.ai). Ele usa as capacidades da plataforma por meio de `window.claude.use(...)`:

| Capacidade | Uso |
|---|---|
| `db` | Um registro por dia (`dias/AAAA-MM-DD`), o nome da criança (`config/crianca`) e o plano da equipe médica (`config/plano`) |
| `assets` | Fotos dos pratos |
| `downloads` | Baixar o PDF e o CSV |

Se essas capacidades não estiverem disponíveis, o site entra em **modo local** e mostra um aviso no topo. Isso acontece, por exemplo, ao abrir o `index.html` direto no navegador. No modo local os dados ficam só naquele navegador (`localStorage`), e não dá para enviar fotos nem baixar arquivos.

### Como usar

- **Testar no computador:** abra `site/index.html` no navegador. Ele roda em modo local.
- **Usar de verdade:** publique o `index.html` como Artifact no claude.ai com as capacidades `db`, `assets` e `downloads`. Depois é só abrir o link no celular.

## Planilha (Excel)

A planilha tem 5 abas:

- *Preencher pelo celular*: 90 dias × 6 refeições.
- *Histórico por dia*
- *Resumo*: com gráficos.
- *Como usar*
- *Folha diária A4*

As datas de todas as abas saem da **data do primeiro dia**, que fica na aba *Como usar* e pode ser trocada.

Para gerar a planilha de novo:

```bash
pip install openpyxl
python planilha/gerar_planilha.py
```

O script lê `planilha/modelo_folha_A4.xlsx` e grava o resultado na mesma pasta.

## Decisões de projeto

- **Não sugere nada de tratamento.** O site registra e resume, mas não calcula dose, não define meta e não classifica um valor como "bom" ou "ruim". O plano para hipoglicemia é texto livre, escrito pela família conforme a orientação da equipe médica.
- **Fotos sem localização.** A foto é recomprimida no próprio aparelho antes de ser salva. Isso diminui o arquivo e remove os metadados, inclusive a localização GPS.
- **Um arquivo só, sem build.** O site é um único HTML que funciona aberto direto ou publicado como Artifact. A única biblioteca externa é o jsPDF, que só é carregado do cdnjs na hora de gerar o PDF.
- **Mesmas colunas no CSV e no Excel.** Um CSV exportado do site pode ser colado na planilha sem precisar reorganizar as colunas.

## Privacidade

- Este repositório é **privado** e contém só o código e os modelos vazios. **Nenhum dado de saúde fica aqui.** Os registros ficam no armazenamento do Artifact ou no navegador.
- Não coloque aqui exportações (CSV ou PDF), fotos, capturas de tela com registros nem planilhas preenchidas. O `.gitignore` bloqueia esses formatos. As únicas planilhas aceitas são os dois modelos vazios da pasta `planilha/`.
- Para usar a planilha, faça uma cópia **fora** da pasta do projeto e preencha a cópia. Assim o modelo versionado continua vazio.
