'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const { createRequire } = require('node:module');

// Run with --no-experimental-require-module to reproduce the Vercel crash.
for (const name of ['relatos', 'conta']) {
  test(`${name}: inicia e responde sem require síncrono de ESM`, async () => {
    const handler = require(`../api/${name}.js`);
    const response = {
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await handler({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 405);
  });
}

test('JWKS continua verificando assinaturas e rejeitando assinatura falsa', async () => {
  const firebaseRequire = createRequire(require.resolve('firebase-admin/auth'));
  const jwks = firebaseRequire('jwks-rsa');
  const jwt = firebaseRequire('jsonwebtoken');
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'teste', alg: 'RS256', use: 'sig' };
  const client = jwks({ jwksUri: 'https://example.invalid/jwks', fetcher: async () => ({ keys: [jwk] }) });
  const key = await client.getSigningKey('teste');
  const token = jwt.sign({ sub: 'teste' }, privateKey, { algorithm: 'RS256', keyid: 'teste' });
  assert.equal(jwt.verify(token, key.getPublicKey(), { algorithms: ['RS256'] }).sub, 'teste');
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const forged = jwt.sign({ sub: 'teste' }, other.privateKey, { algorithm: 'RS256', keyid: 'teste' });
  assert.throws(() => jwt.verify(forged, key.getPublicKey(), { algorithms: ['RS256'] }), /invalid signature/);

  const provider = jwks.passportJwtSecret({ jwksUri: 'https://example.invalid/jwks', fetcher: async () => ({ keys: [jwk] }) });
  const passportKey = await new Promise((resolve, reject) => provider({}, token, (err, result) => err ? reject(err) : resolve(result)));
  assert.equal(passportKey, key.getPublicKey());
  const invalidKey = await new Promise((resolve, reject) => provider({}, 'invalid', (err, result) => err ? reject(err) : resolve(result)));
  assert.equal(invalidKey, null);
});
