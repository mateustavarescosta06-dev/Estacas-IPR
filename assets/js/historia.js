/* Home: 24 horas na fábrica. A rolagem é o relógio. Da hora saem a cor do fundo (os azuis da noite,
   da madrugada e do dia), a luz da cena 3D (o amarelo é luz: sol baixo e lâmpadas de sódio), o
   capítulo da vez e o que a estaca faz: fôrma, fios, concreto, cura, ensaio, liberação. */
import { createEstaca } from "./3d/estaca.js";

const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const webgl = "WebGL2RenderingContext" in window;

/* rolagem (0..1) → minutos desde a meia-noite do primeiro dia */
const RELOGIO = [
  [0.00, 340], [0.06, 360], [0.20, 450], [0.28, 510], [0.42, 600], [0.52, 1050], [0.61, 1110], [0.625, 1320], [0.71, 1740], [0.72, 1770], [0.84, 1795], [1.00, 1800],
];
/* luz por hora (minutos). O azul domina; o amarelo aparece como luz. */
const LUZ = [
  [340, { sun: "#9fb6e8", sunI: 0, elev: 2, azim: -75, sky: "#1b3566", ground: "#04080f", hemiI: 0.71, sodium: 2.4, exposure: 1.08, env: 0.55, fog: "#071225" }],
  [360, { sun: "#a9bfe9", sunI: 0.5, elev: 4, azim: -72, sky: "#2f5590", ground: "#060c18", hemiI: 0.9, sodium: 1.4, exposure: 1.13, env: 0.6, fog: "#0a1f3d" }],
  [450, { sun: "#ffcf70", sunI: 2.1, elev: 12, azim: -62, sky: "#5d82bd", ground: "#0a1426", hemiI: 1.05, sodium: 0.2, exposure: 1.08, env: 0.75, fog: "#0d2850" }],
  [510, { sun: "#fff0d2", sunI: 2.7, elev: 30, azim: -50, sky: "#8fb0dd", ground: "#0d1a30", hemiI: 1.2, sodium: 0, exposure: 1.08, env: 0.85, fog: "#0f2f5b" }],
  [720, { sun: "#ffffff", sunI: 3.0, elev: 66, azim: 0, sky: "#a9c4ea", ground: "#101e36", hemiI: 1.3, sodium: 0, exposure: 1.05, env: 0.95, fog: "#113563" }],
  [1050, { sun: "#ffc247", sunI: 2.7, elev: 9, azim: 62, sky: "#6f86b5", ground: "#0d1830", hemiI: 0.95, sodium: 0, exposure: 1.14, env: 0.75, fog: "#0e2a52" }],
  [1140, { sun: "#ff9a3c", sunI: 0.4, elev: 1, azim: 72, sky: "#2a4677", ground: "#070d1a", hemiI: 0.8, sodium: 1.2, exposure: 1.08, env: 0.55, fog: "#0a1c38" }],
  [1320, { sun: "#9fb6e8", sunI: 0, elev: 1, azim: 80, sky: "#152c55", ground: "#03070e", hemiI: 0.7, sodium: 2.6, exposure: 1.08, env: 0.55, fog: "#061020" }],
  [1770, { sun: "#9fb6e8", sunI: 0, elev: 1, azim: -80, sky: "#1d3a6b", ground: "#04080f", hemiI: 0.75, sodium: 2.0, exposure: 1.08, env: 0.55, fog: "#081630" }],
  [1800, { sun: "#ffd366", sunI: 2.3, elev: 7, azim: -70, sky: "#4a6ea8", ground: "#08111f", hemiI: 0.97, sodium: 0.3, exposure: 1.14, env: 0.7, fog: "#0c2446" }],
];

