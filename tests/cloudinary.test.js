"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

async function carregarModuloCloudinary() {
  const arquivo = path.resolve(__dirname, "..", "js", "cloudinary.js");
  const contexto = vm.createContext({ console, URL, Error });
  const modulo = new vm.SourceTextModule(
    fs.readFileSync(arquivo, "utf8"),
    { context: contexto, identifier: pathToFileURL(arquivo).href }
  );
  await modulo.link(() => {
    throw new Error("cloudinary.js não deveria importar outros módulos");
  });
  await modulo.evaluate();
  return modulo.namespace;
}

test("identifica preset de upload inexistente como erro de configuração", async () => {
  const { criarErroUpload, UPLOAD_PRESET } = await carregarModuloCloudinary();
  const erro = criarErroUpload(400, {
    error: { message: "Upload preset not found" }
  });

  assert.equal(UPLOAD_PRESET, "ProPovo");
  assert.equal(erro.code, "CONFIGURACAO_UPLOAD_IMAGEM");
  assert.equal(erro.status, 400);
  assert.equal(erro.cloudinaryMessage, "Upload preset not found");
});

test("diferencia recusa por tamanho do arquivo", async () => {
  const { criarErroUpload } = await carregarModuloCloudinary();
  const erro = criarErroUpload(400, {
    error: { message: "File size too large. Got 12000000. Maximum is 10000000." }
  });

  assert.equal(erro.code, "FOTO_MUITO_GRANDE");
});

test("preserva o detalhe de uma recusa desconhecida para o console", async () => {
  const { criarErroUpload } = await carregarModuloCloudinary();
  const erro = criarErroUpload(400, {
    error: { message: "Unknown Cloudinary validation" }
  });

  assert.equal(erro.code, "ERRO_UPLOAD_IMAGEM");
  assert.equal(erro.cloudinaryMessage, "Unknown Cloudinary validation");
});

test("gera public_id do relato sem expor o UID do usuário", async () => {
  const { publicIdImagem } = await carregarModuloCloudinary();

  assert.equal(
    publicIdImagem("-OabcDEF01234567890x"),
    "pro_povo/relatos/-OabcDEF01234567890x"
  );
  assert.throws(() => publicIdImagem("../outro"));
});
