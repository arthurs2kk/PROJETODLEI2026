# Refinamento de UI/UX do painel da Prefeitura

Avaliação e implementação em 15/10/2026.

## Escopo e método

Foram examinados acesso administrativo, navegação desktop/móvel, temas, seis indicadores, consulta paginada, busca e filtros, cards, situação, resposta oficial, exclusão, fotos, prioridades compartilhadas, mapa e suas quatro visualizações, cinco análises estatísticas e exportações CSV/PNG.

A avaliação combinou leitura do código, conferência visual e execução da interface real em Chrome com dados fictícios. É uma avaliação heurística e técnica; não substitui observação de funcionários usando dados e tarefas reais. As melhorias de eficiência são esperadas a partir dos problemas identificados, sem alegação de ganho percentual ou de pesquisa com usuários.

Foram preservados azul institucional, amarelo, cores semânticas, Noto Sans, logotipo, ícones Tabler, cabeçalho em gradiente, cards, bordas, sombras, temas e organização em abas. As correções de contraste usam cores que o projeto já possui. As alterações de apresentação não exigem nova regra de banco, API, migração ou biblioteca em produção.

O diretório já continha alterações locais anteriores à análise, inclusive funcionalidades de mapa e prioridades. Elas foram mantidas como base. As modificações preexistentes em API, regras e mapa público não foram implementadas por este refinamento.

## Diagnóstico e mudanças realizadas

Prioridade alta indica risco de interpretar dados incorretamente, perder trabalho ou ficar impedido de concluir uma tarefa. Média indica atrito recorrente ou dificuldade de descoberta. As prioridades expressam julgamento desta avaliação, sem medição estatística.

