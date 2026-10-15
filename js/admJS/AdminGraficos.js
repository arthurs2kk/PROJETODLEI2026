// ── Pro Povo — AdminGraficos.js ──
import { auth, onAuthStateChanged, signOut } from "../firebase.js";
import { buscarTodosRelatosGestao, buscarOrganizacao } from "../db.js";
import { buscarAdmin, ehSuperAdmin } from "./adminAuth.js";
import { obterPopulacaoPB, normalizar } from "../populacao.js";
import { escapeHTML } from "../escapeHtml.js";
import { mostrarFalhaVerificacao } from './acessoFeedback.js';

const state = {
  relatos: [],
  popMap: new Map(),
  dadosExport: null,
  admin: null
};
let chartAtual = null;
let renderVersao = 0;

// ── Esconde/trava opções que não fazem sentido pra um admin restrito a uma
// única cidade. A visão "cidades com mais relatos por habitante" compara
// municípios entre si, então some do seletor. O seletor de cidade da visão
// "bairros" já fica naturalmente restrito (a consulta só entrega relatos da
// própria cidade) — aqui só desabilitamos o campo pra deixar isso
// visualmente claro, sem escrever nenhuma lógica nova de filtragem. ──
function aplicarRestricoesPorCidade(admin) {
  if (ehSuperAdmin(admin)) return;

  const selectTipo = document.getElementById('grafico-tipo');
  selectTipo?.querySelector('option[value="cidades"]')?.remove();
  if (selectTipo) selectTipo.value = 'bairros';

  document.getElementById('grafico-filtro-cidade')?.setAttribute('disabled', 'disabled');
}

// ── Verificação de acesso + escopo por cidade ──
onAuthStateChanged(auth, async (user) => {
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

  document.getElementById('verificando').style.display = 'none';
  document.getElementById('painel-conteudo').style.display = 'block';

  aplicarRestricoesPorCidade(admin);

  await carregarDados();
});

async function carregarDados() {
  document.getElementById('graf-tentar-novamente').hidden = true;
  document.getElementById('grafico-tipo').disabled = true;
  definirExportacao(false);
  document.querySelector('.graf-canvas-wrap').setAttribute('aria-busy', 'true');
  try {
    atualizarAviso('Carregando todos os relatos do escopo autorizado...');
    state.relatos = await buscarTodosRelatosGestao(state.admin, (quantidade) => {
      atualizarAviso(`Carregando relatos para os gráficos... ${quantidade} recebido${quantidade !== 1 ? 's' : ''}.`);
    });
    atualizarSeletorCidades();
    document.getElementById('grafico-tipo').disabled = false;
    await renderizar();
  } catch (erro) {
    console.error('Não foi possível carregar os dados completos dos gráficos:', erro);
    atualizarAviso('Não foi possível carregar os dados dos gráficos. Confira sua conexão e tente novamente.');
    document.getElementById('graf-tentar-novamente').hidden = false;
    document.getElementById('graf-resumo').textContent = 'Dados indisponíveis.';
  } finally {
    document.querySelector('.graf-canvas-wrap').setAttribute('aria-busy', 'false');
  }
}
document.getElementById('graf-tentar-novamente').addEventListener('click', carregarDados);

document.getElementById('btn-sair')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
});

document.getElementById('btn-sair-mobile')?.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'AdmLogin.html';
});



// ── Extrai cidade e bairro de um relato ──
// Relatos criados a partir de agora já vêm com cidade/bairro salvos direto do
// Nominatim (muito mais confiável). Relatos antigos, criados antes dessa mudança,
// não têm esses campos — pra eles, tentamos um fallback lendo o texto do endereço,
// que é salvo como "rua, bairro, cidade, Paraíba, Região Nordeste, Brasil".
function extrairCidadeBairro(r) {
  if (r.cidade) {
    return { cidade: r.cidade, bairro: r.bairro || null };
  }

  const partes = (r.endereco || '').split(',').map(p => p.trim()).filter(Boolean);
  const idxPB = partes.findIndex(p => normalizar(p).includes('paraiba'));
  if (idxPB > 0) {
    const cidade = partes[idxPB - 1] || null;
    const bairro = idxPB - 2 >= 0 ? partes[idxPB - 2] : null;
    return { cidade, bairro };
  }
  return { cidade: null, bairro: null };
}

