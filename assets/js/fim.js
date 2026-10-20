/* Comportamentos de fecho, iguais em todas as páginas (referência enerblock.net):
   - botões: o texto rola para cima e a seta atravessa o quadro, saindo por um lado e entrando pelo outro;
   - rótulos pequenos ([data-piscar]): as letras acendem em ordem embaralhada quando chegam à tela;
   - sanfonas (.eb-acord): abrem e fecham animando a altura, uma aberta por vez;
   - chamada final (.pre): a foto da pista corre em parallax por trás do texto;
   - rodapé: o nome gigante ocupa a largura exata e sobe de dentro de uma sombra quando o rodapé chega. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // ---------- botões ----------
  $$(".btn, .btn-eb, .mt-btn").forEach(function (b) {
    if (b.dataset.rolo) return;
    b.dataset.rolo = "1";
    var alvo = b.querySelector(":scope > span:not(.seta)") || b;
    Array.prototype.slice.call(alvo.childNodes).forEach(function (n) {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      var t = n.textContent.trim(), r = document.createElement("span");
      r.className = "rolo";
      r.innerHTML = "<span></span><span aria-hidden=\"true\"></span>";
      r.firstChild.textContent = t; r.lastChild.textContent = t;
      alvo.replaceChild(r, n);
    });
    var ico = b.querySelector(":scope > .ico");
    if (ico) {
      var s = document.createElement("span");
      s.className = "seta";
      b.replaceChild(s, ico);
      s.appendChild(ico);
      var c = ico.cloneNode(true); c.setAttribute("aria-hidden", "true");
      s.appendChild(c);
    }
  });

  // ---------- rótulos que acendem ----------
  var rotulos = $$("[data-piscar], .eb-sobre");
  rotulos.forEach(function (r) {
    var txt = r.textContent;
    r.setAttribute("aria-label", txt.trim());
    r.innerHTML = "";
    var ordem = [];
    for (var i = 0; i < txt.length; i++) {
      var c = document.createElement("span");
      c.className = "pisca"; c.setAttribute("aria-hidden", "true");
      c.textContent = txt[i];
      r.appendChild(c); ordem.push(c);
    }
    for (var k = ordem.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = ordem[k]; ordem[k] = ordem[j]; ordem[j] = t; }
    ordem.forEach(function (c, n) { c.style.setProperty("--d", (n * 38) + "ms"); });
    r.classList.add("pisca-pronto");
  });
  if ("IntersectionObserver" in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("pisca-on"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px" });
    rotulos.forEach(function (r) { io.observe(r); });
  } else rotulos.forEach(function (r) { r.classList.add("pisca-on"); });

  // ---------- sanfonas ----------
  $$(".eb-acord").forEach(function (d, _, todos) {
    var sum = d.querySelector("summary"), corpo = d.querySelector(".eb-acord__corpo");
    if (!sum || !corpo) return;
    sum.addEventListener("click", function (e) {
      e.preventDefault();
      var abrir = !d.open;
      if (abrir) todos.forEach(function (o) { if (o !== d && o.open) fechar(o); });
      abrir ? abre(d) : fechar(d);
    });
    function abre(el) {
      var c = el.querySelector(".eb-acord__corpo");
      el.open = true;
      if (reduce) return;
      var h = c.scrollHeight;
      c.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.7,0,.2,1)" });
    }
    function fechar(el) {
      var c = el.querySelector(".eb-acord__corpo");
      if (reduce) { el.open = false; return; }
      el.classList.add("is-fechando");
      var a = c.animate([{ height: c.scrollHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 420, easing: "cubic-bezier(.7,0,.2,1)" });
      a.onfinish = function () { el.open = false; el.classList.remove("is-fechando"); };
    }
  });

  // ---------- chamada final e rodapé ----------
  var par = document.querySelector("[data-pre-par]");
  var marca = document.querySelector("[data-ft-marca]");
  var marcaIn = marca && marca.querySelector(".ft2__marca-in"), marcaTxt = marca && marca.querySelector("span");
  var sombra = marca && marca.querySelector(".ft2__sombra");

  // o nome ocupa exatamente a largura útil, qualquer que seja a tela
  function ajustar() {
    if (!marcaTxt) return;
    marcaTxt.style.fontSize = "100px";
    var w = marcaIn.clientWidth, t = marcaTxt.scrollWidth;
    if (t > 0) marcaTxt.style.fontSize = (100 * w / t).toFixed(2) + "px";
  }

  var raf = 0;
  function quadro() {
    raf = 0;
    var vh = window.innerHeight;
    if (par) {
      var r = par.parentNode.getBoundingClientRect();
      var k = clamp((vh - r.top) / (vh + r.height), 0, 1);
      par.style.transform = "translate3d(0," + ((k - 0.5) * -22).toFixed(2) + "%,0) scale(1.18)";
    }
    if (marca) {
      var m = marca.getBoundingClientRect();
      // 0 quando o nome aparece no pé da tela, 1 quando ele chega inteiro
      var p = reduce ? 1 : clamp((vh - m.top) / (m.height * 1.1), 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      marcaIn.style.transform = "translate3d(0," + ((1 - e) * -55).toFixed(2) + "%,0)";
      sombra.style.opacity = (0.9 * (1 - e)).toFixed(3);
    }
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(quadro); }
  if (par || marca) {
    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", function () { ajustar(); pedir(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajustar(); pedir(); });
    ajustar(); quadro();
  }
})();
