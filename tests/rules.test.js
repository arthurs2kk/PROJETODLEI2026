"use strict";

const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { configurarAbrangencia } = require('../scripts/configurar-abrangencia-relatos.js');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  ref, set, update, get, query, orderByChild, equalTo, startAt, endAt, limitToLast, serverTimestamp
} = require("firebase/database");

let ambiente;
const agora = Date.now();

function camposFiltroRelato({ cityId, categoria, status }) {
  return {
    filtroCidadeCategoria: `${cityId}|${categoria}`,
    filtroCidadeStatus: `${cityId}|${status}`,
    filtroCategoriaStatus: `${categoria}|${status}`,
    filtroCidadeCategoriaStatus: `${cityId}|${categoria}|${status}`,
  };
}

function comCamposFiltro(relato) {
  return { ...relato, ...camposFiltroRelato(relato) };
}

function resumoPublico(relato) {
  const filtros = camposFiltroRelato(relato);
  const descricao = String(relato.descricao);
  const resumo = {
    titulo: relato.titulo,
    categoria: relato.categoria,
    descricaoResumo: descricao.slice(0, 240),
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    autorNome: relato.autorNome,
    dataCriacao: relato.dataCriacao,
    ...filtros,
  };
  if (relato.fotoUrl) resumo.fotoUrl = relato.fotoUrl;
  return resumo;
}

function marcadorPublico(relato) {
  const marcador = {};
  for (const campo of [
    "titulo", "categoria", "endereco", "cityId", "status", "votos",
    "autorNome", "dataCriacao", "lat", "lng",
  ]) {
    if (relato[campo] !== undefined && relato[campo] !== null) marcador[campo] = relato[campo];
  }
  return marcador;
}

const relatoBase = comCamposFiltro({
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
});
const contatoBase = {
  autorId: "cidadao",
  nome: "Cidadão de Teste",
  email: "cidadao@example.com",
  cityId: "2507507",
  dataCriacao: agora,
};

