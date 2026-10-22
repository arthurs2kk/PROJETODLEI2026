const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('manifesto PWA contém identidade, modo standalone e ícones essenciais', async () => {
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.lang, 'pt-BR');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

test('service worker não intercepta APIs e possui fallback offline', async () => {
  const worker = await read('sw.js');
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(worker, /caches\.match\('\/offline\.html'\)/);
  assert.match(worker, /request\.mode === 'navigate'/);
});

test('todas as páginas públicas e administrativas carregam a base PWA', async () => {
  const pages = [
    'index.html',
    'pages/userPages/login.html',
    'pages/userPages/comoUsar.html',
    'pages/userPages/privacidade.html',
    'pages/userPages/termos.html',
    'pages/userPages/MeusRelatos.html',
    'pages/userPages/mapa.html',
    'pages/userPages/relatos.html',
    'pages/admPages/AdmLogin.html',
    'pages/admPages/AdminPage.html',
    'pages/admPages/AdminGraficos.html'
  ];

  for (const page of pages) {
    const html = await read(page);
    assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/, page);
    assert.match(html, /src="\/js\/pwa\.js"/, page);
    assert.match(html, /name="theme-color"/, page);
  }
});
