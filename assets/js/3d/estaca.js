/* A estaca que se monta: pista, cabeceiras, fôrma metálica, fios de protensão, concreto, cura,
   ensaio de 24 horas e liberação. Uma cena só, guiada por um estado contínuo (0..1 por etapa)
   e por uma luz (a hora do dia). As seções vêm dos ábacos IPR (window.IPR_ESTACAS). */
import * as THREE from "three";
import { surface, fbm, craters, craterAt } from "./tex.js";

const L = 6;            // segmento de 6 m, o menor da linha IPR
const BED_W = 1.5, BED_H = 0.14;
const ABUT = 2.6;       // cabeceiras longe da peça: a próxima fica atrás da câmera e os fios vêm de trás
const FORM_T = 0.012;   // chapa da fôrma
const WIRE_R = 0.0065;  // fio engrossado para ser lido na tela (o real tem 4 a 6 mm)
const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- Texturas ---------- */
let CACHE = null; // as duas cenas da home dividem as mesmas texturas
function textures(q) {
  if (CACHE) return CACHE;
  const S = q > 0.75 ? 512 : 384;
  const holes = craters(170, 7, 0.003, 0.008);
  const concrete = surface(S, (u, v, o) => {
    const big = fbm(u, v, 3, 3), mid = fbm(u + .3, v + .7, 4, 14), fine = fbm(u + .9, v + .1, 2, 90);
    const pit = craterAt(holes, u, v), stain = Math.max(0, fbm(u + 4, v + 2, 3, 2) - 0.15);
    const g = 182 + big * 10 + mid * 7 + fine * 6 - stain * 26 - pit * 34;
    o.r = g; o.g = g + 1; o.b = g + 2;
    o.h = mid * 0.25 + fine * 0.35 - pit * 1.1;
    o.rough = 0.84 + fine * 0.08 - stain * 0.1;
  }, { strength: 3 });
  const slab = surface(256, (u, v, o) => {
    const a = fbm(u, v, 4, 6), f = fbm(u + 3, v, 2, 60), oil = Math.max(0, fbm(u + 7, v + 1, 3, 3) - 0.1);
    const g = 150 + a * 7 + f * 4 - oil * 30;
    o.r = g; o.g = g; o.b = g + 2; o.h = f * 0.15; o.rough = 0.78 - oil * 0.2 + f * 0.04;
  }, { strength: 0.8, repeat: [2, 8] });
  const steel = surface(256, (u, v, o) => {
    const brush = fbm(u * 0.15, v * 3, 3, 20), a = fbm(u, v, 3, 5);
    const g = 120 + brush * 16 + a * 8;
    o.r = g - 4; o.g = g; o.b = g + 6; o.h = brush * 0.2; o.rough = 0.36 + a * 0.08;
  }, { strength: 0.8 });
  return (CACHE = { concrete, slab, steel });
}

/* Texturas fotográficas (geradas no Higgsfield a partir das fotos da fábrica: concreto curado,
   concreto fresco, chapa da fôrma e piso da pista). Entram por cima das procedurais assim que
   carregam; sem elas, a cena segue com as procedurais. */
let REAL = null;
function realTextures() {
  if (REAL) return REAL;
  const base = new URL("../../img/tex/", import.meta.url).href;
  const loader = new THREE.TextureLoader();
  const load = (file, srgb) => new Promise((ok) => loader.load(base + file, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    ok(t);
  }, undefined, () => ok(null)));
  const set = (n) => Promise.all([load(n + ".jpg", true), load(n + "-normal.jpg", false), load(n + "-rough.jpg", false)])
    .then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }));
  REAL = Promise.all(["concreto", "fresco", "aco", "pista"].map(set))
    .then(([concreto, fresco, aco, pista]) => ({ concreto, fresco, aco, pista }));
  return REAL;
}

/* Ambiente para reflexos: uma sala escura com painéis de luz (o aço precisa de algo para refletir). */
function environment(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x262c35, side: THREE.BackSide })));
  const panel = (w, h, pos, c, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(14, 3, [0, 6.8, 0], 0xffffff, 1.6);
  panel(8, 4, [-12, 3, -4], 0xffe2a0, 2.2);
  panel(8, 4, [12, 2, 6], 0x9fb8e8, 1.2);
  panel(20, 2, [0, 1, -14], 0xffffff, 0.6);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  return tex;
}

