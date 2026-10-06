// ── Pro Povo — db.js ──
// Funções para salvar e buscar dados no Realtime Database

import {
  auth, db,
  ref, set, get, onValue, update, push,
  query, orderByChild, equalTo, limitToLast, startAt, endAt, serverTimestamp
} from "./firebase.js";
import { uploadImagem } from "./cloudinary.js";
import { resolverCityId } from "./cidades.js";
import { invalidarCacheRelatos, lerCache, salvarCache } from "./cache.js";

// ── Salvar usuário após cadastro ──
export async function salvarUsuario(uid, dados) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Usuário autenticado inválido.');
  }
  await set(ref(db, `usuarios/${uid}`), {
    nome:         dados.nome,
    email:        dados.email,
    cidade:       dados.cidade,
    dataCadastro: serverTimestamp()
  });
}

// ── Converter endereço em latitude/longitude (gratuito, sem chave) ──
export async function geocodificar(endereco, cidade = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const query = encodeURIComponent(`${endereco}, ${cidade}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`;
    const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal: controller.signal });
    if (!resp.ok) return null;
    const dados = await resp.json();
    if (dados && dados[0]) {
      return { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
    }
  } catch (e) {
    console.warn('Não foi possível geocodificar o endereço:', e);
  } finally {
    clearTimeout(timeout);
  }
  return null;
}


const INTERVALO_MINIMO_ENVIO = 5 * 60 * 1000; // 5 minutos
const CATEGORIAS_RELATO = new Set([
  'Buraco / Via danificada',
  'Iluminação pública',
  'Lixo / Entulho',
  'Água / Esgoto',
  'Áreas verdes',
  'Outros'
]);

function erroEnvio(codigo, mensagem) {
  const erro = new Error(mensagem);
  erro.code = codigo;
  return erro;
}

function ehErroPermissao(erro) {
  const codigo = String(erro?.code || '').toLowerCase().replaceAll('_', '-');
  return codigo.includes('permission-denied');
}


export async function tempoRestanteParaEnviar(uid) {
  const snapshot = await get(ref(db, `limitesEnvio/${uid}`));
  if (!snapshot.exists()) return 0;
  let agora = Date.now();
  try {
    const offsetSnapshot = await get(ref(db, '.info/serverTimeOffset'));
    const offset = Number(offsetSnapshot.val());
    if (Number.isFinite(offset)) agora += offset;
  } catch (_) {
    // Se o metadado estiver temporariamente indisponível, usa o relógio local.
  }
  const passou = agora - snapshot.val();
  const restante = INTERVALO_MINIMO_ENVIO - passou;
  return restante > 0 ? restante : 0;
}

