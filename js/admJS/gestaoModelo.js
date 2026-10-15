// Regras de apresentação compartilhadas pela lista e pelo mapa municipal.
export const SLA_MS = 10 * 86400000;
export const CORES_CATEGORIA = {
  'Buraco / Via danificada': '#cc2900',
  'Iluminação pública': '#c45c00',
  'Lixo / Entulho': '#168821',
  'Água / Esgoto': '#1351b4',
  'Áreas verdes': '#637d16',
  'Outros': '#777777'
};
export const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido' };
export const CORES_STATUS = { aberto: '#cc2900', andamento: '#c45c00', resolvido: '#168821' };
export const chavePrioridade = r => `${r.cityId}/${r.id}`;
export const estaAtrasado = (r, agora = Date.now()) => r.status !== 'resolvido' && agora - r.dataCriacao > SLA_MS;

export function filtrarRelatos(relatos, filtros, agora = Date.now()) {
  const normalizarBusca = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const busca = normalizarBusca((filtros.busca || '').trim());
  return relatos.filter(r =>
    (!busca || normalizarBusca(`${r.titulo || ''} ${r.endereco || ''}`).includes(busca)) &&
    (!filtros.cidade || String(r.cityId) === filtros.cidade) &&
    (!filtros.bairro || r.bairro === filtros.bairro) &&
    (!filtros.categoria || filtros.categoria === 'todos' || r.categoria === filtros.categoria) &&
    (!filtros.status || filtros.status === 'todos' || (filtros.status === 'atrasados' ? estaAtrasado(r, agora) : r.status === filtros.status)) &&
    (!filtros.dias || r.dataCriacao >= agora - Number(filtros.dias) * 86400000)
  );
}

export function ordenarPrioridades(relatos, prioridades) {
  return relatos.filter(r => prioridades[chavePrioridade(r)]).sort((a, b) =>
    prioridades[chavePrioridade(a)].ordem - prioridades[chavePrioridade(b)].ordem || a.id.localeCompare(b.id)
  );
}

export function coordenadasValidas(r) {
  return Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180;
}

// Células fixas de aproximadamente 300 m na Paraíba; cada relato conta uma vez.
export function agruparConcentracao(relatos) {
  const celulas = new Map();
  for (const r of relatos.filter(coordenadasValidas)) {
    const y = Math.floor(r.lat / 0.0027);
    const x = Math.floor(r.lng / 0.0027);
    const chave = `${y}/${x}`;
    const celula = celulas.get(chave) || { lat: (y + 0.5) * 0.0027, lng: (x + 0.5) * 0.0027, quantidade: 0 };
    celula.quantidade++;
    celulas.set(chave, celula);
  }
  return [...celulas.values()];
}
