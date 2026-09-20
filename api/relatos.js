const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { v2: cloudinary } = require('cloudinary');

const INTERVALO_MINIMO_ENVIO = 5 * 60 * 1000;
const CLOUD_NAME_PADRAO = 'dk8uky6m';
const UPLOAD_PRESET_PADRAO = 'pro_povo_imagens';
const FIREBASE_PROJECT_ID_PADRAO = 'pro--povo';
const FIREBASE_DATABASE_URL_PADRAO = 'https://pro--povo-default-rtdb.firebaseio.com';

class ErroHttp extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

function exigirVariavel(nome) {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

function obterFirebase() {
  const appExistente = getApps()[0];
  if (appExistente) return appExistente;

  const projectId = process.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID_PADRAO;
  const clientEmail = exigirVariavel('FIREBASE_CLIENT_EMAIL');
  const privateKey = exigirVariavel('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL || FIREBASE_DATABASE_URL_PADRAO;

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL
  });
}

function obterCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || CLOUD_NAME_PADRAO;
  const apiKey = exigirVariavel('CLOUDINARY_API_KEY');
  const apiSecret = exigirVariavel('CLOUDINARY_API_SECRET');

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  return {
    apiKey,
    apiSecret,
    cloudName,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || UPLOAD_PRESET_PADRAO
  };
}

function obterBearer(req) {
  const cabecalho = req.headers.authorization || '';
  const correspondencia = cabecalho.match(/^Bearer\s+(.+)$/i);
  if (!correspondencia) {
    throw new ErroHttp(401, 'NAO_AUTENTICADO', 'Faça login novamente para continuar.');
  }
  return correspondencia[1];
}

function obterCorpo(req) {
  try {
    if (!req.body) return {};
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
    return req.body;
  } catch {
    throw new ErroHttp(400, 'JSON_INVALIDO', 'O corpo da requisição não é um JSON válido.');
  }
}

function validarRelatoId(relatoId) {
  if (typeof relatoId !== 'string' || !/^[-A-Za-z0-9_]{20}$/.test(relatoId)) {
    throw new ErroHttp(400, 'RELATO_INVALIDO', 'Identificador de relato inválido.');
  }
  return relatoId;
}

function publicIdEsperado(uid, relatoId) {
  return `pro_povo/${uid}/${relatoId}`;
}

function podeExcluirRelato(uid, relato, admin) {
  if (relato?.autorId === uid && relato.status === 'aberto') return true;
  if (admin === true) return true;
  if (!admin || admin.ativo !== true) return false;
  if (admin.papel === 'superadmin') return true;
  return admin.papel === 'admin' && admin.cityId === relato?.cityId;
}

function extrairPublicIdCloudinary(url, cloudName = CLOUD_NAME_PADRAO) {
  if (typeof url !== 'string') return null;

  try {
    const imagem = new URL(url);
    const prefixo = `/${cloudName}/image/upload/`;
    if (imagem.protocol !== 'https:' || imagem.hostname !== 'res.cloudinary.com') return null;
    if (!imagem.pathname.startsWith(prefixo)) return null;

    const partes = imagem.pathname.slice(prefixo.length).split('/').filter(Boolean);
    const indiceVersao = partes.findIndex(parte => /^v\d+$/.test(parte));
    const partesDoAtivo = indiceVersao >= 0 ? partes.slice(indiceVersao + 1) : partes;
    if (partesDoAtivo.length === 0) return null;

    partesDoAtivo[partesDoAtivo.length - 1] = partesDoAtivo.at(-1).replace(/\.[A-Za-z0-9]{1,10}$/, '');
    const publicId = decodeURIComponent(partesDoAtivo.join('/'));
    return publicId && !publicId.includes('..') ? publicId : null;
  } catch {
    return null;
  }
}

async function autenticar(req) {
  const app = obterFirebase();
  const token = obterBearer(req);
  try {
    return await getAuth(app).verifyIdToken(token, true);
  } catch {
    throw new ErroHttp(401, 'TOKEN_INVALIDO', 'Sua sessão expirou. Faça login novamente.');
  }
}

async function destruirImagem(publicId) {
  obterCloudinary();
  const resultado = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true
  });

  if (!['ok', 'not found'].includes(resultado?.result)) {
    throw new Error(`O Cloudinary não confirmou a exclusão: ${resultado?.result || 'sem resposta'}`);
  }
  return resultado.result;
}

