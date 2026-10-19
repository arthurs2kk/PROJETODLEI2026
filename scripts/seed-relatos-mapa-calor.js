"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { cert, deleteApp, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const PROJECT_ID = "pro--povo";
const DATABASE_URL = "https://pro--povo-default-rtdb.firebaseio.com";
const CITY_ID = "2504009";
const CIDADE = "Campina Grande";

// Este prefixo não aparece na interface, mas identifica todos os registros
// fictícios e permite apagá-los em lote sem atingir relatos reais.
const PREFIXO_ID = "teste-mapa-calor-";
const TOTAL_PADRAO = 120;
const AVISO_FICTICIO = "Cenário fictício inserido para demonstração.";

const BAIRROS = [
  { nome: "Centro", lat: -7.2215, lng: -35.8831, vias: ["Rua Maciel Pinheiro", "Rua Venâncio Neiva", "Avenida Floriano Peixoto"] },
  { nome: "Catolé", lat: -7.2308, lng: -35.8814, vias: ["Rua João Quirino", "Rua Vigário Calixto", "Avenida Antônio Villarim"] },
  { nome: "Liberdade", lat: -7.2384, lng: -35.8948, vias: ["Rua Odon Bezerra", "Rua Santa Catarina", "Avenida Assis Chateaubriand"] },
  { nome: "Prata", lat: -7.2174, lng: -35.8994, vias: ["Rua Duque de Caxias", "Rua Rodrigues Alves", "Rua Montevidéu"] },
  { nome: "Bodocongó", lat: -7.2130, lng: -35.9198, vias: ["Rua Aprígio Veloso", "Avenida Portugal", "Rua Engenheiro Lourival Andrade"] },
  { nome: "Alto Branco", lat: -7.2040, lng: -35.8819, vias: ["Rua Manoel Leonardo Gomes", "Avenida Manoel Tavares", "Rua Tomás Soares de Sousa"] },
  { nome: "Malvinas", lat: -7.2200, lng: -35.9280, vias: ["Rua das Umburanas", "Rua dos Jucás", "Rua das Baraúnas"] },
  { nome: "José Pinheiro", lat: -7.2181, lng: -35.8706, vias: ["Rua Campos Sales", "Rua Pedro da Costa Agra", "Rua Joana D'Arc"] },
  { nome: "Cruzeiro", lat: -7.2460, lng: -35.9034, vias: ["Rua Presidente Costa e Silva", "Rua Almirante Barroso", "Rua Dom Pedro II"] },
  { nome: "Dinamérica", lat: -7.2340, lng: -35.9190, vias: ["Avenida Francisco Lopes de Almeida", "Rua Paraná", "Rua Sergipe"] },
  { nome: "Jardim Paulistano", lat: -7.2490, lng: -35.8950, vias: ["Rua São Paulo", "Rua Rio Grande do Sul", "Rua Espírito Santo"] },
  { nome: "Santo Antônio", lat: -7.2090, lng: -35.8720, vias: ["Rua Deputado José Tavares", "Rua Ana de Azevedo", "Rua Pastor Samuel Barbosa"] },
  { nome: "Monte Santo", lat: -7.2110, lng: -35.8920, vias: ["Rua João Suassuna", "Rua Carlos Chagas", "Rua Arrojado Lisboa"] },
  { nome: "Tambor", lat: -7.2520, lng: -35.8830, vias: ["Rua Três Irmãs", "Rua José de Alencar", "Rua Antônio Joaquim Pequeno"] },
  { nome: "Palmeira", lat: -7.2050, lng: -35.8950, vias: ["Rua Estelita Cruz", "Rua Antônio Guedes de Andrade", "Rua Francisco Afonso"] },
  { nome: "Conceição", lat: -7.1990, lng: -35.8840, vias: ["Rua Quinze de Novembro", "Rua Severino Cruz", "Rua João Moura"] },
  { nome: "Cuités", lat: -7.1900, lng: -35.8910, vias: ["Rua das Pitombeiras", "Rua das Mangueiras", "Avenida Plínio Lemos"] },
  { nome: "Velame", lat: -7.2650, lng: -35.8930, vias: ["Rua das Flores", "Rua Projetada", "Rua Maria da Guia Muniz"] },
];

