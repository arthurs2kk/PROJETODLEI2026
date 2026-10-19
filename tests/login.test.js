"use strict";

// Diagnóstico do fluxo real de login.js, com Firebase e DOM isolados.
// Não cria contas, não envia e-mails e não acessa o projeto em produção.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'pages/userPages/login.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'js/pagesJS/login.js'), 'utf8');
const user = { uid: 'usuario-teste', email: 'teste@example.com', displayName: 'Pessoa de Teste', emailVerified: true, providerData: [{ providerId: 'google.com' }] };
const perfil = { nome: user.displayName, email: user.email, cidade: 'Campina Grande', dataCadastro: 1 };
const erro = code => Object.assign(new Error(code), { code });

function pendente() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function elemento(tag = '') {
  const classes = new Set((tag.match(/class="([^"]*)"/)?.[1] || '').split(/\s+/));
  const listeners = new Map();
  const attrs = new Map();
  const el = {
    id: tag.match(/id="([^"]*)"/)?.[1] || '',
    value: '', checked: false, disabled: false, innerHTML: '', textContent: '', style: {},
    dataset: { tab: tag.match(/data-tab="([^"]*)"/)?.[1] },
    type: tag.match(/type="([^"]*)"/)?.[1] || '',
    classList: { add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v) },
    addEventListener(type, callback) { listeners.set(type, [...(listeners.get(type) || []), callback]); },
    setAttribute: (name, value) => attrs.set(name, value),
    getAttribute: name => attrs.get(name),
    removeAttribute: name => attrs.delete(name),
    appendChild() {},
    querySelector() { return this.icon ||= { className: 'ti ti-eye' }; },
    async fire(type, event = {}) {
      if (type === 'click' && this.disabled) return;
      const e = { target: el, currentTarget: el, preventDefault() {}, ...event };
      const results = (listeners.get(type) || []).map(callback => callback(e));
      if (this['on' + type]) results.push(this['on' + type](e));
      await Promise.all(results);
    }
  };
  return el;
}

async function pagina(overrides = {}) {
  const elements = new Map([...html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)].map(([tag, id]) => [id, elemento(tag)]));
  // Simula a ação padrão de botões submit usando os formulários do HTML real.
  for (const [form, id] of html.matchAll(/<form\b[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/form>/g)) {
    for (const [, childId] of form.matchAll(/\bid="([^"]+)"/g)) elements.get(childId).form = elements.get(id);
  }
  const document = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => [...elements.values()].filter(el => el.classList.contains(selector.slice(1))),
    createElement: () => elemento(), head: elemento(), body: elemento()
  };
  const redirects = [], timers = [], calls = [];
  const auth = { currentUser: null };
  let persistence = 'local';
  let observer;
  const emitAuth = current => { auth.currentUser = current; return observer(current); };
  const record = (name, impl = async () => {}) => async (...args) => {
    calls.push({ name, args });
    return (overrides[name] || impl)(...args);
  };
  const firebase = {
    auth, provider: {},
    onAuthStateChanged: (_, callback) => { observer = callback; },
    signInWithEmailAndPassword: record('senha', async () => { emitAuth(user); return { user }; }),
    createUserWithEmailAndPassword: record('criar', async () => { emitAuth(user); return { user }; }),
    signInWithPopup: record('google', async () => { emitAuth(user); return { user }; }),
    signOut: record('sair', async () => { emitAuth(null); }),
    updateProfile: record('nome'), sendPasswordResetEmail: record('reset'), sendEmailVerification: record('verificar'),
    setPersistence: record('persistencia', async (_, mode) => { persistence = mode; }),
    browserLocalPersistence: 'local', browserSessionPersistence: 'session'
  };
  const dependencies = {
    '../firebase.js': firebase,
    '../db.js': { salvarUsuario: record('salvar'), buscarUsuario: record('buscar', async () => perfil) },
    '../cidades.js': { carregarCidadesPB: record('cidades') },
    '../cooldown.js': { segundosRestantes: () => overrides.cooldown || 0, registrarEnvio: record('cooldown') }
  };
  const context = vm.createContext({
    document, console: { error() {}, warn() {} },
    window: { location: { set href(value) { redirects.push(value); } } },
    setTimeout(callback, ms) { timers.push({ callback, ms }); return timers.length; },
    clearTimeout() {}
  });
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(specifier => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Dependência inesperada: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await mod.evaluate();
  const get = id => elements.get(id);
  const preencher = (values = { 'login-email': ' teste@example.com ', 'login-senha': ' Senha123! ' }) => {
    for (const [id, value] of Object.entries(values)) get(id)[typeof value === 'boolean' ? 'checked' : 'value'] = value;
  };
  return {
    get, calls, redirects, auth, emitAuth, preencher, persistence: () => persistence,
    async click(id) {
      const el = get(id);
      if (el.disabled) return;
      await el.fire('click');
      if (el.type === 'submit' && el.form && !el.disabled) await el.form.fire('submit');
    },
    toast: () => get('toast').textContent,
    count: name => calls.filter(call => call.name === name).length,
    runTimers() { for (const timer of timers.splice(0)) timer.callback(); }
  };
}

