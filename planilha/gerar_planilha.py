"""Gera 'Controle de Glicemia - Registros.xlsx' a partir da folha A4 original."""
import datetime as dt
from pathlib import Path
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.comments import Comment

PASTA = Path(__file__).resolve().parent
ORIGEM = PASTA / "modelo_folha_A4.xlsx"
DESTINO = PASTA / "Controle de Glicemia - Registros.xlsx"

DIAS = 90
REFEICOES = ["Café da manhã", "Lanche", "Almoço", "Café da tarde", "Janta", "Ceia"]
PRIMEIRA = 2
ULTIMA = PRIMEIRA + DIAS * len(REFEICOES) - 1

AZUL = "1F4E78"
ENTRADA = "FFF8E1"   # células para preencher
FIXO = "EDEFF2"      # células automáticas
FAIXA = "F3F7FB"     # dias alternados

fina = Side(style="thin", color="BFBFBF")
borda = Border(left=fina, right=fina, top=fina, bottom=fina)
f_titulo = Font(name="Arial", size=14, bold=True, color="FFFFFF")
f_cab = Font(name="Arial", size=10, bold=True, color="FFFFFF")
f_txt = Font(name="Arial", size=10)
f_neg = Font(name="Arial", size=10, bold=True)
f_nota = Font(name="Arial", size=9, italic=True, color="666666")
fill = lambda c: PatternFill("solid", fgColor=c)
centro = Alignment(horizontal="center", vertical="center", wrap_text=True)
esq = Alignment(horizontal="left", vertical="center", wrap_text=True)

wb = openpyxl.load_workbook(ORIGEM)
folha_a4 = wb.active
folha_a4.title = "Folha diária A4"

REG = "'Preencher pelo celular'"
INI = "'Como usar'!$B$4"


def cabecalho(ws, linha, textos, altura=36):
    for i, t in enumerate(textos, 1):
        c = ws.cell(linha, i, t)
        c.font, c.fill, c.alignment, c.border = f_cab, fill(AZUL), centro, borda
    ws.row_dimensions[linha].height = altura


# ---------------------------------------------------------------- Como usar
cu = wb.create_sheet("Como usar")
cu.sheet_view.showGridLines = False
cu.column_dimensions["A"].width = 26
cu.column_dimensions["B"].width = 62
cu.merge_cells("A1:B1")
cu["A1"] = "CONTROLE DE GLICEMIA - COMO USAR"
cu["A1"].font, cu["A1"].fill, cu["A1"].alignment = f_titulo, fill(AZUL), centro
cu.row_dimensions[1].height = 30

cu["A3"] = "Configuração"
cu["A3"].font = Font(name="Arial", size=11, bold=True, color=AZUL)
cu["A4"] = "Data de início do controle"
cu["A4"].font = f_neg
cu["B4"] = dt.date(2026, 9, 25)
cu["B4"].number_format = "dd/mm/yyyy"
cu["B4"].font = Font(name="Arial", size=11, bold=True, color="0000FF")
cu["B4"].fill, cu["B4"].border, cu["B4"].alignment = fill(ENTRADA), borda, Alignment(horizontal="left")
cu["B4"].comment = Comment("Troque pela data do primeiro dia de registro. As datas de todas as abas são geradas a partir dela.", "Controle")
dv_ini = DataValidation(type="date", operator="greaterThan", formula1="36526", showErrorMessage=True,
                        errorTitle="Data inválida", error="Digite uma data (dd/mm/aaaa).")
cu.add_data_validation(dv_ini)
dv_ini.add("B4")