| Área / prioridade | Problema observado | Refinamento implementado | Justificativa funcional |
| --- | --- | --- | --- |
| Filtros / alta | O valor selecionado substituía a identificação visível do campo; não havia limpeza conjunta. | Rótulos permanentes, agrupamento de busca/filtros, botão de limpeza condicional. | Reconhecimento e controle do usuário; proximidade da Gestalt torna explícita a relação entre campos. |
| Busca / média | Digitar sem acentos podia impedir localizar um endereço ou título. | Busca tolera acentuação, maiúsculas e espaços nas extremidades. | Compatibilidade com a linguagem de uso; reduz tentativas de reformulação. |
| Consulta / alta | Uma busca sem resultados no primeiro lote podia ser entendida como ausência de demanda no município. | Aviso de consulta parcial, contagem contextual e acesso à consulta completa já existente. | Visibilidade do estado; evita tratar uma amostra como universo. |
| Lista e mapa / alta | Depois de consultar todos para o mapa, a lista voltava aos primeiros 25; o relato antigo não era encontrável diretamente. | A lista reutiliza a base completa quando disponível. | Consistência entre vistas do mesmo conjunto; evita repetir uma busca. |
| Indicadores / alta | Não era evidente que os números não acompanhavam os filtros; SLA e ausência de tempo médio podiam ser ambíguos. | Explicação do escopo, consulta parcial/completa, prazo de 10 dias e condição de cálculo do tempo médio. | Correspondência entre dado e interpretação; hierarquia entre resumo geral e resultado filtrado. |
| Ordenação / média | A lista oferecia somente ordem cronológica recente. | Mais recentes, mais antigos e mais apoios, preservando a ordem manual das prioridades. | Flexibilidade para triagem de fila e demanda apoiada, sem alterar critérios de negócio. |
| Atualização / alta | Atualizar apagava os registros visíveis antes de a nova consulta terminar. Uma falha deixava a interface vazia. | Troca de dados após sucesso; dados anteriores permanecem em falha, com orientação de nova tentativa. | Recuperação de erros e continuidade do trabalho. |
| Mapa e lista / alta | O popup só oferecia priorização, exigindo voltar à lista e procurar novamente para responder ou mudar a situação. | “Abrir gestão do relato” no popup e “Ver no mapa” no card. O card recebe foco ao retornar. | Menos navegação e preservação do contexto. |
| Mapa / alta | Interação com círculos desenhados em canvas não disponibilizava acesso equivalente por teclado. | Lista expansível com as mesmas demandas, ações Localizar/Abrir gestão e indicação de dados sem coordenadas. | A operação não depende exclusivamente de apontar para o mapa; a representação visual existente é preservada. |
| Mapa / média | Redesenhos de dados fechavam o popup e interrompiam a exploração. | Evita reconstrução quando os dados não mudaram; preserva popup na priorização e enquadramento ao atualizar a camada. | Estabilidade espacial e continuidade da ação. |
| Mapa / média | A roda do mouse ampliava o mapa durante a rolagem da página. | Zoom pela roda desativado; zoom por controles, teclado e gesto de toque mantidos. | Evita captura acidental da rolagem da página. |
| Mapa / média | Controles pequenos, nomes em inglês e instruções insuficientes. | Zoom com rótulos em português, controles de 44 px e instruções breves. | Lei de Fitts: facilita aquisição dos alvos; linguagem consistente. |
| Mapa / alta | Filtro sem pontos e coordenadas ausentes eram difíceis de distinguir de uma falha de carregamento. | Mensagem de mapa vazio, enquadramento desabilitado e quantidade sem localização explícita. | Visibilidade do estado e recuperação por ajuste dos filtros. |
| Camadas / média | Cores, tamanho dos círculos e concentração podiam ser confundidos com o mesmo indicador. | Mantidas as quatro modalidades e legendas; concentração explica contagem sem ponderar apoios e o caminho para selecionar um relato individual. | Semântica explícita e redução da carga de interpretação. |
| Prioridades / média | Setas desabilitadas não explicavam suficientemente as condições para reordenar. | Ajuda contextual para filtros/cidade/conexão, feedback de posição salva e foco no item movido. | Reconhecimento em vez de memorização; retorno da ação. |
| Situação e resposta / alta | Outros eventos podiam recriar o card durante o salvamento e reabilitar controles prematuramente. | Estado de operação por relato, controles protegidos e mensagem de progresso; situação anterior reaparece em falha. | Prevenção de ações repetidas e visibilidade do estado. |
| Resposta / alta | Limite de texto pouco evidente e editor sem explicação de publicação/notificação. | Rótulo visível, limite de 2.000 caracteres, contador, explicação pública e botão de fechamento. | Prevenção de erros antes do envio; consequências da ação compreensíveis. |
| Rascunhos / alta | Edições podiam ser perdidas ao navegar para outra página ou sair. | Preservação entre abas/filtros, proteção de saída com texto não salvo e confirmação antes de encerrar a sessão. | Controle do usuário e proteção de trabalho em andamento. O rascunho permanece apenas na memória da página. |
| Cards e exclusão / média | Categoria não aparecia diretamente na ficha; exclusão disputava espaço com ações frequentes. | Categoria nos metadados, quebra de textos longos e separação espacial da exclusão em desktop. | Melhor leitura e menor proximidade entre ação destrutiva e rotinas. Confirmação de exclusão mantida. |
| Fotos / alta | A imagem aceitava foco mas não Enter/Espaço; modal sem gestão de foco. | Ativação por teclado, diálogo identificado, foco no fechamento, Escape, bloqueio do fundo e retorno à foto. | Operação por teclado e previsibilidade do diálogo. |
| Gráficos / alta | Canvas não oferecia os valores em formato acessível e comparável. | Tabela semântica expansível com os mesmos dados da análise/exportação, resumo e título acessível. | Equivalência textual, leitura precisa e comparação sem depender de cor. |
| Gráficos / alta | Exportações disponíveis antes de haver dados; mudanças rápidas podiam permitir resultado assíncrono obsoleto. | Botões dependem de dados válidos; proteção de versão da renderização; retorno de carregamento e tentativa após falha. | Prevenção de erro e correspondência entre seleção, gráfico e arquivo. |
| Gráficos / média | Remover a opção de cidades do admin municipal não garantia selecionar bairros. | Seleção inicial explícita de bairros para o perfil municipal. | A primeira análise passa a corresponder ao escopo do usuário. As restrições de acesso continuam existentes. |
| Temas / alta | Textos de situação e ações tinham contraste baixo; textos dos eixos não acompanhavam o tema. | Textos usam tons existentes de maior contraste; gráficos reagem ao tema; PNG mantém texto escuro sobre branco. | Legibilidade nos dois temas, sem mudar a paleta semântica ou cores dos dados. |
| Responsividade / média | Controles podiam desperdiçar largura; canvas ultrapassava temporariamente o contêiner ao redimensionar. | Grade de filtros ajustada a desktop/tablet/celular; botões reorganizados; limite de largura do canvas e legenda adequada em telas estreitas. | Refluxo e hierarquia estável sem depender de rolagem horizontal da página. |
| Navegação / média | Escape fechava o menu sem devolver o foco; não havia fechamento ao clicar fora. | Retorno ao acionador, fechamento externo e sincronização ao mudar para desktop; localização atual identificada nos links. | Navegação previsível e consistência de estado. |
| Login e acesso / alta | Login dependia de clique, campos não tinham associação de rótulo e falha na verificação podia manter carregamento indefinido. | Formulário com Enter, preenchimento automático apropriado, mostrar/ocultar senha com nome atualizado, erro persistente e recuperação da verificação de acesso. | Padrões familiares, feedback e saída de estados de falha, preservando a autorização. |

## Fundamentos utilizados

