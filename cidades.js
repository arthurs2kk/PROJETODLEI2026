// ── Pro Povo — cidades.js ──
// Carrega a lista oficial dos municípios da Paraíba (API do IBGE) num <select>.
// Usado no cadastro (login.js) e na edição de perfil (navbar.js).

export async function carregarCidadesPB(select, valorAtual = '') {
  if (!select) return;

  try {
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/PB/municipios');
    const cidades = await resp.json();

    cidades.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    select.replaceChildren(new Option('— Selecione sua cidade —', ''));
    cidades.forEach(cidade => {
      const option = new Option(cidade.nome, cidade.nome, false, cidade.nome === valorAtual);
      select.appendChild(option);
    });
  } catch (e) {
    console.warn('Não foi possível carregar a lista de cidades da Paraíba:', e);
    select.innerHTML = '<option value="">Erro ao carregar cidades. Recarregue a página.</option>';
  }
}