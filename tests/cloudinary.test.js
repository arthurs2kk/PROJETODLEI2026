"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

async function carregarModuloCloudinary(globais = {}) {
  const arquivo = path.resolve(__dirname, "..", "js", "cloudinary.js");
  const contexto = vm.createContext({ console, URL, Error, ...globais });
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

test('exclusão identifica servidor estático e não aceita HTML como sucesso', async () => {
  for (const status of [200, 404, 405]) {
    const { excluirRelatoNoServidor } = await carregarModuloCloudinary({
      fetch: async () => ({ ok: status === 200, status, json: async () => { throw new SyntaxError('HTML'); } })
    });
    await assert.rejects(excluirRelatoNoServidor('-OabcDEF01234567890x', 'token-teste'),
      erro => erro.code === 'API_RELATOS_INDISPONIVEL' && erro.status === status);
  }
});

test('exclusão mantém os erros JSON e o resultado da API autenticada', async () => {
  for (const status of [200, 403]) {
    const corpo = status === 200 ? { ok: true } : { codigo: 'SEM_PERMISSAO', erro: 'Acesso negado.' };
    const { excluirRelatoNoServidor } = await carregarModuloCloudinary({
      fetch: async (url, opcoes) => {
        assert.equal(url, '/api/relatos');
        assert.equal(opcoes.method, 'POST');
        assert.equal(opcoes.headers.Authorization, 'Bearer token-teste');
        assert.equal(JSON.parse(opcoes.body).acao, 'excluir');
        return { ok: status === 200, status, json: async () => corpo };
      }
    });
    const promessa = excluirRelatoNoServidor('-OabcDEF01234567890x', 'token-teste');
    if (status === 200) assert.deepEqual(await promessa, corpo);
    else await assert.rejects(promessa, erro => erro.code === 'SEM_PERMISSAO');
  }
});

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

test("upload unsigned envia somente os parâmetros aceitos pelo Cloudinary", async () => {
  const campos = [];
  class FormDataTeste {
    append(nome, valor) {
      campos.push([nome, valor]);
    }
  }

  const relatoId = "-OabcDEF01234567890x";
  const publicId = `pro_povo/relatos/${relatoId}`;
  let requisicao = null;
  const { uploadImagem } = await carregarModuloCloudinary({
    FormData: FormDataTeste,
    fetch: async (url, opcoes) => {
      requisicao = { url, opcoes };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          public_id: publicId,
          secure_url: "https://res.cloudinary.com/dk8uky6m/image/upload/foto.jpg"
        })
      };
    }
  });

  const arquivo = { name: "foto.jpg" };
  const resultado = await uploadImagem(arquivo, relatoId);

  assert.equal(requisicao.url, "https://api.cloudinary.com/v1_1/dk8uky6m/image/upload");
  assert.equal(requisicao.opcoes.method, "POST");
  assert.equal(resultado.publicId, publicId);
  assert.deepEqual(campos.map(([nome]) => nome), ["file", "upload_preset", "public_id"]);
  assert.equal(campos.some(([nome]) => nome === "overwrite"), false);
  assert.equal(campos.some(([nome]) => nome === "return_delete_token"), false);
});