const OCORRENCIAS = [
  {
    categoria: "Buraco / Via danificada",
    casos: [
      ["Buraco aumentando próximo à esquina", "O buraco ocupa parte da faixa e tem aumentado com as chuvas. Motoristas estão desviando perto da esquina, principalmente à noite."],
      ["Asfalto cedendo perto da parada de ônibus", "Há um afundamento no asfalto junto à parada. O desnível está dificultando o embarque e acumulando água depois da chuva."],
      ["Trecho com vários buracos", "Este trecho apresenta vários buracos próximos uns dos outros. Carros e motos precisam reduzir bastante a velocidade para passar."],
      ["Tampa desnivelada no meio da via", "A tampa está abaixo do nível do asfalto e causa um impacto forte nos veículos. Seria importante nivelar e sinalizar o ponto."],
      ["Pavimentação solta na lateral da rua", "Parte da pavimentação se soltou junto ao meio-fio. As pedras estão espalhadas e o espaço de passagem ficou mais estreito."],
    ],
  },
  {
    categoria: "Iluminação pública",
    casos: [
      ["Poste apagado em trecho movimentado", "O poste não acende há alguns dias e deixa o trecho muito escuro depois das 18h. Há circulação frequente de pedestres no local."],
      ["Dois pontos de luz sem funcionar", "Duas luminárias próximas estão apagadas, formando uma área escura no quarteirão. Moradores pedem verificação da rede."],
      ["Lâmpada piscando durante a noite", "A luminária acende e apaga repetidamente durante a noite. Além da baixa visibilidade, o problema incomoda as casas próximas."],
      ["Iluminação fraca perto da praça", "A iluminação existente não cobre bem a calçada e a entrada da praça. O ponto fica com pouca visibilidade no início da noite."],
      ["Braço do poste aparentemente danificado", "O braço da luminária está inclinado e a luz não alcança a rua. É necessária uma avaliação para evitar que a peça se solte."],
    ],
  },
  {
    categoria: "Lixo / Entulho",
    casos: [
      ["Entulho ocupando parte da calçada", "Restos de obra foram deixados na calçada e obrigam pedestres a caminhar pela rua. O material já está se espalhando com a chuva."],
      ["Acúmulo de lixo em terreno aberto", "Sacolas e resíduos domésticos estão se acumulando no terreno. O local começou a atrair insetos e precisa de limpeza."],
      ["Descarte irregular próximo ao cruzamento", "Há móveis velhos, galhos e embalagens descartados perto do cruzamento. O volume reduz a visibilidade de quem entra na rua."],
      ["Lixeira comunitária transbordando", "A lixeira está cheia e há resíduos espalhados ao redor. Moradores relatam que a coleta recente não levou todo o material."],
      ["Galhos e folhas bloqueando a passagem", "Após uma poda, galhos e folhas permaneceram junto ao meio-fio. O material ocupa a passagem e pode entupir o bueiro próximo."],
    ],
  },
  {
    categoria: "Água / Esgoto",
    casos: [
      ["Vazamento constante junto ao meio-fio", "Água limpa corre continuamente pelo meio-fio e já formou uma poça. O vazamento parece vir da calçada e precisa ser verificado."],
      ["Bueiro transbordando após chuva", "O bueiro não dá vazão e a água invade parte da pista quando chove. Folhas e resíduos parecem estar obstruindo a entrada."],
      ["Esgoto correndo a céu aberto", "Há água com mau cheiro saindo de uma caixa e seguindo pela sarjeta. O problema afeta as casas próximas e a passagem de pedestres."],
      ["Poça permanente em frente às residências", "Mesmo em dias sem chuva, permanece uma poça grande no local. A água parada causa mau cheiro e dificulta o acesso às calçadas."],
      ["Tampa de drenagem solta", "A tampa se movimenta quando os veículos passam e há uma abertura na lateral. O ponto oferece risco para bicicletas e pedestres."],
    ],
  },
  {
    categoria: "Áreas verdes",
    casos: [
      ["Árvore com galho sobre a fiação", "Um galho cresceu sobre a rede e balança bastante com o vento. Moradores solicitam avaliação e poda preventiva por equipe adequada."],
      ["Mato alto reduzindo a calçada", "A vegetação avançou sobre a calçada e deixou pouco espaço para passagem. Crianças e idosos estão usando a pista para contornar o trecho."],
      ["Canteiro da praça precisa de manutenção", "O canteiro está com vegetação alta e resíduos acumulados. Uma limpeza deixaria a área de convivência mais segura e utilizável."],
      ["Árvore inclinada perto do passeio", "A árvore apresenta inclinação acentuada em direção à calçada. Seria importante avaliar raízes e estabilidade antes do período de chuvas."],
      ["Poda necessária para liberar a sinalização", "Os galhos encobrem parcialmente a placa e dificultam a leitura por quem se aproxima. Uma poda pontual deve resolver o problema."],
    ],
  },
  {
    categoria: "Outros",
    casos: [
      ["Faixa de pedestres quase apagada", "A pintura está muito desgastada e os motoristas quase não identificam a travessia. O movimento de pedestres é maior nos horários de pico."],
      ["Placa de sinalização danificada", "A placa está torta e voltada para o lado errado, dificultando a leitura. É necessário reposicionar ou substituir o suporte."],
      ["Abrigo do ponto de ônibus danificado", "Parte da cobertura está solta e os bancos apresentam danos. Passageiros ficam sem proteção adequada durante sol e chuva."],
      ["Calçada com desnível perigoso", "Há um desnível acentuado no passeio, sem sinalização. Pessoas com mobilidade reduzida têm dificuldade para atravessar o ponto."],
      ["Semáforo com tempo muito curto", "O tempo de travessia para pedestres termina antes que idosos consigam chegar ao outro lado. Solicita-se avaliação da programação."],
    ],
  },
];