// ── Criar novo relato ──
export async function criarRelato(dados, fotoFile) {
  if (!auth.currentUser || auth.currentUser.uid !== dados.autorId) {
    throw erroEnvio('USUARIO_NAO_AUTENTICADO', 'Faça login novamente antes de enviar o relato.');
  }

  if (!auth.currentUser.emailVerified) {
    throw erroEnvio('EMAIL_NAO_VERIFICADO', 'Confirme seu e-mail antes de enviar um relato.');
  }

  // Atualiza a claim email_verified usada pelas regras do banco.
  await auth.currentUser.getIdToken(true);

  if (typeof dados.titulo !== 'string' || dados.titulo.length < 5 || dados.titulo.length > 100) {
    throw erroEnvio('TITULO_INVALIDO', 'O título deve ter entre 5 e 100 caracteres.');
  }
  if (!CATEGORIAS_RELATO.has(dados.categoria)) {
    throw erroEnvio('CATEGORIA_INVALIDA', 'Selecione uma categoria válida.');
  }
  if (typeof dados.descricao !== 'string' || dados.descricao.length < 10 || dados.descricao.length > 2000) {
    throw erroEnvio('DESCRICAO_INVALIDA', 'A descrição deve ter entre 10 e 2000 caracteres.');
  }
  if (typeof dados.endereco !== 'string' || dados.endereco.length < 3 || dados.endereco.length > 300) {
    throw erroEnvio('ENDERECO_INVALIDO', 'Selecione um endereço válido na lista de sugestões.');
  }
  if (!Number.isFinite(dados.lat) || !Number.isFinite(dados.lng) ||
      dados.lat < -8.31 || dados.lat > -6.02 || dados.lng < -38.85 || dados.lng > -34.79) {
    throw erroEnvio('LOCALIZACAO_INVALIDA', 'O endereço precisa estar localizado na Paraíba.');
  }
  if (typeof dados.bairro !== 'string' || dados.bairro.length < 1 || dados.bairro.length > 120) {
    throw erroEnvio('BAIRRO_INVALIDO', 'Informe um bairro válido para o relato.');
  }

  const cityId = dados.cityId || await resolverCityId(dados.cidade);
  if (!/^25\d{5}$/.test(String(cityId || '')) ||
      typeof dados.cidade !== 'string' || dados.cidade.length < 2 || dados.cidade.length > 100) {
    throw erroEnvio('CIDADE_INVALIDA', 'Selecione uma cidade válida da Paraíba.');
  }

  const perfil = await buscarUsuario(dados.autorId);
  const cidadePerfilValida = typeof perfil?.cidade === 'string' &&
    perfil.cidade.trim().length >= 2 && perfil.cidade.length <= 100;
  if (!cidadePerfilValida) {
    throw erroEnvio(
      'PERFIL_SEM_CIDADE',
      'Seu perfil não possui uma cidade. Abra “Meu perfil”, selecione sua cidade e salve antes de enviar.'
    );
  }
  const nomePerfilValido = typeof perfil.nome === 'string' &&
    perfil.nome.trim().length >= 1 && perfil.nome.length <= 100;
  const emailPerfilValido = typeof perfil.email === 'string' &&
    perfil.email === auth.currentUser.email && perfil.email.length <= 254;
  if (!nomePerfilValido || !emailPerfilValido || !Number.isFinite(perfil.dataCadastro)) {
    throw erroEnvio(
      'PERFIL_INCOMPLETO',
      'Complete e salve seu perfil antes de enviar um relato.'
    );
  }

  // Evita um upload órfão no fluxo normal; a verificação definitiva e imune a
  // concorrência continua sendo feita pelas Rules na gravação atômica abaixo.
  if (await tempoRestanteParaEnviar(dados.autorId) > 0) {
    const erro = new Error('Aguarde antes de enviar outro relato.');
    erro.code = 'LIMITE_ENVIO';
    throw erro;
  }

  let fotoUrl = null;

  // Upload da foto via Cloudinary (se houver)
  if (fotoFile) {
    const tiposPermitidos = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
    if (!tiposPermitidos.has(fotoFile.type) || fotoFile.size > 10 * 1024 * 1024) {
      throw erroEnvio('FOTO_INVALIDA', 'A foto deve ser JPG, PNG, WebP ou HEIC e ter no máximo 10 MB.');
    }
    fotoUrl = await uploadImagem(fotoFile);
    if (!fotoUrl) {
      throw erroEnvio(
        'ERRO_UPLOAD_IMAGEM',
        'A foto não pôde ser enviada. Verifique sua conexão e tente novamente.'
      );
    }
  }

  // Usa o relógio do Firebase. Assim, um celular ou computador com data/hora
  // incorreta não é recusado pelas regras de segurança.
  const agora = serverTimestamp();
  const novoRef = push(ref(db, 'relatos'));
  const relato = {
    titulo:      dados.titulo,
    categoria:   dados.categoria,
    descricao:   dados.descricao,
    endereco:    dados.endereco,
    lat:         dados.lat,
    lng:         dados.lng,
    cidade:      dados.cidade,
    cityId,
    status:      'aberto',
    votos:       0,
    autorId:     dados.autorId,
    autorNome:   perfil.nome,
    dataCriacao: agora
  };
  const contatoRelato = {
    autorId:     dados.autorId,
    nome:        perfil.nome,
    email:       auth.currentUser.email || perfil.email,
    cityId,
    dataCriacao: agora
  };
  if (dados.bairro) relato.bairro = dados.bairro;
  if (fotoUrl) relato.fotoUrl = fotoUrl;

  // As Rules só aceitam a criação se relato e cooldown forem atualizados juntos.
  // O cliente não consegue criar um relato isolado, forjar votos/status nem
  // reutilizar um timestamp para contornar o intervalo mínimo.
  try {
    await update(ref(db), {
      [`relatos/${novoRef.key}`]: relato,
      [`contatosRelatos/${novoRef.key}`]: contatoRelato,
      [`limitesEnvio/${dados.autorId}`]: agora
    });
    invalidarCacheRelatos();
  } catch (erro) {
    if (ehErroPermissao(erro)) {
      try {
        if (await tempoRestanteParaEnviar(dados.autorId) > 0) {
          erro.code = 'LIMITE_ENVIO';
        }
      } catch (_) {
        // Mantém o erro original quando nem o cooldown pode ser consultado.
      }
    }
    throw erro;
  }

  return novoRef.key;
}

