const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extrairPublicIdCloudinary,
  podeExcluirRelato,
  publicIdEsperado,
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
