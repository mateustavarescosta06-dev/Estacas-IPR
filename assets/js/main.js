/* IPR Estacas — interações do site (vanilla JS, sem dependências) */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var fmt = function (n, dec) {
    return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  };
  var ROOT = document.body.getAttribute("data-page") === "index" ? "" : "../";
  var ICON_CHECK = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>';
  var ICON_DL = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v12M6 10l6 6 6-6M4 21h16"/></svg>';
  var ICON_ARROW = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6"/></svg>';

  /* ---------- Básico ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  var toggle = $("[data-nav-toggle]"), nav = $("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      var hdr = toggle.closest("[data-header]");
      if (hdr) nav.style.setProperty("--nav-top", hdr.getBoundingClientRect().bottom + "px");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      nav.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
  }

  /* ---------- Revelação e contadores ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (reduceMotion) { el.textContent = fmt(target); return; }
    var t0 = null, dur = 1600;
    function step(t) {
      if (!t0) t0 = t;
      var k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(target * e));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        $$("[data-count]", en.target).forEach(countUp);
        if (en.target.hasAttribute("data-count")) countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    $$(".reveal, .stats").forEach(function (el) { io.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Desenho de seções (planta técnica) ---------- */
  function hexPoints(cx, cy, R) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i;
      pts.push((cx + R * Math.cos(a)).toFixed(2) + "," + (cy + R * Math.sin(a)).toFixed(2));
    }
    return pts.join(" ");
  }
  function strands(e, cx, cy, s) {
    var R = e.d / 2 * s, out = [], inset = 4 * s;
    if (e.forma === "quadrada") {
      var h = R - inset;
      [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach(function (p) { out.push([cx + p[0] * h, cy + p[1] * h]); });
    } else {
      var r = e.forma === "hexagonal" ? R - inset * 1.25 : R - inset;
      if (e.furo) r = R * 0.78;
      for (var i = 0; i < 6; i++) {
        var a = Math.PI / 3 * i + (e.forma === "circular" ? Math.PI / 6 : 0);
        out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return out;
  }
  function drawSection(e, opts) {
    opts = opts || {};
    var W = 300, H = opts.mini ? 250 : 300, cx = W / 2, cy = opts.mini ? 108 : 136;
    var s = opts.scale || 5.4, R = e.d / 2 * s, cov = 2.5 * s, svg = "";
    svg += '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Seção transversal da estaca ' + e.nome + '">';
    svg += '<line class="axis" x1="' + (cx - R - 22) + '" y1="' + cy + '" x2="' + (cx + R + 22) + '" y2="' + cy + '"/>';
    svg += '<line class="axis" x1="' + cx + '" y1="' + (cy - R - 22) + '" x2="' + cx + '" y2="' + (cy + R + 22) + '"/>';
    if (e.forma === "circular") {
      svg += '<circle class="sec" cx="' + cx + '" cy="' + cy + '" r="' + R + '"/>';
      if (!opts.mini) svg += '<circle class="cover" cx="' + cx + '" cy="' + cy + '" r="' + (R - cov) + '"/>';
    } else if (e.forma === "hexagonal") {
      svg += '<polygon class="sec" points="' + hexPoints(cx, cy, R) + '"/>';
      if (e.furo) svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R * 0.5 + '" fill="var(--ground)" stroke="currentColor" class="dim"/>';
      if (!opts.mini && !e.furo) svg += '<polygon class="cover" points="' + hexPoints(cx, cy, R - cov * 1.15) + '"/>';
    } else {
      svg += '<rect class="sec" x="' + (cx - R) + '" y="' + (cy - R) + '" width="' + 2 * R + '" height="' + 2 * R + '"/>';
      if (!opts.mini) svg += '<rect class="cover" x="' + (cx - R + cov) + '" y="' + (cy - R + cov) + '" width="' + (2 * R - 2 * cov) + '" height="' + (2 * R - 2 * cov) + '"/>';
    }
    strands(e, cx, cy, s).forEach(function (p) {
      if (!opts.mini) svg += '<circle class="strand-ring" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (s * 1.05) + '"/>';
      svg += '<circle class="strand" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + Math.max(2.4, s * 0.55) + '"/>';
    });
    var dy = cy + R + (opts.mini ? 22 : 34);
    svg += '<line class="ext" x1="' + (cx - R) + '" y1="' + (cy + 6) + '" x2="' + (cx - R) + '" y2="' + (dy + 6) + '"/>';
    svg += '<line class="ext" x1="' + (cx + R) + '" y1="' + (cy + 6) + '" x2="' + (cx + R) + '" y2="' + (dy + 6) + '"/>';
    svg += '<line class="dim" x1="' + (cx - R) + '" y1="' + dy + '" x2="' + (cx + R) + '" y2="' + dy + '"/>';
    svg += '<path class="dim" d="M' + (cx - R) + " " + dy + "l7 -3v6zM" + (cx + R) + " " + dy + 'l-7 -3v6z" fill="currentColor"/>';
    var label = e.forma === "quadrada" ? e.d + " × " + e.d + " cm" : "Ø " + e.d + " cm";
    svg += '<text x="' + cx + '" y="' + (dy + 18) + '" text-anchor="middle">' + label + "</text>";
    svg += "</svg>";
    return svg;
  }
  window.IPR_drawSection = drawSection;

  var DATA = window.IPR_ESTACAS || [];
  var byId = {};
  DATA.forEach(function (e) { byId[e.id] = e; });

  $$("[data-shape]").forEach(function (el) {
    var e = byId[el.getAttribute("data-shape")];
    if (e) el.innerHTML = drawSection(e, { mini: true, scale: 5.6 });
  });

  /* ---------- Abas genéricas (processo) ---------- */
  $$("[data-tabs]").forEach(function (root) {
    var tabs = $$('[role="tab"]', root);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (ev) {
        var k = ev.key, n = null;
        if (k === "ArrowDown" || k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowUp" || k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { ev.preventDefault(); select(n, true); }
      });
    });
  });

  /* ---------- A cravação (home): fotos reais por etapa e o registro que acompanha ---------- */
  var drive = $("[data-drive]");
  if (drive) initDrive(drive);

  function initDrive(root) {
    var fotos = $$(".drive__foto", root);
    var steps = $$(".drive__step", root);
    var dots = $$(".drive__dots button", root);
    var track = $(".drive__track", root);
    // perfil de solo típico do registro (simulação): aterro, argila, silte, areia e camada resistente
    var layers = [
      { nome: "Aterro", a: 0, b: 2, pen: 50 },
      { nome: "Argila mole", a: 2, b: 7, pen: 35 },
      { nome: "Silte argiloso", a: 7, b: 12, pen: 18 },
      { nome: "Areia fina compacta", a: 12, b: 17, pen: 8 },
      { nome: "Camada resistente", a: 17, b: 30, pen: 2.5 }
    ];
    var FINAL = 17.6;
    var r = { prof: $('[data-r="prof"]', root), golpes: $('[data-r="golpes"]', root), nega: $('[data-r="nega"]', root), camada: $('[data-r="camada"]', root) };
    var barra = $("[data-r-barra]", root);

    function layerAt(d) { for (var i = layers.length - 1; i >= 0; i--) if (d >= layers[i].a) return i; return 0; }
    function blowsTo(d) {
      var n = 0;
      layers.forEach(function (L) { var top = Math.max(0, L.a), bot = Math.min(d, L.b); if (bot > top) n += (bot - top) * 1000 / L.pen; });
      return n;
    }
    var ease = function (k) { return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
    var current = -1;

    function render(p) {
      var stepIdx = p < .15 ? 0 : p < .5 ? 1 : p < .64 ? 2 : 3;
      var b = stepIdx === 0 ? 0 : stepIdx === 1 ? 9 * ease((p - .15) / .35) : stepIdx === 2 ? 9 : 9 + (FINAL - 9) * ease((p - .64) / .36);
      var li = layerAt(Math.max(0, b - .001));
      r.prof.textContent = fmt(b, 2) + " m";
      r.golpes.textContent = fmt(Math.floor(blowsTo(b)));
      r.nega.textContent = b > 0 ? fmt(layers[li].pen * 10, 0) + " mm" : "aguardando";
      r.camada.textContent = b > 0 ? layers[li].nome : "superfície";
      if (barra) barra.style.setProperty("--d", (b / 20).toFixed(4));
      root.style.setProperty("--k", p.toFixed(4));
      if (stepIdx !== current) {
        current = stepIdx;
        steps.forEach(function (st, i) { st.classList.toggle("is-active", i === stepIdx); });
        dots.forEach(function (d, i) { d.classList.toggle("is-active", i === stepIdx); });
        fotos.forEach(function (f, i) { f.classList.toggle("is-on", i === stepIdx); });
      }
    }

    var ticking = false;
    function update() {
      ticking = false;
      var rect = track.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      render(clamp(-rect.top / (total > 0 ? total : 1), 0, 1));
    }
    if (reduceMotion) {
      render(1);
      steps.forEach(function (st) { st.classList.add("is-active"); st.style.position = "relative"; });
    } else {
      window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      window.addEventListener("resize", update);
      update();
    }
    var marks = [0.05, 0.36, 0.58, 0.96];
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () {
        var rect = track.getBoundingClientRect();
        var total = rect.height - window.innerHeight;
        window.scrollTo({ top: window.scrollY + rect.top + total * marks[i], behavior: reduceMotion ? "auto" : "smooth" });
      });
    });
  }

  /* ---------- Catálogo técnico ---------- */
  var catalog = $("[data-catalog]");
  var selectEstaca = function () {};
  if (catalog) initCatalog(catalog);

  function initCatalog(root) {
    var tabs = $$(".catalog__tabs button", root);
    var list = $(".catalog__items", root);
    var drawing = $("[data-drawing]", root);
    var data = $("[data-specs]", root);
    var maxNbr = Math.max.apply(null, DATA.filter(function (e) { return !e.consulta; }).map(function (e) { return e.compMax; }));
    var forma = "circular", sel = null;

    function renderList() {
      list.innerHTML = DATA.filter(function (e) { return e.forma === forma; }).map(function (e) {
        return '<li><button type="button" data-id="' + e.id + '" aria-pressed="' + (sel && sel.id === e.id) + '"' + (e.consulta ? ' class="is-consult"' : "") + ">" +
          "<b>" + e.nome.replace(/^(Circular|Hexagonal|Quadrada) /, "") + "</b><span>" + (e.consulta ? "sob consulta" : fmt(e.compNbr) + " kN") + "</span></button></li>";
      }).join("");
    }
    function kv(label, value) { return "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>"; }
    function renderSpecs(e) {
      drawing.innerHTML = '<div class="drawing__title"><span>Seção transversal</span><span>Escala comum ao catálogo</span></div>' +
        drawSection(e) +
        '<div class="drawing__stamp"><div>Ref.<b>' + e.id + "</b></div><div>Concreto<b>C40</b></div><div>Protensão<b>CP-175</b></div></div>";
      if (e.consulta) {
        data.innerHTML = '<p class="eyebrow">Linha vazada</p><h3>' + e.nome + "</h3>" +
          '<p class="sub">Seção hexagonal com furo central · alta capacidade com menor peso próprio</p>' +
          '<p class="muted">As características desta seção são dimensionadas sob demanda. Fale com a engenharia IPR para receber o ábaco de interação e as cargas admissíveis para o seu projeto.</p>' +
          '<div class="catalog__actions"><a class="btn btn--primary" href="' + ROOT + 'contato/?estaca=' + encodeURIComponent(e.nome) + '">Solicitar ficha técnica ' + ICON_ARROW + "</a></div>";
        return;
      }
      data.innerHTML = '<p class="eyebrow">Estaca protendida maciça</p><h3>' + e.nome + "</h3>" +
        '<p class="sub">' + e.aco + " · Comprimentos 6, 8 e 10 m</p>" +
        '<dl class="kv">' +
        kv("Área de concreto", fmt(e.area) + " cm²") + kv("Perímetro", fmt(e.perimetro) + " cm") +
        kv("Massa linear", fmt(e.massa) + " kg/m") + kv("Momento de inércia", fmt(e.inercia) + " cm⁴") +
        kv("Tração máxima", fmt(e.tracaoMax, 1) + " kN") + kv("Classe do concreto", "C40 · fck ≥ 40 MPa") +
        "</dl>" +
        '<div class="capacity" role="group" aria-label="Capacidade de compressão">' +
        '<div class="capacity__row"><span>Compressão máxima</span><span class="capacity__bar"><i data-w="' + (e.compMax / maxNbr * 100) + '"></i></span><b>' + fmt(e.compMax, 1) + " kN</b></div>" +
        '<div class="capacity__row"><span>Compressão NBR 6118</span><span class="capacity__bar capacity__bar--y"><i data-w="' + (e.compNbr / maxNbr * 100) + '"></i></span><b>' + fmt(e.compNbr, 1) + " kN</b></div>" +
        "</div>" +
        '<div class="catalog__actions"><a class="btn btn--line" href="' + ROOT + "assets/docs/" + e.pdf + '" target="_blank" rel="noopener">' + ICON_DL + " Ábaco em PDF</a>" +
        '<a class="btn btn--primary" href="' + ROOT + "contato/?estaca=" + encodeURIComponent(e.nome) + '">Orçar esta estaca ' + ICON_ARROW + "</a></div>";
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        $$(".capacity__bar i", data).forEach(function (i) { i.style.width = i.getAttribute("data-w") + "%"; });
      }); });
    }
    function setForma(f) {
      forma = f;
      tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-forma") === f)); });
    }
    selectEstaca = function (id, scroll) {
      var e = byId[id];
      if (!e) return;
      sel = e;
      setForma(e.forma);
      renderList();
      renderSpecs(e);
      if (history.replaceState) history.replaceState(null, "", "#" + e.id);
      if (scroll) root.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    };
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        var first = DATA.filter(function (e) { return e.forma === t.getAttribute("data-forma"); })[0];
        selectEstaca(first.id);
      });
    });
    list.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-id]");
      if (b) selectEstaca(b.getAttribute("data-id"));
    });
    var initial = (location.hash || "").slice(1);
    var fromShape = { circular: "C20", hexagonal: "H17", quadrada: "Q30" }[initial];
    selectEstaca(byId[initial] ? initial : fromShape || "C26");
    if (byId[initial] || fromShape) setTimeout(function () { root.scrollIntoView({ block: "start" }); }, 60);
  }

  /* ---------- Seletor por carga ---------- */
  var selector = $("[data-selector]");
  if (selector) initSelector(selector);

  function initSelector(root) {
    var range = $("input[type=range]", root), num = $("input[type=number]", root);
    var bars = $(".bars", root), reco = $(".reco", root), chips = $$(".chips button", root);
    var tip = document.createElement("div");
    tip.className = "tooltip"; tip.setAttribute("role", "status");
    document.body.appendChild(tip);
    var items = DATA.filter(function (e) { return !e.consulta; }).sort(function (a, b) { return a.compNbr - b.compNbr; });
    var SCALE = 1400, filtro = "todas";

    bars.innerHTML = '<div class="bars__line"><span></span></div>' + items.map(function (e) {
      return '<div class="bars__row" data-id="' + e.id + '" tabindex="0" role="button" aria-label="' + e.nome + ", " + fmt(e.compNbr, 1) + ' kN pela NBR 6118"><span>' + e.nome.replace("Hexagonal", "Hex.").replace("Circular", "Circ.").replace("Quadrada", "Quad.") + '</span><span class="bars__track"><span class="bars__fill" style="width:' + (e.compNbr / SCALE * 100) + '%"></span></span><b>' + fmt(e.compNbr) + "</b></div>";
    }).join("");
    var line = $(".bars__line", bars), lineLabel = $("span", line);

    function update(v) {
      v = clamp(Math.round(v) || 0, 100, 1300);
      range.value = v; num.value = v;
      range.style.setProperty("--p", ((v - 100) / 1200 * 100) + "%");
      var firstTrack = $(".bars__track", bars);
      var off = firstTrack.offsetLeft, w = firstTrack.offsetWidth;
      line.style.left = (off + w * v / SCALE) + "px";
      lineLabel.textContent = fmt(v) + " kN";
      var ok = items.filter(function (e) { return e.compNbr >= v && (filtro === "todas" || e.forma === filtro); });
      var best = ok.slice().sort(function (a, b) { return a.massa - b.massa || a.compNbr - b.compNbr; })[0];
      $$(".bars__row", bars).forEach(function (row) {
        var e = byId[row.getAttribute("data-id")];
        var visible = filtro === "todas" || e.forma === filtro;
        row.style.display = visible ? "" : "none";
        row.classList.toggle("is-ok", e.compNbr >= v);
        row.classList.toggle("is-best", !!best && e.id === best.id);
      });
      if (best) {
        reco.innerHTML = '<span class="reco__k">Seção mais leve que atende</span><div class="reco__name">' + best.nome + "</div>" +
          "<p>" + fmt(best.compNbr, 1) + " kN (NBR 6118) · " + fmt(best.massa) + " kg/m · " + ok.length + " opç" + (ok.length > 1 ? "ões" : "ão") + " atendem</p>";
      } else {
        reco.innerHTML = '<span class="reco__k">Acima do catálogo padrão</span><div class="reco__name">Consulte a engenharia</div><p>Para esta carga avaliamos grupos de estacas ou as seções hexagonais vazadas 40 e 45.</p>';
      }
    }
    range.addEventListener("input", function () { update(range.value); });
    num.addEventListener("change", function () { update(num.value); });
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        filtro = c.getAttribute("data-f");
        chips.forEach(function (o) { o.setAttribute("aria-pressed", String(o === c)); });
        update(range.value);
      });
    });
    function showTip(row, x, y) {
      var e = byId[row.getAttribute("data-id")];
      tip.innerHTML = "<b>" + e.nome + "</b>NBR 6118: " + fmt(e.compNbr, 1) + " kN<br>Máxima: " + fmt(e.compMax, 1) + " kN<br>Massa: " + fmt(e.massa) + " kg/m<br><span>Clique para ver a ficha</span>";
      tip.style.left = Math.min(x + 16, window.innerWidth - 250) + "px";
      tip.style.top = (y + 16) + "px";
      tip.classList.add("is-on");
    }
    bars.addEventListener("mousemove", function (ev) {
      var row = ev.target.closest(".bars__row");
      if (row) showTip(row, ev.clientX, ev.clientY); else tip.classList.remove("is-on");
    });
    bars.addEventListener("mouseleave", function () { tip.classList.remove("is-on"); });
    function pick(ev) {
      var row = ev.target.closest(".bars__row");
      if (!row) return;
      if (ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
      ev.preventDefault();
      tip.classList.remove("is-on");
      selectEstaca(row.getAttribute("data-id"), true);
    }
    bars.addEventListener("click", pick);
    bars.addEventListener("keydown", pick);
    window.addEventListener("resize", function () { update(range.value); });
    update(range.value);
  }

  /* ---------- Cronograma de rompimento ---------- */
  $$("[data-curing]").forEach(function (root) {
    var btns = $$(".curing__track button", root), fill = $(".curing__fill", root), panels = $$(".curing__panel", root);
    function sel(i) {
      btns.forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); b.classList.toggle("is-past", j < i); });
      panels.forEach(function (p, j) { p.hidden = i !== j; });
      fill.style.width = (i / (btns.length - 1) * (100 - 100 / btns.length)) + "%";
    }
    btns.forEach(function (b, i) { b.addEventListener("click", function () { sel(i); }); });
    sel(0);
  });

  /* ---------- Checklist de inspeção ---------- */
  $$("[data-checklist] li").forEach(function (li) {
    li.setAttribute("role", "checkbox");
    li.setAttribute("aria-checked", "false");
    li.tabIndex = 0;
    li.insertAdjacentHTML("afterbegin", '<span class="box">' + ICON_CHECK + "</span>");
    function t() { var on = !li.classList.contains("is-checked"); li.classList.toggle("is-checked", on); li.setAttribute("aria-checked", String(on)); }
    li.addEventListener("click", t);
    li.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); t(); } });
  });
  var autoCheck = $("[data-checklist]");
  if (autoCheck && "IntersectionObserver" in window) {
    var ioc = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      $$("li", autoCheck).forEach(function (li, i) { setTimeout(function () { li.classList.add("is-checked"); li.setAttribute("aria-checked", "true"); }, 350 + i * 380); });
      ioc.disconnect();
    }, { threshold: .6 });
    ioc.observe(autoCheck);
  }

  /* ---------- FAQ com busca ---------- */
  var faq = $("[data-faq]");
  if (faq) {
    var input = $("[data-faq-search]"), count = $("[data-faq-count]"), empty = $(".faq-empty");
    var items = $$("details", faq);
    items.forEach(function (d) {
      $$("h3, .faq__a p", d).forEach(function (el) { el.setAttribute("data-raw", el.textContent); });
    });
    var norm = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
    var esc = function (s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); };
    function highlight(text, q) {
      if (!q) return esc(text);
      var n = norm(text), out = "", i = 0, idx;
      while ((idx = n.indexOf(q, i)) !== -1) { out += esc(text.slice(i, idx)) + "<mark>" + esc(text.slice(idx, idx + q.length)) + "</mark>"; i = idx + q.length; }
      return out + esc(text.slice(i));
    }
    function run() {
      var q = norm(input.value.trim()), shown = 0;
      items.forEach(function (d) {
        var hay = norm(d.textContent);
        var hit = !q || hay.indexOf(q) !== -1;
        d.hidden = !hit;
        if (hit) shown++;
        $$("[data-raw]", d).forEach(function (el) { el.innerHTML = highlight(el.getAttribute("data-raw"), q); });
        if (q && hit) d.open = true;
      });
      count.textContent = shown + (shown === 1 ? " pergunta" : " perguntas");
      empty.style.display = shown ? "none" : "block";
    }
    input.addEventListener("input", run);
    run();
  }

  /* ---------- Formulário de orçamento ---------- */
  var form = $("[data-quote]");
  if (form) initForm(form);

  function initForm(f) {
    var params = new URLSearchParams(location.search);
    var msg = f.elements.mensagem;
    if (params.get("estaca") && !msg.value) {
      msg.value = "Gostaria de um orçamento para a estaca " + params.get("estaca") + ".\nQuantidade estimada: \nComprimento/profundidade: ";
    }
    var required = ["nome", "telefone", "mensagem"];
    var bar = $$(".form__steps span", f);
    function progressUpdate() {
      var fields = ["nome", "telefone", "email", "cidade", "mensagem"];
      var filled = fields.filter(function (n) { return f.elements[n].value.trim(); }).length;
      bar.forEach(function (s, i) { s.classList.toggle("is-on", i < filled); });
    }
    f.addEventListener("input", function (ev) {
      progressUpdate();
      var field = ev.target.closest(".field");
      if (field) field.classList.remove("is-invalid");
    });
    progressUpdate();
    function validate() {
      var ok = true;
      required.forEach(function (n) {
        var el = f.elements[n], bad = !el.value.trim();
        if (n === "telefone" && el.value.replace(/\D/g, "").length < 10) bad = true;
        el.closest(".field").classList.toggle("is-invalid", bad);
        if (bad && ok) { el.focus(); ok = false; }
      });
      var em = f.elements.email;
      if (em.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value)) { em.closest(".field").classList.add("is-invalid"); if (ok) em.focus(); ok = false; }
      return ok;
    }
    function compose() {
      var tipo = (f.querySelector("input[name=tipo]:checked") || {}).value || "Não informado";
      return [
        "*Solicitação de orçamento, site IPR*",
        "Nome: " + f.elements.nome.value.trim(),
        f.elements.empresa.value.trim() ? "Empresa: " + f.elements.empresa.value.trim() : "",
        "Telefone: " + f.elements.telefone.value.trim(),
        f.elements.email.value.trim() ? "E-mail: " + f.elements.email.value.trim() : "",
        "Tipo de obra: " + tipo,
        f.elements.cidade.value.trim() ? "Local da obra: " + f.elements.cidade.value.trim() : "",
        "",
        f.elements.mensagem.value.trim()
      ].filter(function (l, i, a) { return l !== "" || (i > 0 && a[i - 1] !== ""); }).join("\n");
    }
    var phone = f.elements.telefone;
    phone.addEventListener("input", function () {
      var d = phone.value.replace(/\D/g, "").slice(0, 11), o = d;
      if (d.length > 2) o = "(" + d.slice(0, 2) + ") " + d.slice(2);
      if (d.length > 6) o = "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(d.length - 4);
      phone.value = o;
    });
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!validate()) return;
      var via = ev.submitter && ev.submitter.value === "email" ? "email" : "whatsapp";
      var text = compose();
      if (via === "email") {
        location.href = "mailto:comercial@estacasipr.com.br?subject=" + encodeURIComponent("Orçamento de estacas, " + f.elements.nome.value.trim()) + "&body=" + encodeURIComponent(text.replace(/\*/g, ""));
      } else {
        window.open("https://wa.me/5511984472267?text=" + encodeURIComponent(text), "_blank", "noopener");
      }
      $(".form__ok", f).classList.add("is-on");
    });
  }
})();
