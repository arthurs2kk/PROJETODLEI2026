// ── Pro Povo — admin-painel.js ──
import { auth, onAuthStateChanged, signOut } from "../firebase.js";
import { buscarRelatosGestaoPagina, buscarOrganizacao, atualizarStatus, salvarResposta, excluirRelato } from "../db.js";
import { buscarAdmin, ehSuperAdmin } from "./adminAuth.js";
import { otimizarImagem } from "../cloudinary.js";
import { escapeHTML } from "../escapeHtml.js";

const TAMANHO_PAGINA = 25;
const state = {
  todos: [],
  busca: '',
  status: 'todos',
  admin: null,
  temMais: true,
  carregando: false
};

// ── SLA: depois de quantos dias sem solução um relato é considerado atrasado ──
// Contado a partir da data de criação do relato. Fica isolado aqui pra ser
// fácil de ajustar (ex: definir um SLA diferente por categoria no futuro)
// sem precisar mexer no resto da lógica do painel.
const SLA_DIAS = 10;
const SLA_MS = SLA_DIAS * 24 * 60 * 60 * 1000;

function estaAtrasado(r) {
  return r.status !== 'resolvido' && (Date.now() - r.dataCriacao) > SLA_MS;
}

function diasEmAberto(r) {
  return Math.floor((Date.now() - r.dataCriacao) / 86400000);
}

// ── Tempo médio de resolução (em dias) ──
// Considera só relatos resolvidos que já têm dataResolucao gravada. Relatos
// marcados como resolvidos antes dessa métrica existir não entram na conta
// (não tem como saber quando foram resolvidos) — a métrica vai ficando mais
// precisa conforme relatos novos forem resolvidos.
function calcularTempoMedioResolucao(relatos) {
  const resolvidos = relatos.filter(r => r.status === 'resolvido' && r.dataResolucao);
  if (resolvidos.length === 0) return null;
  const totalDias = resolvidos.reduce((soma, r) => soma + (r.dataResolucao - r.dataCriacao), 0) / 86400000;
  return totalDias / resolvidos.length;
}

// ── Verificação de acesso ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'AdmLogin.html'; return; }

  const admin = await buscarAdmin(user.uid);
  if (!admin) {
    await signOut(auth);
    window.location.href = 'AdmLogin.html';
    return;
  }
  state.admin = admin;

  let org = null;
  if (admin.organizacaoId) {
    try {
      org = await buscarOrganizacao(admin.organizacaoId);
    } catch (e) {
      console.warn('Não foi possível carregar os dados da organização:', e);
    }
  }

  const tagHTML = `<i class="ti ti-user-shield"></i> ${escapeHTML(user.displayName || user.email)}${org?.nome ? escapeHTML(' · ' + org.nome) : ''}`;
  document.getElementById('admin-user-tag').innerHTML = tagHTML;
  document.getElementById('admin-user-tag-mobile').innerHTML = tagHTML;

  const badgeEl = document.getElementById('painel-escopo-badge');
  if (badgeEl) {
    badgeEl.innerHTML = ehSuperAdmin(admin)
      ? '<i class="ti ti-world"></i> Visão de todas as cidades'
      : `<i class="ti ti-map-pin"></i> ${escapeHTML(org?.cidadeNome || 'Município autorizado')}`;
  }
  document.getElementById('verificando').style.display = 'none';
  document.getElementById('painel-conteudo').style.display = 'block';

  await carregarProximaPagina();
});

async function carregarProximaPagina() {
  if (!state.admin || state.carregando || (!state.temMais && state.todos.length > 0)) return;
  state.carregando = true;
  atualizarControlesDePagina();

  const ultimo = state.todos[state.todos.length - 1];
  const cursor = ultimo
    ? { id: ultimo.id, dataCriacao: ultimo.dataCriacao }
    : null;

  try {
    const { itens, temMais } = await buscarRelatosGestaoPagina(
      state.admin,
      cursor,
      TAMANHO_PAGINA
    );
    const idsCarregados = new Set(state.todos.map(relato => relato.id));
    state.todos.push(...itens.filter(relato => !idsCarregados.has(relato.id)));
    state.temMais = temMais;
  } catch (erro) {
    console.error('Não foi possível carregar os relatos da gestão:', erro);
    showToast('⚠️ Não foi possível carregar os relatos.');
  } finally {
    state.carregando = false;
    render();
  }
}

