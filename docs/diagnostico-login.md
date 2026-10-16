# Diagnóstico e correções do login — 16/10/2026

## Resultado

- Diagnóstico inicial: **28 testes, 21 aprovados e 7 falhas**.
- Após as correções, `npm.cmd run test:login`: **38 testes aprovados, nenhuma falha**.
- Navegador Chrome, página real em 1366 × 900 e 390 × 844: **16 verificações aprovadas**, incluindo Enter, cliques repetidos, persistência, retomada de cadastro e cancelamento durante gravação.
- Os testes executam `js/pagesJS/login.js` com respostas controladas de autenticação e banco. Nenhuma conta foi criada e nenhum e-mail foi enviado.
- As correções estão aplicadas localmente; não foi feita publicação.

## Correções aplicadas

- Login, cadastro e restauração de sessão compartilham um bloqueio de operação, mantido até concluir o perfil ou cancelar. O observador deixa o fluxo ativo terminar antes de navegar.
- A sessão restaurada e ambos os métodos de login consultam o perfil. Contas sem perfil retomam a escolha da cidade.
- O formulário de login usa envio nativo por `submit`, incluindo a tecla Enter e preenchimento automático.
- “Lembrar de mim” escolhe persistência local ou de sessão. O Google abre o popup diretamente no clique e ajusta a persistência após autenticar, antes de navegar.
- A conclusão do cadastro impede cancelamento durante a gravação e impede gravação durante a saída. Falhas de saída e de gravação liberam nova tentativa.
- Falha ao salvar um cadastro por senha permite concluir o perfil sem criar outra conta. Falha no envio da confirmação informa como reenviar, sem alegar que o e-mail foi enviado.
- Os testes de login agora fazem parte de `npm test`, além do comando dedicado.

## Problemas reproduzidos antes das correções (histórico)

As referências de linha abaixo correspondem ao código anterior às correções.

### 1. Cadastro por senha redireciona antes de concluir o perfil — prioridade alta

Em `js/pagesJS/login.js:12`, o observador de autenticação redireciona qualquer usuário autenticado quando o fluxo Google não está ativo. Criar uma conta por senha também autentica o usuário, mas a proteção só cobre o Google.

Reprodução: criar uma conta com uma gravação de perfil lenta. A navegação para o início acontece antes de `salvarUsuario` terminar e antes de `sendEmailVerification` ser chamado. No navegador de teste, a gravação foi atrasada em 1,5 segundo; a página foi encerrada antes da conclusão.

Impacto: pode deixar a conta sem o perfil completo ou sem enviar a confirmação. A ordem é compatível com o SDK instalado: `createUserWithEmailAndPassword` atualiza o usuário autenticado antes de retornar as credenciais.

### 2. Solicitações Google concorrentes e mistura de métodos — prioridade média

Em `js/pagesJS/login.js:186`, `entrarComGoogle` ativa uma flag, mas não verifica se já existe uma operação e não desabilita os botões.

Reprodução: dar dois cliques no botão Google enquanto a autenticação está pendente. Foram observadas duas chamadas de `signInWithPopup`. Também é possível iniciar login por senha durante a mesma operação.

Impacto: operações podem se cancelar ou disputar o estado da sessão e o redirecionamento. Reproduzido nos testes isolados e, para o clique duplo, no navegador.

### 3. Sessão restaurada ignora cadastro Google incompleto — prioridade média

O observador em `js/pagesJS/login.js:12` não consulta o perfil ao restaurar uma sessão. A flag que impede o redirecionamento existe apenas na memória da página.

Reprodução: autenticar com Google sem concluir a cidade e recarregar a página. A sessão restaurada redireciona para o início sem retomar o cadastro. O mesmo acontece depois de falhar a leitura do perfil.

Impacto: usuário autenticado pode ficar sem cadastro completo e encontrar erros posteriores ao tentar relatar. Isso não demonstra acesso indevido ao banco nem contorno das regras de segurança; é uma falha no fluxo de conclusão do perfil.

### 4. “Lembrar de mim” não altera a persistência — prioridade média

O checkbox `lembrar`, em `pages/userPages/login.html:156`, não é consultado pelo código de login. Não há configuração de persistência associada à escolha.

Reprodução: entrar com a opção desmarcada. A persistência continua no padrão local quando disponível, em vez de ser limitada à sessão. A prioridade de armazenamento foi conferida no código do SDK instalado (`getAuth`).

### 5. Google permite sair enquanto salva o cadastro — prioridade média

Em `js/pagesJS/login.js:228`, apenas “Continuar” fica desabilitado durante a gravação. “Cancelar e sair” permanece ativo, assim como o cancelamento por clique no fundo do modal.

Reprodução: escolher uma cidade, clicar em Continuar com a gravação pendente e clicar em Cancelar e sair. `signOut` é executado antes da gravação terminar. Se a gravação finalizar com sucesso, seu callback ainda programa o redirecionamento.

Impacto: o resultado da gravação disputa com a saída da conta, podendo apresentar erro ou sucesso depois de o usuário cancelar.

### 6. Enter não envia o login por senha — prioridade baixa

O contêiner de login em `pages/userPages/login.html` é uma `div`, e o código escuta apenas o clique em `btn-login`.

Reprodução no navegador: preencher e-mail e senha e pressionar Enter dentro do campo de senha. Nenhuma solicitação é iniciada. Clicar em Entrar inicia o login normalmente. Reproduzido nos dois tamanhos de tela.

## Casos aprovados

- Campos vazios não iniciam login; o e-mail é aparado e a senha mantém seus caracteres.
- Login por senha bem-sucedido redireciona; clique repetido no mesmo botão não duplica a solicitação.
- Credenciais inválidas, senha incorreta, e-mail inválido, excesso de tentativas e falha de rede exibem mensagens e liberam nova tentativa.
- Google com perfil existente redireciona; primeiro acesso solicita cidade e salva antes de redirecionar.
- Falha ao salvar a cidade permite tentar novamente; cancelar quando não há gravação em andamento sai e fecha o modal.
- Popup fechado, cancelado, bloqueado, falha de rede e conta com outra credencial não redirecionam indevidamente no tratamento isolado desses erros.
- Recuperação de senha respeita campo vazio e cooldown e trata falha de rede.

## Reexecutar

```powershell
npm.cmd run test:login
```

A suíte fica em `tests/login.test.js`, usa o executor nativo do Node e não exige novas dependências. O comando dedicado e `npm test` executam os testes de regressão; os sete cenários originalmente defeituosos agora passam.

Validação local no navegador: `node tmp/validar-login-browser.cjs`. Esse script utiliza a instalação local de Playwright em `tmp/ui-validation`; os arquivos em `tmp` não são versionados. Resultados atuais do navegador: `tmp/login-browser-results.txt`.

## Limites

Os serviços Firebase/Google foram simulados. Não foi efetuado login com uma conta real nem validada a configuração publicada de OAuth, os domínios autorizados, a entrega real de e-mails ou o comportamento de popup no Safari/iPhone. Os resultados confirmam problemas no código da aplicação; não certificam a integração de produção de ponta a ponta.
