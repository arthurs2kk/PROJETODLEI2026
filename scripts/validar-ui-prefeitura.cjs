// Validação isolada: intercepta os módulos de dados no navegador; não acessa Firebase/API/e-mail.
// Dependências opcionais: playwright, @axe-core/playwright, leaflet e chart.js (ver docs/analise-ui-prefeitura.md).
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const raiz = path.resolve(__dirname, '..');
const saida = path.join(raiz, 'tmp/ui-prefeitura');
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const categorias = ['Buraco / Via danificada', 'Iluminação pública', 'Lixo / Entulho', 'Água / Esgoto', 'Áreas verdes', 'Outros'];
const relatos = Array.from({ length: 32 }, (_, i) => ({
  id: `teste-${i}`, titulo: `Demanda municipal ${i}`, descricao: `Descrição detalhada da demanda ${i}.\nInformação complementar enviada pelo cidadão.`,
  endereco: `Rua de exemplo ${i}, ${i % 2 ? 'Catolé' : 'Centro'}`, bairro: i % 2 ? 'Catolé' : 'Centro',
  categoria: categorias[i % 6], status: ['aberto', 'andamento', 'resolvido'][i % 3], cityId: '2504009', cidade: 'Campina Grande',
  autorId: 'cidadao-teste', autorNome: 'Cidadão de exemplo', dataCriacao: Date.now() - i * 86400000,
  votos: i, lat: i === 31 ? null : -7.23 + (i % 6) * .003, lng: i === 31 ? null : -35.88 + Math.floor(i / 6) * .003,
  ...(i === 0 ? { fotoUrl: 'https://res.cloudinary.com/dk8uky6m/image/upload/exemplo.png' } : {})
}));
const fixture = `
export const relatos = ${JSON.stringify(relatos)};
export const prioridades = { '2504009/teste-0': { ordem: 1 }, '2504009/teste-30': { ordem: 2 } };
export const esperar = () => new Promise(r => setTimeout(r, window.__demora || 30));
export function verificar() { if (window.__falhar) throw Error('Falha simulada'); }
export function avisar() { window.dispatchEvent(new Event('prioridades-teste')); }
`;
const modulos = {
  '/fixture.js': fixture,
  '/js/firebase.js': `export const auth={currentUser:{uid:'gestor-teste'}}; export const onAuthStateChanged=(_,cb)=>{setTimeout(()=>cb({uid:'gestor-teste',displayName:'Gestor de exemplo',email:'gestor@example.invalid'}),0);return()=>{}}; export const signOut=async()=>{}; export const signInWithEmailAndPassword=async()=>{throw {code:'auth/invalid-credential'}};`,
  '/js/admJS/adminAuth.js': `export const buscarAdmin=async()=>{if(sessionStorage.getItem('falharAcesso'))throw Error('offline');return {papel:sessionStorage.getItem('superadmin')?'superadmin':'admin',cityId:'2504009',organizacaoId:'prefeitura-teste'}}; export const ehSuperAdmin=a=>a?.papel==='superadmin';`,
  '/js/db.js': `import {relatos,esperar,verificar} from '/fixture.js'; export const buscarOrganizacao=async()=>({nome:'Prefeitura de exemplo',cidadeNome:'Campina Grande'}); export const buscarRelatosGestaoPagina=async(_,cursor)=>{await esperar();verificar();return {itens:relatos.slice(cursor?25:0,cursor?32:25).map(r=>({...r})),temMais:!cursor}}; export const buscarTodosRelatosGestao=async(_,progresso)=>{await esperar();verificar();progresso?.(32);return relatos.map(r=>({...r}))}; export const buscarContatoRelato=async()=>null; export const atualizarStatus=async(id,status)=>{await esperar();verificar();Object.assign(relatos.find(r=>r.id===id),{status})}; export const salvarResposta=async(id,respostaOficial)=>{await esperar();verificar();Object.assign(relatos.find(r=>r.id===id),{respostaOficial})}; export const excluirRelato=async id=>{await esperar();verificar();relatos.splice(relatos.findIndex(r=>r.id===id),1)};`,
  '/js/admJS/prioridades.js': `import {prioridades,esperar,verificar,avisar} from '/fixture.js'; export const ouvirPrioridades=(_,cb,erro)=>{const fn=()=>window.__falharPrioridades?erro(Error('offline')):cb({...prioridades});queueMicrotask(fn);window.addEventListener('prioridades-teste',fn);return()=>window.removeEventListener('prioridades-teste',fn)}; export const salvarPrioridade=async(r,_,ordem)=>{await esperar();verificar();prioridades[r.cityId+'/'+r.id]={ordem};avisar()}; export const removerPrioridade=async r=>{await esperar();verificar();delete prioridades[r.cityId+'/'+r.id];avisar()}; export const definirOrdemPrioridades=async lista=>{await esperar();verificar();lista.forEach((r,i)=>prioridades[r.cityId+'/'+r.id].ordem=i);avisar()};`,
  '/js/notificacoes.js': `export const notificarMudancaStatus=async()=>true;export const notificarNovaResposta=async()=>true;`,
  '/js/populacao.js': `export const normalizar=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(); export const obterPopulacaoPB=async()=>{await new Promise(r=>setTimeout(r,100));return new Map([['campina grande',400000]])};`
};