async function recarregarRelatos() {
  if (state.carregando) return;
  state.todos = [];
  state.temMais = true;
  await carregarProximaPagina();
}

function atualizarControlesDePagina() {
  const botao = document.getElementById('btn-carregar-mais-admin');
  const atualizar = document.getElementById('btn-atualizar-relatos');
  const info = document.getElementById('admin-lote-info');
  const loader = document.getElementById('relatos-loader-admin');
  const container = document.getElementById('admin-lista');
  const empty = document.getElementById('lista-empty');
  const primeiroCarregamento = state.carregando && state.todos.length === 0;

  if (loader) loader.hidden = !primeiroCarregamento;
  if (container) container.style.display = primeiroCarregamento ? 'none' : 'flex';
  if (primeiroCarregamento && empty) empty.style.display = 'none';

  if (botao) {
    botao.style.display = !primeiroCarregamento && (state.temMais || state.carregando) ? 'inline-flex' : 'none';
    botao.disabled = state.carregando;
    botao.innerHTML = state.carregando
      ? '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Carregando...'
      : '<i class="ti ti-chevron-down"></i> Carregar relatos mais antigos';
  }
  if (atualizar) atualizar.disabled = state.carregando;
  if (info) {
    info.textContent = primeiroCarregamento
      ? 'Carregando o primeiro lote...'
      : state.temMais
        ? `${state.todos.length} relato${state.todos.length !== 1 ? 's' : ''} carregado${state.todos.length !== 1 ? 's' : ''}; existem registros mais antigos.`
        : `${state.todos.length} relato${state.todos.length !== 1 ? 's' : ''} carregado${state.todos.length !== 1 ? 's' : ''}.`;
  }
}

document.getElementById('btn-carregar-mais-admin')?.addEventListener('click', carregarProximaPagina);
document.getElementById('btn-atualizar-relatos')?.addEventListener('click', recarregarRelatos);

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
});

document.getElementById('btn-sair-mobile')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
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

  // "atrasados" não é um status de verdade — é calculado, então trata à parte
  if (state.status === 'atrasados') {
    lista = lista.filter(estaAtrasado);
  } else if (state.status !== 'todos') {
    lista = lista.filter(r => r.status === state.status);
  }

  lista.sort((a, b) => b.dataCriacao - a.dataCriacao);

  // Resumo do lote carregado, não de toda a base.
  const atrasados  = state.todos.filter(estaAtrasado);
  const tempoMedio = calcularTempoMedioResolucao(state.todos);

  document.getElementById('resumo-total').textContent      = state.todos.length;
  document.getElementById('resumo-aberto').textContent     = state.todos.filter(r => r.status === 'aberto').length;
  document.getElementById('resumo-andamento').textContent  = state.todos.filter(r => r.status === 'andamento').length;
  document.getElementById('resumo-resolvido').textContent  = state.todos.filter(r => r.status === 'resolvido').length;
  document.getElementById('resumo-atrasados').textContent  = atrasados.length;
  document.getElementById('resumo-tempo-medio').textContent =
    tempoMedio === null ? '—' : `${tempoMedio.toFixed(1)}d`;

  const container = document.getElementById('admin-lista');
  const empty = document.getElementById('lista-empty');
  empty.style.display = !state.carregando && lista.length === 0 ? 'block' : 'none';

  container.innerHTML = lista.map(cardHTML).join('');
  atualizarControlesDePagina();

  // Eventos
  lista.forEach(r => {
    document.getElementById(`foto-${r.id}`)?.addEventListener('click', (e) => {
      abrirLightbox(e.currentTarget.dataset.fotoUrl);
    });

    document.getElementById(`status-${r.id}`)?.addEventListener('change', async (e) => {
      const novoStatus = e.target.value;
      try {
        await atualizarStatus(r.id, novoStatus);
        r.status = novoStatus;
        r.dataResolucao = novoStatus === 'resolvido' ? Date.now() : null;
        render();
        showToast('✅ Status atualizado.');
      } catch (erro) {
        console.error(erro);
        e.target.value = r.status;
        showToast('⚠️ Não foi possível atualizar este relato.');
      }
    });

    document.getElementById(`btn-resp-${r.id}`)?.addEventListener('click', () => {
      document.getElementById(`resp-area-${r.id}`).classList.toggle('open');
    });

    document.getElementById(`btn-resp-salvar-${r.id}`)?.addEventListener('click', async () => {
      const texto = document.getElementById(`resp-texto-${r.id}`).value.trim();
      if (!texto) { showToast('⚠️ Escreva uma resposta antes de salvar.'); return; }
      try {
        await salvarResposta(r.id, texto);
        r.respostaOficial = texto;
        r.dataResposta = Date.now();
        render();
        showToast('✅ Resposta oficial salva.');
      } catch (erro) {
        console.error(erro);
        showToast('⚠️ Não foi possível salvar a resposta.');
      }
    });

    document.getElementById(`btn-excluir-${r.id}`)?.addEventListener('click', async () => {
      if (confirm(`Excluir o relato "${r.titulo}"? Essa ação não pode ser desfeita.`)) {
        try {
          await excluirRelato(r.id);
          state.todos = state.todos.filter(relato => relato.id !== r.id);
          render();
          showToast('🗑️ Relato excluído.');
        } catch (erro) {
          console.error(erro);
          showToast('⚠️ Não foi possível excluir este relato.');
        }
      }
    });
  });
}

