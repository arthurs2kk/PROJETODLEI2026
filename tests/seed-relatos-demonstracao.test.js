"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  AVISO_FICTICIO,
  PREFIXO_ID,
  criarRelato,
  detalhePublico,
  montarAtualizacoes,
} = require("../scripts/seed-relatos-mapa-calor.js");

test("gera uma amostra variada, identificada e dentro de Campina Grande", () => {
  const agora = Date.UTC(2026, 9, 19, 12);
  const relatos = Array.from({ length: 120 }, (_, indice) => criarRelato(indice, agora));

  assert.equal(relatos.length, 120);
  assert.ok(new Set(relatos.map(relato => relato.bairro)).size >= 15);
  assert.equal(new Set(relatos.map(relato => relato.categoria)).size, 6);
  assert.equal(new Set(relatos.map(relato => relato.status)).size, 3);
  assert.ok(new Set(relatos.map(relato => relato.titulo)).size >= 25);

  for (const relato of relatos) {
    assert.equal(relato.cityId, "2504009");
    assert.equal(relato.cidade, "Campina Grande");
    assert.ok(relato.descricao.endsWith(AVISO_FICTICIO));
    assert.ok(relato.autorId.startsWith(PREFIXO_ID));
    assert.ok(relato.lat >= -7.28 && relato.lat <= -7.17);
    assert.ok(relato.lng >= -35.95 && relato.lng <= -35.85);
  }
});

test("grava as quatro projeções usadas pela aplicação", () => {
  const atualizacoes = montarAtualizacoes(2, Date.UTC(2026, 9, 19, 12));

  for (let numero = 1; numero <= 2; numero += 1) {
    const id = `${PREFIXO_ID}${String(numero).padStart(3, "0")}`;
    assert.ok(atualizacoes[`relatos/${id}`]);
    assert.ok(atualizacoes[`relatosResumo/${id}`]);
    assert.ok(atualizacoes[`relatosPublicos/${id}`]);
    assert.ok(atualizacoes[`relatosMapa/2504009/${id}`]);
  }
});

test("remoção limpa registros e dados derivados sem depender do conteúdo", () => {
  const atualizacoes = montarAtualizacoes(1, Date.now(), true);
  const id = `${PREFIXO_ID}001`;

  assert.equal(atualizacoes[`relatos/${id}`], null);
  assert.equal(atualizacoes[`relatosResumo/${id}`], null);
  assert.equal(atualizacoes[`relatosPublicos/${id}`], null);
  assert.equal(atualizacoes[`relatosMapa/2504009/${id}`], null);
  assert.equal(atualizacoes[`votos/${id}`], null);
  assert.equal(atualizacoes[`prioridadesMunicipais/2504009/${id}`], null);
});

test("detalhe público não expõe identificadores dos perfis demonstrativos", () => {
  const relato = criarRelato(0, Date.UTC(2026, 9, 19, 12));
  const detalhe = detalhePublico(relato);

  assert.equal(detalhe.autorId, undefined);
  assert.equal(detalhe.autorNome, undefined);
  assert.equal(detalhe.descricao, relato.descricao);
});
