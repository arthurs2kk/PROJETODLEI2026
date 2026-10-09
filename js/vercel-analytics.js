// O endpoint /_vercel/insights existe somente quando a página está na Vercel.
// Não o solicita no Live Server para evitar 404 e bloqueio por MIME type.
if (!['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) {
  const script = document.createElement('script');
  script.src = '/_vercel/insights/script.js';
  script.defer = true;
  document.head.appendChild(script);
}