const relatoLegado = {
  titulo: "Poste quebrado",
  categoria: "Iluminação pública",
  descricao: "Poste quebrado e sem iluminação na rua.",
  endereco: "Rua Exemplo",
  lat: -7.12,
  lng: -35.88,
  cityId: 2504009,
  status: "andamento",
  votos: 2,
  autorId: "autorLegado",
  autorNome: "Autor Legado",
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
      relatos: {
        relatoA: relatoBase,
        relatoSemVotos: relatoBase,
        relatoContatoPendente: relatoBase,
        relatoLegado,
      },
      relatosResumo: {
        relatoA: resumoPublico(relatoBase),
        relatoSemVotos: resumoPublico(relatoBase),
        relatoContatoPendente: resumoPublico(relatoBase),
        relatoLegado: resumoPublico(relatoLegado),
      },
      relatosMapa: {
        "2507507": {
          relatoA: marcadorPublico(relatoBase),
          relatoSemVotos: marcadorPublico(relatoBase),
          relatoContatoPendente: marcadorPublico(relatoBase),
        },
        "2504009": { relatoLegado: marcadorPublico(relatoLegado) },
      },
      contatosRelatos: {
        relatoA: contatoBase,
        relatoSemVotos: contatoBase,
      },
      usuarios: {
        cidadao: {
          nome: "Cidadão de Teste",
          email: "cidadao@example.com",
          cidade: "João Pessoa",
          dataCadastro: agora,
        },
        fotografo: {
          nome: "Usuario com Foto",
          email: "foto@example.com",
          cidade: "Joao Pessoa",
          dataCadastro: agora,
        },
        relogioIncorreto: {
          nome: "Usuário com relógio incorreto",
          email: "relogio@example.com",
          cidade: "Cabaceiras",
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
        superLegado: true,
        superInativo: { ativo: false, papel: "superadmin" },
        adminInativo: { ativo: false, papel: "admin", cityId: "2507507" },
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
  const fotografo = ambiente.authenticatedContext("fotografo", {
    email: "foto@example.com",
    email_verified: true,
  }).database();
  const relogioIncorreto = ambiente.authenticatedContext("relogioIncorreto", {
    email: "relogio@example.com",
    email_verified: true,
  }).database();
  const publico = ambiente.unauthenticatedContext().database();

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

  const novoRelato = comCamposFiltro({ ...relatoBase, cidade: 'Campina Grande', cityId: '2504009', lat: -7.216, lng: -35.888, dataCriacao: Date.now() });
  // Escrita direta com todas as projeções corretas ainda deve recusar outra cidade.
  for (const [cityId, cidade] of [['2507507', 'João Pessoa'], ['2504009', 'João Pessoa'], ['2507507', 'Campina Grande']]) {
    const fora = comCamposFiltro({ ...novoRelato, cityId, cidade });
    await assertFails(update(ref(cidadao), {
      'relatos/foraAbrangencia': fora,
      'relatosResumo/foraAbrangencia': resumoPublico(fora),
      [`relatosMapa/${cityId}/foraAbrangencia`]: marcadorPublico(fora),
      'limitesEnvio/cidadao': fora.dataCriacao,
    }));
  }
  await assertFails(set(ref(cidadao, "relatos/relatoCriadoNoCliente"), novoRelato));
  const relatoSemFiltros = { ...novoRelato };
  delete relatoSemFiltros.filtroCidadeCategoria;
  delete relatoSemFiltros.filtroCidadeStatus;
  delete relatoSemFiltros.filtroCategoriaStatus;
  delete relatoSemFiltros.filtroCidadeCategoriaStatus;
  await assertFails(update(ref(cidadao), {
    "relatos/relatoSemFiltros": relatoSemFiltros,
    "contatosRelatos/relatoSemFiltros": {
      ...contatoBase,
      dataCriacao: relatoSemFiltros.dataCriacao,
    },
    "limitesEnvio/cidadao": relatoSemFiltros.dataCriacao,
  }));
  await assertFails(update(ref(cidadao), {
    "relatos/relatoSemResumo": novoRelato,
    "contatosRelatos/relatoSemResumo": {
      ...contatoBase,
      dataCriacao: novoRelato.dataCriacao,
    },
    "limitesEnvio/cidadao": novoRelato.dataCriacao,
  }));
  await assertSucceeds(update(ref(cidadao), {
    "relatos/relatoCriadoAtomicamente": novoRelato,
    "relatosResumo/relatoCriadoAtomicamente": resumoPublico(novoRelato),
    "relatosMapa/2504009/relatoCriadoAtomicamente": marcadorPublico(novoRelato),
    "contatosRelatos/relatoCriadoAtomicamente": {
      ...contatoBase,
      cityId: novoRelato.cityId,
      dataCriacao: novoRelato.dataCriacao,
    },
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

  const horarioFoto = serverTimestamp();
  const relatoComFoto = {
    ...novoRelato,
    autorId: "fotografo",
    autorNome: "Usuario com Foto",
    fotoUrl: "https://res.cloudinary.com/dk8uky6m/image/upload/v1785000000/pro_povo/fotografo/relatoComFoto.jpg",
    dataCriacao: horarioFoto,
  };
  await assertFails(update(ref(fotografo), {
    "relatos/relatoComFoto": { ...relatoComFoto, fotoPublicId: "pro_povo/outro/relatoComFoto" },
    "limitesEnvio/fotografo": relatoComFoto.dataCriacao,
  }));
  await assertSucceeds(update(ref(fotografo), {
    "relatos/relatoComFoto": {
      ...relatoComFoto,
      fotoPublicId: "pro_povo/fotografo/relatoComFoto",
    },
    "relatosResumo/relatoComFoto": resumoPublico(relatoComFoto),
    "relatosMapa/2504009/relatoComFoto": marcadorPublico(relatoComFoto),
    "contatosRelatos/relatoComFoto": {
      autorId: "fotografo",
      nome: "Usuario com Foto",
      email: "foto@example.com",
      cityId: relatoComFoto.cityId,
      dataCriacao: horarioFoto,
    },
    "limitesEnvio/fotografo": horarioFoto,
  }));

  // O cliente usa o timestamp do servidor para não depender da data/hora
  // configurada no computador ou celular do cidadão.
  const horarioServidor = serverTimestamp();
  const relatoComHorarioServidor = comCamposFiltro({
    ...novoRelato,
    autorId: "relogioIncorreto",
    autorNome: "Usuário com relógio incorreto",
    cidade: "Campina Grande",
    cityId: "2504009",
    bairro: "Centro",
    dataCriacao: horarioServidor,
  });
  await assertSucceeds(update(ref(relogioIncorreto), {
    "relatos/relatoComHorarioServidor": relatoComHorarioServidor,
    "relatosResumo/relatoComHorarioServidor": resumoPublico(relatoComHorarioServidor),
    "relatosMapa/2504009/relatoComHorarioServidor": marcadorPublico(relatoComHorarioServidor),
    "contatosRelatos/relatoComHorarioServidor": {
      autorId: "relogioIncorreto",
      nome: "Usuário com relógio incorreto",
      email: "relogio@example.com",
      cityId: "2504009",
      dataCriacao: horarioServidor,
    },
    "limitesEnvio/relogioIncorreto": horarioServidor,
  }));

  await assertFails(update(ref(cidadao, "relatos/relatoA"), { votos: 999 }));
  await assertFails(update(ref(invasor, "relatos/relatoA"), {
    titulo: "Relato adulterado",
    dataEdicao: Date.now(),
  }));
  const relatoAEditado = {
    ...relatoBase,
    titulo: "Falta iluminação em toda a rua",
    descricao: "A rua continua sem iluminação e precisa de atendimento.",
  };
  await assertSucceeds(update(ref(cidadao), {
    "relatos/relatoA/titulo": relatoAEditado.titulo,
    "relatos/relatoA/descricao": relatoAEditado.descricao,
    "relatosResumo/relatoA": resumoPublico(relatoAEditado),
    "relatosMapa/2507507/relatoA": marcadorPublico(relatoAEditado),
    "relatos/relatoA/dataEdicao": Date.now(),
  }));

  await assertFails(update(ref(invasor, "relatosResumo/relatoA"), {
    titulo: "Resumo adulterado",
  }));

  await assertFails(set(ref(cidadao, "votos/relatoA/cidadao"), true));
  await assertFails(update(ref(novoCidadao), {
    "votos/relatoA/novoCidadao": true,
    "relatos/relatoA/votos": 1,
  }));
  await assertFails(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 1,
  }));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 1,
    "relatosResumo/relatoA/votos": 1,
    "relatosMapa/2507507/relatoA/votos": 1,
  }));
  await assertFails(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 2,
  }));
  await assertFails(set(ref(invasor, "votos/relatoA/cidadao"), null));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": null,
    "relatos/relatoA/votos": 0,
    "relatosResumo/relatoA/votos": 0,
    "relatosMapa/2507507/relatoA/votos": 0,
  }));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoLegado/cidadao": true,
    "relatos/relatoLegado/votos": 3,
    "relatosResumo/relatoLegado/votos": 3,
    "relatosMapa/2504009/relatoLegado/votos": 3,
  }));
  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoLegado/cidadao": null,
    "relatos/relatoLegado/votos": 2,
    "relatosResumo/relatoLegado/votos": 2,
    "relatosMapa/2504009/relatoLegado/votos": 2,
  }));

  await assertFails(update(ref(adminCG, "relatos/relatoA"), { status: "andamento" }));
  await assertFails(update(ref(adminJP, "relatos/relatoA"), { status: "andamento" }));
  const relatoAEmAndamento = comCamposFiltro({ ...relatoAEditado, status: "andamento" });
  await assertSucceeds(update(ref(adminJP), {
    "relatos/relatoA/status": "andamento",
    "relatos/relatoA/filtroCidadeCategoria": relatoAEmAndamento.filtroCidadeCategoria,
    "relatos/relatoA/filtroCidadeStatus": relatoAEmAndamento.filtroCidadeStatus,
    "relatos/relatoA/filtroCategoriaStatus": relatoAEmAndamento.filtroCategoriaStatus,
    "relatos/relatoA/filtroCidadeCategoriaStatus": relatoAEmAndamento.filtroCidadeCategoriaStatus,
    "relatosResumo/relatoA": resumoPublico(relatoAEmAndamento),
    "relatosMapa/2507507/relatoA": marcadorPublico(relatoAEmAndamento),
  }));

  await assertFails(set(ref(cidadao, "contatosRelatos/relatoContatoPendente"), {
    ...contatoBase,
    email: "outro@example.com",
  }));
  await assertSucceeds(set(ref(cidadao, "contatosRelatos/relatoContatoPendente"), contatoBase));

  const contatoAdmin = await assertSucceeds(get(ref(adminJP, "contatosRelatos/relatoA")));
  assert.equal(contatoAdmin.val().email, "cidadao@example.com");
  await assertFails(get(ref(adminCG, "contatosRelatos/relatoA")));
  await assertFails(get(ref(publico, "contatosRelatos/relatoA")));
  await assertFails(get(ref(invasor, "contatosRelatos/relatoA")));
  await assertSucceeds(get(ref(cidadao, "contatosRelatos/relatoA")));
  await assertFails(update(ref(cidadao, "contatosRelatos/relatoA"), {
    email: "cidadao@example.com",
  }));

  await assertFails(get(ref(adminJP, "usuarios/cidadao")));
  const perfil = await assertSucceeds(get(ref(superadmin, "usuarios/cidadao")));
  assert.equal(perfil.val().email, "cidadao@example.com");

  // A tela administrativa sempre remove relato e votos na mesma atualizacao.
  // Isso tambem precisa funcionar quando o relato nunca recebeu nenhum voto e,
  // portanto, /votos/{relatoId} ainda nao existe.
  await assertFails(update(ref(adminCG), {
    "relatos/relatoSemVotos": null,
    "votos/relatoSemVotos": null,
  }));
  await assertFails(update(ref(adminJP), {
    "relatos/relatoSemVotos": null,
    "votos/relatoSemVotos": null,
  }));
  await assertSucceeds(update(ref(adminJP), {
    "relatos/relatoSemVotos": null,
    "relatosResumo/relatoSemVotos": null,
    "relatosMapa/2507507/relatoSemVotos": null,
    "votos/relatoSemVotos": null,
  }));

  await assertSucceeds(update(ref(cidadao), {
    "votos/relatoA/cidadao": true,
    "relatos/relatoA/votos": 1,
    "relatosResumo/relatoA/votos": 1,
    "relatosMapa/2507507/relatoA/votos": 1,
  }));
  await assertFails(set(ref(superadmin, "relatos/relatoA"), null));
  await assertSucceeds(update(ref(superadmin), {
    "relatos/relatoA": null,
    "relatosResumo/relatoA": null,
    "relatosMapa/2507507/relatoA": null,
    "votos/relatoA": null,
  }));
});