function listaCidadesComRelatos(relatos) {
  const set = new Set();
  relatos.forEach(r => {
    const { cidade } = extrairCidadeBairro(r);
    if (cidade) set.add(cidade);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// ── Seletor de cidade (usado na visão "bairros") ──
function atualizarSeletorCidades() {
  const select = document.getElementById('grafico-filtro-cidade');
  const atual = select.value;
  const cidades = listaCidadesComRelatos(state.relatos);

  select.replaceChildren(new Option('Selecione uma cidade...', ''));
  cidades.forEach(cidade => select.appendChild(new Option(cidade, cidade)));

  if (cidades.includes(atual)) select.value = atual;
  else if (cidades.length > 0) select.value = cidades[0];
}

// ── Aviso acima do gráfico ──
function atualizarAviso(msg) {
  const box = document.getElementById('graf-aviso');
  const texto = document.getElementById('graf-aviso-texto');
  if (!msg) { box.style.display = 'none'; return; }
  texto.textContent = msg;
  box.style.display = 'block';
}

const PALETA = ['#1351B4', '#CC2900', '#C45C00', '#168821', '#FFCD07', '#888888', '#0C326F'];

function opcoesBase(titulo, extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    ...extra,
    plugins: {
      title: { display: true, text: titulo, font: { size: 15 } },
      legend: { display: false },
      ...extra.plugins
    }
  };
}

// ── Visão 1: cidades com mais relatos por habitante ──
function montarConfigCidades() {
  const contagem = {};
  state.relatos.forEach(r => {
    const { cidade } = extrairCidadeBairro(r);
    if (!cidade) return;
    contagem[cidade] = (contagem[cidade] || 0) + 1;
  });

  const linhas = Object.entries(contagem).map(([cidade, total]) => {
    const pop = state.popMap.get(normalizar(cidade)) || null;
    const taxa = pop ? (total / pop) * 10000 : null;
    return { cidade, total, pop, taxa };
  });

  const comPop = linhas.filter(l => l.taxa !== null).sort((a, b) => b.taxa - a.taxa).slice(0, 10);
  const semPop = linhas.filter(l => l.taxa === null);

  if (state.popMap.size === 0) {
    atualizarAviso('⚠️ Não foi possível carregar os dados de população do IBGE agora. Tente novamente mais tarde.');
  } else if (semPop.length > 0) {
    atualizarAviso(`ℹ️ ${semPop.length} cidade(s) com relatos não puderam ser comparadas por falta de dado de população compatível.`);
  } else {
    atualizarAviso('');
  }

  state.dadosExport = {
    titulo: 'cidades-relatos-por-habitante',
    colunas: ['Cidade', 'Relatos', 'População estimada (IBGE)', 'Relatos por 10.000 habitantes'],
    linhas: comPop.map(l => [l.cidade, l.total, l.pop, l.taxa.toFixed(2)])
  };

  return {
    type: 'bar',
    data: {
      labels: comPop.map(l => l.cidade),
      datasets: [{ label: 'Relatos por 10.000 habitantes', data: comPop.map(l => Number(l.taxa.toFixed(2))), backgroundColor: '#1351B4' }]
    },
    options: opcoesBase('Top 10 cidades — relatos a cada 10.000 habitantes', {
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } }
    })
  };
}