passos = [
    ("Legenda", ""),
    ("Célula amarela", "Você preenche."),
    ("Célula cinza", "Automática (data, refeição e cálculos). Não precisa mexer."),
    ("", ""),
    ("Passo a passo", ""),
    ("1. Início", "Ajuste a data de início acima (uma única vez)."),
    ("2. No celular", "Abra a aba 'Preencher pelo celular'. Cada dia já tem as 6 refeições prontas, na ordem: "
                      "Café da manhã, Lanche, Almoço, Café da tarde, Janta e Ceia."),
    ("3. Antes de comer", "Na linha do dia e da refeição, anote o horário, a glicemia antes (mg/dL) e as unidades de insulina aplicadas."),
    ("4. Durante", "Anote o horário da refeição, o que comeu e bebeu e, se a família conta, os carboidratos em gramas."),
    ("5. Duas horas depois", "Anote o horário e a glicemia 2 horas depois (mg/dL). Use Observações quando necessário "
                             "(ex.: hipoglicemia, atividade física, refeição fora de casa)."),
    ("6. Consulta médica", "Aba 'Histórico por dia': um dia por linha, pronta para imprimir. "
                           "Aba 'Resumo': médias por refeição no período escolhido."),
    ("", ""),
    ("Exemplo de preenchimento", "Café da manhã | Antes: 132 | Insulina: 4 | Pão francês com queijo e café sem açúcar | 2h depois: 168"),
    ("", ""),
    ("Cuidados", "Não insira nem apague linhas na aba de preenchimento: cada linha já corresponde a um dia e uma refeição. "
                 "Refeição que não aconteceu: deixe em branco."),
    ("Capacidade", f"{DIAS} dias a partir da data de início. Para um novo período, salve uma cópia do arquivo e altere a data de início."),
    ("", ""),
    ("Observação", "Este controle é destinado ao registro e acompanhamento das informações. Metas de glicemia, doses de "
                   "insulina e decisões de tratamento devem seguir as orientações da equipe médica responsável."),
]
for i, (a, b) in enumerate(passos, 6):
    cu.cell(i, 1, a).font = Font(name="Arial", size=11, bold=True, color=AZUL) if b == "" else f_neg
    cu.cell(i, 2, b).font = f_txt
    cu.cell(i, 1).alignment = Alignment(vertical="top")
    cu.cell(i, 2).alignment = Alignment(vertical="top", wrap_text=True)
cu["A7"].fill, cu["A8"].fill = fill(ENTRADA), fill(FIXO)
cu["B18"].font = Font(name="Arial", size=10, color="0000FF")

# ---------------------------------------------------------------- Preencher pelo celular
pc = wb.create_sheet("Preencher pelo celular", 0)
colunas = ["Data", "Refeição", "Glicemia antes\n(mg/dL)", "Insulina\n(unidades)",
           "O que comeu e bebeu", "Glicemia 2h\ndepois (mg/dL)", "Observações",
           "Horário\nantes", "Horário da\nrefeição/insulina", "Horário\n2h depois",
           "Carboidratos\n(g)", "Local da\naplicação", "Etiquetas"]
larguras = [13, 14, 11, 10, 34, 12, 28, 10, 14, 10, 11, 18, 24]
cabecalho(pc, 1, colunas)
for i, w in enumerate(larguras, 1):
    pc.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w

for r in range(PRIMEIRA, ULTIMA + 1):
    k = r - PRIMEIRA
    pc.cell(r, 1, f"={INI}+INT((ROW()-{PRIMEIRA})/{len(REFEICOES)})").number_format = "dd/mm (ddd)"
    pc.cell(r, 2, REFEICOES[k % len(REFEICOES)])
    for col in range(1, len(colunas) + 1):
        c = pc.cell(r, col)
        c.border = borda
        c.font = f_neg if col <= 2 else f_txt
        c.alignment = esq if col in (5, 7, 13) else Alignment(horizontal="center", vertical="center")
        c.fill = fill(FIXO) if col <= 2 else PatternFill()
    for col in (8, 9, 10):
        pc.cell(r, col).number_format = "hh:mm"
    pc.cell(r, 2).alignment = Alignment(horizontal="left", vertical="center")

rng = f"C{PRIMEIRA}:M{ULTIMA}"
pc.conditional_formatting.add(
    rng, FormulaRule(formula=[f"MOD(INT((ROW()-{PRIMEIRA})/{len(REFEICOES)}),2)=0"], fill=fill(ENTRADA)))
pc.conditional_formatting.add(
    rng, FormulaRule(formula=[f"MOD(INT((ROW()-{PRIMEIRA})/{len(REFEICOES)}),2)=1"], fill=fill("FFEFC2")))

