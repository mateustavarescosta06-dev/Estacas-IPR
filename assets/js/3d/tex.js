/* Texturas procedurais (cor, rugosidade e relevo) geradas em canvas.
   Nada é baixado: cada superfície da maquete nasce de ruído e regras simples. */
import * as THREE from "three";
import { SimplexNoise } from "three/addons/math/SimplexNoise.js";

export function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const simplex = new SimplexNoise({ random: rng(1234) });

/* ruído fractal periódico (tileável) amostrado num toro 4D */
function fbm(u, v, oct, freq) {
  let a = 0.5, f = freq, s = 0, n = 0;
  for (let o = 0; o < oct; o++) {
    const ang1 = u * Math.PI * 2, ang2 = v * Math.PI * 2, r = f / (Math.PI * 2);
    s += a * simplex.noise4d(Math.cos(ang1) * r, Math.sin(ang1) * r, Math.cos(ang2) * r, Math.sin(ang2) * r);
    n += a; a *= 0.5; f *= 2;
  }
  return s / n; // -1..1
}

function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

function toTex(canvas, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* Gera {map, roughnessMap, normalMap} a partir de funções por pixel. */
function surface(size, fn, { strength = 2, repeat = [1, 1] } = {}) {
  const N = size, H = new Float32Array(N * N);
  const col = mkCanvas(N, N), rough = mkCanvas(N, N), nrm = mkCanvas(N, N);
  const cImg = col.getContext("2d").createImageData(N, N);
  const rImg = rough.getContext("2d").createImageData(N, N);
  const nImg = nrm.getContext("2d").createImageData(N, N);
  const out = { r: 0, g: 0, b: 0, h: 0, rough: 0.8 };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    fn(x / N, y / N, out, x, y);
    const i = (y * N + x) * 4;
    cImg.data[i] = out.r; cImg.data[i + 1] = out.g; cImg.data[i + 2] = out.b; cImg.data[i + 3] = 255;
    const rv = Math.max(0, Math.min(255, out.rough * 255));
    rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = rv; rImg.data[i + 3] = 255;
    H[y * N + x] = out.h;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const xl = H[y * N + ((x - 1 + N) % N)], xr = H[y * N + ((x + 1) % N)];
    const yu = H[((y - 1 + N) % N) * N + x], yd = H[((y + 1) % N) * N + x];
    let nx = (xl - xr) * strength, ny = (yu - yd) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * N + x) * 4;
    nImg.data[i] = (nx * 0.5 + 0.5) * 255; nImg.data[i + 1] = (ny * 0.5 + 0.5) * 255; nImg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nImg.data[i + 3] = 255;
  }
  col.getContext("2d").putImageData(cImg, 0, 0);
  rough.getContext("2d").putImageData(rImg, 0, 0);
  nrm.getContext("2d").putImageData(nImg, 0, 0);
  return { map: toTex(col, { repeat }), roughnessMap: toTex(rough, { srgb: false, repeat }), normalMap: toTex(nrm, { srgb: false, repeat }), canvas: col };
}

/* poros ("bugholes") típicos de concreto pré-moldado: lista de crateras */
function craters(n, seed, rMin, rMax) {
  const r = rng(seed), list = [];
  for (let i = 0; i < n; i++) list.push([r(), r(), rMin + r() * (rMax - rMin)]);
  return list;
}
function craterAt(list, u, v) {
  let d = 0;
  for (const [cx, cy, rr] of list) {
    let dx = Math.abs(u - cx), dy = Math.abs(v - cy);
    dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy);
    if (dx > rr || dy > rr) continue;
    const q = 1 - Math.hypot(dx, dy) / rr;
    if (q > 0) d = Math.max(d, q);
  }
  return d;
}

