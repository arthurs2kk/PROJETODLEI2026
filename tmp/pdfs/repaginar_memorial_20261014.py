from pathlib import Path
from xml.sax.saxutils import escape
from io import BytesIO
import json, re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import ImageReader
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT=Path(r'C:\PROJETODLEI2026')
TMP=ROOT/'tmp/pdfs/repaginacao'
OUT=ROOT/'output/pdf'
FINAL=OUT/'Memorial_Descritivo_Pro_Povo_Design_Moderno_2026-10-14.pdf'
DATA=json.loads((TMP/'conteudo.json').read_text(encoding='utf-8'))
for name,file in [('PP','segoeui.ttf'),('PPBold','segoeuib.ttf'),('PPSemi','seguisb.ttf'),('PPItalic','segoeuii.ttf')]:
    path=Path(r'C:\Windows\Fonts')/file
    if not path.exists():path=Path(r'C:\Windows\Fonts\segoeuib.ttf')
    pdfmetrics.registerFont(TTFont(name,str(path)))
pdfmetrics.registerFontFamily('PP',normal='PP',bold='PPBold',italic='PPItalic',boldItalic='PPBold')
W,H=A4
M=46
WIDTH=W-2*M
BLUE=HexColor('#1351B4')
NAVY=HexColor('#0C326F')
PALE=HexColor('#D4E5FF')
GREEN=HexColor('#168821')
LIGHTGREEN=HexColor('#D4EDDA')
YELLOW=HexColor('#FFCD07')
YELLOWTEXT=HexColor('#6B4F00')
INK=HexColor('#333333')
GRAY=HexColor('#6a7483')
BG=HexColor('#F8F8F8')
LINE=HexColor('#DBE3EF')
ORANGE=HexColor('#C45C00')
MINY=66
c=canvas.Canvas(str(FINAL),pagesize=A4)
c.setTitle('Pro Povo Memorial Descritivo Completo')
c.setAuthor('Equipe Pro Povo')
c.setSubject('Protótipo funcional, validações e estratégia de piloto em Campina Grande')
PAGE=0
y=0
scale=1
audit=[]

def styles(s=1):
    return {
      'body':ParagraphStyle('body',fontName='PP',fontSize=10.25*s,leading=14.25*s,textColor=INK),
      'small':ParagraphStyle('small',fontName='PP',fontSize=8.7*s,leading=11.9*s,textColor=GRAY),
      'quote':ParagraphStyle('quote',fontName='PPItalic',fontSize=10.65*s,leading=15.15*s,textColor=NAVY),
      'heading':ParagraphStyle('heading',fontName='PPBold',fontSize=14.7*s,leading=18*s,textColor=NAVY),
      'sub':ParagraphStyle('sub',fontName='PPSemi',fontSize=11.5*s,leading=15*s,textColor=BLUE),
      'cell':ParagraphStyle('cell',fontName='PP',fontSize=9.05*s,leading=12.1*s,textColor=INK),
      'headcell':ParagraphStyle('headcell',fontName='PPSemi',fontSize=9.2*s,leading=12.5*s,textColor=NAVY),
      'title':ParagraphStyle('title',fontName='PPBold',fontSize=26,leading=29,textColor=NAVY),
    }

def text(t,x,top,w,kind='body',s=None,draw=True):
    p=Paragraph(t,styles(scale if s is None else s)[kind])
    _,ph=p.wrap(w,2000)
    if draw:p.drawOn(c,x,top-ph)
    return ph

def box(x,bottom,w,h,color=BG,r=12):
    c.setFillColor(color);c.roundRect(x,bottom,w,h,r,fill=1,stroke=0)

def pin(x,cy,r,color=YELLOW):
    c.setStrokeColor(color);c.setLineWidth(1.5)
    c.circle(x,cy,r,fill=0,stroke=1)
    p=c.beginPath();p.moveTo(x-r*.75,cy-r*.7);p.lineTo(x,cy-r*1.7);p.lineTo(x+r*.75,cy-r*.7);c.drawPath(p)
    c.setFillColor(color);c.circle(x,cy,r*.22,fill=1,stroke=0)

def footer():
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,43,W-M,43)
    c.setFont('PP',8);c.setFillColor(GRAY);c.drawString(M,26,'PRO POVO  /  10º DLEI 2026')
    c.drawCentredString(W/2,26,'Revisão de 14 outubro 2026')
    box(W-M-25,16,25,25,PALE,7)
    c.setFont('PPBold',9);c.setFillColor(NAVY);c.drawCentredString(W-M-12.5,24,f'{PAGE:02d}')

