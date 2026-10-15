const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  extrairPublicIdCloudinary,
  podeExcluirRelato,
  publicIdEsperado,
  validarCityIdMapa,
  validarRelatoId
} = require('../api/relatos.js')._internals;

test('gera um public_id isolado por usuário e relato', () => {
  assert.equal(
    publicIdEsperado('usuario_123', '-OabcDEF01234567890x'),
    'pro_povo/usuario_123/-OabcDEF01234567890x'
  );
});

test('extrai public_id de uma URL legada do Cloudinary', () => {
  assert.equal(
    extrairPublicIdCloudinary(
      'https://res.cloudinary.com/dk8uky6m/image/upload/v1785000000/pasta/foto_teste.jpg'
    ),
    'pasta/foto_teste'
  );
});

test('não aceita URL externa como imagem legada', () => {
  assert.equal(
    extrairPublicIdCloudinary('https://exemplo.com/dk8uky6m/image/upload/v1/foto.jpg'),
    null
  );
});

test('autor só pode excluir o próprio relato enquanto aberto', () => {
  const relato = { autorId: 'autor', status: 'aberto', cityId: '2507507' };
  assert.equal(podeExcluirRelato('autor', relato, null), true);
  assert.equal(podeExcluirRelato('outro', relato, null), false);
  assert.equal(podeExcluirRelato('autor', { ...relato, status: 'andamento' }, null), false);
});

test('administrador municipal respeita o escopo da cidade', () => {
  const relato = { autorId: 'autor', status: 'andamento', cityId: '2507507' };
  const admin = { ativo: true, papel: 'admin', cityId: '2507507' };
  assert.equal(podeExcluirRelato('gestor', relato, admin), true);
  assert.equal(podeExcluirRelato('gestor', relato, { ...admin, cityId: '2513703' }), false);
});

test('valida IDs push do Firebase', () => {
  assert.equal(validarRelatoId('-OabcDEF01234567890x'), '-OabcDEF01234567890x');
  assert.throws(() => validarRelatoId('../relato'));
});

test('valida o cityId usado no caminho do marcador', () => {
  assert.equal(validarCityIdMapa('2507507'), '2507507');
  assert.equal(validarCityIdMapa(2504009), '2504009');
  assert.throws(() => validarCityIdMapa('../relatos'), erro => erro.codigo === 'CIDADE_INCONSISTENTE');
});

// Executa o handler real com os SDKs isolados, sem rede ou credenciais.
function apiIsolada({ uid = 'autor', relato, admin = null, falharGravacao = false }) {
  const atualizacoes = [];
  const db = {
    ref(caminho) {
      return {
        async get() {
          const valor = caminho.startsWith('relatos/') ? relato : admin;
          return { exists: () => valor != null, val: () => valor };
        },
        async update(valores) {
          atualizacoes.push(JSON.parse(JSON.stringify(valores)));
          if (falharGravacao) throw new Error('Falha simulada de gravação');
        }
      };
    }
  };
  const dependencias = {
    'firebase-admin/app': { getApps: () => [{}] },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async () => ({ uid }) }) },
    'firebase-admin/database': { getDatabase: () => db },
    cloudinary: { v2: {} }
  };
  const contexto = vm.createContext({
    module: { exports: {} },
    require: nome => {
      assert.ok(Object.hasOwn(dependencias, nome), `Dependência inesperada: ${nome}`);
      return dependencias[nome];
    },
    process: { env: {} },
    console: { error() {} },
    Buffer, URL
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../api/relatos.js'), 'utf8'), contexto);
  return {
    atualizacoes,
    async excluir() {
      const resposta = { setHeader() {}, status(valor) { this.codigo = valor; return this; }, json(valor) { this.corpo = valor; } };
      await contexto.module.exports({
        method: 'POST',
        headers: { authorization: 'Bearer token-de-teste' },
        body: { acao: 'excluir', relatoId: '-OabcDEF01234567890x' }
      }, resposta);
      return resposta;
    }
  };
}

test('API exclui relato, resumo, marcador, prioridade, votos e contato em um único update', async () => {
  for (const cityId of ['2507507', 2504009]) {
    const api = apiIsolada({ relato: { autorId: 'autor', status: 'aberto', cityId } });
    const resposta = await api.excluir();
    assert.equal(resposta.codigo, 200);
    assert.deepEqual(api.atualizacoes, [{
      'relatos/-OabcDEF01234567890x': null,
      'relatosResumo/-OabcDEF01234567890x': null,
      [`relatosMapa/${cityId}/-OabcDEF01234567890x`]: null,
        [`prioridadesMunicipais/${cityId}/-OabcDEF01234567890x`]: null,
      'votos/-OabcDEF01234567890x': null,
      'contatosRelatos/-OabcDEF01234567890x': null
    }]);
  }
});

test('API não grava nenhum caminho quando o administrador é de outra cidade', async () => {
  const api = apiIsolada({
    uid: 'gestor',
    relato: { autorId: 'autor', status: 'aberto', cityId: '2507507' },
    admin: { ativo: true, papel: 'admin', cityId: '2504009' }
  });
  assert.equal((await api.excluir()).codigo, 403);
  assert.deepEqual(api.atualizacoes, []);
});

test('API não constrói um caminho de mapa a partir de cityId inconsistente', async () => {
  const api = apiIsolada({ relato: { autorId: 'autor', status: 'aberto', cityId: '../usuarios' } });
  assert.equal((await api.excluir()).codigo, 409);
  assert.deepEqual(api.atualizacoes, []);
});

test('API preserva exclusão idempotente e informa falha no update atômico', async () => {
  const ausente = apiIsolada({ relato: null });
  assert.equal((await ausente.excluir()).codigo, 200);
  assert.deepEqual(ausente.atualizacoes, []);
  const falha = apiIsolada({
    relato: { autorId: 'autor', status: 'aberto', cityId: '2507507' },
    falharGravacao: true
  });
  assert.equal((await falha.excluir()).codigo, 500);
  assert.equal(falha.atualizacoes.length, 1);
});