test('senha: campos vazios não chamam o Firebase', async () => {
  const p = await pagina();
  await p.click('btn-login');
  assert.equal(p.count('senha'), 0);
  assert.match(p.toast(), /Preencha e-mail e senha/);
});

test('senha: remove espaços do e-mail, preserva a senha e redireciona após sucesso', async () => {
  const p = await pagina();
  p.preencher();
  await p.click('btn-login');
  const args = p.calls.find(c => c.name === 'senha').args;
  assert.equal(args[1], user.email);
  assert.equal(args[2], ' Senha123! ');
  assert.ok(p.redirects.includes('../../index.html'));
});

for (const [code, message] of [
  ['auth/invalid-credential', /E-mail ou senha incorretos/],
  ['auth/wrong-password', /Senha incorreta/],
  ['auth/invalid-email', /E-mail inválido/],
  ['auth/too-many-requests', /Muitas tentativas/],
  ['auth/network-request-failed', /Erro de conexão/]
]) {
  test(`senha: ${code} mostra erro e permite tentar novamente`, async () => {
    const p = await pagina({ senha: async () => { throw erro(code); } });
    p.preencher();
    await p.click('btn-login');
    assert.match(p.toast(), message);
    assert.equal(p.get('btn-login').disabled, false);
    assert.equal(p.redirects.length, 0);
  });
}

test('senha: clique repetido no botão não duplica a solicitação', async () => {
  const wait = pendente();
  const p = await pagina({ senha: () => wait.promise });
  p.preencher();
  const first = p.click('btn-login');
  await p.click('btn-login');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(p.count('senha'), 1);
  wait.reject(erro('auth/network-request-failed'));
  await first;
});

for (const lembrar of [false, true]) {
  test(`senha: Lembrar de mim=${lembrar} configura a persistência correspondente`, async () => {
    const p = await pagina();
    p.preencher();
    p.get('lembrar').checked = lembrar;
    await p.click('btn-login');
    assert.equal(p.persistence(), lembrar ? 'local' : 'session', 'A escolha Lembrar de mim não foi aplicada à sessão');
  });
}

test('Google: perfil existente entra sem pedir cidade novamente', async () => {
  const p = await pagina();
  await p.click('btn-google-login');
  assert.equal(p.count('google'), 1);
  assert.equal(p.count('buscar'), 1);
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), false);
  p.runTimers();
  assert.ok(p.redirects.includes('../../index.html'));
});

test('Google: primeiro acesso aguarda cidade antes de redirecionar', async () => {
  const p = await pagina({ buscar: async () => null });
  await p.click('btn-google-cadastro');
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), true);
  p.runTimers();
  assert.equal(p.redirects.length, 0);
  await p.click('google-continuar');
  assert.equal(p.count('salvar'), 0);
  p.get('google-cidade').value = 'Campina Grande';
  await p.click('google-continuar');
  assert.equal(p.count('salvar'), 0, 'O cadastro prosseguiu sem aceitar os documentos');
  p.get('google-aceito-termos').checked = true;
  await p.click('google-continuar');
  const saved = p.calls.find(c => c.name === 'salvar');
  assert.equal(saved.args[0], user.uid);
  assert.equal(saved.args[1].cidade, 'Campina Grande');
  p.runTimers();
  assert.ok(p.redirects.includes('../../index.html'));
});

test('Google: falha ao salvar a cidade mantém o modal e permite tentar novamente', async () => {
  const p = await pagina({ buscar: async () => null, salvar: async () => { throw erro('PERMISSION_DENIED'); } });
  await p.click('btn-google-login');
  p.get('google-cidade').value = 'Campina Grande';
  p.get('google-aceito-termos').checked = true;
  await p.click('google-continuar');
  assert.equal(p.get('google-continuar').disabled, false);
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), true);
  assert.equal(p.redirects.length, 0);
  assert.match(p.toast(), /Não foi possível concluir/);
});

test('Google: cancelar o cadastro sai da conta e fecha o modal', async () => {
  const p = await pagina({ buscar: async () => null });
  await p.click('btn-google-login');
  await p.click('google-cancelar');
  assert.equal(p.auth.currentUser, null);
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), false);
  assert.equal(p.redirects.length, 0);
});

