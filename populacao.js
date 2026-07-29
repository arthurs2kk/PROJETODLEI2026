// ── Pro Povo — populacao.js ──
// Busca as estimativas de população dos municípios da Paraíba (IBGE, tabela 6579 —
// "Estimativas da população residente") para permitir comparar relatos "por habitante"
// entre cidades. Resultado fica em cache na memória enquanto a página estiver aberta.

let cache = null;

// Remove acentos e normaliza caixa, pra comparar nomes de cidades com segurança
// (ex: nomes vindos do Nominatim x nomes vindos do IBGE).
export function normalizar(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}

// Retorna um Map: nome normalizado da cidade → população estimada (número).
// Em caso de falha na API, retorna um Map vazio (o gráfico degrada de forma graciosa).
export async function obterPopulacaoPB() {
  if (cache) return cache;

  const mapa = new Map();
  try {
    // N6[N3[25]]: nível município (N6), dentro do estado (N3) de código 25 = Paraíba
    const url = 'https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[N3[25]]';
    const resp = await fetch(url);
    const dados = await resp.json();

    const series = dados?.[0]?.resultados?.[0]?.series || [];
    series.forEach(s => {
      const nome = (s.localidade?.nome || '').replace(/\s*-\s*PB$/i, '').trim();
      const anos = Object.keys(s.serie || {});
      const ultimoAno = anos[anos.length - 1];
      const valor = parseInt(s.serie?.[ultimoAno], 10);
      if (nome && !isNaN(valor)) {
        mapa.set(normalizar(nome), valor);
      }
    });
  } catch (e) {
    console.warn('Não foi possível carregar os dados de população do IBGE:', e);
  }

  cache = mapa;
  return mapa;
}