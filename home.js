// ── Pro Povo — app.js ──
import { auth, onAuthStateChanged } from "./firebase.js";
import { criarRelato, ouvirRelatos, votar, jaVotou, tempoRestanteParaEnviar } from "./db.js";
import { buscarComDebounce, estaNaParaiba } from "./endereco.js";
import { otimizarImagem } from "./cloudinary.js";
import { initNavbar } from "./navbar.js";
import { escapeHTML } from "./escapeHtml.js";


// ── Estado ──
const state = {
  cat: 'todos',
  status: 'todos',
  votes: { 1: 143, 2: 87, 3: 64 },
  voted: {},
  usuario: null,
  fotoFile: null,
  relatosDoBanco: [],
  enderecoSelecionado: null   
};

// ── Navbar (login/cadastro/nome do usuário/sair/perfil) ──
initNavbar();

// ── Guarda o usuário logado para uso no restante da página (ex: enviar relato) ──
onAuthStateChanged(auth, (user) => {
  state.usuario = user;
});

// ── Modal ──
async function openModal() {
  if (!state.usuario) {
    showToast('⚠️ Você precisa estar logado para relatar. Redirecionando para login...');
    setTimeout(() => window.location.href = 'login.html', 1000);
    return;
  }

  // Recarrega o usuário antes de checar — assim, se ele confirmou o e-mail em
  // outra aba/dispositivo nessa mesma sessão, o status já chega atualizado.
  try { await state.usuario.reload(); } catch (e) { /* segue com o valor já carregado */ }

  if (!auth.currentUser?.emailVerified) {
    showToast('⚠️ Confirme seu e-mail antes de relatar. Abra "Meu perfil" pra reenviar a confirmação, se precisar.');
    return;
  }

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btn-relatar')?.addEventListener('click', openModal);
document.getElementById('btn-relatar-side')?.addEventListener('click', openModal);
document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('btn-cancelar')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

const uploadArea = document.getElementById('upload-area');

uploadArea?.addEventListener('click', (event) => {
  if (event.target.id !== 'f-foto') {
    document.getElementById('f-foto')?.click();
  }
});

uploadArea?.addEventListener('change', (event) => {
  if (event.target.id !== 'f-foto') return;

  const file = event.target.files?.[0];
  if (!file) return;

  const tiposPermitidos = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
  ];

  if (!tiposPermitidos.includes(file.type)) {
    showToast('⚠️ Tipo de imagem não permitido.');
    event.target.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('⚠️ A imagem deve ter no máximo 10 MB.');
    event.target.value = '';
    return;
  }

  state.fotoFile = file;

  uploadArea.replaceChildren();

  const icone = document.createElement('i');
  icone.className = 'ti ti-photo-check';
  icone.style.cssText = 'color:var(--verde);font-size:32px';

  const nome = document.createElement('strong');
  nome.textContent = file.name;

  const texto = document.createElement('span');
  texto.textContent = 'Foto anexada';

  uploadArea.append(icone, nome, texto, event.target);
});

// ── Verificação básica de conteúdo (título/descrição) ──
function verificarConteudo(titulo, descricao) {
  if (titulo.length < 5) {
    return 'O título deve ter pelo menos 5 caracteres.';
  }
  if (descricao.length < 10) {
    return 'A descrição deve ter pelo menos 10 caracteres.';
  }
  const PALAVRAS_PROIBIDAS = ['porra', 'merda', 'caralho', 'fdp', 'desgraça'];
  const textoCompleto = (titulo + ' ' + descricao).toLowerCase();
  const encontrada = PALAVRAS_PROIBIDAS.find(p => textoCompleto.includes(p));
  if (encontrada) {
    return 'Seu relato contém linguagem imprópria. Reescreva de forma respeitosa.';
  }
  return null;
}

