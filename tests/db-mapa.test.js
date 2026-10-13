"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CITY_ID = "2507507";
const RELATO_ID = "-OabcDEF01234567890x";
const timestamp = { ".sv": "timestamp" };
const copiar = valor => valor === undefined ? undefined : JSON.parse(JSON.stringify(valor));

const relatoBase = {
  titulo: "Falta iluminação na rua",
  categoria: "Iluminação pública",
  descricao: "A rua está sem iluminação há vários dias.",
  endereco: "Rua Exemplo, Centro, João Pessoa",
  cityId: CITY_ID,
  cidade: "João Pessoa",
  bairro: "Centro",
  status: "aberto",
  votos: 0,
  autorId: "cidadao",
  autorNome: "Cidadão de Teste",
  dataCriacao: 1000,
  lat: -7.12,
  lng: -34.88,
  fotoUrl: "https://example.com/foto.jpg",
  fotoPublicId: "pro_povo/cidadao/foto"
};

function marcador(relato) {
  return Object.fromEntries([
    "titulo", "categoria", "endereco", "cityId", "status", "votos",
    "autorNome", "dataCriacao", "lat", "lng"
  ].filter(campo => relato[campo] != null).map(campo => [campo, relato[campo]]));
}

function dadosIniciais(relato = relatoBase) {
  const filtros = {
    filtroCidadeCategoria: `${relato.cityId}|${relato.categoria}`,
    filtroCidadeStatus: `${relato.cityId}|${relato.status}`,
    filtroCategoriaStatus: `${relato.categoria}|${relato.status}`,
    filtroCidadeCategoriaStatus: `${relato.cityId}|${relato.categoria}|${relato.status}`
  };
  const resumo = { ...marcador(relato), ...filtros, descricaoResumo: relato.descricao.slice(0, 240) };
  delete resumo.lat;
  delete resumo.lng;
  if (relato.fotoUrl) resumo.fotoUrl = relato.fotoUrl;
  return {
    relatos: { [RELATO_ID]: { ...copiar(relato), ...filtros } },
    relatosResumo: { [RELATO_ID]: resumo },
    relatosMapa: { [relato.cityId]: { [RELATO_ID]: marcador(relato) } }
  };
}

