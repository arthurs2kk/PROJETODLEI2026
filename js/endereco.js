import { normalizar } from "./populacao.js";
import { obterMunicipiosPB } from "./cidades.js";

const cacheBuscas = new Map();
let ultimaConsulta = 0;

const VIEWBOX_PARAIBA = "-38.85,-6.02,-34.79,-8.31";

const LIMITES_PB = { latMin: -8.31, latMax: -6.02, lngMin: -38.85, lngMax: -34.79 };

export class ErroBuscaEndereco extends Error {
  constructor(codigo, mensagem, status = null) {
    super(mensagem);
    this.name = 'ErroBuscaEndereco';
    this.codigo = codigo;
    this.status = status;
  }
}

function textoValido(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function salvarNoCache(chave, valor) {
  cacheBuscas.set(chave, valor);
  if (cacheBuscas.size > 50) cacheBuscas.delete(cacheBuscas.keys().next().value);
}

// O Nominatim pode devolver uma cidade regional em `city` e o município real
// em `municipality`, `town` ou `village` (caso comum na região de Campina
// Grande). Comparamos esses campos com a relação oficial do IBGE e damos
// prioridade ao município administrativo antes da cidade de referência.
export function identificarMunicipioPB(address, municipios) {
  const candidatos = [
    address.municipality,
    address.city,
    address.town,
    address.city_district,
    address.village,
    address.county
  ].filter(Boolean);

  for (const candidato of candidatos) {
    const nomeNormalizado = normalizar(candidato);
    const municipio = municipios.find(item => item.nomeNormalizado === nomeNormalizado);
    if (municipio) return municipio;
  }

  return null;
}

// Os nomes das chaves do addressdetails dependem de como cada local foi
// cadastrado no OpenStreetMap. Campos como village e city_district podem ser
// tanto bairro/distrito quanto o próprio município. Só os usamos como bairro
// quando forem diferentes do município reconhecido pelo IBGE.
export function identificarBairro(address, municipio) {
  const nomesAdministrativos = new Set([
    municipio?.nome,
    address.municipality,
    address.city,
    address.town,
    address.state,
    address.region,
    address.country
  ].filter(Boolean).map(normalizar));

  const candidatos = [
    address.suburb,
    address.neighbourhood,
    address.quarter,
    address.borough,
    address.residential,
    address.locality,
    address.hamlet,
    address.village,
    address.city_district,
    address.district
  ];

  for (const candidato of candidatos) {
    const bairro = textoValido(candidato);
    if (!bairro) continue;
    if (nomesAdministrativos.has(normalizar(bairro))) continue;
    return bairro.slice(0, 120);
  }

  return null;
}

function identificarRua(address) {
  return textoValido(
    address.road || address.pedestrian || address.footway ||
    address.path || address.cycleway || address.square
  );
}

export function removerDuplicadas(sugestoes) {
  const chaves = new Set();
  return sugestoes.filter(sugestao => {
    // Uma rua pode aparecer várias vezes porque o OSM a divide em segmentos.
    // Para a escolha do usuário, basta uma opção por rua/bairro (ou por número,
    // quando a consulta encontrou um imóvel específico).
    const chave = sugestao.numero
      ? `${sugestao.cityId}|${normalizar(sugestao.bairro)}|${normalizar(sugestao.rua)}|${normalizar(sugestao.numero)}`
      : sugestao.rua
        ? `${sugestao.cityId}|${normalizar(sugestao.bairro)}|${normalizar(sugestao.rua)}`
        : normalizar(sugestao.texto);

    if (chaves.has(chave)) return false;
    chaves.add(chave);
    return true;
  });
}

export async function buscarSugestoesEndereco(query) {
  const termo = query.trim();
  if (termo.length < 6) return [];

  const chaveCache = normalizar(termo);
  if (cacheBuscas.has(chaveCache)) {
    const resultado = cacheBuscas.get(chaveCache);
    if (resultado instanceof ErroBuscaEndereco) throw resultado;
    return resultado;
  }

  // O serviço público aceita no máximo uma consulta por segundo por aplicação.
  // Esta espera impede cliques sucessivos no mesmo navegador de ultrapassarem
  // esse intervalo; a busca manual evita consultas a cada tecla digitada.
  const espera = Math.max(0, 1100 - (Date.now() - ultimaConsulta));
  if (espera > 0) {
    await new Promise(resolve => setTimeout(resolve, espera));
  }
  ultimaConsulta = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8` +
                `&countrycodes=br&viewbox=${VIEWBOX_PARAIBA}&bounded=1` +
                `&q=${encodeURIComponent(termo)}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
    if (!resp.ok) {
      throw new ErroBuscaEndereco(
        resp.status === 429 ? 'LIMITE_NOMINATIM' : 'HTTP_NOMINATIM',
        `O Nominatim respondeu com HTTP ${resp.status}.`,
        resp.status
      );
    }
    const [dados, municipios] = await Promise.all([
      resp.json(),
      obterMunicipiosPB()
    ]);

    if (!Array.isArray(dados)) {
      throw new ErroBuscaEndereco('RESPOSTA_INVALIDA', 'O Nominatim retornou uma resposta inválida.');
    }

    const sugestoes = dados.map(item => {
      const addr = item.address || {};
      const municipio = identificarMunicipioPB(addr, municipios);
      return {
        texto:  item.display_name,
        lat:    parseFloat(item.lat),
        lng:    parseFloat(item.lon),
        estado: addr.state || null,
        estadoCodigo: addr['ISO3166-2-lvl4'] || addr['ISO3166-2-lvl6'] || null,
        cidade: municipio?.nome || null,
        cityId: municipio?.id || null,
        bairro: identificarBairro(addr, municipio),
        rua:    identificarRua(addr),
        numero: textoValido(addr.house_number)
      };
    });


  
    const naParaiba = sugestoes.filter(s =>
      s.cidade && s.cityId &&
      Number.isFinite(s.lat) && Number.isFinite(s.lng) && estaNaParaiba(s.lat, s.lng) &&
      ((s.estado && normalizar(s.estado) === 'paraiba') || s.estadoCodigo === 'BR-PB')
    );

    // O bairro continua obrigatório: ele é persistido no relato e alimenta os
    // gráficos administrativos. Resultados em que o OSM não informa nenhum
    // bairro/distrito confiável não podem ser selecionados.
    const validas = removerDuplicadas(naParaiba.filter(s => s.bairro));

    if (naParaiba.length > 0 && validas.length === 0) {
      const erro = new ErroBuscaEndereco(
        'BAIRRO_NAO_IDENTIFICADO',
        'Foram encontrados locais, mas o OpenStreetMap não informou o bairro.'
      );
      salvarNoCache(chaveCache, erro);
      throw erro;
    }

    salvarNoCache(chaveCache, validas);

    return validas;

  } catch (e) {
    console.warn('Erro ao buscar endereços:', e);
    if (e instanceof ErroBuscaEndereco) throw e;
    if (e?.name === 'AbortError') {
      throw new ErroBuscaEndereco('TIMEOUT', 'A busca de endereço excedeu o tempo limite.');
    }
    throw new ErroBuscaEndereco('SERVICO_INDISPONIVEL', 'O serviço de endereços está indisponível.');
  } finally {
    clearTimeout(timeout);
  }
}

export function estaNaParaiba(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
         lat >= LIMITES_PB.latMin && lat <= LIMITES_PB.latMax &&
         lng >= LIMITES_PB.lngMin && lng <= LIMITES_PB.lngMax;
}
