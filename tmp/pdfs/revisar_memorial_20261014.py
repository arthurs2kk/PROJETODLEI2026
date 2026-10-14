from pathlib import Path
from io import BytesIO
from xml.sax.saxutils import escape
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium

ROOT = Path(r'C:\PROJETODLEI2026')
TMP = ROOT / 'tmp/pdfs/memorial-20261014'
OUT = ROOT / 'output/pdf'
TMP.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = Path(r'C:\Users\arthu\Downloads\Memorial_Descritivo_Completo_Pro_Povo.pdf')
FINAL = OUT / 'Memorial_Descritivo_Completo_Pro_Povo_Revisado_2026-10-14.pdf'
W,H = 612,792
M = 62
WIDTH = W-2*M
BLUE = HexColor('#1351b4')
NAVY = HexColor('#0c326f')
YELLOW = HexColor('#ffd331')
GRAY = HexColor('#606060')
LIGHT = HexColor('#edf3fb')
STYLES = {
    'body': ParagraphStyle('body',fontName='Helvetica',fontSize=10.2,leading=14.2,spaceAfter=8),
    'quote': ParagraphStyle('quote',fontName='Helvetica-Oblique',fontSize=10.2,leading=14.2,leftIndent=12,rightIndent=12),
    'small': ParagraphStyle('small',fontName='Helvetica',fontSize=8.7,leading=11.8),
    'cell': ParagraphStyle('cell',fontName='Helvetica',fontSize=9,leading=12.2),
    'headcell': ParagraphStyle('headcell',fontName='Helvetica-Bold',fontSize=9,leading=12.2,textColor=white),
    'heading': ParagraphStyle('heading',fontName='Helvetica-Bold',fontSize=14,leading=17,textColor=NAVY),
    'sub': ParagraphStyle('sub',fontName='Helvetica-Bold',fontSize=11.5,leading=14,textColor=BLUE),
}
c=canvas.Canvas(str(TMP/'composicao.pdf'),pagesize=(W,H))
c.setTitle('Pro Povo Memorial Descritivo Completo Revisado em 14 de outubro de 2026')
c.setAuthor('Equipe Pro Povo')
y=0
page_no=0
page_usage=[]

def start():
    global y,page_no
    page_no+=1
    c.setFillColor(NAVY); c.rect(0,H-32,W,32,fill=1,stroke=0)
    c.setFillColor(BLUE); c.rect(0,H-32,220,32,fill=1,stroke=0)
    c.setFillColor(YELLOW); c.rect(0,H-35,W,3,fill=1,stroke=0)
    c.setFillColor(white); c.setFont('Helvetica-Bold',8.5); c.drawString(56,H-21,'PRO POVO')
    c.setFont('Helvetica',8); c.drawRightString(W-56,H-21,'Memorial do protótipo')
    c.setFillColor(GRAY); c.setFont('Helvetica',8)
    c.drawCentredString(W/2,24,f'PRO POVO  |  DLEI 2026  |  Página {page_no}')
    y=H-65

def add(text,kind='body',after=8):
    global y
    p=Paragraph(text,STYLES[kind])
    pw,ph=p.wrap(WIDTH,1000)
    if y-ph<52: raise RuntimeError(f'Overflow page {page_no}: {text[:90]} at y={y}, height={ph}')
    p.drawOn(c,M,y-ph); y-=ph+after

def heading(text):
    global y
    if y<H-68:y-=5
    add(escape(text),'heading',8)

def sub(text): add(escape(text),'sub',6)

def bullet(text): add('<font color="#1351b4">-</font> '+escape(text),'body',4)

def table(headers,rows,widths):
    global y
    cells=[[Paragraph(escape(s),STYLES['headcell']) for s in headers]]
    cells += [[Paragraph(escape(str(s)),STYLES['cell']) for s in row] for row in rows]
    t=Table(cells,colWidths=widths,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),BLUE),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT,white]),
        ('LINEBELOW',(0,0),(-1,0),0.4,BLUE),
        ('LINEBELOW',(0,1),(-1,-1),0.35,HexColor('#d6e1f1')),
    ]))
    tw,th=t.wrap(WIDTH,1000)
    if y-th<52: raise RuntimeError(f'Table overflow page {page_no}: height={th}, y={y}')
    t.drawOn(c,M,y-th); y-=th+10

