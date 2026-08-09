
const JANELA_PADRAO_SEGUNDOS = 60;

// Quantos segundos ainda faltam pra poder enviar de novo. 0 = pode enviar já.
export function segundosRestantes(chave, janelaSegundos = JANELA_PADRAO_SEGUNDOS) {
  try {
    const guardado = localStorage.getItem(`cooldown:${chave}`);
    if (!guardado) return 0;
    const passouMs = Date.now() - Number(guardado);
    const restanteMs = (janelaSegundos * 1000) - passouMs;
    return restanteMs > 0 ? Math.ceil(restanteMs / 1000) : 0;
  } catch (e) {
    // Se o navegador bloquear localStorage (modo privado restrito, etc.),
    // simplesmente não aplica cooldown em vez de quebrar a funcionalidade.
    return 0;
  }
}

export function registrarEnvio(chave) {
  try {
    localStorage.setItem(`cooldown:${chave}`, String(Date.now()));
  } catch (e) { /* ignora se localStorage não estiver disponível */ }
}