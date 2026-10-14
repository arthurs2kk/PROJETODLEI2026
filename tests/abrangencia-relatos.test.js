'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { configurarAbrangencia } = require('../scripts/configurar-abrangencia-relatos.js');

const moduloAtual = fs.readFileSync(path.join(__dirname, '..', 'js', 'abrangencia-relatos.js'), 'utf8');
const regrasAtuais = fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8');

async function carregar(texto) {
  const modulo = new vm.SourceTextModule(texto);
  await modulo.link(() => { throw new Error('import inesperado'); });
  await modulo.evaluate();
  return modulo.namespace;
}

test('configuração e regras versionadas estão sincronizadas e comando é idempotente', () => {
  const regras = JSON.parse(regrasAtuais);
  assert.equal(configurarAbrangencia(moduloAtual, regras, 'campina-grande'), moduloAtual);
  assert.deepEqual(regras, JSON.parse(regrasAtuais));
});

test('reversão libera municípios da Paraíba e reativação restaura exatamente as regras', async () => {
  const regras = JSON.parse(regrasAtuais);
  const moduloPB = configurarAbrangencia(moduloAtual, regras, 'paraiba');
  const abrangenciaPB = await carregar(moduloPB);
  assert.equal(abrangenciaPB.AREA_RELATOS, 'Paraíba');
  assert.equal(abrangenciaPB.municipioAceitoParaRelato('2507507', 'João Pessoa'), true);
  assert.equal(abrangenciaPB.municipioAceitoParaRelato('2503100', 'Cabaceiras'), true);
  assert.equal(abrangenciaPB.municipioAceitoParaRelato('3550308', 'São Paulo'), false);
  assert.equal(regras.rules.relatos.$relatoId['.validate'].includes("=== '2504009'"), false);
  assert.equal(configurarAbrangencia(moduloPB, regras, 'campina-grande'), moduloAtual);
  assert.deepEqual(regras, JSON.parse(regrasAtuais));
});

test('abrangência exige código e nome de Campina Grande consistentes', async () => {
  const abrangencia = await carregar(moduloAtual);
  assert.equal(abrangencia.municipioAceitoParaRelato('2504009', 'Campina Grande'), true);
  for (const [id, nome] of [['2507507', 'João Pessoa'], ['2503100', 'Cabaceiras'], ['2504009', 'Cabaceiras'], ['2507507', 'Campina Grande'], [null, null]]) {
    assert.equal(abrangencia.municipioAceitoParaRelato(id, nome), false);
  }
});

test('comando inválido não altera as regras', () => {
  const regras = JSON.parse(regrasAtuais);
  assert.throws(() => configurarAbrangencia(moduloAtual, regras, 'qualquer'), /Use:/);
  assert.deepEqual(regras, JSON.parse(regrasAtuais));
});