def end():
    page_usage.append({'page':page_no,'remaining_y':round(y,1)})
    c.showPage()

# Preserve the existing cover and the page containing interface screenshots.
start();end()

start()
heading('Resumo executivo')
add('O Pro Povo é uma plataforma digital de participação cidadã que reúne relatos de problemas urbanos em uma base organizada e georreferenciada. O cidadão registra a ocorrência, consulta o mapa, acompanha o andamento e apoia demandas. O painel municipal permite às equipes autorizadas analisar registros, atualizar situações, publicar respostas e consultar indicadores.')
add('A solução foi desenvolvida pela equipe PRO POVO para contribuir com a Pastoral de Acesso à Justiça e Direitos Humanos. O protótipo é funcional, passou por testes de utilização com 23 participantes e recebeu avaliações qualitativas externas da proposta. O próximo passo é buscar um piloto institucional em Campina Grande, com responsáveis e fluxo de atendimento definidos; a adesão municipal e os resultados de atendimento ainda precisam ser demonstrados.')
add('A expansão será gradual, após avaliar o piloto e obter adesão de novos municípios. O modelo comercial proposto no Canvas é a assinatura institucional, preferencialmente anual, com acesso gratuito aos cidadãos. Preço, custos de operação e disposição a pagar permanecem em validação.')
heading('Instituição de impacto social e problema atendido')
add('A instituição escolhida é a Pastoral de Acesso à Justiça e Direitos Humanos. O projeto busca apoiar a orientação dos cidadãos e o acompanhamento de demandas relacionadas a direitos básicos e serviços públicos, como mobilidade, saneamento, segurança e qualidade de vida.')
add('Demandas comunicadas por canais dispersos dificultam a organização territorial, a identificação de recorrências e a consulta ao andamento. O Pro Povo foi concebido para transformar essas manifestações em registros localizados e acompanháveis. O piloto deverá verificar essa necessidade junto aos moradores, à Pastoral e aos órgãos municipais.')
heading('Objetivos')
sub('Objetivo geral')
add('Disponibilizar um canal digital acessível para registrar e acompanhar problemas urbanos, começando pela articulação de um piloto em Campina Grande e buscando uma implantação municipal baseada em evidências.')
sub('Objetivos específicos')
for t in ['Reunir relatos com descrição, categoria, localização e foto opcional.', 'Dar visibilidade ao andamento e às respostas das equipes autorizadas.', 'Oferecer mapas e indicadores para apoiar decisões técnicas.', 'Usar os votos como sinal de apoio comunitário, complementar aos critérios técnicos.', 'Validar o fluxo institucional e a experiência de moradores e gestores.']:
    bullet(t)
end()

start()
heading('Público alvo')
table(['Público','Necessidade atendida'],[
('Cidadãos','Registrar problemas, consultar o andamento e participar. O foco operacional proposto para o primeiro piloto é Campina Grande.'),
('Pastoral','Orientar cidadãos, reunir evidências e acompanhar demandas relacionadas a direitos e serviços públicos.'),
('Equipes municipais','Triar relatos, atualizar situações, responder aos moradores e consultar indicadores territoriais.'),
('Instituições adotantes','Prefeituras, secretarias e autarquias municipais, como possíveis clientes institucionais.'),
], [112,WIDTH-112])
heading('Proposta de valor e diferenciais')
add('A plataforma reúne registro, fotografia, localização, mapa, acompanhamento, apoio comunitário e painel de gestão. A proposta é facilitar a leitura territorial e a comunicação entre moradores e órgãos municipais. A adoção como canal municipal depende de acordo com a instituição e da validação do atendimento.')
for t in ['Acesso administrativo limitado ao município autorizado.', 'Relatos organizados por localidade, categoria, data e situação.', 'Mapas e indicadores para identificar padrões e apoiar planejamento.', 'Interface responsiva, modo claro e escuro e página de orientação de uso.', 'Votos como sinal comunitário, sem substituir avaliação técnica de prioridade.']:
    bullet(t)