// ── Buscar dados do perfil do usuário ──
export async function buscarUsuario(uid) {
  const snapshot = await get(ref(db, `usuarios/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// Contato privado ligado a um relato. As Rules permitem a leitura somente ao
// autor, ao superadmin ou ao administrador responsavel pela cidade do relato.
export async function buscarContatoRelato(relatoId) {
  const snapshot = await get(ref(db, `contatosRelatos/${relatoId}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// ── Atualizar dados do perfil (nome, e-mail e cidade) ──
// O e-mail é reenviado aqui mesmo sem ter mudado: as regras do banco exigem que
// nome/email/cidade/dataCadastro existam juntos em usuarios/{uid}. Se um registro
// antigo estiver incompleto, esta gravação o normaliza em vez de falhar.
export async function atualizarUsuario(uid, dados) {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Usuário autenticado inválido.');
  }

  const usuarioRef = ref(db, `usuarios/${uid}`);
  const snapshot = await get(usuarioRef);
  const perfilAtual = snapshot.exists() ? snapshot.val() : null;
  const agora = serverTimestamp();
  const atualizacoes = {
    nome:            dados.nome,
    email:           dados.email,
    cidade:          dados.cidade,
    dataAtualizacao: agora
  };

  // As regras exigem dataCadastro no registro completo. Contas antigas podem
  // ter sido criadas antes desse campo existir, então o inicializamos uma vez.
  if (!perfilAtual || !Object.prototype.hasOwnProperty.call(perfilAtual, 'dataCadastro')) {
    atualizacoes.dataCadastro = agora;
  }

  await update(usuarioRef, atualizacoes);
}

const contatosRelatosVerificados = new Set();

async function garantirContatosPrivados(uid, relatos) {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) return;

  const pendentes = relatos.filter(relato => !contatosRelatosVerificados.has(relato.id));
  if (pendentes.length === 0) return;
  pendentes.forEach(relato => contatosRelatosVerificados.add(relato.id));

  try {
    await auth.currentUser.getIdToken(true);
    const resultados = await Promise.all(pendentes.map(async relato => {
      const snapshot = await get(ref(db, `contatosRelatos/${relato.id}`));
      return snapshot.exists() ? null : relato;
    }));

    const atualizacoes = {};
    resultados.filter(Boolean).forEach(relato => {
      atualizacoes[`contatosRelatos/${relato.id}`] = {
        autorId: uid,
        nome: relato.autorNome,
        email: auth.currentUser.email,
        cityId: relato.cityId,
        dataCriacao: relato.dataCriacao
      };
    });

    if (Object.keys(atualizacoes).length > 0) {
      await update(ref(db), atualizacoes);
    }
  } catch (erro) {
    pendentes.forEach(relato => contatosRelatosVerificados.delete(relato.id));
    console.warn('Não foi possível preparar os contatos privados dos relatos antigos:', erro);
  }
}

// ── Ouvir, em tempo real, apenas os relatos criados pelo próprio usuário ──
export function ouvirRelatosDoUsuario(uid, callback) {
  const consulta = query(ref(db, "relatos"), orderByChild("autorId"), equalTo(uid));
  return onValue(consulta, (snapshot) => {
    const dados = snapshot.val();
    if (!dados) { callback([]); return; }
    const lista = Object.entries(dados)
      .map(([id, relato]) => ({ id, ...relato }));
    lista.sort((a, b) => b.dataCriacao - a.dataCriacao);
    callback(lista);
    void garantirContatosPrivados(uid, lista);
  });
}

// ── Cidadão edita seu próprio relato (só título, categoria e descrição) ──
export async function atualizarRelatoDoUsuario(relatoId, dados) {
  await update(ref(db, `relatos/${relatoId}`), {
    titulo:     dados.titulo,
    categoria:  dados.categoria,
    descricao:  dados.descricao,
    dataEdicao: serverTimestamp()
  });
  invalidarCacheRelatos();
}

export async function buscarOrganizacao(organizacaoId) {
  if (!organizacaoId) return null;
  const snapshot = await get(ref(db, `organizacoes/${organizacaoId}`));
  return snapshot.exists() ? snapshot.val() : null;
}

// Mapa público: consulta somente uma cidade, limita os marcadores e reaproveita
// por cinco minutos a última cidade visitada.
export async function buscarRelatosMapa(cityId, tamanho = 500, usarCache = true) {
  if (!/^25\d{5}$/.test(String(cityId || ''))) {
    throw new Error('Cidade inválida para consulta do mapa.');
  }

  const limite = Math.min(Math.max(Number(tamanho) || 1, 1), 500);
  // Mantém apenas uma cidade do mapa por limite, evitando ocupar o
  // localStorage com até 500 relatos para cada município visitado.
  const chaveCache = `relatos:mapa:${limite}`;
  if (usarCache) {
    const cache = lerCache(chaveCache);
    if (cache?.cityId === cityId) return cache.relatos;
  }

  const consulta = query(
    ref(db, "relatos"),
    orderByChild("cityId"),
    equalTo(cityId),
    limitToLast(limite)
  );

  const snapshot = await get(consulta);
  const lista = Object.entries(snapshot.val() || {})
    .map(([id, relato]) => ({ id, ...relato }))
    .sort((a, b) => (b.dataCriacao || 0) - (a.dataCriacao || 0));
  salvarCache(chaveCache, { cityId, relatos: lista });
  return lista;
}

// ── Feed limitado pra home: só os N relatos mais votados ──
// Evita que a página mais visitada do site baixe a tabela inteira pra mostrar
// só 5 cards. "tamanho" é intencionalmente maior que os 5 exibidos, pra
// sobrar folga pros filtros de categoria/status feitos no cliente.
export async function buscarRelatosDestaque(tamanho = 50, usarCache = true) {
  const limite = Math.min(Math.max(Number(tamanho) || 1, 1), 100);
  const chaveCache = `relatos:destaque:${limite}`;
  if (usarCache) {
    const cache = lerCache(chaveCache);
    if (cache !== undefined) return cache;
  }

  const consulta = query(ref(db, "relatos"), orderByChild("votos"), limitToLast(limite));
  const snapshot = await get(consulta);
  const lista = Object.entries(snapshot.val() || {}).map(([id, r]) => ({ id, ...r }));
  lista.sort((a, b) => (b.votos || 0) - (a.votos || 0));
  salvarCache(chaveCache, lista);
  return lista;
}

// ── Feed limitado pra home: só os N relatos mais recentes ──
export async function buscarRelatosRecentes(tamanho = 50, usarCache = true) {
  const limite = Math.min(Math.max(Number(tamanho) || 1, 1), 100);
  const chaveCache = `relatos:recentes:${limite}`;
  if (usarCache) {
    const cache = lerCache(chaveCache);
    if (cache !== undefined) return cache;
  }

  const consulta = query(ref(db, "relatos"), orderByChild("dataCriacao"), limitToLast(limite));
  const snapshot = await get(consulta);
  const lista = Object.entries(snapshot.val() || {}).map(([id, r]) => ({ id, ...r }));
  lista.sort((a, b) => b.dataCriacao - a.dataCriacao);
  salvarCache(chaveCache, lista);
  return lista;
}

const TAMANHO_PAGINA_PADRAO = 30;

// ── Página de relatos ordenados por data (mais recentes primeiro) ──
// Usada pela tela "Todos os relatos" (relatos.js), que precisa listar tudo mas
// não pode baixar tudo de uma vez. Chame sem "cursor" pra pegar a primeira
// página; pra próxima, passe { dataCriacao, id } do último relato já
// carregado. O par (dataCriacao, id) no endAt evita pular ou repetir relatos
// quando dois deles têm exatamente o mesmo timestamp.
export async function buscarRelatosPagina(cursor = null, tamanho = TAMANHO_PAGINA_PADRAO, opcoes = {}) {
  const { usarCache = false } = opcoes;
  const chaveCache = !cursor ? `relatos:pagina-inicial:${tamanho}` : null;
  if (usarCache && chaveCache) {
    const cache = lerCache(chaveCache);
    if (cache !== undefined) return cache;
  }

  const consulta = cursor
    ? query(ref(db, "relatos"), orderByChild("dataCriacao"), endAt(cursor.dataCriacao, cursor.id), limitToLast(tamanho + 2))
    : query(ref(db, "relatos"), orderByChild("dataCriacao"), limitToLast(tamanho + 1));

  const snapshot = await get(consulta);
  const dados = snapshot.val();
  if (!dados) {
    const resultadoVazio = { itens: [], temMais: false };
    if (usarCache && chaveCache) salvarCache(chaveCache, resultadoVazio);
    return resultadoVazio;
  }

  let lista = Object.entries(dados).map(([id, r]) => ({ id, ...r }));
  if (cursor) lista = lista.filter(r => r.id !== cursor.id); // o endAt inclui de novo o cursor

  lista.sort((a, b) =>
    (b.dataCriacao - a.dataCriacao) || b.id.localeCompare(a.id)
  ); // mais recente primeiro; a chave desempata timestamps iguais

  const temMais = lista.length > tamanho;
  if (temMais) lista = lista.slice(0, tamanho);

  const resultado = { itens: lista, temMais };
  if (usarCache && chaveCache) salvarCache(chaveCache, resultado);
  return resultado;
}

// ── Votar num relato (sem voto duplo) ──
export async function votar(relatoId, userId) {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Usuário autenticado inválido.');
  }
  await auth.currentUser.getIdToken(true);

  // A atualização atômica mantém o voto individual e o total sincronizados.
  // Em concorrência, as Rules rejeitam um total obsoleto; a nova tentativa lê
  // o valor atual sem permitir contagem dupla ou alteração arbitrária.
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const [votoSnapshot, totalSnapshot] = await Promise.all([
      get(ref(db, `votos/${relatoId}/${userId}`)),
      get(ref(db, `relatos/${relatoId}/votos`))
    ]);
    if (!totalSnapshot.exists()) throw new Error('Relato não encontrado.');

    const jaExiste = votoSnapshot.exists();
    const totalAtual = Number(totalSnapshot.val()) || 0;
    const atualizacoes = {
      [`votos/${relatoId}/${userId}`]: jaExiste ? null : true,
      [`relatos/${relatoId}/votos`]: jaExiste ? Math.max(0, totalAtual - 1) : totalAtual + 1
    };

    try {
      await update(ref(db), atualizacoes);
      invalidarCacheRelatos();
      return !jaExiste;
    } catch (erro) {
      const concorrencia = ehErroPermissao(erro);
      if (!concorrencia || tentativa === 2) throw erro;
    }
  }

  throw new Error('Não foi possível registrar o voto.');
}

