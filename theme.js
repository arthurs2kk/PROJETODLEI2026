const THEME_KEY = 'theme';

function aplicarTema(tema) {
  const escuro = tema === 'dark';
  document.documentElement.dataset.theme = escuro ? 'dark' : 'light';

  document.querySelectorAll('#theme-toggle').forEach((botao) => {
    botao.innerHTML = escuro
      ? '<i class="ti ti-sun" aria-hidden="true"></i>'
      : '<i class="ti ti-moon" aria-hidden="true"></i>';
    botao.setAttribute('aria-label', escuro ? 'Ativar modo claro' : 'Ativar modo escuro');
  });

  document.querySelectorAll('#theme-toggle-mobile').forEach((botao) => {
    botao.innerHTML = escuro
      ? '<i class="ti ti-sun"></i> Modo claro'
      : '<i class="ti ti-moon"></i> Modo escuro';
  });

  window.dispatchEvent(new CustomEvent('themechange', {
    detail: { tema: escuro ? 'dark' : 'light' }
  }));
}

const salvo = localStorage.getItem(THEME_KEY);
const inicial = salvo || (
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

aplicarTema(inicial);

document.addEventListener('click', (event) => {
  const botao = event.target.closest('#theme-toggle, #theme-toggle-mobile');
  if (!botao) return;

  event.preventDefault();

  const novoTema = document.documentElement.dataset.theme === 'dark'
    ? 'light'
    : 'dark';

  localStorage.setItem(THEME_KEY, novoTema);
  aplicarTema(novoTema);
});

window.addEventListener('storage', (event) => {
  if (event.key === THEME_KEY) aplicarTema(event.newValue || 'light');
});