const NOMES_DEMONSTRACAO = [
  "Ana (perfil demonstrativo)",
  "Carlos (perfil demonstrativo)",
  "Joana (perfil demonstrativo)",
  "Marcos (perfil demonstrativo)",
  "Rita (perfil demonstrativo)",
  "Paulo (perfil demonstrativo)",
];

function lerArgumentos(argumentos) {
  const opcoes = {
    aplicar: false,
    remover: false,
    total: TOTAL_PADRAO,
    credencial: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
  };
  for (let indice = 0; indice < argumentos.length; indice += 1) {
    const argumento = argumentos[indice];
    if (argumento === "--apply") opcoes.aplicar = true;
    else if (argumento === "--remove") opcoes.remover = true;
    else if (argumento === "--count") opcoes.total = Number(argumentos[++indice]);
    else if (argumento === "--credentials") opcoes.credencial = argumentos[++indice] || "";
    else throw new Error(`Argumento desconhecido: ${argumento}`);
  }
  if (!Number.isSafeInteger(opcoes.total) || opcoes.total < 1 || opcoes.total > 500) {
    throw new Error("--count deve ser um inteiro entre 1 e 500");
  }
  if (opcoes.aplicar && !opcoes.credencial) {
    throw new Error("Informe --credentials com o arquivo da conta de serviço.");
  }
  return opcoes;
}

function pseudoAleatorio(indice, semente) {
  const valor = Math.sin((indice + 1) * (semente + 17.371)) * 43758.5453123;
  return valor - Math.floor(valor);
}

function escolher(lista, indice, semente) {
  return lista[Math.floor(pseudoAleatorio(indice, semente) * lista.length)];
}

function camposFiltro({ categoria, status }) {
  return {
    filtroCidadeCategoria: `${CITY_ID}|${categoria}`,
    filtroCidadeStatus: `${CITY_ID}|${status}`,
    filtroCategoriaStatus: `${categoria}|${status}`,
    filtroCidadeCategoriaStatus: `${CITY_ID}|${categoria}|${status}`,
  };
}

function statusDoRelato(indice) {
  const sorteio = pseudoAleatorio(indice, 83);
  if (sorteio < 0.58) return "aberto";
  if (sorteio < 0.84) return "andamento";
  return "resolvido";
}

function criarRelato(indice, agora) {
  const bairro = escolher(BAIRROS, indice, 11);
  const grupo = escolher(OCORRENCIAS, indice, 23);
  const [titulo, texto] = escolher(grupo.casos, indice, 37);
  const via = escolher(bairro.vias, indice, 41);
  const numero = 20 + Math.floor(pseudoAleatorio(indice, 47) * 1480);
  const status = statusDoRelato(indice);
  const diasAtras = 1 + Math.floor(pseudoAleatorio(indice, 53) * 54);
  const minutosAtras = Math.floor(pseudoAleatorio(indice, 59) * 720);
  const dataCriacao = agora - diasAtras * 86_400_000 - minutosAtras * 60_000;
  const distancia = Math.sqrt(pseudoAleatorio(indice, 61)) * 0.0048;
  const angulo = pseudoAleatorio(indice, 67) * Math.PI * 2;
  const relato = {
    titulo,
    categoria: grupo.categoria,
    descricao: `${texto} ${AVISO_FICTICIO}`,
    endereco: `${via}, ${numero} — ${bairro.nome}`,
    bairro: bairro.nome,
    cidade: CIDADE,
    cityId: CITY_ID,
    lat: Number((bairro.lat + Math.sin(angulo) * distancia).toFixed(6)),
    lng: Number((bairro.lng + Math.cos(angulo) * distancia).toFixed(6)),
    status,
    votos: Math.floor(pseudoAleatorio(indice, 71) ** 1.7 * 43),
    autorId: `${PREFIXO_ID}perfil-${(indice % NOMES_DEMONSTRACAO.length) + 1}`,
    autorNome: NOMES_DEMONSTRACAO[indice % NOMES_DEMONSTRACAO.length],
    dataCriacao,
    ...camposFiltro({ categoria: grupo.categoria, status }),
  };

  if (status === "resolvido") {
    const prazo = (2 + Math.floor(pseudoAleatorio(indice, 73) * 9)) * 86_400_000;
    relato.dataResposta = Math.min(dataCriacao + prazo, agora - 3_600_000);
    relato.dataResolucao = relato.dataResposta;
    relato.respostaOficial = "Serviço concluído e local vistoriado pela equipe responsável. Registro demonstrativo.";
  } else if (status === "andamento") {
    const prazo = (1 + Math.floor(pseudoAleatorio(indice, 79) * 5)) * 86_400_000;
    relato.dataResposta = Math.min(dataCriacao + prazo, agora - 3_600_000);
    relato.respostaOficial = "Solicitação encaminhada à equipe responsável para avaliação e atendimento. Registro demonstrativo.";
  }

  return relato;
}