for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked', 'auth/network-request-failed', 'auth/account-exists-with-different-credential']) {
  test(`Google: ${code} não redireciona nem bloqueia nova tentativa`, async () => {
    const p = await pagina({ google: async () => { throw erro(code); } });
    await p.click('btn-google-login');
    assert.equal(p.redirects.length, 0);
    assert.equal(p.get('btn-google-login').disabled, false);
    if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code)) assert.match(p.toast(), /❌/);
    await p.click('btn-google-login');
    assert.equal(p.count('google'), 2);
  });
}

test('Google: cliques repetidos abrem apenas uma solicitação de autenticação', async () => {
  const wait = pendente();
  const p = await pagina({ google: () => wait.promise });
  const first = p.click('btn-google-login');
  const second = p.click('btn-google-login');
  const count = p.count('google');
  wait.reject(erro('auth/popup-closed-by-user'));
  await Promise.all([first, second]);
  assert.equal(count, 1, 'O botão abriu solicitações concorrentes do Google');
});

test('Google: login por senha não começa enquanto o popup está pendente', async () => {
  const wait = pendente();
  const p = await pagina({ google: () => wait.promise });
  p.preencher();
  const first = p.click('btn-google-login');
  await p.click('btn-login');
  wait.reject(erro('auth/popup-closed-by-user'));
  await first;
  assert.equal(p.count('senha'), 0, 'Dois métodos de autenticação foram iniciados ao mesmo tempo');
});

test('Google: falha de leitura do perfil não libera acesso ao recarregar a página', async () => {
  const p = await pagina({ buscar: async () => { throw erro('PERMISSION_DENIED'); } });
  await p.click('btn-google-login');
  assert.match(p.toast(), /❌/);
  // Simula a sessão persistida sendo entregue ao observador após recarregar.
  const restored = await pagina({ buscar: async () => { throw erro('PERMISSION_DENIED'); } });
  await restored.emitAuth(p.auth.currentUser);
  assert.equal(restored.redirects.length, 0, 'A sessão sem perfil validado foi redirecionada ao início');
});

test('Google: sessão restaurada sem perfil retoma a escolha da cidade', async () => {
  const p = await pagina({ buscar: async () => null });
  await p.emitAuth(user);
  assert.equal(p.redirects.length, 0, 'O observador redirecionou antes de verificar o cadastro');
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), true);
});

test('Google: não permite cancelar e sair durante a gravação do cadastro', async () => {
  const wait = pendente();
  const p = await pagina({ buscar: async () => null, salvar: () => wait.promise });
  await p.click('btn-google-login');
  p.get('google-cidade').value = 'Campina Grande';
  p.get('google-aceito-termos').checked = true;
  const saving = p.click('google-continuar');
  await p.click('google-cancelar');
  wait.resolve();
  await saving;
  assert.equal(p.count('sair'), 0, 'A conta saiu enquanto o perfil ainda estava sendo gravado');
});

test('cadastro por senha: aguarda salvar o perfil antes de redirecionar', async () => {
  const wait = pendente();
  const p = await pagina({ salvar: () => wait.promise });
  p.preencher({ 'cad-nome': user.displayName, 'cad-email': user.email, 'cad-cidade': 'Campina Grande', 'cad-senha': 'Senha123!', 'aceito-termos': true });
  const registering = p.click('btn-cadastrar');
  await new Promise(resolve => setImmediate(resolve));
  const earlyRedirects = [...p.redirects];
  wait.resolve();
  await registering;
  assert.equal(earlyRedirects.length, 0, 'O observador de autenticação redirecionou antes de salvar o perfil');
});

test('recuperação: e-mail vazio não envia mensagem', async () => {
  const p = await pagina();
  await p.click('link-esqueci-senha');
  assert.equal(p.count('reset'), 0);
});

test('recuperação: cooldown impede reenvio', async () => {
  const p = await pagina({ cooldown: 45 });
  p.preencher();
  await p.click('link-esqueci-senha');
  assert.equal(p.count('reset'), 0);
  assert.match(p.toast(), /45s/);
});

test('recuperação: falha de rede permite tentar novamente', async () => {
  const p = await pagina({ reset: async () => { throw erro('auth/network-request-failed'); } });
  p.preencher();
  await p.click('link-esqueci-senha');
  assert.match(p.toast(), /Erro de conexão/);
  assert.equal(p.count('cooldown'), 0);
});