test("consulta administrativa combina cidade e limite sem trazer outros municípios", async () => {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const pagina1 = comCamposFiltro({ ...relatoBase, cidade: "João Pessoa", cityId: "2507507" });
    const pagina2 = comCamposFiltro({ ...relatoBase, cidade: "João Pessoa", cityId: "2507507" });
    const pagina3 = comCamposFiltro({ ...relatoBase, cidade: "Campina Grande", cityId: "2504009" });
    await update(ref(contexto.database()), {
      "relatos/pagina-001": pagina1,
      "relatos/pagina-002": pagina2,
      "relatos/pagina-003": pagina3,
      "relatosResumo/pagina-001": resumoPublico(pagina1),
      "relatosMapa/2507507/pagina-001": marcadorPublico(pagina1),
      "relatosResumo/pagina-002": resumoPublico(pagina2),
      "relatosMapa/2507507/pagina-002": marcadorPublico(pagina2),
      "relatosResumo/pagina-003": resumoPublico(pagina3),
      "relatosMapa/2504009/pagina-003": marcadorPublico(pagina3),
    });
  });

  const publico = ambiente.unauthenticatedContext().database();
  const consulta = query(
    ref(publico, "relatosResumo"),
    orderByChild("cityId"),
    startAt("2507507"),
    endAt("2507507"),
    limitToLast(2)
  );
  const snapshot = await assertSucceeds(get(consulta));
  const relatos = Object.values(snapshot.val() || {});

  assert.equal(relatos.length, 2);
  assert.ok(relatos.every(relato => relato.cityId === "2507507"));

  const consultaComposta = query(
    ref(publico, "relatosResumo"),
    orderByChild("filtroCidadeStatus"),
    equalTo("2507507|aberto"),
    limitToLast(2)
  );
  const snapshotComposto = await assertSucceeds(get(consultaComposta));
  const relatosCompostos = Object.values(snapshotComposto.val() || {});

  assert.equal(relatosCompostos.length, 2);
  assert.ok(relatosCompostos.every(relato =>
    relato.cityId === "2507507" && relato.status === "aberto"
  ));
});

