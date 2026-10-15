// ── Pro Povo — relatos.js ──
import { buscarRelatosPagina, buscarRelatoPorId } from "../db.js";
import { obterMunicipiosPB } from "../cidades.js";
import { CIDADES_ATIVAS_RELATOS } from "../abrangencia-relatos.js";
import { initNavbar } from "../navbar.js";
import { otimizarImagem } from "../cloudinary.js";
import { escapeHTML } from "../escapeHtml.js";
import { respostaPrefeituraHTML } from '../respostaPrefeitura.js';

// ── Navbar (login/cadastro/nome do usuário/sair/perfil) ──
initNavbar();

const TAMANHO_PAGINA = 25;

const state = {
  todos: [],          // relatos já carregados (todas as páginas somadas)
  busca: '',
  cidade: CIDADES_ATIVAS_RELATOS?.length === 1 ? CIDADES_ATIVAS_RELATOS[0].id : '',
  categoria: 'todos',
  status: 'todos',
  sortCol: 'dataCriacao',
  sortDir: 'desc',
  temMais: false,
  carregando: false,
  erroCarregamento: false,
  versaoConsulta: 0
};

// ── Configurações visuais por categoria/status ──
const CATS = {
  'Buraco / Via danificada': { label: 'Buraco',       badge: 'badge-buraco' },
  'Iluminação pública':      { label: 'Iluminação',   badge: 'badge-ilum'   },
  'Lixo / Entulho':          { label: 'Lixo',         badge: 'badge-lixo'   },
  'Água / Esgoto':           { label: 'Água/Esgoto',  badge: 'badge-agua'   },
  'Áreas verdes':            { label: 'Áreas verdes', badge: 'badge-lixo'   },
  'Outros':                  { label: 'Outros',       badge: 'badge-outros' },
};

const STATUS = {
  aberto:    { label: 'Aberto',       css: 'status-aberto'    },
  andamento: { label: 'Em andamento', css: 'status-andamento' },
  resolvido: { label: 'Resolvido',    css: 'status-resolvido' },
};

// ── Seletor de cidade: acompanha a abrangência ativa dos relatos ──
async function preencherSeletorCidades() {
  const select = document.getElementById('filtro-cidade');
  if (!select) return;

  try {
    const cidades = CIDADES_ATIVAS_RELATOS || await obterMunicipiosPB();
    select.replaceChildren();
    if (cidades.length > 1) select.appendChild(new Option('Todas as cidades ativas', ''));
    cidades.forEach(cidade => select.appendChild(new Option(cidade.nome, cidade.id)));
    select.value = state.cidade;
  } catch (e) {
    console.warn('Não foi possível carregar a lista de cidades:', e);
    select.replaceChildren(new Option('Cidades indisponíveis', ''));
    select.disabled = true;
  }
}

document.getElementById('filtro-cidade')?.addEventListener('change', (e) => {
  state.cidade = e.target.value;
  reiniciarConsulta();
});

// ── Busca ──
document.getElementById('busca-input')?.addEventListener('input', (e) => {
  state.busca = e.target.value.trim().toLowerCase();
  render();
});

// ── Filtros ──
document.getElementById('filtro-categoria')?.addEventListener('change', (e) => {
  state.categoria = e.target.value;
  reiniciarConsulta();
});

document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  state.status = e.target.value;
  reiniciarConsulta();
});

// ── Ordenação por coluna ──
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.sort;
    if (state.sortCol === col) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortCol = col;
      state.sortDir = 'desc';
    }
    render();
  });
});

// ── Paginação: carrega em lotes de TAMANHO_PAGINA, do mais recente pro mais
// antigo. Isso substitui o antigo "baixar a tabela inteira de uma vez". ──
function reiniciarConsulta() {
  // Uma resposta antiga pode chegar depois que o usuário trocar novamente os
  // filtros. A versão permite ignorá-la sem precisar cancelar a conexão.
  state.versaoConsulta += 1;
  state.todos = [];
  state.temMais = true;
  state.carregando = false;
  state.erroCarregamento = false;
  render();
  void carregarProximaPagina();
}

