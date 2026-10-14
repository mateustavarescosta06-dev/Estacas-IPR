/* A rota de cravação: a navegação do site é a descida de uma estaca pelas camadas do solo.
   A rolagem de cada página leva a estaca da profundidade desta estação até a da próxima.
   A profundidade atingida é guardada na sessão, então trocar de página continua a mesma cravação. */
(function () {
  "use strict";
  var rail = document.querySelector("[data-route]");
  if (!rail) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var from = +rail.getAttribute("data-from"), to = +rail.getAttribute("data-to"), max = +rail.getAttribute("data-max");
  var step = +rail.getAttribute("data-step");
  var pile = rail.querySelector("[data-route-pile]"), read = rail.querySelector("[data-route-read]");
  var items = Array.prototype.slice.call(rail.querySelectorAll("li"));
  var bar = document.querySelector("[data-progress]");
  var KEY = "ipr-rota";
  var fmt = function (d) { return d.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " m"; };

  function load() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sem armazenamento: a rota recomeça na página */ } }

  var mem = load();
  var depth = from, shown = typeof mem.depth === "number" ? mem.depth : from, entering = !reduce && Math.abs(shown - from) > 0.05;
  if (!entering) shown = from;

  function pageProgress() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 1;
  }
  function paint(d) {
    var k = d / max;
    pile.style.transform = "scaleY(" + k.toFixed(4) + ")";
    read.style.top = (k * 100).toFixed(2) + "%";
    read.textContent = fmt(d);
    if (bar) bar.style.transform = "scaleX(" + k.toFixed(4) + ")";
    for (var i = 0; i < items.length; i++) {
      var at = parseFloat(items[i].style.getPropertyValue("--at")) / 100 * max;
      items[i].classList.toggle("is-reached", d + 0.01 >= at);
    }
  }
  function target() { return from + (to - from) * pageProgress(); }

  // entrada: a estaca desce do ponto em que estava até esta camada, e dá o golpe
  var t0 = 0, startD = shown;
  function enter(t) {
    if (!t0) t0 = t;
    var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
    shown = startD + (target() - startD) * e;
    paint(shown);
    if (k < 1) requestAnimationFrame(enter);
    else { entering = false; mem.depth = shown; save(mem); rail.classList.add("is-hit"); setTimeout(function () { rail.classList.remove("is-hit"); }, 420); document.dispatchEvent(new CustomEvent("ipr:golpe")); }
  }

  var ticking = false;
  function onScroll() {
    if (entering || ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      depth = target();
      shown += (depth - shown) * (reduce ? 1 : 0.35);
      if (Math.abs(depth - shown) > 0.005) onScroll();
      paint(shown);
      mem.depth = shown; save(mem);
    });
  }

  mem.visited = mem.visited || [];
  if (mem.visited.indexOf(step) < 0) mem.visited.push(step);
  items.forEach(function (li, i) { if (mem.visited.indexOf(i) >= 0) li.classList.add("is-visited"); });
  save(mem);

  // seguir para a próxima camada leva junto a profundidade atual
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.origin !== location.origin) return;
    mem.depth = shown; save(mem);
  });

  paint(shown);
  if (entering) requestAnimationFrame(enter); else { mem.depth = shown; save(mem); }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