As decisões aplicam visibilidade do estado, consistência, controle do usuário, prevenção e recuperação de erros, reconhecimento e eficiência descritos nas [heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/). O agrupamento dos filtros segue proximidade e região comum da Gestalt. A separação entre busca, resultado e ação reduz escolhas simultâneas a interpretar, usando a Lei de Hick como orientação, sem inferir um tempo de decisão medido.

A altura mínima dos controles e a proximidade das ações com o relato seguem a relação entre dimensão/distância do alvo e esforço de interação discutida na [Lei de Fitts](https://www.nngroup.com/articles/fitts-law/). Não se alterou o tamanho dos círculos de categoria no mapa: a lista equivalente permite agir sem a precisão de apontamento exigida por eles.

Abas, identificação dos painéis e navegação por teclado seguem o [padrão de abas do W3C](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/). A conferência em 320 px usa como referência o [critério de refluxo do W3C](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html). A auditoria automatizada e esses ajustes não constituem certificação integral de conformidade WCAG.

## Validação e evidências

- `npm.cmd test`: 56 testes aprovados, incluindo o novo cenário de busca sem acentos e os testes existentes de consulta, projeções, votos, exclusão, escopo e prioridades.
- Chrome local, HTML/CSS/JS reais, com substituição dos módulos de dados somente no navegador de teste. Firebase, API, autenticação e notificações reais não são acionados.
- 27 verificações concluídas no roteiro de interface; nenhum erro JavaScript não tratado foi registrado.
- Fluxos: filtros e limpeza, consulta parcial/completa, rascunho, resposta, falha de e-mail independente do salvamento, situação e reversão em falha, foto por teclado, abas, menu, mapa nos quatro modos, relato antigo, coordenadas ausentes, prioridade pelo popup, reordenação, atualização com erro, gráficos, CSV/PNG e login por Enter.
- Larguras verificadas: 1440, 768, 390 e 320 px para gestão/gráficos; 768, 390 e 320 px para mapa. Temas claro/escuro na gestão, gráficos e login.
- Auditorias axe com regras WCAG A/AA selecionadas para gestão nos dois temas, mapa, gráficos e login; o roteiro gera relatórios e verificações funcionais localmente em `tmp/ui-prefeitura/`, fora do versionamento.
- Conferência visual das capturas após execução dos fluxos. Mapa-base neutro e foto sintética nas capturas são intencionais: os testes não fazem requisições a serviços de mapas ou fotos de produção.

As capturas de desktop, celular, mapa, gráficos e login são geradas apenas para conferência local em `tmp/ui-prefeitura/` e não entram no commit. Utilizam dados fictícios e não representam volume ou situação reais do município.

### Reproduzir os testes de interface

As dependências abaixo são opcionais e ficam em pasta temporária; não entram no bundle nem alteram `package.json` do projeto. São usadas também cópias locais das mesmas versões de Leaflet, Chart.js e ícones do site, para tornar a execução independente de CDNs. O script inicia e encerra seu próprio servidor local.

```powershell
npm.cmd install --prefix tmp/ui-validation --no-save --package-lock=false --ignore-scripts playwright@1.56.1 @axe-core/playwright@4.10.2 leaflet@1.9.4 chart.js@4.4.0 @fontsource/noto-sans@5.2.8 @tabler/icons-webfont@3.44.0
$env:NODE_PATH = (Resolve-Path tmp/ui-validation/node_modules).Path
node scripts/validar-ui-prefeitura.cjs
```

O script utiliza Chrome instalado. Para Edge, defina `$env:UI_BROWSER = 'msedge'` antes da execução. Fontes e ícones são servidos somente para a sessão isolada de teste; os endereços de produção permanecem os existentes.

## Limites e próximos pontos de observação

Não foi executada uma sessão autenticada de produção, envio real de e-mail ou mudança em dados reais. Os testes existentes de serviço verificam contratos; o teste de interface verifica interações com dependências simuladas. Regras do Firebase não foram alteradas por este refinamento nem republicadas, e a suíte que depende do emulador de regras não integra o resultado de `npm test` relatado acima.

O mapa mantém círculos e concentração existentes. Em áreas com muitos relatos na mesma coordenada, pode continuar havendo sobreposição; filtros e lista equivalente permitem chegar às demandas. Agrupamento de marcadores merece avaliação futura com o volume real antes de adicionar outra dependência ou mudar a representação.

A consulta completa reutiliza o mecanismo existente e continua proporcional ao volume do escopo. Não foram introduzidas novas consultas por tecla ou assinaturas do banco. Deve-se medir o tempo com grandes volumes antes de considerar mudanças na estratégia de dados, que ultrapassariam este refinamento de interface.

Recomenda-se observar funcionários em tarefas concretas: localizar uma demanda antiga; distinguir o resumo geral do resultado filtrado; priorizar no mapa e responder; reordenar com filtros ativos; recuperar uma falha de conexão. Medir conclusão, erros e tempo permitirá confirmar ou revisar as hipóteses desta avaliação.
