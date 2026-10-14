'use strict';

const fs = require('node:fs');
const path = require('node:path');

// A exceção para data.exists() preserva edição, voto e gestão dos relatos antigos.
const RESTRICAO = "(data.exists() || (newData.child('cityId').val() === '2504009' && newData.child('cidade').val() === 'Campina Grande')) && ";

function configurarAbrangencia(modulo, regras, escopo) {
  if (!['campina-grande', 'paraiba'].includes(escopo)) {
    throw new Error('Use: npm run abrangencia:relatos -- campina-grande|paraiba');
  }
  const padrao = /export const RESTRINGIR_RELATOS_A_CAMPINA_GRANDE = (true|false);/;
  if (!padrao.test(modulo)) throw new Error('Configuração de abrangência não encontrada.');
  const restringir = escopo === 'campina-grande';
  const validacao = regras.rules.relatos.$relatoId['.validate'];
  const semRestricao = validacao.startsWith(RESTRICAO) ? validacao.slice(RESTRICAO.length) : validacao;
  regras.rules.relatos.$relatoId['.validate'] = (restringir ? RESTRICAO : '') + semRestricao;
  return modulo.replace(padrao, `export const RESTRINGIR_RELATOS_A_CAMPINA_GRANDE = ${restringir};`);
}

if (require.main === module) {
  try {
    const raiz = path.resolve(__dirname, '..');
    const arquivoModulo = path.join(raiz, 'js', 'abrangencia-relatos.js');
    const arquivoRegras = path.join(raiz, 'database.rules.json');
    const textoRegras = fs.readFileSync(arquivoRegras, 'utf8');
    const regras = JSON.parse(textoRegras);
    const anterior = regras.rules.relatos.$relatoId['.validate'];
    const modulo = configurarAbrangencia(fs.readFileSync(arquivoModulo, 'utf8'), regras, process.argv[2]);
    // Preserva a formatação das regras e altera somente a expressão necessária.
    const atualizado = textoRegras.replace(JSON.stringify(anterior), JSON.stringify(regras.rules.relatos.$relatoId['.validate']));
    fs.writeFileSync(arquivoModulo, modulo);
    fs.writeFileSync(arquivoRegras, atualizado);
    console.log(`Abrangência configurada: ${process.argv[2]}. Publique o site e as regras do Firebase para aplicar.`);
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}

module.exports = { configurarAbrangencia };
