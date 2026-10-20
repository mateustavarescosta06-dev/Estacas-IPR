/* O fundo das partes azuis: azul chapado, sem luz, vinheta nem granulado. Por cima, só desenho:
   bem apagadas, algumas seções de estaca cotadas como numa folha de detalhes, que sobem devagar com a
   rolagem e se movem um pouco com o ponteiro. Nada de texto fixo na tela, que cruzaria o conteúdo. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var c = document.createElement("canvas");
  c.className = "fundo"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild);
  var ctx = c.getContext("2d"), root = document.documentElement;
  var W = 0, H = 0, dpr = 1, raf = 0;
  var mx = 0.66, my = 0.5, tx = 0.66, ty = 0.5;
  var simbolos = [];

  var semente = 11;
  function rnd() { semente = (semente * 16807) % 2147483647; return semente / 2147483647; }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + "px"; c.style.height = H + "px";
    semente = 11; simbolos = [];
    for (var i = 0; i < 9; i++) simbolos.push({ x: 0.06 + rnd() * 0.88, y: rnd() * 5, r: 16 + rnd() * 16, f: Math.floor(rnd() * 3) });
    pedir();
  }

  function hexagono(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i <= 6; i++) { var a = Math.PI / 3 * i; ctx[i ? "lineTo" : "moveTo"](x + r * Math.cos(a), y + r * Math.sin(a)); }
  }

  function desenhar() {
    raf = 0;
    var b = parseFloat(getComputedStyle(root).getPropertyValue("--azul")) || 0;
    c.style.opacity = b.toFixed(3);
    if (b < 0.01) return;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var sy = window.scrollY * 0.18;
    ctx.lineWidth = 1;

    // seções cotadas, raras e apagadas, que sobem devagar com a rolagem
    ctx.strokeStyle = "rgba(200,216,240,0.07)";
    for (var i = 0; i < simbolos.length; i++) {
      var o = simbolos[i], X = o.x * W + (mx - 0.5) * -14, Y = ((o.y * H - sy) % (H * 5) + H * 5) % (H * 5) - H * 0.4;
      if (Y < -60 || Y > H + 60) continue;
      if (o.f === 0) hexagono(X, Y, o.r); else if (o.f === 1) { ctx.beginPath(); ctx.arc(X, Y, o.r, 0, Math.PI * 2); } else { ctx.beginPath(); ctx.rect(X - o.r * 0.85, Y - o.r * 0.85, o.r * 1.7, o.r * 1.7); }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X - o.r, Y + o.r + 10); ctx.lineTo(X + o.r, Y + o.r + 10);
      ctx.moveTo(X - o.r, Y + o.r + 6); ctx.lineTo(X - o.r, Y + o.r + 14);
      ctx.moveTo(X + o.r, Y + o.r + 6); ctx.lineTo(X + o.r, Y + o.r + 14);
      ctx.moveTo(X - o.r - 8, Y); ctx.lineTo(X + o.r + 8, Y); ctx.moveTo(X, Y - o.r - 8); ctx.lineTo(X, Y + o.r + 8);
      ctx.stroke();
    }

    // granulado de filme por cima de tudo

    if (!reduce && (Math.abs(tx - mx) > 0.001 || Math.abs(ty - my) > 0.001)) pedir();
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(desenhar); }
  window.addEventListener("resize", medir);
  window.addEventListener("scroll", pedir, { passive: true });
  if (!reduce && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", function (e) { tx = e.clientX / W; ty = e.clientY / H; pedir(); }, { passive: true });
  }
  medir();
})();