function between(table, x) {
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, a] = table[i - 1], [x1, b] = table[i];
      return [a, b, x1 > x0 ? (x - x0) / (x1 - x0) : 1];
    }
  }
  const l = table[table.length - 1];
  return [l[1], l[1], 1];
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * k).toString(16).padStart(2, "0")).join("");
const mixLight = (a, b, k) => {
  const o = {};
  for (const key in a) o[key] = typeof a[key] === "string" ? mixHex(a[key], b[key], k) : a[key] + (b[key] - a[key]) * k;
  return o;
};
const minutes = (p) => { const [a, b, k] = between(RELOGIO, p); return a + (b - a) * k; };
const r = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

/* ---------- Rótulos que acompanham a estaca ---------- */
// Cada rótulo aponta para um ponto da peça (âncora do 3D) e só aparece no seu trecho da história.
function rotulos(layer, defs) {
  const items = defs.map((d) => {
    const el = document.createElement("div");
    el.className = "rotulo3d" + (d.lado === "e" ? " rotulo3d--e" : "");
    el.innerHTML = "<i></i><span></span>";
    el.querySelector("span").textContent = d.texto;
    layer.appendChild(el);
    return Object.assign({ el, o: 0 }, d);
  });
  return {
    items,
    place(anchors, k) {
      items.forEach((it) => {
        const a = anchors[it.ancora], f = 0.012;
        const want = a && a.on ? clamp(Math.min((k - it.de) / f + 1, (it.ate - k) / f + 1), 0, 1) : 0;
        it.el.style.opacity = want.toFixed(3);
        if (a && want > 0) {
          it.el.style.transform = "translate3d(" + a.x.toFixed(1) + "px," + a.y.toFixed(1) + "px,0)";
          // perto da borda direita o texto vai para a esquerda do ponto (e vice-versa), para nunca ser cortado
          const w = layer.clientWidth, esq = a.x > w * 0.6 ? true : a.x < w * 0.4 ? false : it.lado === "e";
          it.el.classList.toggle("rotulo3d--e", esq);
        }
      });
    },
  };
}

