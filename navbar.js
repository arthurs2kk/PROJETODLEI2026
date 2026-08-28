// ── Pro Povo — navbar.js ──
// Módulo compartilhado por index.html, relatos.html e mapa.html.
// Responsável por:
//   1) Atualizar os botões "Entrar"/"Criar conta" para o nome do usuário + "Sair" quando logado
//      (antes isso só acontecia em home.js, por isso relatos e mapa continuavam mostrando
//      "Entrar"/"Criar conta" mesmo com o usuário autenticado).
//   2) Abrir um modal de "Meu perfil" ao clicar no nome do usuário, permitindo editar
//      nome e cidade, enviar um e-mail de redefinição de senha, e ver/reenviar a
//      confirmação de e-mail caso ainda não tenha sido verificado.

import { auth, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification } from "./firebase.js";
import { buscarUsuario, atualizarUsuario } from "./db.js";
import { carregarCidadesPB } from "./cidades.js";
import { segundosRestantes, registrarEnvio } from "./cooldown.js";
import { escapeHTML } from "./escapeHtml.js";

const MODAL_HTML = `
  <div class="modal-overlay" id="perfil-overlay">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title-group">
          <div class="modal-icon"><i class="ti ti-user-circle"></i></div>
          <h2 class="modal-title">Meu perfil</h2>
        </div>
        <button class="modal-close" id="perfil-close"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nome completo</label>
          <input type="text" class="form-input" id="perfil-nome" placeholder="Seu nome" />
        </div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-input" id="perfil-email" disabled />
          <div class="perfil-verificacao" id="perfil-verificacao"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Cidade (Paraíba)</label>
          <select class="form-input" id="perfil-cidade">
            <option value="">Carregando cidades...</option>
          </select>
        </div>
        <p class="form-note"><i class="ti ti-lock"></i> Para trocar sua senha, enviaremos um link de redefinição para o seu e-mail.</p>
      </div>
      <div class="modal-footer">
        <button class="btn-outline" id="perfil-trocar-senha"><i class="ti ti-key"></i> Alterar senha</button>
        <button class="btn-primary" id="perfil-salvar"><i class="ti ti-device-floppy"></i> Salvar alterações</button>
      </div>
    </div>
  </div>
`;

function garantirModal() {
  if (document.getElementById('perfil-overlay')) return;
  document.body.insertAdjacentHTML('beforeend', MODAL_HTML);

  document.getElementById('perfil-close')?.addEventListener('click', fecharPerfil);
  document.getElementById('perfil-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'perfil-overlay') fecharPerfil();
  });
}

function abrirPerfil() {
  garantirModal();
  document.getElementById('perfil-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharPerfil() {
  document.getElementById('perfil-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Mostra se o e-mail já foi confirmado; se não, oferece reenviar ──
function renderStatusVerificacao(user, el) {
  if (!el) return;

  if (user.emailVerified) {
    el.innerHTML = `<span class="verificacao-ok"><i class="ti ti-circle-check"></i> E-mail verificado</span>`;
    return;
  }

  el.innerHTML = `
    <span class="verificacao-pendente"><i class="ti ti-alert-circle"></i> E-mail não verificado</span>
    <button type="button" class="link-reenviar" id="btn-reenviar-verificacao">Reenviar e-mail</button>`;

  document.getElementById('btn-reenviar-verificacao')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const chaveCooldown = `verificacao:${(user.email || '').toLowerCase()}`;
    const restante = segundosRestantes(chaveCooldown);
    if (restante > 0) {
      showToast(`⏳ E-mail já enviado há pouco. Aguarde ${restante}s antes de reenviar.`);
      return;
    }

    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      await sendEmailVerification(user);
      registrarEnvio(chaveCooldown);
      showToast('📧 E-mail de confirmação reenviado. Confira também a caixa de spam!');
    } catch (erro) {
      console.error(erro);
      showToast('❌ Não foi possível reenviar agora. Tente de novo em alguns minutos.');
    } finally {
      btn.disabled = false;
      btn.textContent = textoOriginal;
    }
  });
}

async function preencherPerfil(user) {
  const inputNome     = document.getElementById('perfil-nome');
  const inputEmail    = document.getElementById('perfil-email');
  const selectCidade  = document.getElementById('perfil-cidade');
  const verificacaoEl = document.getElementById('perfil-verificacao');

  inputEmail.value = user.email || '';
  renderStatusVerificacao(user, verificacaoEl);

  let dados = null;
  try {
    dados = await buscarUsuario(user.uid);
  } catch (e) {
    console.warn('Não foi possível carregar os dados do perfil:', e);
  }

  inputNome.value = (dados && dados.nome) || user.displayName || '';
  await carregarCidadesPB(selectCidade, (dados && dados.cidade) || '');
}

