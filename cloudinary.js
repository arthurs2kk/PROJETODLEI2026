// ── Pro Povo — cloudinary.js ──
// Upload de imagens direto do navegador, sem backend, usando preset "unsigned"

const CLOUD_NAME = "dk8uky6m";
const UPLOAD_PRESET = "pro_povo_imagens";

// ── Envia o arquivo de imagem e retorna a URL pública ──
export async function uploadImagem(file) {
  if (!file) return null;

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const resp = await fetch(url, { method: "POST", body: formData });
    const dados = await resp.json();

    if (dados.secure_url) {
      return dados.secure_url;
    } else {
      console.error("Erro no upload do Cloudinary:", dados);
      return null;
    }
  } catch (e) {
    console.error("Falha ao enviar imagem:", e);
    return null;
  }
}