// ── Pro Povo — login.js ──
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, provider, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification } from "../firebase.js";
import { salvarUsuario, buscarUsuario } from "../db.js";
import { carregarCidadesPB } from "../cidades.js";
import { segundosRestantes, registrarEnvio } from "../cooldown.js";

// ── Se já estiver logado, vai direto pro index ──
// (exceto durante o login com Google, onde pode faltar completar o
// cadastro com a cidade antes de liberar o acesso — ver entrarComGoogle)
let googleFlowEmAndamento = false;

onAuthStateChanged(auth, (user) => {
  if (user && !googleFlowEmAndamento) window.location.href = "../../index.html";
});

// ── Carregar cidades da Paraíba no select de cadastro ──
// Isso garante que só é possível cadastrar uma cidade que realmente existe na Paraíba.
carregarCidadesPB(document.getElementById('cad-cidade'));

// ── Abas ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('form-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Mostrar/ocultar senha ──
function toggleSenha(btnId, inputId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    btn.querySelector('i').className = mostrar ? 'ti ti-eye-off' : 'ti ti-eye';
  });
}

toggleSenha('toggle-senha', 'login-senha');
toggleSenha('toggle-cad-senha', 'cad-senha');

// ── Força da senha ──
document.getElementById('cad-senha')?.addEventListener('input', (e) => {
  const val   = e.target.value;
  const fill  = document.getElementById('forca-fill');
  const texto = document.getElementById('forca-texto');
  let forca   = 0;

  if (val.length >= 8)           forca++;
  if (/[A-Z]/.test(val))        forca++;
  if (/[0-9]/.test(val))        forca++;
  if (/[^A-Za-z0-9]/.test(val)) forca++;

  const configs = [
    { pct: '0%',   cor: '',             txt: '',        txtCor: '' },
    { pct: '25%',  cor: '#CC2900',      txt: 'Fraca',   txtCor: '#CC2900' },
    { pct: '50%',  cor: '#C45C00',      txt: 'Regular', txtCor: '#C45C00' },
    { pct: '75%',  cor: '#FFCD07',      txt: 'Boa',     txtCor: '#7A5900' },
    { pct: '100%', cor: '#168821',      txt: 'Forte',   txtCor: '#168821' },
  ];

  const cfg = val.length === 0 ? configs[0] : (configs[forca] || configs[1]);
  fill.style.width      = cfg.pct;
  fill.style.background = cfg.cor;
  texto.textContent     = val.length === 0 ? '' : cfg.txt;
  texto.style.color     = cfg.txtCor;
});

// ── Mensagens de erro do Firebase em português ──
function traduzirErro(code) {
  const erros = {
    'auth/invalid-email':            'E-mail inválido.',
    'auth/user-not-found':           'Nenhuma conta encontrada com esse e-mail.',
    'auth/wrong-password':           'Senha incorreta.',
    'auth/email-already-in-use':     'Esse e-mail já está cadastrado.',
    'auth/weak-password':            'Senha muito fraca. Use pelo menos 6 caracteres.',
    'auth/too-many-requests':        'Muitas tentativas. Aguarde alguns minutos.',
    'auth/popup-closed-by-user':     'Login com Google cancelado.',
    'auth/popup-blocked':            'O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.',
    'auth/account-exists-with-different-credential': 'Esse e-mail já tem uma conta com senha. Entre com e-mail e senha.',
    'auth/network-request-failed':   'Erro de conexão. Verifique sua internet.',
    'auth/invalid-credential':       'E-mail ou senha incorretos.',
  };
  return erros[code] || 'Ocorreu um erro. Tente novamente.';
}

// ── Estado do botão ──
function setBtnLoading(btnId, loading, textoOriginal) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Aguarde...'
    : textoOriginal;
}

// ── Esqueci minha senha ──
document.getElementById('link-esqueci-senha')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();

  if (!email) {
    showToast('⚠️ Digite seu e-mail no campo acima e clique em "Esqueci minha senha" de novo.');
    return;
  }

  const chaveCooldown = `senha:${email.toLowerCase()}`;
  const restante = segundosRestantes(chaveCooldown);
  if (restante > 0) {
    showToast(`⏳ Você já pediu um link há pouco. Aguarde ${restante}s antes de pedir de novo.`);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    registrarEnvio(chaveCooldown);
    // Quem manda esse e-mail é o Firebase (domínio genérico, sem reputação própria),
    // então ele cai na caixa de spam com bastante frequência — deixamos isso avisado.
    showToast('📧 Enviamos um link de redefinição de senha. Verifique também a caixa de spam/lixo eletrônico!');
  } catch (e) {
    console.error(e);
    showToast('❌ ' + traduzirErro(e.code));
  }
});

