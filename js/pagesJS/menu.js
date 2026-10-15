const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
const navbar = document.querySelector('.navbar');

function posicionarMenu() {
  if (!navbar || !mobileMenu) return;
  mobileMenu.style.top = `${navbar.getBoundingClientRect().bottom}px`;
}

function fecharMenu(devolverFoco = false) {
  const estavaAberto = mobileMenu?.classList.contains('open');
  mobileMenu?.classList.remove('open');
  hamburger?.classList.remove('active');
  hamburger?.setAttribute('aria-expanded', 'false');
  if (estavaAberto && devolverFoco) hamburger?.focus();
}

hamburger?.addEventListener('click', () => {
  posicionarMenu();
  const aberto = mobileMenu?.classList.toggle('open');
  hamburger.classList.toggle('active', aberto);
  hamburger.setAttribute('aria-expanded', String(Boolean(aberto)));
});

window.addEventListener('resize', () => {
  if (hamburger && getComputedStyle(hamburger).display === 'none') { fecharMenu(); return; }
  if (mobileMenu?.classList.contains('open')) posicionarMenu();
});

window.addEventListener('scroll', () => {
  if (mobileMenu?.classList.contains('open')) posicionarMenu();
}, { passive: true });

mobileMenu?.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link && !link.matches('#theme-toggle-mobile')) {
    fecharMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  fecharMenu(true);
});

document.addEventListener('click', event => {
  if (!mobileMenu?.classList.contains('open') || mobileMenu.contains(event.target) || hamburger?.contains(event.target)) return;
  fecharMenu();
});