test("leituras públicas usam projeções e detalhes; coleções completas exigem escopo autorizado", async () => {
  const publico = ambiente.unauthenticatedContext().database();
  const cidadao = ambiente.authenticatedContext("cidadao").database();
  const adminJP = ambiente.authenticatedContext("adminJP").database();
  const adminCG = ambiente.authenticatedContext("adminCG").database();
  const superadmin = ambiente.authenticatedContext("super").database();

  await assertSucceeds(get(ref(publico, "relatosResumo")));
  await assertSucceeds(get(query(
    ref(publico, "relatosMapa/2507507"), orderByChild("dataCriacao"), limitToLast(2)
  )));
  await assertSucceeds(get(ref(publico, "relatos/pagina-001")));
  await assertFails(get(ref(publico, "relatos")));
  await assertFails(get(query(ref(publico, "relatos"), orderByChild("cityId"), equalTo("2507507"))));
  await assertFails(get(ref(cidadao, "relatos")));
  const proprios = await assertSucceeds(get(query(
    ref(cidadao, "relatos"), orderByChild("autorId"), equalTo("cidadao")
  )));
  assert.ok(Object.values(proprios.val()).every(relato => relato.autorId === "cidadao"));
  await assertFails(get(query(ref(cidadao, "relatos"), orderByChild("autorId"), equalTo("fotografo"))));
  await assertFails(get(query(ref(publico, "relatos"), orderByChild("autorId"), equalTo("cidadao"))));
  await assertFails(get(query(ref(cidadao, "relatos"), orderByChild("autorId"), startAt("cidadao"))));

  for (const db of [adminJP, adminCG]) {
    await assertFails(get(ref(db, "relatos")));
  }
  for (const restricoes of [
    [equalTo("2507507"), limitToLast(2)],
    [startAt("2507507"), endAt("2507507"), limitToLast(2)],
    [startAt("2507507"), endAt("2507507", "pagina-002"), limitToLast(3)],
  ]) {
    const pagina = await assertSucceeds(get(query(ref(adminJP, "relatos"), orderByChild("cityId"), ...restricoes)));
    assert.ok(Object.values(pagina.val() || {}).every(relato => relato.cityId === "2507507"));
  }
  await assertFails(get(query(ref(adminCG, "relatos"), orderByChild("cityId"), equalTo("2507507"))));
  await assertFails(get(query(ref(adminJP, "relatos"), orderByChild("cityId"), startAt("2504009"), endAt("2507507"))));
  await assertFails(get(query(ref(adminJP, "relatos"), orderByChild("cityId"), startAt("2507507"))));
  await assertFails(get(query(ref(adminJP, "relatos"), orderByChild("dataCriacao"), limitToLast(2))));
  await assertSucceeds(get(ref(superadmin, "relatos")));
  await assertSucceeds(get(query(ref(superadmin, "relatos"), orderByChild("dataCriacao"), endAt(Date.now(), "pagina-002"), limitToLast(2))));
  await assertSucceeds(get(ref(ambiente.authenticatedContext("superLegado").database(), "relatos")));
  for (const uid of ["adminInativo", "superInativo"]) {
    const db = ambiente.authenticatedContext(uid).database();
    await assertFails(get(ref(db, "relatos")));
    await assertFails(get(query(ref(db, "relatos"), orderByChild("cityId"), equalTo("2507507"))));
    await assertFails(get(ref(db, "contatosRelatos/relatoSemVotos")));
  }
  await assertFails(get(ref(publico, "contatosRelatos")));
  await assertFails(get(ref(publico, "contatosRelatos/relatoSemVotos")));
  await assertFails(get(ref(publico, "usuarios/cidadao")));

  const marcadores = await assertSucceeds(get(ref(publico, "relatosMapa/2507507")));
  for (const marcador of Object.values(marcadores.val())) {
    assert.deepEqual(Object.keys(marcador).sort(), Object.keys(marcadorPublico(relatoBase)).sort());
  }
});

