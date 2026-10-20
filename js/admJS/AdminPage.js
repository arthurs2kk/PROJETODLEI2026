// ── Pro Povo — admin-painel.js ──
import { auth, onAuthStateChanged, signOut } from "../firebase.js";
import { buscarRelatosGestaoPagina, buscarTodosRelatosGestao, buscarOrganizacao, buscarContatoRelato, atualizarStatus, salvarResposta, excluirRelato } from "../db.js";
import { buscarAdmin, ehSuperAdmin } from "./adminAuth.js";
import { otimizarImagem } from "../cloudinary.js";
import { escapeHTML } from "../escapeHtml.js";
import { notificarMudancaStatus, notificarNovaResposta } from "../notificacoes.js";
import { filtrarRelatos, ordenarPrioridades, chavePrioridade, estaAtrasado, STATUS_LABEL } from './gestaoModelo.js';
import { ouvirPrioridades, salvarPrioridade, removerPrioridade, definirOrdemPrioridades } from './prioridades.js';
import { criarMapaGestao } from './mapaGestao.js';
import { mostrarFalhaVerificacao } from './acessoFeedback.js';
import { indicadorResolucaoHTML } from '../respostaPrefeitura.js';

const TAMANHO_PAGINA = 25;
const state = {
  todos: [],
  busca: '',
  status: 'todos',
  admin: null,
  temMais: true,
  carregando: false,
  aba: 'relatos',
  completos: null,
  carregandoCompletos: false,
  prioridades: {},
  prioridadesProntas: false,
  salvandoPrioridade: false,
  rascunhos: new Map(),
  respostasAbertas: new Set(),
  cidade: '', bairro: '', categoria: 'todos', dias: '', ordenacao: 'recentes',
  erroCarga: '', pendentes: new Map()
};
let mapaGestao;
let pararPrioridades;
let localizarPendente;

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
  pararPrioridades?.();
  state.prioridadesProntas = false;
  if (!user) { window.location.href = 'AdmLogin.html'; return; }

  let admin;
  try { admin = await buscarAdmin(user.uid); }
  catch (erro) { console.warn('Falha ao verificar acesso:', erro); mostrarFalhaVerificacao(); return; }
  if (!admin) {
    await signOut(auth);
    window.location.href = 'AdmLogin.html';
    return;
  }
  state.admin = admin;
  document.getElementById('campo-cidade').hidden = !ehSuperAdmin(admin);
  iniciarPrioridades();

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

  await carregarCompletos();
});

function iniciarPrioridades() {
  pararPrioridades?.();
  try {
    pararPrioridades = ouvirPrioridades(state.admin, prioridades => {
      state.prioridades = prioridades;
      state.prioridadesProntas = true;
      document.getElementById('prioridades-aviso').hidden = true;
      render();
    }, erro => {
      console.warn('Prioridades indisponíveis:', erro);
      state.prioridadesProntas = false;
      const aviso = document.getElementById('prioridades-aviso');
      aviso.textContent = 'Não foi possível acessar as prioridades. Confira a conexão e use Atualizar para tentar novamente.';
      aviso.hidden = false;
      render();
    });
  } catch (erro) {
    state.prioridadesProntas = false;
    const aviso = document.getElementById('prioridades-aviso');
    aviso.textContent = 'Não foi possível acessar as prioridades. Use Atualizar para tentar novamente.';
    aviso.hidden = false;
    showToast(erro.message);
  }
}

async function carregarProximaPagina() {
  if (!state.admin || state.carregando || (!state.temMais && state.todos.length > 0)) return;
  state.carregando = true;
  state.erroCarga = '';
  render();

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
    atualizarFiltros();
  } catch (erro) {
    console.error('Não foi possível carregar os relatos da gestão:', erro);
    showToast('⚠️ Não foi possível carregar os relatos.');
    state.erroCarga = 'Não foi possível carregar os relatos. Os dados já consultados foram mantidos. Use Atualizar para tentar novamente.';
  } finally {
    state.carregando = false;
    render();
  }
}

