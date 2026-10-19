// Estatísticas opcionais: o script da Vercel só é carregado depois da escolha.
(() => {
  const CHAVE = 'proPovo:analytics:v1';
  const scriptAtual = document.currentScript?.src || new URL('js/vercel-analytics.js', location.href).href;
  const politicaUrl = new URL('../pages/userPages/privacidade.html', scriptAtual).href;
  let carregado = false;

  function lerEscolha() {
    try { return localStorage.getItem(CHAVE); } catch { return null; }
  }

  function salvarEscolha(valor) {
    try { localStorage.setItem(CHAVE, valor); } catch { /* O navegador pode bloquear o armazenamento. */ }
  }

  function carregarAnalytics() {
    if (carregado || document.querySelector('script[data-pro-povo-analytics]')) return;
    carregado = true;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const script = document.createElement('script');
    script.defer = true;
    script.src = '/_vercel/insights/script.js';
    script.dataset.proPovoAnalytics = 'true';
    document.head.appendChild(script);
  }

  function removerBanner() {
    document.getElementById('privacidade-banner')?.remove();
  }

  function mostrarPreferencia() {
    if (document.getElementById('privacidade-preferencias')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'privacidade-preferencias';
    btn.className = 'privacidade-preferencias';
    btn.textContent = 'Privacidade';
    btn.setAttribute('aria-label', 'Alterar preferência de estatísticas');
    btn.addEventListener('click', mostrarBanner);
    document.body.appendChild(btn);
  }

  function escolher(valor) {
    const anterior = lerEscolha();
    salvarEscolha(valor);
    removerBanner();
    if (valor === 'permitido') carregarAnalytics();
    mostrarPreferencia();
    if (valor === 'essencial' && anterior === 'permitido') location.reload();
  }

  function mostrarBanner() {
    removerBanner();
    const banner = document.createElement('section');
    banner.id = 'privacidade-banner';
    banner.className = 'privacidade-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de privacidade');
    banner.innerHTML = `
      <div>
        <strong>Estatísticas de uso</strong>
        <p>Com sua permissão, usamos estatísticas da Vercel para entender visitas e melhorar o site. A navegação funciona normalmente sem elas. <a href="${politicaUrl}">Saiba mais</a>.</p>
      </div>
      <div class="privacidade-banner-acoes">
        <button type="button" class="btn-outline" data-escolha="essencial">Somente essenciais</button>
        <button type="button" class="btn-primary" data-escolha="permitido">Permitir estatísticas</button>
      </div>`;
    banner.querySelectorAll('[data-escolha]').forEach(btn => {
      btn.addEventListener('click', () => escolher(btn.dataset.escolha));
    });
    document.body.appendChild(banner);
    banner.querySelector('button')?.focus();
  }

  function iniciar() {
    const escolha = lerEscolha();
    if (escolha === 'permitido') carregarAnalytics();
    if (escolha) mostrarPreferencia();
    else mostrarBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
