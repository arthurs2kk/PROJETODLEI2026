// ── Pro Povo — cloudinary.js ──
// Upload direto do navegador com preset unsigned. Operações destrutivas usam
// a função autenticada da Vercel para que o API Secret nunca chegue ao cliente.

const CLOUD_NAME = "dk8uky6m";
const API_RELATOS = "/api/relatos";
export const UPLOAD_PRESET = "ProPovo";

export function publicIdImagem(relatoId) {
  if (typeof relatoId !== "string" || !/^[-A-Za-z0-9_]{20}$/.test(relatoId)) {
    throw new Error("Identificador de relato inválido para a imagem.");
  }
  return `pro_povo/relatos/${relatoId}`;
}

async function chamarApiRelatos(acao, relatoId, idToken) {
  const resposta = await fetch(API_RELATOS, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ acao, relatoId })
  });

  let dados = null;
  try { dados = await resposta.json(); } catch { /* resposta sem corpo JSON */ }

  if (!resposta.ok) {
    const erro = new Error(dados?.erro || "Não foi possível concluir a operação com a imagem.");
    erro.code = dados?.codigo || "ERRO_API_RELATOS";
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

export async function excluirImagemComToken(deleteToken) {
  if (!deleteToken) return false;

  const formData = new FormData();
  formData.append("token", deleteToken);
  const resposta = await fetch("https://api.cloudinary.com/v1_1/delete_by_token", {
    method: "POST",
    body: formData
  });
  return resposta.ok;
}

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
export async function uploadImagem(file, relatoId) {
  if (!file) return null;

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const publicId = publicIdImagem(relatoId);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("public_id", publicId);
  formData.append("overwrite", "false");
  formData.append("return_delete_token", "true");

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

  if (resp.ok && dados?.secure_url) {
    if (dados.public_id !== publicId) {
      await excluirImagemComToken(dados.delete_token);
      const erro = new Error("O Cloudinary alterou o identificador reservado para a imagem.");
      erro.code = "PUBLIC_ID_INESPERADO";
      throw erro;
    }
    return {
      deleteToken: dados.delete_token || null,
      publicId: dados.public_id,
      url: dados.secure_url
    };
  }

  const erro = criarErroUpload(resp.status, dados);
  console.error(
    `Erro no upload do Cloudinary (status ${resp.status}): ` +
    `${erro.cloudinaryMessage || "resposta sem detalhes"}`,
    dados
  );
  throw erro;
}

// Remove um upload cujo relato não chegou a ser gravado no Firebase.
export async function excluirUploadPendente(relatoId, idToken) {
  return chamarApiRelatos("cancelar-upload", relatoId, idToken);
}

// Exclui a imagem no Cloudinary e, depois, relato, votos e contato no Firebase.
export async function excluirRelatoNoServidor(relatoId, idToken) {
  return chamarApiRelatos("excluir", relatoId, idToken);
}
