# Diário de Glicemia

Controle simples de glicemia para preencher pelo celular, pensado para acompanhar **uma criança** com diabetes no dia a dia e levar o histórico organizado para a equipe médica.

> **Aviso:** este projeto serve para **registrar e acompanhar**. Ele não sugere metas, doses de insulina nem tratamentos. Metas de glicemia, doses e decisões de tratamento seguem sempre as orientações da equipe médica responsável.

## O que tem aqui

```
site/index.html                           Site (página única) para registrar pelo celular
planilha/Controle de Glicemia - Registros.xlsx   Planilha em Excel com o mesmo controle
planilha/gerar_planilha.py                Script que gera a planilha a partir do modelo A4
planilha/modelo_folha_A4.xlsx             Folha diária original, para imprimir e preencher à mão
```

## Site

Página única em HTML/CSS/JS, sem build e sem dependências para instalar.

**Registrar (tela do dia)**
- As 6 refeições do dia: café da manhã, lanche, almoço, café da tarde, janta e ceia.
- Para cada refeição: glicemia antes (mg/dL), insulina aplicada (unidades), o que comeu e bebeu, glicemia 2 h depois e observações.
- Lembrete "2h às HH:MM" depois de registrar a glicemia antes.
- **Etiquetas** de um toque (atividade física, festa/doce, na escola, doente…).
- **Foto do prato** (até 3 por refeição). A imagem é recomprimida no aparelho, o que remove os metadados (inclusive a localização GPS).
- **Registro de hipoglicemia**: horário, valor (ou "LO"), situação, sintomas, o que foi feito e nova medição. Mostra o plano da equipe médica que a família anotar, sem sugerir nada por conta própria.
- **Medições extras** (ao acordar, ao deitar, madrugada…), que não entram nas médias das refeições.

**Histórico**: um cartão por dia, com filtro por etiqueta.

**Resumo para a consulta**
- Médias, mínimas e máximas por refeição, variação média (2 h − antes) e insulina média.
- Gráfico de barras por refeição.
- Médias das refeições com cada etiqueta, além das tabelas de hipoglicemias e de medições extras.
- **Relatório em PDF** (jsPDF), **planilha CSV** (com as mesmas colunas da planilha Excel) e resumo em texto para copiar.

### Onde os dados ficam

O site foi feito para rodar como um **Artifact do Claude** (claude.ai) e usa as capacidades da plataforma por meio de `window.claude.use(...)`:

| Capacidade | Uso |
|---|---|
| `db` | Registros por dia (`dias/AAAA-MM-DD`), nome da criança e plano da equipe médica (`config/...`) |
| `assets` | Fotos dos pratos |
| `downloads` | Baixar o PDF e o CSV |

Quando essas capacidades não existem (por exemplo, abrindo o `index.html` direto no navegador), o site funciona em **modo local**: salva só naquele navegador (`localStorage`) e mostra um aviso no topo. Nesse modo não há envio de fotos nem download de arquivos.

**Nenhum dado de saúde fica neste repositório.** Os registros ficam apenas no armazenamento privado do Artifact.

## Planilha (Excel)

A planilha tem as abas *Preencher pelo celular*, *Histórico por dia*, *Resumo*, *Como usar* e *Folha diária A4*. Para gerar de novo:

```bash
pip install openpyxl
python planilha/gerar_planilha.py
```

## Privacidade

- Este repositório é **público**: contém só o código e modelos vazios.
- Nunca coloque aqui exportações (CSV ou PDF), fotos, capturas de tela com registros nem qualquer dado real. O `.gitignore` já bloqueia os formatos mais comuns.
