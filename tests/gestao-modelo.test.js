const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function modelo() {
  const modulo = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../js/admJS/gestaoModelo.js'), 'utf8'));
  await modulo.link(() => { throw new Error('Dependência inesperada'); });
  await modulo.evaluate();
  return modulo.namespace;
}

const agora = 1800000000000;
const base = { cityId: '2504009', bairro: 'Centro', titulo: 'Poste apagado', endereco: 'Rua A', categoria: 'Iluminação pública', status: 'aberto', dataCriacao: agora - 20 * 86400000, lat: -7.23, lng: -35.88 };

test('filtros combinam município, bairro, categoria, situação e período sem confundir resolvido com atrasado', async () => {
  const { filtrarRelatos } = await modelo();
  const relatos = [
    { ...base, id: 'antigo' },
    { ...base, id: 'novo', dataCriacao: agora - 86400000 },
    { ...base, id: 'resolvido', status: 'resolvido' },
    { ...base, id: 'outraCidade', cityId: '2507507' },
    { ...base, id: 'outroBairro', bairro: 'Catolé' }
  ];
  const filtros = { cidade: '2504009', bairro: 'Centro', categoria: base.categoria, status: 'atrasados', busca: 'POSTE' };
  assert.deepEqual(Array.from(filtrarRelatos(relatos, filtros, agora), r => r.id), ['antigo']);
  assert.deepEqual(Array.from(filtrarRelatos(relatos, { ...filtros, status: 'todos', dias: '7' }, agora), r => r.id), ['novo']);
});

test('lista de prioridades inclui relatos antigos, respeita a ordem e isola a chave por município', async () => {
  const { ordenarPrioridades } = await modelo();
  const relatos = [{ ...base, id: 'antigo' }, { ...base, id: 'novo' }, { ...base, id: 'antigo', cityId: '2507507' }];
  const prioridades = { '2504009/antigo': { ordem: 20 }, '2504009/novo': { ordem: 10 } };
  assert.deepEqual(Array.from(ordenarPrioridades(relatos, prioridades), r => r.id), ['novo', 'antigo']);
});

test('busca tolera acentos, caixa e espaços sem ampliar o escopo dos demais filtros', async () => {
  const { filtrarRelatos } = await modelo();
  const relatos = [{ ...base, id: 'local', titulo: 'Árvore caída', endereco: 'Rua São João' }, { ...base, id: 'vizinho', titulo: 'Árvore caída', cityId: '2507507' }];
  assert.deepEqual(Array.from(filtrarRelatos(relatos, { busca: '  ARVORE  ', cidade: '2504009' }), r => r.id), ['local']);
  assert.deepEqual(Array.from(filtrarRelatos(relatos, { busca: 'sao joao' }), r => r.id), ['local']);
});

test('mapa de calor preserva coordenadas e conta cada ocorrência uma vez sem ponderar votos', async () => {
  const { pontosMapaCalor } = await modelo();
  const pontos = pontosMapaCalor([
    { ...base, votos: 500 }, { ...base, votos: 0 }, { ...base, lat: 200 },
    { ...base, lng: undefined }, { ...base, lat: '-7.23' }, { ...base, lat: -7.4 }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(pontos)), [
    [base.lat, base.lng, 1], [base.lat, base.lng, 1], [-7.4, base.lng, 1]
  ]);
  assert.equal(pontosMapaCalor([]).length, 0);
});

async function moduloPrioridades() {
  const gravacoes = [];
  const assinaturas = [];
  const firebase = {
    auth: { currentUser: { uid: 'gestor' } }, db: {},
    ref: (_, caminho = '') => caminho,
    serverTimestamp: () => ({ '.sv': 'timestamp' }),
    update: async (base, campos) => gravacoes.push({ base, campos }),
    onValue: (caminho, receber) => { assinaturas.push({ caminho, receber }); return () => {}; }
  };
  const modulo = new vm.SourceTextModule(fs.readFileSync(path.join(__dirname, '../js/admJS/prioridades.js'), 'utf8'));
  await modulo.link(async () => new vm.SyntheticModule(Object.keys(firebase), function () {
    for (const [nome, valor] of Object.entries(firebase)) this.setExport(nome, valor);
  }));
  await modulo.evaluate();
  return { api: modulo.namespace, gravacoes, assinaturas };
}

test('assinatura municipal lê apenas o seu município; superadmin recebe chaves distintas por cidade', async () => {
  const { api, assinaturas } = await moduloPrioridades();
  let recebido;
  api.ouvirPrioridades({ papel: 'admin', cityId: '2504009' }, valor => { recebido = valor; });
  assert.equal(assinaturas[0].caminho, 'prioridadesMunicipais/2504009');
  assinaturas[0].receber({ val: () => ({ abc: { ordem: 1 } }) });
  assert.equal(recebido['2504009/abc'].ordem, 1);
  api.ouvirPrioridades({ papel: 'superadmin' }, valor => { recebido = valor; });
  assert.equal(assinaturas[1].caminho, 'prioridadesMunicipais');
  assinaturas[1].receber({ val: () => ({ '2504009': { abc: { ordem: 1 } }, '2507507': { abc: { ordem: 2 } } }) });
  assert.equal(Object.keys(recebido).length, 2);
});

test('inclusão guarda autoria e relógio do servidor; reordenação grava só posições e rejeita caminhos inválidos', async () => {
  const { api, gravacoes } = await moduloPrioridades();
  const a = { cityId: '2504009', id: 'a' };
  const b = { cityId: '2504009', id: 'b' };
  await api.salvarPrioridade(a, null, 3000);
  const entrada = gravacoes[0].campos['prioridadesMunicipais/2504009/a'];
  assert.equal(entrada.adicionadoPor, 'gestor');
  assert.equal(entrada.adicionadoEm['.sv'], 'timestamp');
  await api.definirOrdemPrioridades([b, a]);
  const ordens = gravacoes[1].campos;
  assert.equal(ordens['prioridadesMunicipais/2504009/b/ordem'], 1024);
  assert.equal(ordens['prioridadesMunicipais/2504009/a/ordem'], 2048);
  assert.equal(Object.keys(ordens).length, 2);
  await assert.rejects(api.salvarPrioridade({ ...a, cityId: '../outro' }, null));
  await assert.rejects(api.removerPrioridade({ ...a, id: 'a/b' }));
  assert.equal(gravacoes.length, 2);
});
