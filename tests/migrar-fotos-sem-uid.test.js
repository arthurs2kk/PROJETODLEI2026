"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  destinoFoto,
  ehFotoLegadaDoAutor,
} = require("../scripts/migrar-fotos-sem-uid.js");

test("gera destino de foto sem UID", () => {
  assert.equal(destinoFoto("relato-123"), "pro_povo/relatos/relato-123");
});

test("identifica somente o caminho legado pertencente ao autor", () => {
  const legado = { autorId: "uid-privado", fotoPublicId: "pro_povo/uid-privado/relato-123" };
  assert.equal(ehFotoLegadaDoAutor("relato-123", legado), true);
  assert.equal(ehFotoLegadaDoAutor("relato-123", { ...legado, fotoPublicId: destinoFoto("relato-123") }), false);
  assert.equal(ehFotoLegadaDoAutor("outro", legado), false);
});