async function preparar(context) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      if (modulos[url.pathname]) return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: modulos[url.pathname] });
      return route.continue();
    }
    if (url.pathname.endsWith('/leaflet.js')) return route.fulfill({ contentType: 'text/javascript', path: require.resolve('leaflet') });
    if (url.pathname.endsWith('/leaflet.css')) return route.fulfill({ contentType: 'text/css', path: path.join(path.dirname(require.resolve('leaflet')), 'leaflet.css') });
    if (url.pathname.endsWith('/chart.umd.min.js')) return route.fulfill({ contentType: 'text/javascript', path: path.resolve(path.dirname(require.resolve('chart.js/auto')), '../dist/chart.umd.js') });
    // Imagens sintéticas e mapa neutro: nenhuma localização ou foto real é enviada para terceiros.
    if (url.hostname.includes('tile.openstreetmap') || url.hostname.includes('cloudinary')) return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGbcAAAAASUVORK5CYII=', 'base64') });
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: [400, 500, 600, 700].map(peso => `@font-face{font-family:'Noto Sans';font-style:normal;font-weight:${peso};src:url(https://assets.example.invalid/noto-${peso}.woff2) format('woff2')}`).join('\n') });
    if (url.hostname === 'assets.example.invalid') {
      const peso = url.pathname.match(/noto-(\d+)/)?.[1];
      return route.fulfill({ contentType: 'font/woff2', path: require.resolve(`@fontsource/noto-sans/files/noto-sans-latin-${peso}-normal.woff2`) });
    }
    if (url.pathname.includes('/@tabler/icons-webfont@')) {
      const dist = path.join(path.dirname(require.resolve('@tabler/icons-webfont/package.json')), 'dist');
      return route.fulfill({ path: url.pathname.endsWith('.css') ? path.join(dist, 'tabler-icons.min.css') : path.join(dist, 'fonts', path.basename(url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'font/woff2' });
    }
    return route.fulfill({ body: '', contentType: 'text/javascript' });
  });
}

