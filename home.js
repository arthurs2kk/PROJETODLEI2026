// ── Pro Povo — app.js ──

const state = {
  cat: 'todos',
  status: 'todos',
  votes: { 1: 143, 2: 87, 3: 64 },
  voted: {},
};

// ── Modal ──
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
//entrar/criar conta
document.getElementById('btn-entrar').addEventListener('click', (event) => {
    window.location.href = 'login.html'; 
});

document.getElementById('btn-relatar')?.addEventListener('click', openModal);
document.getElementById('btn-relatar-side')?.addEventListener('click', openModal);
document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('btn-cancelar')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});

// ── Envio ──
document.getElementById('btn-enviar')?.addEventListener('click', () => {
  const campos = [
    document.getElementById('f-titulo').value.trim(),
    document.getElementById('f-cat').value,
    document.getElementById('f-desc').value.trim(),
    document.getElementById('f-local').value.trim(),
  ];
  if (campos.some(v => !v)) {
    showToast('⚠️  Preencha todos os campos obrigatórios.');
    return;
  }
  closeModal();
  ['f-titulo','f-cat','f-desc','f-local'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showToast('✅  Relato enviado! Obrigado pela sua participação.');
});

// ── Upload ──
document.getElementById('upload-area')?.addEventListener('click', () => {
  document.getElementById('f-foto').click();
});
document.getElementById('f-foto')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const area = document.getElementById('upload-area');
  area.innerHTML = `<i class="ti ti-photo-check" style="color:var(--verde);font-size:32px"></i><strong>${file.name}</strong><span>Foto anexada com sucesso</span>`;
  area.style.borderColor = 'var(--verde)';
  area.style.background = 'var(--verde-claro)';
});

// ── Menu mobile ──
document.getElementById('hamburger')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('open');
});

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

document.getElementById('btn-limpar')?.addEventListener('click', () => {
  state.cat = 'todos'; state.status = 'todos';
  document.querySelectorAll('#cat-filters .filter-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('#status-filters .filter-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  renderCards();
});

document.getElementById('sort-select')?.addEventListener('change', renderCards);

// ── Votos ──
document.querySelectorAll('.vote-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const el = btn.querySelector('.vcount');
    if (state.voted[id]) {
      state.votes[id]--;
      state.voted[id] = false;
      btn.classList.remove('voted');
    } else {
      state.votes[id]++;
      state.voted[id] = true;
      btn.classList.add('voted');
    }
    el.textContent = state.votes[id];
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => btn.style.transform = '', 160);
    if (document.getElementById('sort-select')?.value === 'votos') renderCards();
  });
});

// ── Render cards ──
function renderCards() {
  const all = Array.from(document.querySelectorAll('#cards-list .card'));
  const sort = document.getElementById('sort-select')?.value || 'votos';

  let visible = all.filter(c => {
    const catOk    = state.cat === 'todos' || c.dataset.cat === state.cat;
    const statusOk = state.status === 'todos' || c.dataset.status === state.status;
    return catOk && statusOk;
  });

  if (sort === 'votos') {
    visible.sort((a,b) => Number(b.dataset.votos) - Number(a.dataset.votos));
  }

  const list = document.getElementById('cards-list');
  all.forEach(c => c.style.display = 'none');
  visible.forEach(c => { c.style.display = 'flex'; list.appendChild(c); });

  document.getElementById('feed-count').textContent =
    `Mostrando ${visible.length} relato${visible.length !== 1 ? 's' : ''}`;

  document.getElementById('empty-state').style.display =
    visible.length === 0 ? 'block' : 'none';
}

// ── Contadores animados ──
function animateCounters() {
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const target = Number(el.dataset.target);
    const steps = 60;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      el.textContent = Math.round((i / steps) * target).toLocaleString('pt-BR');
      if (i >= steps) clearInterval(timer);
    }, 22);
  });
}

// ── Toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  animateCounters();
  renderCards();
});