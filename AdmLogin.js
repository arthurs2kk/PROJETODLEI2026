// ── Pro Povo — admin-login.js ──
import { auth, signInWithEmailAndPassword, signOut } from "./firebase.js";
import { ehAdmin } from "./db.js";

// ── Mostrar/ocultar senha ──
document.getElementById('toggle-admin-senha')?.addEventListener('click', () => {
  const input = document.getElementById('admin-senha');
  const btn   = document.getElementById('toggle-admin-senha');
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  btn.querySelector('i').className = mostrar ? 'ti ti-eye-off' : 'ti ti-eye';
});

// ── Traduzir erros ──
function traduzirErro(code) {
  const erros = {
    'auth/invalid-email':          'E-mail inválido.',
    'auth/user-not-found':         'Nenhuma conta encontrada com esse e-mail.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-credential':     'E-mail ou senha incorretos.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
  };
  return erros[code] || 'Ocorreu um erro. Tente novamente.';
}

// ── Login administrativo ──
document.getElementById('btn-admin-login')?.addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const senha = document.getElementById('admin-senha').value;

  if (!email || !senha) {
    showToast('⚠️ Preencha e-mail e senha.');
    return;
  }

  const btn = document.getElementById('btn-admin-login');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Verificando...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    const autorizado = await ehAdmin(cred.user.uid);

    if (!autorizado) {
      await signOut(auth);
      showToast('🚫 Essa conta não tem permissão de administrador.');
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-shield-lock"></i> Acessar painel';
      return;
    }

    showToast('✅ Acesso autorizado! Redirecionando...');
    setTimeout(() => window.location.href = 'admin-painel.html', 1000);

  } catch (e) {
    showToast('❌ ' + traduzirErro(e.code));
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-shield-lock"></i> Acessar painel';
  }
});

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

const s = document.createElement('style');
s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(s);