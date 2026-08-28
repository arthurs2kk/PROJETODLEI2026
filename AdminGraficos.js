// ── Pro Povo — AdminGraficos.js ──
import { auth, onAuthStateChanged, signOut } from "./firebase.js";
import { ehAdmin, ouvirRelatos } from "./db.js";
import { obterPopulacaoPB, normalizar } from "./populacao.js";
import { escapeHTML } from "./escapeHtml.js";

const state = { relatos: [], popMap: new Map(), dadosExport: null };
let chartAtual = null;

// ── Verificação de acesso (mesmo padrão do AdminPage.js) ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'AdmLogin.html'; return; }

  const autorizado = await ehAdmin(user.uid);
  if (!autorizado) {
    await signOut(auth);
    window.location.href = 'AdmLogin.html';
    return;
  }

  document.getElementById('admin-user-tag').innerHTML =
    `<i class="ti ti-user-shield"></i> ${escapeHTML(user.displayName || user.email)}`;
  document.getElementById('admin-user-tag-mobile').innerHTML =
    `<i class="ti ti-user-shield"></i> ${escapeHTML(user.displayName || user.email)}`;
  document.getElementById('verificando').style.display = 'none';
  document.getElementById('painel-conteudo').style.display = 'block';

  ouvirRelatos((relatos) => {
    state.relatos = relatos;
    atualizarSeletorCidades();
    renderizar();
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
    plugins: {
      title: { display: true, text: titulo, font: { size: 15 } },
      legend: { display: false },
      ...extra.plugins
    },
    ...extra
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

  const contagem = {};
  state.relatos.forEach(r => {
    const { cidade: cidadeR, bairro } = extrairCidadeBairro(r);
    if (!cidadeR || normalizar(cidadeR) !== normalizar(cidade)) return;
    const chave = bairro || 'Não identificado';
    contagem[chave] = (contagem[chave] || 0) + 1;
  });

  const linhas = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 12);

  state.dadosExport = {
    titulo: `bairros-${normalizar(cidade)}`,
    colunas: ['Bairro', 'Quantidade de relatos'],
    linhas: linhas.map(([bairro, total]) => [bairro, total])
  };

  return {
    type: 'bar',
    data: {
      labels: linhas.map(l => l[0]),
      datasets: [{ label: `Relatos em ${cidade}`, data: linhas.map(l => l[1]), backgroundColor: '#C45C00' }]
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
  const tipo = document.getElementById('grafico-tipo').value;
  const wrapCidade = document.getElementById('grafico-filtro-cidade');
  wrapCidade.style.display = tipo === 'bairros' ? '' : 'none';

  let config;
  if (tipo === 'cidades') {
    if (state.popMap.size === 0) {
      atualizarAviso('Carregando dados de população do IBGE...');
      state.popMap = await obterPopulacaoPB();
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

  if (!config) return;

  if (chartAtual) chartAtual.destroy();
  chartAtual = new Chart(document.getElementById('grafico-canvas'), config);
}

document.getElementById('grafico-tipo')?.addEventListener('change', renderizar);
document.getElementById('grafico-filtro-cidade')?.addEventListener('change', renderizar);

// ── Baixar gráfico como PNG (com fundo branco, pra abrir bem em qualquer visualizador) ──
document.getElementById('btn-baixar-png')?.addEventListener('click', () => {
  const original = document.getElementById('grafico-canvas');
  const exportado = document.createElement('canvas');
  exportado.width = original.width;
  exportado.height = original.height;

  const ctx = exportado.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportado.width, exportado.height);
  ctx.drawImage(original, 0, 0);

  const tipo = document.getElementById('grafico-tipo').value;
  const a = document.createElement('a');
  a.href = exportado.toDataURL('image/png');
  a.download = `grafico-${tipo}.png`;
  a.click();
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