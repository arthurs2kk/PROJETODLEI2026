"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  criarRelatoMapa, lerArgumentos, mensagemErro, migrar, prepararMigracao,
} = require("../scripts/backfill-relatos-mapa");

const agora = 1800000000000;
const relato = {
  titulo: "Iluminação da praça", categoria: "Iluminação pública", endereco: "Rua Exemplo, 10",
  cityId: "2507507", status: "aberto", votos: 0, autorNome: "Pessoa de teste",
  dataCriacao: agora, lat: -7.12, lng: -34.88,
  descricao: "Descrição completa e detalhada do problema", autorId: "uid-privado",
  fotoUrl: "https://example.test/foto", fotoPublicId: "imagem-interna", respostaOficial: "Resposta extensa",
};

function bancoFalso(dados, { concorrencia, frio = false } = {}) {
  let estado = structuredClone(dados);
  const leituras = [];
  let transacoes = 0;
  return {
    get estado() { return estado; },
    get transacoes() { return transacoes; },
    leituras,
    ref(caminho = "") {
      return {
        async get() {
          leituras.push(caminho);
          return { val: () => structuredClone(estado[caminho] ?? null) };
        },
        async transaction(atualizar, onComplete, applyLocally) {
          assert.equal(caminho, "");
          assert.equal(onComplete, undefined);
          assert.equal(applyLocally, false);
          transacoes += 1;
          if (frio) assert.equal(atualizar(null), null);
          let candidato = atualizar(structuredClone(estado));
          if (concorrencia) {
            // Firebase retries the callback when the server's root changed.
            concorrencia(estado);
            candidato = atualizar(structuredClone(estado));
          }
          if (candidato !== undefined) estado = structuredClone(candidato);
          return { committed: candidato !== undefined };
        },
      };
    },
  };
}

test("projeção copia só campos públicos do mapa e preserva o cityId numérico legado", () => {
  const mapa = criarRelatoMapa(relato, agora);
  assert.deepEqual(Object.keys(mapa).sort(), [
    "titulo", "categoria", "endereco", "cityId", "status", "votos", "autorNome", "dataCriacao", "lat", "lng",
  ].sort());
  assert.equal(mapa.titulo, relato.titulo);
  const plano = prepararMigracao({ legado: { ...relato, cityId: 2504009 } }, {}, agora);
  assert.equal(plano.pendentes[0].cityId, "2504009");
  assert.equal(plano.pendentes[0].esperado.cityId, 2504009);
});

test("coordenadas legadas ausentes ou parciais ficam ausentes sem impedir outros campos", () => {
  const semCoordenadas = { ...relato };
  delete semCoordenadas.lat;
  delete semCoordenadas.lng;
  const mapa = criarRelatoMapa(semCoordenadas, agora);
  assert.equal(Object.hasOwn(mapa, "lat"), false);
  assert.equal(Object.hasOwn(mapa, "lng"), false);
  const parcial = criarRelatoMapa({ ...semCoordenadas, lng: relato.lng, lat: null }, agora);
  assert.equal(Object.hasOwn(parcial, "lat"), false);
  assert.equal(parcial.lng, relato.lng);
  assert.equal(prepararMigracao({ legado: semCoordenadas }, {}, agora).contagem.coordenadasIncompletas, 1);
});

test("dados incompatíveis são sinalizados sem converter tipos, preencher ou arredondar valores", () => {
  for (const alteracao of [
    { titulo: "Curto".slice(0, 4) }, { categoria: "Categoria desconhecida" }, { endereco: null },
    { cityId: "../2507507" }, { cityId: true }, { status: "finalizado" }, { votos: "1" },
    { votos: -1 }, { autorNome: undefined }, { dataCriacao: "1800000000000" },
    { dataCriacao: agora + 120001 }, { lat: "-7.12" }, { lat: -90 }, { lng: NaN },
  ]) assert.equal(criarRelatoMapa({ ...relato, ...alteracao }, agora), null);
  const plano = prepararMigracao({ ausente: null, coordenada: { ...relato, lat: "-7.12" } }, {}, agora);
  assert.equal(plano.contagem.invalidos, 2);
  assert.deepEqual(plano.contagem.motivosInvalidos, { registro: 1, lat: 1 });
});

