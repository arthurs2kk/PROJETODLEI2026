// ── Pro Povo — cloudinary.js ──
// Upload de imagens direto do navegador, sem backend, usando preset "unsigned"

const CLOUD_NAME = "dk8uky6m";
const UPLOAD_PRESET = "pro_povo_imagens";

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

  try {
    const resp = await fetch(url, { method: "POST", body: formData });

    let dados = null;
    try { dados = await resp.json(); } catch { /* resposta sem corpo JSON */ }

    if (resp.ok && dados && dados.secure_url) {
      return dados.secure_url;
    }

    if (resp.status === 404) {
      console.error(
        `Erro 404 no upload do Cloudinary. Confira no painel do Cloudinary se o ` +
        `"Cloud name" (atualmente "${CLOUD_NAME}") e o upload preset ` +
        `(atualmente "${UPLOAD_PRESET}") existem exatamente com esse nome e se ` +
        `o preset está com "Signing Mode" = Unsigned.`,
        dados
      );
    } else {
      console.error(`Erro no upload do Cloudinary (status ${resp.status}):`, dados);
    }
    return null;

  } catch (e) {
    console.error("Falha de rede ao enviar imagem:", e);
    return null;
  }
}