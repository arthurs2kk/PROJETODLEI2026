// ── Pro Povo — relatos.js ──
import { ouvirRelatos } from "./db.js";

const state = {
  todos: [],
  busca: '',
  categoria: 'todos',
  status: 'todos',
  sortCol: 'votos',
  sortDir: 'desc'
};

// ── Menu mobile ──
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('open');
});

// ── Configurações visuais por categoria/status ──
const CATS = {
  'Buraco / Via danificada': { label: 'Buraco',       badge: 'badge-buraco' },
  'Iluminação pública':      { label: 'Iluminação',   badge: 'badge-ilum'   },
  'Lixo / Entulho':          { label: 'Lixo',         badge: 'badge-lixo'   },
  'Água / Esgoto':           { label: 'Água/Esgoto',  badge: 'badge-agua'   },
  'Áreas verdes':            { label: 'Áreas verdes', badge: 'badge-lixo'   },
  'Outros':                  { label: 'Outros',       badge: 'badge-agua'   },
};

const STATUS = {
  aberto:    { label: 'Aberto',       css: 'status-aberto'    },
  andamento: { label: 'Em andamento', css: 'status-andamento' },
  resolvido: { label: 'Resolvido',    css: 'status-resolvido' },
};

// ── Carregar dados em tempo real ──
ouvirRelatos((relatos) => {
  state.todos = relatos;
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

// ── Renderização principal ──
function render() {
  let lista = [...state.todos];

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

  contagem.textContent = `Mostrando ${lista.length} relato${lista.length !== 1 ? 's' : ''} de ${state.todos.length} no total`;
  empty.style.display = lista.length === 0 ? 'block' : 'none';

  tbody.innerHTML = lista.map(linhaHTML).join('');

  tbody.querySelectorAll('.btn-tabela-detalhe').forEach((btn, i) => {
    btn.addEventListener('click', () => abrirDetalhe(lista[i]));
  });
}

// ── Linha da tabela ──
function linhaHTML(r) {
  const cat = CATS[r.categoria]  || CATS['Outros'];
  const st  = STATUS[r.status]   || STATUS.aberto;
  const data = new Date(r.dataCriacao).toLocaleDateString('pt-BR');

  return `
    <tr>
      <td class="td-titulo" data-label="Título">${r.titulo}</td>
      <td data-label="Categoria"><span class="badge ${cat.badge}">${cat.label}</span></td>
      <td data-label="Status"><span class="status ${st.css}">${st.label}</span></td>
      <td class="td-endereco" data-label="Endereço">${r.endereco}</td>
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
  document.getElementById('detalhe-resposta').innerHTML = r.respostaOficial
  ? `<div class="resposta-cidadao"><strong><i class="ti ti-building-community"></i> Resposta da prefeitura:</strong><p>${r.respostaOficial}</p></div>`
  : '';
  document.getElementById('detalhe-tags').innerHTML = `
    <span class="badge ${cat.badge}">${cat.label}</span>
    <span class="status ${st.css}">${st.label}</span>`;
  document.getElementById('detalhe-meta').innerHTML = `
    <span><i class="ti ti-map-pin"></i> ${r.endereco}</span>
    <span><i class="ti ti-user"></i> ${r.autorNome}</span>
    <span><i class="ti ti-clock"></i> ${new Date(r.dataCriacao).toLocaleString('pt-BR')}</span>`;
  document.getElementById('modal-detalhe-overlay').classList.add('open');
}

document.getElementById('detalhe-close')?.addEventListener('click', fecharDetalhe);
document.getElementById('detalhe-fechar-btn')?.addEventListener('click', fecharDetalhe);
function fecharDetalhe() {
  document.getElementById('modal-detalhe-overlay').classList.remove('open');
}