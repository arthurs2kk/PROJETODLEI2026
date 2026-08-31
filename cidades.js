// ── Pro Povo — cidades.js ──
// Carrega a lista oficial dos municípios da Paraíba (API do IBGE) num <select>.
// Usado no cadastro (login.js) e na edição de perfil (navbar.js).
//
// Também expõe a lista bruta (nome + id do IBGE) e uma função pra resolver o
// cityId de uma cidade a partir do nome. Isso é a base do isolamento por
// cidade do painel administrativo: relatos passam a guardar o código do IBGE
// da cidade (cityId), que é estável e único — diferente do nome em texto
// livre, que pode variar por acentuação/abreviação.

import { normalizar } from "./populacao.js";

let cacheMunicipios = null; // [{ id, nome, nomeNormalizado }]

// ── Busca (com cache em memória) a lista de municípios da PB, com id do IBGE ──
export async function obterMunicipiosPB() {
  if (cacheMunicipios) return cacheMunicipios;

  const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/PB/municipios');
  const dados = await resp.json();

  cacheMunicipios = dados
    .map(m => ({ id: String(m.id), nome: m.nome, nomeNormalizado: normalizar(m.nome) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return cacheMunicipios;
}

// ── Resolve o cityId (código do IBGE) a partir de um nome de cidade ──
// Usado ao criar um relato e no backfill de relatos antigos. Retorna null se
// não encontrar correspondência exata após normalizar (sem acento, minúsculo).
export async function resolverCityId(nomeCidade) {
  if (!nomeCidade) return null;

  try {
    const municipios = await obterMunicipiosPB();
    const alvo = normalizar(nomeCidade);
    const encontrado = municipios.find(m => m.nomeNormalizado === alvo);
    return encontrado ? encontrado.id : null;
  } catch (e) {
    console.warn('Não foi possível resolver o cityId da cidade:', nomeCidade, e);
    return null;
  }
}

export async function carregarCidadesPB(select, valorAtual = '') {
  if (!select) return;

  try {
    const cidades = await obterMunicipiosPB();

    select.replaceChildren(new Option('— Selecione sua cidade —', ''));
    cidades.forEach(cidade => {
      const option = new Option(cidade.nome, cidade.nome, false, cidade.nome === valorAtual);
      // Guardado pra uso futuro (ex: cadastro já resolver o cityId direto,
      // sem precisar de uma segunda chamada). Nada hoje depende disso ainda.
      option.dataset.cityid = cidade.id;
      select.appendChild(option);
    });
  } catch (e) {
    console.warn('Não foi possível carregar a lista de cidades da Paraíba:', e);
    select.innerHTML = '<option value="">Erro ao carregar cidades. Recarregue a página.</option>';
  }
}