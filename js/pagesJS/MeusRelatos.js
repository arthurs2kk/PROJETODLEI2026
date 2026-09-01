// ── Pro Povo — meus-relatos.js ──
import { auth, onAuthStateChanged } from "../firebase.js";
import { ouvirRelatosDoUsuario, atualizarRelatoDoUsuario, excluirRelato } from "../db.js";
import { initNavbar } from "../navbar.js";
import { escapeHTML } from "../escapeHtml.js";
import { otimizarImagem } from "../cloudinary.js";

const state = { todos: [], busca: '', status: 'todos', relatoEditando: null };

// ── Navbar (login/cadastro/nome do usuário/sair/perfil) ──
initNavbar();



// ── Exige login para acessar esta página ──
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  ouvirRelatosDoUsuario(user.uid, (relatos) => {
    state.todos = relatos;
    render();
  });
});

const CATS = {
  'Buraco / Via danificada': { label: 'Buraco',       badge: 'badge-buraco' },
  'Iluminação pública':      { label: 'Iluminação',   badge: 'badge-ilum'   },
  'Lixo / Entulho':          { label: 'Lixo',         badge: 'badge-lixo'   },
  'Água / Esgoto':           { label: 'Água/Esgoto',  badge: 'badge-agua'   },
  'Áreas verdes':            { label: 'Áreas verdes', badge: 'badge-lixo'   },
  'Outros':                  { label: 'Outros',       badge: 'badge-outros' },
};

const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido' };
const STATUS_CSS   = { aberto: 'status-aberto', andamento: 'status-andamento', resolvido: 'status-resolvido' };

// ── Busca e filtro ──
document.getElementById('busca-input')?.addEventListener('input', (e) => {
  state.busca = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  state.status = e.target.value;
  render();
});

// ── Render principal ──
function render() {
  let lista = [...state.todos];

  if (state.busca) {
    lista = lista.filter(r =>
      r.titulo.toLowerCase().includes(state.busca) ||
      r.endereco.toLowerCase().includes(state.busca)
    );
  }
  if (state.status !== 'todos') lista = lista.filter(r => r.status === state.status);

  const container = document.getElementById('meus-lista');
  const empty = document.getElementById('lista-empty');
  empty.style.display = state.todos.length === 0 ? 'block' : 'none';
  container.style.display = state.todos.length === 0 ? 'none' : 'flex';

  container.innerHTML = lista.map(cardHTML).join('');

  lista.forEach(r => {
    document.getElementById(`btn-editar-${r.id}`)?.addEventListener('click', () => abrirEdicao(r));
    document.getElementById(`btn-excluir-${r.id}`)?.addEventListener('click', async () => {
      if (confirm(`Excluir o relato "${r.titulo}"? Essa ação não pode ser desfeita.`)) {
        await excluirRelato(r.id);
        showToast('🗑️ Relato excluído.');
      }
    });
  });
}

// ── Card de um relato do usuário ──
function cardHTML(r) {
  const cat  = CATS[r.categoria] || CATS['Outros'];
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');
  const podeEditar = r.status === 'aberto';

  const resposta = r.respostaOficial
    ? `<div class="resposta-cidadao"><strong><i class="ti ti-building-community"></i> Resposta da prefeitura:</strong><p>${escapeHTML(r.respostaOficial)}</p></div>`
    : '';

  const controles = podeEditar
    ? `<div class="meu-relato-controles">
         <button class="btn-meu-relato btn-meu-editar" id="btn-editar-${r.id}"><i class="ti ti-edit"></i> Editar</button>
         <button class="btn-meu-relato btn-meu-excluir" id="btn-excluir-${r.id}"><i class="ti ti-trash"></i> Excluir</button>
       </div>`
    : `<div class="meu-relato-bloqueado">
         <i class="ti ti-lock"></i> Este relato já está "${STATUS_LABEL[r.status]}" e não pode mais ser editado ou excluído.
       </div>`;

  return `
    <article class="meu-relato-card" data-status="${escapeHTML(r.status)}">
      <div class="meu-relato-top">
        <span class="meu-relato-titulo">${escapeHTML(r.titulo)}</span>
        <span class="status ${STATUS_CSS[r.status]}">${STATUS_LABEL[r.status]}</span>
      </div>
      <div class="card-tags"><span class="badge ${cat.badge}"><i class="ti ti-tag"></i> ${cat.label}</span></div>
      ${otimizarImagem(r.fotoUrl, 700) ? `<img src="${escapeHTML(otimizarImagem(r.fotoUrl, 700))}" alt="Foto do relato" loading="lazy" class="meu-relato-foto">` : ''}
      <p class="meu-relato-desc">${escapeHTML(r.descricao)}</p>
      ${resposta}
      <div class="meu-relato-meta">
        <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
        <span><i class="ti ti-clock"></i> ${data}</span>
        <span><i class="ti ti-thumb-up"></i> ${r.votos || 0} votos</span>
      </div>
      ${controles}
    </article>`;
}

// ── Modal de edição ──
function abrirEdicao(r) {
  state.relatoEditando = r;
  document.getElementById('ed-titulo').value = r.titulo;
  document.getElementById('ed-cat').value    = r.categoria;
  document.getElementById('ed-desc').value   = r.descricao;
  document.getElementById('modal-editar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fecharEdicao() {
  document.getElementById('modal-editar-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.relatoEditando = null;
}

document.getElementById('editar-close')?.addEventListener('click', fecharEdicao);
document.getElementById('editar-cancelar')?.addEventListener('click', fecharEdicao);
document.getElementById('modal-editar-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-editar-overlay') fecharEdicao();
});

document.getElementById('editar-salvar')?.addEventListener('click', async () => {
  if (!state.relatoEditando) return;

  const titulo    = document.getElementById('ed-titulo').value.trim();
  const categoria = document.getElementById('ed-cat').value;
  const descricao = document.getElementById('ed-desc').value.trim();

  if (titulo.length < 5)     { showToast('⚠️ O título deve ter pelo menos 5 caracteres.'); return; }
  if (descricao.length < 10) { showToast('⚠️ A descrição deve ter pelo menos 10 caracteres.'); return; }

  const btn = document.getElementById('editar-salvar');
  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Salvando...';

  try {
    await atualizarRelatoDoUsuario(state.relatoEditando.id, { titulo, categoria, descricao });
    showToast('✅ Relato atualizado com sucesso!');
    fecharEdicao();
  } catch (e) {
    console.error(e);
    showToast('❌ Erro ao salvar. Tente novamente.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  }
});

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ── Spinner ──
const s = document.createElement('style');
s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(s);
