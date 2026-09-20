from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output" / "pdf" / "resolucoes_fisica_eletricidade_gases_dilatacao.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

PAGE_W, PAGE_H = A4
MARGIN_X = 1.65 * cm
MARGIN_TOP = 1.75 * cm
MARGIN_BOTTOM = 1.55 * cm

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#1E6F9F")
TEAL = colors.HexColor("#1F9D8A")
GREEN = colors.HexColor("#2E7D32")
ORANGE = colors.HexColor("#C56A18")
PURPLE = colors.HexColor("#7356A6")
PALE_BLUE = colors.HexColor("#EAF4FA")
PALE_GREEN = colors.HexColor("#EAF6F2")
PALE_ORANGE = colors.HexColor("#FFF3E7")
PALE_PURPLE = colors.HexColor("#F2EEFA")
LIGHT = colors.HexColor("#F5F7F9")
MID = colors.HexColor("#D8E0E7")
TEXT = colors.HexColor("#1D2730")
MUTED = colors.HexColor("#5D6A73")


def P(text, style):
    return Paragraph(text, style)


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "TitleCustom", parent=styles["Title"], fontName="Arial-Bold", fontSize=26,
    leading=30, textColor=NAVY, alignment=TA_CENTER, spaceAfter=10,
)
subtitle = ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontName="Arial", fontSize=12.5,
    leading=17, textColor=MUTED, alignment=TA_CENTER,
)
h1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Arial-Bold", fontSize=18,
    leading=22, textColor=NAVY, spaceBefore=2, spaceAfter=10,
)
h2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Arial-Bold", fontSize=12.8,
    leading=16, textColor=NAVY, spaceBefore=0, spaceAfter=5,
)
body = ParagraphStyle(
    "Body", parent=styles["BodyText"], fontName="Arial", fontSize=9.4,
    leading=13.1, textColor=TEXT, spaceAfter=4,
)
small = ParagraphStyle(
    "Small", parent=body, fontSize=7.6, leading=10, textColor=MUTED,
)
label = ParagraphStyle(
    "Label", parent=body, fontName="Arial-Bold", fontSize=8.3,
    leading=11, textColor=BLUE, spaceAfter=2,
)
formula = ParagraphStyle(
    "Formula", parent=body, fontName="Arial-Bold", fontSize=9.7,
    leading=13.8, leftIndent=8, textColor=NAVY,
)
answer = ParagraphStyle(
    "Answer", parent=body, fontName="Arial-Bold", fontSize=9.5,
    leading=13, textColor=GREEN, spaceBefore=3,
)
toc_style = ParagraphStyle(
    "TOC", parent=body, fontSize=10.2, leading=15, leftIndent=8,
)


class NumberedDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        frame = Frame(
            MARGIN_X, MARGIN_BOTTOM, PAGE_W - 2 * MARGIN_X,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM, id="normal",
        )
        self.addPageTemplates(PageTemplate(id="main", frames=frame, onPage=self._header_footer))

    @staticmethod
    def _header_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(MID)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, PAGE_H - 1.18 * cm, PAGE_W - MARGIN_X, PAGE_H - 1.18 * cm)
        canvas.setFont("Arial", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, PAGE_H - 0.88 * cm, "Resoluções de Física - material organizado a partir das fotos enviadas")
        canvas.drawRightString(PAGE_W - MARGIN_X, 0.78 * cm, f"Página {doc.page}")
        canvas.restoreState()


def section_banner(number, name, color, pale):
    data = [[P(f"{number}", ParagraphStyle("SecNo", parent=h1, textColor=colors.white, alignment=TA_CENTER)),
             P(name, ParagraphStyle("SecName", parent=h1, textColor=color, fontSize=17))]]
    t = Table(data, colWidths=[1.05 * cm, PAGE_W - 2 * MARGIN_X - 1.05 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BACKGROUND", (1, 0), (1, 0), pale),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("BOX", (0, 0), (-1, -1), 0.6, color),
    ]))
    return [t, Spacer(1, 0.28 * cm)]


solutions_bank = []


