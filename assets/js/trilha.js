/* A trilha das páginas internas: uma linha amarela no espaço lateral que nasce no título da página
   e é traçada conforme a rolagem desce. Cada seção tem um marco nela; o marco acende quando a
   leitura chega, e o título da seção entra a partir dele. A trilha termina no título da próxima
   página (a abertura dela, repetida no fim desta), onde a página seguinte recomeça. */
(function () {
  "use strict";
  var main = document.querySelector("main");
  var inicio = main && main.querySelector(".capa:not(.capa--seguinte) .capa__txt h1");
  if (!inicio) return; // a home tem o seu próprio percurso
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var alvos = [inicio].concat(Array.prototype.slice.call(main.querySelectorAll(".bloco h2, .capa--seguinte .capa__txt h2")));
  var trilha = document.createElement("div");
  trilha.className = "trilha"; trilha.setAttribute("aria-hidden", "true");
  trilha.innerHTML = '<span class="trilha__fill"></span><span class="trilha__leitura">0,00 m</span>';
  main.appendChild(trilha);
  var fill = trilha.firstChild, leitura = trilha.querySelector(".trilha__leitura");
  var nos = alvos.map(function (h) {
    var n = document.createElement("span"); n.className = "trilha__no"; trilha.appendChild(n);
    h.classList.add("trilha-titulo");
    return { h: h, n: n, y: 0, on: false };
  });
  var topo = 0, altura = 1, raf = 0;
  function abs(el) { var r = el.getBoundingClientRect(); return r.top + window.scrollY; }
  function medir() {
    var base = abs(main);
    topo = abs(inicio) - base + 10;
    var fim = abs(nos[nos.length - 1].h) - base + 10;
    altura = Math.max(1, fim - topo);
    trilha.style.top = topo + "px"; trilha.style.height = altura + "px";
    nos.forEach(function (o) { o.y = abs(o.h) - base + 10 - topo; o.n.style.top = o.y + "px"; });
    pedir();
  }
  function quadro() {
    raf = 0;
    var base = abs(main);
    // a ponta da trilha anda a 62% da altura da tela
    var ponta = window.scrollY + window.innerHeight * 0.62 - base - topo;
    var k = reduce ? 1 : Math.min(1, Math.max(0, ponta / altura));
    fill.style.transform = "scaleY(" + k.toFixed(4) + ")";
    // a trena: a ponta mostra quantos metros da página já foram medidos
    leitura.style.top = (k * altura).toFixed(1) + "px";
    leitura.textContent = (k * altura / 120).toFixed(2).replace(".", ",") + " m";
    nos.forEach(function (o, i) {
      var on = reduce || i === 0 || ponta >= o.y;
      if (on !== o.on) { o.on = on; o.n.classList.toggle("is-on", on); o.h.classList.toggle("is-on", on); }
    });
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(quadro); }
  window.addEventListener("scroll", pedir, { passive: true });
  window.addEventListener("resize", medir);
  window.addEventListener("load", medir);
  medir();
})();
