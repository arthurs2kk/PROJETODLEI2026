// Altere pelo comando `npm run abrangencia:relatos -- campina-grande|paraiba`.
// O comando mantém este módulo e as regras do Firebase sincronizados.
export const RESTRINGIR_RELATOS_A_CAMPINA_GRANDE = true;

// null mantém todos os municípios da Paraíba ativos ao desfazer a restrição.
export const CIDADES_ATIVAS_RELATOS = RESTRINGIR_RELATOS_A_CAMPINA_GRANDE
  ? [{ id: '2504009', nome: 'Campina Grande', centroMapa: [-7.216, -35.888], zoomMapa: 13 }]
  : null;

export const AREA_RELATOS = CIDADES_ATIVAS_RELATOS?.[0].nome || 'Paraíba';
export const MENSAGEM_ABRANGENCIA = `No momento, aceitamos relatos apenas de endereços em ${AREA_RELATOS}.`;

export function municipioAceitoParaRelato(cityId, cidade) {
  if (CIDADES_ATIVAS_RELATOS) {
    return CIDADES_ATIVAS_RELATOS.some(ativa => ativa.id === cityId && ativa.nome === cidade);
  }
  return typeof cityId === 'string' && /^25\d{5}$/.test(cityId);
}