heading('Modelo de negócio e geração de receita')
add('Conforme o Canvas, a proposta é uma assinatura institucional, preferencialmente anual, para prefeituras, secretarias ou autarquias municipais. O cidadão permanece com acesso gratuito. Pode haver cobrança inicial por implantação e treinamento, conforme a oferta a ser validada.')
add('O preço deverá considerar porte do município, volume de ocorrências, módulos e suporte. O piloto ajudará a estimar custos de infraestrutura, horas de acompanhamento e necessidades das equipes. Ainda não há preço validado nem contrato municipal comprovado nesta revisão.')
add('A receita proposta remunera a plataforma, manutenção, implantação e suporte. Dados pessoais não serão comercializados. Contatos políticos ou institucionais podem facilitar apresentações e divulgação; esse apoio não equivale a patrocínio, contratação ou adesão da prefeitura.')
end()

start()
heading('Descrição do funcionamento')
for t in [
'1. Cadastro e autenticação. O cidadão cria uma conta e confirma o e-mail para enviar relatos.',
'2. Registro. Informa título, categoria, descrição e endereço; pode anexar uma fotografia.',
'3. Localização. O endereço selecionado é convertido em coordenadas para posicionar a ocorrência no mapa. A interface também oferece apoio por localização do dispositivo.',
'4. Consulta. Os registros podem ser encontrados em listas, pesquisa, filtros e mapa.',
'5. Participação comunitária. Usuários autenticados podem apoiar relatos; esse apoio não define sozinho a prioridade de atendimento.',
'6. Gestão. Contas autorizadas consultam os registros do município, atualizam a situação, publicam respostas e acompanham indicadores.',
'7. Acompanhamento. O cidadão consulta mudanças de situação e respostas registradas na plataforma.',
]: add(t,after=6)
heading('Funcionalidades principais')
table(['Área','Funcionalidades'],[
('Cidadão','Cadastro e login; confirmação de e-mail; relato e foto opcional; edição ou exclusão enquanto aberto; votos; consulta, filtros, mapa e página Como usar.'),
('Gestão municipal','Painel com acesso restrito por município; consulta e filtros; atualização de situação; respostas e indicadores.'),
('Plataforma','Atualização dos dados; localização; organização territorial; verificações de campos, permissões e operações; tratamento de erros.'),
], [105,WIDTH-105])
heading('Encaminhamento proposto para o piloto')
add('A melhoria planejada é sugerir o órgão responsável a partir da categoria do relato, com possibilidade de revisão por uma pessoa autorizada. A distribuição das categorias e o canal de recebimento deverão ser definidos com as secretarias participantes antes de automatizar o envio.')
add('Identificar o destino, enviar a solicitação e confirmar o recebimento são etapas diferentes. O registro só deverá ser apresentado como encaminhado quando houver envio efetivo pelo fluxo combinado. O encaminhamento entre secretarias ainda é uma evolução planejada, e não uma integração municipal comprovada.')
end()

start();end()