dv_gli = DataValidation(type="whole", operator="between", formula1="20", formula2="600", allow_blank=True,
                        showErrorMessage=True, errorStyle="warning", errorTitle="Confira o valor",
                        error="Glicemia costuma ficar entre 20 e 600 mg/dL. Confira o número digitado.",
                        showInputMessage=True, promptTitle="Glicemia", prompt="Valor em mg/dL (só números).")
dv_ins = DataValidation(type="decimal", operator="between", formula1="0", formula2="100", allow_blank=True,
                        showErrorMessage=True, errorStyle="warning", errorTitle="Confira o valor",
                        error="Digite apenas o número de unidades (ex.: 4 ou 4,5).",
                        showInputMessage=True, promptTitle="Insulina", prompt="Unidades aplicadas antes da refeição.")
dv_carbo = DataValidation(type="decimal", operator="between", formula1="0", formula2="250", allow_blank=True,
                          showErrorMessage=True, errorStyle="warning", errorTitle="Confira o valor",
                          error="Digite os carboidratos em gramas (ex.: 45).")
dv_local = DataValidation(type="list", formula1='"Barriga esq.,Barriga dir.,Braço esq.,Braço dir.,Coxa esq.,Coxa dir.,Nádega esq.,Nádega dir."', allow_blank=True)
for dv in (dv_gli, dv_ins, dv_carbo, dv_local):
    pc.add_data_validation(dv)
dv_gli.add(f"C{PRIMEIRA}:C{ULTIMA}")
dv_gli.add(f"F{PRIMEIRA}:F{ULTIMA}")
dv_ins.add(f"D{PRIMEIRA}:D{ULTIMA}")
dv_carbo.add(f"K{PRIMEIRA}:K{ULTIMA}")
dv_local.add(f"L{PRIMEIRA}:L{ULTIMA}")

pc.freeze_panes = "C2"
pc.auto_filter.ref = f"A1:M{ULTIMA}"
pc.sheet_properties.tabColor = "F2B705"
pc.page_setup.orientation = "landscape"
pc.page_setup.paperSize = 9
pc.page_setup.fitToWidth, pc.page_setup.fitToHeight = 1, 0
pc.sheet_properties.pageSetUpPr.fitToPage = True
pc.print_title_rows = "1:1"

# ---------------------------------------------------------------- Histórico por dia
hs = wb.create_sheet("Histórico por dia", 1)
hs.merge_cells("A1:V1")
hs["A1"] = "HISTÓRICO POR DIA - GLICEMIA (mg/dL) E INSULINA (unidades)"
hs["A1"].font, hs["A1"].fill, hs["A1"].alignment = f_titulo, fill(AZUL), centro
hs.row_dimensions[1].height = 28

hs.merge_cells("A2:A3")
hs["A2"] = "Data"
col = 2
for nome in REFEICOES:
    hs.merge_cells(start_row=2, start_column=col, end_row=2, end_column=col + 2)
    hs.cell(2, col, nome)
    for j, sub in enumerate(["Antes", "Insul.", "2h dep."]):
        hs.cell(3, col + j, sub)
    col += 3
for j, t in enumerate(["Média antes", "Média 2h depois", "Insulina total"]):
    hs.merge_cells(start_row=2, start_column=20 + j, end_row=3, end_column=20 + j)
    hs.cell(2, 20 + j, t)
for r in (2, 3):
    for c in range(1, 23):
        cell = hs.cell(r, c)
        cell.font, cell.fill, cell.alignment, cell.border = f_cab, fill(AZUL), centro, borda
hs.row_dimensions[2].height = 22
hs.row_dimensions[3].height = 18
hs.column_dimensions["A"].width = 12
for c in range(2, 20):
    hs.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 7
for c in range(20, 23):
    hs.column_dimensions[openpyxl.utils.get_column_letter(c)].width = 10