async function main() {
  fs.mkdirSync(saida, { recursive: true });
  const servidor = http.createServer((req, res) => {
    const arquivo = path.resolve(raiz, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!arquivo.startsWith(raiz + path.sep) || !fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', `${tipos[path.extname(arquivo)] || 'application/octet-stream'}; charset=utf-8`);
    fs.createReadStream(arquivo).pipe(res);
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}/pages/admPages/`;
  const browser = await chromium.launch({ channel: process.env.UI_BROWSER || 'chrome', headless: true });
  const resultados = [];
  const erros = [];
  const conferir = async (nome, fn) => { await fn(); resultados.push(nome); console.log('OK', nome); };
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce' });
  await preparar(contexto);
  const page = await contexto.newPage();
  page.on('pageerror', erro => erros.push(erro.message));
  try {
    await page.goto(base + 'AdminPage.html');
    await page.locator('.gestao-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await conferir('Consulta completa e filtros identificados', async () => {
      assert.equal(await page.locator('.gestao-card').count(), 32);
      assert.match(await page.locator('#admin-resultados-ajuda').textContent(), /todos os relatos/i);
      await page.getByLabel('Busca', { exact: true }).fill('demanda municipal 1');
      assert.equal(await page.locator('.gestao-card').count(), 11);
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
      assert.equal(await page.locator('.gestao-card').count(), 32);
    });
    await conferir('Rascunho preservado, limite e foco da resposta', async () => {
      await page.locator('#btn-resp-teste-0').click();
      const campo = page.locator('#resp-texto-teste-0');
      await campo.fill('Resposta de teste com informação pública.');
      assert.equal(await campo.getAttribute('maxlength'), '2000');
      await page.getByRole('tab', { name: /Mapa/ }).click();
      await page.locator('#admin-mapa canvas').waitFor();
      await page.getByRole('tab', { name: 'Todos os relatos' }).click();
      assert.equal(await campo.inputValue(), 'Resposta de teste com informação pública.');
      assert.equal(await page.locator('.gestao-card').count(), 32);
    });
    await conferir('Resposta salva uma vez com feedback e notificação independente', async () => {
      await page.evaluate(() => { window.__demora = 150; });
      await page.locator('#btn-resp-salvar-teste-0').click();
      assert.equal(await page.locator('#btn-resp-salvar-teste-0').isDisabled(), true);
      await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Resposta salva'));
      assert.match(await page.locator('#toast').textContent(), /e-mail não foi enviado/);
    });
    await conferir('Foto abre por teclado e devolve foco ao fechar', async () => {
      await page.locator('#foto-teste-0').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#lightbox-overlay').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#foto-teste-0').evaluate(e => e === document.activeElement), true);
    });
    await conferir('Mapa integra filtros, lista acessível e gestão de relatos antigos', async () => {
      await page.locator('#btn-mapa-teste-30').click();
      await page.locator('.leaflet-popup').waitFor();
      assert.match(await page.locator('.leaflet-popup').textContent(), /Demanda municipal 30/);
      await page.getByRole('button', { name: 'Abrir gestão do relato' }).click();
      assert.equal(await page.locator('#relato-teste-30').evaluate(e => e === document.activeElement), true);
      await page.getByRole('tab', { name: /Mapa/ }).click();
      assert.match(await page.locator('#admin-mapa-info').textContent(), /31 de 32/);
      for (const tipo of ['status', 'apoio', 'concentracao', 'categoria']) await page.locator('#admin-mapa-tipo').selectOption(tipo);
      await page.locator('.admin-mapa-alternativa summary').click();
      assert.equal(await page.locator('#admin-mapa-lista li').count(), 32);
      assert.equal(await page.locator('#mapa-localizar-teste-31').isDisabled(), true);
      await page.locator('#mapa-gestao-teste-31').click();
      assert.equal(await page.locator('#relato-teste-31').isVisible(), true);
    });
    await conferir('Mapa vazio tem orientação e filtros são recuperáveis', async () => {
      await page.getByRole('tab', { name: /Mapa/ }).click();
      await page.locator('#busca-input').fill('inexistente');
      assert.equal(await page.locator('#admin-mapa-vazio').isVisible(), true);
      assert.equal(await page.locator('#admin-mapa-enquadrar').isDisabled(), true);
      await page.locator('#btn-limpar-filtros').click();
      assert.equal(await page.locator('#admin-mapa-vazio').isVisible(), false);
    });
    await conferir('Priorizar pelo mapa mantém o popup e atualiza a ação', async () => {
      await page.locator('#mapa-localizar-teste-1').click();
      await page.locator('.leaflet-popup').getByRole('button', { name: 'Adicionar às prioridades' }).click();
      await page.waitForFunction(() => document.querySelector('.leaflet-popup')?.textContent.includes('Remover das prioridades') && !document.querySelector('.leaflet-popup button:last-child').disabled);
      await page.locator('.leaflet-popup').getByRole('button', { name: 'Remover das prioridades' }).click();
      await page.waitForFunction(() => document.querySelector('.leaflet-popup')?.textContent.includes('Adicionar às prioridades') && !document.querySelector('.leaflet-popup button:last-child').disabled);
    });
    await conferir('Prioridades preservam seleção e reordenam sem perder foco', async () => {
      await page.getByRole('tab', { name: /Prioridades/ }).click();
      assert.equal(await page.locator('.gestao-card').count(), 2);
      await page.locator('#btn-subir-teste-30').click();
      await page.waitForFunction(() => document.querySelector('.gestao-card')?.id === 'relato-teste-30');
      await page.waitForFunction(() => document.activeElement?.id === 'relato-teste-30');
      await page.locator('#busca-input').fill('Demanda');
      assert.equal(await page.locator('#btn-subir-teste-0').isDisabled(), true);
      await page.locator('#btn-limpar-filtros').click();
    });
    await conferir('Falha ao atualizar mantém dados e permite nova tentativa', async () => {
      await page.evaluate(() => { window.__falhar = true; });
      await page.locator('#btn-atualizar-relatos').click();
      await page.waitForFunction(() => !document.getElementById('admin-dados-aviso').hidden && document.getElementById('admin-dados-aviso').textContent.includes('Não foi possível'));
      assert.equal(await page.locator('.gestao-card').count(), 2);
      await page.evaluate(() => { window.__falhar = false; });
      await page.locator('#btn-atualizar-relatos').click();
      await page.waitForFunction(() => document.getElementById('admin-dados-aviso').hidden);
    });
    await page.getByRole('tab', { name: 'Todos os relatos' }).click();
    await conferir('Situação salva e revertida visualmente em falha', async () => {
      await page.locator('#status-teste-0').selectOption('andamento');
      await page.waitForFunction(() => !document.getElementById('status-teste-0').disabled);
      assert.equal(await page.locator('#status-teste-0').inputValue(), 'andamento');
      await page.evaluate(() => { window.__falhar = true; });
      await page.locator('#status-teste-0').selectOption('resolvido');
      await page.waitForFunction(() => !document.getElementById('status-teste-0').disabled);
      assert.equal(await page.locator('#status-teste-0').inputValue(), 'andamento');
      await page.evaluate(() => { window.__falhar = false; });
    });
    await conferir('Abas acessíveis por setas e menu móvel por Escape', async () => {
      await page.locator('#aba-relatos').focus();
      await page.keyboard.press('End');
      assert.equal(await page.locator('#aba-prioridades').getAttribute('aria-selected'), 'true');
      await page.keyboard.press('Home');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#hamburger').click();
      assert.equal(await page.locator('#hamburger').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#hamburger').evaluate(e => e === document.activeElement), true);
    });
    await page.locator('#toast').evaluate(e => e.classList.remove('show'));
    for (const tema of ['light', 'dark']) {
      await page.evaluate(tema => { localStorage.setItem('theme', tema); document.documentElement.dataset.theme = tema; }, tema);
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await conferir(`Gestão sem rolagem horizontal em ${width}px / ${tema}`, async () => {
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(saida, `gestao-${tema}-mobile.png`) });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: path.join(saida, `gestao-${tema}-desktop.png`) });
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      fs.writeFileSync(path.join(saida, `acessibilidade-gestao-${tema}.json`), JSON.stringify(axe.violations, null, 2));
      assert.deepEqual(axe.violations.map(v => v.id), [], `Acessibilidade da gestão no tema ${tema}`);
      resultados.push(`Auditoria axe gestão ${tema}: ${axe.violations.length} ocorrência(s)`);
    }
    // Nova carga para as capturas: evita estados de foco transitórios da auditoria anterior.
    await page.reload();
    await page.locator('.gestao-card').first().waitFor();
    await page.getByRole('tab', { name: /Mapa/ }).click();
    await page.locator('#admin-mapa canvas').waitFor();
    await page.locator('#admin-mapa-enquadrar').click();
    await page.locator('#painel-mapa').screenshot({ path: path.join(saida, 'mapa-desktop.png') });
    await conferir('Mapa e controles cabem em tablets e smartphones', async () => {
      for (const width of [768, 390, 320]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.locator('#admin-mapa-enquadrar').click();
      await page.locator('#painel-mapa').screenshot({ path: path.join(saida, 'mapa-mobile.png') });
    });
    const axeMapa = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    fs.writeFileSync(path.join(saida, 'acessibilidade-mapa.json'), JSON.stringify(axeMapa.violations, null, 2));
    assert.deepEqual(axeMapa.violations.map(v => v.id), [], 'Acessibilidade do mapa');
    await page.goto(base + 'AdminGraficos.html');
    await page.waitForFunction(() => !document.getElementById('btn-baixar-csv').disabled);
    await conferir('Admin municipal inicia com bairros e tem tabela equivalente', async () => {
      assert.equal(await page.locator('#grafico-tipo').inputValue(), 'bairros');
      await page.locator('.graf-tabela-dados summary').click();
      assert.equal(await page.locator('#graf-tabela tbody tr').count(), 2);
      for (const tipo of ['categorias', 'status', 'evolucao', 'bairros']) {
        await page.locator('#grafico-tipo').selectOption(tipo);
        assert.equal(await page.locator('#btn-baixar-png').isDisabled(), false);
        assert.ok(await page.locator('#graf-tabela tbody tr').count());
      }
      const download = page.waitForEvent('download');
      await page.locator('#btn-baixar-csv').click();
      assert.match((await download).suggestedFilename(), /\.csv$/);
      const png = page.waitForEvent('download');
      await page.locator('#btn-baixar-png').click();
      assert.match((await png).suggestedFilename(), /\.png$/);
    });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elementos: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => [e.tagName, e.className, e.getBoundingClientRect().right]).slice(0, 12) }));
      assert.equal(overflow.scroll <= width, true, JSON.stringify(overflow));
    }
    await page.locator('#toast').evaluate(e => e.classList.remove('show'));
    await page.screenshot({ path: path.join(saida, 'graficos-mobile.png'), fullPage: true });
    const axeGraf = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    fs.writeFileSync(path.join(saida, 'acessibilidade-graficos.json'), JSON.stringify(axeGraf.violations, null, 2));
    assert.deepEqual(axeGraf.violations.map(v => v.id), [], 'Acessibilidade dos gráficos');
    await conferir('Gráficos acompanham o tema claro com contraste acessível', async () => {
      await page.evaluate(() => { localStorage.setItem('theme', 'light'); document.documentElement.dataset.theme = 'light'; });
      await page.waitForFunction(() => !document.getElementById('btn-baixar-png').disabled);
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(axe.violations.map(v => v.id), []);
      fs.writeFileSync(path.join(saida, 'acessibilidade-graficos-light.json'), JSON.stringify(axe.violations, null, 2));
    });
    await conferir('Superadmin mantém comparação de cidades e troca rápida de análise', async () => {
      await page.evaluate(() => sessionStorage.setItem('superadmin', 'true'));
      await page.reload();
      await page.waitForFunction(() => !document.getElementById('grafico-tipo').disabled);
      await page.locator('#grafico-tipo').selectOption('categorias');
      await page.waitForFunction(() => document.getElementById('grafico-canvas').getAttribute('aria-label') === 'Tipos de problema mais comuns');
      assert.equal(await page.locator('#grafico-tipo option[value=cidades]').count(), 1);
    });
    await page.goto(base + 'AdmLogin.html');
    await conferir('Login com Enter, rótulos associados e erro persistente', async () => {
      await page.getByLabel('E-mail institucional').fill('teste@example.invalid');
      await page.getByLabel(/^Senha/).fill('senha-de-teste');
      await page.getByRole('button', { name: 'Mostrar senha' }).click();
      assert.equal(await page.getByRole('button', { name: 'Ocultar senha' }).getAttribute('aria-pressed'), 'true');
      await page.getByLabel(/^Senha/).press('Enter');
      await page.locator('#admin-login-erro').waitFor();
      assert.match(await page.locator('#admin-login-erro').textContent(), /incorretos/);
    });
    const axeLogin = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Largura do login móvel');
    await page.screenshot({ path: path.join(saida, 'login-mobile.png'), fullPage: true });
    fs.writeFileSync(path.join(saida, 'acessibilidade-login.json'), JSON.stringify(axeLogin.violations, null, 2));
    assert.deepEqual(axeLogin.violations.map(v => v.id), [], 'Acessibilidade do login');
    await page.evaluate(() => { localStorage.setItem('theme', 'dark'); document.documentElement.dataset.theme = 'dark'; });
    const axeLoginDark = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    fs.writeFileSync(path.join(saida, 'acessibilidade-login-dark.json'), JSON.stringify(axeLoginDark.violations, null, 2));
    assert.deepEqual(axeLoginDark.violations.map(v => v.id), [], 'Acessibilidade do login escuro');
    await conferir('Falha de conexão ao verificar acesso oferece recuperação', async () => {
      await page.evaluate(() => sessionStorage.setItem('falharAcesso', 'true'));
      await page.goto(base + 'AdminPage.html');
      await page.locator('#verificando button').waitFor();
      assert.equal(await page.locator('#painel-conteudo').isVisible(), false);
      await page.evaluate(() => sessionStorage.removeItem('falharAcesso'));
      await page.locator('#verificando button').click();
      await page.locator('.gestao-card').first().waitFor();
    });
    assert.deepEqual(erros, [], 'Erros JavaScript no navegador');
    fs.writeFileSync(path.join(saida, 'validacao.json'), JSON.stringify({ resultados, erros }, null, 2));
    console.log(`${resultados.length} verificações concluídas. Artefatos: ${saida}`);
  } finally {
    await browser.close();
    await new Promise(r => servidor.close(r));
  }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
