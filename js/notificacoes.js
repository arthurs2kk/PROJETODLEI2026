// Pro Povo - notificações por e-mail com EmailJS
// Preencha estes três valores depois de criar o serviço e o template no painel
// do EmailJS. A Public Key é feita para uso no navegador; não coloque aqui
// senha de e-mail, Private Key ou credenciais SMTP.
const EMAILJS_PUBLIC_KEY = 'COLOQUE_SUA_PUBLIC_KEY_AQUI';
const EMAILJS_SERVICE_ID = 'COLOQUE_SEU_SERVICE_ID_AQUI';
const EMAILJS_TEMPLATE_ID = 'COLOQUE_SEU_TEMPLATE_ID_AQUI';

const STATUS_LABEL = {
  aberto: 'Aberto',
  andamento: 'Em andamento',
  resolvido: 'Resolvido'
};

let inicializado = false;

function criarErro(codigo, mensagem, causa = null) {
  const erro = new Error(mensagem, causa ? { cause: causa } : undefined);
  erro.code = codigo;
  return erro;
}

function configuracaoPreenchida() {
  return [EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID]
    .every(valor => valor && !valor.startsWith('COLOQUE_'));
}

function garantirInicializado() {
  if (!configuracaoPreenchida()) {
    throw criarErro(
      'EMAILJS_NAO_CONFIGURADO',
      'Preencha a Public Key, o Service ID e o Template ID do EmailJS.'
    );
  }
  if (!globalThis.emailjs) {
    throw criarErro(
      'EMAILJS_NAO_CARREGADO',
      'A biblioteca do EmailJS não foi carregada.'
    );
  }
  if (!inicializado) {
    globalThis.emailjs.init({
      publicKey: EMAILJS_PUBLIC_KEY,
      blockHeadless: true
    });
    inicializado = true;
  }
}

function urlMeusRelatos() {
  if (typeof window === 'undefined') return '';
  return new URL('../userPages/MeusRelatos.html', window.location.href).href;
}

async function enviar(destinatario, relato, statusParaLabel, mensagem) {
  if (!destinatario?.email) {
    throw criarErro(
      'CONTATO_INDISPONIVEL',
      'O relato não possui um e-mail privado disponível para notificação.'
    );
  }

  garantirInicializado();

  try {
    await globalThis.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: destinatario.email,
      to_name: destinatario.nome || relato.autorNome || 'cidadão',
      relato_titulo: relato.titulo,
      status_label: STATUS_LABEL[statusParaLabel] || statusParaLabel,
      mensagem,
      relato_url: urlMeusRelatos()
    });
  } catch (causa) {
    throw criarErro(
      'EMAILJS_FALHOU',
      'O EmailJS não conseguiu enviar a notificação.',
      causa
    );
  }
}

export function notificarMudancaStatus(destinatario, relato, novoStatus) {
  const mensagens = {
    andamento: 'A prefeitura já está cuidando do problema que você relatou.',
    resolvido: 'Boas notícias! O problema que você relatou foi marcado como resolvido.',
    aberto: 'O status do seu relato foi atualizado.'
  };

  return enviar(
    destinatario,
    relato,
    novoStatus,
    mensagens[novoStatus] || 'O status do seu relato foi atualizado.'
  );
}

export function notificarNovaResposta(destinatario, relato, resposta) {
  return enviar(
    destinatario,
    relato,
    relato.status,
    `A prefeitura respondeu ao seu relato: "${resposta}"`
  );
}
