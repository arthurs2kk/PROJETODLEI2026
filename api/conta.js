"use strict";

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID_PADRAO = "pro--povo";
const DATABASE_URL_PADRAO = "https://pro--povo-default-rtdb.firebaseio.com";
const REAUTENTICACAO_MAX_MS = 10 * 60 * 1000;

class ErroHttp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

function obterFirebase() {
  const existente = getApps()[0];
  if (existente) return existente;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO,
      clientEmail: exigirVariavel("FIREBASE_CLIENT_EMAIL"),
      privateKey: exigirVariavel("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  });
}

function obterBearer(req) {
  const resultado = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!resultado) throw new ErroHttp(401, "NAO_AUTENTICADO", "Faça login novamente para continuar.");
  return resultado[1];
}

function obterCorpo(req) {
  try {
    if (!req.body) return {};
    if (typeof req.body === "string") return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8"));
    return req.body;
  } catch {
    throw new ErroHttp(400, "JSON_INVALIDO", "O corpo da requisição não é um JSON válido.");
  }
}

function autenticacaoRecente(decoded, agora = Date.now()) {
  const autenticadoEm = Number(decoded?.auth_time) * 1000;
  return Number.isFinite(autenticadoEm) && agora - autenticadoEm <= REAUTENTICACAO_MAX_MS;
}

function clonar(valor) {
  return valor == null ? {} : JSON.parse(JSON.stringify(valor));
}

function anonimizarContaNaRaiz(valorAtual, uid) {
  const raiz = clonar(valorAtual);
  const relatosDoTitular = new Set();
  let votosRemovidos = 0;
  let contatosRemovidos = 0;

  if (raiz.usuarios) delete raiz.usuarios[uid];
  if (raiz.limitesEnvio) delete raiz.limitesEnvio[uid];

  for (const [relatoId, relato] of Object.entries(raiz.relatos || {})) {
    if (relato?.autorId !== uid) continue;
    relatosDoTitular.add(relatoId);
    relato.autorId = `conta_excluida_${relatoId}`;
    relato.autorNome = "Pessoa usuária removida";
  }

  for (const [relatoId, contato] of Object.entries(raiz.contatosRelatos || {})) {
    if (relatosDoTitular.has(relatoId) || contato?.autorId === uid) {
      delete raiz.contatosRelatos[relatoId];
      contatosRemovidos += 1;
    }
  }

  for (const [relatoId, votos] of Object.entries(raiz.votos || {})) {
    if (!votos || votos[uid] !== true) continue;
    delete votos[uid];
    votosRemovidos += 1;
    if (Object.keys(votos).length === 0) delete raiz.votos[relatoId];

    const relato = raiz.relatos?.[relatoId];
    if (!relato) continue;
    const total = Math.max(0, Number(relato.votos || 0) - 1);
    relato.votos = total;
    if (raiz.relatosResumo?.[relatoId]) raiz.relatosResumo[relatoId].votos = total;
    if (raiz.relatosPublicos?.[relatoId]) raiz.relatosPublicos[relatoId].votos = total;
    const cityId = String(relato.cityId ?? "");
    if (raiz.relatosMapa?.[cityId]?.[relatoId]) raiz.relatosMapa[cityId][relatoId].votos = total;
  }

  return {
    raiz,
    contagens: {
      relatosAnonimizados: relatosDoTitular.size,
      contatosRemovidos,
      votosRemovidos,
    },
  };
}

async function autenticar(req) {
  const app = obterFirebase();
  try {
    return await getAuth(app).verifyIdToken(obterBearer(req), true);
  } catch (erro) {
    if (erro instanceof ErroHttp) throw erro;
    throw new ErroHttp(401, "TOKEN_INVALIDO", "Sua sessão expirou. Faça login novamente.");
  }
}

async function exportarDados(decoded) {
  const app = obterFirebase();
  const db = getDatabase(app);
  const [usuarioAuth, perfilSnapshot, relatosSnapshot, votosSnapshot] = await Promise.all([
    getAuth(app).getUser(decoded.uid),
    db.ref(`usuarios/${decoded.uid}`).get(),
    db.ref("relatos").orderByChild("autorId").equalTo(decoded.uid).get(),
    db.ref("votos").get(),
  ]);
  const relatos = relatosSnapshot.val() || {};
  const contatos = {};
  await Promise.all(Object.keys(relatos).map(async relatoId => {
    const snapshot = await db.ref(`contatosRelatos/${relatoId}`).get();
    if (snapshot.exists()) contatos[relatoId] = snapshot.val();
  }));
  const votos = Object.entries(votosSnapshot.val() || {})
    .filter(([, porUsuario]) => porUsuario?.[decoded.uid] === true)
    .map(([relatoId]) => relatoId);

  return {
    versaoExportacao: 1,
    geradoEm: new Date().toISOString(),
    conta: {
      uid: usuarioAuth.uid,
      email: usuarioAuth.email || null,
      emailVerificado: usuarioAuth.emailVerified,
      nomeExibido: usuarioAuth.displayName || null,
      provedores: usuarioAuth.providerData.map(item => item.providerId),
      criadaEm: usuarioAuth.metadata.creationTime || null,
      ultimoLoginEm: usuarioAuth.metadata.lastSignInTime || null,
    },
    perfil: perfilSnapshot.val() || null,
    relatos,
    contatosDosRelatos: contatos,
    relatosVotados: votos,
  };
}

async function excluirConta(decoded) {
  if (!autenticacaoRecente(decoded)) {
    throw new ErroHttp(401, "REATENTICACAO_NECESSARIA", "Entre novamente na sua conta antes de excluí-la.");
  }
  const app = obterFirebase();
  const db = getDatabase(app);
  const adminSnapshot = await db.ref(`admins/${decoded.uid}`).get();
  if (adminSnapshot.exists()) {
    throw new ErroHttp(409, "CONTA_ADMINISTRATIVA", "Contas administrativas devem ser removidas por outro superadministrador.");
  }

  let contagens = { relatosAnonimizados: 0, contatosRemovidos: 0, votosRemovidos: 0 };
  await db.ref().transaction(atual => {
    if (atual === null) return atual;
    const resultado = anonimizarContaNaRaiz(atual, decoded.uid);
    contagens = resultado.contagens;
    return resultado.raiz;
  }, undefined, false);

  try {
    await getAuth(app).deleteUser(decoded.uid);
  } catch (erro) {
    if (erro?.code !== "auth/user-not-found") throw erro;
  }
  return { ok: true, ...contagens };
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ codigo: "METODO_INVALIDO", erro: "Use o método POST." });
  }

  try {
    const corpo = obterCorpo(req);
    const decoded = await autenticar(req);
    if (corpo.acao === "exportar") return res.status(200).json(await exportarDados(decoded));
    if (corpo.acao === "excluir") return res.status(200).json(await excluirConta(decoded));
    throw new ErroHttp(400, "ACAO_INVALIDA", "Ação inválida.");
  } catch (erro) {
    const status = erro instanceof ErroHttp ? erro.status : 500;
    if (status >= 500) console.error("Erro na API da conta:", erro);
    return res.status(status).json({
      codigo: erro instanceof ErroHttp ? erro.codigo : "ERRO_INTERNO",
      erro: status >= 500 ? "Não foi possível concluir a operação." : erro.message,
    });
  }
}

module.exports = handler;
module.exports._internals = { anonimizarContaNaRaiz, autenticacaoRecente };