async function exigirTodosOsCaminhos(db, alteracoes, caminhos) {
  for (const caminho of caminhos) {
    const incompleta = { ...alteracoes };
    delete incompleta[caminho];
    await assertFails(update(ref(db), incompleta), `a operação deve exigir ${caminho}`);
  }
}

test("criação exige fonte, resumo e mapa iguais e rejeita dados privados e coordenadas forjadas", async () => {
  const uid = "criadorMapa";
  const db = ambiente.authenticatedContext(uid, { email: "mapa@example.com", email_verified: true }).database();
  await ambiente.withSecurityRulesDisabled(async contexto => {
    await set(ref(contexto.database(), `usuarios/${uid}`), {
      nome: "Criador do Mapa", email: "mapa@example.com", cidade: "João Pessoa", dataCadastro: Date.now(),
    });
  });
  const relato = comCamposFiltro({ ...relatoBase, cidade: 'Campina Grande', cityId: '2504009', lat: -7.216, lng: -35.888, autorId: uid, autorNome: "Criador do Mapa", dataCriacao: serverTimestamp() });
  const mapaPath = "relatosMapa/2504009/criacaoMapa";
  const payload = {
    "relatos/criacaoMapa": relato,
    "relatosResumo/criacaoMapa": resumoPublico(relato),
    [mapaPath]: marcadorPublico(relato),
    "limitesEnvio/criadorMapa": relato.dataCriacao,
  };
  await exigirTodosOsCaminhos(db, payload, Object.keys(payload));
  await assertFails(set(ref(db, mapaPath), marcadorPublico(relato)));
  for (const [campo, valor] of Object.entries({
    titulo: "Título falsificado", categoria: "Outros", endereco: "Outro endereço",
    cityId: "2507507", status: "resolvido", votos: 90, autorNome: "Outra pessoa",
    dataCriacao: 1, lat: -7.2, lng: -35.1,
  })) {
    await assertFails(update(ref(db), { ...payload, [mapaPath]: { ...marcadorPublico(relato), [campo]: valor } }));
  }
  for (const campo of ["descricao", "fotoUrl", "respostaOficial", "autorId", "email"]) {
    await assertFails(update(ref(db), { ...payload, [mapaPath]: { ...marcadorPublico(relato), [campo]: "dado indevido" } }));
  }
  for (const campo of Object.keys(marcadorPublico(relato))) {
    const semCampo = marcadorPublico(relato);
    delete semCampo[campo];
    await assertFails(update(ref(db), { ...payload, [mapaPath]: semCampo }));
  }
  const cidadeIncorreta = { ...payload, "relatosMapa/2507507/criacaoMapa": payload[mapaPath] };
  delete cidadeIncorreta[mapaPath];
  await assertFails(update(ref(db), cidadeIncorreta));
  const semVerificacao = ambiente.authenticatedContext(uid, { email: "mapa@example.com", email_verified: false }).database();
  await assertFails(update(ref(semVerificacao), payload));
  await assertSucceeds(update(ref(db), payload));
  await ambiente.withSecurityRulesDisabled(async contexto => {
    await set(ref(contexto.database(), mapaPath), null);
  });
  // Nem um marcador igual à fonte pode ser criado isoladamente pelo cliente;
  // a preparação de registros antigos é responsabilidade do backfill Admin.
  const fonteExistente = (await get(ref(db, "relatos/criacaoMapa"))).val();
  await assertFails(set(ref(db, mapaPath), marcadorPublico(fonteExistente)));
  await ambiente.withSecurityRulesDisabled(async contexto => {
    await set(ref(contexto.database(), mapaPath), marcadorPublico(fonteExistente));
  });
});

