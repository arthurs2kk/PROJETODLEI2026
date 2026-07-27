// ── Pro Povo — cidades.js ──
// Carrega a lista oficial dos municípios da Paraíba (API do IBGE) num <select>.
// Usado no cadastro (login.js) e na edição de perfil (navbar.js).

export async function carregarCidadesPB(select, valorAtual = '') {
  if (!select) return;

  try {
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/PB/municipios');
    const cidades = await resp.json();

    cidades.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    select.innerHTML = '<option value="">— Selecione sua cidade —</option>' +
      cidades.map(c =>
        `<option value="${c.nome}" ${c.nome === valorAtual ? 'selected' : ''}>${c.nome}</option>`
      ).join('');
  } catch (e) {
    console.warn('Não foi possível carregar a lista de cidades da Paraíba:', e);
    select.innerHTML = '<option value="">Erro ao carregar cidades. Recarregue a página.</option>';
  }
}