/* UV em metros, projetada pela face da caixa: a textura da chapa fica na escala real em vez de
   esticada ao longo dos 6 m da fôrma (o que virava riscos borrados). */
function uvCaixa(geo, tile) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const u = ax > 0.5 ? p.getZ(i) : p.getX(i), v = ay > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u / tile, v / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ---------- Geometria da seção (ábacos IPR) ---------- */
function section(e) {
  const R = e.d / 200, out = [], wires = [];
  if (e.forma === "hexagonal") {
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; out.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a))); }
  } else if (e.forma === "quadrada") {
    out.push(new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R), new THREE.Vector2(-R, -R));
  } else {
    for (let i = 0; i < 48; i++) { const a = Math.PI * 2 * i / 48; out.push(new THREE.Vector2(R * Math.cos(a), R * Math.sin(a))); }
  }
  // posições dos fios: as mesmas do desenho do catálogo (cobrimento de 4 cm)
  if (e.forma === "quadrada") {
    const h = R - 0.04;
    [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach((p) => wires.push([p[0] * h, p[1] * h]));
  } else {
    let r = e.forma === "hexagonal" ? R - 0.05 : R - 0.04;
    if (e.furo) r = R * 0.78;
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + (e.forma === "circular" ? Math.PI / 6 : 0);
      wires.push([r * Math.cos(a), r * Math.sin(a)]);
    }
  }
  const ymin = Math.min(...out.map((p) => p.y)), ymax = Math.max(...out.map((p) => p.y));
  return { R, out, wires, ymin, ymax, hole: e.furo ? R * 0.5 : 0 };
}

// largura da seção (corda) na altura y: para a superfície do concreto subindo na fôrma
function chord(sec, y) {
  let lo = Infinity, hi = -Infinity;
  const n = sec.out.length;
  for (let i = 0; i < n; i++) {
    const a = sec.out[i], b = sec.out[(i + 1) % n];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
      const x = a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    } else if (a.y === y) { lo = Math.min(lo, a.x); hi = Math.max(hi, a.x); }
  }
  return hi > lo ? [lo, hi] : [0, 0];
}

