// Inicia a primeira leitura publica antes que a cadeia de modulos do Firebase
// termine de carregar. O resultado e consumido por db.js; em caso de falha, a
// consulta normal do SDK continua sendo o fallback.
(() => {
  const script = document.currentScript;
  const tipo = script?.dataset.tipo;
  const tamanho = Math.max(1, Math.min(Number(script?.dataset.tamanho) || 20, 100));
  const cidade = script?.dataset.cidade || '';
  const prefixoCache = 'proPovo:cache:v1:';
  const ttlCache = 90 * 1000;

  const configuracoes = {
    destaque: {
      chaveCache: `relatos:resumo:destaque:${tamanho}`,
      campoOrdenacao: 'votos',
      valores: [null]
    },
    lista: {
      chaveCache: `relatos:resumo:pagina-inicial:v2:${tamanho}:${encodeURIComponent(`cityId:${cidade}`)}`,
      campoOrdenacao: 'cityId',
      valores: /^25\d{5}$/.test(cidade) ? [cidade, Number(cidade)] : []
    }
  };
  const configuracao = configuracoes[tipo];
  if (!configuracao || configuracao.valores.length === 0) return;

  try {
    const bruto = localStorage.getItem(prefixoCache + configuracao.chaveCache);
    const cache = bruto && JSON.parse(bruto);
    if (cache && Number.isFinite(cache.salvoEm) && Date.now() - cache.salvoEm <= ttlCache) return;
  } catch (_) {
    // Cache indisponivel ou corrompido: a leitura antecipada ainda pode seguir.
  }

  const base = 'https://pro--povo-default-rtdb.firebaseio.com/relatosResumo.json';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  const consultas = configuracao.valores.map(valor => {
    const parametros = new URLSearchParams({
      orderBy: JSON.stringify(configuracao.campoOrdenacao),
      limitToLast: String(tamanho + (tipo === 'lista' ? 1 : 0))
    });
    if (valor !== null) parametros.set('equalTo', JSON.stringify(valor));

    return fetch(`${base}?${parametros}`, { signal: controller.signal })
      .then(resposta => {
        if (!resposta.ok) throw new Error(`Falha HTTP ${resposta.status}`);
        return resposta.json();
      });
  });

  window.__proPovoRelatosPrefetch = {
    tipo,
    tamanho,
    cidade,
    promise: Promise.all(consultas)
      .then(resultados => Object.assign({}, ...resultados.map(resultado => resultado || {})))
      .finally(() => clearTimeout(timeout))
  };
})();
