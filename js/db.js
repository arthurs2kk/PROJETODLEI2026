// ── Pro Povo — db.js ──
// Funções para salvar e buscar dados no Realtime Database

import {
  auth, db,
  ref, push, set, get, onValue, update, runTransaction,
  query, orderByChild, equalTo, limitToLast, endAt
} from "./firebase.js";
import { uploadImagem } from "./cloudinary.js";
import { paraChaveFirebase } from "./populacao.js";

// ── Salvar usuário após cadastro ──
export async function salvarUsuario(uid, dados) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Usuário autenticado inválido.');
  }
  await set(ref(db, `usuarios/${uid}`), {
    nome:         dados.nome,
    email:        dados.email,
    cidade:       dados.cidade,
    dataCadastro: Date.now()
  });
}

// ── Converter endereço em latitude/longitude (gratuito, sem chave) ──
export async function geocodificar(endereco, cidade = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const query = encodeURIComponent(`${endereco}, ${cidade}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
    if (!resp.ok) return null;
    const dados = await resp.json();
    if (dados && dados[0]) {
      return { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
    }
  } catch (e) {
    console.warn('Não foi possível geocodificar o endereço:', e);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}


const INTERVALO_MINIMO_ENVIO = 5 * 60 * 1000; // 5 minutos


export async function tempoRestanteParaEnviar(uid) {
  const snapshot = await get(ref(db, `limitesEnvio/${uid}`));
  if (!snapshot.exists()) return 0;
  const passou = Date.now() - snapshot.val();
  const restante = INTERVALO_MINIMO_ENVIO - passou;
  return restante > 0 ? restante : 0;
}

// ── Contadores agregados (metadados/contadores) ──
// Guardam o total de relatos e quantos existem por status e por categoria, pra
// telas como a home mostrarem números certos sem baixar (e somar) a tabela
// inteira. Atualizados via transaction — o mesmo padrão já usado no contador
// de votos — então funcionam com vários usuários mexendo ao mesmo tempo.
//
// IMPORTANTE: isso exige que as regras do Firebase permitam usuários
// autenticados escreverem em metadados/contadores/* (só ±1 por vez, ou
// qualquer valor na primeira gravação — veja a regra sugerida à parte).
// Se a regra ainda não existir, essas transactions falham silenciosamente
// (viram um aviso no console) sem quebrar a criação do relato em si.
function incrementarContador(caminho, delta) {
  return runTransaction(ref(db, caminho), (atual) => (atual || 0) + delta)
    .catch(e => console.warn(`Não foi possível atualizar o contador em "${caminho}" (confira as regras do Firebase):`, e));
}

export function ouvirContadores(callback) {
  return onValue(ref(db, "metadados/contadores"), (snapshot) => {
    callback(snapshot.val() || { total: 0, porStatus: {}, porCategoria: {} });
  });
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

  const atualizacoes = {
    [`relatos/${novoRef.key}`]:        dadosRelato,
    [`limitesEnvio/${dados.autorId}`]: agora
  };

  // Mantém metadados/cidades atualizado (é só um "set" idempotente, barato) pra
  // a tela "Todos os relatos" ter a lista de cidades sem escanear o banco todo.
  if (dados.cidade) {
    atualizacoes[`metadados/cidades/${paraChaveFirebase(dados.cidade)}`] = dados.cidade;
  }

  try {
    await update(ref(db), atualizacoes);
  } catch (e) {
    if (e.code === 'PERMISSION_DENIED') {
      const erro = new Error('Você precisa aguardar antes de enviar outro relato.');
      erro.code = 'LIMITE_ENVIO';
      throw erro;
    }
    throw e;
  }

  // Contadores agregados. Cada um é uma transaction separada — se uma delas
  // falhar por qualquer motivo, o relato em si já está salvo e visível.
  incrementarContador('metadados/contadores/total', 1);
  incrementarContador('metadados/contadores/porStatus/aberto', 1);
  incrementarContador(`metadados/contadores/porCategoria/${paraChaveFirebase(dados.categoria)}`, 1);

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
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Usuário autenticado inválido.');
  }
  await update(ref(db, `usuarios/${uid}`), {
    nome:            dados.nome,
    email:           dados.email,
    cidade:          dados.cidade,
    dataAtualizacao: Date.now()
  });
}

// ── Ouvir, em tempo real, apenas os relatos criados pelo próprio usuário ──
export function ouvirRelatosDoUsuario(uid, callback) {
  const consulta = query(ref(db, "relatos"), orderByChild("autorId"), equalTo(uid));
  return onValue(consulta, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados)
      .map(([id, relato]) => ({ id, ...relato }));
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

// ── Ouvir TODOS os relatos em tempo real ──
// Usado hoje só pelo mapa e pelo painel administrativo (mapa.js, AdminPage.js,
// AdminGraficos.js) — telas que legitimamente precisam enxergar o conjunto
// inteiro (ou quase) e que têm um público muito menor que a home/relatos
// públicos. Para as páginas de maior tráfego, use as funções paginadas abaixo.
export function ouvirRelatos(callback) {
  return onValue(ref(db, "relatos"), (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados).map(([id, relato]) => ({ id, ...relato }));
    lista.sort((a, b) => b.votos - a.votos);
    callback(lista);
  });
}

// ── Feed limitado pra home: só os N relatos mais votados ──
// Evita que a página mais visitada do site baixe a tabela inteira pra mostrar
// só 5 cards. "tamanho" é intencionalmente maior que os 5 exibidos, pra
// sobrar folga pros filtros de categoria/status feitos no cliente.
export function ouvirRelatosDestaque(callback, tamanho = 50) {
  const consulta = query(ref(db, "relatos"), orderByChild("votos"), limitToLast(tamanho));
  return onValue(consulta, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados).map(([id, r]) => ({ id, ...r }));
    lista.sort((a, b) => (b.votos || 0) - (a.votos || 0));
    callback(lista);
  });
}

// ── Feed limitado pra home: só os N relatos mais recentes ──
export function ouvirRelatosRecentes(callback, tamanho = 50) {
  const consulta = query(ref(db, "relatos"), orderByChild("dataCriacao"), limitToLast(tamanho));
  return onValue(consulta, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados).map(([id, r]) => ({ id, ...r }));
    lista.sort((a, b) => b.dataCriacao - a.dataCriacao);
    callback(lista);
  });
}

const TAMANHO_PAGINA_PADRAO = 30;

// ── Página de relatos ordenados por data (mais recentes primeiro) ──
// Usada pela tela "Todos os relatos" (relatos.js), que precisa listar tudo mas
// não pode baixar tudo de uma vez. Chame sem "cursor" pra pegar a primeira
// página; pra próxima, passe { dataCriacao, id } do último relato já
// carregado. O par (dataCriacao, id) no endAt evita pular ou repetir relatos
// quando dois deles têm exatamente o mesmo timestamp.
export async function buscarRelatosPagina(cursor = null, tamanho = TAMANHO_PAGINA_PADRAO) {
  const consulta = cursor
    ? query(ref(db, "relatos"), orderByChild("dataCriacao"), endAt(cursor.dataCriacao, cursor.id), limitToLast(tamanho + 1))
    : query(ref(db, "relatos"), orderByChild("dataCriacao"), limitToLast(tamanho));

  const snapshot = await get(consulta);
  const dados = snapshot.val();
  if (!dados) return { itens: [], temMais: false };

  let lista = Object.entries(dados).map(([id, r]) => ({ id, ...r }));
  if (cursor) lista = lista.filter(r => r.id !== cursor.id); // o endAt inclui de novo o cursor

  lista.sort((a, b) => b.dataCriacao - a.dataCriacao); // mais recente primeiro

  const temMais = lista.length > tamanho;
  if (temMais) lista = lista.slice(0, tamanho);

  return { itens: lista, temMais };
}

// ── Lista (rápida) de cidades que já têm pelo menos um relato ──
// Vem de metadados/cidades (mantido em criarRelato), não de uma varredura na
// tabela de relatos — por isso o seletor de cidade da tela "Todos os
// relatos" não depende de quantas páginas já foram carregadas.
export async function obterCidadesComRelatos() {
  const snapshot = await get(ref(db, "metadados/cidades"));
  return snapshot.exists() ? Object.values(snapshot.val()) : [];
}

// ── Votar num relato (sem voto duplo) ──
export async function votar(relatoId, userId) {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Usuário autenticado inválido.');
  }
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
// "statusAnterior" é opcional, mas sem ele os contadores de metadados/contadores
// não são ajustados (ficam levemente desatualizados até o próximo backfill). Os
// lugares que chamam essa função hoje sempre têm o status anterior à mão, então
// sempre passam esse terceiro argumento.
export async function atualizarStatus(relatoId, novoStatus, statusAnterior = null) {
  await update(ref(db, `relatos/${relatoId}`), {
    status: novoStatus,
    dataResolucao: novoStatus === 'resolvido' ? Date.now() : null
  });

  if (statusAnterior && statusAnterior !== novoStatus) {
    incrementarContador(`metadados/contadores/porStatus/${statusAnterior}`, -1);
    incrementarContador(`metadados/contadores/porStatus/${novoStatus}`, 1);
  }
}

// ── Salvar resposta oficial da prefeitura ──
export async function salvarResposta(relatoId, resposta) {
  await update(ref(db, `relatos/${relatoId}`), {
    respostaOficial: resposta,
    dataResposta: Date.now()
  });
}

// ── Excluir relato ──
// "relato" (o objeto completo, não só o id) é opcional, mas sem ele os
// contadores agregados não são decrementados. Passe sempre que puder — os
// lugares que chamam essa função já têm o objeto completo em mãos.
export async function excluirRelato(relatoId, relato = null) {
  await set(ref(db, `relatos/${relatoId}`), null);

  if (relato) {
    incrementarContador('metadados/contadores/total', -1);
    if (relato.status)    incrementarContador(`metadados/contadores/porStatus/${relato.status}`, -1);
    if (relato.categoria) incrementarContador(`metadados/contadores/porCategoria/${paraChaveFirebase(relato.categoria)}`, -1);
  }
}