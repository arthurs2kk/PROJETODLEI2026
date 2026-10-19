"use strict";

const { cert, deleteApp, getApps, initializeApp } = require("firebase-admin/app");
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
  const existente = getApps().find(app => app.name === "backfill-relatos-resumo");
  if (existente) return existente;

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO,
      clientEmail: exigirVariavel("FIREBASE_CLIENT_EMAIL"),
      privateKey: exigirVariavel("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  }, "backfill-relatos-resumo");
}

function criarResumo(relato) {
  const camposObrigatorios = [
    "titulo", "categoria", "descricao", "endereco", "cityId", "status",
    "votos", "dataCriacao",
  ];
  if (camposObrigatorios.some(campo => relato[campo] === undefined || relato[campo] === null)) return null;

  const descricao = String(relato.descricao);
  const resumo = {
    titulo: relato.titulo,
    categoria: relato.categoria,
    descricaoResumo: descricao.slice(0, 240),
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    dataCriacao: relato.dataCriacao,
    filtroCidadeCategoria: `${relato.cityId}|${relato.categoria}`,
    filtroCidadeStatus: `${relato.cityId}|${relato.status}`,
    filtroCategoriaStatus: `${relato.categoria}|${relato.status}`,
    filtroCidadeCategoriaStatus: `${relato.cityId}|${relato.categoria}|${relato.status}`,
  };
  if (relato.fotoUrl) resumo.fotoUrl = relato.fotoUrl;
  return resumo;
}

function resumosIguais(atual, esperado) {
  if (!atual || typeof atual !== "object") return false;
  const chavesAtuais = Object.keys(atual);
  const chavesEsperadas = Object.keys(esperado);
  return chavesAtuais.length === chavesEsperadas.length &&
    chavesEsperadas.every(chave => atual[chave] === esperado[chave]);
}

async function executar() {
  const aplicar = process.argv.includes("--apply");
  const db = getDatabase(obterApp());
  const [relatosSnapshot, resumosSnapshot] = await Promise.all([
    db.ref("relatos").get(),
    db.ref("relatosResumo").get(),
  ]);
  const relatos = Object.entries(relatosSnapshot.val() || {});
  const resumosAtuais = resumosSnapshot.val() || {};
  const pendentes = [];
  let invalidos = 0;

  for (const [id, relato] of relatos) {
    const resumo = criarResumo(relato);
    if (!resumo) {
      invalidos += 1;
      continue;
    }
    if (!resumosIguais(resumosAtuais[id], resumo)) {
      pendentes.push([`relatosResumo/${id}`, resumo]);
    }
  }

  console.log(`${relatos.length} relato(s) verificado(s).`);
  console.log(`${pendentes.length} resumo(s) precisam ser criados ou atualizados.`);
  if (invalidos > 0) console.log(`${invalidos} relato(s) foram ignorados por dados obrigatórios ausentes.`);

  if (!aplicar) {
    console.log("Simulação concluída. Execute novamente com --apply para gravar os resumos.");
    return;
  }

  for (let inicio = 0; inicio < pendentes.length; inicio += TAMANHO_LOTE) {
    const atualizacoes = Object.fromEntries(pendentes.slice(inicio, inicio + TAMANHO_LOTE));
    await db.ref().update(atualizacoes);
    console.log(`${Math.min(inicio + TAMANHO_LOTE, pendentes.length)} de ${pendentes.length} atualizado(s).`);
  }

  console.log("Migração dos resumos públicos concluída.");
}

executar().catch(erro => {
  console.error("Não foi possível preparar os resumos públicos:", erro.message);
  process.exitCode = 1;
}).finally(async () => {
  const app = getApps().find(item => item.name === "backfill-relatos-resumo");
  if (app) await deleteApp(app);
});