function resumoPublico(relato) {
  return {
    titulo: relato.titulo,
    categoria: relato.categoria,
    descricaoResumo: relato.descricao.slice(0, 240),
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    dataCriacao: relato.dataCriacao,
    ...camposFiltro(relato),
  };
}

function detalhePublico(relato) {
  const detalhe = {};
  for (const campo of [
    "titulo", "categoria", "descricao", "endereco", "lat", "lng", "cidade",
    "cityId", "bairro", "status", "votos", "dataCriacao", "dataResolucao",
    "respostaOficial", "dataResposta",
  ]) {
    if (relato[campo] !== undefined) detalhe[campo] = relato[campo];
  }
  return detalhe;
}

function marcadorPublico(relato) {
  return {
    titulo: relato.titulo,
    categoria: relato.categoria,
    endereco: relato.endereco,
    cityId: relato.cityId,
    status: relato.status,
    votos: relato.votos,
    dataCriacao: relato.dataCriacao,
    lat: relato.lat,
    lng: relato.lng,
  };
}

function montarAtualizacoes(total, agora = Date.now(), remover = false) {
  const atualizacoes = {};
  for (let indice = 0; indice < total; indice += 1) {
    const id = `${PREFIXO_ID}${String(indice + 1).padStart(3, "0")}`;
    if (remover) {
      atualizacoes[`relatos/${id}`] = null;
      atualizacoes[`relatosResumo/${id}`] = null;
      atualizacoes[`relatosPublicos/${id}`] = null;
      atualizacoes[`relatosMapa/${CITY_ID}/${id}`] = null;
      atualizacoes[`contatosRelatos/${id}`] = null;
      atualizacoes[`votos/${id}`] = null;
      atualizacoes[`prioridadesMunicipais/${CITY_ID}/${id}`] = null;
      continue;
    }
    const relato = criarRelato(indice, agora);
    atualizacoes[`relatos/${id}`] = relato;
    atualizacoes[`relatosResumo/${id}`] = resumoPublico(relato);
    atualizacoes[`relatosPublicos/${id}`] = detalhePublico(relato);
    atualizacoes[`relatosMapa/${CITY_ID}/${id}`] = marcadorPublico(relato);
  }
  return atualizacoes;
}

async function executar() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  const atualizacoes = montarAtualizacoes(opcoes.total, Date.now(), opcoes.remover);
  const acao = opcoes.remover ? "remover" : "criar/atualizar";
  if (!opcoes.aplicar) {
    console.log(`Simulação: ${acao} ${opcoes.total} relatos fictícios em ${CIDADE}. Use --apply para gravar.`);
    console.log(`Identificador técnico: IDs iniciados por "${PREFIXO_ID}".`);
    return;
  }

  const caminhoCredencial = path.resolve(opcoes.credencial);
  const credencial = JSON.parse(fs.readFileSync(caminhoCredencial, "utf8"));
  const app = initializeApp({ credential: cert(credencial), databaseURL: DATABASE_URL, projectId: PROJECT_ID }, "seed-demonstracao");
  try {
    await getDatabase(app).ref().update(atualizacoes);
    console.log(`${opcoes.total} relatos fictícios ${opcoes.remover ? "removidos" : "criados/atualizados"} em ${CIDADE}.`);
  } finally {
    await deleteApp(app);
  }
}

if (require.main === module) {
  executar().catch(erro => {
    console.error(`Falha ao processar relatos fictícios: ${erro.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  AVISO_FICTICIO,
  PREFIXO_ID,
  criarRelato,
  detalhePublico,
  lerArgumentos,
  marcadorPublico,
  montarAtualizacoes,
  resumoPublico,
};
