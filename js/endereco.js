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

async function respeitarLimiteNominatim() {
  // A instância pública do Nominatim permite, no máximo, uma requisição por
  // segundo por aplicação. Busca e geocodificação reversa compartilham o limite.
  const espera = Math.max(0, 1100 - (Date.now() - ultimaConsulta));
  if (espera > 0) await new Promise(resolve => setTimeout(resolve, espera));
  ultimaConsulta = Date.now();
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

export function converterResultadoNominatim(item, municipios, coordenadas = null) {
  const addr = item?.address || {};
  const municipio = identificarMunicipioPB(addr, municipios);
  const lat = coordenadas?.lat ?? parseFloat(item?.lat);
  const lng = coordenadas?.lng ?? parseFloat(item?.lon);

  return {
    texto: textoValido(item?.display_name),
    lat,
    lng,
    estado: addr.state || null,
    estadoCodigo: addr['ISO3166-2-lvl4'] || addr['ISO3166-2-lvl6'] || null,
    cidade: municipio?.nome || null,
    cityId: municipio?.id || null,
    bairro: identificarBairro(addr, municipio),
    rua: identificarRua(addr),
    numero: textoValido(addr.house_number)
  };
}

function pertenceAParaiba(sugestao) {
  return sugestao.cidade && sugestao.cityId && sugestao.texto &&
    Number.isFinite(sugestao.lat) && Number.isFinite(sugestao.lng) &&
    estaNaParaiba(sugestao.lat, sugestao.lng) &&
    ((sugestao.estado && normalizar(sugestao.estado) === 'paraiba') ||
      sugestao.estadoCodigo === 'BR-PB');
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
  await respeitarLimiteNominatim();

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

    const sugestoes = dados.map(item => converterResultadoNominatim(item, municipios));


  
    const naParaiba = sugestoes.filter(pertenceAParaiba);

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

export function obterCoordenadasAtuais(geolocation = globalThis.navigator?.geolocation) {
  if (!geolocation?.getCurrentPosition) {
    return Promise.reject(new ErroBuscaEndereco(
      'GPS_NAO_SUPORTADO',
      'Este navegador não oferece acesso à localização.'
    ));
  }

  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      posicao => {
        const lat = Number(posicao?.coords?.latitude);
        const lng = Number(posicao?.coords?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          reject(new ErroBuscaEndereco('LOCALIZACAO_INVALIDA', 'O GPS retornou coordenadas inválidas.'));
          return;
        }
        resolve({ lat, lng });
      },
      erro => {
        const codigos = {
          1: ['PERMISSAO_GPS_NEGADA', 'A permissão de localização foi negada.'],
          2: ['GPS_INDISPONIVEL', 'Não foi possível determinar sua localização.'],
          3: ['GPS_TIMEOUT', 'O GPS demorou mais que o esperado.']
        };
        const [codigo, mensagem] = codigos[erro?.code] || codigos[2];
        reject(new ErroBuscaEndereco(codigo, mensagem));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

export async function buscarEnderecoPorCoordenadas(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new ErroBuscaEndereco('LOCALIZACAO_INVALIDA', 'As coordenadas recebidas são inválidas.');
  }
  if (!estaNaParaiba(latitude, longitude)) {
    throw new ErroBuscaEndereco('FORA_PARAIBA', 'Sua localização atual está fora da Paraíba.');
  }

  const chaveCache = `gps:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (cacheBuscas.has(chaveCache)) {
    const resultado = cacheBuscas.get(chaveCache);
    if (resultado instanceof ErroBuscaEndereco) throw resultado;
    return resultado;
  }

  await respeitarLimiteNominatim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18` +
      `&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
    const resp = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' },
      signal: controller.signal
    });
    if (!resp.ok) {
      throw new ErroBuscaEndereco(
        resp.status === 429 ? 'LIMITE_NOMINATIM' : 'HTTP_NOMINATIM',
        `O Nominatim respondeu com HTTP ${resp.status}.`,
        resp.status
      );
    }

    const [item, municipios] = await Promise.all([resp.json(), obterMunicipiosPB()]);
    if (!item || typeof item !== 'object' || item.error) {
      throw new ErroBuscaEndereco('ENDERECO_NAO_ENCONTRADO', 'Não foi possível identificar o endereço atual.');
    }

    // Mantemos as coordenadas medidas pelo aparelho; os campos textuais vêm do
    // ponto mais próximo cadastrado no OpenStreetMap.
    const sugestao = converterResultadoNominatim(item, municipios, {
      lat: latitude,
      lng: longitude
    });

    if (!pertenceAParaiba(sugestao)) {
      throw new ErroBuscaEndereco('FORA_PARAIBA', 'A localização não pertence a um município da Paraíba.');
    }
    if (!sugestao.bairro) {
      throw new ErroBuscaEndereco(
        'BAIRRO_NAO_IDENTIFICADO',
        'O OpenStreetMap não informou o bairro desta localização.'
      );
    }

    salvarNoCache(chaveCache, sugestao);
    return sugestao;
  } catch (e) {
    console.warn('Erro ao identificar endereço pelas coordenadas:', e);
    if (e instanceof ErroBuscaEndereco) {
      if (['ENDERECO_NAO_ENCONTRADO', 'BAIRRO_NAO_IDENTIFICADO'].includes(e.codigo)) {
        salvarNoCache(chaveCache, e);
      }
      throw e;
    }
    if (e?.name === 'AbortError') {
      throw new ErroBuscaEndereco('TIMEOUT', 'A identificação do endereço excedeu o tempo limite.');
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