test('senha: erro ao configurar persistência libera os botões sem autenticar', async () => {
  const p = await pagina({ persistencia: async () => { throw erro('auth/web-storage-unsupported'); } });
  p.preencher();
  await p.click('btn-login');
  assert.equal(p.count('senha'), 0);
  assert.equal(p.get('btn-login').disabled, false);
  assert.equal(p.get('btn-google-login').disabled, false);
});

for (const lembrar of [false, true]) {
  test(`Google: respeita Lembrar de mim=${lembrar} sem atrasar a abertura do popup`, async () => {
    const p = await pagina();
    p.get('lembrar').checked = lembrar;
    await p.click('btn-google-login');
    assert.equal(p.persistence(), lembrar ? 'local' : 'session');
    assert.ok(p.calls.findIndex(c => c.name === 'google') < p.calls.findIndex(c => c.name === 'persistencia'));
  });
}

function preencherCadastro(p) {
  p.preencher({ 'cad-nome': user.displayName, 'cad-email': user.email, 'cad-cidade': 'Campina Grande', 'cad-senha': 'Senha123!', 'aceito-termos': true });
}

test('cadastro por senha: erro na criação libera ambos os métodos de login', async () => {
  const p = await pagina({ criar: async () => { throw erro('auth/email-already-in-use'); } });
  preencherCadastro(p);
  await p.click('btn-cadastrar');
  assert.equal(p.get('btn-cadastrar').disabled, false);
  assert.equal(p.get('btn-google-login').disabled, false);
  assert.equal(p.count('salvar'), 0);
  assert.match(p.toast(), /já está cadastrado/);
});

test('cadastro por senha: aguarda o envio da confirmação antes de navegar', async () => {
  const wait = pendente();
  const p = await pagina({ verificar: () => wait.promise });
  preencherCadastro(p);
  const registering = p.click('btn-cadastrar');
  await new Promise(resolve => setImmediate(resolve));
  p.runTimers();
  assert.equal(p.count('salvar'), 1);
  assert.equal(p.count('verificar'), 1);
  assert.equal(p.redirects.length, 0);
  wait.resolve();
  await registering;
  p.runTimers();
  assert.equal(p.redirects.length, 1);
});

test('cadastro por senha: falha no e-mail informa como reenviar sem alegar envio', async () => {
  const p = await pagina({ verificar: async () => { throw erro('auth/network-request-failed'); } });
  preencherCadastro(p);
  await p.click('btn-cadastrar');
  assert.match(p.toast(), /Não foi possível enviar/);
  assert.doesNotMatch(p.toast(), /Enviamos/);
  p.runTimers();
  assert.equal(p.redirects.length, 1);
});

test('cadastro por senha: falha no perfil permite concluir sem criar outra conta', async () => {
  let tentativas = 0;
  const p = await pagina({ salvar: async () => { if (++tentativas === 1) throw erro('NETWORK_ERROR'); } });
  preencherCadastro(p);
  await p.click('btn-cadastrar');
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), true);
  assert.equal(p.redirects.length, 0);
  p.get('google-cidade').value = 'Campina Grande';
  p.get('google-aceito-termos').checked = true;
  await p.click('google-continuar');
  assert.equal(p.count('criar'), 1);
  assert.equal(p.count('salvar'), 2);
  assert.equal(p.redirects.length, 1);
});

test('Google: falha ao sair mantém o modal e permite cancelar novamente', async () => {
  const p = await pagina({ buscar: async () => null, sair: async () => { throw erro('auth/network-request-failed'); } });
  await p.click('btn-google-login');
  await p.click('google-cancelar');
  assert.equal(p.get('modal-google-overlay').classList.contains('open'), true);
  assert.equal(p.get('google-cancelar').disabled, false);
  assert.equal(p.get('google-continuar').disabled, false);
  assert.match(p.toast(), /Não foi possível sair/);
});

test('Google: não inicia gravação enquanto a saída está pendente', async () => {
  const wait = pendente();
  const p = await pagina({ buscar: async () => null, sair: () => wait.promise });
  await p.click('btn-google-login');
  p.get('google-cidade').value = 'Campina Grande';
  const leaving = p.click('google-cancelar');
  await p.click('google-continuar');
  assert.equal(p.count('salvar'), 0);
  wait.resolve();
  await leaving;
});

test('sessão restaurada: resposta antiga do perfil não redireciona após sair', async () => {
  const wait = pendente();
  const p = await pagina({ buscar: () => wait.promise });
  const restoring = p.emitAuth(user);
  await p.emitAuth(null);
  wait.resolve(perfil);
  await restoring;
  assert.equal(p.redirects.length, 0);
  assert.equal(p.get('btn-login').disabled, false);
});
