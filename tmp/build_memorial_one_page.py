from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(r"C:\PROJETODLEI2026")
OUT = ROOT / "output" / "pdf" / "Memorial_Descritivo_Simplificado_Pro_Povo_Uma_Pagina.pdf"
LOGO = ROOT / "Images" / "LogoProPovo.png"

NAVY = colors.HexColor("#123B75")
BLUE = colors.HexColor("#1E5BB8")
LIGHT = colors.HexColor("#EAF2FD")
PALE = colors.HexColor("#F5F8FC")
YELLOW = colors.HexColor("#FFC800")
TEXT = colors.HexColor("#202A36")
MUTED = colors.HexColor("#526170")
LINE = colors.HexColor("#CFD9E6")
WHITE = colors.white


def register_fonts():
    regular = Path(r"C:\Windows\Fonts\arial.ttf")
    bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("AppRegular", str(regular)))
        pdfmetrics.registerFont(TTFont("AppBold", str(bold)))
        return "AppRegular", "AppBold"
    return "Helvetica", "Helvetica-Bold"


REGULAR, BOLD = register_fonts()


def pstyle(size=7.25, leading=9.1, color=TEXT, bold=False, align=TA_LEFT):
    return ParagraphStyle(
        "body",
        fontName=BOLD if bold else REGULAR,
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=align,
        spaceAfter=0,
        spaceBefore=0,
    )


def draw_paragraph(c, text, x, y_top, width, style):
    p = Paragraph(text, style)
    _, h = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - h)
    return h