test("dry-run padrão lê só fonte e mapa, não grava e não registra dados pessoais", async () => {
  const db = bancoFalso({ relatos: { privadoId: relato }, contatosRelatos: { privadoId: "email@example.test" } });
  const linhas = [];
  const resultado = await migrar(db, { agora, log: texto => linhas.push(texto) });
  assert.deepEqual(db.leituras.sort(), ["relatos", "relatosMapa"]);
  assert.equal(db.transacoes, 0);
  assert.equal(resultado.criar, 1);
  assert.equal(resultado.aplicados, 0);
  for (const confidencial of ["privadoId", relato.endereco, relato.autorNome, relato.descricao, "email@example.test"])
    assert.equal(linhas.join("\n").includes(confidencial), false);
});

test("argumentos exigem --apply explícito e não aceitam comandos conflitantes", () => {
  assert.deepEqual(lerArgumentos([]), { aplicar: false });
  assert.deepEqual(lerArgumentos(["--dry-run"]), { aplicar: false });
  assert.deepEqual(lerArgumentos(["--apply"]), { aplicar: true });
  assert.throws(() => lerArgumentos(["--apply", "--dry-run"]), /ARGUMENTOS_INVALIDOS/);
  assert.throws(() => lerArgumentos(["--aply"]), /ARGUMENTOS_INVALIDOS/);
});

test("aplicação corrige o índice, preserva todas as outras coleções e é idempotente", async () => {
  const dados = {
    relatos: { relatoA: relato }, relatosResumo: { relatoA: { descricaoResumo: "Manter" } },
    relatosMapa: { "2507507": { relatoA: { titulo: "Antigo", descricao: "Não pertence ao mapa" } } },
    contatosRelatos: { relatoA: { email: "email@example.test" } }, usuarios: { pessoa: { nome: "Privado" } },
  };
  const db = bancoFalso(dados, { frio: true });
  const resultado = await migrar(db, { aplicar: true, agora, log() {} });
  assert.equal(resultado.aplicados, 1);
  assert.deepEqual(db.estado.relatosMapa["2507507"].relatoA, criarRelatoMapa(relato, agora));
  for (const chave of ["relatos", "relatosResumo", "contatosRelatos", "usuarios"])
    assert.deepEqual(db.estado[chave], dados[chave]);
  const segundo = await migrar(db, { aplicar: true, agora, log() {} });
  assert.equal(segundo.sincronizados, 1);
  assert.equal(segundo.aplicados, 0);
  assert.equal(db.transacoes, 1);
});

test("aplicação não ressuscita exclusão concorrente nem sobrescreve voto/edição ou reparo do índice", async () => {
  for (const concorrencia of [
    estado => { delete estado.relatos.relatoA; },
    estado => { estado.relatos.relatoA.votos = 1; },
    estado => { estado.relatos.relatoA.titulo = "Título atualizado"; },
    estado => { estado.relatosMapa = { "2507507": { relatoA: criarRelatoMapa(relato, agora) } }; },
  ]) {
    const db = bancoFalso({ relatos: { relatoA: relato }, usuarios: { outro: "original" } }, {
      concorrencia: estado => { concorrencia(estado); estado.usuarios.outro = "alteração concorrente"; },
    });
    const resultado = await migrar(db, { aplicar: true, agora, log() {} });
    assert.equal(resultado.aplicados, 0);
    assert.equal(resultado.conflitos, 1);
    assert.equal(db.estado.usuarios.outro, "alteração concorrente");
  }
});

test("registros inválidos e índices órfãos bloqueiam --apply antes de qualquer gravação", async () => {
  for (const dados of [
    { relatos: { invalido: { ...relato, votos: "0" }, valido: relato } },
    { relatos: { valido: relato }, relatosMapa: { "2504009": { valido: criarRelatoMapa(relato, agora) } } },
    { relatos: { valido: relato }, relatosMapa: { "2507507": { apagado: criarRelatoMapa(relato, agora) } } },
  ]) {
    const db = bancoFalso(dados);
    await assert.rejects(migrar(db, { aplicar: true, agora, log() {} }), /REVISAO_DOS_DADOS_NECESSARIA/);
    assert.equal(db.transacoes, 0);
    assert.deepEqual(db.estado, dados);
  }
});

test("erros desconhecidos não expõem conteúdo do SDK ou credenciais", () => {
  const mensagem = mensagemErro(new Error("private_key=segredo endereço=Rua Exemplo email=email@example.test"));
  assert.equal(mensagem.includes("segredo"), false);
  assert.equal(mensagem.includes("example.test"), false);
  assert.equal(mensagem.includes("Rua Exemplo"), false);
});
