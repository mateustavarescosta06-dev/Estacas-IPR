/* Home: 24 horas na fábrica. A rolagem conduz um time-lapse da pista da IPR, gerado a partir da foto
   real da fábrica: madrugada, protensão, concretagem, cura, noite e o nascer do dia em que a estaca nasce.
   Nas paradas fica a foto nítida do momento; entre elas, o filme anda com a rolagem, para frente e para trás. */

const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Paradas [início, fim, segundo do filme]. Entre uma parada e a seguinte o filme corre linear. */
const PARADAS = [[0.12, 0.22, 0], [0.4, 0.5, 5], [0.66, 0.74, 10], [0.9, 1.01, 15]];
function tempo(p) {
  if (p <= PARADAS[0][1]) return 0;
  for (let i = 1; i < PARADAS.length; i++) {
    const [, a1, ta] = PARADAS[i - 1], [b0, b1, tb] = PARADAS[i];
    if (p < b0) return ta + (tb - ta) * r(p, a1, b0);
    if (p <= b1) return tb;
  }
  return PARADAS[PARADAS.length - 1][2];
}

const dia = $("[data-dia]");
if (dia) {
  const pista = $(".dia__pista", dia), palco = $(".dia__palco", dia), filme = $(".filme", dia);
  const video = $("video[data-filme]", dia);
  const caps = $$(".capitulo[data-de]", dia).map((el) => ({ el, de: +el.dataset.de, ate: +el.dataset.ate }));
  const quadros = $$("[data-quadro]", dia).map((el) => ({ el, de: +el.dataset.de, ate: +el.dataset.ate, f: +(el.dataset.f || 0.012) }));
  const cronologia = quadros.slice().sort((a, b) => a.ate - b.ate);
  const marcas = $$("[data-marca]", dia).map((el) => ({ el, u: +el.dataset.u, v: +el.dataset.v, de: +el.dataset.de, ate: +el.dataset.ate }));
  const etapas = $$("[data-etapas] button", dia);
  const MARCOS = etapas.map((b) => +b.dataset.ir);

  /* ---------- O filme: baixado inteiro antes de responder à rolagem ---------- */
  let pronto = false, alvo = 0;
  if (video && !reduce && window.fetch && window.URL) {
    video.addEventListener("seeked", () => { if (Math.abs(video.currentTime - alvo) > 0.03) video.currentTime = alvo; });
    const carregar = () => {
      const src = video.getAttribute(matchMedia("(max-width: 820px)").matches ? "data-src-m" : "data-src");
      fetch(src).then((res) => (res.ok ? res.blob() : Promise.reject(res.status))).then((blob) => {
        video.addEventListener("loadeddata", () => { pronto = true; filme.classList.add("tem-filme"); last = -1; onScroll(); }, { once: true });
        video.src = URL.createObjectURL(blob);
      }).catch(() => { /* sem o filme, as fotos se cruzam entre as paradas */ });
    };
    // depois da primeira pintura, para não disputar banda com a foto da abertura
    if (document.readyState === "complete") setTimeout(carregar, 200);
    else addEventListener("load", () => setTimeout(carregar, 200), { once: true });
    // iOS só desenha quadros de um vídeo depois de um play(): destrava no primeiro toque
    document.addEventListener("touchstart", () => { const pr = video.play(); if (pr && pr.then) pr.then(() => video.pause()).catch(() => {}); }, { once: true, passive: true });
  }
  function buscar(t) {
    alvo = Math.min(t, (video.duration || 15) - 0.04);
    if (!video.seeking && Math.abs(video.currentTime - alvo) > 0.01) video.currentTime = alvo;
  }

  /* ---------- Rótulos presos a um ponto da imagem (coordenadas do quadro 16:9) ---------- */
  let caixa = { x: 0, y: 0, w: 1, h: 1 };
  function medir() {
    const W = filme.clientWidth, H = filme.clientHeight, ar = 16 / 9;
    const cs = getComputedStyle(filme);
    const fx = parseFloat(cs.getPropertyValue("--fx")) / 100 || 0.5, fy = parseFloat(cs.getPropertyValue("--fy")) / 100 || 0.5;
    const w = Math.max(W, H * ar), h = w / ar;
    caixa = { x: (W - w) * fx, y: (H - h) * fy, w, h, W };
  }

  // índice das etapas: marca a atual e leva direto a ela
  const irPara = (p) => {
    const total = pista.offsetHeight - innerHeight;
    scrollTo({ top: pista.getBoundingClientRect().top + scrollY + p * total, behavior: reduce ? "auto" : "smooth" });
  };
  etapas.forEach((b) => b.addEventListener("click", () => irPara(+b.dataset.ir)));

  const fade = (p, de, ate, f) => clamp(Math.min((p - de) / f + 1, (ate - p) / f + 1), 0, 1);

  let last = -1;
  function frame() {
    ticking = false;
    const rect = pista.getBoundingClientRect(), total = rect.height - innerHeight;
    const p = reduce ? 1 : clamp(-rect.top / (total > 0 ? total : 1), 0, 1);
    if (Math.abs(p - last) < 0.0002) return;
    last = p;

    // fotos nítidas nas paradas; sem filme, elas se cruzam pelo trecho inteiro
    if (pronto) {
      quadros.forEach((q) => { q.el.style.opacity = fade(p, q.de, q.ate, q.f).toFixed(3); });
      buscar(tempo(p));
    } else {
      // sem filme: a foto de cada parada cobre a seguinte (vem antes no empilhamento) e se desfaz ao longo do trecho
      cronologia.forEach((q, i) => {
        const prox = cronologia[i + 1];
        const o = !prox || p <= q.ate ? 1 : 1 - r(p, q.ate, Math.max(prox.de, q.ate + q.f));
        q.el.style.opacity = o.toFixed(3);
      });
    }

    let atual = -1;
    MARCOS.forEach((v, i) => { if (p >= v - 0.04) atual = i; });
    etapas.forEach((el, i) => { el.classList.toggle("is-on", i === atual); el.classList.toggle("is-past", i < atual); });
    dia.classList.toggle("is-inicio", p < 0.06);

    caps.forEach((c) => {
      const o = fade(p, c.de, c.ate, 0.014);
      c.el.style.opacity = o.toFixed(3);
      c.el.classList.toggle("is-on", o > 0.5);
    });
    marcas.forEach((m) => {
      const o = fade(p, m.de, m.ate, 0.012);
      m.el.style.opacity = o.toFixed(3);
      if (o > 0) {
        const x = caixa.x + m.u * caixa.w, y = caixa.y + m.v * caixa.h;
        m.el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
        m.el.classList.toggle("marca--e", x > caixa.W * 0.58);
      }
    });
  }
  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", onScroll, { passive: true });
  let largura = innerWidth;
  addEventListener("resize", () => {
    // no celular a barra de endereço muda só a altura: não refaz nada por isso
    if (innerWidth === largura && matchMedia("(pointer: coarse)").matches) return;
    largura = innerWidth; medir(); last = -1; onScroll();
  });
  medir();
  frame();
}