test("edição, votos, status e exclusão exigem todas as projeções na mesma atualização", async () => {
  const id = "sincronizacaoMapa";
  const relatoPath = `relatos/${id}`;
  const resumoPath = `relatosResumo/${id}`;
  const mapaPath = `relatosMapa/2507507/${id}`;
  const votoPath = `votos/${id}/cidadao`;
  const cidadao = ambiente.authenticatedContext("cidadao", { email_verified: true }).database();
  const invasor = ambiente.authenticatedContext("invasor", { email_verified: true }).database();
  const adminJP = ambiente.authenticatedContext("adminJP").database();
  const adminCG = ambiente.authenticatedContext("adminCG").database();
  await ambiente.withSecurityRulesDisabled(async contexto => {
    await update(ref(contexto.database()), {
      [relatoPath]: relatoBase,
      [resumoPath]: resumoPublico(relatoBase),
      [mapaPath]: marcadorPublico(relatoBase),
    });
  });
  const editado = comCamposFiltro({ ...relatoBase, titulo: "Iluminação precisa de manutenção", categoria: "Outros" });
  const edicao = {
    [relatoPath]: { ...editado, dataEdicao: serverTimestamp() },
    [resumoPath]: resumoPublico(editado),
    [mapaPath]: marcadorPublico(editado),
  };
  await exigirTodosOsCaminhos(cidadao, edicao, Object.keys(edicao));
  await assertFails(update(ref(invasor), edicao));
  await assertSucceeds(update(ref(cidadao), edicao));
  await assertFails(set(ref(cidadao, mapaPath), marcadorPublico(editado)));
  for (const [campo, valor] of Object.entries({ lat: -7.2, lng: -35.1, votos: 9, cityId: "2504009" })) {
    await assertFails(update(ref(cidadao, mapaPath), { [campo]: valor }));
    await assertFails(update(ref(adminJP, mapaPath), { [campo]: valor }));
  }
  await assertFails(set(ref(adminJP, mapaPath), null));
  await assertFails(set(ref(cidadao, "relatosMapa/2504009/sincronizacaoMapa"), marcadorPublico(editado)));
  const outraCidade = comCamposFiltro({ ...editado, cityId: "2504009" });
  const mudancaCidade = {
    [`${relatoPath}/cityId`]: outraCidade.cityId,
    [`${relatoPath}/dataEdicao`]: serverTimestamp(),
    ...Object.fromEntries(Object.entries(camposFiltroRelato(outraCidade)).map(([campo, valor]) => [`${relatoPath}/${campo}`, valor])),
    [resumoPath]: resumoPublico(outraCidade),
    [mapaPath]: null,
    "relatosMapa/2504009/sincronizacaoMapa": marcadorPublico(outraCidade),
  };
  await assertFails(update(ref(cidadao), mudancaCidade));
  await assertFails(update(ref(adminJP), mudancaCidade));

  const voto = {
    [votoPath]: true,
    [`${relatoPath}/votos`]: 1,
    [`${resumoPath}/votos`]: 1,
    [`${mapaPath}/votos`]: 1,
  };
  await exigirTodosOsCaminhos(cidadao, voto, Object.keys(voto));
  await assertSucceeds(update(ref(cidadao), voto));
  // A permissão de apagar a coleção de votos não pode contornar a retirada
  // individual, mesmo quando o autor tenta apagar seu único voto.
  await assertFails(set(ref(cidadao, `votos/${id}`), null));
  await assertFails(set(ref(adminJP, `votos/${id}`), null));
  const retirarVoto = {
    [votoPath]: null,
    [`${relatoPath}/votos`]: 0,
    [`${resumoPath}/votos`]: 0,
    [`${mapaPath}/votos`]: 0,
  };
  await exigirTodosOsCaminhos(cidadao, retirarVoto, Object.keys(retirarVoto));
  await assertSucceeds(update(ref(cidadao), retirarVoto));

  const resolvido = comCamposFiltro({ ...editado, status: "resolvido" });
  const status = {
    [`${relatoPath}/status`]: "resolvido",
    [`${relatoPath}/dataResolucao`]: serverTimestamp(),
    ...Object.fromEntries(Object.entries(camposFiltroRelato(resolvido)).map(([campo, valor]) => [`${relatoPath}/${campo}`, valor])),
    [resumoPath]: resumoPublico(resolvido),
    [`${mapaPath}/status`]: "resolvido",
  };
  await exigirTodosOsCaminhos(adminJP, status, [`${relatoPath}/status`, resumoPath, `${mapaPath}/status`]);
  await assertFails(update(ref(adminCG), status));
  await assertFails(update(ref(cidadao), status));
  await assertSucceeds(update(ref(adminJP), status));
  // A resposta oficial não altera os campos públicos do mapa.
  await assertSucceeds(update(ref(adminJP, relatoPath), { respostaOficial: "Equipe enviada.", dataResposta: serverTimestamp() }));
  await assertSucceeds(update(ref(cidadao), voto));
  const exclusao = { [relatoPath]: null, [resumoPath]: null, [mapaPath]: null, [`votos/${id}`]: null };
  await exigirTodosOsCaminhos(adminJP, exclusao, Object.keys(exclusao));
  await assertFails(update(ref(adminCG), exclusao));
  await assertSucceeds(update(ref(adminJP), exclusao));
  for (const caminho of [relatoPath, resumoPath, mapaPath]) {
    assert.equal((await get(ref(cidadao, caminho))).exists(), false);
  }
});