L = openpyxl.utils.get_column_letter
for d in range(DIAS):
    r = 4 + d
    base = PRIMEIRA + d * len(REFEICOES)
    hs.cell(r, 1, f"={REG}!A{base}").number_format = "dd/mm (ddd)"
    col = 2
    antes, depois, insul = [], [], []
    for m in range(len(REFEICOES)):
        for j, fonte in enumerate("CDF"):
            ref = f"{REG}!{fonte}{base + m}"
            hs.cell(r, col + j, f'=IF({ref}="","",{ref})')
        antes.append(f"{L(col)}{r}")
        insul.append(f"{L(col + 1)}{r}")
        depois.append(f"{L(col + 2)}{r}")
        col += 3
    a, i_, p = ",".join(antes), ",".join(insul), ",".join(depois)
    hs.cell(r, 20, f'=IF(COUNT({a})=0,"",AVERAGE({a}))')
    hs.cell(r, 21, f'=IF(COUNT({p})=0,"",AVERAGE({p}))')
    hs.cell(r, 22, f'=IF(COUNT({i_})=0,"",SUM({i_}))')
    for c in range(1, 23):
        cell = hs.cell(r, c)
        cell.border = borda
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.font = f_neg if c == 1 or c >= 20 else f_txt
        if c >= 20:
            cell.number_format = "0"
            cell.fill = fill(FIXO)
        elif d % 2:
            cell.fill = fill(FAIXA)
nota_h = 4 + DIAS + 1
hs.cell(nota_h, 1, "Valores copiados automaticamente da aba 'Preencher pelo celular'. "
                   "Observações e alimentação completas estão naquela aba.").font = f_nota
hs.freeze_panes = "B4"
hs.page_setup.orientation = "landscape"
hs.page_setup.paperSize = 9
hs.page_setup.fitToWidth, hs.page_setup.fitToHeight = 1, 0
hs.sheet_properties.pageSetUpPr.fitToPage = True
hs.print_title_rows = "2:3"
hs.page_margins.left = hs.page_margins.right = 0.4

linha = LineChart()
linha.title = "Média diária de glicemia"
linha.y_axis.title = "mg/dL"
linha.height, linha.width = 8, 22
linha.add_data(Reference(hs, min_col=20, max_col=21, min_row=2, max_row=3 + DIAS), titles_from_data=True)
linha.set_categories(Reference(hs, min_col=1, min_row=4, max_row=3 + DIAS))
linha.x_axis.number_format = "dd/mm"
linha.x_axis.delete = False
linha.y_axis.delete = False
hs.add_chart(linha, "X2")

# ---------------------------------------------------------------- Resumo
rs = wb.create_sheet("Resumo", 2)
rs.sheet_view.showGridLines = False
rs.merge_cells("A1:K1")
rs["A1"] = "RESUMO PARA A EQUIPE MÉDICA"
rs["A1"].font, rs["A1"].fill, rs["A1"].alignment = f_titulo, fill(AZUL), centro
rs.row_dimensions[1].height = 30

rs["A3"], rs["A4"] = "Período de", "Até"
for c in ("A3", "A4"):
    rs[c].font = f_neg
rs["B3"] = f"={INI}"
rs["B4"] = f"={INI}+{DIAS - 1}"
for c in ("B3", "B4"):
    rs[c].number_format = "dd/mm/yyyy"
    rs[c].font = Font(name="Arial", size=11, bold=True, color="0000FF")
    rs[c].fill, rs[c].border = fill(ENTRADA), borda
rs["C3"] = "Pode trocar as datas para ver só um período (ex.: últimos 15 dias)."
rs["C3"].font = f_nota
H = "'Histórico por dia'!"
hr = lambda c: f"{H}${c}$4:${c}${3 + DIAS}"
rs["A5"] = "Dias com registro"
rs["B5"] = (f'=SUMPRODUCT(({hr("A")}>=$B$3)*({hr("A")}<=$B$4)'
            f'*((({hr("T")}<>"")+({hr("U")}<>"")+({hr("V")}<>""))>0))')
rs["A5"].font = rs["B5"].font = f_neg
rs["B5"].alignment = Alignment(horizontal="left")

cab = ["Refeição", "Medições\nantes", "Média\nantes", "Mínima\nantes", "Máxima\nantes", "Média de\ninsulina (un.)",
       "Medições\n2h depois", "Média\n2h depois", "Mínima\n2h depois", "Máxima\n2h depois", "Variação média\n(2h − antes)"]
