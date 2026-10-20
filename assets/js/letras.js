/* Títulos que se revelam linha a linha (referência enerblock.net): quando o título chega à tela, uma
   barra da cor do texto cobre cada linha da esquerda para a direita e sai pela direita, deixando o texto
   no lugar, uma linha depois da outra. As linhas são medidas na hora, então o efeito acompanha qualquer
   largura de tela e qualquer marcação dentro do título. E as fotos não se revelam todas iguais: cada
   lâmina tem o seu jeito (cortina da esquerda, de baixo, do centro ou abertura no lugar), em sequência. */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  var titulos = document.querySelectorAll("main .bloco h2, main .capa h1, main .capa h2, main .galeria__cab h2, main .real__txt h2, main .cfg__titulo, main .crv__titulo, main .eb-titulo, main .mt-titulo, main .pre__titulo");

  // cada palavra vira um span, sem mexer na marcação que já existe (destaques, quebras)
  Array.prototype.forEach.call(titulos, function (h) {
    if (h.dataset.palavras) return;
    h.dataset.palavras = "1";
    (function partir(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (pedaco) {
            if (!pedaco) return;
            if (/^\s+$/.test(pedaco)) { frag.appendChild(document.createTextNode(pedaco)); return; }
            var w = document.createElement("span"); w.className = "pal"; w.textContent = pedaco;
            frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") partir(n);
      });
    })(h);
    h.classList.add("lm-pronto");
  });

  var PASSO = 110, DUR = 820;
  function revelar(h) {
    var hr = h.getBoundingClientRect(), linhas = [];
    Array.prototype.forEach.call(h.querySelectorAll(".pal"), function (p) {
      var r = p.getBoundingClientRect();
      if (!r.width) return;
      var L = null;
      for (var i = 0; i < linhas.length; i++) if (Math.abs(linhas[i].top - r.top) < r.height * 0.5) { L = linhas[i]; break; }
      if (!L) { L = { top: r.top, bot: r.bottom, l: r.left, r: r.right, pals: [] }; linhas.push(L); }
      L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); L.bot = Math.max(L.bot, r.bottom); L.pals.push(p);
    });
    linhas.forEach(function (L, i) {
      var m = document.createElement("i");
      m.className = "lm"; m.setAttribute("aria-hidden", "true");
      m.style.cssText = "left:" + (L.l - hr.left) + "px;top:" + (L.top - hr.top) + "px;width:" + (L.r - L.l) + "px;height:" + (L.bot - L.top) + "px;--d:" + i * PASSO + "ms";
      h.appendChild(m);
      L.pals.forEach(function (p) { p.style.setProperty("--d", (i * PASSO + DUR * 0.45) + "ms"); });
    });
    h.classList.add("lm-on");
    setTimeout(function () {
      Array.prototype.forEach.call(h.querySelectorAll(".lm"), function (m) { m.remove(); });
      h.classList.add("lm-fim");
    }, linhas.length * PASSO + DUR + 60);
  }

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { revelar(en.target); io.unobserve(en.target); } });
  }, { threshold: 0.3, rootMargin: "0px 0px -8% 0px" });
  var comecou = false;
  var comecar = function () { if (comecou) return; comecou = true; Array.prototype.forEach.call(titulos, function (h) { io.observe(h); }); };
  // as linhas são medidas com a fonte certa carregada; se a fonte demorar, não segura o texto escondido
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(comecar);
  setTimeout(comecar, 1200);

  var jeitos = ["esq", "baixo", "centro", "dir", "abre"];
  var placas = document.querySelectorAll("main .placa");
  Array.prototype.forEach.call(placas, function (p, k) { p.dataset.revela = jeitos[k % jeitos.length]; });
  // cada lâmina abre quando chega à tela, esteja ela numa foto, numa faixa ou na abertura da próxima página
  var ioP = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      var c = en.target.querySelector(".cena");
      if (c) c.classList.add("is-in");
      ioP.unobserve(en.target);
    });
  }, { threshold: 0.12 });
  Array.prototype.forEach.call(placas, function (p) { ioP.observe(p); });
})();