// ── Visão 2: bairros com mais relatos, dentro de uma cidade ──
function montarConfigBairros() {
  atualizarAviso('');
  const cidade = document.getElementById('grafico-filtro-cidade').value;
  if (!cidade) return null;

  const contagem = new Map();
  state.relatos.forEach(r => {
    const { cidade: cidadeR, bairro } = extrairCidadeBairro(r);
    if (!cidadeR || normalizar(cidadeR) !== normalizar(cidade)) return;
    const nomeBairro = bairro?.trim() || 'Não identificado';
    const chave = normalizar(nomeBairro);
    const atual = contagem.get(chave);
    if (atual) {
      atual.total += 1;
    } else {
      contagem.set(chave, { nome: nomeBairro, total: 1 });
    }
  });

  const linhas = [...contagem.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  state.dadosExport = {
    titulo: `bairros-${normalizar(cidade)}`,
    colunas: ['Bairro', 'Quantidade de relatos'],
    linhas: linhas.map(item => [item.nome, item.total])
  };

  return {
    type: 'bar',
    data: {
      labels: linhas.map(item => item.nome),
      datasets: [{ label: `Relatos em ${cidade}`, data: linhas.map(item => item.total), backgroundColor: '#C45C00' }]
    },
    options: opcoesBase(`Bairros com mais relatos — ${cidade}`, {
      indexAxis: 'y',
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
    })
  };
}

// ── Visão 3: tipos de problema mais comuns ──
function montarConfigCategorias() {
  atualizarAviso('');
  const contagem = {};
  state.relatos.forEach(r => { contagem[r.categoria] = (contagem[r.categoria] || 0) + 1; });
  const linhas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  state.dadosExport = {
    titulo: 'tipos-de-problema',
    colunas: ['Categoria', 'Quantidade de relatos'],
    linhas
  };

  return {
    type: 'pie',
    data: { labels: linhas.map(l => l[0]), datasets: [{ data: linhas.map(l => l[1]), backgroundColor: PALETA }] },
    options: opcoesBase('Tipos de problema mais comuns', { plugins: { legend: { display: true, position: 'right' } } })
  };
}

// ── Visão 4: status dos relatos ──
function montarConfigStatus() {
  atualizarAviso('');
  const chaves = ['aberto', 'andamento', 'resolvido'];
  const labels = ['Aberto', 'Em andamento', 'Resolvido'];
  const cores  = ['#CC2900', '#C45C00', '#168821'];
  const valores = chaves.map(c => state.relatos.filter(r => r.status === c).length);

  state.dadosExport = {
    titulo: 'status-dos-relatos',
    colunas: ['Status', 'Quantidade de relatos'],
    linhas: labels.map((l, i) => [l, valores[i]])
  };

  return {
    type: 'doughnut',
    data: { labels, datasets: [{ data: valores, backgroundColor: cores }] },
    options: opcoesBase('Status dos relatos', { plugins: { legend: { display: true, position: 'right' } } })
  };
}

// ── Visão 5: evolução mensal de relatos ──
function montarConfigEvolucao() {
  atualizarAviso('');
  const contagem = {};
  state.relatos.forEach(r => {
    const d = new Date(r.dataCriacao);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  const chaves = Object.keys(contagem).sort();
  const labels = chaves.map(c => { const [ano, mes] = c.split('-'); return `${mes}/${ano}`; });
  const valores = chaves.map(c => contagem[c]);

  state.dadosExport = {
    titulo: 'evolucao-mensal-relatos',
    colunas: ['Mês', 'Quantidade de relatos'],
    linhas: labels.map((l, i) => [l, valores[i]])
  };

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Relatos por mês', data: valores, borderColor: '#1351B4', backgroundColor: 'rgba(19,81,180,0.15)', fill: true, tension: 0.3 }]
    },
    options: opcoesBase('Evolução mensal de relatos', { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } })
  };
}

