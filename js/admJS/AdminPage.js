// ── Pro Povo — admin-painel.js ──
import { auth, onAuthStateChanged, signOut } from "../firebase.js";
import { ouvirRelatosGestao, atualizarStatus, salvarResposta, excluirRelato, buscarUsuario, buscarOrganizacao } from "../db.js";
import { buscarAdmin, ehSuperAdmin } from "./adminAuth.js";
import { otimizarImagem } from "../cloudinary.js";
import { notificarMudancaStatus, notificarNovaResposta } from "../notificacoes.js";
import { escapeHTML } from "../escapeHtml.js";
import { normalizar } from "../populacao.js";

const state = { todos: [], busca: '', status: 'todos', categoria: 'todos', cidade: '', admin: null };

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

// ── Busca os dados do autor e dispara a notificação, sem travar a interface do
// admin caso isso demore ou falhe (ex: EmailJS ainda não configurado) ──
function notificarAutor(relato, enviar) {
  buscarUsuario(relato.autorId)
    .then(usuario => enviar(usuario))
    .catch(erro => console.warn('Não foi possível carregar os dados do autor pra notificar:', erro));
}

// ── Extrai a cidade "legível" de um relato (usada só pro filtro de cidade,
// que só aparece pro superadmin). Mesmo padrão de fallback usado em
// relatos.js e AdminGraficos.js: prioriza o campo cidade (já vem do
// Nominatim em relatos novos), com fallback lendo o texto do endereço pros
// relatos antigos que não têm esse campo. ──
function extrairCidade(r) {
  if (r.cidade) return r.cidade;
  const partes = (r.endereco || '').split(',').map(p => p.trim()).filter(Boolean);
  const idxPB = partes.findIndex(p => normalizar(p).includes('paraiba'));
  return idxPB > 0 ? (partes[idxPB - 1] || null) : null;
}

function listaCidadesComRelatos(relatos) {
  const set = new Set();
  relatos.forEach(r => {
    const cidade = extrairCidade(r);
    if (cidade) set.add(cidade);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Atualiza as opções do filtro de cidade — só relevante pro superadmin,
// já que um admin de cidade só recebe relatos da própria cidade mesmo
// (o select fica escondido no HTML pra ele, então isso é um no-op nesse caso). ──
function atualizarSeletorCidades() {
  if (!ehSuperAdmin(state.admin)) return;

  const select = document.getElementById('filtro-cidade');
  if (!select) return;

  const atual = select.value;
  const cidades = listaCidadesComRelatos(state.todos);

  select.replaceChildren(new Option('Todas as cidades', ''));
  cidades.forEach(cidade => select.appendChild(new Option(cidade, cidade)));
  select.value = cidades.includes(atual) ? atual : '';
}

// ── Verificação de acesso + escopo por cidade ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'AdmLogin.html'; return; }

  const admin = await buscarAdmin(user.uid);
  if (!admin) {
    await signOut(auth);
    window.location.href = 'AdmLogin.html';
    return;
  }
  state.admin = admin;

  // Busca o nome da prefeitura (quando o admin pertence a uma organização) só
  // uma vez aqui, e reaproveita tanto no "crachá" quanto no selo de escopo.
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
      : `<i class="ti ti-map-pin"></i> ${escapeHTML(org?.cidadeNome || 'Cidade não identificada')}`;
  }

  // O filtro de cidade só faz sentido pra quem vê mais de uma cidade
  if (ehSuperAdmin(admin)) {
    document.getElementById('filtro-cidade')?.style.setProperty('display', '');
  }

  document.getElementById('verificando').style.display = 'none';
  document.getElementById('painel-conteudo').style.display = 'block';

  // ouvirRelatosGestao já filtra por cityId automaticamente quando o admin
  // não é superadmin — o resto do painel não precisa saber disso.
  ouvirRelatosGestao(admin, (relatos) => {
    state.todos = relatos;
    atualizarSeletorCidades();
    render();
  });
});

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
});

document.getElementById('btn-sair-mobile')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
});