// ── LOGIN com e-mail/senha ──
document.getElementById('btn-login')?.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) { showToast('⚠️ Preencha e-mail e senha.'); return; }

  setBtnLoading('btn-login', true);
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    showToast('✅ Login realizado! Redirecionando...');
    setTimeout(() => window.location.href = '../../index.html', 1000);
  } catch (e) {
    showToast('❌ ' + traduzirErro(e.code));
    setBtnLoading('btn-login', false, '<i class="ti ti-login"></i> Entrar');
  }
});

// ── CADASTRO com e-mail/senha ──
document.getElementById('btn-cadastrar')?.addEventListener('click', async () => {
  const nome   = document.getElementById('cad-nome').value.trim();
  const email  = document.getElementById('cad-email').value.trim();
  const cidade = document.getElementById('cad-cidade').value.trim();
  const senha  = document.getElementById('cad-senha').value;
  const termos = document.getElementById('aceito-termos').checked;

  if (!nome || !email || !cidade || !senha) { showToast('⚠️ Preencha todos os campos.'); return; }
  if (senha.length < 8) { showToast('⚠️ A senha deve ter pelo menos 8 caracteres.'); return; }
  if (!termos) { showToast('⚠️ Aceite os termos de uso para continuar.'); return; }

  setBtnLoading('btn-cadastrar', true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(cred.user, { displayName: nome });
    await salvarUsuario(cred.user.uid, { nome, email, cidade });

    // Envia o e-mail de confirmação, mas não trava o cadastro se isso falhar
    // por algum motivo — a conta já foi criada com sucesso de qualquer forma.
    // O usuário sempre pode reenviar depois pela tela de "Meu perfil".
    try {
      await sendEmailVerification(cred.user);
      registrarEnvio(`verificacao:${email.toLowerCase()}`);
    } catch (erroVerificacao) {
      console.warn('Não foi possível enviar o e-mail de confirmação agora:', erroVerificacao);
    }

    showToast('✅ Conta criada! Enviamos um e-mail de confirmação — não esqueça de checar a caixa de spam/lixo eletrônico.');
    setTimeout(() => window.location.href = '../../index.html', 3000);
  } catch (e) {
    showToast('❌ ' + traduzirErro(e.code));
    setBtnLoading('btn-cadastrar', false, '<i class="ti ti-user-plus"></i> Criar minha conta');
  }
});

// ── Login/cadastro com Google ──
// Só usado na tela de login de cidadãos: o painel administrativo (AdmLogin.html)
// continua exclusivamente com e-mail/senha, sem nenhuma ligação com este fluxo.
async function entrarComGoogle() {
  googleFlowEmAndamento = true;
  try {
    const cred = await signInWithPopup(auth, provider);
    const perfilExistente = await buscarUsuario(cred.user.uid);

    if (perfilExistente) {
      showToast('✅ Login realizado com Google!');
      setTimeout(() => window.location.href = '../../index.html', 800);
      return;
    }

    // Primeira vez com Google — falta a cidade pra completar o cadastro
    // (nome/e-mail vêm prontos, dataCadastro é preenchido em salvarUsuario)
    abrirModalGoogle(cred.user);
  } catch (e) {
    googleFlowEmAndamento = false;
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    console.error(e);
    showToast('❌ ' + traduzirErro(e.code));
  }
}

document.getElementById('btn-google-login')?.addEventListener('click', entrarComGoogle);
document.getElementById('btn-google-cadastro')?.addEventListener('click', entrarComGoogle);

// ── Modal: pedir a cidade pra quem entrou pela primeira vez com Google ──
function abrirModalGoogle(user) {
  carregarCidadesPB(document.getElementById('google-cidade'));
  document.getElementById('modal-google-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('google-continuar').onclick = async () => {
    const cidade = document.getElementById('google-cidade').value;
    if (!cidade) { showToast('⚠️ Selecione sua cidade para continuar.'); return; }

    const btn = document.getElementById('google-continuar');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Salvando...';

    try {
      await salvarUsuario(user.uid, {
        nome: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
        email: user.email,
        cidade
      });
      showToast('✅ Cadastro completo! Redirecionando...');
      setTimeout(() => window.location.href = '../../index.html', 800);
    } catch (e) {
      console.error(e);
      showToast('❌ Não foi possível concluir o cadastro. Tente novamente.');
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  };

  document.getElementById('google-cancelar').onclick = async () => {
    await signOut(auth);
    googleFlowEmAndamento = false;
    document.getElementById('modal-google-overlay').classList.remove('open');
    document.body.style.overflow = '';
  };
}

document.getElementById('modal-google-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-google-overlay') document.getElementById('google-cancelar')?.click();
});


// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Spinner CSS ──
const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);