// ── Renderização principal: troca o tipo/dados do gráfico único ──
async function renderizar() {
  const versao = ++renderVersao;
  const tipo = document.getElementById('grafico-tipo').value;
  document.getElementById('grafico-campo-cidade').hidden = tipo !== 'bairros';
  definirExportacao(false);
  state.dadosExport = null;

  let config;
  if (tipo === 'cidades') {
    if (state.popMap.size === 0) {
      atualizarAviso('Carregando dados de população do IBGE...');
      state.popMap = await obterPopulacaoPB();
      if (versao !== renderVersao) return;
    }
    config = montarConfigCidades();
  } else if (tipo === 'bairros') {
    config = montarConfigBairros();
  } else if (tipo === 'categorias') {
    config = montarConfigCategorias();
  } else if (tipo === 'status') {
    config = montarConfigStatus();
  } else {
    config = montarConfigEvolucao();
  }

  if (chartAtual) chartAtual.destroy();
  chartAtual = null;
  const canvas = document.getElementById('grafico-canvas');
  const temDados = !!state.dadosExport?.linhas.length;
  canvas.hidden = !config || !temDados;
  document.getElementById('graf-resumo').textContent = temDados ? `${state.relatos.length} relato(s) consultados no escopo autorizado. A tabela e as exportações correspondem à análise selecionada.` : 'Nenhum dado disponível para esta análise. Escolha outra análise ou cidade.';
  const tabela = document.getElementById('graf-tabela');
  tabela.querySelector('caption').textContent = config?.options.plugins.title.text || 'Dados da análise atual';
  tabela.querySelector('thead').innerHTML = `<tr>${(state.dadosExport?.colunas || []).map(c => `<th scope="col">${escapeHTML(c)}</th>`).join('')}</tr>`;
  tabela.querySelector('tbody').innerHTML = (state.dadosExport?.linhas || []).map(l => `<tr>${l.map((v, i) => i === 0 ? `<th scope="row">${escapeHTML(String(v ?? '—'))}</th>` : `<td>${escapeHTML(String(v ?? '—'))}</td>`).join('')}</tr>`).join('');
  if (!config || !temDados) return;
  const corTexto = getComputedStyle(document.documentElement).getPropertyValue('--cinza-5').trim();
  config.options.color = corTexto;
  config.options.plugins.title.color = corTexto;
  if (config.options.plugins.legend) {
    config.options.plugins.legend.position = matchMedia('(max-width: 640px)').matches ? 'bottom' : 'right';
    config.options.plugins.legend.labels = { color: corTexto };
  }
  if (!['pie', 'doughnut'].includes(config.type)) {
    config.options.scales ||= {};
    for (const id of ['x', 'y']) {
      const eixo = config.options.scales[id] ||= {};
      eixo.ticks = { ...eixo.ticks, color: corTexto };
      eixo.grid = { color: getComputedStyle(document.documentElement).getPropertyValue('--borda').trim() };
    }
  }
  canvas.setAttribute('aria-label', config.options.plugins.title.text);
  chartAtual = new Chart(canvas, config);
  definirExportacao(true);
}

function definirExportacao(pronta) {
  document.getElementById('btn-baixar-csv').disabled = !pronta;
  document.getElementById('btn-baixar-png').disabled = !pronta;
}

new MutationObserver(() => {
  if (chartAtual) renderizar();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

document.getElementById('grafico-tipo')?.addEventListener('change', renderizar);
document.getElementById('grafico-filtro-cidade')?.addEventListener('change', renderizar);

// ── Baixar gráfico como PNG (com fundo branco, pra abrir bem em qualquer visualizador) ──
document.getElementById('btn-baixar-png')?.addEventListener('click', () => {
  if (!chartAtual) return;
  const original = document.getElementById('grafico-canvas');
  const exportado = document.createElement('canvas');
  exportado.width = original.width;
  exportado.height = original.height;

  const ctx = exportado.getContext('2d');
  // Mantém a exportação branca legível mesmo quando a interface está no tema escuro.
  const corOriginal = chartAtual.options.color;
  const corTitulo = chartAtual.options.plugins.title.color;
  const corLegenda = chartAtual.options.plugins.legend.labels.color;
  const coresEixos = Object.entries(chartAtual.options.scales || {}).map(([id, eixo]) => [id, eixo.ticks.color]);
  chartAtual.options.color = '#333333';
  chartAtual.options.plugins.title.color = '#333333';
  chartAtual.options.plugins.legend.labels.color = '#333333';
  coresEixos.forEach(([id]) => { chartAtual.options.scales[id].ticks.color = '#333333'; });
  chartAtual.update('none');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportado.width, exportado.height);
  ctx.drawImage(original, 0, 0);
  chartAtual.options.color = corOriginal;
  chartAtual.options.plugins.title.color = corTitulo;
  chartAtual.options.plugins.legend.labels.color = corLegenda;
  coresEixos.forEach(([id, cor]) => { chartAtual.options.scales[id].ticks.color = cor; });
  chartAtual.update('none');

  const tipo = document.getElementById('grafico-tipo').value;
  const a = document.createElement('a');
  a.href = exportado.toDataURL('image/png');
  a.download = `grafico-${tipo}.png`;
  a.click();
  showToast('Gráfico preparado para download.');
});

// ── Baixar os dados do gráfico atual como CSV ──
document.getElementById('btn-baixar-csv')?.addEventListener('click', () => {
  if (!state.dadosExport) { showToast('⚠️ Nenhum dado disponível para exportar ainda.'); return; }

  const { titulo, colunas, linhas } = state.dadosExport;
  let csv = colunas.join(';') + '\n';
  linhas.forEach(l => {
    csv += l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Dados preparados para download.');
});

// ── Toast ──
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 6500);
}

// ── Spinner ──
const s = document.createElement('style');
s.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(s);
