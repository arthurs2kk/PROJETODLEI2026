"use strict";

const { cert, deleteApp, getApps, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID_PADRAO = "pro--povo";
const DATABASE_URL_PADRAO = "https://pro--povo-default-rtdb.firebaseio.com";
const TAMANHO_LOTE = 200;
const CAMPOS_PUBLICOS = [
  "titulo", "categoria", "descricao", "endereco", "lat", "lng", "cidade",
  "cityId", "bairro", "fotoUrl", "status", "votos",
  "dataCriacao", "dataEdicao", "dataResolucao", "respostaOficial",
  "dataResposta",
];
const CAMPOS_OBRIGATORIOS = [
  "titulo", "categoria", "descricao", "endereco", "cityId", "status",
  "votos", "dataCriacao",
];

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} antes de executar a migração.`);
  return valor;
}

function obterApp() {
  const existente = getApps().find(app => app.name === "backfill-relatos-publicos");
  if (existente) return existente;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO,
      clientEmail: exigirVariavel("FIREBASE_CLIENT_EMAIL"),
      privateKey: exigirVariavel("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  }, "backfill-relatos-publicos");
}

function criarDetalhePublico(relato) {
  if (!relato || CAMPOS_OBRIGATORIOS.some(campo => relato[campo] == null)) return null;
  const detalhe = {};
  for (const campo of CAMPOS_PUBLICOS) {
    if (relato[campo] !== undefined && relato[campo] !== null) detalhe[campo] = relato[campo];
  }
  return detalhe;
}

function objetosIguais(atual, esperado) {
  if (!atual || typeof atual !== "object") return false;
  const chavesAtuais = Object.keys(atual);
  const chavesEsperadas = Object.keys(esperado);
  return chavesAtuais.length === chavesEsperadas.length &&
    chavesEsperadas.every(chave => atual[chave] === esperado[chave]);
}

async function executar() {
  const aplicar = process.argv.includes("--apply");
  const db = getDatabase(obterApp());
  const [relatosSnapshot, publicosSnapshot] = await Promise.all([
    db.ref("relatos").get(),
    db.ref("relatosPublicos").get(),
  ]);
  const relatos = Object.entries(relatosSnapshot.val() || {});
  const publicosAtuais = publicosSnapshot.val() || {};
  const pendentes = [];
  let invalidos = 0;

  for (const [id, relato] of relatos) {
    const detalhe = criarDetalhePublico(relato);
    if (!detalhe) {
      invalidos += 1;
      continue;
    }
    if (!objetosIguais(publicosAtuais[id], detalhe)) {
      pendentes.push([`relatosPublicos/${id}`, detalhe]);
    }
  }

  console.log(`${relatos.length} relato(s) verificado(s).`);
  console.log(`${pendentes.length} detalhe(s) público(s) precisam ser criados ou atualizados.`);
  if (invalidos) console.log(`${invalidos} relato(s) foram ignorados por dados obrigatórios ausentes.`);
  if (!aplicar) {
    console.log("Simulação concluída. Execute novamente com --apply para gravar os detalhes públicos.");
    return;
  }

  for (let inicio = 0; inicio < pendentes.length; inicio += TAMANHO_LOTE) {
    const atualizacoes = Object.fromEntries(pendentes.slice(inicio, inicio + TAMANHO_LOTE));
    await db.ref().update(atualizacoes);
    console.log(`${Math.min(inicio + TAMANHO_LOTE, pendentes.length)} de ${pendentes.length} atualizado(s).`);
  }
  console.log("Migração dos detalhes públicos concluída.");
}

if (require.main === module) {
  executar().catch(erro => {
    console.error("Não foi possível preparar os detalhes públicos:", erro.message);
    process.exitCode = 1;
  }).finally(async () => {
    const app = getApps().find(item => item.name === "backfill-relatos-publicos");
    if (app) await deleteApp(app);
  });
}

module.exports = { CAMPOS_PUBLICOS, criarDetalhePublico, objetosIguais };