cabecalho(rs, 7, cab, 40)
larg = [18, 12, 10, 10, 10, 13, 11, 11, 11, 11, 15]
for i, w in enumerate(larg, 1):
    rs.column_dimensions[L(i)].width = w

R = lambda c: f"{REG}!${c}${PRIMEIRA}:${c}${ULTIMA}"
per = f'{R("A")},">="&$B$3,{R("A")},"<="&$B$4'
for i, nome in enumerate(REFEICOES + ["Todas"]):
    r = 8 + i
    todas = nome == "Todas"
    crit = per if todas else f'{R("B")},$A{r},{per}'
    rs.cell(r, 1, "Todas as refeições" if todas else nome)
    rs.cell(r, 2, f'=COUNTIFS({R("C")},"<>",{crit})')
    rs.cell(r, 3, f'=IFERROR(AVERAGEIFS({R("C")},{crit}),"-")')
    rs.cell(r, 4, f'=IF(B{r}=0,"-",_xlfn.MINIFS({R("C")},{crit}))')
    rs.cell(r, 5, f'=IF(B{r}=0,"-",_xlfn.MAXIFS({R("C")},{crit}))')
    rs.cell(r, 6, f'=IFERROR(AVERAGEIFS({R("D")},{crit}),"-")')
    rs.cell(r, 7, f'=COUNTIFS({R("F")},"<>",{crit})')
    rs.cell(r, 8, f'=IFERROR(AVERAGEIFS({R("F")},{crit}),"-")')
    rs.cell(r, 9, f'=IF(G{r}=0,"-",_xlfn.MINIFS({R("F")},{crit}))')
    rs.cell(r, 10, f'=IF(G{r}=0,"-",_xlfn.MAXIFS({R("F")},{crit}))')
    rs.cell(r, 11, f'=IF(OR(C{r}="-",H{r}="-"),"-",H{r}-C{r})')
    for c in range(1, 12):
        cell = rs.cell(r, c)
        cell.border = borda
        cell.font = f_neg if c == 1 or todas else f_txt
        cell.alignment = Alignment(horizontal="left" if c == 1 else "center", vertical="center")
        cell.number_format = "+0;-0;0" if c == 11 else ("0.0" if c == 6 else "0")
        if todas:
            cell.fill = fill(FIXO)
    rs.row_dimensions[r].height = 20
# Na linha "Todas", a variação compara só médias gerais
rs.cell(15, 11).comment = Comment("Diferença entre a média geral de 2h depois e a média geral antes.", "Controle")

rs["A17"] = ("Glicemias em mg/dL. Medições em branco não entram nas médias. "
             "Metas de glicemia, doses de insulina e decisões de tratamento devem seguir as orientações da equipe médica responsável.")
rs.merge_cells("A17:K18")
rs["A17"].font, rs["A17"].alignment = f_nota, Alignment(wrap_text=True, vertical="top")

barras = BarChart()
barras.title = "Média de glicemia por refeição"
barras.y_axis.title = "mg/dL"
barras.height, barras.width = 8, 22
barras.add_data(Reference(rs, min_col=3, min_row=7, max_row=13), titles_from_data=True)
barras.add_data(Reference(rs, min_col=8, min_row=7, max_row=13), titles_from_data=True)
barras.set_categories(Reference(rs, min_col=1, min_row=8, max_row=13))
barras.x_axis.delete = False
barras.y_axis.delete = False
rs.add_chart(barras, "A20")

rs.page_setup.orientation = "landscape"
rs.page_setup.paperSize = 9
rs.page_setup.fitToWidth = rs.page_setup.fitToHeight = 1
rs.sheet_properties.pageSetUpPr.fitToPage = True

for ws, cor in ((hs, AZUL), (rs, AZUL), (cu, "808080"), (folha_a4, "808080")):
    ws.sheet_properties.tabColor = cor

# ordem: Preencher, Histórico, Resumo, Como usar, Folha A4
wb._sheets = [pc, hs, rs, cu, folha_a4]
wb.active = 0
for ws in wb.worksheets:
    ws.sheet_view.tabSelected = ws is pc
wb.save(DESTINO)
print("ok", DESTINO)