def begin(title,kicker,key):
    global PAGE,y
    PAGE+=1
    c.setFillColor(white);c.rect(0,0,W,H,fill=1,stroke=0)
    c.bookmarkPage(key);c.addOutlineEntry(title,key,0,False)
    c.setFillColor(BLUE);c.setFont('PPBold',12);c.drawString(M,H-40,'PRO POVO')
    c.setFillColor(GRAY);c.setFont('PP',8.3);c.drawRightString(W-M,H-40,'MEMORIAL DESCRITIVO COMPLETO')
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.line(M,H-56,W-M,H-56)
    c.setFillColor(BLUE);c.setFont('PPSemi',8.2);c.drawString(M,H-79,kicker.upper())
    c.setFillColor(YELLOW);c.roundRect(W-M-31,H-93,31,24,6,fill=1,stroke=0)
    c.setFillColor(NAVY);c.setFont('PPBold',9);c.drawCentredString(W-M-15.5,H-85,f'{PAGE:02d}')
    ph=text(escape(title),M,H-95,WIDTH,'title',s=1)
    y=H-95-ph-15
    footer()

def make_table(block,s=1):
    headers,rows,raw=block['args']
    widths=[v/sum(raw)*WIDTH for v in raw]
    st=styles(s)
    cell=[[Paragraph(escape(str(v)),st['headcell']) for v in headers]]
    cell += [[Paragraph(escape(str(v)),st['cell']) for v in row] for row in rows]
    t=Table(cell,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),PALE),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[BG,white]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),9*s),('RIGHTPADDING',(0,0),(-1,-1),9*s),
        ('TOPPADDING',(0,0),(-1,-1),7*s),('BOTTOMPADDING',(0,0),(-1,-1),7*s),
        ('LINEBELOW',(0,0),(-1,0),1,white),
        ('LINEBELOW',(0,1),(-1,-1),.4,LINE),
    ]))
    return t,t.wrap(WIDTH,2000)[1]

def chart_height():return 118

def draw_chart(top):
    box(M,top-118,WIDTH,118,BG)
    c.setFont('PPSemi',8.6);c.setFillColor(GRAY);c.drawString(M+14,top-17,'CONCLUSÃO DAS TAREFAS  /  23 PARTICIPANTES')
    rows=[('Sem dificuldades',18,'78,3%',BLUE),('Ajuda pontual',3,'13,0%',YELLOW),('Assistência ampla',2,'8,7%',ORANGE)]
    maxw=180
    for i,(label,n,pct,col) in enumerate(rows):
        py=top-38-i*27
        c.setFont('PP',9.2);c.setFillColor(INK);c.drawString(M+14,py,label)
        c.setFillColor(LINE);c.roundRect(M+172,py-1,maxw,7,3,fill=1,stroke=0)
        c.setFillColor(col);c.roundRect(M+172,py-1,maxw*n/23,7,3,fill=1,stroke=0)
        c.setFont('PPSemi',9);c.setFillColor(NAVY);c.drawRightString(W-M-14,py,f'{n} de 23  |  {pct}')

def metrics(top,items,height=67):
    gap=10
    cw=(WIDTH-gap*(len(items)-1))/len(items)
    for i,(number,label,col) in enumerate(items):
        x=M+i*(cw+gap)
        box(x,top-height,cw,height,BG)
        c.setFillColor(col);c.setFont('PPBold',25);c.drawString(x+13,top-32,number)
        text(escape(label),x+13,top-41,cw-26,'small',s=1)

def bh(block,s=1,special=False):
    typ=block['type'];args=block['args']
    if typ=='table':
        if special and args[0]==['Experiência nas tarefas','Participantes','Percentual']:return chart_height()+12*s
        return make_table(block,s)[1]+12*s
    if typ=='heading':return text(escape(args[0]),M,0,WIDTH,'heading',s=s,draw=False)+19*s
    if typ=='sub':return text(escape(args[0]),M,0,WIDTH,'sub',s=s,draw=False)+9*s
    if typ=='bullet':return text(escape(args[0]),M+13,0,WIDTH-13,'body',s=s,draw=False)+5*s
    kind=args[1] if len(args)>1 else 'body'
    if kind=='quote':return text(args[0],M+19,0,WIDTH-38,kind,s=s,draw=False)+29*s
    return text(args[0],M,0,WIDTH,kind,s=s,draw=False)+8*s

