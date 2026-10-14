/* Grade técnica interativa: linhas da prancha que se curvam como lente perto do cursor,
   mira com cotas em milímetros encaixada na grade e onda de "golpe" no clique.
   Uso: <div data-grid></div> dentro de uma seção escura (a seção recebe o ponteiro). */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;

  function GridField(host) {
    var area = host.closest("[data-grid-area]") || host.parentElement;
    var cv = document.createElement("canvas");
    cv.className = "grid-canvas"; cv.setAttribute("aria-hidden", "true");
    host.appendChild(cv);
    var ctx = cv.getContext("2d");
    var step = +(host.getAttribute("data-grid") || 48);
    var W = 0, H = 0, dpr = 1;
    var m = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };
    var waves = [], raf = 0, visible = true;
    var label = host.getAttribute("data-grid-label") || "";
    var light = host.getAttribute("data-grid-tone") === "light";
    var C = light
      ? { minor: "rgba(0,36,74,.055)", major: "rgba(0,36,74,.11)", glow: "214,150,0", cross: "rgba(0,36,74,.5)", mark: "#0c3360", box: "rgba(255,255,255,.92)", boxLine: "rgba(0,36,74,.35)", text: "#0c3360" }
      : { minor: "rgba(214,228,245,.06)", major: "rgba(214,228,245,.13)", glow: "255,204,0", cross: "rgba(255,204,0,.55)", mark: "#ffcc00", box: "rgba(8,23,42,.86)", boxLine: "rgba(255,204,0,.5)", text: "#ffcc00" };

    function size() {
      var r = host.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + "px"; cv.style.height = H + "px";
      kick();
    }
    // deslocamento de um ponto da grade: lente (afasta do cursor) + ondas de golpe
    function warp(x, y, out) {
      var dx = x - m.x, dy = y - m.y, d2 = dx * dx + dy * dy, R = 150;
      var k = m.on * 26 * Math.exp(-d2 / (R * R));
      var d = Math.sqrt(d2) || 1;
      var ox = dx / d * k, oy = dy / d * k;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i], wx = x - w.x, wy = y - w.y, wd = Math.sqrt(wx * wx + wy * wy) || 1;
        var band = Math.exp(-Math.pow((wd - w.r) / 28, 2)) * w.a * 14;
        ox += wx / wd * band; oy += wy / wd * band;
      }
      out[0] = x + ox; out[1] = y + oy;
      return k / 26;
    }
    var P = [0, 0];
    function line(x0, y0, x1, y1, vertical) {
      var n = Math.ceil((vertical ? H : W) / 10) + 1;
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        warp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, P);
        i ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]);
      }
      ctx.stroke();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var x, y, major;
      for (x = 0; x <= W + step; x += step) {
        major = Math.round(x / step) % 4 === 0;
        ctx.strokeStyle = major ? C.major : C.minor;
        ctx.lineWidth = major ? 1 : 0.8;
        line(x, 0, x, H, true);
      }
      for (y = 0; y <= H + step; y += step) {
        major = Math.round(y / step) % 4 === 0;
        ctx.strokeStyle = major ? C.major : C.minor;
        ctx.lineWidth = major ? 1 : 0.8;
        line(0, y, W, y, false);
      }
      if (m.on < 0.02) return;
      // brilho amarelo nas linhas próximas ao cursor
      ctx.save();
      var g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 170);
      g.addColorStop(0, "rgba(" + C.glow + "," + (0.55 * m.on) + ")"); g.addColorStop(1, "rgba(" + C.glow + ",0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.2;
      for (x = Math.floor((m.x - 200) / step) * step; x < m.x + 200; x += step) line(x, Math.max(0, m.y - 220), x, Math.min(H, m.y + 220), true);
      for (y = Math.floor((m.y - 200) / step) * step; y < m.y + 200; y += step) line(Math.max(0, m.x - 220), y, Math.min(W, m.x + 220), y, false);
      ctx.restore();
      // mira encaixada no nó mais próximo + cotas
      var sx = Math.round(m.x / step) * step, sy = Math.round(m.y / step) * step;
      ctx.save();
      ctx.globalAlpha = m.on;
      ctx.strokeStyle = C.cross; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.mark; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx - 14, sy); ctx.lineTo(sx - 9, sy); ctx.moveTo(sx + 9, sy); ctx.lineTo(sx + 14, sy);
      ctx.moveTo(sx, sy - 14); ctx.lineTo(sx, sy - 9); ctx.moveTo(sx, sy + 9); ctx.lineTo(sx, sy + 14); ctx.stroke();
      // cota em mm (1 módulo da grade = 500 mm, escala de prancha)
      var mmX = Math.round(sx / step * 500), mmY = Math.round((H - sy) / step * 500);
      var txt = "X " + String(mmX).padStart(5, "0") + "  Y " + String(mmY).padStart(5, "0") + " mm" + (label ? "  ·  " + label : "");
      ctx.font = "500 11px Geist, system-ui, sans-serif";
      var tw = ctx.measureText(txt).width, bx = Math.min(sx + 14, W - tw - 22), by = sy - 30 < 8 ? sy + 18 : sy - 30;
      ctx.fillStyle = C.box; ctx.fillRect(bx, by, tw + 16, 20);
      ctx.strokeStyle = C.boxLine; ctx.strokeRect(bx + 0.5, by + 0.5, tw + 15, 19);
      ctx.fillStyle = C.text; ctx.fillText(txt, bx + 8, by + 14);
      ctx.restore();
    }
    function tick() {
      raf = 0;
      m.x += (m.tx - m.x) * 0.18; m.y += (m.ty - m.y) * 0.18; m.on += (m.ton - m.on) * 0.12;
      for (var i = waves.length - 1; i >= 0; i--) { waves[i].r += 9; waves[i].a *= 0.965; if (waves[i].a < 0.02) waves.splice(i, 1); }
      draw();
      var moving = Math.abs(m.tx - m.x) > 0.3 || Math.abs(m.ty - m.y) > 0.3 || Math.abs(m.ton - m.on) > 0.01 || waves.length;
      if (moving && visible) kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function local(e) { var r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    if (!reduce && !coarse) {
      area.addEventListener("pointermove", function (e) {
        var p = local(e);
        if (m.ton === 0) { m.x = p[0]; m.y = p[1]; }
        m.tx = p[0]; m.ty = p[1]; m.ton = 1; kick();
      }, { passive: true });
      area.addEventListener("pointerleave", function () { m.ton = 0; kick(); });
    }
    if (!reduce) {
      area.addEventListener("pointerdown", function (e) {
        if (e.target.closest("a,button,input,textarea,select,label")) return;
        var p = local(e);
        waves.push({ x: p[0], y: p[1], r: 0, a: 1 }); kick();
      });
    }
    if ("ResizeObserver" in window) new ResizeObserver(size).observe(host); else window.addEventListener("resize", size);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }).observe(host);
    // grade também reage ao golpe da maquete ao vivo
    document.addEventListener("ipr:golpe", function () { waves.push({ x: W * 0.68, y: H * 0.86, r: 0, a: 0.8 }); kick(); });
    size();
  }

  /* toda seção sem grade própria ganha uma; o tom segue o fundo da seção */
  function tone(el) {
    var c = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
    if (!c || (c.length > 3 && +c[3] === 0)) return "light";
    var lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
    return lum > 0.5 ? "light" : "dark";
  }
  document.querySelectorAll("main section, .cta").forEach(function (sec) {
    if (sec.querySelector("[data-grid]") || sec.classList.contains("drive") || sec.offsetHeight > window.innerHeight * 3) return;
    var layer = document.createElement("div");
    layer.className = "grid-layer"; layer.setAttribute("data-grid", "48");
    if (tone(sec) === "light") layer.setAttribute("data-grid-tone", "light");
    sec.setAttribute("data-grid-area", "");
    sec.insertBefore(layer, sec.firstChild);
  });
  document.querySelectorAll("[data-grid]").forEach(function (el) { GridField(el); });
})();
