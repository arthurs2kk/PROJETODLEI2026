"use strict";

const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID_PADRAO = "pro--povo";
const DATABASE_URL_PADRAO = "https://pro--povo-default-rtdb.firebaseio.com";
const TAMANHO_LOTE = 200;

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} antes de executar a migração.`);
  return valor;
}

function obterApp() {
  const existente = getApps().find(app => app.name === "backfill-relato-filtros");
  if (existente) return existente;

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO,
      clientEmail: exigirVariavel("FIREBASE_CLIENT_EMAIL"),
      privateKey: exigirVariavel("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  }, "backfill-relato-filtros");
}

function camposFiltroRelato({ cityId, categoria, status }) {
  if (!cityId || !categoria || !status) return null;
  return {
    filtroCidadeCategoria: `${cityId}|${categoria}`,
    filtroCidadeStatus: `${cityId}|${status}`,
    filtroCategoriaStatus: `${categoria}|${status}`,
    filtroCidadeCategoriaStatus: `${cityId}|${categoria}|${status}`,
  };
}

async function executar() {
  const aplicar = process.argv.includes("--apply");
  const db = getDatabase(obterApp());
  const snapshot = await db.ref("relatos").get();
  const relatos = Object.entries(snapshot.val() || {});
  const pendentes = [];
  let invalidos = 0;

  for (const [id, relato] of relatos) {
    const campos = camposFiltroRelato(relato);
    if (!campos) {
      invalidos += 1;
      continue;
    }

    const alteracoes = Object.entries(campos)
      .filter(([campo, valor]) => relato[campo] !== valor)
      .map(([campo, valor]) => [`relatos/${id}/${campo}`, valor]);
    if (alteracoes.length > 0) pendentes.push(alteracoes);
  }

  console.log(`${relatos.length} relato(s) verificado(s).`);
  console.log(`${pendentes.length} relato(s) precisam receber ou corrigir chaves de filtro.`);
  if (invalidos > 0) console.log(`${invalidos} relato(s) foram ignorados por dados obrigatórios ausentes.`);

  if (!aplicar) {
    console.log("Simulação concluída. Execute novamente com --apply para gravar as alterações.");
    return;
  }

  for (let inicio = 0; inicio < pendentes.length; inicio += TAMANHO_LOTE) {
    const atualizacoes = Object.fromEntries(pendentes.slice(inicio, inicio + TAMANHO_LOTE).flat());
    await db.ref().update(atualizacoes);
    console.log(`${Math.min(inicio + TAMANHO_LOTE, pendentes.length)} de ${pendentes.length} atualizado(s).`);
  }

  console.log("Migração das chaves de filtro concluída.");
}

executar().catch(erro => {
  console.error("Não foi possível preparar as chaves de filtro:", erro.message);
  process.exitCode = 1;
});