/* ---------- O dia ---------- */
const dia = $("[data-dia]");
if (dia) {
  const pista = $(".dia__pista", dia), palco = $(".dia__palco", dia);
  const caps = $$("[data-de]", dia).map((el) => ({ el, de: +el.dataset.de, ate: +el.dataset.ate, cobre: el.classList.contains("intervalo") }));
  const etapas = $$("[data-etapas] button", dia);
  const canvas = $("[data-estaca]", dia), camada = $("[data-rotulos]", dia);
  const labels = rotulos(camada, [
    { ancora: "forma", texto: "Fôrma metálica com nervuras", de: 0.055, ate: 0.11 },
    { ancora: "fio", texto: "Fios de aço CP-175 RB, tracionados", de: 0.115, ate: 0.195 },
    { ancora: "cabeceira", texto: "Cabeceira: onde os fios são ancorados", de: 0.125, ate: 0.195, lado: "e" },
    { ancora: "concreto", texto: "Concreto C40 lançado sobre os fios", de: 0.3, ate: 0.41 },
    { ancora: "cp", texto: "Corpos de prova do mesmo lote", de: 0.36, ate: 0.41, lado: "e" },
    { ancora: "concreto", texto: "Úmido e escuro, depois claro e fosco", de: 0.53, ate: 0.61 },
    { ancora: "prensa", texto: "Prensa: o ensaio de 24 horas", de: 0.735, ate: 0.83, lado: "e" },
    { ancora: "fioface", texto: "Os fios ficam presos no concreto", de: 0.955, ate: 1.2 },
  ]);
  let estaca = null, pAtual = 0;
  if (webgl && canvas) {
    try { estaca = createEstaca(canvas, { shiftX: 0, onRender: () => labels.place(estaca.anchors(), pAtual) }); } catch (e) { estaca = null; }
  }
  if (!estaca && canvas) canvas.hidden = true;
  dia.classList.toggle("sem-3d", !estaca);

  /* O pátio real ao fundo: o time-lapse da pista (gerado da foto da fábrica), desfocado e levado
     à mesma hora da cena. Minuto do dia → segundo do filme (06:00, 09:00, 17:30, 06:00 do dia 2). */
  const fundo = $("video[data-fundo]", dia);
  const FILME = [[360, 0], [540, 5], [1050, 10], [1800, 15]];
  const fundoT = (m) => { const [a, b, k] = between(FILME, m); return a + (b - a) * k; };
  let fundoOk = false, fundoAlvo = 0;
  if (fundo && !reduce && window.fetch && window.URL) {
    fundo.addEventListener("seeked", () => { if (Math.abs(fundo.currentTime - fundoAlvo) > 0.05) fundo.currentTime = fundoAlvo; });
    const carregar = () => fetch(fundo.dataset.src).then((res) => (res.ok ? res.blob() : Promise.reject(res.status))).then((blob) => {
      fundo.addEventListener("loadeddata", () => { fundoOk = true; dia.classList.add("tem-fundo"); last = -1; onScroll(); }, { once: true });
      fundo.src = URL.createObjectURL(blob);
    }).catch(() => { /* sem o pátio, fica o azul da hora */ });
    if (document.readyState === "complete") setTimeout(carregar, 300);
    else addEventListener("load", () => setTimeout(carregar, 300), { once: true });
    document.addEventListener("touchstart", () => { const pr = fundo.play(); if (pr && pr.then) pr.then(() => fundo.pause()).catch(() => {}); }, { once: true, passive: true });
  }

  function estado(p) {
    return {
      form: r(p, -0.04, 0.035), wireIn: r(p, 0.08, 0.12), tension: r(p, 0.12, 0.185), view: r(p, 0.07, 0.12) * (1 - r(p, 0.27, 0.3)),
      fill: r(p, 0.29, 0.37), cps: r(p, 0.34, 0.4), cure: r(p, 0.52, 0.6),
      test: r(p, 0.72, 0.82), release: r(p, 0.84, 0.875), open: r(p, 0.87, 0.91), lift: r(p, 0.9, 0.95), turn: r(p, 0.93, 0.995),
    };
  }

  // índice das etapas: marca a atual e leva direto a ela
  const MARCOS = etapas.map((b) => +b.dataset.ir);
  const irPara = (p) => {
    const total = pista.offsetHeight - innerHeight;
    scrollTo({ top: pista.getBoundingClientRect().top + scrollY + p * total, behavior: reduce ? "auto" : "smooth" });
  };
  etapas.forEach((b) => b.addEventListener("click", () => irPara(+b.dataset.ir)));

  let last = -1;
  function frame() {
    ticking = false;
    const rect = pista.getBoundingClientRect(), total = rect.height - innerHeight;
    const p = reduce ? 1 : clamp(-rect.top / (total > 0 ? total : 1), 0, 1);
    if (Math.abs(p - last) < 0.0002) return;
    last = p; pAtual = p;
    const min = minutes(p), [a, b, k] = between(LUZ, min), luz = mixLight(a, b, k);
    palco.style.setProperty("--bg", luz.fog);
    if (fundoOk) {
      fundoAlvo = Math.min(fundoT(min), (fundo.duration || 15) - 0.05);
      if (!fundo.seeking && Math.abs(fundo.currentTime - fundoAlvo) > 0.02) fundo.currentTime = fundoAlvo;
    }

    let atual = -1;
    MARCOS.forEach((v, i) => { if (p >= v - 0.035) atual = i; });
    etapas.forEach((el, i) => { el.classList.toggle("is-on", i === atual); el.classList.toggle("is-past", i < atual); });
    dia.classList.toggle("is-inicio", p < 0.03);

    // capítulos e interlúdios: entram e saem com margens curtas
    let cobre = 0;
    caps.forEach((c) => {
      // um capítulo sai antes de o próximo entrar: a opacidade cai rápido e o texto desliza um pouco
      const f = 0.008, o = c.cobre ? clamp(Math.min((p - c.de) / f + 1, (c.ate - p) / f + 1), 0, 1) : clamp(Math.min((p - c.de) / f, (c.ate - p) / f), 0, 1), oo = o * o * o;
      c.el.style.opacity = oo.toFixed(3);
      if (!c.cobre) c.el.style.transform = "translate3d(0," + ((1 - o) * (p < c.de ? 14 : -14)).toFixed(1) + "px,0)";
      c.el.classList.toggle("is-on", o > 0.5);
      c.el.style.setProperty("--k", r(p, c.de, c.ate).toFixed(4));
      if (c.cobre) cobre = Math.max(cobre, o);
    });
    if (estaca) {
      canvas.style.opacity = camada.style.opacity = (1 - cobre).toFixed(3);
      if (cobre < 0.999) estaca.set(Object.assign(estado(p), { light: Object.assign({}, luz, { fog: "#0a1f3d" }) })); // a peça some no azul da própria página
    }
  }
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { last = -1; onScroll(); });
  frame();
}