// ── Card de gestão ──
function cardHTML(r) {
  const relatoId = escapeHTML(r.id);
  const status = ['aberto', 'andamento', 'resolvido'].includes(r.status) ? r.status : 'aberto';
  const votos = Number.isFinite(Number(r.votos)) ? Math.max(0, Number(r.votos)) : 0;
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');
  const atrasado = estaAtrasado(r);
  const fotoUrl = otimizarImagem(r.fotoUrl, 700);
  const resposta = r.respostaOficial
    ? `<div class="resposta-existente"><strong>Resposta oficial atual:</strong>${escapeHTML(r.respostaOficial)}</div>`
    : '';

  return `
    <article class="gestao-card ${atrasado ? 'gestao-card-atrasado' : ''}" data-status="${status}">
      <div class="gestao-top">
        <span class="gestao-titulo">${escapeHTML(r.titulo)}</span>
        <div class="gestao-top-badges">
          ${atrasado ? `<span class="badge-atrasado"><i class="ti ti-alert-triangle"></i> Atrasado · ${diasEmAberto(r)}d</span>` : ''}
          <span class="status status-${status}">${STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div class="gestao-meta">
        <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
        <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
        <span><i class="ti ti-clock"></i> ${data}</span>
        <span><i class="ti ti-thumb-up"></i> ${votos} votos</span>
      </div>
      ${fotoUrl ? `<img id="foto-${relatoId}" src="${escapeHTML(fotoUrl)}" data-foto-url="${escapeHTML(r.fotoUrl)}" alt="Foto do relato. Clique para ampliar" loading="lazy" class="gestao-foto" tabindex="0" role="button">` : ''}
      <p class="gestao-desc">${escapeHTML(r.descricao)}</p>

      <div class="gestao-controles">
        <select class="gestao-select" id="status-${relatoId}">
          <option value="aberto"    ${r.status === 'aberto'    ? 'selected' : ''}>Aberto</option>
          <option value="andamento" ${r.status === 'andamento' ? 'selected' : ''}>Em andamento</option>
          <option value="resolvido" ${r.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
        </select>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-${relatoId}">
          <i class="ti ti-message-circle"></i> Responder
        </button>
        <button class="btn-gestao btn-gestao-excluir" id="btn-excluir-${relatoId}">
          <i class="ti ti-trash"></i> Excluir
        </button>
      </div>

      <div class="gestao-resposta-area" id="resp-area-${relatoId}">
        ${resposta}
        <textarea id="resp-texto-${relatoId}" placeholder="Escreva a resposta oficial da prefeitura para este relato...">${escapeHTML(r.respostaOficial || '')}</textarea>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-salvar-${relatoId}">
          <i class="ti ti-send"></i> Salvar resposta
        </button>
      </div>
    </article>`;
}

const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');

function abrirLightbox(url) {
  if (!url || !lightboxOverlay || !lightboxImg) return;
  lightboxImg.src = url;
  lightboxOverlay.classList.add('open');
}

function fecharLightbox() {
  if (!lightboxOverlay || !lightboxImg) return;
  lightboxOverlay.classList.remove('open');
  lightboxImg.removeAttribute('src');
}

document.getElementById('lightbox-close')?.addEventListener('click', fecharLightbox);
lightboxOverlay?.addEventListener('click', (e) => {
  if (e.target === lightboxOverlay) fecharLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharLightbox();
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
