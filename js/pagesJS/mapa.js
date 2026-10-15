// ── Pro Povo — mapa.js ──
import { buscarRelatosMapa } from "../db.js";
import { obterMunicipiosPB } from "../cidades.js";
import { AREA_RELATOS, CIDADES_ATIVAS_RELATOS } from "../abrangencia-relatos.js";
import { initNavbar } from "../navbar.js";
import { escapeHTML } from "../escapeHtml.js";

// ── Navbar (login/cadastro/nome do usuário/sair/perfil) ──
initNavbar();

// ── Menu mobile ──

// ── Cores por categoria ──
const CORES = {
  'Buraco / Via danificada': '#CC2900',
  'Iluminação pública':      '#C45C00',
  'Lixo / Entulho':          '#168821',
  'Água / Esgoto':           '#1351B4',
  'Áreas verdes':            '#637d16',
};
function corDaCategoria(cat) { return CORES[cat] || '#888888'; }

const STATUS_LABEL = { aberto: 'Aberto', andamento: 'Em andamento', resolvido: 'Resolvido' };
const STATUS_COR   = { aberto: '#CC2900', andamento: '#C45C00', resolvido: '#168821' };

// ── Limites e centro da Paraíba ──
const BOUNDS_PB = [
  [-8.31, -38.85], // sudoeste
  [-6.02, -34.79], // nordeste
];
const CENTRO_PB = [-7.12, -36.72];
const cidadeInicial = CIDADES_ATIVAS_RELATOS?.length === 1 ? CIDADES_ATIVAS_RELATOS[0] : null;
const tituloMapa = cidadeInicial ? `Mapa de ${AREA_RELATOS}` : 'Mapa da Paraíba';
document.title = `${tituloMapa} — Pro Povo`;
document.getElementById('mapa-titulo').textContent = tituloMapa;
document.getElementById('mapa-subtitulo').textContent = cidadeInicial
  ? `Veja os problemas relatados pela população em ${AREA_RELATOS}. Toque em um ponto para consultar os detalhes.`
  : `Selecione uma cidade ativa para consultar os relatos em ${AREA_RELATOS}.`;

// ── Inicializar o mapa restrito à Paraíba ──
const mapa = L.map('mapa-container', {
  maxBounds: BOUNDS_PB,
  maxBoundsViscosity: 0.8,
  minZoom: 7
}).setView(cidadeInicial?.centroMapa || CENTRO_PB, cidadeInicial?.zoomMapa || 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 18
}).addTo(mapa);

let marcadores = [];
let solicitacaoAtual = 0;
let cidadesDisponiveis = [];
const LIMITE_MARCADORES = 500;
const CHAVE_CIDADE_MAPA = 'proPovoMapaCityId';

function limparMarcadores() {
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

function guardarCidade(cityId) {
  try {
    if (cityId) localStorage.setItem(CHAVE_CIDADE_MAPA, cityId);
    else localStorage.removeItem(CHAVE_CIDADE_MAPA);
  } catch (erro) {
    console.warn('Não foi possível salvar a preferência de cidade:', erro);
  }
}

// ── Carregar somente os relatos da cidade selecionada ──
async function carregarCidade(cityId) {
  const numeroSolicitacao = ++solicitacaoAtual;
  limparMarcadores();

  const contagem = document.getElementById('mapa-contagem');
  const cidadeValida = cidadesDisponiveis.some(cidade => cidade.id === cityId);
  document.getElementById('mapa-aviso-cidade').hidden = cidadeValida;
  if (!cidadeValida) {
    document.getElementById('mapa-cidade').value = '';
    guardarCidade('');
    contagem.textContent = 'Selecione uma cidade para carregar o mapa.';
    return;
  }

  guardarCidade(cityId);
  contagem.textContent = 'Carregando relatos desta cidade...';

  try {
    const relatos = await buscarRelatosMapa(cityId, LIMITE_MARCADORES);
    if (numeroSolicitacao !== solicitacaoAtual) return;
    limparMarcadores();

    const comCoordenadas = relatos.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

    comCoordenadas.forEach(r => {
      const statusCor = STATUS_COR[r.status] || STATUS_COR.aberto;
      const marker = L.circleMarker([r.lat, r.lng], {
        radius: 9,
        fillColor: corDaCategoria(r.categoria),
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9
      }).addTo(mapa);

      marker.bindPopup(`
        <div class="popup-relato">
          <div class="popup-titulo">${escapeHTML(r.titulo)}</div>
          <div class="popup-meta">
            <span><i class="ti ti-map-pin"></i> ${escapeHTML(r.endereco)}</span>
            <span>${escapeHTML(r.categoria)}</span>
          </div>
          <span class="popup-status" style="background:${statusCor}22; color:${statusCor}">
            ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
          </span>
        </div>
      `);

      marcadores.push(marker);
    });

    if (comCoordenadas.length > 0) {
      const grupo = L.featureGroup(marcadores);
      mapa.fitBounds(grupo.getBounds().pad(0.12), { maxZoom: 15 });
    } else {
      const cidade = cidadesDisponiveis.find(item => item.id === cityId);
      mapa.setView(cidade?.centroMapa || CENTRO_PB, cidade?.zoomMapa || 8);
    }

    const atingiuLimite = relatos.length >= LIMITE_MARCADORES;
    contagem.textContent = atingiuLimite
      ? `Mostrando os ${comCoordenadas.length} relatos localizados mais recentes desta cidade`
      : `${comCoordenadas.length} relato${comCoordenadas.length !== 1 ? 's' : ''} localizado${comCoordenadas.length !== 1 ? 's' : ''} nesta cidade`;
  } catch (erro) {
    if (numeroSolicitacao !== solicitacaoAtual) return;
    console.warn('Não foi possível carregar os relatos do mapa:', erro);
    contagem.textContent = 'Não foi possível carregar os relatos desta cidade.';
  }
}

async function iniciarSeletorCidades() {
  const select = document.getElementById('mapa-cidade');
  const contagem = document.getElementById('mapa-contagem');

  try {
    cidadesDisponiveis = CIDADES_ATIVAS_RELATOS || await obterMunicipiosPB();
    select.replaceChildren(new Option('Selecione uma cidade ativa', ''));
    cidadesDisponiveis.forEach(cidade => {
      select.appendChild(new Option(cidade.nome, cidade.id));
    });
    select.disabled = false;
    if (cidadesDisponiveis.length === 1) {
      select.value = cidadesDisponiveis[0].id;
      select.closest('.mapa-filtro').hidden = true;
      await carregarCidade(select.value);
      return;
    }

    let salva = null;
    try {
      salva = localStorage.getItem(CHAVE_CIDADE_MAPA);
    } catch (erro) {
      console.warn('Não foi possível ler a preferência de cidade:', erro);
    }
    if (cidadesDisponiveis.some(cidade => cidade.id === salva)) {
      select.value = salva;
      carregarCidade(salva);
    } else {
      carregarCidade('');
    }
  } catch (erro) {
    console.warn('Não foi possível carregar as cidades:', erro);
    select.replaceChildren(new Option('Cidades indisponíveis', ''));
    select.disabled = true;
    contagem.textContent = 'Não foi possível carregar a lista de cidades.';
  }
}

document.getElementById('mapa-cidade')?.addEventListener('change', (evento) => {
  carregarCidade(evento.target.value);
});

iniciarSeletorCidades();