// ── Enviar relato ──
document.getElementById('btn-enviar')?.addEventListener('click', async () => {
  const titulo    = document.getElementById('f-titulo').value.trim();
  const categoria = document.getElementById('f-cat').value;
  const descricao = document.getElementById('f-desc').value.trim();
  const endereco  = document.getElementById('f-local').value.trim();

  if (!titulo || !categoria || !descricao || !endereco) {
    showToast('⚠️ Preencha todos os campos obrigatórios.');
    return;
  }

  const erroConteudo = verificarConteudo(titulo, descricao);
  if (erroConteudo) {
    showToast('⚠️ ' + erroConteudo);
    return;
  }

  if (!state.enderecoSelecionado) {
    showToast('⚠️ Selecione um endereço válido na lista de sugestões.');
    return;
  }

  if (!estaNaParaiba(state.enderecoSelecionado.lat, state.enderecoSelecionado.lng)) {
    showToast('⚠️ O Pro Povo aceita relatos apenas de endereços na Paraíba.');
    return;
  }

  const restante = await tempoRestanteParaEnviar(state.usuario.uid);
  if (restante > 0) {
    const minutos = Math.ceil(restante / 60000);
    showToast(`⏳ Aguarde cerca de ${minutos} minuto${minutos > 1 ? 's' : ''} antes de enviar outro relato.`);
    return;
  }

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Enviando...';

  try {
    await criarRelato({
      titulo, categoria, descricao,
      endereco: state.enderecoSelecionado.texto,
      lat: state.enderecoSelecionado.lat,
      lng: state.enderecoSelecionado.lng,
      cidade: state.enderecoSelecionado.cidade,
      bairro: state.enderecoSelecionado.bairro,
      autorId:   state.usuario.uid,
      autorNome: state.usuario.displayName || state.usuario.email.split('@')[0]
    }, state.fotoFile);

    closeModal();
    limparFormulario();
    showToast('✅ Relato enviado com sucesso! Obrigado.');
  } catch (err) {
    console.error(err);
    if (err.code === 'LIMITE_ENVIO') {
      showToast('⏳ Você enviou um relato há pouco tempo. Aguarde alguns minutos antes de enviar outro.');
    } else {
      showToast('❌ Erro ao enviar. Tente novamente.');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send"></i> Enviar relato';
  }
});

function limparFormulario() {
  ['f-titulo', 'f-cat', 'f-desc', 'f-local'].forEach(id => {
    document.getElementById(id).value = '';
  });
  state.fotoFile = null;
  state.enderecoSelecionado = null;                        
  document.getElementById('endereco-status').textContent = ''; 
  const area = document.getElementById('upload-area');
  if (area) area.innerHTML = `<i class="ti ti-photo"></i><strong>Clique para adicionar uma foto</strong><span>JPG, PNG ou HEIC · máx. 10 MB</span><input type="file" id="f-foto" accept="image/*" style="display:none" />`;
}

// ── Carregar relatos do banco em tempo real ──
ouvirRelatos(async (relatos) => {
  state.relatosDoBanco = relatos;
  await renderCards();
  atualizarEstatisticas(relatos);
  atualizarContadoresCategoria(relatos);
});

function atualizarContadoresCategoria(relatos) {
  const todos = document.querySelector('#cat-filters .filter-btn[data-cat="todos"] .fcount');
  if (todos) todos.textContent = relatos.length;

  document.querySelectorAll('#cat-filters .filter-btn[data-cat]:not([data-cat="todos"])').forEach(btn => {
    const cat = btn.dataset.cat;
    const count = relatos.filter(r => r.categoria === cat).length;
    const span = btn.querySelector('.fcount');
    if (span) span.textContent = count;
  });
}

// ── Renderizar cards ──
async function renderCards() {
  const lista = document.getElementById('cards-list');
  if (!lista) return;

  let relatos = [...state.relatosDoBanco];

  // Filtros
  if (state.cat !== 'todos')    relatos = relatos.filter(r => r.categoria === state.cat);
  if (state.status !== 'todos') relatos = relatos.filter(r => r.status === state.status);

  // Ordenação
  relatos.sort((a, b) => b.votos - a.votos);
  relatos = relatos.slice(0, 5);

  document.getElementById('feed-count').textContent =
    `Mostrando ${relatos.length} relato${relatos.length !== 1 ? 's' : ''}`;

  document.getElementById('empty-state').style.display =
    relatos.length === 0 ? 'block' : 'none';

  lista.innerHTML = relatos.map(r => cardHTML(r)).join('');

  // Evento "Ver detalhes"
  lista.querySelectorAll('.detail-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => abrirDetalhe(relatos[i]));
  });

  // Marcar votos do usuário logado
  if (state.usuario) {
    relatos.forEach(async (r) => {
      const votei = await jaVotou(r.id, state.usuario.uid);
      const btn = document.querySelector(`.vote-btn[data-id="${r.id}"]`);
      if (btn && votei) btn.classList.add('voted');
    });
  }

  // Eventos de voto
  lista.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!state.usuario) {
        showToast('⚠️ Faça login para votar.');
        return;
      }
      const id = btn.dataset.id;
      const votei = await votar(id, state.usuario.uid);
      btn.classList.toggle('voted', votei);
    });
  });
}