export function createEstaca(canvas, opts = {}) {
  const small = window.innerWidth < 760;
  const quality = opts.quality ?? (small ? 0.6 : 1);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(small ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  // a estaca se monta no papel: luz clara e neutra, névoa da cor da página, sombra e malha em azul-marinho
  const LOOK = { fog: "#fbfaf7", sky: 0xe4e9f0, ground: 0xc9ced6, hemi: 1.55, sunMin: 1.7, rim: 0.5, exposure: 1.0, env: 1.0, sombra: [0x0a1f3d, 0.2], grade: "10,31,61", gradeA: 0.2 };
  scene.fog = new THREE.Fog(LOOK.fog, 11, 27);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  const T = textures(quality);
  const M = {
    concrete: new THREE.MeshStandardMaterial({ map: T.concrete.map, roughnessMap: T.concrete.roughnessMap, normalMap: T.concrete.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide }),
    wet: new THREE.MeshStandardMaterial({ color: 0x4a4e53, roughness: 0.34, metalness: 0, normalMap: T.concrete.normalMap, normalScale: new THREE.Vector2(0.25, 0.25) }),
    slab: new THREE.MeshStandardMaterial({ map: T.slab.map, roughnessMap: T.slab.roughnessMap, normalMap: T.slab.normalMap, color: 0x9aa0a8, transparent: true }),
    form: new THREE.MeshStandardMaterial({ map: T.steel.map, roughnessMap: T.steel.roughnessMap, normalMap: T.steel.normalMap, color: 0xd6dde4, metalness: 0.3, roughness: 0.4, transparent: true, side: THREE.DoubleSide }),
    head: new THREE.MeshStandardMaterial({ color: 0x0d2a52, metalness: 0.6, roughness: 0.45, transparent: true }), // cabeceiras no azul da marca
    wire: new THREE.MeshStandardMaterial({ color: 0xe6ebf0, metalness: 0.55, roughness: 0.3 }),
    cp: new THREE.MeshStandardMaterial({ map: T.concrete.map, normalMap: T.concrete.normalMap, color: 0xd9d6cf, roughness: 0.85, transparent: true, emissive: 0xffcd00, emissiveIntensity: 0 }),
    press: new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.8, roughness: 0.35, transparent: true }),
    pulse: new THREE.MeshBasicMaterial({ color: 0xffcd00, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    bucket: new THREE.MeshStandardMaterial({ color: 0xe0a800, metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
    chuck: new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.3, transparent: true }),
  };
  T.concrete.map.repeat.set(3, 3); T.concrete.roughnessMap.repeat.set(3, 3); T.concrete.normalMap.repeat.set(3, 3);
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1);
  M.concrete.clippingPlanes = [clip]; M.concrete.clipShadows = true;
  M.wet.clippingPlanes = [];

  // as fotos de material substituem as procedurais quando chegam (cada cena com a sua escala)
  realTextures().then((R) => {
    const use = (mat, t, rep, color) => {
      if (!t || !t.map) return;
      const own = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; };
      mat.map = own(t.map); mat.normalMap = own(t.normalMap); mat.roughnessMap = own(t.roughnessMap);
      if (color != null) mat.color.set(color);
      mat.needsUpdate = true;
    };
    use(M.concrete, R.concreto, [3, 3]);           // a cor segue a cura a cada quadro
    use(M.cp, R.concreto, [1, 1], 0xf2f0ea);
    use(M.wet, R.fresco, [3, 3], 0xffffff);
    use(M.slab, R.pista, [1, 9], 0xd9dee6);
    use(M.form, R.aco, [1, 1], 0xffffff);
    M.form.color.setRGB(1.32, 1.36, 1.42); // a foto da chapa é escura: clareia para o aço ler como aço contra o papel
    request();
  });

  /* ---------- Luzes ---------- */
  const hemi = new THREE.HemisphereLight(0x3a5f9a, 0x060c18, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 34 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const sunTarget = new THREE.Object3D(); sunTarget.position.set(0, 0, -L / 2); sun.target = sunTarget;
  const sodium = new THREE.PointLight(0xffb347, 0, 18, 1.2);
  sodium.position.set(-1.6, 2.4, 0.4); // poste ao lado da pista, perto da prensa
  // luz de recorte vinda do fundo da pista: desenha o contorno do aço e do concreto contra o azul
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.4);
  rim.position.set(2.5, 2.2, -11);
  rim.target = sunTarget;
  scene.add(hemi, sun, sunTarget, sodium, rim);

  /* ---------- Pista e cabeceiras (fixas) ---------- */
  const fixed = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(BED_W, BED_H, L + 2 * ABUT + 1.2), M.slab);
  bed.position.set(0, -BED_H / 2, -L / 2); bed.receiveShadow = true;
  const heads = [ABUT, -L - ABUT].map((z) => {
    const g = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.24), M.head);
    block.position.y = 0.31; block.castShadow = block.receiveShadow = true;
    const plate = new THREE.Mesh(uvCaixa(new THREE.BoxGeometry(0.62, 0.42, 0.03), 0.6), M.form);
    plate.position.set(0, 0.3, z > 0 ? -0.135 : 0.135);
    g.add(block, plate); g.position.z = z;
    return g;
  });
  fixed.add(bed, ...heads);
  scene.add(fixed);
  // chão invisível que só recebe a sombra: a pista assenta no azul da página em vez de flutuar
  const M_sombra = new THREE.ShadowMaterial({ color: LOOK.sombra[0], opacity: LOOK.sombra[1] });
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), M_sombra);
  chao.rotation.x = -Math.PI / 2; chao.position.set(0, -BED_H - 0.002, -L / 2); chao.receiveShadow = true;
  scene.add(chao);
  // malha de piso em perspectiva, 50 cm entre linhas, apagando com a distância: dá chão e profundidade
  const M_grade = (() => {
    const N = 2048, g = document.createElement("canvas"); g.width = g.height = N;
    const x = g.getContext("2d"), passo = N / 60;
    for (let i = 0; i <= 60; i++) {
      const p = Math.round(i * passo) + 0.5, forte = i % 2 === 0;
      x.fillStyle = "rgba(" + LOOK.grade + "," + (forte ? 0.7 : 0.3) + ")";
      x.fillRect(p - 0.75, 0, 1.5, N); x.fillRect(0, p - 0.75, N, 1.5);
    }
    x.globalCompositeOperation = "destination-in";
    const r = x.createRadialGradient(N / 2, N / 2, N * 0.06, N / 2, N / 2, N * 0.5);
    r.addColorStop(0, "rgba(0,0,0,1)"); r.addColorStop(0.55, "rgba(0,0,0,.55)"); r.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = r; x.fillRect(0, 0, N, N);
    const t = new THREE.CanvasTexture(g); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: LOOK.gradeA, depthWrite: false, fog: true });
  })();
  const grade = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), M_grade);
  grade.rotation.x = -Math.PI / 2; grade.position.set(0, -BED_H - 0.004, -L / 2); grade.renderOrder = -1;
  scene.add(grade);

  const bucket = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.09, 0.42, 28, 1, true), M.bucket); cone.castShadow = true;
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 32), M.bucket); rimRing.rotation.x = Math.PI / 2; rimRing.position.y = 0.21;
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.01, 8, 24, Math.PI), M.head); bail.position.y = 0.21;
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 4, 6), M.wire); cable.position.y = 0.52 + 2;
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.02, 1, 12), M.wet); stream.geometry.translate(0, -0.5, 0);
  bucket.add(cone, rimRing, bail, cable); scene.add(bucket, stream);


  /* ---------- Partes que dependem da seção ---------- */
  let sec, y0, pile, cap, formL, formR, formB, wires = [], cps = [], press, pulses = [], chucks = [];
  const pileGroup = new THREE.Group(), formGroup = new THREE.Group(), wireGroup = new THREE.Group(), cpGroup = new THREE.Group();
  scene.add(pileGroup, formGroup, wireGroup, cpGroup);

  function disposeGroup(g) {
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    g.clear();
  }

  function edgeStrip(a, b, len) {
    const dx = b.x - a.x, dy = b.y - a.y, w = Math.hypot(dx, dy);
    const m = new THREE.Mesh(uvCaixa(new THREE.BoxGeometry(w + FORM_T, FORM_T, len), 1.1), M.form);
    const nx = dy / w, ny = -dx / w; // normal para fora (polígono anti-horário)
    m.position.set((a.x + b.x) / 2 + nx * FORM_T / 2, (a.y + b.y) / 2 + ny * FORM_T / 2, 0);
    m.rotation.z = Math.atan2(dy, dx);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  function build(e) {
    [pileGroup, formGroup, wireGroup, cpGroup].forEach(disposeGroup);
    chucks = [];
    sec = section(e);
    y0 = -sec.ymin + FORM_T;

    // corpo da estaca (extrusão da seção ao longo de z, de 0 a -L)
    const shape = new THREE.Shape(sec.out);
    if (sec.hole) { const h = new THREE.Path(); h.absarc(0, 0, sec.hole, 0, Math.PI * 2, true); shape.holes.push(h); }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 40 });
    geo.translate(0, 0, -L);
    pile = new THREE.Mesh(geo, M.concrete);
    pile.castShadow = pile.receiveShadow = true;
    pile.position.y = y0;
    cap = new THREE.Mesh(new THREE.PlaneGeometry(1, L), M.wet);
    cap.rotation.x = -Math.PI / 2; cap.position.z = -L / 2;
    pileGroup.add(pile, cap);

    // fôrma: todas as faces menos a de cima; laterais articuladas na base para abrir
    const n = sec.out.length, top = sec.ymax - 1e-4;
    const left = new THREE.Group(), right = new THREE.Group(), base = new THREE.Group();
    const bl = new THREE.Vector2(Infinity, 0), br = new THREE.Vector2(-Infinity, 0);
    for (let i = 0; i < n; i++) {
      const a = sec.out[i], b = sec.out[(i + 1) % n];
      const mid = (a.y + b.y) / 2;
      if (e.forma === "circular" ? Math.abs(Math.atan2(mid, (a.x + b.x) / 2) - Math.PI / 2) < 0.62 : a.y > top && b.y > top) continue;
      const strip = edgeStrip(a, b, L + 0.04);
      strip.position.z = -L / 2;
      const mx = (a.x + b.x) / 2;
      const side = Math.abs(mx) < sec.R * 0.2 && mid < 0 ? base : mx < 0 ? left : right;
      side.add(strip);
      if (e.forma !== "circular" || i % 4 === 0) for (let k = 0; k <= 8; k++) {
        const rib = edgeStrip(a, b, 0.022); rib.scale.y = 3.2; rib.position.z = -k * L / 8;
        rib.position.x += (strip.position.x - (a.x + b.x) / 2) * 2.4; rib.position.y += (strip.position.y - (a.y + b.y) / 2) * 2.4;
        side.add(rib);
      }
      if (mid < sec.ymin + 0.02) { bl.x = Math.min(bl.x, a.x, b.x); br.x = Math.max(br.x, a.x, b.x); }
    }
    if (!isFinite(bl.x)) { bl.x = -sec.R * 0.5; br.x = sec.R * 0.5; }
    // dobradiças: cada lateral gira em torno da aresta inferior
    formL = new THREE.Group(); formL.position.set(bl.x, sec.ymin, 0); left.position.set(-bl.x, -sec.ymin, 0); formL.add(left);
    formR = new THREE.Group(); formR.position.set(br.x, sec.ymin, 0); right.position.set(-br.x, -sec.ymin, 0); formR.add(right);
    formB = base;
    formGroup.add(formL, formR, formB);
    formGroup.position.y = y0;

    // fios: tubo com folga (antes da tensão) e cilindros retos (depois), com as pontas externas separadas
    wires = sec.wires.map(([x, y]) => {
      const w = { x, y: y + y0, tube: null, inner: null, near: null, far: null };
      const cyl = (len) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(WIRE_R, WIRE_R, len, 8), M.wire); m.rotation.x = Math.PI / 2; m.castShadow = true; return m; };
      w.inner = cyl(L + 0.035); w.inner.position.set(x, w.y, -L / 2);
      const outer = ABUT - 0.12;
      w.near = cyl(outer); w.near.geometry.translate(0, -outer / 2, 0); w.near.position.set(x, w.y, outer);   // escala a partir da cabeceira
      w.far = cyl(outer); w.far.geometry.translate(0, outer / 2, 0); w.far.position.set(x, w.y, -L - outer);
      wireGroup.add(w.inner, w.near, w.far);
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.06, 12), M.chuck);
      ch.rotation.x = Math.PI / 2; ch.position.set(x, w.y, -L - ABUT + 0.15); wireGroup.add(ch); chucks.push(ch);
      return w;
    });

    // corpos de prova moldados do mesmo lote, ao lado da pista, e a prensa do ensaio de 24 horas
    cps = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 28), M.cp);
      m.position.set(-0.56, 0.1, -0.35 - i * 0.2); m.castShadow = m.receiveShadow = true;
      cpGroup.add(m); return m;
    });
    press = new THREE.Group();
    const plate = (y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.2), M.press); m.position.y = y; m.castShadow = true; return m; };
    const pBase = plate(0.0175), pTop = plate(0.36);
    const rods = [-0.085, 0.085].map((x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 10), M.press); m.position.set(x, 0.21, 0); return m; });
    press.add(pBase, pTop, ...rods); press.userData.top = pTop;
    press.position.set(-0.52, 0, 0.42);
    cpGroup.add(press);

    // pulso de luz da liberação: o contorno da seção percorre a peça das pontas para o centro
    pulses = [0, 1].map(() => {
      const ring = new THREE.Shape(sec.out.map((p) => p.clone().multiplyScalar(1.06)));
      ring.holes.push(new THREE.Path(sec.out.map((p) => p.clone().multiplyScalar(1.015)).reverse()));
      const m = new THREE.Mesh(new THREE.ShapeGeometry(ring, 24), M.pulse);
      m.position.y = y0; pileGroup.add(m); return m;
    });
    last = null;
    apply(state);
  }

  function sagCurve(w, sag) {
    const z0 = ABUT - 0.12, z1 = -L - ABUT + 0.12, pts = [];
    for (let i = 0; i <= 40; i++) {
      const s = i / 40, z = lerp(z0, z1, s);
      pts.push(new THREE.Vector3(w.x, w.y - sag * 4 * s * (1 - s), z));
    }
    return new THREE.CatmullRomCurve3(pts);
  }

  /* ---------- Estado ---------- */
  const state = {
    form: 1, wireIn: 1, tension: 1, fill: 1, cure: 1, cps: 0, test: 0, release: 0, open: 0, lift: 0, turn: 0, view: 0, yaw: 0, pitch: 0, dive: 0,
    light: { sun: 0xffffff, sunI: 2.4, elev: 35, azim: -30, sky: 0x8fb0dd, ground: 0x0a1426, hemiI: 0.7, sodium: 0, exposure: 1, env: 0.6, fog: 0x0b1f3d },
  };
  let last = null;
  const tmpC = new THREE.Color();

  function apply(s) {
    if (!sec) return;
    const form = ease(s.form), lay = ease(s.wireIn), ten = ease(s.tension), fill = ease(s.fill), cure = ease(s.cure);
    const rel = ease(s.release), open = ease(s.open), lift = ease(s.lift), turn = ease(s.turn);

    // pista, cabeceiras e fôrma surgem; somem quando a estaca é erguida
    const ground = 1 - lift;
    M.slab.opacity = Math.min(1, form * 1.4) * ground;
    M.head.opacity = form * ground;
    M.form.opacity = form * (1 - open * 0.9) * ground;
    fixed.visible = M.slab.opacity > 0.01;
    M_sombra.opacity = LOOK.sombra[1] * Math.min(1, form * 1.4) * ground;
    M_grade.opacity = LOOK.gradeA * Math.min(1, form * 1.4) * ground;
    formGroup.visible = M.form.opacity > 0.01;
    formGroup.position.y = y0 + (1 - form) * 0.25;
    formL.rotation.z = open * 1.25; formR.rotation.z = -open * 1.25;

    // fios: entram com folga, esticam; na liberação as pontas externas recolhem para as cabeceiras
    const showTube = lay > 0 && ten < 0.999;
    wires.forEach((w) => {
      if (showTube) {
        const sag = (1 - ten) * Math.max(0.02, w.y - WIRE_R - 0.004) * lay;
        if (w.tube) { w.tube.geometry.dispose(); w.tube.geometry = new THREE.TubeGeometry(sagCurve(w, sag), 80, WIRE_R, 6); }
        else { w.tube = new THREE.Mesh(new THREE.TubeGeometry(sagCurve(w, sag), 80, WIRE_R, 6), M.wire); w.tube.castShadow = true; wireGroup.add(w.tube); }
        w.tube.visible = true;
        w.tube.material.opacity = 1;
        w.tube.scale.setScalar(1);
        w.tube.position.y = (1 - lay) * 0.4;
      } else if (w.tube) w.tube.visible = false;
      const straight = !showTube && lay > 0;
      w.inner.visible = straight;
      w.near.visible = w.far.visible = straight && rel < 0.999 && lift < 0.01;
      w.near.scale.y = w.far.scale.y = Math.max(0.001, 1 - rel);
      w.inner.position.y = w.y; // a peça sobe junto com os fios internos (ver pileGroup)
    });

    // concreto: o plano de corte sobe com o enchimento; a superfície úmida acompanha
    const yBottom = y0 + sec.ymin, yTop = y0 + sec.ymax;
    const h = lerp(yBottom - 0.002, yTop + 0.02, fill);
    clip.constant = fill >= 0.999 ? 1e3 : h; // cheia, a peça pode subir sem ser cortada
    pile.visible = fill > 0.001;
    const [lo, hi] = chord(sec, Math.min(h, yTop - 1e-4) - y0);
    cap.visible = fill > 0.001 && fill < 0.999 && hi > lo;
    cap.scale.set(Math.max(0.001, hi - lo), 1, 1);
    cap.position.set((lo + hi) / 2, h, -L / 2);
    // cura: o concreto úmido e escuro vira claro e fosco
    M.concrete.color.copy(tmpC.setRGB(lerp(0.42, 0.93, cure), lerp(0.43, 0.95, cure), lerp(0.45, 1, cure))); // a foto do concreto já é quente
    M.concrete.roughness = lerp(0.36, 1, cure);
    M.concrete.normalScale.setScalar(lerp(0.3, 0.55, cure));

    // caçamba: percorre a pista despejando enquanto a fôrma enche
    const pouring = fill > 0.004 && fill < 0.985;
    bucket.visible = stream.visible = pouring;
    if (pouring) {
      const bz = -L / 2 + Math.sin(fill * Math.PI * 2.6) * (L / 2 - 0.5), by = yTop + 0.75;
      bucket.position.set(0, by, bz); bucket.rotation.z = Math.sin(fill * 40) * 0.015;
      stream.position.set(0, by - 0.2, bz); stream.scale.y = Math.max(0.02, by - 0.2 - h);
    }
    chucks.forEach((c) => { c.visible = lay > 0.5 && lift < 0.01; });
    M.chuck.opacity = ground;

    // corpos de prova e ensaio
    const cpIn = ease(s.cps), test = s.test;
    cps.forEach((m, i) => { const k = ease(cpIn * 1.6 - i * 0.3); m.visible = k > 0.002; m.scale.set(1, Math.max(0.001, k), 1); m.position.y = 0.1 * m.scale.y; });
    M.cp.opacity = ground;
    M.press.opacity = Math.min(1, test * 3) * ground;
    press.visible = test > 0.01 && ground > 0.01;
    const move = ease(Math.min(1, test / 0.35)), close = ease((test - 0.35) / 0.35);
    cps[0].position.x = lerp(-0.56, -0.52, move);
    cps[0].position.z = lerp(-0.35, 0.42, move);
    cps[0].position.y = lerp(0.1 * cps[0].scale.y, 0.035 + 0.1, move);
    press.userData.top.position.y = lerp(0.36, 0.035 + 0.2 + 0.0175 + 0.001, close);
    M.cp.emissiveIntensity = test > 0.75 ? ease((test - 0.75) / 0.12) * (1 - ease((test - 0.9) / 0.1)) * 1.6 : 0;

    // liberação: o pulso entra pelas pontas e se encontra no meio da peça
    pulses.forEach((p, i) => { p.position.z = i ? lerp(-L, -L / 2, rel) : lerp(0, -L / 2, rel); p.visible = rel > 0.01 && rel < 0.99; });
    M.pulse.opacity = Math.sin(Math.PI * rel) * 0.9;

    // a estaca pronta sobe; os fios internos sobem com ela
    const up = lift * 0.42;
    pileGroup.position.y = up;
    wires.forEach((w) => { w.inner.position.y = w.y + up; });

    // luz da hora
    const Lg = s.light;
    sun.color.set(Lg.sun); sun.intensity = Lg.sunI;
    const el = THREE.MathUtils.degToRad(Math.max(Lg.elev, 1)), az = THREE.MathUtils.degToRad(Lg.azim);
    sun.position.set(Math.sin(az) * Math.cos(el) * 12, Math.sin(el) * 12, -L / 2 + Math.cos(az) * Math.cos(el) * 12);
    sun.castShadow = Lg.sunI > 0.05;
    hemi.color.set(Lg.sky).lerp(tmpC.set(LOOK.sky), 0.6); hemi.groundColor.set(Lg.ground).lerp(tmpC.set(LOOK.ground), 0.7); hemi.intensity = Math.max(Lg.hemiI, LOOK.hemi);
    sun.color.lerp(tmpC.set(0xffffff), 0.45); sun.intensity = Math.max(Lg.sunI, LOOK.sunMin);
    if (Lg.elev < 16) sun.position.set(Math.sin(az) * Math.cos(0.28) * 12, Math.sin(0.28) * 12, -L / 2 + Math.cos(az) * Math.cos(0.28) * 12);
    sun.castShadow = true;
    sodium.intensity = Lg.sodium * 3.2;
    rim.intensity = LOOK.rim;
    renderer.toneMappingExposure = LOOK.exposure;
    scene.environmentIntensity = Math.max(Lg.env, LOOK.env);
    scene.fog.color.set(LOOK.fog);

    // câmera: três quartos sobre a pista, rasante ao longo dos fios, e de frente para a seção no fim
    // A: três quartos, de lado e do alto; B: rasante ao longo dos fios; D: a prensa do ensaio; C: de frente para a seção
    const A = { p: [-3.7, 2.2, 3.6], t: [0.15, 0.05, -2.1] };
    const B = { p: [-2.0, 0.72, 3.0], t: [0.1, 0.15, -2.6] };
    const D = { p: [-1.75, 0.9, 2.15], t: [-0.3, 0.14, 0.1] };
    const yc = y0 + up;
    const C = { p: [0, yc + 0.02, lerp(1.3, 0.93, ease(s.dive || 0))], t: [0, yc, -1] }; // no fim, a câmera avança sobre a face da seção
    const v = ease(s.view), foc = Math.sin(Math.PI * Math.min(1, test * 1.1)) * (1 - rel);
    const P = [0, 1, 2].map((i) => lerp(lerp(lerp(A.p[i], B.p[i], v), D.p[i], foc), C.p[i], turn));
    const Tt = [0, 1, 2].map((i) => lerp(lerp(lerp(A.t[i], B.t[i], v), D.t[i], foc), C.t[i], turn));
    if (s.yaw || s.pitch) {
      // gira em torno do meio da peça e se afasta ao ver de lado, para a estaca inteira caber
      const piv = [Tt[0], Tt[1], lerp(Tt[2], -L / 2, turn)];
      const off = new THREE.Vector3(P[0] - piv[0], P[1] - piv[1], P[2] - piv[2]);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta += s.yaw; sph.phi = Math.min(2.6, Math.max(0.35, sph.phi - s.pitch));
      sph.radius *= 1 + 0.9 * Math.abs(Math.sin(s.yaw)) * turn;
      off.setFromSpherical(sph);
      P[0] = piv[0] + off.x; P[1] = piv[1] + off.y; P[2] = piv[2] + off.z;
      Tt[0] = piv[0]; Tt[1] = piv[1]; Tt[2] = piv[2];
    }
    camera.position.set(...P);
    camera.lookAt(...Tt);
    camera.fov = lerp(30, 26, turn);
    // a peça fica à direita do texto durante a montagem e volta ao centro quando gira para a face
    const sh = desloc * (1 - turn);
    if (sh > 0.0005) camera.setViewOffset(vw, vh, -vw * sh, 0, vw, vh); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // telas estreitas: afasta a câmera para a peça caber
    camera.zoom = w / h < 0.6 ? 0.55 : w / h < 0.9 ? 0.72 : w / h < 1.35 ? 0.86 : 1; // painel mais estreito que a tela: a peça inteira cabe
    vw = w; vh = h; desloc = w / h > 1.2 ? (opts.shiftX || 0) : 0;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  let dirty = true, raf = 0;
  let vw = 1, vh = 1, desloc = 0;
  function loop() {
    raf = 0;
    if (!dirty) return;
    dirty = false;
    apply(state);
    renderer.render(scene, camera);
    if (opts.onRender) opts.onRender(); // rótulos HTML acompanham a câmera do quadro que acabou de ser desenhado
  }
  function request() { dirty = true; if (!raf) raf = requestAnimationFrame(loop); }

  build(opts.estaca || (window.IPR_ESTACAS || []).find((e) => e.id === "H33") || { forma: "hexagonal", d: 33 });
  resize();
  window.addEventListener("resize", () => { resize(); request(); });

  return {
    state,
    set(patch) { Object.assign(state, patch); if (patch.light) state.light = Object.assign({}, state.light, patch.light); request(); },
    setSection(e) { build(e); request(); },
    render: request,
    // posição da seção na tela, para alinhar o desenho cotado por cima no fim da montagem
    project(x, y) { const v = new THREE.Vector3(x, y + y0 + pileGroup.position.y, 0).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; },
    get radius() { return sec ? sec.R : 0; },
    anchors() {
      if (!sec) return {};
      const up = pileGroup.position.y, w0 = wires[0] || { x: 0, y: y0 };
      const pts = {
        fio: [w0.x, w0.y + up, -L * 0.28],
        cabeceira: [0, 0.66, -L - ABUT],
        forma: [sec.out.reduce((m, q) => Math.min(m, q.x), 0) - 0.02, y0, -L * 0.62],
        concreto: [0, y0 + sec.ymax + up, -L * 0.42],
        cp: [-0.56, 0.24, -0.55],
        prensa: [-0.52, 0.42, 0.42],
        secao: [0, y0 + up + sec.ymax * 0.55, 0.02],
        fioface: [w0.x, w0.y + up, 0.03],
        cotaA: [BED_W / 2, 0, 0],
        cotaB: [BED_W / 2, 0, -L],
      };
      const w = canvas.clientWidth, h = canvas.clientHeight, out = {}, v = new THREE.Vector3();
      for (const k in pts) {
        v.set(...pts[k]).project(camera);
        out[k] = { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, on: v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98 };
      }
      return out;
    },
  };
}