start()
heading('Validação com usuários e resultados atuais')
add('A equipe consolidou testes de utilização do Pro Povo com 23 participantes. Os números abaixo foram informados pela equipe e também aparecem no Canvas atualizado. Esta validação registra a experiência dos participantes; não demonstra, por si só, adesão de uma prefeitura ou resolução de demandas públicas.')
table(['Experiência nas tarefas','Participantes','Percentual'],[
('Concluíram sem dificuldades','18 de 23','78,3%'),
('Precisaram de ajuda pontual','3 de 23','13,0%'),
('Precisaram de assistência em grande parte da navegação','2 de 23','8,7%'),
], [WIDTH-164,86,78])
add('A aprovação declarada foi de 21 entre 23 participantes, ou 91,3%. Esse percentual representa as pessoas consultadas e não permite generalização para toda a população.')
heading('Aprendizado e melhoria implementada')
add('Segundo a equipe, as maiores dificuldades se concentraram em participantes de maior idade. A interpretação foi priorizar acessibilidade, clareza da linguagem e simplicidade da navegação. Não foram apresentados dados suficientes para quantificar o efeito da idade ou comparar grupos.')
add('Como resposta, foi implementada uma página que explica como utilizar o site. A página está presente no protótipo. Ainda não houve uma nova rodada de testes para verificar se essa orientação reduz a necessidade de ajuda; sua eficácia permanece a avaliar.')
table(['Observação','Resposta da equipe','Situação'],[
('Parte dos participantes precisou de ajuda.','Criação da página Como usar.','Implementada; eficácia ainda sem novo teste.'),
('Dificuldades concentradas em pessoas de maior idade.','Priorizar linguagem e navegação mais claras.','Nova avaliação com esse perfil proposta.'),
('Aprovação de 21 entre 23 participantes.','Manter os recursos úteis e revisar as barreiras.','Resultado inicial; acompanhamento necessário.'),
], [155,165,WIDTH-320])
heading('Próxima rodada de avaliação')
add('Repetir tarefas comparáveis, observar se a página de orientação é encontrada e compreendida e registrar conclusão sem ajuda, dúvidas e assistência necessária. Documentar datas, perfil dos participantes, tarefas e a pergunta de aprovação, preservando sua identidade. Esses detalhes metodológicos ainda precisam ser reunidos pela equipe para complementar os resultados consolidados.')
end()

start()
heading('Verificações técnicas e evolução do protótipo')
add('Em 14 de outubro de 2026, foram executados 44 testes automatizados já existentes no projeto. Todos passaram, sem falhas nem testes ignorados. As verificações usaram dependências e respostas simuladas; não acessaram o atendimento de uma prefeitura nem representam testes de carga ou auditoria completa de segurança.')
table(['Área','Verificação e benefício'],[
('Permissões e exclusão','Regras da lógica da aplicação para exclusão pelo autor e pelo gestor do município; rejeição de ações de gestor de outra cidade e de identificadores inconsistentes.'),
('Relatos e mapa','Criação, edição, votos e mudanças de situação mantêm coerência entre relato, resumo e marcador. Cenários simulam atualizações concorrentes e erros de gravação.'),
('Carregamento do mapa','Consulta da projeção da cidade, limite de marcadores e reutilização de cache. A verificação confirma a estratégia de leitura, sem medir desempenho real em escala.'),
('Endereços e GPS','Tratamento de município e bairro, localização do dispositivo, permissão recusada e falha do serviço. Objetivo: evitar endereços inconsistentes e orientar o usuário.'),
('Imagens','Tratamento de configuração inválida e arquivo recusado; identificação da imagem por usuário e relato. Não valida disponibilidade real do serviço externo.'),
('Atualização do índice do mapa','Operação simulada sem gravar por padrão; preservação de dados, tratamento de registros inválidos e prevenção de sobrescrita em cenários concorrentes.'),
], [116,WIDTH-116])
heading('Alcance dessas evidências')
add('Esses resultados sustentam o comportamento das funções nos cenários testados. A suíte específica das regras do banco de dados não foi executada nesta rodada. Não há, a partir desses testes, comprovação de conformidade integral com a LGPD, capacidade para qualquer volume de uso ou disponibilidade contínua em produção.')
heading('Indicadores para a validação institucional')
add('No piloto, acompanhar qualidade dos relatos, tempo de registro, conclusão de tarefas, triagem, primeira resposta, andamento e resolução. Os tempos de atendimento e os resultados de impacto dependerão de participação municipal real e formarão uma linha de base para metas futuras.')
end()