async function salvarPerfil(user) {
  const btn = document.getElementById('perfil-salvar');
  const nome   = document.getElementById('perfil-nome').value.trim();
  const cidade = document.getElementById('perfil-cidade').value;

  if (!nome) { showToast('⚠️ O nome não pode ficar vazio.'); return; }
  if (!cidade) { showToast('⚠️ Selecione sua cidade.'); return; }

  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Salvando...';

  try {
    await updateProfile(user, { displayName: nome });
    await atualizarUsuario(user.uid, { nome, cidade, email: user.email });

    // Atualiza o nome exibido na navbar na hora, sem precisar recarregar a página
    document.querySelectorAll('#btn-entrar, #btn-entrar-mobile').forEach(b => {
      if (b) b.innerHTML = `<i class="ti ti-user-circle"></i> ${escapeHTML(nome)}`;
    });

    showToast('✅ Perfil atualizado com sucesso!');
    fecharPerfil();
  } catch (e) {
    console.error(e);
    showToast('❌ Erro ao salvar. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  }
}

async function trocarSenha(user) {
  if (!user.email) return;

  const chaveCooldown = `senha:${user.email.toLowerCase()}`;
  const restante = segundosRestantes(chaveCooldown);
  if (restante > 0) {
    showToast(`⏳ Link já enviado há pouco. Aguarde ${restante}s antes de pedir de novo.`);
    return;
  }

  try {
    await sendPasswordResetEmail(auth, user.email);
    registrarEnvio(chaveCooldown);
    // Mesma observação de sempre: é o Firebase quem envia (domínio genérico),
    // então o e-mail cai na caixa de spam com bastante frequência.
    showToast('📧 Link de redefinição de senha enviado. Verifique também a caixa de spam/lixo eletrônico!');
  } catch (e) {
    console.error(e);
    const mensagens = {
      'auth/too-many-requests': '⏳ Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
      'auth/invalid-email':     '❌ E-mail inválido.',
      'auth/user-not-found':    '❌ Não encontramos uma conta com esse e-mail.',
      'auth/network-request-failed': '❌ Erro de conexão. Verifique sua internet.'
    };
    showToast(mensagens[e.code] || '❌ Não foi possível enviar o e-mail. Tente novamente.');
  }
}

// ── Atualiza os botões da navbar (desktop e mobile) conforme o login ──
export function initNavbar() {
  const btnEntrar          = document.getElementById('btn-entrar');
  const btnCadastrar       = document.getElementById('btn-cadastrar');
  const btnEntrarMobile    = document.getElementById('btn-entrar-mobile');
  const btnCadastrarMobile = document.getElementById('btn-cadastrar-mobile');
  const navMeusRelatos     = document.getElementById('nav-meus-relatos');
  const mobileMeusRelatos  = document.getElementById('mobile-meus-relatos');

  onAuthStateChanged(auth, (user) => {
    if (navMeusRelatos)    navMeusRelatos.style.display    = user ? '' : 'none';
    if (mobileMeusRelatos) mobileMeusRelatos.style.display = user ? '' : 'none';

    if (user) {
      const nome = user.displayName || user.email.split('@')[0];

      [btnEntrar, btnEntrarMobile].forEach(b => {
        if (!b) return;
        b.innerHTML = `<i class="ti ti-user-circle"></i> ${escapeHTML(nome)}`;
        b.title = 'Ver meu perfil';
        b.onclick = () => { abrirPerfil(); preencherPerfil(user); };
      });

      [btnCadastrar, btnCadastrarMobile].forEach(b => {
        if (!b) return;
        b.textContent = 'Sair';
        b.title = '';
        b.onclick = async () => {
          await signOut(auth);
          window.location.href = 'index.html';
        };
      });

      garantirModal();
      document.getElementById('perfil-salvar').onclick    = () => salvarPerfil(user);
      document.getElementById('perfil-trocar-senha').onclick = () => trocarSenha(user);

    } else {
      [btnEntrar, btnEntrarMobile].forEach(b => {
        if (!b) return;
        b.textContent = 'Entrar';
        b.title = '';
        b.onclick = () => window.location.href = 'login.html';
      });

      [btnCadastrar, btnCadastrarMobile].forEach(b => {
        if (!b) return;
        b.textContent = 'Criar conta';
        b.title = '';
        b.onclick = () => window.location.href = 'login.html';
      });

      fecharPerfil();
    }
  });
}

// ── Toast (mesma lógica usada nas outras páginas) ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}