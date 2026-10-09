// ── Pro Povo — cloudinary.js ──
// Upload de imagens direto do navegador, sem backend, usando preset "unsigned"

const CLOUD_NAME = "dk8uky6m";
export const UPLOAD_PRESET = "ProPovo";

export function criarErroUpload(status, dados) {
  const detalhe = typeof dados?.error?.message === "string"
    ? dados.error.message.trim()
    : "";
  const detalheNormalizado = detalhe.toLowerCase();

  let code = "ERRO_UPLOAD_IMAGEM";
  let mensagem = "O serviço de imagens recusou a foto. Tente novamente mais tarde.";

  if (detalheNormalizado.includes("upload preset not found")) {
    code = "CONFIGURACAO_UPLOAD_IMAGEM";
    mensagem = "O envio de fotos está temporariamente indisponível.";
  } else if (
    detalheNormalizado.includes("unsigned upload") ||
    detalheNormalizado.includes("signed upload") ||
    detalheNormalizado.includes("signature")
  ) {
    code = "CONFIGURACAO_UPLOAD_IMAGEM";
    mensagem = "O envio de fotos precisa ser reconfigurado pelo responsável do site.";
  } else if (
    detalheNormalizado.includes("file size") ||
    detalheNormalizado.includes("too large")
  ) {
    code = "FOTO_MUITO_GRANDE";
    mensagem = "A foto excede o limite aceito pelo serviço de imagens.";
  } else if (
    detalheNormalizado.includes("invalid image") ||
    detalheNormalizado.includes("unsupported") ||
    detalheNormalizado.includes("format")
  ) {
    code = "FORMATO_FOTO_NAO_ACEITO";
    mensagem = "O formato desta foto não foi aceito. Tente usar JPG, PNG ou WebP.";
  }

  const erro = new Error(mensagem);
  erro.code = code;
  erro.status = status;
  erro.cloudinaryMessage = detalhe || null;
  return erro;
}

// ── Gera a mesma imagem do Cloudinary, mas otimizada ──
// f_auto: entrega WebP/AVIF automaticamente pros navegadores que suportam (bem mais leve que JPG/PNG)
// q_auto: ajusta a qualidade automaticamente (comprime sem perda visível perceptível)
// w_XXX:  nunca manda uma imagem maior do que o necessário pro espaço onde ela é exibida
// Isso não gera nenhum upload novo nem gasta cota extra: é só um parâmetro a mais na URL,
// e o Cloudinary entrega (e guarda em cache no CDN deles) a versão otimizada sob demanda.
export function otimizarImagem(url, largura = 600) {
  if (!url) return null;

  try {
    const imagem = new URL(url);
    if (imagem.protocol !== 'https:' || imagem.hostname !== 'res.cloudinary.com' || !imagem.pathname.includes('/upload/')) {
      return null;
    }
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${largura}/`);
  } catch {
    return null;
  }
}

// ── Envia o arquivo de imagem e retorna a URL pública ──
export async function uploadImagem(file) {
  if (!file) return null;

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  let resp;
  try {
    resp = await fetch(url, { method: "POST", body: formData });
  } catch (causa) {
    console.error("Falha de rede ao enviar imagem:", causa);
    const erro = new Error("Não foi possível conectar ao serviço de imagens.");
    erro.code = "REDE_UPLOAD_IMAGEM";
    erro.cause = causa;
    throw erro;
  }

  let dados = null;
  try { dados = await resp.json(); } catch { /* resposta sem corpo JSON */ }

  if (resp.ok && dados?.secure_url) return dados.secure_url;

  const erro = criarErroUpload(resp.status, dados);
  console.error(
    `Erro no upload do Cloudinary (status ${resp.status}): ` +
    `${erro.cloudinaryMessage || "resposta sem detalhes"}`,
    dados
  );
  throw erro;
}
