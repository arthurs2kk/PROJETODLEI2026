import { escapeHTML } from '../escapeHtml.js';
import { CORES_CATEGORIA, CORES_STATUS, STATUS_LABEL, coordenadasValidas, pontosMapaCalor, chavePrioridade } from './gestaoModelo.js';

const GRADIENTE_CALOR = { 0.2: '#2563eb', 0.4: '#06b6d4', 0.6: '#22c55e', 0.8: '#facc15', 1: '#dc2626' };

export function criarMapaGestao(aoPriorizar, podePriorizar, aoAbrirRelato) {
  const mapa = L.map('admin-mapa', { preferCanvas: true, dragging: true, scrollWheelZoom: true, zoomControl: false }).setView([-7.23, -35.88], 12);
  L.control.zoom({ zoomInTitle: 'Ampliar mapa', zoomOutTitle: 'Reduzir mapa' }).addTo(mapa);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(mapa);
  const camada = L.featureGroup().addTo(mapa);
  let camadaCalor;
  let ajustar = true;
  let ultimaSelecao = '';
  let ultimaAssinatura = '';
  let ultimoTipo;
  let relatosAtuais = [];
  let cancelarDestaque;
  const marcadores = new Map();
  mapa.on('popupclose', () => cancelarDestaque?.());
  mapa.on('popupopen', evento => {
    evento.popup.getElement()?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Fechar detalhes do relato');
  });
  mapa.on('resize', () => {
    const aberto = [...marcadores.values()].find(marker => marker.isPopupOpen());
    if (aberto) {
      aberto.getPopup().options.maxWidth = Math.max(150, Math.min(260, mapa.getSize().x - 80));
      aberto.getPopup().update();
    }
  });

  function destacarLocalizacao(relato) {
    cancelarDestaque?.();
    const elemento = document.getElementById('admin-mapa');
    const reduzirMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;
    let halo;
    let inicio;
    let ultimaPosicao = '';
    let paradoDesde = performance.now();
    cancelarDestaque = () => {
      cancelAnimationFrame(frame);
      if (halo) mapa.removeLayer(halo);
      halo = null;
    };

    const animar = agora => {
      if (!elemento.isConnected || !elemento.getClientRects().length) { cancelarDestaque(); return; }
      if (inicio === undefined) {
        const ponto = mapa.latLngToContainerPoint([relato.lat, relato.lng]);
        const posicao = `${elemento.getBoundingClientRect().top}:${ponto.x}:${ponto.y}:${mapa.getZoom()}`;
        if (posicao !== ultimaPosicao) { ultimaPosicao = posicao; paradoDesde = agora; }
        // Espera tanto a rolagem da página quanto o enquadramento do mapa.
        if (agora - paradoDesde >= 180) {
          inicio = agora;
          halo = L.circleMarker([relato.lat, relato.lng], {
            radius: 19, color: '#ffcd07', weight: 4, opacity: 1,
            fill: false, interactive: false
          }).addTo(mapa);
          marcadores.get(relato.id)?.bringToFront();
        }
      } else {
        const decorrido = agora - inicio;
        if (decorrido >= 1400) { cancelarDestaque(); return; }
        if (!reduzirMovimento) {
          const pulso = (1 - Math.cos((decorrido / 700) * Math.PI * 2)) / 2;
          halo.setRadius(19 + pulso * 15);
          halo.setStyle({ opacity: 1 - pulso * .65 });
        }
      }
      frame = requestAnimationFrame(animar);
    };
    frame = requestAnimationFrame(animar);
  }

  function localizar(id) {
    cancelarDestaque?.();
    const relato = relatosAtuais.find(r => r.id === id);
    if (!relato || !coordenadasValidas(relato)) {
      document.getElementById('admin-mapa-info').textContent = 'Este relato não possui localização válida. Use Abrir gestão na lista abaixo para consultá-lo.';
      document.querySelector('.admin-mapa-alternativa').open = true;
      document.getElementById('admin-mapa-info').scrollIntoView({ block: 'nearest' });
      return;
    }
    if (ultimoTipo === 'calor') {
      const seletor = document.getElementById('admin-mapa-tipo');
      seletor.value = 'categoria';
      seletor.dispatchEvent(new Event('change'));
    }
    document.getElementById('admin-mapa').scrollIntoView({ block: 'center' });
    mapa.stop();
    mapa.setView([relato.lat, relato.lng], 17, { animate: false });
    marcadores.get(id)?.openPopup();
    document.getElementById('admin-mapa').focus({ preventScroll: true });
    destacarLocalizacao(relato);
  }

  return {
    atualizar(relatos, tipo, prioridades, selecao) {
      mapa.invalidateSize({ pan: false });
      relatosAtuais = relatos;
      const assinatura = JSON.stringify([tipo, relatos, prioridades, podePriorizar()]);
      if (assinatura === ultimaAssinatura && !ajustar && selecao === ultimaSelecao) return;
      cancelarDestaque?.();
      const popupAberto = [...marcadores].find(([, marker]) => marker.isPopupOpen())?.[0];
      camada.clearLayers();
      if (camadaCalor) {
        mapa.removeLayer(camadaCalor);
        camadaCalor = null;
      }
      marcadores.clear();
      const localizados = relatos.filter(coordenadasValidas);
      const legenda = document.getElementById('admin-mapa-legenda');
      legenda.replaceChildren();
      const adicionarLegenda = (cor, texto) => {
        const item = document.createElement('span');
        const ponto = document.createElement('i');
        ponto.style.background = cor;
        item.append(ponto, document.createTextNode(texto));
        legenda.append(item);
      };

      if (tipo === 'calor') {
        if (localizados.length) {
          camadaCalor = L.heatLayer(pontosMapaCalor(localizados), {
            radius: 28, blur: 22, minOpacity: 0.25, max: 5, maxZoom: 16,
            gradient: GRADIENTE_CALOR
          }).addTo(mapa);
        }
        const escala = document.createElement('span');
        escala.className = 'admin-mapa-calor-escala';
        const faixa = document.createElement('i');
        faixa.className = 'admin-mapa-calor-gradiente';
        faixa.setAttribute('aria-hidden', 'true');
        const cores = Object.entries(GRADIENTE_CALOR).sort(([a], [b]) => Number(a) - Number(b)).map(([, cor]) => cor);
        faixa.style.background = `linear-gradient(to right, ${cores.join(', ')})`;
        escala.append(document.createTextNode('Menos relatos'), faixa, document.createTextNode('Mais relatos próximos'));
        legenda.append(escala);
      } else {
        localizados.forEach(r => {
          const priorizado = !!prioridades[chavePrioridade(r)];
          const cor = tipo === 'status' ? CORES_STATUS[r.status] || '#777' : CORES_CATEGORIA[r.categoria] || '#777';
          const votos = Math.max(0, Number(r.votos) || 0);
          const marker = L.circleMarker([r.lat, r.lng], {
            radius: tipo === 'apoio' ? 7 + Math.min(17, Math.sqrt(votos) * 2) : 9,
            fillColor: cor, color: priorizado ? '#332600' : '#fff', weight: priorizado ? 4 : 2, fillOpacity: 0.88
          }).addTo(camada);
          marcadores.set(r.id, marker);
          const dica = document.createElement('span');
          dica.textContent = `${r.titulo} · ${STATUS_LABEL[r.status] || r.status} · ${votos} apoio(s)`;
          marker.bindTooltip(dica);
          marker.bindPopup(() => {
            const caixa = document.createElement('div');
            caixa.className = 'admin-mapa-popup';
            caixa.innerHTML = `<strong>${escapeHTML(r.titulo)}</strong><p>${escapeHTML(r.categoria)}</p><p>${escapeHTML(r.endereco)}</p><p>${escapeHTML(STATUS_LABEL[r.status] || r.status)} · ${votos} apoio(s)${priorizado ? ' · Prioridade interna' : ''}</p>`;
            const abrir = document.createElement('button');
            abrir.type = 'button';
            abrir.className = 'btn-gestao';
            abrir.textContent = 'Abrir gestão do relato';
            abrir.addEventListener('click', () => aoAbrirRelato(r));
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'btn-gestao';
            botao.disabled = !podePriorizar();
            botao.textContent = priorizado ? 'Remover das prioridades' : 'Adicionar às prioridades';
            botao.addEventListener('click', async () => {
              botao.disabled = true;
              await aoPriorizar(r);
            });
            caixa.append(abrir, botao);
            return caixa;
          }, { maxWidth: Math.max(150, Math.min(260, mapa.getSize().x - 80)), minWidth: 150, autoPanPadding: [20, 20], keepInView: true });
        });
        Object.entries(tipo === 'status' ? CORES_STATUS : CORES_CATEGORIA).forEach(([nome, cor]) => adicionarLegenda(cor, STATUS_LABEL[nome] || nome));
        if (tipo === 'apoio') adicionarLegenda('#333', 'Círculos maiores = mais apoios');
        adicionarLegenda('#332600', 'Borda escura = prioridade interna');
      }
      const semLocalizacao = relatos.length - localizados.length;
      document.getElementById('admin-mapa-info').textContent = `${localizados.length} de ${relatos.length} relato(s) do filtro no mapa.${semLocalizacao ? ` ${semLocalizacao} sem localização válida: consulte na lista abaixo.` : ''}${tipo === 'calor' ? ' Cores quentes indicam mais relatos próximos, sem ponderar apoios. A intensidade varia com o zoom. Use Localizar na lista abaixo para ver um relato individual.' : ''}`;
      document.getElementById('admin-mapa-vazio').hidden = localizados.length > 0;
      document.getElementById('admin-mapa-enquadrar').disabled = !localizados.length;
      const lista = document.getElementById('admin-mapa-lista');
      const focoId = lista.contains(document.activeElement) ? document.activeElement.id : null;
      lista.replaceChildren(...relatos.map(r => {
        const item = document.createElement('li');
        const texto = document.createElement('div');
        texto.innerHTML = `<strong>${escapeHTML(r.titulo)}</strong><p>${escapeHTML(r.endereco)} · ${escapeHTML(STATUS_LABEL[r.status] || r.status)} · ${Number(r.votos) || 0} apoio(s)${coordenadasValidas(r) ? '' : ' · Sem localização'}</p>`;
        const abrir = document.createElement('button');
        abrir.type = 'button'; abrir.className = 'btn-gestao'; abrir.textContent = 'Abrir gestão'; abrir.id = `mapa-gestao-${r.id}`;
        abrir.setAttribute('aria-label', `Abrir gestão: ${r.titulo}`);
        abrir.addEventListener('click', () => aoAbrirRelato(r));
        const ponto = document.createElement('button');
        ponto.type = 'button'; ponto.className = 'btn-gestao'; ponto.textContent = 'Localizar'; ponto.id = `mapa-localizar-${r.id}`;
        ponto.disabled = !coordenadasValidas(r); ponto.setAttribute('aria-label', `Localizar no mapa: ${r.titulo}`);
        ponto.addEventListener('click', () => localizar(r.id));
        item.append(texto, ponto, abrir);
        return item;
      }));
      if (focoId) document.getElementById(focoId)?.focus({ preventScroll: true });
      if ((ajustar || selecao !== ultimaSelecao) && localizados.length) {
        mapa.stop();
        mapa.fitBounds(L.latLngBounds(localizados.map(r => [r.lat, r.lng])).pad(0.12), { maxZoom: 16, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
        ajustar = false;
      }
      ultimaSelecao = selecao;
      if (popupAberto && tipo === ultimoTipo) marcadores.get(popupAberto)?.openPopup();
      ultimoTipo = tipo;
      ultimaAssinatura = assinatura;
    },
    enquadrar() { ajustar = true; },
    localizar
  };
}
