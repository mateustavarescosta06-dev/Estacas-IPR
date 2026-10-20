/* O fundo do site: papel branco levemente quente, com uma textura finíssima (no CSS) e uma régua
   lateral discreta com marcas de metro que acompanha a rolagem: a página é medida como uma estaca.
   Quando a rolagem chega a uma parte interativa ([data-azul]: a estaca que se monta, o corte, a
   cravação, o catálogo), a página vai ficando azul de forma contínua e volta ao papel depois. */
(function () {
  "use strict";
  var c = document.createElement("canvas");
  c.className = "medida"; c.setAttribute("aria-hidden", "true");
  document.body.insertBefore(c, document.body.firstChild);
  var ctx = c.getContext("2d"), root = document.documentElement;
  var PX_M = 120;                       // 1 m da régua = 120 px de rolagem
  var LARG = 46;                        // largura da faixa da régua, na borda direita
  var azuis = Array.prototype.slice.call(document.querySelectorAll("[data-azul]"));
  var W = 0, H = 0, dpr = 1, raf = 0, bAtual = -1;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var fonte = getComputedStyle(root).getPropertyValue("--f-mono").trim() || "monospace";
  // páginas internas: chão e faixa da própria página (definidos no body); a home usa papel e azul
  var bs = getComputedStyle(document.body);
  var CHAO = bs.getPropertyValue("--chao").trim() || "#fbfaf7", FAIXA = bs.getPropertyValue("--faixa").trim() || "#06132a";
  var faixas = Array.prototype.slice.call(document.querySelectorAll("[data-faixa]")).map(function (sec) {
    return { sec: sec, el: sec.querySelector(".capa__faixa"), cor: getComputedStyle(sec).getPropertyValue("--faixa").trim() || FAIXA };
  });
  var hd = document.querySelector(".hd"), hdCor = "";
  var ponta = document.querySelector("[data-hd-ponta]"), leitura = document.querySelector("[data-hd-leitura]");

  function medir() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = LARG; H = window.innerHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    c.style.width = W + "px"; c.style.height = H + "px";
    bAtual = -1; pedir();
  }
  // quanto de azul: entra enquanto o topo da parte interativa sobe de 45% a 15% da tela, sai no espelho
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
      root.style.backgroundColor = "color-mix(in oklch, " + FAIXA + " " + (b * 100).toFixed(1) + "%, " + CHAO + ")";
      root.style.setProperty("--azul", b.toFixed(3));
    }
    // a régua do cabeçalho: a ponta amarela marca quanto da página já foi percorrido, em metros
    if (ponta) {
      var tot = Math.max(1, document.documentElement.scrollHeight - H), k = Math.min(1, window.scrollY / tot);
      ponta.style.transform = "translateX(" + (k * 100).toFixed(2) + "vw)";
      leitura.textContent = (window.scrollY / PX_M).toFixed(2).replace(".", ",") + " m";
    }
    // o cabeçalho toma a cor da faixa que estiver embaixo dele
    if (hd) {
      var linha = hd.offsetHeight * 0.5, sob = "";
      for (var f = 0; f < faixas.length; f++) {
        var fr = faixas[f].el && faixas[f].el.getBoundingClientRect();
        if (fr && fr.top <= linha && fr.bottom >= linha) sob = faixas[f].cor;
      }
      if (sob !== hdCor) { hdCor = sob; hd.style.setProperty("--hd-faixa", sob || "transparent"); hd.classList.toggle("na-faixa", !!sob); }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var tinta = b > 0.5 ? "255,255,255" : "10,31,61";
    var sy = window.scrollY, x1 = W - 1;
    // linha-mestra
    ctx.fillStyle = "rgba(" + tinta + ",0.16)";
    ctx.fillRect(x1, 0, 1, H);
    // marcas: a cada 10 cm uma curta, a cada 50 cm uma média, a cada metro uma longa com o número
    var passo = PX_M / 10, k0 = Math.floor(sy / passo), k1 = Math.ceil((sy + H) / passo);
    ctx.font = "500 9px " + fonte;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (var k = k0; k <= k1; k++) {
      var y = Math.round(k * passo - sy) + 0.5, m = k % 10 === 0, meio = k % 5 === 0;
      var len = m ? 14 : meio ? 9 : 4;
      ctx.fillStyle = "rgba(" + tinta + "," + (m ? 0.42 : meio ? 0.26 : 0.16) + ")";
      ctx.fillRect(x1 - len, y, len, 1);
      if (m) {
        ctx.fillStyle = "rgba(" + tinta + ",0.4)";
        ctx.fillText((k / 10).toFixed(0), x1 - 18, y);
      }
    }
    // o ponto de leitura: onde a tela está agora, em metros
    var yl = Math.round(H * 0.5) + 0.5;
    ctx.fillStyle = "#ffcd00";
    ctx.fillRect(x1 - 22, yl, 22, 2);
    ctx.font = "500 10px " + fonte;
    ctx.fillStyle = "rgba(" + tinta + ",0.85)";
    ctx.fillText(((sy + H * 0.5) / PX_M).toFixed(2).replace(".", ","), x1 - 26, yl - 9);
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(desenhar); }
  window.addEventListener("resize", medir);
  window.addEventListener("scroll", pedir, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pedir);
  medir();
})();
