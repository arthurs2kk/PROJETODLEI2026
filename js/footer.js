// Script para adicionar o footer com links configuráveis
const footerScriptUrl = document.currentScript?.src || new URL('js/footer.js', window.location.href).href;

document.addEventListener('DOMContentLoaded', function() {
  const footerLinks = document.querySelectorAll('.footer-author-link');
  footerLinks.forEach(link => {
    link.href = CONFIG.githubAuthor;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });

  const footer = document.querySelector('.site-footer');
  if (footer && !footer.querySelector('a[href*="privacidade.html"]')) {
    const linhaLegal = document.createElement('p');
    linhaLegal.className = 'footer-legal-links';
    linhaLegal.innerHTML = `
      <a href="${new URL('../pages/userPages/termos.html', footerScriptUrl).href}">Termos de Uso</a>
      &nbsp;·&nbsp;
      <a href="${new URL('../pages/userPages/privacidade.html', footerScriptUrl).href}">Política de Privacidade</a>`;
    footer.appendChild(linhaLegal);
  }
});
