// Altere pelo comando `npm run abrangencia:relatos -- campina-grande|paraiba`.
// O comando mantém este módulo e as regras do Firebase sincronizados.
export const RESTRINGIR_RELATOS_A_CAMPINA_GRANDE = true;

export const AREA_RELATOS = RESTRINGIR_RELATOS_A_CAMPINA_GRANDE
  ? 'Campina Grande'
  : 'Paraíba';
export const MENSAGEM_ABRANGENCIA = `No momento, aceitamos relatos apenas de endereços em ${AREA_RELATOS}.`;

export function municipioAceitoParaRelato(cityId, cidade) {
  if (RESTRINGIR_RELATOS_A_CAMPINA_GRANDE) {
    return cityId === '2504009' && cidade === 'Campina Grande';
  }
  return typeof cityId === 'string' && /^25\d{5}$/.test(cityId);
}
