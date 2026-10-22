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
    "dataCriacao", "lat", "lng"
  ].filter(campo => relato[campo] != null).map(campo => [campo, relato[campo]]));
}

function detalhePublico(relato) {
  return Object.fromEntries([
    "titulo", "categoria", "descricao", "endereco", "lat", "lng", "cidade",
    "cityId", "bairro", "fotoUrl", "status", "votos",
    "dataCriacao", "dataEdicao", "dataResolucao", "respostaOficial", "dataResposta"
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
    relatosPublicos: { [RELATO_ID]: detalhePublico(relato) },
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
    startAt: (valor, chave) => ({ tipo: "startAt", valor, chave }),
    endAt: (valor, chave) => ({ tipo: "endAt", valor, chave }),
    serverTimestamp: () => copiar(timestamp),
    push: referencia => ({ caminho: `${referencia.caminho}/${RELATO_ID}`, key: RELATO_ID }),
    set: async () => { throw new Error("set inesperado"); },
    onValue: () => { throw new Error("onValue inesperado"); },
    async get(referencia) {
      leituras.push(copiar(referencia));
      await opcoes.antesLer?.(referencia);
      let valor = copiar(ler(referencia.caminho));
      if (referencia.restricoes && valor) {
        const campo = referencia.restricoes.find(item => item.tipo === "orderByChild")?.valor;
        const limite = referencia.restricoes.find(item => item.tipo === "limitToLast")?.valor;
        const compararValor = (a, b) => {
          if (a === b) return 0;
          const tipo = v => v == null ? 0 : typeof v === 'boolean' ? 1 : typeof v === 'number' ? 2 : typeof v === 'string' ? 3 : 4;
          return tipo(a) - tipo(b) || (a < b ? -1 : 1);
        };
        const igual = referencia.restricoes.find(item => item.tipo === 'equalTo');
        const inicio = referencia.restricoes.find(item => item.tipo === 'startAt');
        const fim = referencia.restricoes.find(item => item.tipo === 'endAt');
        const pares = Object.entries(valor).filter(([id, item]) => {
          if (igual && item[campo] !== igual.valor) return false;
          const desde = inicio && compararValor(item[campo], inicio.valor);
          if (inicio && (desde < 0 || (desde === 0 && inicio.chave && id.localeCompare(inicio.chave) < 0))) return false;
          const ate = fim && compararValor(item[campo], fim.valor);
          return !(fim && (ate > 0 || (ate === 0 && fim.chave && id.localeCompare(fim.chave) > 0)));
        }).sort(([idA, a], [idB, b]) => compararValor(a[campo], b[campo]) || idA.localeCompare(idB));
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
  const contexto = vm.createContext({
    console, setTimeout, clearTimeout, AbortController,
    __proPovoRelatosPrefetch: opcoes.prefetch
  });
  const modulo = new vm.SourceTextModule(
    fs.readFileSync(path.join(__dirname, "..", "js", "db.js"), "utf8"),
    { context: contexto }
  );
  await modulo.link(especificador => {
    if (especificador === './abrangencia-relatos.js') {
      return new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '..', 'js', 'abrangencia-relatos.js'), 'utf8'), { context: contexto });
    }
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

function dadosComTiposDeCidade(total = 7, formato = 'misto') {
  const dados = { relatosResumo: {}, relatosMapa: { '2504009': {} } };
  for (let i = 0; i < total; i++) {
    const id = `relato-${String(i).padStart(3, '0')}`;
    const cityId = formato === 'numero' || (formato === 'misto' && i % 2) ? 2504009 : '2504009';
    const relato = { ...relatoBase, cityId, dataCriacao: i + 1 };
    dados.relatosResumo[id] = {
      ...marcador(relato), descricaoResumo: relato.descricao,
      filtroCidadeCategoria: `${cityId}|${relato.categoria}`,
      filtroCidadeStatus: `${cityId}|${relato.status}`,
      filtroCidadeCategoriaStatus: `${cityId}|${relato.categoria}|${relato.status}`
    };
    dados.relatosMapa['2504009'][id] = marcador(relato);
  }
  dados.relatosResumo.outraCidade = { ...marcador(relatoBase), cityId: '2507507', dataCriacao: 9999 };
  return dados;
}

test('listagem pública e mapa incluem os mesmos sete relatos com cityId misto, sem incluir outra cidade', async () => {
  const ambiente = await carregarDb(dadosComTiposDeCidade());
  const pagina = await ambiente.db.buscarRelatosPagina(null, 25, { cidade: '2504009' });
  const mapa = await ambiente.db.buscarRelatosMapa('2504009');
  assert.equal(pagina.itens.length, 7);
  assert.equal(pagina.temMais, false);
  assert.deepEqual(Array.from(pagina.itens, r => r.id).sort(), Array.from(mapa, r => r.id).sort());
  assert.equal(pagina.itens.some(r => r.id === 'outraCidade'), false);
  assert.equal(pagina.itens.filter(r => typeof r.cityId === 'number').length, 3);
  assert.deepEqual(ambiente.leituras.slice(0, 2).map(r => r.restricoes.find(c => c.tipo === 'equalTo').valor), ['2504009', 2504009]);
  assert.ok(ambiente.leituras.every(r => r.caminho !== 'relatos'));
});

test('paginação pública percorre tipos mistos ou únicos sem saltos, duplicações ou leitura ilimitada', async () => {
  for (const formato of ['misto', 'numero', 'texto']) {
    const ambiente = await carregarDb(dadosComTiposDeCidade(11, formato));
    const ids = [];
    let cursor = null;
    let temMais = true;
    let paginas = 0;
    while (temMais && paginas < 10) {
      const pagina = await ambiente.db.buscarRelatosPagina(cursor, 3, { cidade: '2504009' });
      assert.ok(pagina.itens.length <= 3);
      ids.push(...Array.from(pagina.itens, r => r.id));
      const ultimo = pagina.itens.at(-1);
      cursor = ultimo && { id: ultimo.id, dataCriacao: ultimo.dataCriacao };
      temMais = pagina.temMais;
      paginas++;
    }
    assert.equal(temMais, false, formato);
    assert.equal(paginas, 4, formato);
    assert.deepEqual(ids, Array.from({ length: 11 }, (_, i) => `relato-${String(10 - i).padStart(3, '0')}`));
    assert.ok(ambiente.leituras.every(r => r.restricoes.some(c => c.tipo === 'limitToLast' && c.valor <= 5)));
  }
});

test('paginação administrativa regional inclui relatos com cityId numérico e textual', async () => {
  const dados = { relatos: {}, relatosResumo: {} };
  for (let i = 0; i < 120; i++) {
    const id = `relato-${String(i).padStart(3, '0')}`;
    dados.relatos[id] = {
      ...relatoBase,
      cityId: i % 2 ? 2504009 : '2504009',
      dataCriacao: i + 1
    };
    dados.relatosResumo[id] = { ...dados.relatos[id] };
  }
  dados.relatos.outraCidade = { ...relatoBase, cityId: '2507507' };
  dados.relatosResumo.outraCidade = { ...dados.relatos.outraCidade };

  for (const cityIdAdmin of ['2504009', 2504009]) {
    const ambiente = await carregarDb(dados);
    const recebidos = await ambiente.db.buscarTodosRelatosGestao(
      { papel: 'admin', cityId: cityIdAdmin },
      null,
      25
    );

    assert.equal(recebidos.length, 120);
    assert.equal(recebidos.some(relato => relato.id === 'outraCidade'), false);
    assert.equal(new Set(recebidos.map(relato => relato.id)).size, 120);
    const consultas = ambiente.leituras.filter(leitura => leitura.restricoes);
    assert.ok(consultas.every(leitura => leitura.restricoes.some(item =>
      item.tipo === 'limitToLast' && item.valor <= 27
    )));
    assert.deepEqual(
      [...new Set(consultas.map(leitura => typeof leitura.restricoes.find(item => item.tipo === 'startAt').valor))].sort(),
      ['number', 'string']
    );
    assert.ok(consultas.every(leitura => leitura.caminho === 'relatosResumo'));
    assert.equal(ambiente.leituras.some(leitura => leitura.caminho === 'relatos'), false);
  }
});

test('filtros compostos incluem legados e mantêm uma única consulta indexada', async () => {
  for (const filtros of [{ categoria: relatoBase.categoria }, { status: 'aberto' }, { categoria: relatoBase.categoria, status: 'aberto' }]) {
    const ambiente = await carregarDb(dadosComTiposDeCidade());
    const pagina = await ambiente.db.buscarRelatosPagina(null, 25, { cidade: '2504009', ...filtros });
    assert.equal(pagina.itens.length, 7);
    assert.equal(ambiente.leituras.length, 1);
  }
});

test('consulta corrigida ignora cache antigo incompleto e reutiliza o novo resultado completo', async () => {
  const ambiente = await carregarDb(dadosComTiposDeCidade());
  ambiente.cache.set('relatos:resumo:pagina-inicial:25:cityId%3A2504009', { itens: [{ id: 'cache-incompleto' }], temMais: false });
  const opcoes = { cidade: '2504009', usarCache: true };
  const primeira = await ambiente.db.buscarRelatosPagina(null, 25, opcoes);
  assert.equal(primeira.itens.length, 7);
  assert.equal(ambiente.leituras.length, 2);
  assert.deepEqual(copiar(await ambiente.db.buscarRelatosPagina(null, 25, opcoes)), copiar(primeira));
  assert.equal(ambiente.leituras.length, 2);
});

test('falha na consulta de legados não publica nem guarda uma listagem parcial como completa', async () => {
  const ambiente = await carregarDb(dadosComTiposDeCidade(), {
    antesLer(referencia) {
      if (referencia.restricoes?.some(c => c.tipo === 'equalTo' && typeof c.valor === 'number')) throw new Error('Consulta indisponível');
    }
  });
  await assert.rejects(ambiente.db.buscarRelatosPagina(null, 25, { cidade: '2504009', usarCache: true }), /Consulta indisponível/);
  assert.equal(ambiente.cache.size, 0);
});

test("criação grava relato, detalhes, resumo, marcador, contato e cooldown em único update", async () => {
  const relatoCG = { ...relatoBase, cityId: '2504009', cidade: 'Campina Grande', lat: -7.216, lng: -35.888 };
  const ambiente = await carregarDb({ usuarios: { cidadao: {
    nome: relatoBase.autorNome, email: "cidadao@example.com", cidade: "João Pessoa", dataCadastro: 1
  } } });
  assert.equal(await ambiente.db.criarRelato(relatoCG), RELATO_ID);
  assert.equal(ambiente.escritas.length, 1);
  assert.equal(ambiente.escritas[0].caminho, "");
  const payload = ambiente.escritas[0].alteracoes;
  assert.deepEqual(Object.keys(payload).sort(), [
    `relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosPublicos/${RELATO_ID}`,
    `relatosMapa/2504009/${RELATO_ID}`,
    `contatosRelatos/${RELATO_ID}`, "limitesEnvio/cidadao"
  ].sort());
  assert.deepEqual(payload[`relatosMapa/2504009/${RELATO_ID}`], {
    ...marcador(relatoCG), dataCriacao: timestamp
  });
  assert.equal(ambiente.invalidacoes, 1);
});

test("criação fora de Campina Grande é recusada antes de upload e escrita", async () => {
  const ambiente = await carregarDb();
  for (const relato of [relatoBase, { ...relatoBase, cityId: '2504009' }, { ...relatoBase, cidade: 'Campina Grande' }]) {
    await assert.rejects(ambiente.db.criarRelato(relato, { type: 'image/jpeg', size: 100 }), erro => erro.code === 'FORA_ABRANGENCIA');
  }
  assert.equal(ambiente.escritas.length, 0);
  assert.equal(ambiente.leituras.length, 0);
});

test("edição preserva relato completo e votos concorrentes nas projeções", async () => {
  const ambiente = await carregarDb(dadosIniciais(), {
    antesAtualizar({ gravar }) {
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosPublicos/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
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
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosPublicos/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
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

test("voto e remoção atualizam todos os totais atomicamente sem leitura privada", async () => {
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
    [`relatosPublicos/${RELATO_ID}/votos`]: 1,
    [`relatosMapa/2504009/${RELATO_ID}/votos`]: 1
  });
  assert.equal(ambiente.dados.relatos[RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.relatosResumo[RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.relatosPublicos[RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.relatosMapa["2504009"][RELATO_ID].votos, 0);
  assert.equal(ambiente.dados.votos[RELATO_ID].cidadao, undefined);
  assert.ok(ambiente.leituras.every(item => item.caminho !== `relatos/${RELATO_ID}`));
  assert.equal(ambiente.invalidacoes, 2);
});

test("voto repete total obsoleto e sincroniza mapa com novo total", async () => {
  const ambiente = await carregarDb(dadosIniciais(), {
    antesAtualizar({ gravar, tentativa }) {
      if (tentativa !== 1) return;
      for (const raiz of [`relatos/${RELATO_ID}`, `relatosResumo/${RELATO_ID}`, `relatosPublicos/${RELATO_ID}`, `relatosMapa/${CITY_ID}/${RELATO_ID}`]) {
        gravar(`${raiz}/votos`, 1);
      }
      throw Object.assign(new Error("concorrência"), { code: "PERMISSION_DENIED" });
    }
  });
  assert.equal(await ambiente.db.votar(RELATO_ID, "cidadao"), true);
  assert.equal(ambiente.escritas.length, 2);
  assert.equal(ambiente.dados.relatosMapa[CITY_ID][RELATO_ID].votos, 2);
  assert.equal(ambiente.dados.relatosResumo[RELATO_ID].votos, 2);
  assert.equal(ambiente.dados.relatosPublicos[RELATO_ID].votos, 2);
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

test("listagem publica consome a leitura antecipada sem repetir a consulta no SDK", async () => {
  const dados = dadosComTiposDeCidade();
  const relatosDaCidade = Object.fromEntries(
    Object.entries(dados.relatosResumo).filter(([, relato]) => String(relato.cityId) === "2504009")
  );
  const ambiente = await carregarDb(dados, {
    prefetch: {
      tipo: "lista",
      tamanho: 25,
      cidade: "2504009",
      promise: Promise.resolve(copiar(relatosDaCidade))
    }
  });

  const pagina = await ambiente.db.buscarRelatosPagina(null, 25, {
    cidade: "2504009",
    usarCache: true
  });

  assert.equal(pagina.itens.length, 7);
  assert.equal(pagina.itens.some(relato => relato.id === "outraCidade"), false);
  assert.equal(ambiente.leituras.length, 0);
  assert.equal(ambiente.cache.size, 1);
});

test("home consome a leitura antecipada dos destaques sem repetir a consulta no SDK", async () => {
  const dados = dadosComTiposDeCidade();
  const ambiente = await carregarDb(dados, {
    prefetch: {
      tipo: "destaque",
      tamanho: 20,
      cidade: "",
      promise: Promise.resolve(copiar(dados.relatosResumo))
    }
  });

  const relatos = await ambiente.db.buscarRelatosDestaque(20, true);

  assert.equal(relatos.length, 8);
  assert.equal(ambiente.leituras.length, 0);
  assert.equal(ambiente.cache.size, 1);
});