async function carregarProximaPagina() {
  if (state.carregando || (!state.temMais && state.todos.length > 0)) return;
  const versao = state.versaoConsulta;
  state.carregando = true;
  state.erroCarregamento = false;
  atualizarIndicadorCarregamento();
  atualizarBotaoCarregarMais();

  const ultimo = state.todos[state.todos.length - 1];
  const cursor = ultimo ? { dataCriacao: ultimo.dataCriacao, id: ultimo.id } : null;

  try {
    const { itens, temMais } = await buscarRelatosPagina(cursor, TAMANHO_PAGINA, {
      usarCache: cursor === null,
      cidade: state.cidade,
      categoria: state.categoria,
      status: state.status
    });
    if (versao !== state.versaoConsulta) return;
    const idsCarregados = new Set(state.todos.map(relato => relato.id));
    state.todos.push(...itens.filter(relato => !idsCarregados.has(relato.id)));
    state.temMais = temMais;
  } catch (e) {
    if (versao !== state.versaoConsulta) return;
    state.erroCarregamento = true;
    console.error('Não foi possível carregar os relatos:', e);
  } finally {
    if (versao !== state.versaoConsulta) return;
    state.carregando = false;
    render();
  }
}

function atualizarIndicadorCarregamento() {
  const loader = document.getElementById('relatos-loader-lista');
  if (loader) loader.hidden = !(state.carregando && state.todos.length === 0);
}

function atualizarBotaoCarregarMais() {
  const btn = document.getElementById('btn-carregar-mais');
  if (!btn) return;
  const carregamentoInicial = state.carregando && state.todos.length === 0;
  const mostrar = !carregamentoInicial && (state.temMais || state.carregando || state.erroCarregamento);
  btn.style.display = mostrar ? 'inline-flex' : 'none';
  btn.disabled = state.carregando;
  if (state.carregando) {
    btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Carregando...';
  } else if (state.erroCarregamento) {
    btn.innerHTML = '<i class="ti ti-refresh"></i> Tentar novamente';
  } else {
    btn.innerHTML = '<i class="ti ti-chevron-down"></i> Carregar mais relatos';
  }
}

document.getElementById('btn-carregar-mais')?.addEventListener('click', carregarProximaPagina);

