import { escapeHTML } from './escapeHtml.js';

export function indicadorResolucaoHTML(relato) {
  return relato.status === 'resolvido' && relato.respostaOficial
    ? '<strong class="resposta-resolvida-titulo"><i class="ti ti-circle-check" aria-hidden="true"></i> Problema já resolvido</strong>'
    : '';
}

export function respostaPrefeituraHTML(relato) {
  if (!relato.respostaOficial) return '';
  return `<div class="resposta-cidadao${relato.status === 'resolvido' ? ' resposta-resolvida' : ''}">${indicadorResolucaoHTML(relato)}<strong><i class="ti ti-building-community" aria-hidden="true"></i> Resposta da prefeitura:</strong><p>${escapeHTML(relato.respostaOficial)}</p></div>`;
}
