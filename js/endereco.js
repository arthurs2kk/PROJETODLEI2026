import { normalizar } from "./populacao.js";
import { obterMunicipiosPB } from "./cidades.js";

let debounceTimer = null;

const VIEWBOX_PARAIBA = "-38.85,-6.02,-34.79,-8.31";

const LIMITES_PB = { latMin: -8.31, latMax: -6.02, lngMin: -38.85, lngMax: -34.79 };

// O Nominatim pode devolver uma cidade regional em `city` e o município real
// em `municipality`, `town` ou `village` (caso comum na região de Campina
// Grande). Comparamos esses campos com a relação oficial do IBGE e damos
// prioridade ao município administrativo antes da cidade de referência.
function identificarMunicipioPB(address, municipios) {
  const candidatos = [
    address.municipality,
    address.town,
    address.village,
    address.city
  ].filter(Boolean);

  for (const candidato of candidatos) {
    const nomeNormalizado = normalizar(candidato);
    const municipio = municipios.find(item => item.nomeNormalizado === nomeNormalizado);
    if (municipio) return municipio;
  }

  return null;
}

export async function buscarSugestoesEndereco(query) {
  if (query.length < 4) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8` +
                `&countrycodes=br&viewbox=${VIEWBOX_PARAIBA}&bounded=1` +
                `&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
    if (!resp.ok) return [];
    const [dados, municipios] = await Promise.all([
      resp.json(),
      obterMunicipiosPB()
    ]);


    const sugestoes = dados.map(item => {
      const addr = item.address || {};
      const municipio = identificarMunicipioPB(addr, municipios);
      return {
        texto:  item.display_name,
        lat:    parseFloat(item.lat),
        lng:    parseFloat(item.lon),
        estado: addr.state || null,
        cidade: municipio?.nome || null,
        cityId: municipio?.id || null,
        bairro: addr.suburb || addr.neighbourhood || addr.city_district || addr.quarter || null,
        rua:    addr.road || addr.pedestrian || addr.footway || addr.residential || null
      };
    });


  
    return sugestoes.filter(s =>
      s.cidade && s.cityId && s.bairro && s.rua &&
      s.estado && normalizar(s.estado).includes('paraiba')
    );

  } catch (e) {
    console.warn('Erro ao buscar endereços:', e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ── Versão com debounce, pronta para usar em eventos de input ──
export function buscarComDebounce(query, callback, delay = 500) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const sugestoes = await buscarSugestoesEndereco(query);
    callback(sugestoes);
  }, delay);
}

export function estaNaParaiba(lat, lng) {
  return lat >= LIMITES_PB.latMin && lat <= LIMITES_PB.latMax &&
         lng >= LIMITES_PB.lngMin && lng <= LIMITES_PB.lngMax;
}