async function carregarDb(iniciais = {}, opcoes = {}) {
  const dados = copiar(iniciais);
  const leituras = [];
  const escritas = [];
  const exclusoes = [];
  const cache = new Map();
  let invalidacoes = 0;
  let tokens = 0;
  const usuario = {
    uid: "cidadao",
    email: "cidadao@example.com",
    emailVerified: true,
    async getIdToken() { tokens += 1; return "token-teste"; }
  };

  function ler(caminho) {
    return caminho.split("/").filter(Boolean).reduce((item, campo) => item?.[campo], dados);
  }

  function gravar(caminho, valor) {
    const partes = caminho.split("/").filter(Boolean);
    const campo = partes.pop();
    const pai = partes.reduce((item, parte) => (item[parte] ??= {}), dados);
    if (valor === null) delete pai[campo];
    else pai[campo] = copiar(valor);
  }

  const firebase = {
    auth: { currentUser: usuario },
    db: {},
    ref: (_db, caminho = "") => ({ caminho }),
    query: (referencia, ...restricoes) => ({ ...referencia, restricoes }),
    orderByChild: valor => ({ tipo: "orderByChild", valor }),
    equalTo: valor => ({ tipo: "equalTo", valor }),
    limitToLast: valor => ({ tipo: "limitToLast", valor }),
    startAt: valor => ({ tipo: "startAt", valor }),
    endAt: valor => ({ tipo: "endAt", valor }),
    serverTimestamp: () => copiar(timestamp),
    push: referencia => ({ caminho: `${referencia.caminho}/${RELATO_ID}`, key: RELATO_ID }),
    set: async () => { throw new Error("set inesperado"); },
    onValue: () => { throw new Error("onValue inesperado"); },
    async get(referencia) {
      leituras.push(copiar(referencia));
      let valor = copiar(ler(referencia.caminho));
      if (referencia.restricoes && valor) {
        const campo = referencia.restricoes.find(item => item.tipo === "orderByChild")?.valor;
        const limite = referencia.restricoes.find(item => item.tipo === "limitToLast")?.valor;
        const pares = Object.entries(valor).sort(([idA, a], [idB, b]) =>
          (a[campo] - b[campo]) || idA.localeCompare(idB));
        valor = Object.fromEntries(limite ? pares.slice(-limite) : pares);
      }
      return { exists: () => valor != null, val: () => valor ?? null };
    },
    async update(referencia, alteracoes) {
      const payload = copiar(alteracoes);
      escritas.push({ caminho: referencia.caminho, alteracoes: payload });
      await opcoes.antesAtualizar?.({ gravar, ler, alteracoes: payload, tentativa: escritas.length });
      for (const [caminho, valor] of Object.entries(payload)) {
        gravar([referencia.caminho, caminho].filter(Boolean).join("/"), valor);
      }
    }
  };

  const dependencias = {
    "./firebase.js": firebase,
    "./cloudinary.js": {
      uploadImagem: async () => { throw new Error("upload inesperado"); },
      excluirImagemComToken: async () => { throw new Error("exclusão de imagem inesperada"); },
      excluirUploadPendente: async () => { throw new Error("exclusão de upload inesperada"); },
      async excluirRelatoNoServidor(...args) {
        exclusoes.push(args);
        if (opcoes.erroExclusao) throw opcoes.erroExclusao;
      }
    },
    "./cidades.js": { resolverCityId: async () => CITY_ID },
    "./cache.js": {
      lerCache: chave => cache.get(chave),
      salvarCache: (chave, valor) => cache.set(chave, copiar(valor)),
      invalidarCacheRelatos: () => { invalidacoes += 1; cache.clear(); }
    }
  };
  const contexto = vm.createContext({ console, setTimeout, clearTimeout, AbortController });
  const modulo = new vm.SourceTextModule(
    fs.readFileSync(path.join(__dirname, "..", "js", "db.js"), "utf8"),
    { context: contexto }
  );
  await modulo.link(especificador => {
    const exports = dependencias[especificador];
    assert.ok(exports, `dependência inesperada: ${especificador}`);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [nome, valor] of Object.entries(exports)) this.setExport(nome, valor);
    }, { context: contexto });
  });
  await modulo.evaluate();
  return {
    db: modulo.namespace, dados, leituras, escritas, exclusoes, cache, gravar,
    get invalidacoes() { return invalidacoes; },
    get tokens() { return tokens; }
  };
}

test("mapa consulta somente projeção da cidade, ordena por data e limita a 500", async () => {
  const marcadores = Object.fromEntries(Array.from({ length: 503 }, (_, i) => [
    `id${String(502 - i).padStart(3, "0")}`, { ...marcador(relatoBase), dataCriacao: i }
  ]));
  const ambiente = await carregarDb({
    relatos: { segredo: { descricao: "não deve ser baixada" } },
    relatosMapa: { [CITY_ID]: marcadores }
  });
  const lista = await ambiente.db.buscarRelatosMapa(CITY_ID, 900);
  assert.equal(lista.length, 500);
  assert.equal(lista[0].dataCriacao, 502);
  assert.equal(lista.at(-1).dataCriacao, 3);
  assert.equal(lista[0].descricao, undefined);
  assert.deepEqual(ambiente.leituras, [{
    caminho: `relatosMapa/${CITY_ID}`,
    restricoes: [{ tipo: "orderByChild", valor: "dataCriacao" }, { tipo: "limitToLast", valor: 500 }]
  }]);
});

test("mapa ignora cache antigo, reutiliza cidade atual e substitui cache ao trocar cidade", async () => {
  const ambiente = await carregarDb(dadosIniciais());
  ambiente.cache.set("relatos:mapa:500", { cityId: CITY_ID, relatos: [{ descricao: "cache antigo" }] });
  const primeira = await ambiente.db.buscarRelatosMapa(CITY_ID);
  assert.equal(primeira[0].titulo, relatoBase.titulo);
  assert.equal(ambiente.leituras.length, 1);
  assert.deepEqual(copiar(await ambiente.db.buscarRelatosMapa(CITY_ID)), copiar(primeira));
  assert.equal(ambiente.leituras.length, 1);
  assert.deepEqual(copiar(await ambiente.db.buscarRelatosMapa("2504009")), []);
  assert.equal(ambiente.cache.get("relatos:mapa:v2:500").cityId, "2504009");
  await ambiente.db.buscarRelatosMapa(CITY_ID);
  await ambiente.db.buscarRelatosMapa(CITY_ID, 500, false);
  assert.equal(ambiente.leituras.length, 4);
  assert.ok(ambiente.leituras.every(item => item.caminho.startsWith("relatosMapa/")));
});