start()
heading('Validação qualitativa com profissional da área')
add('Em 14 de outubro de 2026, a equipe discutiu a proposta do Pro Povo com Geraldo Marinho de Figueiredo Filho, conhecido como Tio Gêra. O objetivo foi colher uma avaliação externa sobre a estratégia de implantação e a aproximação com o poder público. Este registro se baseia nas informações e recomendações relatadas pela equipe.')
sub('Perfil e pertinência da contribuição')
add('Geraldo Marinho é apresentado pela UFPB como engenheiro civil e palestrante em evento sobre acessibilidade e inclusão promovido pelo Grupo de Trabalho de Acessibilidade do CREA-PB. Sua atuação nesse debate é pertinente ao projeto, que trata de problemas urbanos e participação cidadã. Essa referência caracteriza sua experiência; não significa que as instituições citadas tenham aprovado ou adotado o Pro Povo.')
table(['Aspecto','Registro da reunião'],[
('Participante','Geraldo Marinho de Figueiredo Filho, conhecido como Tio Gêra.'),
('Objetivo','Obter opiniões externas para aperfeiçoar foco territorial, articulação institucional, divulgação e encaminhamento.'),
('Alcance','Uma reunião identificada. Complementa os testes com usuários e as verificações técnicas.'),
], [112,WIDTH-112])
heading('Recomendações recebidas e resposta do projeto')
table(['Recomendação','Resposta nesta revisão'],[
('Concentrar a fase inicial em Campina Grande.','Detalhar um piloto local e manter a expansão futura condicionada a resultados e adesão.'),
('Priorizar secretarias e prefeitura.','Propor aproximação com órgãos responsáveis pelo atendimento e retomada do contato com a SESUMA.'),
('Reforçar a divulgação.','Incluir ações propostas com Pastoral, lideranças comunitárias, redes sociais e apresentações institucionais.'),
('Aperfeiçoar o direcionamento dos relatos.','Planejar sugestão de destinatário por categoria e validar o fluxo antes de automatizar o envio.'),
('Usar contatos como apoio para apresentações.','Distinguir articulação, patrocínio e adesão, sem registrar compromissos ainda não confirmados.'),
], [200,WIDTH-200])
add('A contribuição é evidência de avaliação externa e de aprendizado da equipe. A reunião não mede usabilidade nem comprova atendimento municipal, resolução de ocorrências ou viabilidade comercial. As recomendações foram incorporadas ao planejamento; a implantação e seus resultados serão avaliados no piloto.','small')
add('Referências de perfil: <a href="https://www.ct.ufpb.br/lpsau/sem-categoria/ufpb-sedia-evento-sobre-acessibilidade-e-inclusao-promovido-pelo-grupo-de-trabalho-do-crea-pb/" color="#1351b4">UFPB, programação sobre acessibilidade, 04/09/2026</a>; <a href="https://sapl.campinagrande.pb.leg.br/media/sapl/public/materialegislativa/2025/1009918/apat79sessaoordinaria11092025.pdf" color="#1351b4">Câmara Municipal, pauta de 11/09/2025, identificação de Tio Gêra</a>. Consulta em 14/10/2026.','small')
end()

