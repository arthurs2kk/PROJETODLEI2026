// ── Pro Povo — db.js ──
// Funções para salvar e buscar dados no Realtime Database

import {
  db, storage,
  ref, push, set, get, onValue, update, runTransaction,
  sRef, uploadBytes, getDownloadURL
} from "./firebase.js";

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

// ── Criar novo relato ──
export async function criarRelato(dados, fotoFile) {
  let fotoUrl = null;

  // Upload da foto se houver
  if (fotoFile) {
    const storageRef = sRef(storage, `relatos/${Date.now()}_${fotoFile.name}`);
    await uploadBytes(storageRef, fotoFile);
    fotoUrl = await getDownloadURL(storageRef);
  }

  const coords = await geocodificar(dados.endereco);

  const novoRef = push(ref(db, "relatos"));
  await set(novoRef, {
    titulo:      dados.titulo,
    categoria:   dados.categoria,
    descricao:   dados.descricao,
    endereco:    dados.endereco,
    lat:         coords ? coords.lat : null,
    lng:         coords ? coords.lng : null,
    fotoUrl:     fotoUrl,
    status:      "aberto",
    votos:       0,
    autorId:     dados.autorId,
    autorNome:   dados.autorNome,
    dataCriacao: Date.now()
  });

  return novoRef.key;
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

export async function ehAdmin(uid) {
  const snapshot = await get(ref(db, `admins/${uid}`));
  return snapshot.exists() && snapshot.val() === true;
}