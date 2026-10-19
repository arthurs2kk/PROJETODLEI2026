"use strict";

const { isDeepStrictEqual } = require("node:util");
const { applicationDefault, cert, deleteApp, getApps, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID_PADRAO = "pro--povo";
const DATABASE_URL_PADRAO = "https://pro--povo-default-rtdb.firebaseio.com";
const TAMANHO_LOTE = 200;
const CAMPOS = ["titulo", "categoria", "endereco", "cityId", "status", "votos", "dataCriacao"];
const CATEGORIAS = new Set([
  "Buraco / Via danificada", "Iluminação pública", "Lixo / Entulho",
  "Água / Esgoto", "Áreas verdes", "Outros",
]);
const STATUS = new Set(["aberto", "andamento", "resolvido"]);

function objeto(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function textoEntre(valor, minimo, maximo) {
  return typeof valor === "string" && valor.length >= minimo && valor.length <= maximo;
}

function cityIdValido(cityId) {
  return (typeof cityId === "string" || Number.isSafeInteger(cityId)) && /^25[0-9]{5}$/.test(String(cityId));
}

function motivoInvalido(relato, agora = Date.now()) {
  if (!objeto(relato)) return "registro";
  if (!textoEntre(relato.titulo, 5, 100)) return "titulo";
  if (!CATEGORIAS.has(relato.categoria)) return "categoria";
  if (!textoEntre(relato.endereco, 3, 300)) return "endereco";
  if (!cityIdValido(relato.cityId)) return "cityId";
  if (!STATUS.has(relato.status)) return "status";
  if (!Number.isFinite(relato.votos) || relato.votos < 0) return "votos";
  if (!textoEntre(relato.autorNome, 1, 100)) return "autorNome";
  if (!Number.isFinite(relato.dataCriacao) || relato.dataCriacao > agora + 120000) return "dataCriacao";
  // Null and absent coordinates have the same representation in RTDB. Keep
  // legacy omissions; never turn them into zero or invent a geocoded location.
  if (relato.lat != null && (!Number.isFinite(relato.lat) || relato.lat < -8.31 || relato.lat > -6.02)) return "lat";
  if (relato.lng != null && (!Number.isFinite(relato.lng) || relato.lng < -38.85 || relato.lng > -34.79)) return "lng";
  return null;
}

function criarRelatoMapa(relato, agora = Date.now()) {
  if (motivoInvalido(relato, agora)) return null;
  const mapa = Object.fromEntries(CAMPOS.map(campo => [campo, relato[campo]]));
  if (relato.lat != null) mapa.lat = relato.lat;
  if (relato.lng != null) mapa.lng = relato.lng;
  return mapa;
}

function prepararMigracao(relatos = {}, mapas = {}, agora = Date.now()) {
  if (!objeto(relatos) || !objeto(mapas)) throw new Error("ESTRUTURA_INVALIDA");
  const pendentes = [];
  const contagem = {
    verificados: 0, criar: 0, atualizar: 0, sincronizados: 0,
    invalidos: 0, coordenadasIncompletas: 0, indicesOrfaos: 0,
    motivosInvalidos: {},
  };
  for (const [id, relato] of Object.entries(relatos)) {
    contagem.verificados += 1;
    const motivo = motivoInvalido(relato, agora);
    if (motivo) {
      contagem.invalidos += 1;
      contagem.motivosInvalidos[motivo] = (contagem.motivosInvalidos[motivo] || 0) + 1;
      continue;
    }
    const cityId = String(relato.cityId);
    if (relato.lat == null || relato.lng == null) contagem.coordenadasIncompletas += 1;
    const esperado = criarRelatoMapa(relato, agora);
    const atual = mapas[cityId]?.[id] ?? null;
    if (isDeepStrictEqual(atual, esperado)) {
      contagem.sincronizados += 1;
      continue;
    }
    contagem[atual === null ? "criar" : "atualizar"] += 1;
    pendentes.push({ id, cityId, relato, atual, esperado });
  }
  for (const [cityId, cidade] of Object.entries(mapas)) {
    if (!objeto(cidade)) throw new Error("ESTRUTURA_INVALIDA");
    for (const id of Object.keys(cidade)) {
      if (!objeto(relatos[id]) || String(relatos[id].cityId) !== cityId) contagem.indicesOrfaos += 1;
    }
  }
  return { pendentes, contagem };
}

async function aplicarLote(db, lote) {
  let contagem = { aplicados: 0, conflitos: 0 };
  const resultado = await db.ref().transaction(atual => {
    contagem = { aplicados: 0, conflitos: 0 };
    // A cold transaction can first receive null. Sending the same null value
    // lets the server retry with the current root without resurrecting data.
    if (atual === null) {
      contagem.conflitos = lote.length;
      return null;
    }
    if (!objeto(atual)) throw new Error("ESTRUTURA_INVALIDA");
    const mapas = { ...(atual.relatosMapa || {}) };
    for (const item of lote) {
      const fonteAtual = atual.relatos?.[item.id] ?? null;
      const mapaAtual = atual.relatosMapa?.[item.cityId]?.[item.id] ?? null;
      // Compare both branches on the server's transaction version. A source
      // deletion, vote, edit or independently repaired index cancels this item.
      if (!isDeepStrictEqual(fonteAtual, item.relato) || !isDeepStrictEqual(mapaAtual, item.atual)) {
        contagem.conflitos += 1;
        continue;
      }
      mapas[item.cityId] = { ...(mapas[item.cityId] || {}), [item.id]: item.esperado };
      contagem.aplicados += 1;
    }
    if (contagem.aplicados === 0) return undefined;
    return { ...atual, relatosMapa: mapas };
  }, undefined, false);
  if (!resultado.committed) contagem.aplicados = 0;
  return contagem;
}

async function migrar(db, { aplicar = false, log = console.log, agora = Date.now() } = {}) {
  const [relatosSnapshot, mapasSnapshot] = await Promise.all([
    db.ref("relatos").get(),
    db.ref("relatosMapa").get(),
  ]);
  const { pendentes, contagem } = prepararMigracao(relatosSnapshot.val() ?? {}, mapasSnapshot.val() ?? {}, agora);
  // Print aggregate counts only: never IDs, addresses, author names or records.
  log(JSON.stringify({ modo: aplicar ? "apply" : "dry-run", ...contagem }));
  if (!aplicar) {
    log("Simulação concluída; nenhuma gravação realizada. --apply é necessário para gravar.");
    return { ...contagem, aplicados: 0, conflitos: 0 };
  }
  if (contagem.invalidos || contagem.indicesOrfaos) {
    throw new Error("REVISAO_DOS_DADOS_NECESSARIA");
  }
  let aplicados = 0;
  let conflitos = 0;
  for (let inicio = 0; inicio < pendentes.length; inicio += TAMANHO_LOTE) {
    const resultado = await aplicarLote(db, pendentes.slice(inicio, inicio + TAMANHO_LOTE));
    aplicados += resultado.aplicados;
    conflitos += resultado.conflitos;
    log(JSON.stringify({ aplicados, conflitos, pendentes: pendentes.length }));
  }
  log(conflitos ? "Conflitos ignorados. Execute outro dry-run antes de retomar a aplicação." : "Migração do índice do mapa concluída.");
  return { ...contagem, aplicados, conflitos };
}

function lerArgumentos(argumentos) {
  if (argumentos.some(arg => !["--apply", "--dry-run"].includes(arg)) ||
      (argumentos.includes("--apply") && argumentos.includes("--dry-run"))) throw new Error("ARGUMENTOS_INVALIDOS");
  return { aplicar: argumentos.includes("--apply") };
}

function obterApp() {
  const existente = getApps().find(app => app.name === "backfill-relatos-mapa");
  if (existente) return existente;
  const projectId = process.env.FIREBASE_PROJECT_ID || PROJECT_ID_PADRAO;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (Boolean(clientEmail) !== Boolean(privateKey)) throw new Error("CREDENCIAL_INCOMPLETA");
  const credential = clientEmail && privateKey
    ? cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") })
    : applicationDefault();
  return initializeApp({
    projectId,
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL || DATABASE_URL_PADRAO,
  }, "backfill-relatos-mapa");
}

function mensagemErro(erro) {
  const mensagens = {
    ARGUMENTOS_INVALIDOS: "Use nenhum argumento ou --dry-run para simular; use somente --apply para gravar.",
    CREDENCIAL_INCOMPLETA: "Defina FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY juntos, ou use Application Default Credentials.",
    ESTRUTURA_INVALIDA: "Estrutura inesperada encontrada; revise os dados sem publicar seu conteúdo nos logs.",
    REVISAO_DOS_DADOS_NECESSARIA: "Aplicação bloqueada: revise os registros inválidos ou índices órfãos apontados na contagem e execute outro dry-run.",
  };
  // SDK exceptions may contain URLs, credential paths or record content.
  return mensagens[erro?.message] || "Falha na migração. Verifique acesso, credenciais e conectividade; detalhes sensíveis do SDK foram omitidos.";
}

async function executar() {
  let app;
  try {
    const opcoes = lerArgumentos(process.argv.slice(2));
    app = obterApp();
    const resultado = await migrar(getDatabase(app), opcoes);
    if (resultado.invalidos || resultado.indicesOrfaos || resultado.conflitos) process.exitCode = 2;
  } catch (erro) {
    console.error(mensagemErro(erro));
    process.exitCode = 1;
  } finally {
    if (app) await deleteApp(app);
  }
}

if (require.main === module) executar().catch(() => {
  console.error("Falha ao encerrar a conexão de migração; detalhes sensíveis foram omitidos.");
  process.exitCode = 1;
});

module.exports = { aplicarLote, criarRelatoMapa, lerArgumentos, mensagemErro, migrar, motivoInvalido, prepararMigracao };
