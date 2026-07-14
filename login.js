// ── Pro Povo — login.js ──
import {
  auth,
  provider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged
} from "./firebase.js";

// ── Se já estiver logado, vai direto pro index ──
onAuthStateChanged(auth, (user) => {
  if (user) window.location.href = "index.html";
});

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

// ── LOGIN com e-mail/senha ──
document.getElementById('btn-login')?.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) { showToast('⚠️ Preencha e-mail e senha.'); return; }

  setBtnLoading('btn-login', true);
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    showToast('✅ Login realizado! Redirecionando...');
    setTimeout(() => window.location.href = 'index.html', 1000);
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
    await salvarUsuario(cred.user.uid, { nome, email, cidade });
    showToast('✅ Conta criada! Bem-vindo ao Pro Povo.');
    setTimeout(() => window.location.href = 'index.html', 1000);
  } catch (e) {
    showToast('❌ ' + traduzirErro(e.code));
    setBtnLoading('btn-cadastrar', false, '<i class="ti ti-user-plus"></i> Criar minha conta');
  }
});

// ── LOGIN com Google ──
document.querySelectorAll('.btn-social').forEach(btn => {
  btn.addEventListener('click', async () => {
    window.location.href = 'AdmLogin.html';
  });
});

// ── Menu mobile ──
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('open');
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