def qblock(n, qtitle, source, prompt, solution, result, note=None, tint=PALE_BLUE):
    solutions_bank.append({
        "n": n, "title": qtitle, "source": source, "solution": solution,
        "result": result, "note": note, "tint": tint,
    })
    parts = [
        P(f"Questão {n:02d} - {qtitle}", h2),
        P(f"Fonte nas fotos: {source}", small),
        Spacer(1, 0.05 * cm),
        P("ENUNCIADO RECONSTRUÍDO", label),
        P(prompt, body),
    ]
    blank = Table([[""]], colWidths=[PAGE_W - 2 * MARGIN_X - 20], rowHeights=[0.7 * cm])
    blank.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, MID),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
    ]))
    parts += [P("ESPAÇO PARA RESOLUÇÃO", label), blank]
    box = Table([[parts]], colWidths=[PAGE_W - 2 * MARGIN_X])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9CBD8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return [KeepTogether([box, Spacer(1, 0.28 * cm)])]


def solution_block(item):
    n = item["n"]
    if n <= 10:
        tint = PALE_BLUE
    elif n <= 18:
        tint = PALE_GREEN
    elif n <= 28:
        tint = PALE_ORANGE
    elif n <= 34:
        tint = PALE_PURPLE
    else:
        tint = PALE_BLUE
    parts = [
        P(f"Questão {n:02d} - {item['title']}", h2),
        P(f"Fonte nas fotos: {item['source']}", small),
        Spacer(1, 0.05 * cm),
        P("RESOLUÇÃO", label),
    ]
    for para in item["solution"]:
        parts.append(P(para, formula if para.startswith("<b>") else body))
    if item["note"]:
        parts.append(P(
            f"Atenção: {item['note']}",
            ParagraphStyle("Note", parent=small, textColor=ORANGE, backColor=PALE_ORANGE, borderPadding=4),
        ))
    parts.append(P(f"Resposta: {item['result']}", answer))
    box = Table([[parts]], colWidths=[PAGE_W - 2 * MARGIN_X])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tint),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#B9CBD8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([box, Spacer(1, 0.28 * cm)])


story = []

# Cover
story += [Spacer(1, 3.2 * cm), P("RESOLUÇÕES DE FÍSICA", title)]
story += [P("Circuitos elétricos, 1ª Lei de Ohm, corrente elétrica, potência e consumo de energia, gases e dilatação térmica dos sólidos", subtitle)]
story += [Spacer(1, 1.0 * cm)]
cover_table = Table([
    [P("40", ParagraphStyle("BigNo", parent=title, fontSize=30, textColor=TEAL)), P("questões selecionadas e resolvidas", h2)],
    [P("5", ParagraphStyle("BigNo2", parent=title, fontSize=30, textColor=ORANGE)), P("seções temáticas", h2)],
    [P("1", ParagraphStyle("BigNo3", parent=title, fontSize=30, textColor=PURPLE)), P("formulário-resumo para revisão", h2)],
], colWidths=[2.0 * cm, 10.6 * cm], rowHeights=[1.3 * cm] * 3)
cover_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("BOX", (0, 0), (-1, -1), 0.8, MID),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, MID),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
]))
story += [cover_table, Spacer(1, 1.25 * cm)]
story += [P("Critério de seleção", h2)]
story += [P("Foram incluídas somente as questões relacionadas aos temas pedidos. Fotos repetidas foram consolidadas em uma única resolução. As marcações manuscritas das provas não foram tomadas como gabarito; os resultados abaixo foram recalculados.", body)]
story += [Spacer(1, 2.0 * cm), P("Material de estudo - Setembro de 2026", subtitle), PageBreak()]

# Roadmap and formula sheet
story += [P("Como usar este caderno", h1)]
story += [P("Leia primeiro o enunciado reconstruído, tente resolver sem olhar a conta e depois compare seu raciocínio com a resolução. Em eletricidade, converta mA para A e W para kW antes de calcular. Em gases, use sempre temperatura absoluta em kelvin.", body)]
story += [Spacer(1, 0.25 * cm), P("Mapa do conteúdo", h2)]
for line in [
    "1. Circuitos e instrumentos - questões 01 a 10",
    "2. Lei de Ohm, resistência e corrente - questões 11 a 18",
    "3. Potência, efeito Joule e consumo - questões 19 a 28",
    "4. Dilatação térmica dos sólidos - questões 29 a 34",
    "5. Gases - questões 35 a 40",
]:
    story.append(P(line, toc_style))
