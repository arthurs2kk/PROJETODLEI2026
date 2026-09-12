"use strict";

const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  ref, set, update, get, query, orderByChild, startAt, endAt, limitToLast
} = require("firebase/database");

let ambiente;
const agora = Date.now();
const relatoBase = {
  titulo: "Falta iluminação na rua",
  categoria: "Iluminação pública",
  descricao: "A rua está sem iluminação há vários dias.",
  endereco: "Rua Exemplo, Centro, João Pessoa",
  lat: -7.12,
  lng: -34.88,
  cidade: "João Pessoa",
  cityId: "2507507",
  bairro: "Centro",
  status: "aberto",
  votos: 0,
  autorId: "cidadao",
  autorNome: "Cidadão de Teste",
  dataCriacao: agora,
};

before(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: "demo-pro-povo",
    database: {
      host: "127.0.0.1",
      port: 9012,
      rules: fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8"),
    },
  });

  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await set(ref(contexto.database()), {
      relatos: { relatoA: relatoBase },
      usuarios: {
        cidadao: {
          nome: "Cidadão de Teste",
          email: "cidadao@example.com",
          cidade: "João Pessoa",
          dataCadastro: agora,
        },
        legado: {
          nome: "Perfil Legado",
          email: "legado@example.com",
          cidade: "Campina Grande",
        },
      },
      admins: {
        adminJP: { ativo: true, papel: "admin", cityId: "2507507", organizacaoId: "orgJP" },
        adminCG: { ativo: true, papel: "admin", cityId: "2504009", organizacaoId: "orgCG" },
        super: { ativo: true, papel: "superadmin" },
      },
      organizacoes: {
        orgJP: { nome: "Gestão JP", cityId: "2507507", cidadeNome: "João Pessoa", ativo: true },
        orgCG: { nome: "Gestão CG", cityId: "2504009", cidadeNome: "Campina Grande", ativo: true },
      },
    });
  });
});

after(async () => {
  await ambiente?.cleanup();
});

test("regras bloqueiam adulterações e preservam operações legítimas", async () => {
  const cidadao = ambiente.authenticatedContext("cidadao", {
    email: "cidadao@example.com",
    email_verified: true,
  }).database();
  const invasor = ambiente.authenticatedContext("invasor", {
    email: "invasor@example.com",
    email_verified: true,
  }).database();
  const adminJP = ambiente.authenticatedContext("adminJP").database();
  const adminCG = ambiente.authenticatedContext("adminCG").database();
  const superadmin = ambiente.authenticatedContext("super").database();
  const novoCidadao = ambiente.authenticatedContext("novoCidadao", {
    email: "novo@example.com",
    email_verified: false,
  }).database();
  const legado = ambiente.authenticatedContext("legado", {
    email: "legado@example.com",
    email_verified: true,
  }).database();

  await assertSucceeds(set(ref(novoCidadao, "usuarios/novoCidadao"), {
    nome: "Novo Cidadão",
    email: "novo@example.com",
    cidade: "Campina Grande",
    dataCadastro: Date.now(),
  }));
  await assertSucceeds(update(ref(novoCidadao, "usuarios/novoCidadao"), {
    nome: "Nome Atualizado",
    dataAtualizacao: Date.now(),
  }));
  await assertFails(update(ref(novoCidadao, "usuarios/novoCidadao"), {
    dataCadastro: Date.now() - 86400000,
  }));

  // Perfis anteriores à exigência de dataCadastro precisam enviar o campo na
  // primeira edição. Este é o formato usado por atualizarUsuario no cliente.
  await assertFails(update(ref(legado, "usuarios/legado"), {
    nome: "Perfil Legado Atualizado",
    dataAtualizacao: Date.now(),
  }));
  await assertSucceeds(update(ref(legado, "usuarios/legado"), {
    nome: "Perfil Legado Atualizado",
    email: "legado@example.com",
    cidade: "Campina Grande",
    dataCadastro: Date.now(),
    dataAtualizacao: Date.now(),
  }));

  const novoRelato = { ...relatoBase, dataCriacao: Date.now() };
  await assertFails(set(ref(cidadao, "relatos/relatoCriadoNoCliente"), novoRelato));
  await assertSucceeds(update(ref(cidadao), {
    "relatos/relatoCriadoAtomicamente": novoRelato,
    "limitesEnvio/cidadao": novoRelato.dataCriacao,
  }));
  await assertFails(update(ref(cidadao), {
    "relatos/relatoSpam": { ...novoRelato, dataCriacao: Date.now() },
    "limitesEnvio/cidadao": Date.now(),
  }));

  const naoVerificado = {
    ...novoRelato,
    autorId: "novoCidadao",
    autorNome: "Nome Atualizado",
    dataCriacao: Date.now(),
  };
  await assertFails(update(ref(novoCidadao), {
    "relatos/relatoSemEmailVerificado": naoVerificado,
    "limitesEnvio/novoCidadao": naoVerificado.dataCriacao,
  }));

  await assertFails(update(ref(cidadao, "relatos/relatoA"), { votos: 999 }));
  await assertFails(update(ref(invasor, "relatos/relatoA"), {
    titulo: "Relato adulterado",
    dataEdicao: Date.now(),
  }));
  await assertSucceeds(update(ref(cidadao, "relatos/relatoA"), {
    titulo: "Falta iluminação em toda a rua",
    descricao: "A rua continua sem iluminação e precisa de atendimento.",
    dataEdicao: Date.now(),
  }));

  await assertFails(set(ref(cidadao, "votos/relatoA/cidadao"), true));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 1,
  }));
  await assertFails(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 2,
  }));
  await assertFails(set(ref(invasor, "votos/relatoA/cidadao"), null));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": null,
    "relatos/relatoA/votos": 0,
  }));

  await assertFails(update(ref(adminCG, "relatos/relatoA"), { status: "andamento" }));
  await assertSucceeds(update(ref(adminJP, "relatos/relatoA"), { status: "andamento" }));

  await assertFails(get(ref(adminJP, "usuarios/cidadao")));
  const perfil = await assertSucceeds(get(ref(superadmin, "usuarios/cidadao")));
  assert.equal(perfil.val().email, "cidadao@example.com");

  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 1,
  }));
  await assertFails(set(ref(superadmin, "relatos/relatoA"), null));
  await assertSucceeds(update(ref(superadmin), {
    "relatos/relatoA": null,
    "votos/relatoA": null,
  }));
});

test("consulta administrativa combina cidade e limite sem trazer outros municípios", async () => {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await update(ref(contexto.database(), "relatos"), {
      "pagina-001": { ...relatoBase, cidade: "João Pessoa", cityId: "2507507" },
      "pagina-002": { ...relatoBase, cidade: "João Pessoa", cityId: "2507507" },
      "pagina-003": { ...relatoBase, cidade: "Campina Grande", cityId: "2504009" },
    });
  });

  const publico = ambiente.unauthenticatedContext().database();
  const consulta = query(
    ref(publico, "relatos"),
    orderByChild("cityId"),
    startAt("2507507"),
    endAt("2507507"),
    limitToLast(2)
  );
  const snapshot = await assertSucceeds(get(consulta));
  const relatos = Object.values(snapshot.val() || {});

  assert.equal(relatos.length, 2);
  assert.ok(relatos.every(relato => relato.cityId === "2507507"));
});
