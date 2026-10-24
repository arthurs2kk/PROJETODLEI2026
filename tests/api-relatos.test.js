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

test('gera public_id do relato sem expor o UID do usuário', () => {
  assert.equal(
    publicIdEsperado('-OabcDEF01234567890x'),
    'pro_povo/relatos/-OabcDEF01234567890x'
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
  assert.equal(podeExcluirRelato('gestor', { ...relato, cityId: 2507507 }, admin), true);
  assert.equal(podeExcluirRelato('gestor', relato, { ...admin, cityId: 2507507 }), true);
  assert.equal(podeExcluirRelato('gestor', relato, { ...admin, cityId: '2513703' }), false);
  assert.equal(podeExcluirRelato('gestor', { ...relato, cityId: undefined }, { ...admin, cityId: undefined }), false);
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
function apiIsolada({ uid = 'autor', relato, admin = null, falharGravacao = false, imagemStatus = 200, imagemResultado = { result: 'ok' } }) {
  const atualizacoes = [];
  const chamadasImagem = [];
  const logs = [];
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
    cloudinary: { v2: { config() {}, utils: { api_sign_request(params, secret) {
      assert.equal(secret, 'segredo-teste');
      assert.equal(params.invalidate, true);
      return 'assinatura-teste';
    } } } }
  };
  const contexto = vm.createContext({
    module: { exports: {} },
    require: nome => {
      assert.ok(Object.hasOwn(dependencias, nome), `Dependência inesperada: ${nome}`);
      return dependencias[nome];
    },
    process: { env: { CLOUDINARY_API_KEY: 'chave-teste', CLOUDINARY_API_SECRET: 'segredo-teste' } },
    console: { error(...args) { logs.push(args); } },
    fetch: async (url, options) => {
      chamadasImagem.push({ url, options });
      return { ok: imagemStatus === 200, status: imagemStatus, headers: new Map([['x-request-id', 'request-teste']]), json: async () => imagemResultado };
    },
    Buffer, URL, URLSearchParams, AbortSignal
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../api/relatos.js'), 'utf8'), contexto);
  return {
    atualizacoes,
    chamadasImagem,
    logs,
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

test('API exclui relato, resumo, marcador, prioridade, denúncias, votos e contato em um único update', async () => {
  for (const cityId of ['2507507', 2504009]) {
    const api = apiIsolada({ relato: { autorId: 'autor', status: 'aberto', cityId } });
    const resposta = await api.excluir();
    assert.equal(resposta.codigo, 200);
    assert.deepEqual(api.atualizacoes, [{
      'relatos/-OabcDEF01234567890x': null,
      'relatosResumo/-OabcDEF01234567890x': null,
      'relatosPublicos/-OabcDEF01234567890x': null,
      [`relatosMapa/${cityId}/-OabcDEF01234567890x`]: null,
      [`prioridadesMunicipais/${cityId}/-OabcDEF01234567890x`]: null,
      [`denunciasRelatos/${cityId}/-OabcDEF01234567890x`]: null,
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

const relatoComFoto = {
  autorId: 'autor', status: 'aberto', cityId: '2504009',
  fotoUrl: 'https://res.cloudinary.com/dk8uky6m/image/upload/v1/pro_povo/relatos/-OabcDEF01234567890x.jpg',
  fotoPublicId: 'pro_povo/relatos/-OabcDEF01234567890x'
};

test('exclusão assina somente a imagem autorizada e aguarda confirmação do Cloudinary', async () => {
  for (const result of ['ok', 'not found']) {
    const api = apiIsolada({ relato: relatoComFoto, imagemResultado: { result } });
    const resposta = await api.excluir();
    assert.equal(resposta.codigo, 200);
    assert.equal(api.atualizacoes.length, 1);
    assert.equal(api.chamadasImagem.length, 1);
    const { url, options } = api.chamadasImagem[0];
    assert.equal(url, 'https://api.cloudinary.com/v1_1/dk8uky6m/image/destroy');
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('public_id'), relatoComFoto.fotoPublicId);
    assert.equal(options.body.get('invalidate'), 'true');
    assert.equal(options.body.get('signature'), 'assinatura-teste');
    assert.equal(options.body.has('api_secret'), false);
  }
});

test('recusa 403 do Cloudinary preserva o relato e não expõe credenciais', async () => {
  const api = apiIsolada({ relato: relatoComFoto, imagemStatus: 403,
    imagemResultado: { error: { message: 'Denied segredo-teste chave-teste assinatura-teste' } } });
  const resposta = await api.excluir();
  assert.equal(resposta.codigo, 502);
  assert.equal(resposta.corpo.codigo, 'CLOUDINARY_INDISPONIVEL');
  assert.deepEqual(api.atualizacoes, []);
  assert.doesNotMatch(JSON.stringify([resposta.corpo, api.logs]), /segredo-teste|chave-teste|assinatura-teste/);
  assert.match(JSON.stringify(api.logs), /request-teste/);
});

test('resposta sem confirmação não apaga os dados e permissão é verificada antes da imagem', async () => {
  const semConfirmacao = apiIsolada({ relato: relatoComFoto, imagemResultado: { result: 'unexpected' } });
  assert.equal((await semConfirmacao.excluir()).codigo, 502);
  assert.deepEqual(semConfirmacao.atualizacoes, []);
  const semPermissao = apiIsolada({ uid: 'outro', relato: relatoComFoto });
  assert.equal((await semPermissao.excluir()).codigo, 403);
  assert.deepEqual(semPermissao.chamadasImagem, []);
});

test('permissão insuficiente na chave do Cloudinary gera aviso específico e preserva o relato', async () => {
  const api = apiIsolada({ relato: relatoComFoto, imagemStatus: 403,
    imagemResultado: { error: { message: 'Request forbidden due to missing permissions (actions=["delete"])' } } });
  const resposta = await api.excluir();
  assert.equal(resposta.codigo, 502);
  assert.equal(resposta.corpo.codigo, 'CLOUDINARY_SEM_PERMISSAO');
  assert.deepEqual(api.atualizacoes, []);
});