start()
heading('Depoimentos de profissionais sobre a proposta')
add('Os depoimentos abaixo foram fornecidos pela equipe e transcritos integralmente. Eles acrescentam avaliações qualitativas do potencial do Pro Povo, a partir das perspectivas de software, acessibilidade e desenvolvimento urbano. As informações de formação e experiência de Tiago correspondem ao perfil informado à equipe.')
sub('Tiago Batista')
add('Profissional de engenharia e arquitetura de software. Formação informada: Gestão de TI pela UNESA; pós-graduação em Inteligência Artificial pela Data Science Academy; curso de Computação CS50 da Harvard College. A experiência profissional é descrita pelo participante no próprio depoimento.','small')
TIAGO_QUOTE = 'Como profissional de engenharia e arquitetura de software, trabalho há mais de 15 anos em diversas organizações nacionais e internacionais incluindo Big Techs como Apple. Acredito que o projeto Pro Povo seja uma iniciativa com potencial inovador e o enxergo de maneira muito positiva no sentido de aproximar cidadãos e o poder público de forma a trazer mais transparência e pragmatismo para questões urbanas e destino de recursos públicos.'
add('“'+escape(TIAGO_QUOTE)+'”','quote',12)
sub('Geraldo Marinho de Figueiredo Filho conhecido como Tio Gêra')
add('Engenheiro civil e palestrante sobre acessibilidade e inclusão, conforme a referência institucional da UFPB apresentada na seção anterior.','small')
GERALDO_QUOTE = 'Como engenheiro especialista em acessibilidade e preocupado com o desenvolvimento das cidades, acredito que o projeto tem muita vida. Ele funciona como um canal que estreita a relação com a população e resolve problemas reais, tornando-se uma ferramenta indispensável para os cidadãos buscarem soluções locais. Por exemplo, uma dona de casa que enfrenta problemas com lixo na sua rua ou calçada pode entrar em contato diretamente com o Propovo, com muito mais facilidade. Nem sempre o cidadão consegue acessar a prefeitura ou o governo; através do Propovo, esse acesso é facilitado. A partir daí, o projeto encaminha a demanda para as secretarias, para o governo do estado ou para a prefeitura, viabilizando soluções mais rápidas do que se cada cidadão precisasse correr atrás sozinho.'
add('“'+escape(GERALDO_QUOTE)+'”','quote',12)
sub('Interpretação dos depoimentos')
add('Tiago destaca potencial de inovação, transparência e aproximação com o poder público. Geraldo enfatiza acesso da população e encaminhamento das demandas. As falas expressam as avaliações dos participantes; os encaminhamentos e as soluções descritos ainda precisam ser demonstrados em uma operação institucional. A data e a forma de obtenção do depoimento de Tiago podem complementar o registro.','small')
end()

start()
heading('Piloto em Campina Grande e implantação gradual')
add('A estratégia definida a partir das discussões da equipe é começar por Campina Grande, onde existem contatos que podem facilitar apresentações aos responsáveis pelos serviços. A estrutura para vários municípios será usada para expansão futura, condicionada à adesão institucional e à definição de quem receberá e acompanhará os relatos em cada cidade.')
add('Esse recorte detalha o foco inicial em municípios da Paraíba já previsto no Canvas. A plataforma atualmente permite registros de diferentes municípios; limitar o recebimento operacional às cidades participantes é uma adequação proposta, que ainda precisa ser implementada e verificada.')
table(['Etapa','Resultado esperado'],[
('Articulação local','Apresentar o protótipo à SESUMA e a outros órgãos pertinentes; entender categorias, responsáveis e canais de atendimento.'),
('Preparação do piloto','Combinar categorias ou bairros, período, responsáveis, fluxo de triagem e critérios de acompanhamento.'),
('Execução e avaliação','Observar uso por moradores e equipes; registrar encaminhamentos, respostas, dificuldades e ajustes.'),
('Adoção e expansão','Apresentar resultados a possíveis adotantes; validar custos, preço e suporte; ativar novas cidades após adesão e preparação do fluxo.'),
], [121,WIDTH-121])
heading('Condições propostas para a expansão')
for t in ['Demonstrar que relatos chegam aos responsáveis e recebem acompanhamento no fluxo combinado.', 'Registrar resultados e dificuldades do piloto, incluindo experiência dos moradores e das equipes.', 'Estimar custos e suporte e obter adesão e responsáveis antes de liberar a operação em novas cidades.']:
    bullet(t)
heading('Divulgação e relacionamento')
add('Para moradores, propõe-se divulgar o piloto com apoio da Pastoral, lideranças comunitárias e redes sociais, explicando onde atua, como registrar e como acompanhar. Para instituições, usar demonstrações, contatos indicados e reuniões com secretarias. O piloto deverá acompanhar alcance, pessoas que utilizam o site e relatos válidos, além das necessidades de orientação e suporte.')
end()

