/* O fundo do site: papel branco com uma grade amarela simples. Quando a rolagem chega a uma parte
   interativa ([data-azul]: a estaca que se monta, o corte, a cravação, o catálogo), a própria página
   vai ficando azul, de forma contínua, e volta ao branco depois. A grade segue presa à página. */
(function () {
  "use strict";
  var c = document.createElement("canvas");
  c.className = "grade"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild);
  var ctx = c.getContext("2d"), root = document.documentElement;
  var STEP = 48;
  var BRANCO = [255, 255, 255], AZUL = [10, 31, 61];
  var azuis = Array.prototype.slice.call(document.querySelectorAll("[data-azul]"));
  var W = 0, H = 0, dpr = 1, ox = 0, raf = 0, bAtual = -1;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + "px"; c.style.height = H + "px";
    var w = document.querySelector(".hd__inner");
    ox = w ? w.getBoundingClientRect().left : 0; // uma linha da grade cai na margem do conteúdo
    bAtual = -1; pedir();
  }
  // quanto de azul: entra enquanto o topo da parte interativa sobe de 45% a 15% da tela (o texto anterior já saiu), sai no espelho
  function azul() {
    var b = 0;
    for (var i = 0; i < azuis.length; i++) {
      var r = azuis[i].getBoundingClientRect();
      var entra = clamp((H * 0.45 - r.top) / (H * 0.3), 0, 1);
      var sai = clamp((r.bottom - H * 0.55) / (H * 0.3), 0, 1);
      b = Math.max(b, Math.min(entra, sai));
    }
    return b * b * (3 - 2 * b);
  }
  function desenhar() {
    raf = 0;
    var b = azul();
    if (Math.abs(b - bAtual) > 0.001) {
      bAtual = b;
      var cor = BRANCO.map(function (v, i) { return Math.round(v + (AZUL[i] - v) * b); });
      root.style.backgroundColor = "rgb(" + cor.join(",") + ")";
      // em oklch o branco vai ao azul sem passar pelo cinza (navegador sem suporte fica no rgb acima)
      root.style.backgroundColor = "color-mix(in oklch, #0a1f3d " + (b * 100).toFixed(1) + "%, #ffffff)";
      root.style.setProperty("--azul", b.toFixed(3));
      document.body.classList.toggle("no-azul", b > 0.5);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,205,0," + (0.42 - b * 0.26).toFixed(3) + ")";
    var sy = window.scrollY;
    ctx.beginPath();
    for (var x = ((ox % STEP) + STEP) % STEP; x <= W; x += STEP) { var px = Math.round(x) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
    for (var y = -(sy % STEP); y <= H; y += STEP) { var py = Math.round(y) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
    ctx.stroke();
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(desenhar); }
  window.addEventListener("resize", medir);
  window.addEventListener("scroll", pedir, { passive: true });
  medir();
})();
