// ── Pro Povo — login.js ──
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, provider, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence } from "../firebase.js";
import { salvarUsuario, buscarUsuario } from "../db.js";
import { carregarCidadesPB } from "../cidades.js";
import { segundosRestantes, registrarEnvio } from "../cooldown.js";

// Um único fluxo controla autenticação, conclusão do perfil e redirecionamento.
let fluxoEmAndamento = false;
const botoesAuth = ['btn-login', 'btn-cadastrar', 'btn-google-login', 'btn-google-cadastro', 'tab-entrar', 'tab-cadastro'];
const textosAuth = new Map(botoesAuth.map(id => [id, document.getElementById(id)?.innerHTML]));

function iniciarFluxo(btnId) {
  if (fluxoEmAndamento) return false;
  fluxoEmAndamento = true;
  botoesAuth.forEach(id => { document.getElementById(id).disabled = true; });
  if (btnId) setBtnLoading(btnId, true);
  return true;
}

function liberarFluxo() {
  fluxoEmAndamento = false;
  botoesAuth.forEach(id => setBtnLoading(id, false, textosAuth.get(id)));
}

function redirecionar(user, atraso = 0) {
  const navegar = () => {
    if (auth.currentUser?.uid === user.uid) window.location.href = '../../index.html';
    else liberarFluxo();
  };
  if (atraso) setTimeout(navegar, atraso);
  else navegar();
}

async function concluirEntrada(user) {
  const perfil = await buscarUsuario(user.uid);
  if (auth.currentUser?.uid !== user.uid) { liberarFluxo(); return; }
  if (!perfil) abrirModalGoogle(user);
  else redirecionar(user);
}

function persistenciaEscolhida() {
  return document.getElementById('lembrar').checked
    ? browserLocalPersistence : browserSessionPersistence;
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !iniciarFluxo()) return;
  try {
    await concluirEntrada(user);
  } catch (e) {
    showToast('❌ Não foi possível carregar seu cadastro. Tente entrar novamente.');
    liberarFluxo();
  }
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
document.getElementById('form-entrar')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (fluxoEmAndamento) return;
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;

  if (!email || !senha) { showToast('⚠️ Preencha e-mail e senha.'); return; }

  if (!iniciarFluxo('btn-login')) return;
  try {
    await setPersistence(auth, persistenciaEscolhida());
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    await concluirEntrada(cred.user);
  } catch (e) {
    showToast('❌ ' + traduzirErro(e.code));
    liberarFluxo();
  }
});

// ── CADASTRO com e-mail/senha ──
document.getElementById('btn-cadastrar')?.addEventListener('click', async () => {
  if (fluxoEmAndamento) return;
  const nome   = document.getElementById('cad-nome').value.trim();
  const email  = document.getElementById('cad-email').value.trim();
  const cidade = document.getElementById('cad-cidade').value.trim();
  const senha  = document.getElementById('cad-senha').value;
  const termos = document.getElementById('aceito-termos').checked;

  if (!nome || !email || !cidade || !senha) { showToast('⚠️ Preencha todos os campos.'); return; }
  if (senha.length < 8) { showToast('⚠️ A senha deve ter pelo menos 8 caracteres.'); return; }
  if (!termos) { showToast('⚠️ Aceite os termos de uso para continuar.'); return; }

  if (!iniciarFluxo('btn-cadastrar')) return;
  let usuarioCriado = null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    usuarioCriado = cred.user;
    await updateProfile(cred.user, { displayName: nome });
    await salvarUsuario(cred.user.uid, { nome, email, cidade });

    // Envia o e-mail de confirmação, mas não trava o cadastro se isso falhar
    // por algum motivo — a conta já foi criada com sucesso de qualquer forma.
    // O usuário sempre pode reenviar depois pela tela de "Meu perfil".
    let confirmacaoEnviada = false;
    try {
      await sendEmailVerification(cred.user);
      registrarEnvio(`verificacao:${email.toLowerCase()}`);
      confirmacaoEnviada = true;
    } catch (erroVerificacao) {
      console.warn('Não foi possível enviar o e-mail de confirmação agora:', erroVerificacao);
    }

    showToast(confirmacaoEnviada
      ? '✅ Conta criada! Enviamos um e-mail de confirmação — confira também a caixa de spam.'
      : '✅ Conta criada! Não foi possível enviar a confirmação agora. Reenvie em “Meu perfil”.');
    redirecionar(cred.user, 3000);
  } catch (e) {
    if (usuarioCriado && auth.currentUser?.uid === usuarioCriado.uid) {
      // A conta já existe. Permite completar o perfil sem tentar recriá-la.
      abrirModalGoogle(usuarioCriado);
      showToast('⚠️ Sua conta foi criada, mas falta concluir o cadastro. Selecione a cidade para tentar novamente.');
    } else {
      showToast('❌ ' + traduzirErro(e.code));
      liberarFluxo();
    }
  }
});

