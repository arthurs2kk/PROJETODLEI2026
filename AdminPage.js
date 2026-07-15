// ── Pro Povo — admin-painel.js ──
import { auth, onAuthStateChanged, signOut } from "./firebase.js";
import { ehAdmin, ouvirRelatos, atualizarStatus, salvarResposta, excluirRelato } from "./db.js";

const state = { todos: [], busca: '', status: 'todos' };

// ── Verificação de acesso ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'admin-login.html'; return; }

  const autorizado = await ehAdmin(user.uid);
  if (!autorizado) {
    await signOut(auth);
    window.location.href = 'admin-login.html';
    return;
  }

  document.getElementById('admin-user-tag').innerHTML =
    `<i class="ti ti-user-shield"></i> ${user.displayName || user.email}`;
  document.getElementById('verificando').style.display = 'none';
  document.getElementById('painel-conteudo').style.display = 'block';

  ouvirRelatos((relatos) => {
    state.todos = relatos;
    render();
  });
});

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'admin-login.html';
});

// ── Busca e filtro ──
document.getElementById('busca-input')?.addEventListener('input', (e) => {
  state.busca = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  state.status = e.target.value;
  render();
});

const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido' };

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

  lista.sort((a, b) => b.dataCriacao - a.dataCriacao);

  // Resumo (sempre com todos os relatos, não filtrado)
  document.getElementById('resumo-total').textContent      = state.todos.length;
  document.getElementById('resumo-aberto').textContent     = state.todos.filter(r => r.status === 'aberto').length;
  document.getElementById('resumo-andamento').textContent  = state.todos.filter(r => r.status === 'andamento').length;
  document.getElementById('resumo-resolvido').textContent  = state.todos.filter(r => r.status === 'resolvido').length;

  const container = document.getElementById('admin-lista');
  const empty = document.getElementById('lista-empty');
  empty.style.display = lista.length === 0 ? 'block' : 'none';

  container.innerHTML = lista.map(cardHTML).join('');

  // Eventos
  lista.forEach(r => {
    document.getElementById(`status-${r.id}`)?.addEventListener('change', async (e) => {
      await atualizarStatus(r.id, e.target.value);
      showToast('✅ Status atualizado.');
    });

    document.getElementById(`btn-resp-${r.id}`)?.addEventListener('click', () => {
      document.getElementById(`resp-area-${r.id}`).classList.toggle('open');
    });

    document.getElementById(`btn-resp-salvar-${r.id}`)?.addEventListener('click', async () => {
      const texto = document.getElementById(`resp-texto-${r.id}`).value.trim();
      if (!texto) { showToast('⚠️ Escreva uma resposta antes de salvar.'); return; }
      await salvarResposta(r.id, texto);
      showToast('✅ Resposta oficial salva.');
    });

    document.getElementById(`btn-excluir-${r.id}`)?.addEventListener('click', async () => {
      if (confirm(`Excluir o relato "${r.titulo}"? Essa ação não pode ser desfeita.`)) {
        await excluirRelato(r.id);
        showToast('🗑️ Relato excluído.');
      }
    });
  });
}

// ── Card de gestão ──
function cardHTML(r) {
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');
  const resposta = r.respostaOficial
    ? `<div class="resposta-existente"><strong>Resposta oficial atual:</strong>${r.respostaOficial}</div>`
    : '';

  return `
    <article class="gestao-card" data-status="${r.status}">
      <div class="gestao-top">
        <span class="gestao-titulo">${r.titulo}</span>
        <span class="status status-${r.status}">${STATUS_LABEL[r.status]}</span>
      </div>
      <div class="gestao-meta">
        <span><i class="ti ti-map-pin"></i> ${r.endereco}</span>
        <span><i class="ti ti-user"></i> ${r.autorNome}</span>
        <span><i class="ti ti-clock"></i> ${data}</span>
        <span><i class="ti ti-thumb-up"></i> ${r.votos || 0} votos</span>
      </div>
      <p class="gestao-desc">${r.descricao}</p>

      <div class="gestao-controles">
        <select class="gestao-select" id="status-${r.id}">
          <option value="aberto"    ${r.status === 'aberto'    ? 'selected' : ''}>Aberto</option>
          <option value="andamento" ${r.status === 'andamento' ? 'selected' : ''}>Em andamento</option>
          <option value="resolvido" ${r.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
        </select>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-${r.id}">
          <i class="ti ti-message-circle"></i> Responder
        </button>
        <button class="btn-gestao btn-gestao-excluir" id="btn-excluir-${r.id}">
          <i class="ti ti-trash"></i> Excluir
        </button>
      </div>

      <div class="gestao-resposta-area" id="resp-area-${r.id}">
        ${resposta}
        <textarea id="resp-texto-${r.id}" placeholder="Escreva a resposta oficial da prefeitura para este relato...">${r.respostaOficial || ''}</textarea>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-salvar-${r.id}">
          <i class="ti ti-send"></i> Salvar resposta
        </button>
      </div>
    </article>`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}