// ── Pro Povo — endereco.js ──
// Autocomplete de endereços reais usando Nominatim (OpenStreetMap, gratuito)

let debounceTimer = null;

// ── Busca sugestões de endereço conforme o usuário digita ──
export async function buscarSugestoesEndereco(query) {
  if (query.length < 4) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=br&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const dados = await resp.json();

    return dados.map(item => ({
      texto: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  } catch (e) {
    console.warn('Erro ao buscar endereços:', e);
    return [];
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