story += [Spacer(1, 0.35 * cm), P("Formulário essencial", h2)]
formula_rows = [
    ["Tema", "Relações principais"],
    ["Eletricidade", "U = R.I   |   P = U.I = I².R = U²/R   |   E = P.Δt"],
    ["Associações", "Série: R<sub>eq</sub> = R1 + R2 + ...   |   Paralelo: 1/R<sub>eq</sub> = 1/R1 + 1/R2 + ..."],
    ["Resistividade", "R = ρ.L/A"],
    ["Dilatação", "ΔL = L0.α.ΔT   |   ΔA = A0.β.ΔT, β ≈ 2α   |   ΔV = V0.γ.ΔT, γ ≈ 3α"],
    ["Gases", "P1.V1/T1 = P2.V2/T2   |   P.V = n.R.T   |   T(K) = θ(°C) + 273"],
]
ft = Table([[P(c, label if r == 0 else body) for c in row] for r, row in enumerate(formula_rows)], colWidths=[3.1 * cm, 13.2 * cm])
ft.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("BACKGROUND", (0, 1), (-1, -1), LIGHT),
    ("GRID", (0, 0), (-1, -1), 0.5, MID),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story += [ft, PageBreak(), P("Parte 1 - Questões", h1)]
story += [P("Resolva as questões nesta primeira parte. As respostas e as resoluções completas aparecem somente na Parte 2, após a questão 40.", body), Spacer(1, 0.2 * cm)]

# Section 1
story += section_banner("1", "Circuitos e instrumentos", BLUE, PALE_BLUE)
story += qblock(1, "Voltímetro e amperímetro", "WA0046 - questão 01",
    "Três resistores devem ficar em paralelo. Deseja-se medir a corrente em R2 e a tensão aplicada ao circuito, usando também um interruptor.",
    ["O amperímetro mede a corrente do ramo, portanto deve ficar <b>em série com R2</b>.", "O voltímetro mede diferença de potencial, portanto deve ficar <b>em paralelo com todo o conjunto</b>. O interruptor deve interromper a corrente total."],
    "alternativa B.")
story += qblock(2, "Lanterna improvisada", "WA0049 - questão 01",
    "Uma pilha, uma lâmpada e um fio são montados de sete maneiras. Em quais montagens a lâmpada acende?",
    ["A lâmpada só acende quando seus dois contatos metálicos - a rosca lateral e o contato inferior - ficam ligados a polos opostos da pilha, formando caminho fechado.", "Nas figuras, isso ocorre nos esquemas 1, 3 e 7."],
    "alternativa A: 1, 3 e 7.")
story += qblock(3, "Duas pilhas de 1,5 V", "WA0050 - questão 104",
    "Um controle remoto requer 3,0 V. Duas pilhas de 1,5 V devem ser ligadas de modo que suas tensões se somem.",
    ["Para somar as tensões, as pilhas devem ser ligadas <b>em série e no mesmo sentido</b>: o polo positivo de uma ligado ao polo negativo da outra.", "Os terminais livres fornecem 1,5 + 1,5 = 3,0 V."],
    "alternativa C.")
story += qblock(4, "Fonte de 6,0 V com pilhas", "WA0053 - questão 02",
    "Um equipamento exige 6,0 V e há pilhas ideais de 1,5 V. Quais associações podem alimentar corretamente o equipamento?",
    ["Uma fileira de quatro pilhas em série fornece 4 × 1,5 = 6,0 V.", "Também é possível ligar em paralelo duas fileiras idênticas, cada uma com quatro pilhas em série. A tensão permanece 6,0 V e a capacidade disponível aumenta."],
    "alternativa A.")
story += qblock(5, "Resistor cilíndrico em um circuito", "WA0053 - questão 03",
    "No circuito de 12 V, um resistor de 18 Ω está em série com o paralelo entre 30 Ω e um cilindro de L = 1 m, A = 10<super>-6</super> m² e ρ = 2×10<super>-5</super> Ω.m. Determine a resistência do cilindro e a corrente total.",
    ["<b>R<sub>cil</sub> = ρL/A = (2×10<super>-5</super>×1)/(10<super>-6</super>) = 20 Ω.</b>", "No paralelo: R<sub>p</sub> = (30×20)/(30+20) = 12 Ω.", "R<sub>eq</sub> = 18 + 12 = 30 Ω e I = 12/30 = 0,40 A."],
    "R do cilindro = 20 Ω; corrente total = 0,40 A.")
story += qblock(6, "Tela resistiva ao toque", "WA0067 - questão 04",
    "Uma fonte de 12 V alimenta dois ramos com dois resistores de 4 Ω em série. Ao tocar o ponto B, o segundo ramo é fechado. Calcule a resistência equivalente e a corrente na fonte.",
    ["Cada ramo possui 4 + 4 = 8 Ω.", "Com B fechado, os dois ramos de 8 Ω ficam em paralelo: R<sub>eq</sub> = 8/2 = 4 Ω.", "I = U/R<sub>eq</sub> = 12/4 = 3 A."],
    "R equivalente = 4 Ω; corrente = 3 A.")