test('reversão para Paraíba permite criar relato de João Pessoa com as demais validações', async () => {
  const regras = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
  configurarAbrangencia(fs.readFileSync(path.join(__dirname, '..', 'js', 'abrangencia-relatos.js'), 'utf8'), regras, 'paraiba');
  const ambientePB = await initializeTestEnvironment({
    projectId: 'demo-pro-povo-reversao',
    database: { host: '127.0.0.1', port: 9012, rules: JSON.stringify(regras) }
  });
  try {
    await ambientePB.withSecurityRulesDisabled(async contexto => {
      await set(ref(contexto.database(), 'usuarios/cidadao'), {
        nome: relatoBase.autorNome, email: 'cidadao@example.com', cidade: 'João Pessoa', dataCadastro: Date.now()
      });
    });
    const db = ambientePB.authenticatedContext('cidadao', { email: 'cidadao@example.com', email_verified: true }).database();
    const relato = { ...relatoBase, dataCriacao: serverTimestamp() };
    const payload = {
      'relatos/reversao': relato,
      'relatosResumo/reversao': resumoPublico(relato),
      'relatosMapa/2507507/reversao': marcadorPublico(relato),
      'limitesEnvio/cidadao': relato.dataCriacao
    };
    await assertFails(set(ref(db, 'relatos/reversao'), relato));
    await assertSucceeds(update(ref(db), payload));
  } finally {
    await ambientePB.cleanup();
  }
});