/* ---------- A estaca em corte: a foto do topo da peça e o desenho do ábaco ---------- */
const corte = $("[data-corte]");
if (corte) {
  const DATA = window.IPR_ESTACAS || [];
  const formas = $$("[data-forma]", corte), lista = $("[data-bitolas]", corte), ficha = $("[data-ficha]", corte);
  const fotos = $$("[data-foto]", corte), desenho = $("[data-corte-svg]", corte), legenda = $("[data-legenda]", corte);
  const fmt = (n, d) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  let atual = DATA.find((e) => e.id === "H33") || DATA[0];

  function renderFicha(e) {
    if (e.consulta) {
      ficha.innerHTML = "<div><dt>Seção</dt><dd>" + e.nome + "</dd></div><div><dt>Linha vazada</dt><dd>sob consulta</dd></div>";
      return;
    }
    ficha.innerHTML = [["Seção", e.nome], ["Aço", e.aco], ["Área de concreto", fmt(e.area) + " cm²"], ["Massa", fmt(e.massa) + " kg/m"], ["Compressão NBR 6118", fmt(e.compNbr, 1) + " kN"]]
      .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + v + "</dd></div>").join("");
  }
  function bitolas(forma) {
    lista.innerHTML = DATA.filter((e) => e.forma === forma).map((e) =>
      '<li><button type="button" data-id="' + e.id + '" aria-pressed="' + (e.id === atual.id) + '">' + (e.forma === "quadrada" ? "30 × 30" : "Ø " + e.d) + "</button></li>").join("");
  }
  function escolher(e) {
    atual = e;
    formas.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.forma === e.forma)));
    bitolas(e.forma);
    renderFicha(e);
    fotos.forEach((f) => f.classList.toggle("is-on", f.dataset.foto === e.forma));
    if (desenho && window.IPR_drawSection) desenho.innerHTML = window.IPR_drawSection(e, { scale: e.d > 34 ? 4.2 : 5.4 });
    if (legenda) legenda.textContent = e.nome + " · " + (e.consulta ? "linha vazada, sob consulta" : e.aco);
  }
  formas.forEach((b) => b.addEventListener("click", () => {
    escolher(DATA.find((e) => e.forma === b.dataset.forma && !e.consulta) || DATA.find((e) => e.forma === b.dataset.forma));
  }));
  lista.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-id]");
    if (b) escolher(DATA.find((e) => e.id === b.dataset.id));
  });
  escolher(atual);
}