story += qblock(7, "Circuito do carro", "WA0058 - questão 113; alternativas em WA0060",
    "Quatro resistores de 12 kΩ ligam o ponto A a um nó intermediário em paralelo. Um quinto resistor de 12 kΩ liga esse nó ao ponto B. Determine R<sub>eq</sub> entre A e B.",
    ["Quatro resistores iguais em paralelo: R<sub>p</sub> = 12/4 = 3 kΩ.", "Esse bloco está em série com o último resistor: R<sub>eq</sub> = 3 + 12 = 15 kΩ."],
    "alternativa B: 15 kΩ.", note="O traçado da foto pode dar a impressão de dois blocos em série; os quatro resistores centrais compartilham os mesmos dois nós.")
story += qblock(8, "Corrente fornecida por uma fonte de 48 V", "WA0059 - questão 06",
    "Uma fonte de 48 V, com resistência interna de 3 Ω, alimenta: (6 Ω || 3 Ω), depois 3 Ω, depois três resistores de 9 Ω em paralelo e, por fim, 1 Ω em série.",
    ["6 || 3 = 2 Ω. Três resistores de 9 Ω em paralelo equivalem a 9/3 = 3 Ω.", "R<sub>total</sub> = 3(interna) + 2 + 3 + 3 + 1 = 12 Ω.", "I = 48/12 = 4 A."],
    "alternativa D: 4 A.")
story += qblock(9, "Brilho de quatro lâmpadas", "WA0063 - questão 06",
    "L1 e L2 estão no caminho principal; L3 e L4, idênticas, formam um paralelo entre elas. Compare os brilhos.",
    ["A corrente total passa por L1 e L2. No paralelo, ela se divide igualmente entre L3 e L4.", "Como P = I²R, L1 e L2 dissipam a mesma potência e cada uma dissipa quatro vezes a potência de L3 ou L4."],
    "alternativa D: L1 e L2 igualmente mais brilhantes que L3 e L4.")
story += qblock(10, "Escala do multímetro", "WA0067 - questão 05; continuação em WA0059",
    "Para verificar se uma tomada é de 127 V ou 220 V, em qual escala do multímetro a chave seletora deve ser colocada?",
    ["A grandeza é tensão alternada, indicada por V~. A escala precisa ser maior que o maior valor esperado, 220 V.", "Entre as opções, 750 V é a menor escala de tensão alternada que suporta 220 V com segurança."],
    "alternativa B: 750 V em V~.")

# Section 2
story += [PageBreak()] + section_banner("2", "Lei de Ohm, resistência e corrente", TEAL, PALE_GREEN)
story += qblock(11, "Resistência para uma Air Fryer", "WA0040/WA0027 - questão 01 (duplicada)",
    "Uma Air Fryer de 1 400 W foi feita para 110 V. Para manter a mesma potência em 220 V, qual deve ser a nova resistência?",
    ["Em um resistor, P = U²/R. Mantendo P constante:", "<b>R = U²/P = 220²/1 400 = 34,57 Ω ≈ 34,6 Ω.</b>"],
    "alternativa D: 34,6 Ω.")
story += qblock(12, "Choque elétrico e pele molhada", "WA0042/WA0024 - questão 03 (duplicada)",
    "A pele seca tem resistência 1,0×10<super>5</super> Ω e a molhada 1,0×10<super>3</super> Ω. Se, com pele seca, a corrente causa parada respiratória (20 mA), qual será a consequência com pele molhada na mesma tensão?",
    ["Na mesma tensão, I é inversamente proporcional a R. A resistência diminui 100 vezes, então a corrente aumenta 100 vezes.", "I<sub>molhada</sub> = 20 mA × 100 = 2 000 mA = 2 A.", "Pela tabela, 2 A corresponde a parada cardíaca."],
    "alternativa A: parada cardíaca.")
story += qblock(13, "Código de cores do resistor", "WA0047 - questão 05",
    "Qual sequência de cores representa 140 kΩ com tolerância de ±5%?",
    ["140 kΩ = 140 000 Ω = 14 × 10<super>4</super> Ω.", "Primeiro algarismo 1: marrom. Segundo 4: amarelo. Multiplicador 10<super>4</super>: amarelo. Tolerância 5%: verde."],
    "alternativa B: marrom, amarelo, amarelo e verde.")
