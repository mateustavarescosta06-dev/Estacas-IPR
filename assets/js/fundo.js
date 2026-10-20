/* O fundo das partes azuis (referência rapidkert.com): não é mais um azul chapado. Uma luz larga
   vinda do alto, uma vinheta que escurece as bordas, um granulado fino de filme, a linha do terreno
   (N.T. ±0,00) atravessando a tela e, bem apagadas, algumas seções de estaca cotadas como numa folha
   de detalhes. Uma luz de sódio quente acompanha o ponteiro, devagar. A estaca continua o destaque. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var c = document.createElement("canvas");
  c.className = "fundo"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild);
  var ctx = c.getContext("2d"), root = document.documentElement;
  var W = 0, H = 0, dpr = 1, raf = 0;
  var mx = 0.66, my = 0.5, tx = 0.66, ty = 0.5;
  var fonte = getComputedStyle(root).getPropertyValue("--f-mono").trim() || "monospace";
  var simbolos = [], grao = null;

  var semente = 11;
  function rnd() { semente = (semente * 16807) % 2147483647; return semente / 2147483647; }

  // granulado: um ladrilho de ruído desenhado uma vez e repetido
  function fazerGrao() {
    var g = document.createElement("canvas"); g.width = g.height = 160;
    var gx = g.getContext("2d"), img = gx.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 14;
    }
    gx.putImageData(img, 0, 0);
    return ctx.createPattern(g, "repeat");
  }

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + "px"; c.style.height = H + "px";
    semente = 11; simbolos = [];
    for (var i = 0; i < 9; i++) simbolos.push({ x: 0.06 + rnd() * 0.88, y: rnd() * 5, r: 16 + rnd() * 16, f: Math.floor(rnd() * 3) });
    grao = fazerGrao();
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
    var D = Math.max(W, H);

    // luz larga do alto, um pouco à direita (onde a peça está)
    var g = ctx.createRadialGradient(W * 0.64, H * 0.3, 0, W * 0.64, H * 0.3, D * 0.75);
    g.addColorStop(0, "rgba(58,104,170,0.42)"); g.addColorStop(0.5, "rgba(26,58,110,0.14)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // vinheta: bordas e pé da tela mais escuros
    var v = ctx.createRadialGradient(W * 0.55, H * 0.42, D * 0.25, W * 0.55, H * 0.42, D * 0.85);
    v.addColorStop(0, "rgba(2,8,20,0)"); v.addColorStop(1, "rgba(2,8,20,0.6)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // halo de sódio que segue o ponteiro
    var s = ctx.createRadialGradient(W * mx, H * my, 0, W * mx, H * my, Math.min(W, H) * 0.5);
    s.addColorStop(0, "rgba(255,186,72,0.08)"); s.addColorStop(1, "rgba(255,186,72,0)");
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);

    // a linha do terreno, com a marcação do nível
    var sy = window.scrollY * 0.18, yN = Math.round(H * 0.84) + 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(200,216,240,0.12)";
    ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(0, yN); ctx.lineTo(W, yN); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "500 10px " + fonte; ctx.textBaseline = "bottom"; ctx.fillStyle = "rgba(200,216,240,0.32)";
    ctx.fillText("N.T. ±0,00", W - 160, yN - 6);

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
    if (grao) { ctx.fillStyle = grao; ctx.fillRect(0, 0, W, H); }

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