def section_title(c, title, x, y, width, number=None):
    if number:
        c.setFillColor(BLUE)
        c.circle(x + 7, y - 7, 7, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont(BOLD, 7)
        c.drawCentredString(x + 7, y - 9.4, str(number))
        tx = x + 18
    else:
        tx = x
    c.setFillColor(NAVY)
    c.setFont(BOLD, 9.3)
    c.drawString(tx, y - 10, title)
    c.setStrokeColor(YELLOW)
    c.setLineWidth(2)
    c.line(tx, y - 14, x + width, y - 14)
    return y - 20


def card(c, x, y_top, width, height, fill=WHITE):
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.roundRect(x, y_top - height, width, height, 5, fill=1, stroke=1)


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = landscape(A4)
    c = canvas.Canvas(str(OUT), pagesize=(width, height))
    c.setTitle("Memorial Descritivo Simplificado - Pro Povo - Uma Página")
    c.setAuthor("Equipe PRO POVO")

    # Header
    c.setFillColor(NAVY)
    c.rect(0, height - 66, width, 66, fill=1, stroke=0)
    c.setFillColor(BLUE)
    c.rect(0, height - 66, 250, 66, fill=1, stroke=0)
    c.setFillColor(YELLOW)
    c.rect(0, height - 70, width, 4, fill=1, stroke=0)
    if LOGO.exists():
        logo = ImageReader(str(LOGO))
        c.drawImage(logo, 28, height - 57, width=40, height=40, preserveAspectRatio=True, mask="auto")
    c.setFillColor(WHITE)
    c.setFont(BOLD, 18)
    c.drawString(78, height - 31, "Memorial Descritivo Simplificado")
    c.setFont(REGULAR, 8.8)
    c.drawString(79, height - 48, "Protótipo digital Pro Povo | 10ª edição do DLEI 2026")
    c.setFont(BOLD, 8.5)
    c.drawRightString(width - 28, height - 28, "PRO POVO")
    c.setFont(REGULAR, 7.4)
    c.drawRightString(width - 28, height - 43, "Participação cidadã e transparência pública")

    # Identification strip
    top = height - 82
    margin = 28
    content_w = width - 2 * margin
    c.setFillColor(LIGHT)
    c.roundRect(margin, top - 35, content_w, 35, 5, fill=1, stroke=0)
    id_data = [
        ["PROJETO", "Pro Povo", "INSTITUIÇÃO ATENDIDA", "Pastoral de Acesso à Justiça e Direitos Humanos", "NATUREZA", "Plataforma digital"],
    ]
    id_table = Table(id_data, colWidths=[43, 73, 90, 248, 54, 90], rowHeights=[27])
    id_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), REGULAR),
        ("FONTSIZE", (0, 0), (-1, -1), 6.7),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
        ("FONTNAME", (0, 0), (0, 0), BOLD),
        ("FONTNAME", (2, 0), (2, 0), BOLD),
        ("FONTNAME", (4, 0), (4, 0), BOLD),
        ("TEXTCOLOR", (0, 0), (0, 0), NAVY),
        ("TEXTCOLOR", (2, 0), (2, 0), NAVY),
        ("TEXTCOLOR", (4, 0), (4, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    id_table.wrapOn(c, content_w, 30)
    id_table.drawOn(c, margin + 4, top - 31)

    y_start = top - 46
    gap = 12
    left_w = 480
    right_w = content_w - left_w - gap
    left_x = margin
    right_x = left_x + left_w + gap

    # Left column: problem and solution
    card(c, left_x, y_start, left_w, 107, WHITE)
    y = section_title(c, "Problema e objetivo", left_x + 12, y_start - 8, left_w - 24, 1)
    problem = (
        "A população ainda enfrenta <b>falta de um canal único, acessível e transparente</b> para comunicar problemas urbanos "
        "aos órgãos públicos responsáveis. Relatos sobre buracos, iluminação, lixo, água, esgoto e áreas verdes ficam "
        "dispersos, dificultando a organização, a definição de prioridades, o acompanhamento das demandas e a visualização "
        "das respostas. O Pro Povo centraliza essas informações, aproxima cidadãos e gestores e torna o atendimento mais rastreável."
    )
    draw_paragraph(c, problem, left_x + 12, y, left_w - 24, pstyle(7.3, 9.2))

    y2 = y_start - 115
    card(c, left_x, y2, left_w, 146, PALE)
    y = section_title(c, "Como o protótipo funciona", left_x + 12, y2 - 8, left_w - 24, 2)
    bullets = [
        "O cidadão cria uma conta e registra a ocorrência com título, descrição, categoria, endereço e foto opcional.",
        "O relato aparece na plataforma e no mapa, com filtros por cidade, bairro, categoria e situação.",
        "A comunidade apoia as demandas mais urgentes por votação.",
        "Gestores acessam um painel para analisar relatos, atualizar o andamento e publicar respostas oficiais.",
        "Indicadores ajudam a identificar áreas críticas, problemas recorrentes e evolução das demandas.",
    ]
    bullet_text = "<br/>".join([f'<font color="#1E5BB8"><b>•</b></font>&nbsp; {b}' for b in bullets])
    draw_paragraph(c, bullet_text, left_x + 14, y, left_w - 28, pstyle(7.1, 10.0))

    y3 = y2 - 154
    card(c, left_x, y3, left_w, 102, WHITE)
    y = section_title(c, "Tecnologia, validação e sustentabilidade", left_x + 12, y3 - 8, left_w - 24, 3)
    tech = (
        "O site responsivo utiliza HTML, CSS e JavaScript, Firebase, Cloudinary, Leaflet/OpenStreetMap, API do IBGE e Chart.js. "
        "Os principais fluxos já foram verificados internamente; a próxima etapa é testar com cidadãos, representantes da Pastoral "
        "e possíveis usuários municipais. O acesso do cidadão será gratuito, enquanto prefeituras, órgãos públicos, gabinetes e "
        "empresas poderão contratar planos mensais conforme a região atendida e os recursos utilizados."
    )
    draw_paragraph(c, tech, left_x + 12, y, left_w - 24, pstyle(7.05, 9.0))

    # Right column: impact / next steps / team
    card(c, right_x, y_start, right_w, 107, LIGHT)
    y = section_title(c, "Impacto e ODS", right_x + 12, y_start - 8, right_w - 24, 4)
    impact = (
        "A solução busca ampliar a participação cidadã, dar visibilidade a problemas que afetam direitos básicos e apoiar "
        "decisões públicas baseadas em dados. Também fortalece a transparência ao permitir que a população acompanhe o "
        "andamento das solicitações e as respostas dos responsáveis.<br/><br/><b>ODS 11:</b> Cidades e Comunidades Sustentáveis &nbsp; "
        "<b>ODS 16:</b> Paz, Justiça e Instituições Eficazes."
    )
    draw_paragraph(c, impact, right_x + 12, y, right_w - 24, pstyle(7.15, 9.0))

    y2r = y_start - 115
    card(c, right_x, y2r, right_w, 72, WHITE)
    y = section_title(c, "Próximos passos", right_x + 12, y2r - 8, right_w - 24, 5)
    next_steps = (
        "Otimizar desempenho e experiência de uso; realizar testes com usuários reais; corrigir pontos identificados; "
        "fortalecer marketing e divulgação; formalizar parcerias; e preparar uma implantação piloto com uma prefeitura ou instituição."
    )
    draw_paragraph(c, next_steps, right_x + 12, y, right_w - 24, pstyle(7.0, 8.8))

    y3r = y2r - 80
    team_h = 188
    card(c, right_x, y3r, right_w, team_h, PALE)
    y = section_title(c, "Equipe responsável", right_x + 12, y3r - 8, right_w - 24, 6)
    team_data = [
        [Paragraph("<b>Integrante</b>", pstyle(6.3, 7, WHITE, True)), Paragraph("<b>Atuação principal</b>", pstyle(6.3, 7, WHITE, True))],
        ["Antonio Mendonça", "Liderança, apresentação e gestão geral"],
        ["Arthur Palmeira", "Vice-liderança e desenvolvimento do site"],
        ["Diogo Andrade", "Redes sociais, divulgação e marketing"],
        ["Miguel Barros", "Redes sociais e articulação institucional"],
        ["Victor Montenegro", "Documentação, opiniões e ideias"],
        ["Aquiles Souto", "Documentação, ideação e apoio técnico"],
        ["Eduardo Marques", "Produção, documentos e sugestões"],
        ["Adriano Ribeiro", "Professor orientador"],
    ]
    table = Table(team_data, colWidths=[83, right_w - 107], rowHeights=[17] + [17] * 8)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 1), (-1, -1), REGULAR),
        ("FONTSIZE", (0, 1), (-1, -1), 5.75),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
        ("FONTNAME", (0, 1), (0, -1), BOLD),
        ("BACKGROUND", (0, 2), (-1, 2), WHITE),
        ("BACKGROUND", (0, 4), (-1, 4), WHITE),
        ("BACKGROUND", (0, 6), (-1, 6), WHITE),
        ("BACKGROUND", (0, 8), (-1, 8), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    table.wrapOn(c, right_w - 24, team_h)
    table.drawOn(c, right_x + 12, y3r - team_h + 10)

    # Footer
    c.setFillColor(NAVY)
    c.rect(0, 0, width, 18, fill=1, stroke=0)
    c.setFillColor(YELLOW)
    c.rect(0, 18, width, 2, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(REGULAR, 6.5)
    c.drawString(margin, 6.5, "PRO POVO  |  Memorial do protótipo  |  DLEI 2026")
    c.drawRightString(width - margin, 6.5, "Documento simplificado em página única")

    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    build()