// ── Login/cadastro com Google ──
// Só usado na tela de login de cidadãos: o painel administrativo (AdmLogin.html)
// continua exclusivamente com e-mail/senha, sem nenhuma ligação com este fluxo.
async function entrarComGoogle(event) {
  if (!iniciarFluxo(event?.currentTarget?.id)) return;
  const persistencia = event?.currentTarget?.id === 'btn-google-cadastro'
    ? browserLocalPersistence : persistenciaEscolhida();
  try {
    // Abre o popup no próprio clique, sem aguardar operações de armazenamento.
    const cred = await signInWithPopup(auth, provider);
    await setPersistence(auth, persistencia);
    await concluirEntrada(cred.user);
  } catch (e) {
    liberarFluxo();
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    console.error(e);
    showToast('❌ ' + traduzirErro(e.code));
  }
}

document.getElementById('btn-google-login')?.addEventListener('click', entrarComGoogle);
document.getElementById('btn-google-cadastro')?.addEventListener('click', entrarComGoogle);

// ── Modal: pedir a cidade pra quem entrou pela primeira vez com Google ──
function abrirModalGoogle(user) {
  let salvando = false;
  let saindo = false;
  const continuar = document.getElementById('google-continuar');
  const cancelar = document.getElementById('google-cancelar');
  continuar.disabled = false;
  cancelar.disabled = false;
  continuar.innerHTML = '<i class="ti ti-arrow-right"></i> Continuar';
  carregarCidadesPB(document.getElementById('google-cidade'));
  document.getElementById('modal-google-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  document.getElementById('google-continuar').onclick = async () => {
    if (salvando || saindo || auth.currentUser?.uid !== user.uid) return;
    const cidade = document.getElementById('google-cidade').value;
    if (!cidade) { showToast('⚠️ Selecione sua cidade para continuar.'); return; }

    const btn = document.getElementById('google-continuar');
    const textoOriginal = btn.innerHTML;
    salvando = true;
    cancelar.disabled = true;
    btn.disabled = true;
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Salvando...';

    try {
      await salvarUsuario(user.uid, {
        nome: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário'),
        email: user.email,
        cidade
      });
      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user);
          registrarEnvio(`verificacao:${user.email.toLowerCase()}`);
        } catch (e) {
          console.warn('Não foi possível enviar a confirmação. Ela pode ser reenviada pelo perfil.', e);
        }
      }
      showToast('✅ Cadastro completo! Redirecionando...');
      redirecionar(user);
    } catch (e) {
      console.error(e);
      showToast('❌ Não foi possível concluir o cadastro. Tente novamente.');
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
      salvando = false;
      cancelar.disabled = false;
    }
  };

  document.getElementById('google-cancelar').onclick = async () => {
    if (salvando || saindo) return;
    saindo = true;
    continuar.disabled = true;
    cancelar.disabled = true;
    try {
      await signOut(auth);
      document.getElementById('modal-google-overlay').classList.remove('open');
      document.body.style.overflow = '';
      liberarFluxo();
    } catch (e) {
      showToast('❌ Não foi possível sair. Tente novamente.');
    } finally {
      saindo = false;
      continuar.disabled = false;
      cancelar.disabled = false;
    }
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