story += qblock(14, "Chuveiro com fio encurtado", "WA0048 - questão 98",
    "Um chuveiro ligado a tensão constante deve aquecer mais a água. Qual alteração na resistência produz esse efeito?",
    ["R = ρL/A: encurtar o fio diminui a resistência.", "P = U²/R: com tensão constante, menor R produz maior potência e mais aquecimento."],
    "alternativa B: usar uma resistência mais curta.")
story += qblock(15, "Resistência de um dispositivo pelo gráfico", "WA0057 - questão 05; continuação em WA0063",
    "No trecho ôhmico do gráfico U × i, aparecem pontos como U = 6 V para i = 2 mA. Determine R em kΩ.",
    ["Converta 2 mA = 2×10<super>-3</super> A.", "<b>R = U/i = 6/(2×10<super>-3</super>) = 3 000 Ω = 3,0 kΩ.</b>"],
    "alternativa E: 3,0 kΩ.")
story += qblock(16, "Sensor de polianilina", "WA0061 - questão 07",
    "Sem amônia, o gráfico mostra comportamento ôhmico, por exemplo 0,5 V e 1,0×10<super>-4</super> A. Em alta concentração de amônia, a resistência nominal quadruplica. Qual é a nova resistência?",
    ["R<sub>0</sub> = 0,5/(1,0×10<super>-4</super>) = 5,0×10<super>3</super> Ω.", "R = 4R<sub>0</sub> = 2,0×10<super>4</super> Ω."],
    "alternativa B: 2,0×10⁴ Ω.")
story += qblock(17, "Raquete elétrica", "WA0049 - questão 02",
    "A raquete fornece pulsos de aproximadamente 2 kV e potência de 6 W. Qual é a corrente média no inseto, em mA?",
    ["P = U.I, então I = P/U.", "I = 6/2 000 = 0,003 A = 3,0 mA."],
    "alternativa C: 3,0 mA.")
story += qblock(18, "Corrente em chuveiro com resistores em paralelo", "WA0069 - questão 92",
    "Um chuveiro possui duas resistências de 40 Ω. No modo mais rápido, elas são ligadas em paralelo a 220 V. Determine a corrente total.",
    ["Duas resistências iguais em paralelo: R<sub>eq</sub> = 40/2 = 20 Ω.", "I = 220/20 = 11 A."],
    "alternativa C: 11,0 A.")

# Section 3
story += [PageBreak()] + section_banner("3", "Potência, efeito Joule e consumo de energia", ORANGE, PALE_ORANGE)
story += qblock(19, "Potência das lâmpadas", "WA0056 - questão 110",
    "Cinco lâmpadas têm pares (I, U): A(2,0 A;10 V), B(4,0 A;20 V), C(0,5 A;40 V), D(1,5 A;40 V) e E(2,0 A;50 V). Qual tem maior risco de queimar por dissipar mais potência?",
    ["P = U.I. Assim: A = 20 W; B = 80 W; C = 20 W; D = 60 W; E = 100 W.", "A maior potência é a da lâmpada E."],
    "alternativa E.")
story += qblock(20, "Aparelho semelhante ao chuveiro", "WA0065",
    "Um chuveiro opera com 4 400 W em 127 V. Compare sua resistência com: forno 4 Ω, máquina 11 Ω, geladeira 54 Ω, ventilador 64 Ω e televisor 80 Ω.",
    ["R = U²/P = 127²/4 400 = 3,67 Ω.", "O valor mais próximo é 4 Ω, correspondente ao forno elétrico."],
    "alternativa D: forno elétrico.")
story += qblock(21, "Bobina do secador", "WA0041/WA0025 - questão 05 (duplicada)",
    "No secador, uma bobina recebe corrente elétrica e aquece o ar. Como essa bobina se comporta no circuito?",
    ["A bobina transforma energia elétrica principalmente em energia térmica pelo efeito Joule.", "Nesse papel, ela funciona como um resistor."],
    "alternativa A: resistor.")
story += qblock(22, "Fusível", "WA0061 - questão 08",
    "Quando a corrente excede o limite, o elo metálico do fusível aquece, funde e interrompe o circuito. A qual fenômeno isso se relaciona?",
    ["A corrente em um condutor com resistência produz calor. A potência dissipada pode ser escrita como P = I²R.", "O aquecimento e a fusão do elo são manifestações do efeito Joule."],
    "alternativa B: efeito Joule.")
story += qblock(23, "Aquecimento de chocolates", "WA0069 - questão 95",
    "Uma lâmpada aquece 'pintinhos' em uma tirinha. Qual conceito físico denomina o aquecimento produzido pela passagem de corrente?",
    ["A energia elétrica é transformada em energia térmica no filamento da lâmpada.", "Esse processo é o efeito Joule."],
    "alternativa B: efeito Joule.")
