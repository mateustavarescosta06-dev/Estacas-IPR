/* Parte final da home (referência enerblock.net): o carrossel de obras com setas, as figuras com mira
   que abrem com a rolagem mostrando X e Y, as abas de serviço e a foto fixa com a frase que troca. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // carrossel: as setas andam um cartão por vez
  var trilho = $("[data-eb-trilho]");
  if (trilho) {
    var passo = function (dir) {
      var card = $(".eb-card", trilho);
      var w = card ? card.getBoundingClientRect().width + 2 : trilho.clientWidth * 0.8;
      trilho.scrollBy({ left: dir * w, behavior: reduce ? "auto" : "smooth" });
    };
    var ant = $("[data-eb-ant]"), prox = $("[data-eb-prox]");
    if (ant) ant.addEventListener("click", function () { passo(-1); });
    if (prox) prox.addEventListener("click", function () { passo(1); });
  }

  // figura com mira (referência enerblock.net, "cross-image"): a foto abre a partir de um ponto perto do
  // canto superior esquerdo até ocupar o quadro, a mira acompanha o canto que cresce e mostra X e Y em
  // pixels; a foto por dentro vem de 2x e assenta em 1x.
  var cruzes = $$("[data-eb-cruz]").map(function (f) {
    return { f: f, img: $(".eb-cruz__img", f), im: $(".eb-cruz__img img", f), v: $(".eb-cruz__v", f), h: $(".eb-cruz__h", f), p: $(".eb-cruz__p", f), x: $(".eb-cruz__x", f), y: $(".eb-cruz__y", f) };
  });
  var raf = 0, M0 = 20;
  function quadro() {
    raf = 0;
    var vh = window.innerHeight;
    cruzes.forEach(function (o) {
      var r = o.f.getBoundingClientRect(), W = r.width, H = r.height;
      // começa quando o topo da figura entra pelo pé da tela e termina quando ela está quase inteira à vista
      var k = reduce ? 1 : clamp((vh * 0.95 - r.top) / (Math.min(H, vh) * 0.95), 0, 1);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      var m = M0 * (1 - e), cx = m + (W - m) * e, cy = m + (H - m) * e;
      o.img.style.clipPath = "inset(" + m.toFixed(1) + "px " + (W - cx).toFixed(1) + "px " + (H - cy).toFixed(1) + "px " + m.toFixed(1) + "px)";
      if (o.im) o.im.style.transform = "scale(" + (2 - e).toFixed(4) + ")";
      o.v.style.transform = "translate3d(" + cx.toFixed(1) + "px,0,0)";
      o.h.style.transform = "translate3d(0," + cy.toFixed(1) + "px,0)";
      o.p.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      o.x.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      o.y.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      o.x.textContent = "X: " + Math.round(cx - M0);
      o.x.classList.toggle("is-esq", cx > W - 80); // perto da borda direita, o X passa para o lado de dentro da mira
      o.y.textContent = "Y: " + Math.round(cy - M0);
    });
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(quadro); }
  if (cruzes.length) {
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    window.addEventListener("load", pedir);
    quadro();
  }

  // abas de serviços (referência metriccivil.ca/services): clique ou setas do teclado
  var abas = $("[data-mt-abas]");
  if (abas) {
    var bts = $$(".mt-aba", abas);
    var ativar = function (bt, foco) {
      bts.forEach(function (b) {
        var on = b === bt, p = document.getElementById(b.getAttribute("aria-controls"));
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        p.hidden = !on; p.classList.toggle("is-on", on);
      });
      if (foco) bt.focus();
      if (abas.scrollWidth > abas.clientWidth) abas.scrollTo({ left: bt.offsetLeft - 20, behavior: reduce ? "auto" : "smooth" });
    };
    bts.forEach(function (b, i) {
      b.addEventListener("click", function () { ativar(b); });
      b.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? bts.length - 1 : -2;
        if (j === -2) return;
        e.preventDefault(); ativar(bts[(j + bts.length) % bts.length], true);
      });
    });
  }

  // foto fixa: a rolagem escolhe qual final da frase (e qual foto) aparece
  var exp = $("[data-mt-exp]");
  if (exp) {
    var fotos = $$(".mt-exp__img", exp), frases = $$(".mt-exp__troca > span", exp), atual = 0, rafE = 0;
    var mostrar = function () {
      rafE = 0;
      var r = exp.getBoundingClientRect(), vh = window.innerHeight;
      var k = clamp(-r.top / Math.max(1, r.height - vh), 0, 0.999);
      var n = Math.floor(k * frases.length);
      if (n === atual) return;
      frases.forEach(function (f, i) { f.classList.toggle("is-on", i === n); f.classList.toggle("is-saiu", i < n); });
      fotos.forEach(function (f, i) { f.classList.toggle("is-on", i === n); });
      atual = n;
    };
    window.addEventListener("scroll", function () { if (!rafE) rafE = requestAnimationFrame(mostrar); }, { passive: true });
    mostrar();
  }
})();