function abrirDetalhe(r) {
  document.getElementById('detalhe-titulo').textContent = r.titulo;
  document.getElementById('detalhe-desc').textContent   = r.descricao;
  document.getElementById('detalhe-foto').innerHTML = r.fotoUrl
    ? `<img src="${escapeHTML(otimizarImagem(r.fotoUrl, 700))}" alt="Foto do relato" loading="lazy" style="width:100%; border-radius:8px; margin-bottom:12px; max-height:280px; object-fit:cover;">`
    : '';
  document.getElementById('detalhe-resposta').innerHTML = r.respostaOficial
  ? `<div class="resposta-cidadao"><strong><i class="ti ti-building-community"></i> Resposta da prefeitura:</strong><p>${escapeHTML(r.respostaOficial)}</p></div>`
  : '';
  document.getElementById('detalhe-tags').innerHTML = `
    <span class="badge badge-${r.categoria === 'Buraco / Via danificada' ? 'buraco' : 'agua'}">${escapeHTML(r.categoria)}</span>
    <span class="status status-${escapeHTML(r.status)}">${escapeHTML(r.status)}</span>`;
  document.getElementById('detalhe-meta').innerHTML = `
    <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
    <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
    <span><i class="ti ti-clock"></i> ${tempoRelativo(r.dataCriacao)}</span>`;
  document.getElementById('modal-detalhe-overlay').classList.add('open');
}

document.getElementById('detalhe-close')?.addEventListener('click', () => {
  document.getElementById('modal-detalhe-overlay').classList.remove('open');
});
document.getElementById('detalhe-fechar-btn')?.addEventListener('click', () => {
  document.getElementById('modal-detalhe-overlay').classList.remove('open');
});

// ── HTML de cada card ──
function cardHTML(r) {
  const cats = {
  'Buraco / Via danificada': { label: 'Buraco',       icon: 'ti-road-off', side: 'buraco-side', badge: 'badge-buraco' },
  'Iluminação pública':      { label: 'Iluminação',   icon: 'ti-bulb-off', side: 'ilum-side',   badge: 'badge-ilum'  },
  'Lixo / Entulho':          { label: 'Lixo',         icon: 'ti-trash-x',  side: 'lixo-side',   badge: 'badge-lixo'  },
  'Água / Esgoto':           { label: 'Água/Esgoto',  icon: 'ti-droplet',  side: 'agua-side',   badge: 'badge-agua'  },
  'Áreas verdes':            { label: 'Áreas verdes', icon: 'ti-trees',    side: 'lixo-side',   badge: 'badge-lixo'  },
  'Outros':                  { label: 'Outros',       icon: 'ti-dots',     side: 'agua-side',   badge: 'badge-agua'  },
};

  const status = {
    aberto:    { label: 'Aberto',       css: 'status-aberto',    icon: 'ti-circle-x'     },
    andamento: { label: 'Em andamento', css: 'status-andamento', icon: 'ti-clock'         },
    resolvido: { label: 'Resolvido',    css: 'status-resolvido', icon: 'ti-circle-check'  },
  };

  // "cats.outros" (minúsculo) nunca existia como chave — se um relato tivesse uma
  // categoria fora da lista (rules do banco só validam tamanho, não valor), isso
  // deixava `cat` undefined e quebrava a renderização da home inteira. Corrigido
  // para usar a chave real ("Outros", com O maiúsculo).
  const cat = cats[r.categoria]    || cats['Outros'];
  const st  = status[r.status]     || status.aberto;
  const foto = r.fotoUrl
    ? `<img src="${escapeHTML(otimizarImagem(r.fotoUrl, 150))}" alt="Foto do relato" loading="lazy" style="width:72px;height:100%;object-fit:cover;">`
    : `<div class="card-side ${cat.side}"><i class="ti ${cat.icon}"></i></div>`;
  const tempo = tempoRelativo(r.dataCriacao);

  return `
    <article class="card" data-cat="${escapeHTML(r.categoria)}" data-status="${escapeHTML(r.status)}">
      ${foto}
      <div class="card-body">
        <div class="card-tags">
          <span class="badge ${cat.badge}"><i class="ti ti-tag"></i> ${cat.label}</span>
          <span class="status ${st.css}"><i class="ti ${st.icon}"></i> ${st.label}</span>
        </div>
        <h3 class="card-title">${escapeHTML(r.titulo)}</h3>
        <p class="card-desc">${escapeHTML(r.descricao)}</p>
        ${r.respostaOficial ? `
         <div class="resposta-cidadao">
           <strong><i class="ti ti-building-community"></i> Resposta da prefeitura:</strong>
           <p>${escapeHTML(r.respostaOficial)}</p>
         </div>` : ''}
        <div class="card-meta">
          <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
          <span><i class="ti ti-clock"></i> ${tempo}</span>
          <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
        </div>
        <div class="card-footer">
          <button class="vote-btn" data-id="${r.id}">
            <i class="ti ti-thumb-up"></i> <span class="vcount">${r.votos || 0}</span> pessoas apoiam
          </button>
          <button class="detail-btn">Ver detalhes <i class="ti ti-arrow-right"></i></button>
        </div>
      </div>
    </article>`;
}