story += qblock(24, "Consumo máximo de uma instalação", "WA0040/WA0027/WA0054 - questão sobre planta (repetida)",
    "A planta possui 9 tomadas de 300 W, 5 tomadas de 600 W e 1 tomada de 4 400 W. Todas operam no máximo durante 2 h. Determine o consumo.",
    ["P<sub>total</sub> = 9×300 + 5×600 + 1×4 400 = 10 100 W = 10,1 kW.", "E = P.Δt = 10,1×2 = 20,2 kWh."],
    "alternativa E: 20,2 kWh.")
story += qblock(25, "Conta mensal - aparelhos de 220 V", "WA0041/WA0025 - questão 06 (duplicada)",
    "Por dia: ferro 220 V, 4 A por 60 min; aquecedor 220 V, 5 A por 120 min; chuveiro 220 V, 10 A por 30 min. Em 30 dias, com 1 kWh a R$ 0,80, determine consumo e custo.",
    ["Ferro: 0,88 kW×1 h = 0,88 kWh/dia. Aquecedor: 1,10 kW×2 h = 2,20 kWh/dia. Chuveiro: 2,20 kW×0,5 h = 1,10 kWh/dia.", "Total diário = 4,18 kWh. Em 30 dias: E = 125,4 kWh.", "Custo = 125,4×0,80 = R$ 100,32."],
    "125,4 kWh e R$ 100,32.")
story += qblock(26, "Economia ao reduzir o uso da Air Fryer", "WA0057 - questão 03",
    "Uma Air Fryer de 1,5 kW é usada 4 h por mês. Quanto se economiza ao reduzir o tempo pela metade, se 1 kWh custa R$ 0,80?",
    ["A redução de tempo é 4/2 = 2 h.", "Energia economizada = 1,5×2 = 3,0 kWh.", "Economia = 3,0×0,80 = R$ 2,40."],
    "R$ 2,40.")
story += qblock(27, "Conta mensal - tensões mistas", "WA0061 - questão 09",
    "Por dia: ferro 127 V, 4 A por 1 h; aquecedor 127 V, 5 A por 3 h; chuveiro 220 V, 10 A por 0,5 h. Calcule 30 dias a R$ 0,80/kWh.",
    ["Ferro: 0,508×30 = 15,24 kWh. Aquecedor: 0,635×90 = 57,15 kWh. Chuveiro: 2,20×15 = 33,00 kWh.", "E<sub>total</sub> = 15,24 + 57,15 + 33,00 = 105,39 kWh.", "Custo = 105,39×0,80 = R$ 84,312 ≈ R$ 84,31."],
    "105,39 kWh e aproximadamente R$ 84,31.")
story += qblock(28, "Autonomia da bateria", "WA0047 - questão 06",
    "O tablet ficará ligado por 2,5 h na ida e 2,5 h na volta, totalizando 5 h. Qual modelo possui capacidade suficiente, considerando a corrente média indicada na tabela?",
    ["A carga exigida é Q = I.t. Para os modelos I a V, as necessidades são 15 000, 12 500, 10 000, 7 500 e 5 000 mAh.", "Comparando com as capacidades da tabela, somente o modelo IV possui 7 500 mAh para uma necessidade de 7 500 mAh."],
    "alternativa D: modelo IV.")

# Section 4
story += [PageBreak()] + section_banner("4", "Dilatação térmica dos sólidos", PURPLE, PALE_PURPLE)
story += qblock(29, "Furo em uma placa aquecida", "WA0070 - questão 134",
    "Uma placa metálica homogênea possui um orifício circular. O que acontece com o orifício quando toda a placa é aquecida uniformemente?",
    ["Imagine o orifício preenchido com o mesmo material da placa. Ao aquecer, essa parte imaginária também se dilataria.", "Logo, o diâmetro e a área do furo aumentam como se o furo fosse feito do próprio material."],
    "alternativa D: dilatação superficial expansiva.")
story += qblock(30, "Termômetro de vidro e mercúrio", "WA0068 - questão 131",
    "Se o vidro do termômetro e o mercúrio tivessem o mesmo coeficiente de dilatação cúbica, o instrumento funcionaria?",
    ["A leitura depende da dilatação aparente do mercúrio em relação ao recipiente de vidro.", "Se ambos se dilatassem proporcionalmente do mesmo modo, não haveria variação relativa útil da coluna."],
    "alternativa B: não funcionaria adequadamente.")