// ── Busca e filtros ──
document.getElementById('busca-input')?.addEventListener('input', (e) => {
  state.busca = e.target.value.trim().toLowerCase();
  render();
});
document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  state.status = e.target.value;
  render();
});
document.getElementById('filtro-categoria')?.addEventListener('change', (e) => {
  state.categoria = e.target.value;
  render();
});
document.getElementById('filtro-cidade')?.addEventListener('change', (e) => {
  state.cidade = e.target.value;
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

  if (state.categoria !== 'todos') lista = lista.filter(r => r.categoria === state.categoria);

  if (state.cidade) {
    lista = lista.filter(r => normalizar(extrairCidade(r)) === normalizar(state.cidade));
  }

  // "atrasados" não é um status de verdade — é calculado, então trata à parte
  if (state.status === 'atrasados') {
    lista = lista.filter(estaAtrasado);
  } else if (state.status !== 'todos') {
    lista = lista.filter(r => r.status === state.status);
  }

  lista.sort((a, b) => b.dataCriacao - a.dataCriacao);

  // Resumo (sempre com todos os relatos, não filtrado — mas já vem escopado
  // por cidade quando aplicável, então "todos" aqui já significa "todos os
  // relatos que esse admin tem permissão de ver")
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
  empty.style.display = lista.length === 0 ? 'block' : 'none';

  container.innerHTML = lista.map(cardHTML).join('');

  // Eventos
  lista.forEach(r => {
    document.querySelector(`[data-relato-foto="${r.id}"]`)?.addEventListener('click', (e) => {
      abrirLightbox(e.currentTarget.dataset.fotoUrl);
    });

    document.getElementById(`status-${r.id}`)?.addEventListener('change', async (e) => {
      const novoStatus = e.target.value;
      await atualizarStatus(r.id, novoStatus);
      showToast('✅ Status atualizado.');
      notificarAutor(r, (usuario) => notificarMudancaStatus(usuario, r, novoStatus));
    });

    document.getElementById(`btn-resp-${r.id}`)?.addEventListener('click', () => {
      document.getElementById(`resp-area-${r.id}`).classList.toggle('open');
    });

    document.getElementById(`btn-resp-salvar-${r.id}`)?.addEventListener('click', async () => {
      const texto = document.getElementById(`resp-texto-${r.id}`).value.trim();
      if (!texto) { showToast('⚠️ Escreva uma resposta antes de salvar.'); return; }
      await salvarResposta(r.id, texto);
      showToast('✅ Resposta oficial salva.');
      notificarAutor(r, (usuario) => notificarNovaResposta(usuario, r, texto));
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
  const atrasado = estaAtrasado(r);
  const fotoUrl = otimizarImagem(r.fotoUrl, 700);
  const resposta = r.respostaOficial
    ? `<div class="resposta-existente"><strong>Resposta oficial atual:</strong>${escapeHTML(r.respostaOficial)}</div>`
    : '';

  return `
    <article class="gestao-card ${atrasado ? 'gestao-card-atrasado' : ''}" data-status="${escapeHTML(r.status)}">
      <div class="gestao-top">
        <span class="gestao-titulo">${escapeHTML(r.titulo)}</span>
        <div class="gestao-top-badges">
          ${atrasado ? `<span class="badge-atrasado"><i class="ti ti-alert-triangle"></i> Atrasado · ${diasEmAberto(r)}d</span>` : ''}
          <span class="status status-${r.status}">${STATUS_LABEL[r.status]}</span>
        </div>
      </div>
      <div class="gestao-meta">
        <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
        <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
        <span><i class="ti ti-clock"></i> ${data}</span>
        <span><i class="ti ti-thumb-up"></i> ${r.votos || 0} votos</span>
      </div>
      ${fotoUrl ? `<img src="${escapeHTML(fotoUrl)}" data-relato-foto="${escapeHTML(r.id)}" data-foto-url="${escapeHTML(r.fotoUrl)}" alt="Foto do relato. Clique para ampliar" loading="lazy" class="gestao-foto" tabindex="0" role="button">` : ''}
      <p class="gestao-desc">${escapeHTML(r.descricao)}</p>

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
        <textarea id="resp-texto-${r.id}" placeholder="Escreva a resposta oficial da prefeitura para este relato...">${escapeHTML(r.respostaOficial || '')}</textarea>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-salvar-${r.id}">
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