start()
heading('Impactos esperados e alinhamento aos ODS')
table(['Dimensão','Impacto esperado'],[
('Social','Mais participação cidadã e acompanhamento de demandas que afetam direitos básicos.'),
('Institucional','Registros organizados, leitura territorial e transparência das respostas.'),
('Ambiental','Visibilidade de descarte irregular, saneamento, áreas verdes e degradação urbana.'),
('Econômica','Apoio ao planejamento e possível redução de retrabalho por informações dispersas ou incompletas.'),
], [105,WIDTH-105])
add('O alinhamento principal é com o ODS 11, Cidades e Comunidades Sustentáveis, e o ODS 16, Paz Justiça e Instituições Eficazes. O ODS 17 apoia a proposta por meio da construção de parcerias. Os impactos descritos são esperados; os testes de utilização ainda não comprovam melhoria no atendimento público.')
heading('Viabilidade e potencial de evolução')
add('O protótipo utiliza tecnologias web e serviços externos, com interface, autenticação, banco de dados, armazenamento de imagens e mapas. A separação administrativa por município permite preparar uma implantação gradual. Isso demonstra uma base funcional, mas a operação institucional depende de responsáveis, suporte, monitoramento e capacidade compatível com o uso.')
add('O primeiro piloto deverá estimar custos por município e por implantação: uso do banco e imagens, manutenção, treinamento, acompanhamento e horas de suporte. A assinatura institucional proposta no Canvas permanece uma hipótese comercial a validar, incluindo preço, disposição a pagar e condições de contratação.')
heading('Condições para implantação institucional')
for t in ['Definir uma instituição participante e responsáveis por triagem e respostas.', 'Confirmar quais demandas serão atendidas e como ocorrerá o encaminhamento.', 'Preparar contas autorizadas, orientação das equipes e acompanhamento do piloto.', 'Revisar proteção de dados, moderação, monitoramento, backups e limites de infraestrutura.', 'Avaliar usabilidade com moradores e rotina administrativa com os servidores participantes.']:
    bullet(t)
add('Após medir uso, resposta, custos e necessidades de suporte, a equipe poderá apresentar o caso de Campina Grande a outras prefeituras. A adoção como canal municipal de comunicação é um objetivo de implantação a negociar, e não uma condição já alcançada pelo protótipo.')
add('Os termos de uso e a política de privacidade orientam o tratamento de dados e imagens. O usuário é orientado a não expor dados pessoais de terceiros nem publicar imagens que os identifiquem sem consentimento. Essas orientações e os controles técnicos deverão ser revisados para a implantação institucional.')
end()

start()
heading('Limitações e riscos atuais')
table(['Ponto','Situação atual','Tratamento previsto'],[
('Usabilidade','Teste inicial com 23 participantes.','Reunir método e registros; repetir tarefas após a página de orientação.'),
('Adesão institucional','Sem piloto municipal comprovado.','Articular secretarias e definir responsáveis e escopo do piloto.'),
('Abrangência','Cadastro de relatos em mais de um município.','Propor liberação operacional conforme adesão e fluxo de atendimento.'),
('Encaminhamento','Integração entre secretarias ainda planejada.','Validar destinatários, envio e confirmação de recebimento.'),
('Impacto público','Tempos e resolução municipal não medidos.','Registrar atendimento real durante o piloto.'),
('Custos e receita','Preço e disposição a pagar não validados.','Medir infraestrutura e suporte; discutir oferta com instituições.'),
('Dados e capacidade','Controles técnicos parciais e serviços externos.','Revisar privacidade, moderação, monitoramento e operação conforme o uso.'),
], [91,165,WIDTH-256])
heading('Próximos passos')
for t in ['1. Complementar a documentação do teste inicial e da reunião de orientação.', '2. Reavaliar a página Como usar com pessoas de diferentes níveis de familiaridade digital.', '3. Retomar contato com a SESUMA e mapear os órgãos pertinentes às categorias.', '4. Validar a rotina administrativa e o encaminhamento com um responsável institucional.', '5. Preparar o piloto em Campina Grande e sua divulgação comunitária.', '6. Medir uso, atendimento, custos, necessidades de suporte e satisfação.', '7. Apresentar os resultados, validar a oferta institucional e planejar novas adesões.']:
    add(t,after=6)
end()

