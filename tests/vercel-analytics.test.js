"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "vercel-analytics.js"), "utf8");

function executar(escolhaInicial = null, href = 'https://propovo.example/index.html') {
  const elementos = new Map();
  const scripts = [];
  let escolha = escolhaInicial;
  let recarregamentos = 0;

  function botao(valor) {
    let click;
    return {
      dataset: { escolha: valor },
      addEventListener(tipo, callback) { if (tipo === "click") click = callback; },
      click() { click?.(); },
      focus() {},
      setAttribute() {},
    };
  }

  function elemento(tag) {
    const el = {
      tag, id: "", className: "", dataset: {},
      setAttribute() {}, addEventListener(tipo, callback) { if (tipo === "click") this.click = callback; },
      remove() { if (this.id) elementos.delete(this.id); },
      focus() {},
    };
    Object.defineProperty(el, "innerHTML", {
      set() {
        el.botoes = [botao("essencial"), botao("permitido")];
      }
    });
    el.querySelectorAll = seletor => seletor === "[data-escolha]" ? (el.botoes || []) : [];
    el.querySelector = seletor => seletor === "button" ? el.botoes?.[0] : null;
    return el;
  }

  const anexar = el => {
    if (el.id) elementos.set(el.id, el);
    if (el.tag === "script") scripts.push(el);
  };
  const document = {
    readyState: "complete",
    currentScript: { src: "https://propovo.example/js/vercel-analytics.js" },
    head: { appendChild: anexar },
    body: { appendChild: anexar },
    createElement: elemento,
    getElementById: id => elementos.get(id) || null,
    querySelector: seletor => seletor === "script[data-pro-povo-analytics]" ? scripts[0] || null : null,
  };
  const context = {
    document,
    window: {},
    location: { href, reload: () => { recarregamentos += 1; } },
    localStorage: {
      getItem: () => escolha,
      setItem: (_, valor) => { escolha = valor; },
    },
    URL,
  };
  vm.runInNewContext(source, context, { filename: "vercel-analytics.js" });
  return {
    elementos,
    scripts,
    analytics: context.window.proPovoAnalytics,
    escolha: () => escolha,
    recarregamentos: () => recarregamentos
  };
}

test("analytics não carrega antes da escolha e permanece desligado com somente essenciais", () => {
  const pagina = executar();
  assert.equal(pagina.scripts.length, 0);
  const banner = pagina.elementos.get("privacidade-banner");
  assert.ok(banner);
  banner.botoes[0].click();
  assert.equal(pagina.escolha(), "essencial");
  assert.equal(pagina.scripts.length, 0);
});

test("analytics carrega apenas depois de permissão explícita", () => {
  const pagina = executar();
  pagina.elementos.get("privacidade-banner").botoes[1].click();
  assert.equal(pagina.escolha(), "permitido");
  assert.equal(pagina.scripts.length, 1);
  assert.equal(pagina.scripts[0].src, "/_vercel/insights/script.js");
});

test("aceite expresso do cadastro autoriza analytics pela mesma rotina", () => {
  const pagina = executar("essencial");
  pagina.analytics.autorizar();
  assert.equal(pagina.escolha(), "permitido");
  assert.equal(pagina.scripts.length, 1);
  assert.equal(pagina.analytics.escolhaAtual(), "permitido");
});

test("revogar uma permissão anterior recarrega a página para interromper a coleta", () => {
  const pagina = executar("permitido");
  pagina.elementos.get("privacidade-preferencias").click();
  pagina.elementos.get("privacidade-banner").botoes[0].click();
  assert.equal(pagina.escolha(), "essencial");
  assert.equal(pagina.recarregamentos(), 1);
});

test('analytics não solicita o endpoint da Vercel em servidores locais, mesmo com consentimento', () => {
  for (const url of ['http://127.0.0.1:5500/', 'http://localhost:3000/', 'http://[::1]:3000/', 'file:///site/index.html']) {
    const pagina = executar('permitido', url);
    pagina.analytics.autorizar();
    assert.equal(pagina.scripts.length, 0, url);
    assert.equal(pagina.analytics.escolhaAtual(), 'permitido');
  }
});
