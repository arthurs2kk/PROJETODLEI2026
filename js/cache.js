// Cache curto para consultas públicas. Enquanto o item estiver válido, a página
// usa o localStorage e não abre uma nova leitura no Realtime Database.
const PREFIXO = 'proPovo:cache:v1:';
export const TTL_CACHE_PUBLICO = 5 * 60 * 1000;

export function lerCache(chave, ttl = TTL_CACHE_PUBLICO) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    if (!bruto) return undefined;

    const item = JSON.parse(bruto);
    if (!item || !Number.isFinite(item.salvoEm) || Date.now() - item.salvoEm > ttl) {
      localStorage.removeItem(PREFIXO + chave);
      return undefined;
    }

    return item.dados;
  } catch (erro) {
    console.warn('Não foi possível ler o cache local:', erro);
    return undefined;
  }
}

export function salvarCache(chave, dados) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ salvoEm: Date.now(), dados }));
  } catch (erro) {
    // Navegação privada, bloqueio ou limite de armazenamento não podem impedir
    // o funcionamento normal: nesse caso a aplicação apenas consulta o banco.
    console.warn('Não foi possível salvar o cache local:', erro);
  }
}

export function invalidarCacheRelatos() {
  try {
    const prefixoRelatos = PREFIXO + 'relatos:';
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const chave = localStorage.key(i);
      if (chave?.startsWith(prefixoRelatos)) localStorage.removeItem(chave);
    }
  } catch (erro) {
    console.warn('Não foi possível invalidar o cache de relatos:', erro);
  }
}
