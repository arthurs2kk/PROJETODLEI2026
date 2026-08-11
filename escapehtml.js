// ── Pro Povo — escapeHtml.js ──
// Evita XSS: qualquer texto que venha do banco (título, descrição, nome do autor,
// resposta oficial, endereço, URL de foto, etc.) precisa passar por aqui ANTES de
// ser inserido em innerHTML/template string. Sem isso, um relato com algo como
// `<img src=x onerror="...">` no título executaria na tela de qualquer visitante
// (inclusive na sessão autenticada do admin).
export function escapeHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}