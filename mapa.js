// ── Pro Povo — mapa.js ──
import { ouvirRelatos } from "./db.js";
import { initNavbar } from "./navbar.js";
import { escapeHTML } from "./escapehtml.js";

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

// ── Carregar relatos e plotar no mapa ──
ouvirRelatos((relatos) => {
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];

  const comCoordenadas = relatos.filter(r => r.lat && r.lng);

  comCoordenadas.forEach(r => {
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
          <span><i class="ti ti-thumb-up"></i> ${r.votos || 0} votos</span>
        </div>
        <span class="popup-status" style="background:${STATUS_COR[r.status]}22; color:${STATUS_COR[r.status]}">
          ${escapeHTML(STATUS_LABEL[r.status] || r.status)}
        </span>
      </div>
    `);

    marcadores.push(marker);
  });

  document.getElementById('mapa-contagem').textContent =
    `${comCoordenadas.length} relato${comCoordenadas.length !== 1 ? 's' : ''} localizado${comCoordenadas.length !== 1 ? 's' : ''} no mapa`;
});