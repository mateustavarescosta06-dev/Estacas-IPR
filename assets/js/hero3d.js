/* Capa da home: maquete 3D ao vivo do pátio IPR com o bate-estacas cravando. */
import { createYard } from "./3d/yard.js";

const root = document.querySelector("[data-hero3d]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// sem criar um contexto de teste: abrir um WebGL descartável custa caro e o
// three falha cedo (com a imagem estática no lugar) se o contexto não vier
const webglOk = () => "WebGL2RenderingContext" in window;

function boot() {
  const hero = root.closest(".hero");
  const canvas = root.querySelector("canvas");
  const hud = hero.querySelector("[data-hud]");
  const out = {
    prof: hud.querySelector('[data-h="prof"]'),
    golpes: hud.querySelector('[data-h="golpes"]'),
    nega: hud.querySelector('[data-h="nega"]'),
  };
  const fmt = (n, d) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const small = window.innerWidth < 760;
  let yard;
  try { yard = createYard(canvas, { live: true, shot: "hero", style: "blueprint", quality: small ? 0.4 : 0.6, pixelRatio: Math.min(window.devicePixelRatio, small ? 1.25 : 1.5) }); }
  catch (e) { return; }

  yard.onBlow = (s) => {
    out.prof.textContent = fmt(s.depth, 2) + " m";
    out.golpes.textContent = fmt(s.blows, 0);
    out.nega.textContent = s.nega == null ? "aguardando" : fmt(s.nega, 0) + " mm";
    if (s.manual) { hero.classList.remove("is-hit"); void hero.offsetWidth; hero.classList.add("is-hit"); document.dispatchEvent(new CustomEvent("ipr:golpe")); }
  };

  const fit = () => {
    const r = root.getBoundingClientRect();
    yard.resize(Math.max(1, r.width), Math.max(1, r.height));
  };
  fit();
  new ResizeObserver(fit).observe(root);

  yard.start();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("is-live")));
  hud.hidden = false;

  new IntersectionObserver(([en]) => { en.isIntersecting ? yard.start() : yard.stop(); }).observe(root);
  document.addEventListener("visibilitychange", () => { document.hidden ? yard.stop() : yard.start(); });

  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    yard.pointer((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
  });
  hero.addEventListener("pointerleave", () => yard.pointer(0, 0));
  hud.querySelector("[data-strike]").addEventListener("click", () => yard.strikeNow());
}

// a maquete monta depois do primeiro desenho da página: a imagem estática segura a capa até lá
if (root && !reduce && webglOk()) {
  const later = window.requestIdleCallback || ((f) => setTimeout(f, 200));
  const go = () => later(boot, { timeout: 1500 });
  document.readyState === "complete" ? go() : window.addEventListener("load", go, { once: true });
}
