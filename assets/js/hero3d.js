/* Capa da home: maquete 3D ao vivo do pátio IPR com o bate-estacas cravando. */
import { createYard } from "./3d/yard.js";

const root = document.querySelector("[data-hero3d]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOk() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}

if (root && !reduce && webglOk()) {
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
  const yard = createYard(canvas, { live: true, shot: "hero", quality: small ? 0.4 : 0.6, post: !small, pixelRatio: Math.min(window.devicePixelRatio, small ? 1.25 : 1.25) });

  yard.onBlow = (s) => {
    out.prof.textContent = fmt(s.depth, 2) + " m";
    out.golpes.textContent = fmt(s.blows, 0);
    out.nega.textContent = s.nega == null ? "—" : fmt(s.nega, 0) + " mm";
    if (s.manual) { hero.classList.remove("is-hit"); void hero.offsetWidth; hero.classList.add("is-hit"); }
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