def render_block(block,special=False):
    global y
    typ=block['type'];args=block['args'];s=scale
    if typ=='table':
        if special and args[0]==['Experiência nas tarefas','Participantes','Percentual']:
            draw_chart(y);y-=chart_height()+12*s
        else:
            t,ph=make_table(block,s);t.drawOn(c,M,y-ph);y-=ph+12*s
    elif typ=='heading':
        y-=8*s
        ph=text(escape(args[0]),M,y,WIDTH,'heading');y-=ph+11*s
    elif typ=='sub':
        ph=text(escape(args[0]),M,y,WIDTH,'sub');y-=ph+9*s
    elif typ=='bullet':
        c.setFillColor(BLUE);c.circle(M+3,y-6*s,2.2*s,fill=1,stroke=0)
        ph=text(escape(args[0]),M+13,y,WIDTH-13);y-=ph+5*s
    else:
        kind=args[1] if len(args)>1 else 'body'
        if kind=='quote':
            ph=text(args[0],M+19,y-13*s,WIDTH-38,kind,draw=False)
            box(M,y-ph-25*s,WIDTH,ph+25*s,HexColor('#F0F5FD'),12)
            c.setFillColor(BLUE);c.roundRect(M,y-ph-25*s,3,ph+25*s,1.5,fill=1,stroke=0)
            text(args[0],M+19,y-13*s,WIDTH-38,kind);y-=ph+29*s
        else:
            ph=text(args[0],M,y,WIDTH,kind);y-=ph+8*s

def flow_page(title,kicker,key,blocks,omit_first=True,special=False,kpi=None):
    global scale,y
    begin(title,kicker,key)
    content=list(blocks)
    if omit_first and content and content[0]['type']=='heading':content=content[1:]
    initial=y
    extra=79 if kpi else 0
    for candidate in [1,.99,.98,.97,.96,.95,.94,.93]:
        total=sum(bh(b,candidate,special) for b in content)+extra
        if initial-total>=MINY:
            scale=candidate;break
    else:raise RuntimeError(f'Page {PAGE} too dense: {title}; needs {total}, available {initial-MINY}')
    if kpi:
        metrics(y,kpi);y-=79
    for b in content:render_block(b,special)
    if y<MINY-1:raise RuntimeError(f'Overflow page {PAGE}: y={y}')
    audit.append({'page':PAGE,'title':title,'body_size':round(10.25*scale,2),'bottom':round(y,1)})
    c.showPage()

def image_frame(file,x,bottom,w,h,contain=True,anchor_top=False):
    box(x-1,bottom-1,w+2,h+2,LINE,11)
    c.saveState()
    p=c.beginPath();p.roundRect(x,bottom,w,h,10);c.clipPath(p,stroke=0)
    im=Image.open(file)
    ratio=min(w/im.width,h/im.height) if contain else max(w/im.width,h/im.height)
    dw,dh=im.width*ratio,im.height*ratio
    c.setFillColor(white);c.rect(x,bottom,w,h,fill=1,stroke=0)
    iy=bottom+h-dh if anchor_top else bottom+(h-dh)/2
    c.drawImage(ImageReader(im),x+(w-dw)/2,iy,dw,dh,mask='auto')
    c.restoreState()

# Cover: use real prototype imagery and the site's existing identity.
PAGE=1
c.bookmarkPage('capa');c.addOutlineEntry('Capa','capa',0,False)
c.setFillColor(NAVY);c.rect(0,0,W,H,fill=1,stroke=0)
c.setFillColor(BLUE)
p=c.beginPath();p.moveTo(W,0);p.lineTo(W,H);p.lineTo(W*.63,H);p.lineTo(W*.9,0);c.drawPath(p,fill=1,stroke=0)
for i in range(5):
    c.setStrokeColor(HexColor('#2865BB'));c.setLineWidth(.7)
    yy=H-100-i*34
    p=c.beginPath();p.moveTo(W-190,yy);p.lineTo(W-128,yy);p.lineTo(W-90,yy-25);p.lineTo(W,yy-25);c.drawPath(p)
