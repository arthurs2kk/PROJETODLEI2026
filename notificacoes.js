

const EMAILJS_PUBLIC_KEY  = "UXVxiovSloUrjVAlg";
const EMAILJS_SERVICE_ID  = "service_c4wjsqi";
const EMAILJS_TEMPLATE_ID = "template_xpduytp";

const STATUS_LABEL = {
  aberto:    'Aberto',
  andamento: 'Em andamento',
  resolvido: 'Resolvido'
};

let inicializado = false;

function garantirInicializado() {
  if (inicializado) return true;
  if (typeof emailjs === 'undefined') {
    console.warn('EmailJS não carregou — confira se o <script> dele está incluído no HTML antes do AdminPage.js.');
    return false;
  }
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  inicializado = true;
  return true;
}

async function enviar(destinatario, relato, statusParaLabel, mensagem) {
  if (!destinatario?.email) {
    console.warn('Autor do relato não tem e-mail cadastrado — notificação não enviada.');
    return;
  }
  if (!garantirInicializado()) return;

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:      destinatario.email,
      to_name:       destinatario.nome || 'cidadão',
      relato_titulo: relato.titulo,
      status_label:  STATUS_LABEL[statusParaLabel] || statusParaLabel,
      mensagem
    });
  } catch (e) {
    // Não interrompe o fluxo do admin por causa disso — só registra o erro.
    // Causas comuns: EmailJS ainda não configurado (chaves placeholder acima)
    // ou cota mensal do plano grátis esgotada.
    console.warn('Não foi possível enviar a notificação por e-mail:', e);
  }
}

// ── Notifica o cidadão que o status do relato dele mudou ──
export function notificarMudancaStatus(destinatario, relato, novoStatus) {
  const mensagens = {
    andamento: 'A prefeitura já está cuidando do problema que você relatou.',
    resolvido: 'Boas notícias! O problema que você relatou foi marcado como resolvido.',
    aberto:    'O status do seu relato foi atualizado.'
  };
  return enviar(destinatario, relato, novoStatus, mensagens[novoStatus] || 'O status do seu relato foi atualizado.');
}

// ── Notifica o cidadão que a prefeitura respondeu oficialmente ──
export function notificarNovaResposta(destinatario, relato, resposta) {
  return enviar(destinatario, relato, relato.status, `A prefeitura respondeu ao seu relato: "${resposta}"`);
}