test("mapa valida cidade e normaliza limite para inteiro positivo", async () => {
  const ambiente = await carregarDb();
  for (const cidade of ["", "../relatos", "3507507", null]) {
    await assert.rejects(ambiente.db.buscarRelatosMapa(cidade), /Cidade inválida/);
  }
  assert.equal(ambiente.leituras.length, 0);
  for (const [pedido, esperado] of [[2.9, 2], [-5, 1], [0, 1], ["inválido", 1]]) {
    await ambiente.db.buscarRelatosMapa(CITY_ID, pedido, false);
    assert.equal(ambiente.leituras.at(-1).restricoes.at(-1).valor, esperado);
  }
});

test("criação grava relato, resumo, marcador, contato e cooldown em único update", async () => {
  const ambiente = await carregarDb({ usuarios: { cidadao: {
    nome: relatoBase.autorNome, email: "cidadao@example.com", cidade: "João Pessoa", dataCadastro: 1
  } } });
  assert.equal(await ambiente.db.criarRelato(relatoBase), RELATO_ID);
  assert.equal(ambiente.escritas.length, 1);
  assert.equal(ambiente.escritas[0].caminho, "");
  const payload = ambiente.escritas[0].alteracoes;
  assert.deepEqual(Object.keys(payload).sort(), [
    `relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`,
    `contatosRelatos/${RELATO_ID}`, "limitesEnvio/cidadao"
  ].sort());
  assert.deepEqual(payload[`relatosMapa/${CITY_ID}/${RELATO_ID}`], {
    ...marcador(relatoBase), dataCriacao: timestamp
  });
  assert.equal(ambiente.invalidacoes, 1);
});

test("edição preserva relato completo e votos concorrentes nas três estruturas", async () => {
  const ambiente = await carregarDb(dadosIniciais(), {
    antesAtualizar({ gravar }) {
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
        gravar(`${raiz}/votos`, 9);
      }
    }
  });
  const edicao = { titulo: "Nova iluminação", categoria: "Outros", descricao: "Nova descrição. ".repeat(30) };
  await ambiente.db.atualizarRelatoDoUsuario(RELATO_ID, edicao);
  const relato = ambiente.dados.relatos[RELATO_ID];
  const resumo = ambiente.dados.relatosResumo[RELATO_ID];
  const mapa = ambiente.dados.relatosMapa[CITY_ID][RELATO_ID];
  assert.equal(ambiente.escritas.length, 1);
  assert.equal(relato.autorId, relatoBase.autorId);
  assert.equal(relato.fotoPublicId, relatoBase.fotoPublicId);
  assert.deepEqual(relato.dataEdicao, timestamp);
  assert.equal(relato.descricao, edicao.descricao);
  assert.equal(resumo.descricaoResumo, edicao.descricao.slice(0, 240));
  for (const item of [relato, resumo, mapa]) {
    assert.equal(item.titulo, edicao.titulo);
    assert.equal(item.categoria, edicao.categoria);
    assert.equal(item.votos, 9);
    assert.equal(item.cityId, CITY_ID);
  }
  assert.deepEqual(mapa, { ...marcador(relatoBase), titulo: edicao.titulo, categoria: edicao.categoria, votos: 9 });
  assert.equal(ambiente.invalidacoes, 1);
});

test("status sincroniza projeções e preserva campos e votos atualizados em concorrência", async () => {
  const ambiente = await carregarDb(dadosIniciais(), {
    antesAtualizar({ gravar }) {
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
        gravar(`${raiz}/votos`, 7);
      }
    }
  });
  await ambiente.db.atualizarStatus(RELATO_ID, "resolvido");
  assert.deepEqual(ambiente.dados.relatos[RELATO_ID].dataResolucao, timestamp);
  await ambiente.db.atualizarStatus(RELATO_ID, "andamento");
  assert.equal(ambiente.escritas.length, 2);
  const relato = ambiente.dados.relatos[RELATO_ID];
  const resumo = ambiente.dados.relatosResumo[RELATO_ID];
  const mapa = ambiente.dados.relatosMapa[CITY_ID][RELATO_ID];
  for (const item of [relato, resumo, mapa]) {
    assert.equal(item.status, "andamento");
    assert.equal(item.votos, 7);
    assert.equal(item.titulo, relatoBase.titulo);
  }
  assert.equal(relato.dataResolucao, undefined);
  assert.equal(relato.descricao, relatoBase.descricao);
  assert.equal(relato.fotoPublicId, relatoBase.fotoPublicId);
  assert.equal(resumo.filtroCidadeStatus, `${CITY_ID}|andamento`);
  assert.deepEqual(mapa, { ...marcador(relatoBase), status: "andamento", votos: 7 });
  assert.equal(ambiente.invalidacoes, 2);
});