export function makeTextures(quality = 1) {
  const S = quality >= 1 ? 1024 : 512, s = quality >= 1 ? 512 : 256;
  const T = {};

  // Concreto C40: cinza quente, poros, manchas de cura e eflorescência
  const holes = craters(quality >= 1 ? 420 : 200, 7, 0.0025, 0.007);
  T.concrete = surface(S, (u, v, o) => {
    const big = fbm(u, v, 3, 3), mid = fbm(u + .3, v + .7, 4, 14), fine = fbm(u + .9, v + .1, 2, 90);
    const pit = craterAt(holes, u, v);
    const stain = Math.max(0, fbm(u + 4, v + 2, 3, 2) - 0.15);
    let g = 168 + big * 14 + mid * 9 + fine * 7 - stain * 40 - pit * 70;
    const eff = Math.max(0, fbm(u + 9, v + 5, 3, 5) - 0.42) * 120; // eflorescência clara
    g += eff;
    o.r = g + 4; o.g = g; o.b = g - 7;
    o.h = mid * 0.25 + fine * 0.35 - pit * 1.8;
    o.rough = 0.82 + fine * 0.08 - stain * 0.1;
  }, { strength: 3.2 });

  // Laje/pista de concreto mais lisa, com manchas de óleo desmoldante
  T.slab = surface(s, (u, v, o) => {
    const a = fbm(u, v, 4, 6), f = fbm(u + 3, v, 2, 60), oil = Math.max(0, fbm(u + 7, v + 1, 3, 3) - 0.1);
    const g = 150 + a * 12 + f * 6 - oil * 70;
    o.r = g; o.g = g - 2; o.b = g - 6; o.h = f * 0.3; o.rough = 0.7 - oil * 0.35 + f * 0.05;
  }, { strength: 1.5 });

  // Cascalho do pátio: seixos arredondados sobre terra
  const pebR = rng(31), pebbles = [];
  for (let i = 0; i < (quality >= 1 ? 2600 : 1100); i++) pebbles.push([pebR(), pebR(), 0.004 + pebR() * 0.01, pebR()]);
  const grid = new Map(); const G = 40;
  for (const p of pebbles) { const k = ((p[0] * G) | 0) + "," + ((p[1] * G) | 0); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  T.gravel = surface(S, (u, v, o) => {
    const dirt = fbm(u, v, 4, 8), fine = fbm(u + 5, v + 5, 2, 120);
    let r = 138 + dirt * 18, g = 118 + dirt * 15, b = 92 + dirt * 12, h = fine * 0.15;
    const gx = (u * G) | 0, gy = (v * G) | 0;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const cell = grid.get(((gx + ox + G) % G) + "," + ((gy + oy + G) % G));
      if (!cell) continue;
      for (const [cx, cy, rr, t] of cell) {
        let dx = u - cx, dy = v - cy;
        if (dx > .5) dx -= 1; if (dx < -.5) dx += 1; if (dy > .5) dy -= 1; if (dy < -.5) dy += 1;
        const q = 1 - (dx * dx + dy * dy) / (rr * rr);
        if (q > 0) {
          const hh = Math.sqrt(q) * (0.8 + t);
          if (hh > h) { h = hh; const c = 122 + t * 88 + fine * 12; r = c + 8; g = c - 2; b = c - 16 + t * 6; }
        }
      }
    }
    o.r = r; o.g = g; o.b = b; o.h = h; o.rough = 0.95 - h * 0.08;
  }, { strength: 5, repeat: [1, 1] });

  // Terra das vias, com sulcos
  T.dirt = surface(s, (u, v, o) => {
    const a = fbm(u, v, 5, 5), f = fbm(u + 2, v + 8, 2, 70);
    const rut = Math.pow(Math.abs(Math.sin(v * Math.PI * 2 * 3 + fbm(u, v, 2, 3) * 0.6)), 18);
    const g = 120 + a * 22 + f * 8 - rut * 25;
    o.r = g + 12; o.g = g; o.b = g - 16; o.h = f * 0.3 - rut * 0.6 + a * 0.2; o.rough = 0.97;
  }, { strength: 2.5 });

  // Tinta industrial (amarela, marinho, branca) com sujeira e riscos
  const scratches = rng(77), lines = [];
  for (let i = 0; i < 90; i++) lines.push([scratches(), scratches(), (scratches() - .5) * 0.25, scratches() * 0.08]);
  const paint = (base, seed) => surface(s, (u, v, o) => {
    const grime = Math.max(0, fbm(u + seed, v, 4, 4) * 0.6 + (v - 0.4) * 0.5);
    const f = fbm(u + seed * 2, v + 3, 2, 80);
    let sc = 0;
    for (const [x0, y0, sl, len] of lines) { const du = u - x0, dv = (v - y0) - du * sl; if (du > 0 && du < len && Math.abs(dv) < 0.0016) sc = 1; }
    const k = 1 - grime * 0.35;
    o.r = (base[0] * k + sc * 40) ; o.g = (base[1] * k + sc * 40); o.b = (base[2] * k + sc * 40);
    o.h = f * 0.12 - sc * 0.3; o.rough = 0.38 + grime * 0.35 + f * 0.04 - sc * 0.15;
  }, { strength: 1.2 });
  T.yellow = paint([242, 180, 0], 1.3);
  T.navy = paint([20, 46, 84], 4.1);
  T.white = paint([226, 228, 226], 7.7);
  T.orange = paint([238, 106, 24], 2.2);

  // Chapa trapezoidal galvanizada, com escorrimentos verticais
  T.corrugated = surface(s, (u, v, o) => {
    const prof = Math.max(-1, Math.min(1, Math.sin(u * Math.PI * 2 * 8) * 2.2));
    const streak = fbm(u * 1, v * 0.08, 3, 24);
    const g = 150 + prof * 14 + streak * 14 - Math.max(0, v - 0.75) * 60;
    o.r = g - 6; o.g = g + 1; o.b = g + 10; o.h = prof * 0.6; o.rough = 0.42 + streak * 0.1 + Math.max(0, v - 0.75) * 0.4;
  }, { strength: 3 });

  // Aço com leve oxidação
  T.steel = surface(s, (u, v, o) => {
    const a = fbm(u, v, 4, 6), rust = Math.max(0, fbm(u + 6, v + 6, 4, 5) - 0.18) * 2.2;
    o.r = 110 + a * 10 + rust * 60; o.g = 112 + a * 10 + rust * 18; o.b = 116 + a * 10 - rust * 10;
    o.h = a * 0.1 + rust * 0.2; o.rough = 0.42 + rust * 0.45;
  }, { strength: 1.2 });

  // Banda da borracha (sapatas e pneus) com ranhuras
  T.rubber = surface(256, (u, v, o) => {
    const grooves = Math.abs(Math.sin(u * Math.PI * 2 * 10)) > 0.86 ? 1 : 0;
    const f = fbm(u, v, 2, 40);
    const g = 30 + f * 6 - grooves * 10;
    o.r = g; o.g = g; o.b = g + 2; o.h = -grooves * 0.8 + f * 0.1; o.rough = 0.92;
  }, { strength: 4 });

  // Madeira dos dormentes
  T.wood = surface(256, (u, v, o) => {
    const ring = Math.sin((v * 40 + fbm(u, v, 3, 3) * 6) * Math.PI);
    const f = fbm(u + 3, v, 3, 30);
    o.r = 112 + ring * 14 + f * 12; o.g = 82 + ring * 10 + f * 8; o.b = 56 + ring * 7 + f * 5;
    o.h = ring * 0.2 + f * 0.2; o.rough = 0.9;
  }, { strength: 2 });

  // Grama seca das bordas
  T.grass = surface(s, (u, v, o) => {
    const a = fbm(u, v, 5, 7), f = fbm(u + 1, v + 2, 2, 90);
    o.r = 118 + a * 26 + f * 14; o.g = 116 + a * 22 + f * 10; o.b = 70 + a * 10;
    o.h = f * 0.4; o.rough = 0.98;
  }, { strength: 3 });

  // Nuvens (alfa) — cúmulos achatados de fim de tarde
  const cloud = mkCanvas(512, 256), cctx = cloud.getContext("2d"), cimg = cctx.createImageData(512, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const u = x / 512, v = y / 256;
    const env = Math.max(0, 1 - Math.pow((u - .5) / .5, 2)) * Math.max(0, 1 - Math.pow((v - .55) / .45, 2));
    const n = fbm(u * 1.6, v * 0.8, 5, 3) * 0.5 + 0.5;
    const a = Math.max(0, Math.min(1, (n * env * 1.9 - 0.35) * 2.2));
    const i = (y * 512 + x) * 4, shade = 255 - (v * 70);
    cimg.data[i] = shade; cimg.data[i + 1] = shade - 6; cimg.data[i + 2] = shade - 14; cimg.data[i + 3] = a * 255;
  }
  cctx.putImageData(cimg, 0, 0);
  T.cloud = toTex(cloud);

  // Tela de alambrado (alfa)
  const fence = mkCanvas(64, 64), fx = fence.getContext("2d");
  fx.strokeStyle = "#fff"; fx.lineWidth = 3;
  fx.beginPath(); fx.moveTo(0, 0); fx.lineTo(64, 64); fx.moveTo(64, 0); fx.lineTo(0, 64); fx.stroke();
  T.fence = toTex(fence, { srgb: false });

  // Poeira
  const dust = mkCanvas(64, 64), dx = dust.getContext("2d");
  const dg = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
  dg.addColorStop(0, "rgba(205,190,165,.85)"); dg.addColorStop(.5, "rgba(200,185,160,.35)"); dg.addColorStop(1, "rgba(200,185,160,0)");
  dx.fillStyle = dg; dx.fillRect(0, 0, 64, 64);
  T.dust = toTex(dust);

  return T;
}

/* Estêncil pintado na lateral da estaca (identificação de lote) */
export function stencilTexture(lines) {
  const c = mkCanvas(512, 128), x = c.getContext("2d");
  x.clearRect(0, 0, 512, 128);
  x.fillStyle = "rgba(25,30,38,.88)";
  x.font = "bold 46px 'Arial Narrow', Arial, sans-serif";
  x.textBaseline = "middle";
  x.fillText(lines[0], 14, 40);
  x.font = "bold 30px 'Arial Narrow', Arial, sans-serif";
  x.fillText(lines[1], 14, 96);
  // respingos do spray
  const r = rng(lines[0].length * 97);
  for (let i = 0; i < 260; i++) { x.globalAlpha = r() * 0.25; x.fillRect(r() * 512, r() * 128, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