// ── Verificar se usuário já votou ──
export async function jaVotou(relatoId, userId) {
  const snapshot = await get(ref(db, `votos/${relatoId}/${userId}`));
  return snapshot.exists();
}

// ── Atualizar status de um relato ──
export async function atualizarStatus(relatoId, novoStatus) {
  await update(ref(db, `relatos/${relatoId}`), {
    status: novoStatus,
    dataResolucao: novoStatus === 'resolvido' ? serverTimestamp() : null
  });
  invalidarCacheRelatos();
}

// ── Salvar resposta oficial da prefeitura ──
export async function salvarResposta(relatoId, resposta) {
  await update(ref(db, `relatos/${relatoId}`), {
    respostaOficial: resposta,
    dataResposta: serverTimestamp()
  });
  invalidarCacheRelatos();
}

// ── Excluir relato ──
export async function excluirRelato(relatoId) {
  await update(ref(db), {
    [`relatos/${relatoId}`]: null,
    [`votos/${relatoId}`]: null
  });
  invalidarCacheRelatos();
}

// Página administrativa. Superadmins usam a ordenação global por data;
// admins municipais usam cityId e as chaves push, que também são cronológicas.
// Em ambos os casos apenas um lote é transferido por chamada.
export async function buscarRelatosGestaoPagina(admin, cursor = null, tamanho = TAMANHO_PAGINA_PADRAO) {
  if (!admin) throw new Error('Administrador não identificado.');
  tamanho = Math.min(Math.max(Number(tamanho) || TAMANHO_PAGINA_PADRAO, 1), 500);

  if (admin.papel === 'superadmin') {
    return buscarRelatosPagina(cursor, tamanho);
  }

  if (!admin.cityId) {
    throw new Error('Administrador municipal sem cidade vinculada.');
  }

  const consulta = cursor
    ? query(
        ref(db, "relatos"),
        orderByChild("cityId"),
        startAt(admin.cityId),
        endAt(admin.cityId, cursor.id),
        limitToLast(tamanho + 2)
      )
    : query(
        ref(db, "relatos"),
        orderByChild("cityId"),
        startAt(admin.cityId),
        endAt(admin.cityId),
        limitToLast(tamanho + 1)
      );

  const snapshot = await get(consulta);
  let lista = Object.entries(snapshot.val() || {})
    .map(([id, relato]) => ({ id, ...relato }));
  if (cursor) lista = lista.filter(relato => relato.id !== cursor.id);

  // Dentro do mesmo cityId, o Realtime Database desempata pela chave.
  lista.sort((a, b) => b.id.localeCompare(a.id));
  const temMais = lista.length > tamanho;
  if (temMais) lista = lista.slice(0, tamanho);
  return { itens: lista, temMais };
}

// Os gráficos administrativos precisam do conjunto completo. A leitura segue
// paginada para limitar o tamanho de cada resposta, mas percorre todos os lotes
// do escopo autorizado antes de montar as estatísticas.
export async function buscarTodosRelatosGestao(admin, onProgresso = null, tamanhoLote = 500) {
  const relatosPorId = new Map();
  let cursor = null;
  let temMais = true;

  while (temMais) {
    const pagina = await buscarRelatosGestaoPagina(admin, cursor, tamanhoLote);
    pagina.itens.forEach(relato => relatosPorId.set(relato.id, relato));
    temMais = pagina.temMais;
    onProgresso?.(relatosPorId.size);

    const ultimo = pagina.itens[pagina.itens.length - 1];
    if (!temMais || !ultimo) break;

    const proximoCursor = { id: ultimo.id, dataCriacao: ultimo.dataCriacao };
    if (cursor?.id === proximoCursor.id) {
      throw new Error('A paginação dos relatos não avançou.');
    }
    cursor = proximoCursor;
  }

  return [...relatosPorId.values()].sort((a, b) =>
    ((b.dataCriacao || 0) - (a.dataCriacao || 0)) || b.id.localeCompare(a.id)
  );
}
