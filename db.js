// ── Pro Povo — db.js ──
// Funções para salvar e buscar dados no Realtime Database

import {
  db,
  ref, push, set, get, onValue, update, runTransaction
} from "./firebase.js";
import { uploadImagem } from "./cloudinary.js";

// ── Salvar usuário após cadastro ──
export async function salvarUsuario(uid, dados) {
  await set(ref(db, `usuarios/${uid}`), {
    nome:         dados.nome,
    email:        dados.email,
    cidade:       dados.cidade,
    dataCadastro: Date.now()
  });
}

// ── Converter endereço em latitude/longitude (gratuito, sem chave) ──
export async function geocodificar(endereco, cidade = '') {
  try {
    const query = encodeURIComponent(`${endereco}, ${cidade}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const dados = await resp.json();
    if (dados && dados[0]) {
      return { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
    }
  } catch (e) {
    console.warn('Não foi possível geocodificar o endereço:', e);
  }
  return null;
}

// ── Tempo mínimo, em milissegundos, entre dois relatos do mesmo cidadão ──
const INTERVALO_MINIMO_ENVIO = 5 * 60 * 1000; // 5 minutos

// ── Quanto tempo falta (em ms) até o usuário poder enviar outro relato. 0 = pode enviar já ──
export async function tempoRestanteParaEnviar(uid) {
  const snapshot = await get(ref(db, `limitesEnvio/${uid}`));
  if (!snapshot.exists()) return 0;
  const passou = Date.now() - snapshot.val();
  const restante = INTERVALO_MINIMO_ENVIO - passou;
  return restante > 0 ? restante : 0;
}

// ── Criar novo relato ──
export async function criarRelato(dados, fotoFile) {
  let fotoUrl = null;

  // Upload da foto via Cloudinary (se houver)
  if (fotoFile) {
    fotoUrl = await uploadImagem(fotoFile);
  }

  const novoRef = push(ref(db, "relatos"));
  const agora = Date.now();

  const dadosRelato = {
    titulo:      dados.titulo,
    categoria:   dados.categoria,
    descricao:   dados.descricao,
    endereco:    dados.endereco,
    lat:         dados.lat || null,
    lng:         dados.lng || null,
    cidade:      dados.cidade || null,
    bairro:      dados.bairro || null,
    fotoUrl:     fotoUrl,
    status:      "aberto",
    votos:       0,
    autorId:     dados.autorId,
    autorNome:   dados.autorNome,
    dataCriacao: agora
  };

  // Grava o relato e atualiza o carimbo de "último envio" numa única operação atômica.
  // As regras do banco exigem que esse carimbo bata com dataCriacao pra autorizar a
  // criação — isso impede alguém de contornar o limite de envio chamando a API
  // diretamente, sem passar pelo app (o limite não depende de "boa vontade" do cliente).
  try {
    await update(ref(db), {
      [`relatos/${novoRef.key}`]:        dadosRelato,
      [`limitesEnvio/${dados.autorId}`]: agora
    });
  } catch (e) {
    if (e.code === 'PERMISSION_DENIED') {
      const erro = new Error('Você precisa aguardar antes de enviar outro relato.');
      erro.code = 'LIMITE_ENVIO';
      throw erro;
    }
    throw e;
  }

  return novoRef.key;
}

// ── Buscar dados do perfil do usuário ──
export async function buscarUsuario(uid) {
  const snapshot = await get(ref(db, `usuarios/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// ── Atualizar dados do perfil (nome, e-mail e cidade) ──
// O e-mail é reenviado aqui mesmo sem ter mudado: as regras do banco exigem que
// nome/email/cidade existam juntos em usuarios/{uid}, então se o registro tivesse
// ficado incompleto por algum motivo (ex: conta criada antes de uma correção
// anterior), essa gravação já conserta sozinha em vez de falhar na validação.
export async function atualizarUsuario(uid, dados) {
  await update(ref(db, `usuarios/${uid}`), {
    nome:            dados.nome,
    email:           dados.email,
    cidade:          dados.cidade,
    dataAtualizacao: Date.now()
  });
}

// ── Ouvir, em tempo real, apenas os relatos criados pelo próprio usuário ──
export function ouvirRelatosDoUsuario(uid, callback) {
  onValue(ref(db, "relatos"), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados)
      .map(([id, relato]) => ({ id, ...relato }))
      .filter(r => r.autorId === uid);
    lista.sort((a, b) => b.dataCriacao - a.dataCriacao);
    callback(lista);
  });
}

// ── Cidadão edita seu próprio relato (só título, categoria e descrição) ──
export async function atualizarRelatoDoUsuario(relatoId, dados) {
  await update(ref(db, `relatos/${relatoId}`), {
    titulo:     dados.titulo,
    categoria:  dados.categoria,
    descricao:  dados.descricao,
    dataEdicao: Date.now()
  });
}

// ── Verificar se o usuário é administrador ──
export async function ehAdmin(uid) {
  const snapshot = await get(ref(db, `admins/${uid}`));
  return snapshot.exists() && snapshot.val() === true;
}

// ── Ouvir relatos em tempo real ──
export function ouvirRelatos(callback) {
  onValue(ref(db, "relatos"), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados).map(([id, relato]) => ({ id, ...relato }));
    lista.sort((a, b) => b.votos - a.votos);
    callback(lista);
  });
}

// ── Votar num relato (sem voto duplo) ──
export async function votar(relatoId, userId) {
  const votoRef  = ref(db, `votos/${relatoId}/${userId}`);
  const snapshot = await get(votoRef);

  if (snapshot.exists()) {
    // Já votou — remove o voto
    await set(votoRef, null);
    await runTransaction(ref(db, `relatos/${relatoId}/votos`), v => (v || 1) - 1);
    return false; // desvotou
  } else {
    // Voto novo
    await set(votoRef, true);
    await runTransaction(ref(db, `relatos/${relatoId}/votos`), v => (v || 0) + 1);
    return true; // votou
  }
}

// ── Verificar se usuário já votou ──
export async function jaVotou(relatoId, userId) {
  const snapshot = await get(ref(db, `votos/${relatoId}/${userId}`));
  return snapshot.exists();
}

// ── Atualizar status de um relato ──
export async function atualizarStatus(relatoId, novoStatus) {
  await update(ref(db, `relatos/${relatoId}`), { status: novoStatus });
}

// ── Salvar resposta oficial da prefeitura ──
export async function salvarResposta(relatoId, resposta) {
  await update(ref(db, `relatos/${relatoId}`), {
    respostaOficial: resposta,
    dataResposta: Date.now()
  });
}

// ── Excluir relato ──
export async function excluirRelato(relatoId) {
  await set(ref(db, `relatos/${relatoId}`), null);
}