async function recarregarRelatos() {
  if (state.carregando || state.carregandoCompletos) return;
  if (!state.prioridadesProntas) iniciarPrioridades();
  if (state.completos || state.aba !== 'relatos') await carregarCompletos(true);
  else {
    state.carregando = true;
    state.erroCarga = '';
    render();
    try {
      const pagina = await buscarRelatosGestaoPagina(state.admin, null, TAMANHO_PAGINA);
      state.todos = pagina.itens;
      state.temMais = pagina.temMais;
      atualizarFiltros();
    } catch (erro) {
      console.warn(erro);
      state.erroCarga = 'Não foi possível atualizar. Os dados anteriores foram mantidos. Tente novamente.';
    } finally { state.carregando = false; render(); }
  }
}

function atualizarControlesDePagina() {
  const botao = document.getElementById('btn-carregar-mais-admin');
  const atualizar = document.getElementById('btn-atualizar-relatos');
  const info = document.getElementById('admin-lote-info');
  const loader = document.getElementById('relatos-loader-admin');
  const container = document.getElementById('admin-lista');
  const empty = document.getElementById('lista-empty');
  const primeiroCarregamento = (state.carregando || state.carregandoCompletos) && !state.todos.length && !state.completos && state.aba !== 'mapa';

  if (loader) loader.hidden = !primeiroCarregamento;
  if (container) container.style.display = primeiroCarregamento ? 'none' : 'flex';
  if (primeiroCarregamento && empty) empty.style.display = 'none';

  if (botao) {
    botao.style.display = !primeiroCarregamento && (state.temMais || state.carregando) ? 'inline-flex' : 'none';
    botao.disabled = state.carregando || state.carregandoCompletos;
    botao.innerHTML = state.carregando
      ? '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Carregando...'
      : '<i class="ti ti-chevron-down"></i> Carregar relatos mais antigos';
  }
  document.querySelector('.admin-paginacao').hidden = state.aba !== 'relatos' || !!state.completos;
  document.getElementById('campo-ordenacao').hidden = state.aba !== 'relatos';
  const aviso = document.getElementById('admin-dados-aviso');
  if (!state.carregandoCompletos) { aviso.hidden = !state.erroCarga; aviso.textContent = state.erroCarga; }
  document.getElementById('painel-lista').setAttribute('aria-busy', String(state.carregando || state.carregandoCompletos));
  document.getElementById('painel-mapa').setAttribute('aria-busy', String(state.carregandoCompletos));
  atualizar.disabled = state.carregando || state.carregandoCompletos || state.pendentes.size > 0;
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

async function sairDoPainel() {
  if (haRascunhos() && !confirm('Há respostas não salvas. Sair e descartar esses rascunhos?')) return;
  state.rascunhos.clear();
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
}
document.getElementById('btn-sair')?.addEventListener('click', sairDoPainel);
document.getElementById('btn-sair-mobile')?.addEventListener('click', sairDoPainel);

function haRascunhos() {
  const base = state.completos || state.todos;
  return [...state.rascunhos].some(([id, texto]) => texto.trim() !== (base.find(r => r.id === id)?.respostaOficial || ''));
}
window.addEventListener('beforeunload', e => {
  if (haRascunhos()) { e.preventDefault(); e.returnValue = ''; }
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
document.getElementById('ordenacao').addEventListener('change', e => { state.ordenacao = e.target.value; render(); });
document.getElementById('btn-consultar-todos').addEventListener('click', () => carregarCompletos());
document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
  Object.assign(state, { busca: '', cidade: '', bairro: '', categoria: 'todos', status: 'todos', dias: '' });
  for (const [id, valor] of [['busca-input', ''], ['filtro-cidade', ''], ['filtro-bairro', ''], ['filtro-categoria', 'todos'], ['filtro-status', 'todos'], ['filtro-periodo', '']]) document.getElementById(id).value = valor;
  atualizarFiltros();
  render();
  document.getElementById('busca-input').focus();
});

function temFiltros() {
  return !!(state.busca || state.cidade || state.bairro || state.categoria !== 'todos' || state.status !== 'todos' || state.dias);
}

for (const [id, campo] of [['filtro-cidade', 'cidade'], ['filtro-bairro', 'bairro'], ['filtro-categoria', 'categoria'], ['filtro-periodo', 'dias']]) {
  document.getElementById(id).addEventListener('change', e => {
    state[campo] = e.target.value;
    if (campo === 'cidade') { state.bairro = ''; atualizarFiltros(); }
    render();
  });
}

function atualizarFiltros() {
  const base = state.completos || state.todos;
  const cidades = new Map(base.map(r => [String(r.cityId), r.cidade || String(r.cityId)]));
  const cidade = document.getElementById('filtro-cidade');
  cidade.replaceChildren(new Option('Todas as cidades', ''));
  [...cidades].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).forEach(([id, nome]) => cidade.add(new Option(nome, id)));
  cidade.value = state.cidade;
  const bairro = document.getElementById('filtro-bairro');
  bairro.replaceChildren(new Option('Todos os bairros', ''));
  [...new Set(base.filter(r => !state.cidade || String(r.cityId) === state.cidade).map(r => r.bairro).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(nome => bairro.add(new Option(nome, nome)));
  if (![...bairro.options].some(o => o.value === state.bairro)) state.bairro = '';
  bairro.value = state.bairro;
}

async function carregarCompletos(forcar = false) {
  if (!state.admin || (state.completos && !forcar) || state.carregandoCompletos) return;
  state.carregandoCompletos = true;
  state.erroCarga = '';
  const aviso = document.getElementById('admin-dados-aviso');
  aviso.hidden = false;
  aviso.textContent = 'Carregando todos os relatos do seu escopo…';
  render();
  try {
    state.completos = await buscarTodosRelatosGestao(state.admin, quantidade => {
      aviso.textContent = `Carregando todos os relatos… ${quantidade} recebido(s).`;
    });
    atualizarFiltros();
    aviso.hidden = true;
  } catch (erro) {
    console.warn(erro);
    state.erroCarga = 'Não foi possível consultar todos os relatos. Os dados anteriores foram mantidos. Use Atualizar para tentar novamente.';
  } finally {
    state.carregandoCompletos = false;
    render();
  }
}

async function selecionarAba(aba) {
  state.aba = aba;
  document.querySelectorAll('[data-aba]').forEach(botao => {
    const ativo = botao.dataset.aba === aba;
    botao.setAttribute('aria-selected', String(ativo));
    botao.tabIndex = ativo ? 0 : -1;
  });
  document.getElementById('painel-lista').hidden = aba === 'mapa';
  document.getElementById('painel-lista').setAttribute('aria-labelledby', `aba-${aba === 'prioridades' ? 'prioridades' : 'relatos'}`);
  document.getElementById('painel-mapa').hidden = aba !== 'mapa';
  document.getElementById('prioridades-intro').hidden = aba !== 'prioridades';
  render();
  if (aba !== 'relatos') await carregarCompletos();
}

document.querySelectorAll('[data-aba]').forEach(botao => {
  botao.addEventListener('click', () => selecionarAba(botao.dataset.aba));
  botao.addEventListener('keydown', e => {
    const botoes = [...document.querySelectorAll('[data-aba]')];
    const indice = botoes.indexOf(botao);
    const proximo = e.key === 'ArrowRight' ? (indice + 1) % botoes.length : e.key === 'ArrowLeft' ? (indice + botoes.length - 1) % botoes.length : e.key === 'Home' ? 0 : e.key === 'End' ? botoes.length - 1 : null;
    if (proximo === null) return;
    e.preventDefault();
    botoes[proximo].focus();
    selecionarAba(botoes[proximo].dataset.aba);
  });
});
document.getElementById('admin-mapa-tipo').addEventListener('change', render);
document.getElementById('admin-mapa-enquadrar').addEventListener('click', () => { mapaGestao?.enquadrar(); render(); });

function sincronizarRelato(id, campos) {
  for (const base of [state.todos, state.completos || []]) {
    const relato = base.find(r => r.id === id);
    if (relato) Object.assign(relato, campos);
  }
}

async function alternarPrioridade(r) {
  if (!state.prioridadesProntas || state.salvandoPrioridade) return;
  state.salvandoPrioridade = true;
  render();
  const prioridade = state.prioridades[chavePrioridade(r)];
  try {
    if (prioridade) await removerPrioridade(r);
    else {
      const ordens = Object.entries(state.prioridades).filter(([chave]) => chave.startsWith(`${r.cityId}/`)).map(([, p]) => p.ordem);
      await salvarPrioridade(r, null, Math.max(Date.now(), ...ordens) + 1024);
    }
    showToast(prioridade ? 'Relato removido das prioridades.' : 'Relato adicionado às prioridades da prefeitura.');
  } catch (erro) {
    console.warn(erro);
    showToast('Não foi possível salvar a prioridade. Tente novamente.');
  } finally {
    state.salvandoPrioridade = false;
    render();
  }
}

function podeReordenar() {
  return !!state.completos && state.prioridadesProntas && !state.salvandoPrioridade && !state.busca && !state.bairro && state.categoria === 'todos' && state.status === 'todos' && !state.dias && (!ehSuperAdmin(state.admin) || !!state.cidade);
}

async function moverPrioridade(r, direcao) {
  if (!podeReordenar()) return;
  const lista = ordenarPrioridades((state.completos || []).filter(item => String(item.cityId) === String(r.cityId)), state.prioridades);
  const indice = lista.findIndex(item => item.id === r.id);
  const destino = indice + direcao;
  if (indice < 0 || destino < 0 || destino >= lista.length) return;
  // Altera apenas posições, preservando a autoria e as inclusões dos colegas.
  // Inteiros espaçados evitam perda de precisão após sucessivas movimentações.
  lista.splice(indice, 1);
  lista.splice(destino, 0, r);
  state.salvandoPrioridade = true;
  render();
  try { await definirOrdemPrioridades(lista); showToast(`Prioridade movida para a posição ${destino + 1}.`); }
  catch (erro) { console.warn(erro); showToast('Não foi possível mudar a ordem. Tente novamente.'); }
  finally {
    state.salvandoPrioridade = false; render();
    document.getElementById(`relato-${r.id}`)?.focus({ preventScroll: true });
  }
}

async function tentarNotificarAutor(relato, enviar) {
  try {
    const contato = await buscarContatoRelato(relato.id);
    if (!contato) {
      const erro = new Error('Contato privado não encontrado para este relato.');
      erro.code = 'CONTATO_INDISPONIVEL';
      throw erro;
    }
    await enviar(contato);
    return true;
  } catch (erro) {
    console.warn('O relato foi salvo, mas o e-mail não foi enviado:', erro);
    return false;
  }
}

// ── Render principal ──
async function verNoMapa(r) {
  localizarPendente = r.id;
  if (document.getElementById('admin-mapa-tipo').value === 'calor') document.getElementById('admin-mapa-tipo').value = 'categoria';
  await selecionarAba('mapa');
}

function abrirGestao(r) {
  selecionarAba('relatos');
  const card = document.getElementById(`relato-${r.id}`);
  card?.scrollIntoView({ block: 'center' });
  card?.focus({ preventScroll: true });
}

function render() {
  const base = state.completos || (state.aba === 'relatos' ? state.todos : []);
  let lista = filtrarRelatos(base, state);
  lista = state.aba === 'prioridades' ? ordenarPrioridades(lista, state.prioridades) : lista.sort((a, b) => state.ordenacao === 'antigos' ? a.dataCriacao - b.dataCriacao : state.ordenacao === 'apoios' ? (b.votos || 0) - (a.votos || 0) || b.dataCriacao - a.dataCriacao : b.dataCriacao - a.dataCriacao);
  const parcial = !state.completos && state.temMais;
  document.getElementById('btn-limpar-filtros').hidden = !temFiltros();
  const consultar = document.getElementById('btn-consultar-todos');
  consultar.hidden = state.aba !== 'relatos' || !parcial;
  consultar.disabled = state.carregando || state.carregandoCompletos;
  document.getElementById('admin-resultados').textContent = state.carregandoCompletos ? 'Consultando todos os relatos…' : state.carregando ? 'Carregando relatos…' : `${lista.length} ${state.aba === 'prioridades' ? 'prioridade(s)' : 'relato(s)'} ${temFiltros() ? 'com os filtros atuais' : 'nesta visualização'}`;
  document.getElementById('admin-resultados-ajuda').textContent = parcial ? 'Resultado parcial: a busca e os filtros consideram os relatos já carregados. Consulte todos para incluir os mais antigos.' : 'Busca e filtros aplicados a todos os relatos consultados. Mantidos ao trocar de aba.';
  document.getElementById('admin-resumo-escopo').textContent = `Indicadores antes dos filtros · ${parcial ? 'Consulta parcial; há relatos mais antigos.' : 'Todos os relatos do escopo consultados.'} Atrasados: não resolvidos há mais de 10 dias. Tempo médio: apenas resolvidos com data de resolução.`;
  document.getElementById('prioridades-ordem-ajuda').textContent = !state.prioridadesProntas ? 'Aguarde a conexão com as prioridades para organizar a lista.' : state.salvandoPrioridade ? 'Salvando a organização das prioridades…' : podeReordenar() ? 'Use as setas para subir ou descer cada prioridade. A ordem é salva automaticamente.' : 'Para reordenar, limpe a busca e os filtros de bairro, categoria, situação e período. Na visão de todas as cidades, selecione uma cidade.';
  document.getElementById('prioridades-contagem').textContent = state.prioridadesProntas ? Object.keys(state.prioridades).length : '—';
  if (state.aba === 'mapa' && state.completos) {
    try {
      mapaGestao ||= criarMapaGestao(alternarPrioridade, () => state.prioridadesProntas && !state.salvandoPrioridade, abrirGestao);
      mapaGestao.atualizar(lista, document.getElementById('admin-mapa-tipo').value, state.prioridades, JSON.stringify([state.cidade, state.bairro, state.categoria, state.status, state.dias, state.busca]));
      if (localizarPendente) {
        mapaGestao.localizar(localizarPendente);
        localizarPendente = null;
      }
    } catch (erro) {
      console.warn(erro);
      document.getElementById('admin-mapa-info').textContent = 'Não foi possível abrir o mapa. Verifique a conexão e atualize a página.';
    }
  }

  const consultados = state.completos || state.todos;
  const atrasados  = consultados.filter(r => estaAtrasado(r));
  const tempoMedio = calcularTempoMedioResolucao(consultados);

  document.getElementById('resumo-total').textContent      = consultados.length;
  document.getElementById('resumo-aberto').textContent     = consultados.filter(r => r.status === 'aberto').length;
  document.getElementById('resumo-andamento').textContent  = consultados.filter(r => r.status === 'andamento').length;
  document.getElementById('resumo-resolvido').textContent  = consultados.filter(r => r.status === 'resolvido').length;
  document.getElementById('resumo-atrasados').textContent  = atrasados.length;
  document.getElementById('resumo-tempo-medio').textContent =
    tempoMedio === null ? '—' : `${tempoMedio.toFixed(1)}d`;

  const container = document.getElementById('admin-lista');
  const empty = document.getElementById('lista-empty');
  empty.style.display = !state.carregando && !state.carregandoCompletos && lista.length === 0 && (state.aba === 'relatos' || !!state.completos) ? 'block' : 'none';
  empty.querySelector('p').textContent = state.erroCarga && !base.length ? 'Os relatos ainda não puderam ser consultados. Use Atualizar para tentar novamente.' : state.aba === 'prioridades'
    ? state.prioridadesProntas ? 'Nenhuma prioridade neste filtro. Adicione relatos pela lista ou pelo mapa.' : 'As prioridades estão indisponíveis. Confira o aviso acima.'
    : 'Nenhum relato encontrado neste filtro.';

  const foco = document.activeElement;
  const selecao = container.contains(foco) ? { id: foco.id, inicio: foco.selectionStart, fim: foco.selectionEnd } : null;
  container.innerHTML = state.aba === 'mapa' ? '' : lista.map(cardHTML).join('');
  if (selecao) {
    const campo = document.getElementById(selecao.id);
    campo?.focus({ preventScroll: true });
    if (campo?.tagName === 'TEXTAREA') campo.setSelectionRange(selecao.inicio, selecao.fim);
  }
  atualizarControlesDePagina();

  // Eventos
  lista.forEach(r => {
    document.getElementById(`btn-mapa-${r.id}`)?.addEventListener('click', () => verNoMapa(r));
    document.getElementById(`btn-prioridade-${r.id}`)?.addEventListener('click', () => alternarPrioridade(r));
    document.getElementById(`btn-subir-${r.id}`)?.addEventListener('click', () => moverPrioridade(r, -1));
    document.getElementById(`btn-descer-${r.id}`)?.addEventListener('click', () => moverPrioridade(r, 1));
    document.getElementById(`foto-${r.id}`)?.addEventListener('click', (e) => {
      abrirLightbox(e.currentTarget.dataset.fotoUrl);
    });
    document.getElementById(`foto-${r.id}`)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirLightbox(e.currentTarget.dataset.fotoUrl); }
    });

    document.getElementById(`status-${r.id}`)?.addEventListener('change', async (e) => {
      const novoStatus = e.target.value;
      if (novoStatus === r.status || state.pendentes.has(r.id)) return;
      state.pendentes.set(r.id, 'status');
      render();
      try {
        await atualizarStatus(r.id, novoStatus);
        r.status = novoStatus;
        r.dataResolucao = novoStatus === 'resolvido' ? Date.now() : null;
        sincronizarRelato(r.id, { status: r.status, dataResolucao: r.dataResolucao });
        render();
        const notificou = await tentarNotificarAutor(
          r,
          contato => notificarMudancaStatus(contato, r, novoStatus)
        );
        showToast(notificou
          ? '✅ Status atualizado e usuário notificado por e-mail.'
          : '⚠️ Status atualizado, mas o e-mail não foi enviado.');
      } catch (erro) {
        console.error(erro);
        showToast('⚠️ Não foi possível atualizar este relato.');
      } finally {
        const devolverFoco = document.activeElement === document.body;
        state.pendentes.delete(r.id); render();
        if (devolverFoco) document.getElementById(`status-${r.id}`)?.focus({ preventScroll: true });
      }
    });

    document.getElementById(`btn-resp-${r.id}`)?.addEventListener('click', () => {
      const aberta = !state.respostasAbertas.has(r.id);
      if (aberta) state.respostasAbertas.add(r.id);
      else state.respostasAbertas.delete(r.id);
      const area = document.getElementById(`resp-area-${r.id}`);
      area.hidden = !aberta;
      area.classList.toggle('open', aberta);
      document.getElementById(`btn-resp-${r.id}`).setAttribute('aria-expanded', String(aberta));
      if (aberta) document.getElementById(`resp-texto-${r.id}`).focus();
    });
    document.getElementById(`resp-texto-${r.id}`)?.addEventListener('input', e => {
      state.rascunhos.set(r.id, e.target.value);
      document.getElementById(`resp-contagem-${r.id}`).textContent = `${e.target.value.length}/2000 caracteres`;
    });
    document.getElementById(`btn-resp-cancelar-${r.id}`)?.addEventListener('click', () => {
      state.respostasAbertas.delete(r.id);
      render();
      document.getElementById(`btn-resp-${r.id}`)?.focus();
    });

    document.getElementById(`btn-resp-salvar-${r.id}`)?.addEventListener('click', async (e) => {
      if (state.pendentes.has(r.id)) return;
      const texto = document.getElementById(`resp-texto-${r.id}`).value.trim();
      if (!texto) { showToast('⚠️ Escreva uma resposta antes de salvar.'); return; }
      if (texto.length > 2000) { showToast('A resposta deve ter até 2000 caracteres.'); return; }
      if (texto === r.respostaOficial) { showToast('ℹ️ A resposta não foi alterada.'); return; }
      state.pendentes.set(r.id, 'resposta');
      render();
      try {
        await salvarResposta(r.id, texto);
        r.respostaOficial = texto;
        r.dataResposta = Date.now();
        state.rascunhos.delete(r.id);
        sincronizarRelato(r.id, { respostaOficial: texto, dataResposta: r.dataResposta });
        render();
        const notificou = await tentarNotificarAutor(
          r,
          contato => notificarNovaResposta(contato, r, texto)
        );
        showToast(notificou
          ? '✅ Resposta salva e usuário notificado por e-mail.'
          : '⚠️ Resposta salva, mas o e-mail não foi enviado.');
      } catch (erro) {
        console.error(erro);
        showToast('⚠️ Não foi possível salvar a resposta.');
      } finally {
        const devolverFoco = document.activeElement === document.body;
        state.pendentes.delete(r.id); render();
        if (devolverFoco) document.getElementById(`btn-resp-salvar-${r.id}`)?.focus({ preventScroll: true });
      }
    });

    document.getElementById(`btn-excluir-${r.id}`)?.addEventListener('click', async () => {
      if (state.pendentes.has(r.id)) return;
      if (confirm(`Excluir o relato "${r.titulo}"? Essa ação não pode ser desfeita.`)) {
        state.pendentes.set(r.id, 'excluir'); render();
        try {
          await excluirRelato(r.id);
          state.todos = state.todos.filter(relato => relato.id !== r.id);
          if (state.completos) state.completos = state.completos.filter(relato => relato.id !== r.id);
          state.rascunhos.delete(r.id);
          state.respostasAbertas.delete(r.id);
          render();
          showToast('🗑️ Relato excluído.');
        } catch (erro) {
          console.error(erro);
          showToast('⚠️ Não foi possível excluir este relato.');
        } finally { state.pendentes.delete(r.id); render(); }
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
  const prioridade = state.prioridades[chavePrioridade(r)];
  const listaOrdenada = state.aba === 'prioridades' ? ordenarPrioridades((state.completos || []).filter(item => String(item.cityId) === String(r.cityId)), state.prioridades) : [];
  const posicao = listaOrdenada.findIndex(item => item.id === r.id);
  const fotoUrl = otimizarImagem(r.fotoUrl, 700);
  const pendente = state.pendentes.get(r.id);
  const rascunho = state.rascunhos.get(r.id) ?? r.respostaOficial ?? '';
  const resposta = r.respostaOficial
    ? `<div class="resposta-existente${r.status === 'resolvido' ? ' resposta-resolvida' : ''}">${indicadorResolucaoHTML(r)}<strong>Resposta oficial atual:</strong>${escapeHTML(r.respostaOficial)}</div>`
    : '';

  return `
    <article class="gestao-card ${atrasado ? 'gestao-card-atrasado' : ''}" data-status="${status}" id="relato-${relatoId}" tabindex="-1" aria-labelledby="titulo-${relatoId}" aria-busy="${!!pendente}">
      <div class="gestao-top">
        <h2 class="gestao-titulo" id="titulo-${relatoId}">${escapeHTML(r.titulo)}</h2>
        <div class="gestao-top-badges">
          ${prioridade ? '<span class="badge-prioridade"><i class="ti ti-star-filled" aria-hidden="true"></i> Prioridade interna</span>' : ''}
          ${atrasado ? `<span class="badge-atrasado"><i class="ti ti-alert-triangle"></i> Atrasado · ${diasEmAberto(r)}d</span>` : ''}
          <span class="status status-${status}">${STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div class="gestao-meta">
        <span>${escapeHTML(r.categoria)}</span>
        <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
        <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
        <span><i class="ti ti-clock"></i> ${data}</span>
        <span><i class="ti ti-thumb-up"></i> ${votos} votos</span>
      </div>
      ${fotoUrl ? `<img id="foto-${relatoId}" src="${escapeHTML(fotoUrl)}" data-foto-url="${escapeHTML(r.fotoUrl)}" alt="Foto do relato. Clique para ampliar" loading="lazy" class="gestao-foto" tabindex="0" role="button">` : ''}
      <p class="gestao-desc">${escapeHTML(r.descricao)}</p>

      <div class="gestao-controles">
        <button type="button" class="btn-gestao btn-prioridade" id="btn-prioridade-${relatoId}" aria-pressed="${!!prioridade}" ${!state.prioridadesProntas || state.salvandoPrioridade || pendente ? 'disabled' : ''}>
          <i class="ti ti-star${prioridade ? '-filled' : ''}" aria-hidden="true"></i> ${prioridade ? 'Remover das prioridades' : 'Adicionar às prioridades'}
        </button>
        ${state.aba === 'prioridades' ? `<div class="prioridade-ordem"><span>${posicao + 1}º na lista</span><button type="button" class="btn-gestao" id="btn-subir-${relatoId}" aria-label="Subir prioridade" ${!podeReordenar() || posicao <= 0 ? 'disabled' : ''}><i class="ti ti-arrow-up" aria-hidden="true"></i></button><button type="button" class="btn-gestao" id="btn-descer-${relatoId}" aria-label="Descer prioridade" ${!podeReordenar() || posicao === listaOrdenada.length - 1 ? 'disabled' : ''}><i class="ti ti-arrow-down" aria-hidden="true"></i></button></div>` : ''}
        <label class="gestao-status-campo" for="status-${relatoId}">Situação
        <select class="gestao-select" id="status-${relatoId}" ${pendente ? 'disabled' : ''}>
          <option value="aberto"    ${r.status === 'aberto'    ? 'selected' : ''}>Aberto</option>
          <option value="andamento" ${r.status === 'andamento' ? 'selected' : ''}>Em andamento</option>
          <option value="resolvido" ${r.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
        </select></label>
        <button type="button" class="btn-gestao" id="btn-mapa-${relatoId}"><i class="ti ti-map-pin" aria-hidden="true"></i> Ver no mapa</button>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-${relatoId}" aria-expanded="${state.respostasAbertas.has(r.id)}" aria-controls="resp-area-${relatoId}">
          <i class="ti ti-message-circle"></i> ${r.respostaOficial ? 'Editar resposta' : 'Responder'}
        </button>
        <button class="btn-gestao btn-gestao-excluir" id="btn-excluir-${relatoId}" ${pendente ? 'disabled' : ''}>
          <i class="ti ti-trash"></i> Excluir
        </button>
      </div>
      ${pendente ? `<p class="admin-ajuda" role="status">${pendente === 'status' ? 'Salvando situação e enviando notificação…' : pendente === 'resposta' ? 'Salvando resposta e enviando notificação…' : 'Excluindo relato…'}</p>` : ''}

      <div class="gestao-resposta-area ${state.respostasAbertas.has(r.id) ? 'open' : ''}" id="resp-area-${relatoId}" ${state.respostasAbertas.has(r.id) ? '' : 'hidden'}>
        ${resposta}
        <label class="admin-campo" for="resp-texto-${relatoId}">Resposta oficial</label>
        <p class="admin-ajuda" id="resp-ajuda-${relatoId}">A resposta será pública. Ao salvar, tentaremos notificar o autor por e-mail.</p>
        <textarea id="resp-texto-${relatoId}" maxlength="2000" aria-describedby="resp-ajuda-${relatoId} resp-contagem-${relatoId}" ${pendente ? 'disabled' : ''} placeholder="Escreva a resposta oficial da prefeitura para este relato...">${escapeHTML(rascunho)}</textarea>
        <p class="admin-ajuda" id="resp-contagem-${relatoId}">${rascunho.length}/2000 caracteres</p>
        <button class="btn-gestao btn-gestao-resposta" id="btn-resp-salvar-${relatoId}" ${pendente ? 'disabled' : ''}>
          <i class="ti ti-send"></i> Salvar resposta
        </button>
        <button type="button" class="btn-gestao" id="btn-resp-cancelar-${relatoId}">Fechar resposta</button>
      </div>
    </article>`;
}

const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');
let focoAntesLightbox;
let overflowAntesLightbox;
let lightboxSequencia = 0;

function abrirLightbox(url) {
  if (!url || !lightboxOverlay || !lightboxImg) return;
  ++lightboxSequencia;
  lightboxImg.src = url;
  focoAntesLightbox = document.activeElement;
  overflowAntesLightbox = document.body.style.overflow;
  lightboxOverlay.hidden = false;
  document.getElementById('painel-conteudo').inert = true;
  document.body.style.overflow = 'hidden';
  // O atributo hidden remove o estado inicial do layout.
  lightboxOverlay.getBoundingClientRect();
  lightboxOverlay.classList.add('open');
  document.getElementById('lightbox-close').focus();
}

async function fecharLightbox() {
  if (!lightboxOverlay || !lightboxImg || !lightboxOverlay.classList.contains('open')) return;
  const sequencia = ++lightboxSequencia;
  lightboxOverlay.classList.remove('open');
  document.getElementById('painel-conteudo').inert = false;
  document.body.style.overflow = overflowAntesLightbox;
  if (focoAntesLightbox?.isConnected) focoAntesLightbox.focus({ preventScroll: true });
  // Preserva a foto durante a saída; uma reabertura cancela a limpeza.
  await Promise.allSettled(lightboxOverlay.getAnimations({ subtree: true }).map(animation => animation.finished));
  if (sequencia !== lightboxSequencia) return;
  lightboxOverlay.hidden = true;
  lightboxImg.removeAttribute('src');
}

document.getElementById('lightbox-close')?.addEventListener('click', fecharLightbox);
lightboxOverlay?.addEventListener('click', (e) => {
  if (e.target === lightboxOverlay) fecharLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharLightbox();
  if (e.key === 'Tab' && lightboxOverlay.classList.contains('open')) { e.preventDefault(); document.getElementById('lightbox-close').focus(); }
});

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 6500);
}
