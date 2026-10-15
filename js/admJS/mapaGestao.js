import { escapeHTML } from '../escapeHtml.js';
import { CORES_CATEGORIA, CORES_STATUS, STATUS_LABEL, coordenadasValidas, agruparConcentracao, chavePrioridade } from './gestaoModelo.js';

export function criarMapaGestao(aoPriorizar, podePriorizar, aoAbrirRelato) {
  const mapa = L.map('admin-mapa', { preferCanvas: true, scrollWheelZoom: false, zoomControl: false }).setView([-7.23, -35.88], 12);
  L.control.zoom({ zoomInTitle: 'Ampliar mapa', zoomOutTitle: 'Reduzir mapa' }).addTo(mapa);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(mapa);
  const camada = L.featureGroup().addTo(mapa);
  let ajustar = true;
  let ultimaSelecao = '';
  let ultimaAssinatura = '';
  let ultimoTipo;
  let relatosAtuais = [];
  const marcadores = new Map();
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

  function localizar(id) {
    const relato = relatosAtuais.find(r => r.id === id);
    if (!relato || !coordenadasValidas(relato)) {
      document.getElementById('admin-mapa-info').textContent = 'Este relato não possui localização válida. Use Abrir gestão na lista abaixo para consultá-lo.';
      document.querySelector('.admin-mapa-alternativa').open = true;
      document.getElementById('admin-mapa-info').scrollIntoView({ block: 'nearest' });
      return;
    }
    document.getElementById('admin-mapa').scrollIntoView({ block: 'center' });
    mapa.setView([relato.lat, relato.lng], 17);
    marcadores.get(id)?.openPopup();
    document.getElementById('admin-mapa').focus({ preventScroll: true });
  }

  return {
    atualizar(relatos, tipo, prioridades, selecao) {
      mapa.invalidateSize({ pan: false });
      relatosAtuais = relatos;
      const assinatura = JSON.stringify([tipo, relatos, prioridades, podePriorizar()]);
      if (assinatura === ultimaAssinatura && !ajustar && selecao === ultimaSelecao) return;
      ultimaAssinatura = assinatura;
      const popupAberto = [...marcadores].find(([, marker]) => marker.isPopupOpen())?.[0];
      camada.clearLayers();
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

      if (tipo === 'concentracao') {
        const celulas = agruparConcentracao(localizados);
        const maximo = Math.max(1, ...celulas.map(c => c.quantidade));
        celulas.forEach(c => {
          const intensidade = c.quantidade / maximo;
          L.circle([c.lat, c.lng], {
            radius: 170, color: '#b54708', weight: 1,
            fillColor: intensidade > 0.66 ? '#cc2900' : intensidade > 0.33 ? '#e89b12' : '#ffd86b',
            fillOpacity: 0.6
          }).bindPopup(`${c.quantidade} relato(s) nesta célula de aproximadamente 300 m.`).addTo(camada);
        });
        adicionarLegenda('#ffd86b', 'Menor concentração');
        adicionarLegenda('#cc2900', 'Maior concentração no filtro atual');
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
      document.getElementById('admin-mapa-info').textContent = `${localizados.length} de ${relatos.length} relato(s) do filtro no mapa.${semLocalizacao ? ` ${semLocalizacao} sem localização válida: consulte na lista abaixo.` : ''}${tipo === 'concentracao' ? ' A concentração conta relatos, sem ponderar apoios. Use outra visualização para selecionar marcadores individuais.' : ''}`;
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
    },
    enquadrar() { ajustar = true; },
    localizar
  };
}
