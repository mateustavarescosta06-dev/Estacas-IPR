/* A jornada da estaca: tom de material por trecho, profundidade das fotos pela rolagem,
   a linha de produção da home, os fios que se tensionam ao fim de cada página e a costura
   com a próxima (view transitions). Nada aqui reage ao ponteiro: o movimento vem da rolagem
   e do próprio processo. */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var body = document.body, root = document.documentElement;
  var vh = window.innerHeight, vw = window.innerWidth;

  /* ---------- Tom: o trecho que ocupa o meio da tela define a luz da página ---------- */
  var base = body.getAttribute("data-tone-base");
  var toned = $$("main > [data-tone]"); // só os trechos; as estações do trilho são lidas pelo próprio trilho
  var meta = $('meta[name="theme-color"]');
  var tone = base, metaTimer = 0;
  function setTone(t) {
    if (t === tone) return;
    tone = t;
    body.setAttribute("data-tone", t);
    clearTimeout(metaTimer);
    metaTimer = setTimeout(function () { if (meta) meta.setAttribute("content", getComputedStyle(body).backgroundColor); }, 1400);
  }
  function toneAt() {
    var mid = vh * 0.55, t = base;
    for (var i = 0; i < toned.length; i++) {
      var r = toned[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) t = toned[i].getAttribute("data-stage-tone") || toned[i].getAttribute("data-tone");
    }
    return t;
  }

  /* ---------- Linha de produção no cabeçalho ---------- */
  var linha = $("[data-linha]"), fill = $("[data-linha-fill]");
  var step = linha ? +linha.getAttribute("data-step") : 0, n = linha ? +linha.getAttribute("data-n") : 1;
  var nav = $("[data-nav]");

  /* ---------- Profundidade: a foto anda mais devagar que a página ---------- */
  var pars = reduce ? [] : $$("[data-par]");
  // a foto da abertura entra como painel e abre até as bordas: o recorte lateral cede com a rolagem
  var palco = $("[data-palco]");
  var heroCena = palco ? $(".abertura__cena", palco) : null, heroPic = palco ? $("img", palco) : null;
  var gutter = 0;
  function readGutter() { var w = $(".abertura__topo"); gutter = w ? w.getBoundingClientRect().left : 0; }

  /* ---------- Linha de produção horizontal (home) ---------- */
  var trilho = $("[data-trilho]");
  var pista = trilho && $(".trilho__pista", trilho), lista = trilho && $(".trilho__lista", trilho);
  var estacoes = trilho ? $$(".estacao", trilho) : [];
  function panOn() { return trilho && !reduce && vw > 820; }
  // as estações entram pela lateral: carregar antes que o trilho chegue, sem esperar a interseção horizontal
  if (trilho) {
    var eager = function () { $$("img", trilho).forEach(function (im) { im.loading = "eager"; }); };
    if ("IntersectionObserver" in window) {
      var near = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { eager(); near.disconnect(); } }, { rootMargin: "150% 0px" });
      near.observe(trilho);
    } else eager();
  }

  /* ---------- Fios de protensão nas passagens ---------- */
  var fiosSets = $$("[data-fios]").map(function (el) {
    return { el: el, paths: $$("[data-fio]", el), ys: $$("[data-fio]", el).map(function (p) { return +p.getAttribute("d").split(" ")[1]; }), tensa: false, last: -1 };
  });
  function tension(set) {
    var r = set.el.getBoundingClientRect();
    if (r.top > vh * 1.1 || r.bottom < -vh * .2) return;
    var t = reduce ? 1 : clamp((vh - r.top) / (vh * 0.78), 0, 1);
    var k = 1 - Math.pow(1 - t, 3), sag = (1 - k) * 34;
    if (Math.abs(sag - set.last) > 0.05) {
      set.last = sag;
      for (var i = 0; i < set.paths.length; i++) {
        var y = set.ys[i] + 0; // folga maior nos fios do meio, como numa pista real
        set.paths[i].setAttribute("d", "M0 " + y + " Q500 " + (y + sag * (0.7 + 0.06 * i)).toFixed(2) + " 1000 " + y);
      }
    }
    if (t >= 0.995 && !set.tensa) { set.tensa = true; set.el.classList.add("is-tensa"); }
    else if (t < 0.85 && set.tensa) { set.tensa = false; set.el.classList.remove("is-tensa"); }
  }

  /* ---------- Clipes do Higgsfield (opcionais) ---------- */
  // Na passagem, o clipe começa no quadro desta página e termina no quadro que abre a próxima:
  // a rolagem o faz avançar e ele para exatamente onde a capa seguinte começa.
  var scrubs = reduce ? [] : $$("video[data-scrub]").map(function (v) {
    var s = { v: v, sec: v.closest(".passagem"), ready: false, loading: false, want: 0 };
    v.addEventListener("seeked", function () { if (Math.abs(v.currentTime - s.want) > 0.03) v.currentTime = s.want; });
    return s;
  });
  function loadVideo(s) {
    if (s.loading || !window.fetch || !window.URL) return;
    s.loading = true;
    var src = s.v.getAttribute(window.matchMedia("(max-width: 820px)").matches ? "data-src-m" : "data-src");
    // o arquivo inteiro vem antes: buscar quadros num arquivo baixado pela metade trava a rolagem
    fetch(src).then(function (r) { return r.ok ? r.blob() : Promise.reject(r.status); }).then(function (blob) {
      s.v.addEventListener("loadeddata", function () { s.ready = true; s.v.parentNode.classList.add("is-video"); onScroll(); }, { once: true });
      s.v.src = URL.createObjectURL(blob);
    }).catch(function () { /* sem o clipe, fica a foto */ });
  }
  function scrub(s) {
    var r = s.sec.getBoundingClientRect();
    if (r.top > vh * 2 || r.bottom < 0) return;
    loadVideo(s);
    if (!s.ready || !s.v.duration) return;
    s.want = clamp((vh - r.top) / (vh * 0.78), 0, 1) * (s.v.duration - 0.05);
    if (!s.v.seeking) s.v.currentTime = s.want;
  }
  // iOS só desenha quadros de um vídeo depois de um play(): destrava no primeiro toque
  if (scrubs.length) document.addEventListener("touchstart", function () {
    scrubs.forEach(function (s) { var p = s.v.play(); if (p && p.then) p.then(function () { s.v.pause(); }).catch(function () {}); });
  }, { once: true, passive: true });
  // Abertura: loop ambiente com câmera parada, só enquanto estiver na tela
  var loop = reduce ? null : $("video[data-loop]");
  if (loop && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) {
        loop.preload = "auto";
        var p = loop.play();
        if (p && p.then) p.then(function () { loop.parentNode.classList.add("is-video"); }).catch(function () { /* economia de energia: fica a foto */ });
      } else loop.pause();
    }).observe(loop);
  }
  var depths = reduce ? [] : $$(".abertura [data-depth]");

  function frame() {
    ticking = false;
    var y = window.scrollY;

    if (fill) {
      var h = document.documentElement.scrollHeight - vh;
      var p = h > 0 ? clamp(y / h, 0, 1) : 1;
      fill.style.setProperty("--p", clamp((step + .5 + p) / n, 0, 1).toFixed(4));
    }
    if (heroPic && !reduce && y < vh * 2) {
      var o = clamp(y / (vh * 0.55), 0, 1), eo = 1 - Math.pow(1 - o, 3);
      heroCena.style.setProperty("--inset", (gutter * (1 - eo)).toFixed(1) + "px");
      heroCena.style.setProperty("--r", (2 * (1 - eo)).toFixed(2) + "px");
      heroPic.style.setProperty("--s", (1.06 - eo * 0.06).toFixed(4));
      heroPic.style.setProperty("--y", (Math.max(0, y - vh * 0.3) * 0.22).toFixed(1) + "px");
    }
    for (var i = 0; i < pars.length; i++) {
      var r = pars[i].getBoundingClientRect();
      if (r.bottom < -50 || r.top > vh + 50) continue;
      var q = clamp(((r.top + r.height / 2) - vh / 2) / (vh + r.height), -0.5, 0.5);
      pars[i].style.setProperty("--py", (-6.14 - q * 12).toFixed(2) + "%");
    }
    if (panOn()) {
      var pr = pista.getBoundingClientRect(), total = pr.height - vh;
      var pp = clamp(-pr.top / (total > 0 ? total : 1), 0, 1);
      var max = Math.max(0, lista.scrollWidth - vw);
      lista.style.setProperty("--x", (-pp * max).toFixed(1) + "px");
      var idx = Math.min(estacoes.length - 1, Math.floor(pp * estacoes.length * 0.999));
      trilho.setAttribute("data-stage-tone", estacoes[idx].getAttribute("data-tone"));
      for (var e = 0; e < estacoes.length; e++) estacoes[e].classList.toggle("is-here", e === idx);
    }
    fiosSets.forEach(tension);
    scrubs.forEach(scrub);
    for (var d = 0; d < depths.length; d++) depths[d].style.setProperty("--fy", (y * parseFloat(depths[d].getAttribute("data-depth"))).toFixed(1) + "px");
    setTone(toneAt());
  }
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { vh = window.innerHeight; vw = window.innerWidth; readGutter(); onScroll(); });
  readGutter();
  if (nav) new MutationObserver(onScroll).observe(nav, { attributes: true, attributeFilter: ["class"] });
  frame();

  /* ---------- Costura com a próxima página ---------- */
  // O fim desta página já é a capa da próxima: no clique, a cena e os fios da passagem
  // recebem os nomes que a capa da próxima página usa, e a troca vira um só movimento.
  // O fim da página é a abertura da próxima: no clique, título, texto, desenho e foto desta cópia
  // recebem os nomes que a abertura da próxima usa, e a troca vira um deslizar para o lugar.
  var NOMES = { ".capa__txt h1, .capa__txt h2": "capa-titulo", ".capa__txt .lead": "capa-lead", ".capa__desenho": "capa-desenho", ".capa__cena": "cena" };
  function clearNames() {
    Object.keys(NOMES).forEach(function (sel) { $$(sel).forEach(function (el) { el.style.viewTransitionName = ""; }); });
  }
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-passagem]");
    if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    var seg = a.closest(".capa--seguinte");
    Object.keys(NOMES).forEach(function (sel) {
      $$(sel).forEach(function (el) { el.style.viewTransitionName = "none"; });
      var alvo = seg && $(sel, seg);
      if (alvo) alvo.style.viewTransitionName = NOMES[sel];
    });
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) { clearNames(); onScroll(); } });
})();