/* ---------- A estaca em corte ---------- */
const corte = $("[data-corte]");
if (corte) {
  const DATA = window.IPR_ESTACAS || [];
  const canvas = $("canvas", corte), range = $("[data-montagem]", corte), etapa = $("[data-etapa]", corte);
  const formas = $$("[data-forma]", corte), lista = $("[data-bitolas]", corte), ficha = $("[data-ficha]", corte);
  const fmt = (n, d) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  let estaca = null, atual = DATA.find((e) => e.id === "H33") || DATA[0], anim = 0;
  let kAtual = 0, yaw = 0, pitch = 0;
  const camada = document.createElement("div"); camada.className = "rotulos"; camada.setAttribute("aria-hidden", "true");
  $(".corte__palco", corte).appendChild(camada);
  const labels = rotulos(camada, [
    { ancora: "forma", texto: "Fôrma", de: 0.02, ate: 0.3, lado: "e" },
    { ancora: "fio", texto: "Fios tracionados", de: 0.2, ate: 0.4 },
    { ancora: "concreto", texto: "Concreto C40", de: 0.4, ate: 0.74 },
    { ancora: "fioface", texto: "", de: 0.93, ate: 1.2 },
    { ancora: "secao", texto: "", de: 0.93, ate: 1.2, lado: "e" },
  ]);
  const ETAPAS = [[0, "Fôrma"], [0.14, "Fios"], [0.35, "Concreto"], [0.6, "Cura"], [0.75, "Liberação"], [0.9, "Seção"]];

  function estado(k) {
    return {
      form: r(k, 0, 0.12), wireIn: r(k, 0.1, 0.2), tension: r(k, 0.18, 0.34), fill: r(k, 0.35, 0.6), cure: r(k, 0.6, 0.75),
      cps: 0, test: 0, release: r(k, 0.75, 0.82), open: r(k, 0.8, 0.88), lift: r(k, 0.86, 0.94), turn: r(k, 0.9, 1), view: 0,
      light: { sun: "#fff3e0", sunI: 2.4, elev: 26, azim: -55, sky: "#9db6dc", ground: "#0a1426", hemiI: 1.0, sodium: 0, exposure: 1.04, env: 0.85, fog: "#0a1f3d" },
    };
  }
  function textosSecao() {
    labels.items[3].el.querySelector("span").textContent = atual.consulta ? "Linha vazada" : atual.aco;
    labels.items[4].el.querySelector("span").textContent = atual.nome;
  }
  function montar(k) {
    kAtual = k;
    range.value = Math.round(k * 100);
    range.style.setProperty("--p", k * 100 + "%");
    let nome = ETAPAS[0][1];
    ETAPAS.forEach(([v, n]) => { if (k >= v) nome = n; });
    etapa.textContent = nome;
    if (estaca) estaca.set(Object.assign(estado(k), { yaw, pitch }));
  }
  function play() {
    if (reduce) { montar(1); return; }
    cancelAnimationFrame(anim);
    const t0 = performance.now(), dur = 3400;
    const step = (t) => { const k = clamp((t - t0) / dur, 0, 1); montar(k); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  }
  function renderFicha(e) {
    if (e.consulta) {
      ficha.innerHTML = '<div><dt>Seção</dt><dd>' + e.nome + '</dd></div><div><dt>Linha vazada</dt><dd>sob consulta</dd></div>';
      return;
    }
    ficha.innerHTML = [["Seção", e.nome], ["Aço", e.aco], ["Área de concreto", fmt(e.area) + " cm²"], ["Massa", fmt(e.massa) + " kg/m"], ["Compressão NBR 6118", fmt(e.compNbr, 1) + " kN"]]
      .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>").join("");
  }
  function lista_(forma) {
    lista.innerHTML = DATA.filter((e) => e.forma === forma).map((e) =>
      '<li><button type="button" data-id="' + e.id + '" aria-pressed="' + (e.id === atual.id) + '">' + (e.forma === "quadrada" ? "30 × 30" : "Ø " + e.d) + "</button></li>").join("");
  }
  const reais = $$(".corte__real [data-foto]", corte);
  function escolher(e, animar) {
    atual = e;
    reais.forEach((f) => f.classList.toggle("is-on", f.dataset.foto === e.forma));
    const desenho = $("[data-corte-desenho]", corte);
    if (desenho && window.IPR_drawSection) { desenho.innerHTML = window.IPR_drawSection(e, { scale: e.d > 34 ? 4.3 : 5.4 }); desenho.classList.add("is-in"); }
    formas.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.forma === e.forma)));
    lista_(e.forma);
    renderFicha(e);
    textosSecao();
    if (estaca) estaca.setSection(e);
    if (animar) play(); else montar(+range.value / 100);
  }
  formas.forEach((b) => b.addEventListener("click", () => {
    const first = DATA.find((e) => e.forma === b.dataset.forma && !e.consulta) || DATA.find((e) => e.forma === b.dataset.forma);
    escolher(first, true);
  }));
  lista.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-id]");
    if (b) escolher(DATA.find((e) => e.id === b.dataset.id), true);
  });
  range.addEventListener("input", () => { cancelAnimationFrame(anim); montar(+range.value / 100); });
  // arrastar para girar: o visitante comanda a câmera; nada segue o ponteiro sozinho
  let arrasto = null;
  canvas.addEventListener("pointerdown", (ev) => { arrasto = { x: ev.clientX, y: ev.clientY, yaw, pitch }; canvas.setPointerCapture(ev.pointerId); corte.classList.add("is-girando"); });
  canvas.addEventListener("pointermove", (ev) => {
    if (!arrasto) return;
    yaw = arrasto.yaw - (ev.clientX - arrasto.x) * 0.008;
    pitch = clamp(arrasto.pitch + (ev.clientY - arrasto.y) * 0.006, -0.7, 0.7);
    if (estaca) estaca.set({ yaw, pitch });
  });
  const solta = () => { arrasto = null; corte.classList.remove("is-girando"); };
  canvas.addEventListener("pointerup", solta);
  canvas.addEventListener("pointercancel", solta);
  canvas.addEventListener("dblclick", () => { yaw = 0; pitch = 0; if (estaca) estaca.set({ yaw, pitch }); });

  function iniciar() {
    if (webgl && canvas && !estaca) {
      try { estaca = createEstaca(canvas, { estaca: atual, onRender: () => labels.place(estaca.anchors(), kAtual) }); } catch (e) { estaca = null; }
    }
    if (!estaca) {
      corte.classList.add("sem-3d");
      const d = $("[data-corte-svg]", corte);
      if (d && window.IPR_drawSection) d.innerHTML = window.IPR_drawSection(atual, { scale: 7 });
    }
    escolher(atual, false);
    montar(0);
    play();
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); iniciar(); } }, { rootMargin: "0px 0px -25% 0px" });
    io.observe(corte);
  } else iniciar();
}