// ── Tempo relativo ──
function tempoRelativo(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (min < 1)  return 'Agora mesmo';
  if (min < 60) return `Há ${min} minuto${min > 1 ? 's' : ''}`;
  if (h < 24)   return `Há ${h} hora${h > 1 ? 's' : ''}`;
  return `Há ${d} dia${d > 1 ? 's' : ''}`;
}

// ── Atualizar estatísticas do hero ──
function atualizarEstatisticas(relatos) {
  const total     = relatos.length;
  const resolvidos = relatos.filter(r => r.status === 'resolvido').length;
  const andamento  = relatos.filter(r => r.status === 'andamento').length;

  animarNumero('stat-relatos',   total);
  animarNumero('stat-resolvidos', resolvidos);
  animarNumero('stat-andamento',  andamento);
}

function animarNumero(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let i = 0;
  const steps = 40;
  clearInterval(el._timer);
  el._timer = setInterval(() => {
    i++;
    el.textContent = Math.round((i / steps) * target).toLocaleString('pt-BR');
    if (i >= steps) { el.textContent = target.toLocaleString('pt-BR'); clearInterval(el._timer); }
  }, 20);
}

// ── Filtros ──
document.getElementById('cat-filters')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('#cat-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.cat = btn.dataset.cat;
  renderCards();
});

document.getElementById('status-filters')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('#status-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.status = btn.dataset.status;
  renderCards();
});

document.getElementById('sort-select')?.addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderCards();
});

document.getElementById('btn-limpar')?.addEventListener('click', () => {
  state.cat = 'todos'; state.status = 'todos';
  document.querySelectorAll('#cat-filters .filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('#status-filters .filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  renderCards();
});

document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('active');
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

/// ── Autocomplete de endereço ──
const inputLocal = document.getElementById('f-local');
const dropSugestoes = document.getElementById('endereco-sugestoes');
const statusEndereco = document.getElementById('endereco-status');
let sugestoesAtuais = [];

inputLocal?.addEventListener('input', (e) => {
  state.enderecoSelecionado = null;
  statusEndereco.textContent = '';
  statusEndereco.className = 'endereco-status';

  const valor = e.target.value.trim();
  if (valor.length < 4) {
    dropSugestoes.classList.remove('open');
    return;
  }

  buscarComDebounce(valor, (sugestoes) => {
    sugestoesAtuais = sugestoes;
    if (sugestoes.length === 0) {
      dropSugestoes.classList.remove('open');
      return;
    }
    dropSugestoes.replaceChildren();

sugestoes.forEach((s, i) => {
  const item = document.createElement('div');
  item.className = 'sugestao-item';
  item.dataset.i = String(i);

  const icone = document.createElement('i');
  icone.className = 'ti ti-map-pin';

  item.append(icone, document.createTextNode(` ${s.texto}`));
  dropSugestoes.appendChild(item);
});

dropSugestoes.classList.add('open');
  });
});

// Delegação de evento — resolve o problema de clique não funcionar
dropSugestoes?.addEventListener('mousedown', (e) => {
  const item = e.target.closest('.sugestao-item');
  if (!item) return;
  e.preventDefault(); // evita que o input perca foco antes da hora

  const i = Number(item.dataset.i);
  const s = sugestoesAtuais[i];
  inputLocal.value = s.texto;
  state.enderecoSelecionado = s;
  dropSugestoes.classList.remove('open');
  statusEndereco.textContent = '✓ Endereço válido selecionado';
  statusEndereco.className = 'endereco-status valido';
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.endereco-wrap')) dropSugestoes?.classList.remove('open');
});