async function assinarUpload(decoded, relatoId) {
  if (decoded.email_verified !== true) {
    throw new ErroHttp(403, 'EMAIL_NAO_VERIFICADO', 'Confirme seu e-mail antes de enviar uma imagem.');
  }

  const app = obterFirebase();
  const db = getDatabase(app);
  const [limiteSnapshot, relatoSnapshot] = await Promise.all([
    db.ref(`limitesEnvio/${decoded.uid}`).get(),
    db.ref(`relatos/${relatoId}`).get()
  ]);

  if (relatoSnapshot.exists()) {
    throw new ErroHttp(409, 'RELATO_JA_EXISTE', 'Este identificador de relato já está em uso.');
  }

  const ultimoEnvio = Number(limiteSnapshot.val());
  if (Number.isFinite(ultimoEnvio) && Date.now() - ultimoEnvio < INTERVALO_MINIMO_ENVIO) {
    throw new ErroHttp(429, 'LIMITE_ENVIO', 'Aguarde antes de enviar outro relato.');
  }

  const configuracao = obterCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = publicIdEsperado(decoded.uid, relatoId);
  const parametros = {
    overwrite: false,
    public_id: publicId,
    return_delete_token: true,
    timestamp,
    upload_preset: configuracao.uploadPreset
  };

  return {
    apiKey: configuracao.apiKey,
    cloudName: configuracao.cloudName,
    overwrite: false,
    publicId,
    returnDeleteToken: true,
    signature: cloudinary.utils.api_sign_request(parametros, configuracao.apiSecret),
    timestamp,
    uploadPreset: configuracao.uploadPreset
  };
}

async function cancelarUpload(decoded, relatoId) {
  const app = obterFirebase();
  const relatoSnapshot = await getDatabase(app).ref(`relatos/${relatoId}`).get();
  if (relatoSnapshot.exists()) {
    throw new ErroHttp(409, 'RELATO_JA_EXISTE', 'Use a exclusão normal para remover a imagem deste relato.');
  }

  const publicId = publicIdEsperado(decoded.uid, relatoId);
  const resultado = await destruirImagem(publicId);
  return { ok: true, imagem: resultado };
}

async function excluirRelato(decoded, relatoId) {
  const app = obterFirebase();
  const db = getDatabase(app);
  const [relatoSnapshot, adminSnapshot] = await Promise.all([
    db.ref(`relatos/${relatoId}`).get(),
    db.ref(`admins/${decoded.uid}`).get()
  ]);

  if (!relatoSnapshot.exists()) {
    return { ok: true, imagem: 'relato-ja-excluido' };
  }

  const relato = relatoSnapshot.val();
  if (!podeExcluirRelato(decoded.uid, relato, adminSnapshot.val())) {
    throw new ErroHttp(403, 'SEM_PERMISSAO', 'Você não tem permissão para excluir este relato.');
  }

  let publicId = null;
  let imagem = 'ausente';

  if (relato.fotoUrl) {
    const esperado = publicIdEsperado(relato.autorId, relatoId);

    if (relato.fotoPublicId) {
      if (relato.fotoPublicId !== esperado) {
        throw new ErroHttp(409, 'IMAGEM_INCONSISTENTE', 'O identificador da imagem do relato é inconsistente.');
      }
      publicId = esperado;
    } else {
      // Compatibilidade com fotos enviadas antes do upload assinado. A imagem só
      // é removida quando nenhum outro relato aponta para a mesma URL.
      const configuracao = obterCloudinary();
      publicId = extrairPublicIdCloudinary(relato.fotoUrl, configuracao.cloudName);
      if (!publicId) {
        throw new ErroHttp(409, 'IMAGEM_LEGADA_INVALIDA', 'Não foi possível identificar a imagem antiga deste relato.');
      }

      const referencias = await db.ref('relatos')
        .orderByChild('fotoUrl')
        .equalTo(relato.fotoUrl)
        .limitToFirst(2)
        .get();

      if (referencias.numChildren() > 1) {
        publicId = null;
        imagem = 'preservada-em-uso';
      }
    }
  }

  if (publicId) imagem = await destruirImagem(publicId);

  // A remoção do relato, dos votos e do contato privado continua atômica.
  // Se esta etapa falhar, repetir a chamada é seguro: o Cloudinary responde
  // "not found" para uma imagem que já tenha sido removida.
  await db.ref().update({
    [`relatos/${relatoId}`]: null,
    [`votos/${relatoId}`]: null,
    [`contatosRelatos/${relatoId}`]: null
  });

  return { ok: true, imagem };
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ codigo: 'METODO_INVALIDO', erro: 'Use o método POST.' });
  }

  try {
    const corpo = obterCorpo(req);
    const relatoId = validarRelatoId(corpo.relatoId);
    const decoded = await autenticar(req);

    let resposta;
    if (corpo.acao === 'assinar-upload') resposta = await assinarUpload(decoded, relatoId);
    else if (corpo.acao === 'cancelar-upload') resposta = await cancelarUpload(decoded, relatoId);
    else if (corpo.acao === 'excluir') resposta = await excluirRelato(decoded, relatoId);
    else throw new ErroHttp(400, 'ACAO_INVALIDA', 'Ação inválida.');

    return res.status(200).json(resposta);
  } catch (erro) {
    const status = erro instanceof ErroHttp ? erro.status : 500;
    const codigo = erro instanceof ErroHttp ? erro.codigo : 'ERRO_INTERNO';
    if (status >= 500) console.error('Erro na API de relatos:', erro);
    return res.status(status).json({
      codigo,
      erro: status >= 500 ? 'Não foi possível concluir a operação.' : erro.message
    });
  }
}

module.exports = handler;
module.exports._internals = {
  extrairPublicIdCloudinary,
  podeExcluirRelato,
  publicIdEsperado,
  validarRelatoId
};