// ── Renderização principal ──
function render() {
  let lista = [...state.todos];

  if (state.busca) {
    lista = lista.filter(r =>
      r.titulo.toLowerCase().includes(state.busca) ||
      r.endereco.toLowerCase().includes(state.busca)
    );
  }

  lista.sort((a, b) => {
    let va = a[state.sortCol], vb = b[state.sortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('tabela-body');
  const empty = document.getElementById('tabela-empty');
  const emptyIcon = document.getElementById('tabela-empty-icon');
  const emptyText = document.getElementById('tabela-empty-texto');
  const contagem = document.getElementById('relatos-contagem');

  const buscaAtiva = Boolean(state.busca);

  let texto = `Mostrando ${lista.length} de ${state.todos.length} relato${state.todos.length !== 1 ? 's' : ''} carregado${state.todos.length !== 1 ? 's' : ''}`;
  if (state.erroCarregamento) {
    texto = state.todos.length === 0
      ? 'Não foi possível carregar os relatos.'
      : `${texto} — não foi possível buscar o próximo lote.`;
  } else if (buscaAtiva && state.temMais) {
    texto += ' — a busca por texto considera os relatos já carregados neste filtro';
  }
  contagem.textContent = texto;

  atualizarIndicadorCarregamento();
  empty.style.display = !state.carregando && lista.length === 0 ? 'block' : 'none';
  if (emptyIcon) emptyIcon.className = state.erroCarregamento
    ? 'ti ti-alert-triangle'
    : 'ti ti-mood-empty';
  if (emptyText) emptyText.textContent = state.erroCarregamento
    ? 'Não foi possível carregar os relatos. Tente novamente.'
    : 'Nenhum relato encontrado com esses filtros.';

  tbody.innerHTML = lista.map(linhaHTML).join('');

  tbody.querySelectorAll('.btn-tabela-detalhe').forEach((btn, i) => {
    btn.addEventListener('click', () => abrirDetalhe(lista[i]));
  });

  atualizarBotaoCarregarMais();
}

// ── Linha da tabela ──
function linhaHTML(r) {
  const cat = CATS[r.categoria]  || CATS['Outros'];
  const st  = STATUS[r.status]   || STATUS.aberto;
  const votos = Number.isFinite(Number(r.votos)) ? Math.max(0, Number(r.votos)) : 0;
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');

  return `
    <tr>
      <td class="td-titulo" data-label="Título">${escapeHTML(r.titulo)}</td>
      <td data-label="Categoria"><span class="badge ${cat.badge}">${cat.label}</span></td>
      <td data-label="Status"><span class="status ${st.css}">${st.label}</span></td>
      <td class="td-endereco" data-label="Endereço">${escapeHTML(r.endereco)}</td>
      <td class="td-votos" data-label="Votos">${votos}</td>
      <td data-label="Data">${data}</td>
      <td class="td-acao" data-label=""><button class="btn-tabela-detalhe">Ver detalhes</button></td>
    </tr>`;
}

// ── Modal de detalhes (mesmo padrão da home) ──
const detalhesRelatos = new Map();
let detalheSolicitacao = 0;

async function abrirDetalhe(resumo) {
  const solicitacao = ++detalheSolicitacao;
  document.getElementById('detalhe-titulo').textContent = resumo.titulo;
  document.getElementById('detalhe-desc').textContent = 'Carregando detalhes...';
  document.getElementById('detalhe-foto').innerHTML = '';
  document.getElementById('detalhe-resposta').innerHTML = '';
  document.getElementById('modal-detalhe-overlay').classList.add('open');

  try {
    let r = detalhesRelatos.get(resumo.id);
    if (!r) {
      r = await buscarRelatoPorId(resumo.id);
      if (r) detalhesRelatos.set(resumo.id, r);
    }
    if (solicitacao !== detalheSolicitacao) return;
    if (!r) throw new Error('Relato não encontrado.');
    preencherDetalhe(r);
  } catch (erro) {
    console.error('Não foi possível carregar os detalhes:', erro);
    if (solicitacao === detalheSolicitacao) {
      document.getElementById('detalhe-desc').textContent = 'Não foi possível carregar os detalhes deste relato.';
    }
  }
}

function preencherDetalhe(r) {
  const cat = CATS[r.categoria] || CATS['Outros'];
  const st  = STATUS[r.status]  || STATUS.aberto;

  document.getElementById('detalhe-titulo').textContent = r.titulo;
  document.getElementById('detalhe-desc').textContent   = r.descricao;
  document.getElementById('detalhe-foto').innerHTML = r.fotoUrl
    ? `<img src="${escapeHTML(otimizarImagem(r.fotoUrl, 700))}" alt="Foto do relato" loading="lazy" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:280px; object-fit:cover;">`
    : '';
  document.getElementById('detalhe-resposta').innerHTML = respostaPrefeituraHTML(r);
  document.getElementById('detalhe-tags').innerHTML = `
    <span class="badge ${cat.badge}">${cat.label}</span>
    <span class="status ${st.css}">${st.label}</span>`;
  document.getElementById('detalhe-meta').innerHTML = `
    <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
    <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
    <span><i class="ti ti-clock"></i> ${new Date(r.dataCriacao).toLocaleString('pt-BR')}</span>`;
}

document.getElementById('detalhe-close')?.addEventListener('click', fecharDetalhe);
document.getElementById('detalhe-fechar-btn')?.addEventListener('click', fecharDetalhe);
function fecharDetalhe() {
  document.getElementById('modal-detalhe-overlay').classList.remove('open');
}

// ── Spinner (usado no botão "Carregar mais") ──
const s = document.createElement('style');
s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(s);

// ── Inicialização ──
preencherSeletorCidades();
carregarProximaPagina(); // primeira página