logo=Image.open(ROOT/'Images/LogoProPovo.png').convert('RGBA')
bbox=logo.getchannel('A').getbbox()
logo=logo.crop(bbox)
box(M,H-109,116,69,white,12)
lw=95;lh=lw*logo.height/logo.width
c.drawImage(ImageReader(logo),M+10,H-99+(48-lh)/2,lw,lh,mask='auto')
c.setFillColor(YELLOW);c.setFont('PPSemi',9);c.drawRightString(W-M,H-56,'10º DLEI 2026')
c.setFillColor(PALE);c.setFont('PP',9);c.drawRightString(W-M,H-74,'Documentação do protótipo')
title=Paragraph('Memorial<br/>descritivo completo',ParagraphStyle('cover',fontName='PPBold',fontSize=35,leading=39,textColor=white))
_,th=title.wrap(WIDTH,200);title.drawOn(c,M,H-146-th)
c.setFillColor(PALE);c.setFont('PP',13);c.drawString(M,H-244,'Pro Povo  /  Participação cidadã e gestão urbana')
image_frame(TMP/'interface-1.png',M,255,WIDTH,WIDTH*1350/2160)
c.setFillColor(PALE);c.setFont('PP',8);c.drawString(M,240,'Interface do protótipo funcional')
pin(M+9,194,7,YELLOW)
c.setFillColor(white);c.setFont('PPSemi',12);c.drawString(M+30,197,'Primeiro piloto proposto')
c.setFont('PP',11);c.drawString(M+30,178,'Campina Grande  /  Paraíba')
c.setFillColor(PALE);c.setFont('PP',9.5);c.drawString(M,132,'Instituição de impacto social')
text('Pastoral de Acesso à Justiça e Direitos Humanos',M,120,WIDTH,'body',s=1,draw=False)
p=Paragraph('Pastoral de Acesso à Justiça e Direitos Humanos',ParagraphStyle('covermeta',fontName='PP',fontSize=10.5,leading=14,textColor=white))
_,ph=p.wrap(WIDTH,100);p.drawOn(c,M,120-ph)
c.setFillColor(YELLOW);c.rect(M,66,42,4,fill=1,stroke=0)
c.setFont('PP',9);c.setFillColor(PALE);c.drawString(M,46,'Equipe PRO POVO  /  Revisão de 14 de outubro de 2026')
c.showPage()

# Navigation with actual page numbers and clickable links.
CHAPTERS=[
('Visão geral',3,'visao'),('Público e proposta de valor',4,'publico'),
('Funcionamento e encaminhamento',5,'funcionamento'),('Interfaces do protótipo',6,'interfaces'),
('Estrutura digital e segurança',7,'tecnologias'),('Testes com usuários',8,'usuarios'),
('Verificações técnicas',9,'tecnicas'),('Avaliação da proposta',10,'avaliacao'),
('Depoimentos de profissionais',11,'depoimentos'),('Piloto e divulgação',12,'piloto'),
('Impactos e viabilidade',13,'impactos'),('Limitações e próximos passos',14,'proximos'),
('Equipe e conclusão',15,'equipe'),
]
scale=1
begin('Guia de leitura','Conteúdo e estágio do projeto','sumario')
text('Este memorial apresenta o funcionamento do Pro Povo, as evidências reunidas pela equipe e o caminho proposto para a implantação institucional.',M,y,WIDTH,'body')
y-=55
for i,(label,num,key) in enumerate(CHAPTERS):
    col=0 if i<7 else 1;row=i if i<7 else i-7
    cw=(WIDTH-24)/2;x=M+col*(cw+24);top=y-row*48
    c.setFont('PPBold',11);c.setFillColor(BLUE);c.drawString(x,top-14,f'{num:02d}')
    ph=text(escape(label),x+31,top-2,cw-31,'sub',s=1)
    c.setStrokeColor(LINE);c.setLineWidth(.4);c.line(x,top-39,x+cw,top-39)
    c.linkRect('',key,(x,top-38,x+cw,top+3),relative=0,thickness=0)
metrics(270,[('23','Participantes nos testes',BLUE),('91,3%','Aprovação entre os 23',GREEN),('44','Testes técnicos aprovados',BLUE)])
box(M,92,WIDTH,86,HexColor('#FFF8D5'))
text('<b>Estágio atual</b><br/>Protótipo funcional com testes de utilização e avaliações qualitativas. O piloto institucional em Campina Grande é a próxima etapa proposta.',M+16,161,WIDTH-32,'body',s=1)
c.showPage()

flow_page('Visão geral','Problema e objetivos','visao',DATA[1],omit_first=False)
flow_page('Público e proposta de valor','Usuários e modelo de negócio','publico',DATA[2],omit_first=False)
flow_page('Funcionamento e encaminhamento','Jornada de uso','funcionamento',DATA[3],omit_first=False)