story += qblock(31, "Barras de aço e vidro", "WA0062 - questão 119",
    "Aço e vidro têm o mesmo comprimento L0 a 0 °C. A 100 °C, seus comprimentos diferem 0,1 cm. Dados: α<sub>aço</sub> = 12×10<super>-6</super> °C<super>-1</super> e α<sub>vidro</sub> = 8×10<super>-6</super> °C<super>-1</super>. Determine L0.",
    ["A diferença de dilatação é ΔL = L0(α<sub>aço</sub>-α<sub>vidro</sub>)ΔT.", "0,1 = L0×(4×10<super>-6</super>)×100 = L0×4×10<super>-4</super>.", "L0 = 0,1/(4×10<super>-4</super>) = 250 cm."],
    "alternativa D: 250 cm.")
story += qblock(32, "Placas de cobre e aço", "WA0064 - questão 122",
    "Placas de cobre e aço têm a mesma área a 0 °C. A 200 °C, a diferença entre as áreas é 0,96 cm². α<sub>Cu</sub> = 1,7×10<super>-5</super> °C<super>-1</super> e α<sub>aço</sub> = 1,1×10<super>-5</super> °C<super>-1</super>. Determine a área inicial.",
    ["Para áreas, β ≈ 2α. Logo, ΔA<sub>dif</sub> = A0×2(α<sub>Cu</sub>-α<sub>aço</sub>)×ΔT.", "0,96 = A0×2×0,6×10<super>-5</super>×200 = A0×2,4×10<super>-3</super>.", "A0 = 0,96/(2,4×10<super>-3</super>) = 400 cm²."],
    "alternativa A: 400 cm².")
story += qblock(33, "Dilatação volumétrica de um bloco", "WA0055 - questão 03",
    "Um paralelepípedo de 10 cm × 20 cm × 30 cm, feito de material com α = 2,0×10<super>-5</super> °C<super>-1</super>, é aquecido de 30 °C para 110 °C. Calcule o aumento de volume.",
    ["V0 = 10×20×30 = 6 000 cm³. Para sólidos isotrópicos, γ ≈ 3α = 6,0×10<super>-5</super> °C<super>-1</super>.", "ΔT = 80 °C.", "ΔV = V0γΔT = 6 000×6,0×10<super>-5</super>×80 = 28,8 cm³."],
    "alternativa B: 28,8 cm³.")
story += qblock(34, "Comparação de coeficientes", "WA0055 - questão 04",
    "Uma tabela mostra fatores de dilatação de aço, cobre e alumínio sob as mesmas variações de temperatura. A 50 °C, os valores são 0,4; 0,5; 0,7 e, a 100 °C, 1,2; 1,4; 1,8. Ordene os coeficientes.",
    ["Para a mesma dimensão inicial e a mesma variação de temperatura, maior dilatação indica maior coeficiente α.", "Em ambas as linhas, aço dilata menos que cobre, e cobre menos que alumínio."],
    "alternativa B: α<sub>aço</sub> &lt; α<sub>cobre</sub> &lt; α<sub>alumínio</sub>.")

# Section 5
story += [PageBreak()] + section_banner("5", "Gases", NAVY, PALE_BLUE)
story += qblock(35, "Balão de hélio", "WA0063/WA0059 - questão 07 (duplicada)",
    "Um balão contém 2,0 L de hélio a 20 °C e 2,0 atm. Em outra altitude, a pressão é 0,5 atm e a temperatura 10 °C. Determine o novo volume.",
    ["T1 = 293 K e T2 = 283 K. Pela lei geral: P1V1/T1 = P2V2/T2.", "V2 = P1V1T2/(P2T1) = (2,0×2,0×283)/(0,5×293) = 7,73 L."],
    "aproximadamente 7,7 L.", note="Temperaturas em leis dos gases devem ser convertidas para kelvin.")
story += qblock(36, "Compressão isotérmica de CO<sub>2</sub>", "WA0063 - questão 08",
    "Um cilindro contém 100 mL de CO<sub>2</sub> a 1,0 atm. Mantendo a temperatura constante, o volume é reduzido para 25 mL. Qual a pressão final?",
    ["Em temperatura constante, P1V1 = P2V2.", "P2 = (1,0×100)/25 = 4,0 atm."],
    "alternativa B: 4,0 atm.")
story += qblock(37, "Expansão de hidrogênio", "WA0063 - questão 09",
    "Um gás hidrogênio ocupa 50 m³ sob pressão de 10 Pa. Na mesma temperatura, a pressão passa a 2 Pa. Determine o volume.",
    ["P1V1 = P2V2.", "V2 = 10×50/2 = 250 m³."],
    "alternativa A: 250 m³.")