test("legados sem coordenadas continuam votáveis sem permitir coordenadas inventadas", async () => {
  const legado = { ...relatoLegado };
  delete legado.lat;
  delete legado.lng;
  const relatoPath = "relatos/legadoSemCoordenadas";
  const resumoPath = "relatosResumo/legadoSemCoordenadas";
  const mapaPath = "relatosMapa/2504009/legadoSemCoordenadas";
  const db = ambiente.authenticatedContext("cidadao", { email_verified: true }).database();
  await ambiente.withSecurityRulesDisabled(async contexto => {
    await update(ref(contexto.database()), {
      [relatoPath]: legado,
      [resumoPath]: resumoPublico(legado),
      [mapaPath]: marcadorPublico(legado),
    });
  });
  const voto = {
    "votos/legadoSemCoordenadas/cidadao": true,
    [`${relatoPath}/votos`]: 3,
    [`${resumoPath}/votos`]: 3,
    [`${mapaPath}/votos`]: 3,
  };
  await assertFails(update(ref(db), { ...voto, [`${mapaPath}/lat`]: -7.12, [`${mapaPath}/lng`]: -35.88 }));
  await assertSucceeds(update(ref(db), voto));
  const marcador = (await get(ref(db, mapaPath))).val();
  assert.equal(marcador.cityId, 2504009);
  assert.equal(marcador.lat, undefined);
  assert.equal(marcador.lng, undefined);
});
