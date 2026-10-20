/* Títulos que entram palavra por palavra (referência metriccivil.ca): cada palavra sobe de dentro
   de uma máscara quando o título chega à tela. E as fotos não se revelam todas iguais: cada lâmina
   tem o seu jeito (cortina da esquerda, de baixo, do centro ou abertura no lugar), em sequência. */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  var titulos = document.querySelectorAll("main .bloco h2, main .capa h1, main .capa h2, main .galeria__cab h2, main .real__txt h2, main .corte h2");
  Array.prototype.forEach.call(titulos, function (h) {
    if (h.dataset.palavras) return;
    h.dataset.palavras = "1";
    var i = 0;
    (function partir(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (pedaco) {
            if (!pedaco) return;
            if (/^\s+$/.test(pedaco)) { frag.appendChild(document.createTextNode(pedaco)); return; }
            var w = document.createElement("span"); w.className = "pal";
            var x = document.createElement("span"); x.textContent = pedaco; x.style.setProperty("--i", i++);
            w.appendChild(x); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") partir(n);
      });
    })(h);
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("pal-in"); io.unobserve(en.target); } });
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
  Array.prototype.forEach.call(titulos, function (h) { io.observe(h); });

  var jeitos = ["esq", "baixo", "centro", "dir", "abre"];
  Array.prototype.forEach.call(document.querySelectorAll("main .placa"), function (p, k) { p.dataset.revela = jeitos[k % jeitos.length]; });
})();