story += qblock(38, "Gás ideal com mudança de V e T", "WA0059 - questão 08",
    "Um gás está a 27 °C, 15 atm e 100 L. O volume diminui para 20 L e a temperatura aumenta para 47 °C. Determine a pressão final.",
    ["T1 = 300 K e T2 = 320 K. Use P1V1/T1 = P2V2/T2.", "P2 = P1V1T2/(T1V2) = (15×100×320)/(300×20) = 80 atm."],
    "80 atm.")
story += qblock(39, "Pressão no pneu", "WA0059 - questão 09",
    "Um pneu é calibrado a 4 atm em um dia a 7 °C. Considerando volume e quantidade de gás constantes, qual a pressão a 37 °C?",
    ["T1 = 280 K e T2 = 310 K. Em volume constante, P1/T1 = P2/T2.", "P2 = 4×310/280 = 4,43 atm."],
    "alternativa B: aproximadamente 4,4 atm.")
story += qblock(40, "Equação de Clapeyron", "WA0071/WA0059 - questão 10 (duplicada)",
    "Cinco mols de O<sub>2</sub> estão a 27 °C e ocupam 16,4 L. Use R = 0,082 atm.L.mol<super>-1</super>.K<super>-1</super> para calcular a pressão.",
    ["T = 27 + 273 = 300 K. Pela equação PV = nRT:", "P = nRT/V = (5×0,082×300)/16,4 = 123/16,4 = 7,5 atm."],
    "alternativa D: 7,5 atm.")

# Part 2 - all solutions at the end
story += [PageBreak(), P("Parte 2 - Resoluções completas", h1)]
story += [P("As soluções seguem a mesma numeração da Parte 1. Nenhuma resposta foi colocada junto aos enunciados.", body), Spacer(1, 0.2 * cm)]
resolution_sections = {
    1: ("1", "Circuitos e instrumentos", BLUE, PALE_BLUE),
    11: ("2", "Lei de Ohm, resistência e corrente", TEAL, PALE_GREEN),
    19: ("3", "Potência, efeito Joule e consumo de energia", ORANGE, PALE_ORANGE),
    29: ("4", "Dilatação térmica dos sólidos", PURPLE, PALE_PURPLE),
    35: ("5", "Gases", NAVY, PALE_BLUE),
}
for item in solutions_bank:
    if item["n"] in resolution_sections:
        sec = resolution_sections[item["n"]]
        if item["n"] != 1:
            story.append(PageBreak())
        story += section_banner(*sec)
    story.append(solution_block(item))

# Final checklist
story += [PageBreak(), P("Gabarito rápido", h1)]
answers = [
    "01 B", "02 A", "03 C", "04 A", "05 20 Ω e 0,40 A", "06 4 Ω e 3 A", "07 B", "08 D", "09 D", "10 B",
    "11 D", "12 A", "13 B", "14 B", "15 E", "16 B", "17 C", "18 C", "19 E", "20 D",
    "21 A", "22 B", "23 B", "24 E", "25 125,4 kWh; R$ 100,32", "26 R$ 2,40", "27 105,39 kWh; R$ 84,31", "28 D",
    "29 D", "30 B", "31 D", "32 A", "33 B", "34 B", "35 7,7 L", "36 B", "37 A", "38 80 atm", "39 B", "40 D",
]
cols = 4
rows = []
for i in range(0, len(answers), cols):
    rows.append([P(x, body) for x in answers[i:i+cols]])
gt = Table(rows, colWidths=[(PAGE_W - 2 * MARGIN_X) / cols] * cols)
gt.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("GRID", (0, 0), (-1, -1), 0.5, MID),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
]))
story += [gt, Spacer(1, 0.5 * cm)]
story += [P("Observações finais", h2), P("As questões foram reconstruídas a partir das fotografias, preservando os dados relevantes. Quando a mesma questão apareceu em mais de uma foto, ela foi apresentada uma única vez. Os resultados foram calculados do zero e podem divergir de anotações manuscritas presentes nas imagens.", body)]

doc = NumberedDocTemplate(
    str(OUT), pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
    topMargin=MARGIN_TOP, bottomMargin=MARGIN_BOTTOM,
    title="Resoluções de Física - Eletricidade, Gases e Dilatação",
    author="Codex",
    subject="Resoluções comentadas de questões de Física",
)
doc.build(story)
print(OUT)
