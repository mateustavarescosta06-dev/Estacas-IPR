/* Parte final da home (referência enerblock.net): o carrossel de obras com setas e as figuras
   "medidas", que crescem com a rolagem e mostram no canto as próprias dimensões, X e Y, em pixels. */
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

  // figuras medidas: a largura vai de 72% a 100% da coluna enquanto a figura atravessa a tela
  var figs = $$("[data-eb-medida]").map(function (f) { return { f: f, x: $(".eb-x", f), y: $(".eb-y", f), img: $("img", f) }; });
  var raf = 0;
  function quadro() {
    raf = 0;
    var vh = window.innerHeight;
    figs.forEach(function (o) {
      var r = o.f.parentNode.getBoundingClientRect();
      var k = reduce ? 1 : clamp((vh - r.top) / (vh + r.height * 0.4), 0, 1);
      var e = k * k * (3 - 2 * k);
      o.f.style.setProperty("--k", e.toFixed(4));
      var b = o.f.getBoundingClientRect();
      o.x.textContent = "X: " + Math.round(b.width);
      o.y.textContent = "Y: " + Math.round(b.height);
    });
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(quadro); }
  if (figs.length) {
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    window.addEventListener("load", pedir);
    quadro();
  }
})();
