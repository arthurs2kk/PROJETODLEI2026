const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
const navbar = document.querySelector('.navbar');

function posicionarMenu() {
  if (!navbar || !mobileMenu) return;
  mobileMenu.style.top = `${navbar.getBoundingClientRect().bottom}px`;
}

hamburger?.addEventListener('click', () => {
  posicionarMenu();
  const aberto = mobileMenu?.classList.toggle('open');
  hamburger.classList.toggle('active', aberto);
  hamburger.setAttribute('aria-expanded', String(Boolean(aberto)));
});

window.addEventListener('resize', () => {
  if (mobileMenu?.classList.contains('open')) posicionarMenu();
});

window.addEventListener('scroll', () => {
  if (mobileMenu?.classList.contains('open')) posicionarMenu();
}, { passive: true });

mobileMenu?.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link && !link.matches('#theme-toggle-mobile')) {
    mobileMenu.classList.remove('open');
    hamburger?.classList.remove('active');
    hamburger?.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  mobileMenu?.classList.remove('open');
  hamburger?.classList.remove('active');
  hamburger?.setAttribute('aria-expanded', 'false');
});