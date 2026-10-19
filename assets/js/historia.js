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

/* ---------- O dia ---------- */
const dia = $("[data-dia]");
if (dia) {
  const pista = $(".dia__pista", dia), palco = $(".dia__palco", dia);
  const hh = $("[data-hh]", dia), mm = $("[data-mm]", dia), dd = $("[data-dd]", dia), relogio = $("[data-relogio]", dia);
  const regua = $("[data-regua]", dia);
  const caps = $$("[data-de]", dia).map((el) => ({ el, de: +el.dataset.de, ate: +el.dataset.ate, cobre: el.classList.contains("intervalo") }));
  const canvas = $("[data-estaca]", dia);
  let estaca = null;
  if (webgl && canvas) {
    try { estaca = createEstaca(canvas, { shiftX: 0.1 }); } catch (e) { estaca = null; }
  }
  if (!estaca && canvas) canvas.hidden = true;
  dia.classList.toggle("sem-3d", !estaca);

  function estado(p) {
    return {
      form: r(p, 0.05, 0.1), wireIn: r(p, 0.08, 0.12), tension: r(p, 0.12, 0.185), view: r(p, 0.07, 0.12) * (1 - r(p, 0.27, 0.3)),
      fill: r(p, 0.29, 0.37), cps: r(p, 0.34, 0.4), cure: r(p, 0.52, 0.6),
      test: r(p, 0.72, 0.82), release: r(p, 0.84, 0.875), open: r(p, 0.87, 0.91), lift: r(p, 0.9, 0.95), turn: r(p, 0.93, 0.995),
    };
  }

  let last = -1;
  function frame() {
    ticking = false;
    const rect = pista.getBoundingClientRect(), total = rect.height - innerHeight;
    const p = reduce ? 1 : clamp(-rect.top / (total > 0 ? total : 1), 0, 1);
    if (Math.abs(p - last) < 0.0002) return;
    last = p;
    const m = minutes(p), mod = ((m % 1440) + 1440) % 1440;
    hh.textContent = String(Math.floor(mod / 60)).padStart(2, "0");
    mm.textContent = String(Math.floor(mod % 60)).padStart(2, "0");
    dd.textContent = m >= 1440 ? "Dia 2" : "Dia 1";
    if (regua) regua.style.setProperty("--p", ((m - 340) / (1800 - 340)).toFixed(4));
    const [a, b, k] = between(LUZ, m), luz = mixLight(a, b, k);
    palco.style.setProperty("--bg", luz.fog);
    relogio.classList.toggle("is-noite", luz.sodium > 1.2);

    // capítulos e interlúdios: entram e saem com margens curtas
    let cobre = 0;
    caps.forEach((c) => {
      const f = 0.014, o = clamp(Math.min((p - c.de) / f + 1, (c.ate - p) / f + 1), 0, 1);
      c.el.style.opacity = o.toFixed(3);
      c.el.classList.toggle("is-on", o > 0.5);
      c.el.style.setProperty("--k", r(p, c.de, c.ate).toFixed(4));
      if (c.cobre) cobre = Math.max(cobre, o);
    });
    if (estaca) {
      canvas.style.opacity = (1 - cobre).toFixed(3);
      if (cobre < 0.999) estaca.set(Object.assign(estado(p), { light: luz }));
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
  const ETAPAS = [[0, "Fôrma"], [0.14, "Fios"], [0.35, "Concreto"], [0.6, "Cura"], [0.75, "Liberação"], [0.9, "Seção"]];

  function estado(k) {
    return {
      form: r(k, 0, 0.12), wireIn: r(k, 0.1, 0.2), tension: r(k, 0.18, 0.34), fill: r(k, 0.35, 0.6), cure: r(k, 0.6, 0.75),
      cps: 0, test: 0, release: r(k, 0.75, 0.82), open: r(k, 0.8, 0.88), lift: r(k, 0.86, 0.94), turn: r(k, 0.9, 1), view: 0,
      light: { sun: "#fff3e0", sunI: 2.4, elev: 26, azim: -55, sky: "#9db6dc", ground: "#0a1426", hemiI: 1.0, sodium: 0, exposure: 1.04, env: 0.85, fog: "#071428" },
    };
  }
  function montar(k) {
    range.value = Math.round(k * 100);
    range.style.setProperty("--p", k * 100 + "%");
    let nome = ETAPAS[0][1];
    ETAPAS.forEach(([v, n]) => { if (k >= v) nome = n; });
    etapa.textContent = nome;
    if (estaca) estaca.set(estado(k));
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
  function escolher(e, animar) {
    atual = e;
    formas.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.forma === e.forma)));
    lista_(e.forma);
    renderFicha(e);
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

  function iniciar() {
    if (webgl && canvas && !estaca) {
      try { estaca = createEstaca(canvas, { estaca: atual }); } catch (e) { estaca = null; }
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
