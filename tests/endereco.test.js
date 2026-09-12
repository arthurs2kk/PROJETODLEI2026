"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { fileURLToPath, pathToFileURL } = require("node:url");

const raiz = path.resolve(__dirname, "..");

async function carregarModuloEndereco(fetchMock = async () => {
  throw new Error("fetch inesperado");
}) {
  const contexto = vm.createContext({
    console: { ...console, warn() {} },
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: fetchMock
  });
  const cache = new Map();

  async function carregar(arquivo) {
    const absoluto = path.resolve(arquivo);
    if (cache.has(absoluto)) return cache.get(absoluto);

    const modulo = new vm.SourceTextModule(
      fs.readFileSync(absoluto, "utf8"),
      { context: contexto, identifier: pathToFileURL(absoluto).href }
    );
    cache.set(absoluto, modulo);

    await modulo.link((especificador, referencia) => {
      const dependente = fileURLToPath(new URL(especificador, referencia.identifier));
      return carregar(dependente);
    });
    await modulo.evaluate();
    return modulo;
  }

  return (await carregar(path.join(raiz, "js", "endereco.js"))).namespace;
}

const municipios = [
  { id: "2504009", nome: "Campina Grande", nomeNormalizado: "campina grande" },
  { id: "2503100", nome: "Cabaceiras", nomeNormalizado: "cabaceiras" }
];

test("reconhece o município sem confundir village com bairro", async () => {
  const endereco = await carregarModuloEndereco();
  const address = {
    road: "Rua João Suassuna",
    village: "Centro",
    city_district: "Campina Grande",
    city: "Campina Grande",
    state: "Paraíba",
    country: "Brasil"
  };

  const municipio = endereco.identificarMunicipioPB(address, municipios);
  assert.equal(municipio.id, "2504009");
  assert.equal(endereco.identificarBairro(address, municipio), "Centro");
});

test("não grava o nome do município como se fosse bairro", async () => {
  const endereco = await carregarModuloEndereco();
  const address = {
    road: "Rua Coronel Maracajá",
    city_district: "Cabaceiras",
    village: "Cabaceiras",
    state: "Paraíba",
    country: "Brasil"
  };

  const municipio = endereco.identificarMunicipioPB(address, municipios);
  assert.equal(municipio.id, "2503100");
  assert.equal(endereco.identificarBairro(address, municipio), null);
});

test("remove segmentos repetidos da mesma rua e preserva bairros diferentes", async () => {
  const endereco = await carregarModuloEndereco();
  const base = {
    cityId: "2507507",
    cidade: "João Pessoa",
    rua: "Avenida Presidente Epitácio Pessoa",
    numero: null
  };
  const sugestoes = [
    { ...base, bairro: "Torre", texto: "Trecho 1" },
    { ...base, bairro: "Torre", texto: "Trecho 2" },
    { ...base, bairro: "Miramar", texto: "Trecho 3" }
  ];

  const resultado = endereco.removerDuplicadas(sugestoes);
  assert.deepEqual(Array.from(resultado, item => item.bairro), ["Torre", "Miramar"]);
});

test("a busca converte a resposta realista em endereço com bairro obrigatório", async () => {
  const respostaNominatim = [
    {
      display_name: "Rua João Suassuna, Centro, Campina Grande, Paraíba, Brasil",
      lat: "-7.2162084",
      lon: "-35.8879689",
      address: {
        road: "Rua João Suassuna",
        village: "Centro",
        city_district: "Campina Grande",
        city: "Campina Grande",
        state: "Paraíba",
        country: "Brasil"
      }
    },
    {
      display_name: "Rua João Suassuna, Centro, Campina Grande, Paraíba, Brasil",
      lat: "-7.2151740",
      lon: "-35.8901565",
      address: {
        road: "Rua João Suassuna",
        village: "Centro",
        city_district: "Campina Grande",
        city: "Campina Grande",
        state: "Paraíba",
        country: "Brasil"
      }
    }
  ];

  const endereco = await carregarModuloEndereco(async url => {
    const alvo = String(url);
    if (alvo.includes("nominatim")) {
      return { ok: true, status: 200, json: async () => respostaNominatim };
    }
    if (alvo.includes("servicodados.ibge.gov.br")) {
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 2504009, nome: "Campina Grande" }]
      };
    }
    throw new Error("consulta inesperada");
  });

  const resultado = await endereco.buscarSugestoesEndereco("Rua João Suassuna, Campina Grande");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].cidade, "Campina Grande");
  assert.equal(resultado[0].cityId, "2504009");
  assert.equal(resultado[0].bairro, "Centro");
});

test("recusa seleção quando o OSM não fornece um bairro confiável", async () => {
  const endereco = await carregarModuloEndereco(async url => {
    const alvo = String(url);
    if (alvo.includes("nominatim")) {
      return {
        ok: true,
        status: 200,
        json: async () => [{
          display_name: "Rua Coronel Maracajá, Cabaceiras, Paraíba, Brasil",
          lat: "-7.4880218",
          lon: "-36.2858430",
          address: {
            road: "Rua Coronel Maracajá",
            city_district: "Cabaceiras",
            village: "Cabaceiras",
            state: "Paraíba",
            country: "Brasil"
          }
        }]
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [{ id: 2503100, nome: "Cabaceiras" }]
    };
  });

  await assert.rejects(
    endereco.buscarSugestoesEndereco("Rua Coronel Maracajá, Cabaceiras"),
    erro => erro.codigo === "BAIRRO_NAO_IDENTIFICADO"
  );
});

test("diferencia limite HTTP de uma busca sem resultados", async () => {
  const endereco = await carregarModuloEndereco(async url => {
    if (String(url).includes("nominatim")) {
      return { ok: false, status: 429 };
    }
    throw new Error("consulta inesperada");
  });

  await assert.rejects(
    endereco.buscarSugestoesEndereco("Rua de teste, João Pessoa"),
    erro => erro.codigo === "LIMITE_NOMINATIM" && erro.status === 429
  );
});
