// ── Pro Povo — app.js ──
import { auth, onAuthStateChanged } from "./firebase.js";
import { criarRelato, ouvirRelatos, votar, jaVotou } from "./db.js";

// ── Estado ──
const state = {
  cat: 'todos',
  status: 'todos',
  sort: 'votos',
  usuario: null,
  fotoFile: null,
  relatosDoBanco: []
};

// ── Usuário logado ──
onAuthStateChanged(auth, (user) => {
  state.usuario = user;
  const btnEntrar    = document.getElementById('btn-entrar');
  const btnCadastrar = document.getElementById('btn-cadastrar');
  if (user) {
    if (btnEntrar)    btnEntrar.textContent    = user.displayName || user.email.split('@')[0];
    if (btnCadastrar) btnCadastrar.textContent = 'Sair';
    btnCadastrar?.addEventListener('click', () => {
      import('./firebase.js').then(({ auth, signOut }) => {
        signOut(auth).then(() => window.location.href = 'login.html');
      });
    }, { once: true });
  }
});
document.getElementById('btn-entrar').addEventListener('click', (event) => {
    window.location.href = 'login.html'; 
});

document.getElementById('btn-cadastrar')?.addEventListener('click', () => {
    window.location.href = 'login.html';
});

// ── Modal ──
function openModal() {
  if (!state.usuario) {
    showToast('⚠️ Você precisa estar logado para relatar. Redirecionando para login...');
    setTimeout(() => window.location.href = 'login.html', 1000);
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

// ── Upload de foto ──
document.getElementById('upload-area')?.addEventListener('click', () => {
  document.getElementById('f-foto').click();
});

document.getElementById('f-foto')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.fotoFile = file;
  const area = document.getElementById('upload-area');
  area.innerHTML = `<i class="ti ti-photo-check" style="color:var(--verde);font-size:32px"></i><strong>${file.name}</strong><span>Foto anexada</span>`;
});

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

  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 0.8s linear infinite"></i> Enviando...';

  try {
    await criarRelato({
      titulo, categoria, descricao, endereco,
      autorId:   state.usuario.uid,
      autorNome: state.usuario.displayName || state.usuario.email.split('@')[0]
    }, state.fotoFile);

    closeModal();
    limparFormulario();
    showToast('✅ Relato enviado com sucesso! Obrigado.');
  } catch (err) {
    console.error(err);
    showToast('❌ Erro ao enviar. Tente novamente.');
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
    btn.addEventListener('click', () => {
      const r = relatos[i];
      lista.querySelectorAll('.detail-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => abrirDetalhe(relatos[i]));
  });
    });
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
  document.getElementById('detalhe-tags').innerHTML = `
    <span class="badge badge-${r.categoria === 'Buraco / Via danificada' ? 'buraco' : 'agua'}">${r.categoria}</span>
    <span class="status status-${r.status}">${r.status}</span>`;
  document.getElementById('detalhe-meta').innerHTML = `
    <span><i class="ti ti-map-pin"></i> ${r.endereco}</span>
    <span><i class="ti ti-user"></i> ${r.autorNome}</span>
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

  const cat = cats[r.categoria]    || cats.outros;
  const st  = status[r.status]     || status.aberto;
  const foto = r.fotoUrl
    ? `<img src="${r.fotoUrl}" alt="Foto do relato" style="width:72px;height:100%;object-fit:cover;">`
    : `<div class="card-side ${cat.side}"><i class="ti ${cat.icon}"></i></div>`;
  const tempo = tempoRelativo(r.dataCriacao);

  return `
    <article class="card" data-cat="${r.categoria}" data-status="${r.status}">
      ${foto}
      <div class="card-body">
        <div class="card-tags">
          <span class="badge ${cat.badge}"><i class="ti ti-tag"></i> ${cat.label}</span>
          <span class="status ${st.css}"><i class="ti ${st.icon}"></i> ${st.label}</span>
        </div>
        <h3 class="card-title">${r.titulo}</h3>
        <p class="card-desc">${r.descricao}</p>
        <div class="card-meta">
          <span><i class="ti ti-map-pin"></i> ${r.endereco}</span>
          <span><i class="ti ti-clock"></i> ${tempo}</span>
          <span><i class="ti ti-user"></i> ${r.autorNome}</span>
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
