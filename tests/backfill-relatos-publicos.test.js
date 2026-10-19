"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CAMPOS_PUBLICOS,
  criarDetalhePublico,
  objetosIguais,
} = require("../scripts/backfill-relatos-publicos.js");

const relato = {
  titulo: "Poste apagado",
  categoria: "Iluminação pública",
  descricao: "A rua está sem iluminação há vários dias.",
  endereco: "Rua Exemplo",
  lat: -7.12,
  lng: -34.88,
  cidade: "João Pessoa",
  cityId: "2507507",
  bairro: "Centro",
  fotoUrl: "https://res.cloudinary.com/exemplo/image/upload/foto.jpg",
  fotoPublicId: "pro_povo/uid-secreto/relato-1",
  status: "aberto",
  votos: 2,
  autorId: "uid-secreto",
  autorNome: "Pessoa",
  dataCriacao: 1000,
  respostaOficial: "Equipe acionada.",
  dataResposta: 2000,
};

test("projeção pública inclui detalhes exibidos e exclui identificadores internos", () => {
  const detalhe = criarDetalhePublico(relato);
  assert.ok(detalhe);
  assert.equal(detalhe.descricao, relato.descricao);
  assert.equal(detalhe.respostaOficial, relato.respostaOficial);
  assert.equal(detalhe.autorId, undefined);
  assert.equal(detalhe.autorNome, undefined);
  assert.equal(detalhe.fotoPublicId, undefined);
  assert.deepEqual(Object.keys(detalhe).sort(), CAMPOS_PUBLICOS.filter(c => relato[c] != null).sort());
});

test("relato incompleto não é publicado", () => {
  const incompleto = { ...relato };
  delete incompleto.cityId;
  assert.equal(criarDetalhePublico(incompleto), null);
});

test("comparação detecta campos extras ou valores desatualizados", () => {
  const esperado = criarDetalhePublico(relato);
  assert.equal(objetosIguais({ ...esperado }, esperado), true);
  assert.equal(objetosIguais({ ...esperado, autorId: "vazamento" }, esperado), false);
  assert.equal(objetosIguais({ ...esperado, votos: 99 }, esperado), false);
});