start()
heading('Equipe técnica responsável')
table(['Integrante','Função no projeto'],[
('Antonio Mendonça','Líder e apresentador. Coordena a equipe e acompanha o projeto.'),
('Arthur Palmeira','Vice-líder e desenvolvedor de software. Responsável pela criação e evolução técnica do site.'),
('Diogo Andrade','Responsável pelas redes sociais, divulgação e estratégias de marketing.'),
('Miguel Barros','Apoia redes sociais e articulação institucional, aproximando a equipe do poder público municipal.'),
('Victor Montenegro','Responsável pela documentação e contribuição com opiniões e ideias.'),
('Aquiles Souto','Apoia documentação, ideação e atividades relacionadas ao desenvolvimento.'),
('Eduardo Marques','Apoia produção, documentação e construção de ideias e sugestões.'),
('Adriano Ribeiro','Professor orientador. Acompanha o projeto e orienta a equipe nas etapas do DLEI.'),
], [128,WIDTH-128])
heading('Conclusão')
add('O Pro Povo reúne um protótipo funcional, testes iniciais com 23 participantes e verificações técnicas dos cenários automatizados. Os resultados orientaram a criação de uma página de apoio ao uso e a priorização de melhorias de navegação. A eficácia dessa alteração ainda precisa de novo teste.')
add('A reunião com Geraldo Marinho de Figueiredo Filho acrescentou uma avaliação qualitativa externa da proposta e orientou o detalhamento da implantação gradual: buscar um piloto em Campina Grande, definir responsáveis e fluxo de atendimento, registrar resultados e apresentar a solução a outras prefeituras. Essa estratégia mantém a proposta da versão de 12 de outubro de 2026 do Canvas, confirmada pela equipe como a versão entregue, e torna mais concreto o caminho para validá-la.')
add('O depoimento de Tiago Batista complementa essa avaliação pela perspectiva de engenharia e arquitetura de software, destacando o potencial de aproximar cidadãos e poder público e ampliar a transparência. Os dois depoimentos registram percepções externas sobre a proposta, distintas dos resultados dos testes de utilização.')
add('A próxima etapa decisiva é demonstrar o funcionamento com uma instituição participante. A equipe deverá distinguir resultados obtidos, melhorias implementadas e hipóteses futuras, para que expansão, receita e impacto sejam sustentados por evidências.')
add('Revisão de 14 de outubro de 2026, alinhada à versão de 12 de outubro do Canvas entregue pela equipe. Resultados de utilização, reunião e depoimentos conforme informações da equipe; verificações técnicas realizadas nesta data. Detalhes metodológicos, datas e registros de obtenção dos depoimentos podem complementar as evidências.','small')
end()
c.save()
original=PdfReader(SOURCE)
revised=PdfReader(TMP/'composicao.pdf')
writer=PdfWriter()
for i,page in enumerate(revised.pages):
    writer.add_page(original.pages[i] if i in (0,4) else page)
# Add the revision date to the preserved cover without changing its design.
buf=BytesIO()
cover=canvas.Canvas(buf,pagesize=(W,H))
cover.setFont('Helvetica',8);cover.setFillColor(white)
cover.drawCentredString(W/2,25,'Revisão em 14 de outubro de 2026')
cover.save();buf.seek(0)
writer.pages[0].merge_page(PdfReader(buf).pages[0])
writer.add_metadata({'/Title':'Pro Povo Memorial Descritivo Completo Revisado em 14 de outubro de 2026','/Author':'Equipe Pro Povo'})
with FINAL.open('wb') as f:writer.write(f)
pdf=pdfium.PdfDocument(FINAL)
for i in range(len(pdf)):
    pdf[i].render(scale=1.7).to_pil().save(TMP/f'page-{i+1:03d}.png')
checks={'date':'2026-10-14','automated_tests':44,'passed':44,'failed':0,'skipped':0,'isolated_dependencies':True,'database_rules_suite_executed':False,'page_layout':page_usage}
(TMP/'verificacao.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print(str(FINAL))
print(json.dumps(checks,ensure_ascii=False))
