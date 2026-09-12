// ── Pro Povo — mapa.js ──
import { buscarRelatosMapa } from "../db.js";
import { obterMunicipiosPB } from "../cidades.js";
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

// ── Inicializar o mapa restrito à Paraíba ──
const mapa = L.map('mapa-container', {
  maxBounds: BOUNDS_PB,
  maxBoundsViscosity: 0.8,
  minZoom: 7
}).setView(CENTRO_PB, 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 18
}).addTo(mapa);

// Destaca visualmente o contorno aproximado da Paraíba
L.rectangle(BOUNDS_PB, {
  color: '#1351B4',
  weight: 1,
  fillOpacity: 0,
  dashArray: '6,6'
}).addTo(mapa);

let marcadores = [];
let solicitacaoAtual = 0;
const LIMITE_MARCADORES = 500;
const CHAVE_CIDADE_MAPA = 'proPovoMapaCityId';

function limparMarcadores() {
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];
}

// ── Carregar somente os relatos da cidade selecionada ──
async function carregarCidade(cityId) {
  const numeroSolicitacao = ++solicitacaoAtual;
  limparMarcadores();

  const contagem = document.getElementById('mapa-contagem');
  if (!cityId) {
    contagem.textContent = 'Selecione uma cidade para carregar o mapa.';
    return;
  }

  localStorage.setItem(CHAVE_CIDADE_MAPA, cityId);
  contagem.textContent = 'Carregando relatos desta cidade...';

  try {
    const relatos = await buscarRelatosMapa(cityId, LIMITE_MARCADORES);
    if (numeroSolicitacao !== solicitacaoAtual) return;
    limparMarcadores();

    const comCoordenadas = relatos.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

    comCoordenadas.forEach(r => {
      const votos = Number.isFinite(Number(r.votos)) ? Math.max(0, Number(r.votos)) : 0;
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
            <span><i class="ti ti-user"></i> ${escapeHTML(r.autorNome)}</span>
            <span><i class="ti ti-thumb-up"></i> ${votos} votos</span>
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
      mapa.setView(CENTRO_PB, 8);
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
    const cidades = await obterMunicipiosPB();
    select.replaceChildren(new Option('Selecione uma cidade', ''));
    cidades.forEach(cidade => {
      select.appendChild(new Option(cidade.nome, cidade.id));
    });
    select.disabled = false;

    const salva = localStorage.getItem(CHAVE_CIDADE_MAPA);
    if (cidades.some(cidade => cidade.id === salva)) {
      select.value = salva;
      carregarCidade(salva);
    }
  } catch (erro) {
    console.warn('Não foi possível carregar as cidades:', erro);
    select.replaceChildren(new Option('Cidades indisponíveis', ''));
    contagem.textContent = 'Não foi possível carregar a lista de cidades.';
  }
}

document.getElementById('mapa-cidade')?.addEventListener('change', (evento) => {
  carregarCidade(evento.target.value);
});

iniciarSeletorCidades();
