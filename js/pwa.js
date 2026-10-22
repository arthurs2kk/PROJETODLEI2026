(() => {
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  let installPrompt = null;

  function removeInstallButton() {
    document.getElementById('pwa-install-button')?.remove();
  }

  function showNotice(message) {
    document.getElementById('pwa-notice')?.remove();
    const notice = document.createElement('div');
    notice.id = 'pwa-notice';
    notice.className = 'pwa-notice';
    notice.setAttribute('role', 'status');
    notice.textContent = message;
    document.body.appendChild(notice);
    requestAnimationFrame(() => notice.classList.add('show'));
    window.setTimeout(() => {
      notice.classList.remove('show');
      window.setTimeout(() => notice.remove(), 220);
    }, 4500);
  }

  function ensureInstallButton() {
    if (isStandalone() || document.getElementById('pwa-install-button')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'pwa-install-button';
    button.className = 'pwa-install-button';
    button.setAttribute('aria-label', 'Instalar o aplicativo Pro Povo');
    button.innerHTML = '<span aria-hidden="true">↓</span> Instalar app';
    button.addEventListener('click', async () => {
      if (installPrompt) {
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        removeInstallButton();
        return;
      }

      if (isIos()) {
        showNotice('No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
      }
    });
    document.body.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    ensureInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    removeInstallButton();
    showNotice('Pro Povo instalado com sucesso.');
  });

  window.addEventListener('offline', () => showNotice('Você está sem conexão. Algumas funções ficarão indisponíveis.'));
  window.addEventListener('online', () => showNotice('Conexão restabelecida.'));

  function init() {
    if (!isStandalone() && isIos()) ensureInstallButton();

    if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
        console.warn('Não foi possível ativar o modo aplicativo.', error);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
