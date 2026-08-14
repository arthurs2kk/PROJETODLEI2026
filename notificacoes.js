// ── Pro Povo — notificacoes.js ──
// Envia e-mails de notificação pro cidadão quando o status do relato dele
// muda ou quando a prefeitura responde oficialmente. Usa o EmailJS — o envio
// acontece direto do navegador, sem precisar de servidor próprio. Como essas
// funções só são chamadas a partir do AdminPage.js (atrás do login de admin),
// o risco de abuso é baixo: só quem já tem acesso ao painel consegue disparar.
//
// ── Configuração necessária (uma vez só, em emailjs.com) ──
//   1. Criar conta grátis e conectar um serviço de e-mail (Gmail, Outlook etc.)
//      em "Email Services".
//   2. Criar um template em "Email Templates" usando estas variáveis:
//      {{to_email}}  {{to_name}}  {{relato_titulo}}  {{status_label}}  {{mensagem}}
//   3. Pegar o Service ID, o Template ID e a Public Key (em Account → General)
//      e colar nas três constantes abaixo.
//   4. (Recomendado) Em Account → Security, restringir os domínios permitidos
//      pra usar essa Public Key só a partir do seu site.

const EMAILJS_PUBLIC_KEY  = "COLOQUE_SUA_PUBLIC_KEY_AQUI";
const EMAILJS_SERVICE_ID  = "COLOQUE_SEU_SERVICE_ID_AQUI";
const EMAILJS_TEMPLATE_ID = "COLOQUE_SEU_TEMPLATE_ID_AQUI";

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