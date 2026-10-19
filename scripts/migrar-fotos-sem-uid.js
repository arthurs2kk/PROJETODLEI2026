"use strict";

const { cert, deleteApp, getApps, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { v2: cloudinary } = require("cloudinary");

const PROJECT_ID_PADRAO = "pro--povo";
const DATABASE_URL_PADRAO = "https://pro--povo-default-rtdb.firebaseio.com";
const CLOUD_NAME_PADRAO = "dk8uky6m";

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} antes de executar a migração.`);
  return valor;
}

function obterFirebase() {
  const existente = getApps().find(app => app.name === "migrar-fotos-sem-uid");
  if (existente) return existente;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO,
      clientEmail: exigirVariavel("FIREBASE_CLIENT_EMAIL"),
      privateKey: exigirVariavel("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  }, "migrar-fotos-sem-uid");
}

function destinoFoto(relatoId) {
  return `pro_povo/relatos/${relatoId}`;
}

function ehFotoLegadaDoAutor(relatoId, relato) {
  return typeof relato?.autorId === "string" &&
    relato.fotoPublicId === `pro_povo/${relato.autorId}/${relatoId}`;
}

async function obterOuRenomearFoto(origem, destino) {
  try {
    const existente = await cloudinary.api.resource(destino, { resource_type: "image" });
    if (existente?.public_id === destino && typeof existente?.secure_url === "string") return existente;
  } catch (erro) {
    if (erro?.error?.http_code !== 404 && erro?.http_code !== 404) throw erro;
  }
  return cloudinary.uploader.rename(origem, destino, {
    overwrite: false,
    invalidate: true,
    resource_type: "image",
  });
}

async function executar() {
  const aplicar = process.argv.includes("--apply");
  const db = getDatabase(obterFirebase());
  const [relatosSnapshot, publicosSnapshot, resumosSnapshot] = await Promise.all([
    db.ref("relatos").get(),
    db.ref("relatosPublicos").get(),
    db.ref("relatosResumo").get(),
  ]);
  const relatos = relatosSnapshot.val() || {};
  const publicos = publicosSnapshot.val() || {};
  const resumos = resumosSnapshot.val() || {};
  const pendentes = Object.entries(relatos)
    .filter(([id, relato]) => ehFotoLegadaDoAutor(id, relato));

  console.log(`${pendentes.length} foto(s) antiga(s) precisam ter o UID removido do endereço público.`);
  if (!aplicar) {
    console.log("Simulação concluída. Execute novamente com --apply para renomear as fotos e atualizar o banco.");
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || CLOUD_NAME_PADRAO,
    api_key: exigirVariavel("CLOUDINARY_API_KEY"),
    api_secret: exigirVariavel("CLOUDINARY_API_SECRET"),
    secure: true,
  });

  let concluidas = 0;
  for (const [id, relato] of pendentes) {
    const destino = destinoFoto(id);
    const resultado = await obterOuRenomearFoto(relato.fotoPublicId, destino);
    if (resultado?.public_id !== destino || typeof resultado?.secure_url !== "string") {
      throw new Error(`O Cloudinary não confirmou a migração da foto do relato ${id}.`);
    }

    const atualizacoes = {
      [`relatos/${id}/fotoPublicId`]: destino,
      [`relatos/${id}/fotoUrl`]: resultado.secure_url,
    };
    if (publicos[id]) atualizacoes[`relatosPublicos/${id}/fotoUrl`] = resultado.secure_url;
    if (resumos[id]) atualizacoes[`relatosResumo/${id}/fotoUrl`] = resultado.secure_url;
    await db.ref().update(atualizacoes);
    concluidas += 1;
    console.log(`${concluidas} de ${pendentes.length} foto(s) migrada(s).`);
  }
}

if (require.main === module) {
  executar().catch(erro => {
    console.error("Não foi possível migrar as fotos:", erro.message);
    process.exitCode = 1;
  }).finally(async () => {
    const app = getApps().find(item => item.name === "migrar-fotos-sem-uid");
    if (app) await deleteApp(app);
  });
}

module.exports = { destinoFoto, ehFotoLegadaDoAutor };