scale=1
begin('Interfaces do protótipo','Produto em funcionamento','interfaces')
text('Capturas reais da plataforma mostram o portal do cidadão e a organização geográfica dos relatos. A interface já oferece registro, consulta e acompanhamento; a implantação municipal permanece em preparação.',M,y,WIDTH,'body')
y-=68
screen_h=228
image_frame(TMP/'interface-1.png',M,y-screen_h,WIDTH,screen_h,contain=False,anchor_top=True)
y-=screen_h+12
text('<b>Portal do cidadão</b>  /  Registro, participação e acompanhamento',M,y,WIDTH,'small');y-=26
map_h=WIDTH*991/1903
image_frame(TMP/'interface-0.png',M,y-map_h,WIDTH,map_h)
y-=map_h+10
text('<b>Mapa de ocorrências</b>  /  Localização e consulta por categoria',M,y,WIDTH,'small')
if y-24<MINY:raise RuntimeError(f'Gallery overflow: {y}')
c.showPage()

def record(typ,*args):return {'type':typ,'args':list(args),'kwargs':{}}
tech=[record('heading','Estrutura digital e tecnologias'),record('table',['Componente','Tecnologia','Finalidade'],[
('Interface','HTML CSS JavaScript','Estrutura, aparência, responsividade e interação com o usuário.'),
('Autenticação','Firebase Authentication','Cadastro, login e verificação de identidade dos usuários.'),
('Dados','Firebase Realtime Database','Armazenamento e sincronização dos relatos, votos, usuários e respostas.'),
('Imagens','Cloudinary','Envio, armazenamento e otimização das fotografias anexadas.'),
('Mapa','Leaflet e OpenStreetMap','Visualização geográfica das ocorrências.'),
('Geocodificação','Nominatim','Conversão de endereços selecionados em coordenadas.'),
('Municípios','API do IBGE','Identificação padronizada das cidades e apoio aos indicadores.'),
('Indicadores','Chart.js','Geração de gráficos para o painel administrativo.'),
],[105,135,248]),record('heading','Arquitetura e fluxo de dados'),
record('add','O navegador executa a interface e se comunica com serviços externos especializados. A autenticação identifica o usuário. Quando um relato é enviado, a fotografia é encaminhada ao serviço de imagens e os dados são gravados no banco em tempo real. As regras do banco verificam permissões, campos obrigatórios, integridade dos votos, intervalo mínimo entre envios e limites de atuação dos administradores. Os usuários conectados recebem as atualizações e a interface exibe o novo estado sem depender de recarregamento manual.'),
record('heading','Segurança privacidade e uso responsável'),
record('bullet','Ações administrativas são limitadas a contas autorizadas e vinculadas ao município correspondente.'),
record('bullet','Campos recebidos são tratados antes da exibição para reduzir o risco de inserção de código malicioso.'),
record('bullet','O sistema limita envios em sequência e controla votos para reduzir spam e manipulação.')]
flow_page('Estrutura digital e segurança','Tecnologias e proteção','tecnologias',tech,omit_first=False)
flow_page('Testes com usuários','Usabilidade e aprendizado','usuarios',DATA[5],omit_first=True,special=True)
flow_page('Verificações técnicas','Evolução do protótipo','tecnicas',DATA[6],kpi=[('44','Testes executados',BLUE),('44','Resultados aprovados',GREEN),('0','Falhas nesta rodada',GREEN)])
flow_page('Avaliação da proposta','Validação qualitativa','avaliacao',DATA[7])
flow_page('Depoimentos de profissionais','Perspectivas sobre o projeto','depoimentos',DATA[8])
flow_page('Piloto e divulgação','Campina Grande e expansão','piloto',DATA[9])
flow_page('Impactos e viabilidade','Resultados esperados','impactos',DATA[10])
flow_page('Limitações e próximos passos','Plano de continuidade','proximos',DATA[11])
flow_page('Equipe e conclusão','Responsáveis pelo projeto','equipe',DATA[12],omit_first=False)
c.save()
pdf=pdfium.PdfDocument(FINAL)
for i in range(len(pdf)):
    pdf[i].render(scale=1.7).to_pil().save(TMP/f'page-{i+1:03d}.png')
(TMP/'layout-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print(FINAL)
print(json.dumps({'pages':len(pdf),'layout':audit},ensure_ascii=False))
