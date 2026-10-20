/* Barra superior (referência metriccivil.ca): transparente no topo; some ao descer e volta ao
   subir, já com o fundo de papel deslizando de cima; nos links, cada letra rola para cima e uma
   cópia sobe por baixo, uma depois da outra. */
(function () {
  "use strict";
  var hd = document.querySelector("[data-header]");
  if (!hd) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // letras que rolam: o texto fica no aria-label, as letras são só desenho
  function rolar(el) {
    var txt = el.textContent.replace(/\s+/g, " ").trim();
    if (!txt) return;
    var ico = el.querySelector(".ico");
    el.setAttribute("aria-label", el.getAttribute("aria-label") || txt);
    var html = '<span class="rola" aria-hidden="true">';
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i] === " " ? "&nbsp;" : txt[i].replace("&", "&amp;").replace("<", "&lt;");
      html += '<span class="rola__l" style="--i:' + i + '"><span>' + c + '</span><span>' + c + "</span></span>";
    }
    el.innerHTML = html + "</span>";
    if (ico) el.appendChild(ico);
  }
  Array.prototype.forEach.call(hd.querySelectorAll(".nav ul a, .hd__cta"), rolar);

  // mostrar, esconder e o fundo
  var ultimo = window.scrollY, raf = 0;
  function quadro() {
    raf = 0;
    var y = Math.max(0, window.scrollY), d = y - ultimo;
    var aberto = document.querySelector("[data-nav].is-open");
    if (aberto || y < 10) hd.classList.remove("hd--oculta");
    else if (d > 4 && y > hd.offsetHeight) hd.classList.add("hd--oculta");
    else if (d < -4) hd.classList.remove("hd--oculta");
    hd.classList.toggle("hd--fundo", y > 10 || !!aberto);
    document.documentElement.classList.toggle("rolou", y > 240);
    if (Math.abs(d) > 4) ultimo = y;
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(quadro); }
  window.addEventListener("scroll", pedir, { passive: true });
  document.addEventListener("click", function (e) { if (e.target.closest("[data-nav-toggle]")) setTimeout(quadro, 0); });
  // foco pelo teclado traz a barra de volta
  hd.addEventListener("focusin", function () { hd.classList.remove("hd--oculta"); });
  if (reduce) hd.classList.add("hd--sem-mov");
  quadro();
})();
