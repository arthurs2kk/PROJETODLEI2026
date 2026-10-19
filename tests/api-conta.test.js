"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { anonimizarContaNaRaiz, autenticacaoRecente } = require("../api/conta")._internals;

test("exclusão anonimiza autoria privada e remove perfil, contato e voto", () => {
  const raiz = {
    usuarios: { pessoa: { nome: "Pessoa", email: "pessoa@example.test" }, outra: { nome: "Outra" } },
    limitesEnvio: { pessoa: 123, outra: 456 },
    relatos: {
      relatoA: { autorId: "pessoa", autorNome: "Pessoa", cityId: "2507507", votos: 2 },
      relatoB: { autorId: "outra", autorNome: "Outra", cityId: "2507507", votos: 1 },
    },
    contatosRelatos: {
      relatoA: { autorId: "pessoa", email: "pessoa@example.test" },
      relatoB: { autorId: "outra", email: "outra@example.test" },
    },
    votos: { relatoB: { pessoa: true }, relatoA: { outra: true } },
    relatosResumo: { relatoA: { votos: 2 }, relatoB: { votos: 1 } },
    relatosPublicos: { relatoA: { votos: 2 }, relatoB: { votos: 1 } },
    relatosMapa: { "2507507": { relatoA: { votos: 2 }, relatoB: { votos: 1 } } },
  };

  const resultado = anonimizarContaNaRaiz(raiz, "pessoa");
  assert.equal(resultado.raiz.usuarios.pessoa, undefined);
  assert.equal(resultado.raiz.limitesEnvio.pessoa, undefined);
  assert.equal(resultado.raiz.relatos.relatoA.autorId, "conta_excluida_relatoA");
  assert.equal(resultado.raiz.relatos.relatoA.autorNome, "Pessoa usuária removida");
  assert.equal(resultado.raiz.contatosRelatos.relatoA, undefined);
  assert.equal(resultado.raiz.votos.relatoB, undefined);
  assert.equal(resultado.raiz.relatos.relatoB.votos, 0);
  assert.equal(resultado.raiz.relatosResumo.relatoB.votos, 0);
  assert.equal(resultado.raiz.relatosPublicos.relatoB.votos, 0);
  assert.equal(resultado.raiz.relatosMapa["2507507"].relatoB.votos, 0);
  assert.deepEqual(resultado.contagens, { relatosAnonimizados: 1, contatosRemovidos: 1, votosRemovidos: 1 });
  assert.equal(resultado.raiz.usuarios.outra.nome, "Outra");
});

test("exclusão exige autenticação feita nos últimos dez minutos", () => {
  const agora = 1_800_000_000_000;
  assert.equal(autenticacaoRecente({ auth_time: agora / 1000 - 599 }, agora), true);
  assert.equal(autenticacaoRecente({ auth_time: agora / 1000 - 601 }, agora), false);
  assert.equal(autenticacaoRecente({}, agora), false);
});
