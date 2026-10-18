"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { cert, deleteApp, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID = "pro--povo";
const DATABASE_URL = "https://pro--povo-default-rtdb.firebaseio.com";
const CITY_ID = "2504009";
const CIDADE = "Campina Grande";
const PREFIXO_ID = "teste-mapa-calor-";
const TOTAL_PADRAO = 90;

const CATEGORIAS = [
  "Buraco / Via danificada",
  "Iluminação pública",
  "Lixo / Entulho",
  "Água / Esgoto",
  "Áreas verdes",
  "Outros",
];
const STATUS = ["aberto", "aberto", "aberto", "andamento", "andamento", "resolvido"];
const BAIRROS = [
  { nome: "Centro", lat: -7.2215, lng: -35.8831 },
  { nome: "Catolé", lat: -7.2308, lng: -35.8814 },
  { nome: "Liberdade", lat: -7.2384, lng: -35.8948 },
  { nome: "Prata", lat: -7.2174, lng: -35.8994 },
  { nome: "Bodocongó", lat: -7.2130, lng: -35.9198 },
  { nome: "Alto Branco", lat: -7.2040, lng: -35.8819 },
  { nome: "Malvinas", lat: -7.2200, lng: -35.9280 },
  { nome: "José Pinheiro", lat: -7.2181, lng: -35.8706 },
  { nome: "Cruzeiro", lat: -7.2460, lng: -35.9034 },
];

function lerArgumentos(argumentos) {
  const opcoes = { aplicar: false, remover: false, total: TOTAL_PADRAO, credencial: process.env.GOOGLE_APPLICATION_CREDENTIALS || "" };
  for (let indice = 0; indice < argumentos.length; indice += 1) {
    const argumento = argumentos[indice];
    if (argumento === "--apply") opcoes.aplicar = true;
    else if (argumento === "--remove") opcoes.remover = true;
    else if (argumento === "--count") opcoes.total = Number(argumentos[++indice]);
    else if (argumento === "--credentials") opcoes.credencial = argumentos[++indice] || "";
    else throw new Error(`Argumento desconhecido: ${argumento}`);
  }
  if (!Number.isSafeInteger(opcoes.total) || opcoes.total < 1 || opcoes.total > 500) {
    throw new Error("--count deve ser um inteiro entre 1 e 500");
  }
  if (!opcoes.credencial) throw new Error("Informe --credentials com o arquivo da conta de serviço.");
  return opcoes;
}

function ruido(indice, eixo) {
  const valor = Math.sin((indice + 1) * (eixo === "lat" ? 12.9898 : 78.233)) * 43758.5453;
  return (valor - Math.floor(valor) - 0.5) * 0.012;
}

function camposFiltro({ categoria, status }) {
  return {
    filtroCidadeCategoria: `${CITY_ID}|${categoria}`,
    filtroCidadeStatus: `${CITY_ID}|${status}`,
    filtroCategoriaStatus: `${categoria}|${status}`,
    filtroCidadeCategoriaStatus: `${CITY_ID}|${categoria}|${status}`,
  };
}

function criarRelato(indice, agora) {
  const bairro = BAIRROS[indice % BAIRROS.length];
  const categoria = CATEGORIAS[indice % CATEGORIAS.length];
  const status = STATUS[indice % STATUS.length];
  const numero = indice + 1;
  const dataCriacao = agora - (indice % 28) * 3_600_000;
  const relato = {
    titulo: `[TESTE MAPA] Ocorrência ${String(numero).padStart(3, "0")}`,
    categoria,
    descricao: "Relato gerado exclusivamente para preencher e validar a visualização do mapa de calor.",
    endereco: `Rua de teste ${numero}, ${bairro.nome}`,
    bairro: bairro.nome,
    cidade: CIDADE,
    cityId: CITY_ID,
    lat: Number((bairro.lat + ruido(indice, "lat")).toFixed(6)),
    lng: Number((bairro.lng + ruido(indice, "lng")).toFixed(6)),
    status,
    votos: (indice * 7) % 31,
    autorId: "seed-mapa-calor",
    autorNome: "Cidadão de teste",
    dataCriacao,
    ...camposFiltro({ categoria, status }),
  };
  if (status === "resolvido") relato.dataResolucao = dataCriacao + 86_400_000;
  return relato;
}

function resumoPublico(relato) {
  return {
    titulo: relato.titulo,
    categoria: relato.categoria,
    descricaoResumo: relato.descricao.slice(0, 240),
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    autorNome: relato.autorNome,
    dataCriacao: relato.dataCriacao,
    ...camposFiltro(relato),
  };
}

function marcadorPublico(relato) {
  return {
    titulo: relato.titulo,
    categoria: relato.categoria,
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    autorNome: relato.autorNome,
    dataCriacao: relato.dataCriacao,
    lat: relato.lat,
    lng: relato.lng,
  };
}

function montarAtualizacoes(total, agora = Date.now(), remover = false) {
  const atualizacoes = {};
  for (let indice = 0; indice < total; indice += 1) {
    const id = `${PREFIXO_ID}${String(indice + 1).padStart(3, "0")}`;
    if (remover) {
      atualizacoes[`relatos/${id}`] = null;
      atualizacoes[`relatosResumo/${id}`] = null;
      atualizacoes[`relatosMapa/${CITY_ID}/${id}`] = null;
      continue;
    }
    const relato = criarRelato(indice, agora);
    atualizacoes[`relatos/${id}`] = relato;
    atualizacoes[`relatosResumo/${id}`] = resumoPublico(relato);
    atualizacoes[`relatosMapa/${CITY_ID}/${id}`] = marcadorPublico(relato);
  }
  return atualizacoes;
}

async function executar() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  const atualizacoes = montarAtualizacoes(opcoes.total, Date.now(), opcoes.remover);
  const acao = opcoes.remover ? "remover" : "criar/atualizar";
  if (!opcoes.aplicar) {
    console.log(`Simulação: ${acao} ${opcoes.total} relatos de teste em ${CIDADE}. Use --apply para gravar.`);
    return;
  }

  const caminhoCredencial = path.resolve(opcoes.credencial);
  const credencial = JSON.parse(fs.readFileSync(caminhoCredencial, "utf8"));
  const app = initializeApp({ credential: cert(credencial), databaseURL: DATABASE_URL, projectId: PROJECT_ID }, "seed-mapa-calor");
  try {
    await getDatabase(app).ref().update(atualizacoes);
    console.log(`${opcoes.total} relatos de teste ${opcoes.remover ? "removidos" : "criados/atualizados"} em ${CIDADE}.`);
  } finally {
    await deleteApp(app);
  }
}

if (require.main === module) {
  executar().catch(erro => {
    console.error(`Falha ao gerar relatos de teste: ${erro.message}`);
    process.exitCode = 1;
  });
}

module.exports = { criarRelato, lerArgumentos, marcadorPublico, montarAtualizacoes, resumoPublico };
