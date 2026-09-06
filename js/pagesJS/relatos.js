// ── Pro Povo — relatos.js ──
import { buscarRelatosPagina, obterCidadesComRelatos, ouvirContadores } from "../db.js";
import { initNavbar } from "../navbar.js";
import { otimizarImagem } from "../cloudinary.js";
import { normalizar } from "../populacao.js";
import { escapeHTML } from "../escapeHtml.js";

// ── Navbar (login/cadastro/nome do usuário/sair/perfil) ──
initNavbar();

const TAMANHO_PAGINA = 30;

const state = {
  todos: [],          // relatos já carregados (todas as páginas somadas)
  totalGeral: 0,       // total real, vindo de metadados/contadores
  busca: '',
  cidade: '',
  categoria: 'todos',
  status: 'todos',
  sortCol: 'dataCriacao',
  sortDir: 'desc',
  temMais: false,
  carregando: false
};

// ── Extrai a cidade de um relato ──
// Relatos criados a partir de agora já vêm com a cidade salva direto do Nominatim.
// Relatos antigos não têm esse campo — pra eles, cai no fallback lendo o texto do
// endereço, que é salvo como "rua, bairro, cidade, Paraíba, Região Nordeste, Brasil".
function extrairCidade(r) {
  if (r.cidade) return r.cidade;

  const partes = (r.endereco || '').split(',').map(p => p.trim()).filter(Boolean);
  const idxPB = partes.findIndex(p => normalizar(p).includes('paraiba'));
  return idxPB > 0 ? (partes[idxPB - 1] || null) : null;
}

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

// ── Seletor de cidade: vem de metadados/cidades, não da página carregada ──
// (assim ele já mostra todas as cidades desde o início, sem depender de
// quantas páginas de relatos já foram baixadas)
async function preencherSeletorCidades() {
  const select = document.getElementById('filtro-cidade');
  if (!select) return;

  try {
    const cidades = (await obterCidadesComRelatos()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.replaceChildren(new Option('Todas as cidades', ''));
    cidades.forEach(cidade => select.appendChild(new Option(cidade, cidade)));
    select.value = state.cidade;
  } catch (e) {
    console.warn('Não foi possível carregar a lista de cidades:', e);
  }
}

document.getElementById('filtro-cidade')?.addEventListener('change', (e) => {
  state.cidade = e.target.value;
  render();
});

// ── Busca ──
document.getElementById('busca-input')?.addEventListener('input', (e) => {
  state.busca = e.target.value.trim().toLowerCase();
  render();
});

// ── Filtros ──
document.getElementById('filtro-categoria')?.addEventListener('change', (e) => {
  state.categoria = e.target.value;
  render();
});

document.getElementById('filtro-status')?.addEventListener('change', (e) => {
  state.status = e.target.value;
  render();
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
async function carregarProximaPagina() {
  if (state.carregando || (!state.temMais && state.todos.length > 0)) return;
  state.carregando = true;
  atualizarBotaoCarregarMais();

  const ultimo = state.todos[state.todos.length - 1];
  const cursor = ultimo ? { dataCriacao: ultimo.dataCriacao, id: ultimo.id } : null;

  try {
    const { itens, temMais } = await buscarRelatosPagina(cursor, TAMANHO_PAGINA);
    state.todos.push(...itens);
    state.temMais = temMais;
  } catch (e) {
    console.error('Não foi possível carregar os relatos:', e);
  } finally {
    state.carregando = false;
    render();
  }
}

function atualizarBotaoCarregarMais() {
  const btn = document.getElementById('btn-carregar-mais');
  if (!btn) return;
  const mostrar = state.temMais || state.carregando;
  btn.style.display = mostrar ? 'inline-flex' : 'none';
  btn.disabled = state.carregando;
  btn.innerHTML = state.carregando
    ? '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Carregando...'
    : '<i class="ti ti-chevron-down"></i> Carregar mais relatos';
}

document.getElementById('btn-carregar-mais')?.addEventListener('click', carregarProximaPagina);

// ── Total real de relatos (não depende de quanto já foi carregado) ──
ouvirContadores((contadores) => {
  state.totalGeral = contadores.total || 0;
  render();
});

// ── Renderização principal ──
function render() {
  let lista = [...state.todos];

  if (state.cidade) {
    lista = lista.filter(r => normalizar(extrairCidade(r)) === normalizar(state.cidade));
  }

  if (state.busca) {
    lista = lista.filter(r =>
      r.titulo.toLowerCase().includes(state.busca) ||
      r.endereco.toLowerCase().includes(state.busca)
    );
  }

  if (state.categoria !== 'todos') lista = lista.filter(r => r.categoria === state.categoria);
  if (state.status !== 'todos')    lista = lista.filter(r => r.status === state.status);

  lista.sort((a, b) => {
    let va = a[state.sortCol], vb = b[state.sortCol];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
    if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById('tabela-body');
  const empty = document.getElementById('tabela-empty');
  const contagem = document.getElementById('relatos-contagem');

  const filtroAtivo = Boolean(state.busca || state.categoria !== 'todos' || state.status !== 'todos' || state.cidade);

  let texto = `Mostrando ${lista.length} de ${state.todos.length} relato${state.todos.length !== 1 ? 's' : ''} carregado${state.todos.length !== 1 ? 's' : ''}`;
  if (state.totalGeral) texto += ` (${state.totalGeral} no total)`;
  if (filtroAtivo && state.temMais) texto += ' — clique em "Carregar mais" pra incluir relatos mais antigos nesse filtro';
  contagem.textContent = texto;

  empty.style.display = lista.length === 0 ? 'block' : 'none';

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
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');

  return `
    <tr>
      <td class="td-titulo" data-label="Título">${escapeHTML(r.titulo)}</td>
      <td data-label="Categoria"><span class="badge ${cat.badge}">${cat.label}</span></td>
      <td data-label="Status"><span class="status ${st.css}">${st.label}</span></td>
      <td class="td-endereco" data-label="Endereço">${escapeHTML(r.endereco)}</td>
      <td class="td-votos" data-label="Votos">${r.votos || 0}</td>
      <td data-label="Data">${data}</td>
      <td class="td-acao" data-label=""><button class="btn-tabela-detalhe">Ver detalhes</button></td>
    </tr>`;
}

// ── Modal de detalhes (mesmo padrão da home) ──
function abrirDetalhe(r) {
  const cat = CATS[r.categoria] || CATS['Outros'];
  const st  = STATUS[r.status]  || STATUS.aberto;

  document.getElementById('detalhe-titulo').textContent = r.titulo;
  document.getElementById('detalhe-desc').textContent   = r.descricao;
  document.getElementById('detalhe-foto').innerHTML = r.fotoUrl
    ? `<img src="${escapeHTML(otimizarImagem(r.fotoUrl, 700))}" alt="Foto do relato" loading="lazy" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:280px; object-fit:cover;">`
    : '';
  document.getElementById('detalhe-resposta').innerHTML = r.respostaOficial
  ? `<div class="resposta-cidadao"><strong><i class="ti ti-building-community"></i> Resposta da prefeitura:</strong><p>${escapeHTML(r.respostaOficial)}</p></div>`
  : '';
  document.getElementById('detalhe-tags').innerHTML = `
    <span class="badge ${cat.badge}">${cat.label}</span>
    <span class="status ${st.css}">${st.label}</span>`;
  document.getElementById('detalhe-meta').innerHTML = `
    <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
    <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
    <span><i class="ti ti-clock"></i> ${new Date(r.dataCriacao).toLocaleString('pt-BR')}</span>`;
  document.getElementById('modal-detalhe-overlay').classList.add('open');
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