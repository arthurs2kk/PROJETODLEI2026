'use strict';

// Workaround for https://github.com/auth0/node-jwks-rsa/issues/507.
// Keep jose 6 and its verification logic; only load this ESM dependency with import().
// Remove once jwks-rsa ships the upstream fix, after running test:runtime.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const firebaseRequire = createRequire(require.resolve('firebase-admin/auth'));
const packagePath = firebaseRequire.resolve('jwks-rsa/package.json');
const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (packageInfo.version !== '4.1.0') {
  throw new Error('Revisar compatibilidade de jwks-rsa: versão diferente de 4.1.0.');
}

const patches = [
  ['src/utils.js', [
    ["const jose = require('jose');\n", ''],
    ['async function retrieveSigningKeys(jwks) {',
      "async function retrieveSigningKeys(jwks) {\n  const jose = await import('jose');"]
  ]],
  ['src/integrations/passport.js', [
    ["const jose = require('jose');\n", ''],
    ['return function secretProvider(req, rawJwtToken, cb) {',
      'return async function secretProvider(req, rawJwtToken, cb) {'],
    ['    try {\n      decoded = {',
      "    try {\n      const jose = await import('jose');\n      decoded = {"]
  ]]
];

// Validate all files before writing. Repeated installs are safe; unexpected source
// changes fail the build instead of silently omitting the compatibility fix.
const marker = '// pro-povo: jose ESM compatibility\n';
const changes = patches.map(([relativePath, replacements]) => {
  const filename = path.join(path.dirname(packagePath), relativePath);
  let source = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n');
  if (source.startsWith(marker)) return null;
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) {
      throw new Error(`Revisar patch de compatibilidade: ${relativePath}`);
    }
    source = source.replace(before, after);
  }
  return { filename, source: marker + source };
});
for (const change of changes) {
  if (change) fs.writeFileSync(change.filename, change.source);
}
console.log('Compatibilidade ESM de jwks-rsa aplicada.');
