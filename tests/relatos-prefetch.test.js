"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const codigo = fs.readFileSync(path.join(__dirname, "..", "js", "relatos-prefetch.js"), "utf8");

function executar({ tipo = "lista", cidade = "2504009", tamanho = "25", cache = null } = {}) {
  const chamadas = [];
  const contexto = {
    document: { currentScript: { dataset: { tipo, cidade, tamanho } } },
    localStorage: { getItem: () => cache },
    fetch: async url => {
      chamadas.push(url);
      const parametros = new URL(url).searchParams;
      const valor = JSON.parse(parametros.get("equalTo") || "null");
      return { ok: true, json: async () => ({ [`relato-${typeof valor}`]: { cityId: valor } }) };
    },
    AbortController,
    URLSearchParams,
    URL,
    Date,
    setTimeout,
    clearTimeout
  };
  contexto.window = contexto;
  vm.runInNewContext(codigo, contexto);
  return { contexto, chamadas };
}

test("prefetch da lista consulta cityId textual e numerico em paralelo", async () => {
  const { contexto, chamadas } = executar();
  const dados = await contexto.__proPovoRelatosPrefetch.promise;

  assert.equal(chamadas.length, 2);
  assert.deepEqual(
    chamadas.map(url => JSON.parse(new URL(url).searchParams.get("equalTo"))),
    ["2504009", 2504009]
  );
  assert.ok(chamadas.every(url => new URL(url).searchParams.get("limitToLast") === "26"));
  assert.equal(dados["relato-string"].cityId, "2504009");
  assert.equal(dados["relato-number"].cityId, 2504009);
});

test("prefetch nao repete leitura quando o cache ainda esta fresco", () => {
  const cache = JSON.stringify({ salvoEm: Date.now(), dados: [] });
  const { contexto, chamadas } = executar({ cache });

  assert.equal(chamadas.length, 0);
  assert.equal(contexto.__proPovoRelatosPrefetch, undefined);
});
