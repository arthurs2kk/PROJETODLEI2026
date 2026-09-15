// ── Pro Povo — cloudinary.js ──
// Upload direto do navegador com assinatura temporária gerada pela Vercel Function

const CLOUD_NAME = "dk8uky6m";
const API_RELATOS = "/api/relatos";

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

async function excluirImagemComToken(deleteToken) {
  if (!deleteToken) return false;

  const formData = new FormData();
  formData.append("token", deleteToken);
  const resposta = await fetch("https://api.cloudinary.com/v1_1/delete_by_token", {
    method: "POST",
    body: formData
  });
  return resposta.ok;
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

// ── Envia o arquivo diretamente ao Cloudinary com assinatura temporária ──
// A assinatura é criada pela Vercel Function. O arquivo continua indo direto do
// navegador ao Cloudinary e, portanto, não consome banda nem memória da função.
export async function uploadImagem(file, relatoId, idToken) {
  if (!file) return null;

  if (!relatoId || !idToken) {
    throw new Error("Não foi possível autorizar o envio da imagem.");
  }

  const assinatura = await chamarApiRelatos("assinar-upload", relatoId, idToken);
  const cloudName = assinatura.cloudName || CLOUD_NAME;
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", assinatura.apiKey);
  formData.append("timestamp", String(assinatura.timestamp));
  formData.append("public_id", assinatura.publicId);
  formData.append("overwrite", "false");
  formData.append("return_delete_token", "true");
  formData.append("upload_preset", assinatura.uploadPreset);
  formData.append("signature", assinatura.signature);

  try {
    const resp = await fetch(url, { method: "POST", body: formData });

    let dados = null;
    try { dados = await resp.json(); } catch { /* resposta sem corpo JSON */ }

    if (resp.ok && dados?.secure_url && dados.public_id !== assinatura.publicId) {
      await excluirImagemComToken(dados.delete_token);
      const erro = new Error("O preset do Cloudinary alterou o identificador assinado da imagem.");
      erro.code = "PUBLIC_ID_INESPERADO";
      throw erro;
    }

    if (resp.ok && dados?.secure_url) {
      return {
        deleteToken: dados.delete_token || null,
        url: dados.secure_url,
        publicId: dados.public_id
      };
    }

    console.error(`Erro no upload do Cloudinary (status ${resp.status}):`, dados);
    const erro = new Error(dados?.error?.message || "O Cloudinary recusou o envio da imagem.");
    erro.code = "ERRO_UPLOAD_IMAGEM";
    throw erro;

  } catch (e) {
    console.error("Falha ao enviar imagem:", e);
    throw e;
  }
}

// Remove um upload cujo relato não chegou a ser gravado no Firebase.
export async function excluirUploadPendente(relatoId, idToken) {
  return chamarApiRelatos("cancelar-upload", relatoId, idToken);
}

export { excluirImagemComToken };

// A exclusão do relato e da imagem acontece no mesmo endpoint autenticado.
export async function excluirRelatoNoServidor(relatoId, idToken) {
  return chamarApiRelatos("excluir", relatoId, idToken);
}