test("edição de legado mantém cityId numérico e coordenadas ausentes", async () => {
  const legado = { ...relatoBase, cityId: 2504009 };
  delete legado.lat;
  delete legado.lng;
  const ambiente = await carregarDb(dadosIniciais(legado));
  await ambiente.db.atualizarRelatoDoUsuario(RELATO_ID, {
    titulo: "Título revisado", categoria: "Outros", descricao: "Descrição revisada do relato."
  });
  await ambiente.db.atualizarStatus(RELATO_ID, "andamento");
  const mapa = ambiente.dados.relatosMapa["2504009"][RELATO_ID];
  assert.equal(mapa.cityId, 2504009);
  assert.equal(mapa.lat, undefined);
  assert.equal(mapa.lng, undefined);
  assert.equal(mapa.status, "andamento");
  assert.equal(mapa.titulo, "Título revisado");
});

test("voto e remoção do voto atualizam os três totais atomicamente sem ler relato completo", async () => {
  const ambiente = await carregarDb(dadosIniciais({ ...relatoBase, cityId: 2504009 }));
  assert.equal(await ambiente.db.votar(RELATO_ID, "cidadao"), true);
  assert.equal(ambiente.dados.relatosMapa["2504009"][RELATO_ID].votos, 1);
  assert.equal(await ambiente.db.votar(RELATO_ID, "cidadao"), false);
  assert.equal(ambiente.escritas.length, 2);
  assert.ok(ambiente.escritas.every(item => item.caminho === ""));
  assert.deepEqual(ambiente.escritas[0].alteracoes, {
    [`votos/${RELATO_ID}/cidadao`]: true,
    [`relatos/${RELATO_ID}/votos`]: 1,
    [`relatosResumo/${RELATO_ID}/votos`]: 1,
    [`relatosMapa/2504009/${RELATO_ID}/votos`]: 1
  });
  assert.equal(ambiente.dados.relatos[RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.relatosResumo[RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.relatosMapa["2504009"][RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.votos[RELATO_ID].cidadao, undefined);
  assert.ok(ambiente.leituras.every(item => item.caminho !== `relatos/${RELATO_ID}`));
  assert.equal(ambiente.invalidacoes, 2);
});

test("voto repete total obsoleto e sincroniza mapa com novo total", async () => {
  const ambiente = await carregarDb(dadosIniciais(), {
    antesAtualizar({ gravar, tentativa }) {
      if (tentativa !== 1) return;
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
        gravar(`${raiz}/votos`, 1);
      }
      throw Object.assign(new Error("concorrência"), { code: "PERMISSION_DENIED" });
    }
  });
  assert.equal(await ambiente.db.votar(RELATO_ID, "cidadao"), true);
  assert.equal(ambiente.escritas.length, 2);
  assert.equal(ambiente.dados.relatosMapa[CITY_ID][RELATO_ID].votos, 2);
  assert.equal(ambiente.dados.relatosResumo[RELATO_ID].votos, 2);
  assert.equal(ambiente.dados.relatos[RELATO_ID].votos, 2);
  assert.equal(ambiente.leituras.filter(item => item.caminho.endsWith("/cityId")).length, 1);
  assert.equal(ambiente.invalidacoes, 1);
});

test("exclusão delega à API autenticada e invalida cache somente após sucesso", async () => {
  const ambiente = await carregarDb();
  await ambiente.db.excluirRelato(RELATO_ID);
  assert.deepEqual(ambiente.exclusoes, [[RELATO_ID, "token-teste"]]);
  assert.equal(ambiente.tokens, 1);
  assert.equal(ambiente.invalidacoes, 1);
  assert.equal(ambiente.escritas.length, 0);

  const falha = await carregarDb({}, { erroExclusao: new Error("API indisponível") });
  await assert.rejects(falha.db.excluirRelato(RELATO_ID), /API indisponível/);
  assert.equal(falha.invalidacoes, 0);
});
