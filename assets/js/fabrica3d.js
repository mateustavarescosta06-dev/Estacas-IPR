/* IPR Estacas — maquete 3D procedural do pátio da fábrica.
   Tudo é gerado em código: geometrias, texturas (canvas) e iluminação.
   Usado ao vivo na capa da home e para renderizar as imagens das páginas (tools/render.html). */
import * as THREE from "../vendor/three.module.min.js";
import { RoomEnvironment } from "../vendor/RoomEnvironment.js";

/* ---------- Texturas procedurais ---------- */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

function speckle(ctx, w, h, base, n, colors, seed, size) {
  const r = rng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    ctx.globalAlpha = 0.08 + r() * 0.35;
    const s = (size || 2) * (0.4 + r());
    ctx.fillRect(r() * w, r() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function makeTextures() {
  const concrete = canvasTex(512, 512, (ctx, w, h) => {
    speckle(ctx, w, h, "#a8a39a", 12000, ["#7f7a71", "#c7c2b8", "#949086", "#5f5b54"], 7, 2.2);
    const r = rng(11);
    for (let i = 0; i < 14; i++) { // manchas suaves de cura
      const cx = r() * w, cy = r() * h;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 + r() * 90);
      g.addColorStop(0, "rgba(90,85,78,.16)"); g.addColorStop(1, "rgba(90,85,78,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }, [1, 4]);

  const dirt = canvasTex(1024, 1024, (ctx, w, h) => {
    speckle(ctx, w, h, "#7a6d5b", 60000, ["#6d604e", "#a29279", "#5a4f41", "#b3a58d", "#7c8088"], 3, 3);
    const r = rng(5);
    for (let i = 0; i < 40; i++) {
      const cx = r() * w, cy = r() * h;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + r() * 160);
      g.addColorStop(0, `rgba(${r() < .5 ? "70,60,48" : "150,140,120"},.22)`); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.strokeStyle = "rgba(60,52,42,.1)"; ctx.lineWidth = 7; // marcas de pneu
    for (let k = 0; k < 6; k++) {
      ctx.beginPath(); const y0 = r() * h;
      ctx.moveTo(0, y0); ctx.bezierCurveTo(w * .3, y0 + r() * 200 - 100, w * .6, y0 + r() * 200 - 100, w, y0 + r() * 120 - 60); ctx.stroke();
    }
  }, [12, 12]);

  const corrugated = canvasTex(256, 256, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = 0.5 + 0.5 * Math.sin(x / w * Math.PI * 2 * 16);
      const c = Math.round(120 + v * 55);
      ctx.fillStyle = `rgb(${c - 6},${c + 2},${c + 12})`; ctx.fillRect(x, 0, 1, h);
    }
    speckle(ctx, 0, 0, "transparent", 0, ["#000"], 1);
    ctx.fillStyle = "rgba(60,50,40,.15)"; ctx.fillRect(0, h * .85, w, h * .15);
  }, [6, 1]);

  const hazard = canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = "#f2b800"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#111";
    for (let x = -h; x < w + h; x += 48) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 24, h); ctx.lineTo(x + 24 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
  }, [1, 1]);

  const lattice = (() => {
    const t = canvasTex(64, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 7;
      ctx.strokeRect(3, -10, w - 6, h + 20);
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(w - 3, h); ctx.moveTo(w - 3, 0); ctx.lineTo(3, h); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    }, [1, 18]);
    return t;
  })();

  const wood = canvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = "#7a5b3d"; ctx.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 40; i++) { ctx.strokeStyle = `rgba(${r() < .5 ? "50,35,20" : "150,120,85"},.35)`; ctx.lineWidth = 1 + r() * 2; ctx.beginPath(); const y = r() * h; ctx.moveTo(0, y); ctx.lineTo(w, y + r() * 6 - 3); ctx.stroke(); }
  }, [2, 1]);

  const sky = canvasTex(16, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#14263e"); g.addColorStop(.35, "#34506f"); g.addColorStop(.55, "#8a8f98"); g.addColorStop(.66, "#d1a87a"); g.addColorStop(.72, "#e2b783"); g.addColorStop(.8, "#c3a784"); g.addColorStop(1, "#8b7a68");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  sky.wrapS = sky.wrapT = THREE.ClampToEdgeWrapping;

  const dust = canvasTex(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(200,185,160,.9)"); g.addColorStop(1, "rgba(200,185,160,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });

  return { concrete, dirt, corrugated, hazard, lattice, wood, sky, dust };
}

/* ---------- Construção da cena ---------- */
export function createYard(canvas, opts = {}) {
  const live = !!opts.live;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !live, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.pixelRatio || Math.min(window.devicePixelRatio, live ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const T = makeTextures();
  scene.background = T.sky;
  scene.fog = new THREE.Fog(0xc3a784, 38, 150);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 600);

  // Luz de fim de tarde, baixa e lateral: sombras longas
  scene.add(new THREE.HemisphereLight(0xb7c7dc, 0x5e4f3e, 0.6));
  const sun = new THREE.DirectionalLight(0xffc488, 2.6);
  sun.position.set(-46, 19, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(live ? 2048 : 4096, live ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9db7d8, 0.6);
  rim.position.set(30, 18, -30);
  scene.add(rim);

  const M = {
    concrete: new THREE.MeshStandardMaterial({ map: T.concrete, roughness: 0.92, metalness: 0 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x8d8880, map: T.concrete, roughness: 0.95 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf2b800, roughness: 0.42, metalness: 0.25 }),
    yellowLattice: new THREE.MeshStandardMaterial({ color: 0xf2b800, roughness: 0.45, metalness: 0.3, alphaMap: T.lattice, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false }),
    navy: new THREE.MeshStandardMaterial({ color: 0x0f2c52, roughness: 0.5, metalness: 0.2 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6f7984, roughness: 0.38, metalness: 0.8 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.08, metalness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.9 }),
    hazard: new THREE.MeshStandardMaterial({ map: T.hazard, roughness: 0.5, metalness: 0.2 }),
    shed: new THREE.MeshStandardMaterial({ map: T.corrugated, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }),
    roof: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, map: T.corrugated, roughness: 0.45, metalness: 0.55, side: THREE.DoubleSide }),
    ground: new THREE.MeshStandardMaterial({ map: T.dirt, roughness: 1 }),
    slab: new THREE.MeshStandardMaterial({ color: 0x9c978e, map: T.concrete, roughness: 0.95 }),
    strand: new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.3, metalness: 1 }),
  };

  const add = (geo, mat, x, y, z, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // Terreno
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.ground);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  /* Estacas: seção hexagonal, circular ou quadrada, eixo ao longo de Z */
  const strandEnds = [];
  function pileGeo(forma, d, len) {
    let g;
    if (forma === "quadrada") g = box(d, d, len);
    else {
      g = new THREE.CylinderGeometry(d / 2, d / 2, len, forma === "hexagonal" ? 6 : 28, 1);
      g.rotateX(Math.PI / 2);
      if (forma === "hexagonal") g.rotateZ(Math.PI / 2);
    }
    return g;
  }
  function strandOffsets(forma, d) {
    const out = [];
    if (forma === "quadrada") { const h = d / 2 - 0.045; [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach(p => out.push([p[0] * h, p[1] * h])); }
    else { const r = d / 2 - (forma === "hexagonal" ? 0.055 : 0.045); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; out.push([r * Math.cos(a), r * Math.sin(a)]); } }
    return out;
  }
  function pile(forma, d, len, x, y, z, rotY) {
    const m = add(pileGeo(forma, d, len), M.concrete, x, y, z);
    if (rotY) m.rotation.y = rotY;
    const offs = strandOffsets(forma, d);
    [-1, 1].forEach(s => offs.forEach(o => {
      const v = new THREE.Vector3(o[0], o[1], s * (len / 2 + 0.012));
      if (rotY) v.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      strandEnds.push({ p: v.add(m.position), rotY: rotY || 0 });
    }));
    return m;
  }

  // Pilha com dormentes de madeira entre camadas
  function stack(forma, d, len, cx, cz, perLayer, layers, rotY) {
    const gap = 0.07, sleeper = 0.12;
    const h = forma === "hexagonal" ? d * 0.866 : d;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = rotY || 0; scene.add(g);
    let y = sleeper;
    for (let L = 0; L < layers; L++) {
      const n = perLayer - (L === layers - 1 ? 2 : 0);
      for (const zz of [-len * 0.35, 0, len * 0.35]) add(box(perLayer * (d + gap) + 0.3, sleeper, 0.16), M.wood, 0, y - sleeper / 2, zz, g);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * (d + gap);
        const wp = new THREE.Vector3(x, y + h / 2, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y).add(g.position);
        pile(forma, d, len, wp.x, wp.y, wp.z, g.rotation.y);
      }
      y += h + sleeper;
    }
    return g;
  }

  stack("hexagonal", 0.33, 10, -9, 3, 9, 5, 0);
  stack("hexagonal", 0.28, 10, -14.5, 1.5, 10, 4, 0);
  stack("circular", 0.3, 10, -20, 2.5, 9, 4, 0);
  stack("circular", 0.26, 8, 8.5, -6, 10, 4, Math.PI / 2);
  stack("quadrada", 0.3, 10, -9.5, -12, 8, 4, 0.06);
  stack("hexagonal", 0.21, 8, 9, -13.5, 12, 5, Math.PI / 2);
  stack("circular", 0.23, 10, -26, -4, 10, 3, 0.12);

  // Estacas já cravadas (cotas de arrasamento) ao redor do bate-estacas
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const x = 3.2 + i * 1.6, z = 1.5 + j * 1.6;
    const stub = add(new THREE.CylinderGeometry(0.15, 0.15, 0.7, 6), M.concrete, x, 0.35, z);
    stub.rotation.y = Math.PI / 6;
    add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 6), M.yellow, x, 0.71, z).rotation.y = Math.PI / 6;
  }

  /* Bate-estacas */
  const rig = new THREE.Group(); scene.add(rig);
  const RIG_Z = -3.2;
  for (const sx of [-1.5, 1.5]) {
    const track = add(box(0.9, 1.0, 5.4), M.rubber, sx, 0.5, RIG_Z, rig);
    track.geometry = new THREE.BoxGeometry(0.9, 1.0, 5.4, 1, 1, 12);
    for (let k = -2; k <= 2; k++) add(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 16).rotateZ(Math.PI / 2), M.darkSteel, sx, 0.5, RIG_Z + k * 1.1, rig);
  }
  add(box(2.4, 0.5, 3.6), M.darkSteel, 0, 1.15, RIG_Z, rig);
  const upper = new THREE.Group(); upper.position.set(0, 1.4, RIG_Z - 0.3); rig.add(upper);
  add(box(3.2, 1.6, 4.4), M.yellow, 0, 0.8, -0.2, upper);
  add(box(3.25, 0.18, 4.45), M.hazard, 0, 0.1, -0.2, upper);
  add(box(1.3, 1.5, 1.6), M.yellow, -0.9, 2.35, 1.1, upper);
  add(box(1.32, 0.9, 1.0), M.glass, -0.9, 2.5, 1.45, upper);
  add(box(3.0, 1.1, 1.0), M.darkSteel, 0, 0.55, -2.65, upper); // contrapeso
  add(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), M.darkSteel, 0.9, 2.1, -1.2, upper);

  // Torre-guia (leader) treliçada
  const LEAD_H = 19.5, LX = 0, LZ = -0.75;
  const leader = new THREE.Mesh(box(0.7, LEAD_H, 0.7), M.yellowLattice);
  leader.position.set(LX, LEAD_H / 2 + 0.6, LZ); leader.castShadow = true; scene.add(leader);
  for (const sx of [-0.33, 0.33]) for (const sz of [-0.33, 0.33]) add(box(0.08, LEAD_H, 0.08), M.yellow, LX + sx, LEAD_H / 2 + 0.6, LZ + sz);
  add(box(1.0, 0.6, 1.0), M.yellow, LX, LEAD_H + 0.9, LZ);
  add(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 20).rotateZ(Math.PI / 2), M.darkSteel, LX, LEAD_H + 1.25, LZ + 0.1);
  // estais e braço
  const strut = (a, b, r, mat) => {
    const v = new THREE.Vector3().subVectors(b, a), len = v.length();
    const m = add(new THREE.CylinderGeometry(r, r, len, 10), mat, 0, 0, 0);
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return m;
  };
  strut(new THREE.Vector3(0, 3.2, RIG_Z - 1.8), new THREE.Vector3(LX, 11.5, LZ - 0.3), 0.13, M.yellow);
  strut(new THREE.Vector3(0.5, 3.2, RIG_Z - 1.8), new THREE.Vector3(LX + 0.3, 11.5, LZ - 0.3), 0.06, M.yellow);
  strut(new THREE.Vector3(0, 2.4, RIG_Z + 1.6), new THREE.Vector3(LX, 1.2, LZ - 0.3), 0.14, M.darkSteel);
  const cable = strut(new THREE.Vector3(LX, LEAD_H + 1.2, LZ + 0.42), new THREE.Vector3(LX, 8, LZ + 0.42), 0.02, M.darkSteel);

  // Martelo e estaca em cravação (eixo vertical)
  const hammer = new THREE.Group(); scene.add(hammer);
  add(box(0.95, 2.6, 0.95), M.yellow, 0, 1.3, 0, hammer);
  add(box(0.97, 0.35, 0.97), M.hazard, 0, 1.7, 0, hammer);
  add(box(0.7, 0.4, 0.7), M.darkSteel, 0, -0.05, 0, hammer);
  add(box(0.4, 0.5, 0.25), M.darkSteel, 0, 1.3, -0.55, hammer);
  hammer.position.set(LX, 12, LZ + 0.42 + 0.55);
  const drivePile = add(new THREE.CylinderGeometry(0.165, 0.165, 10, 6), M.concrete, LX, 5, LZ + 0.97);
  drivePile.rotation.y = Math.PI / 6;
  const ring = add(new THREE.CylinderGeometry(0.185, 0.185, 0.12, 6), M.steel, 0, 0, 0, drivePile);
  ring.position.y = 4.95;

  /* Galpão de produção com pista de protensão */
  const shed = new THREE.Group(); shed.position.set(-36, 0, -24); scene.add(shed);
  const SW = 26, SD = 16, SH = 9;
  add(box(0.25, SH, SD), M.shed, -SW / 2, SH / 2, 0, shed);
  add(box(SW, SH, 0.25), M.shed, 0, SH / 2, -SD / 2, shed);
  for (let i = 0; i <= 6; i++) add(box(0.35, SH, 0.35), M.navy, -SW / 2 + i * SW / 6, SH / 2, SD / 2 - 0.2, shed);
  add(box(SW, 0.6, 0.4), M.navy, 0, SH - 0.3, SD / 2 - 0.2, shed);
  const roofA = add(box(SW + 1, 0.12, SD / 2 + 1.2), M.roof, 0, SH + 1.2, -SD / 4, shed); roofA.rotation.x = 0.27;
  const roofB = add(box(SW + 1, 0.12, SD / 2 + 1.2), M.roof, 0, SH + 1.2, SD / 4, shed); roofB.rotation.x = -0.27;
  add(box(SW + 1, 2.4, 0.12), M.shed, 0, SH + 0.9, SD / 2 + 0.25, shed).visible = false;
  // ponte rolante
  add(box(SW - 1, 0.5, 0.5), M.yellow, 0, SH - 1.6, 2, shed);

  // Pista de protensão (sai do galpão para o pátio)
  const bed = new THREE.Group(); bed.position.set(-34, 0, -12); scene.add(bed);
  const BL = 46;
  add(box(BL, 0.35, 5.2), M.slab, 0, 0.175, 0, bed);
  for (let k = 0; k < 4; k++) {
    const z = -1.8 + k * 1.2;
    add(box(BL - 2, 0.42, 0.06), M.steel, 0, 0.56, z - 0.24, bed);
    add(box(BL - 2, 0.42, 0.06), M.steel, 0, 0.56, z + 0.24, bed);
    add(box(BL - 2, 0.05, 0.54), M.steel, 0, 0.36, z, bed);
    if (k < 3) add(box(BL - 8, 0.3, 0.36), M.concrete, -2, 0.55, z, bed); // estaca concretada
    for (let s = 0; s < 6; s++) {
      const a = Math.PI / 3 * s;
      const st = add(new THREE.CylinderGeometry(0.008, 0.008, BL + 1, 4).rotateZ(Math.PI / 2), M.strand, 0, 0.58 + 0.11 * Math.sin(a), z + 0.11 * Math.cos(a), bed);
      st.castShadow = false;
    }
  }
  for (const sx of [-BL / 2 - 0.4, BL / 2 + 0.4]) { // cabeceiras de ancoragem
    add(box(0.8, 1.6, 5.6), M.navy, sx, 0.8, 0, bed);
    add(box(0.82, 0.25, 5.62), M.hazard, sx, 1.45, 0, bed);
  }

  /* Central de concreto: silos + torre de mistura */
  const plant = new THREE.Group(); plant.position.set(22, 0, -22); scene.add(plant);
  for (let i = 0; i < 3; i++) {
    const sx = i * 4.6;
    add(new THREE.CylinderGeometry(1.8, 1.8, 11, 36), M.yellow, sx, 4 + 5.5 + 2.2, 0, plant);
    add(new THREE.CylinderGeometry(1.8, 0.35, 2.2, 36), M.yellow, sx, 4 + 1.1, 0, plant);
    add(new THREE.CylinderGeometry(1.85, 1.85, 0.25, 36), M.darkSteel, sx, 17.3, 0, plant);
    add(new THREE.ConeGeometry(1.86, 0.7, 36), M.yellow, sx, 17.75, 0, plant);
    for (const a of [0.8, 2.4, 3.9, 5.5]) add(box(0.18, 4.2, 0.18), M.darkSteel, sx + Math.cos(a) * 1.4, 2.1, Math.sin(a) * 1.4, plant);
    for (let r = 0; r < 4; r++) add(new THREE.TorusGeometry(1.82, 0.04, 6, 40).rotateX(Math.PI / 2), M.darkSteel, sx, 7 + r * 2.6, 0, plant);
    add(box(0.5, 11, 0.06), M.darkSteel, sx + 1.86, 12, 0, plant);
  }
  const tower = new THREE.Group(); tower.position.set(13.8, 0, 3.2); plant.add(tower);
  add(box(5, 9, 4.2), M.shed, 0, 4.5, 0, tower);
  add(box(5.2, 0.4, 4.4), M.navy, 0, 9.2, 0, tower);
  add(box(5.05, 0.3, 4.25), M.hazard, 0, 3.0, 0, tower);
  const P0 = plant.position;
  strut(new THREE.Vector3(9.2, 16.5, 0).add(P0), new THREE.Vector3(13.2, 9.4, 2.6).add(P0), 0.22, M.steel);
  strut(new THREE.Vector3(4.6, 16.5, 0).add(P0), new THREE.Vector3(12.6, 9.4, 2.6).add(P0), 0.22, M.steel);
  // baia de agregados
  for (let i = 0; i < 3; i++) {
    const p = add(new THREE.ConeGeometry(2.4, 2.2, 24), new THREE.MeshStandardMaterial({ color: [0x9d968b, 0xb9a98a, 0x7d7a75][i], roughness: 1, map: T.dirt }), -3 + i * 5.2, 1.1, 9, plant);
    p.scale.z = 0.8;
  }
  for (let i = 0; i < 4; i++) add(box(0.4, 2, 5), M.slab, -5.6 + i * 5.2, 1, 9, plant);

  /* Caminhão com estacas */
  const truck = new THREE.Group(); truck.position.set(13, 0, 9); truck.rotation.y = -0.55; scene.add(truck);
  add(box(2.5, 0.35, 11.5), M.darkSteel, 0, 1.05, -1.2, truck);
  for (const sx of [-1.29, 1.29]) add(box(0.04, 0.9, 1.1), M.glass, sx, 3.0, 5.2, truck);
  add(box(2.55, 2.7, 2.3), M.navy, 0, 2.45, 4.9, truck);
  add(box(2.57, 1.0, 1.0), M.glass, 0, 2.95, 5.65, truck);
  add(box(2.6, 0.3, 0.2), M.yellow, 0, 3.75, 5.98, truck);
  add(box(2.5, 0.6, 9.2), M.navy, 0, 1.45, -2.3, truck);
  for (const sx of [-1.15, 1.15]) for (let k = 0; k < 4; k++) add(box(0.1, 1.2, 0.1), M.yellow, sx, 2.3, 0.6 - k * 2.6, truck);
  add(box(2.6, 0.1, 0.12), M.hazard, 0, 1.2, -6.95, truck);
  for (const wz of [4.5, -2.2, -3.6, -5.0]) for (const wx of [-1.15, 1.15]) add(new THREE.CylinderGeometry(0.52, 0.52, 0.42, 22).rotateZ(Math.PI / 2), M.rubber, wx, 0.52, wz, truck);
  // guindaste (munck)
  add(box(0.7, 1.5, 0.7), M.yellow, 0, 2.3, 3.2, truck);
  const arm = add(box(0.35, 0.35, 5.5), M.yellow, 0, 3.25, 1.0, truck); arm.rotation.x = 0.04;
  add(box(0.36, 0.5, 0.36), M.darkSteel, 0, 3.4, -1.7, truck);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6 - r; c++) {
    const lp = new THREE.Vector3((c - (5 - r) / 2) * 0.33, 1.95 + r * 0.3, -2.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), truck.rotation.y).add(truck.position);
    pile("circular", 0.26, 8, lp.x, lp.y, lp.z, truck.rotation.y);
  }

  /* Pontas das cordoalhas (instanciadas) */
  const sGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6).rotateX(Math.PI / 2);
  const sMesh = new THREE.InstancedMesh(sGeo, M.strand, strandEnds.length);
  const tmp = new THREE.Object3D();
  strandEnds.forEach((s, i) => { tmp.position.copy(s.p); tmp.rotation.set(0, s.rotY, 0); tmp.updateMatrix(); sMesh.setMatrixAt(i, tmp.matrix); });
  scene.add(sMesh);

  // Cercas/postes e iluminação do pátio
  for (let i = 0; i < 8; i++) {
    const x = -40 + i * 12;
    add(new THREE.CylinderGeometry(0.1, 0.14, 10, 8), M.darkSteel, x, 5, -40);
    add(box(1.2, 0.3, 0.5), M.darkSteel, x, 10, -39.8);
  }
  // Vegetação distante: linha de eucaliptos em silhueta (a névoa faz o resto)
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x34402f, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a443a, roughness: 1 });
  const rr = rng(21);
  for (let i = 0; i < 160; i++) {
    const a = rr() * Math.PI * 2, d = 78 + rr() * 40;
    const hgt = 9 + rr() * 9, x = Math.cos(a) * d, z = Math.sin(a) * d - 15;
    const tr = add(new THREE.CylinderGeometry(0.18, 0.3, hgt * 0.6, 5), trunkMat, x, hgt * 0.3, z); tr.castShadow = false;
    const cr = add(new THREE.SphereGeometry(2.2 + rr() * 1.6, 7, 5), treeMat, x, hgt * 0.75, z); cr.castShadow = false;
    cr.scale.set(1, 1.8 + rr(), 1);
  }
  // galpões vizinhos ao fundo
  for (const [x, z, w, h] of [[40, -52, 30, 11], [-5, -58, 22, 8], [-60, -44, 18, 9]]) {
    add(box(w, h, 14), M.shed, x, h / 2, z);
    add(box(w + 1, 0.4, 15), M.roof, x, h + 0.2, z);
  }

  /* Poeira do impacto */
  const DUST_N = 70;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST_N * 3), dVel = new Float32Array(DUST_N * 3), dLife = new Float32Array(DUST_N).fill(1);
  dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.PointsMaterial({ map: T.dust, size: 0.9, transparent: true, depthWrite: false, opacity: 0.0, sizeAttenuation: true });
  const dust = new THREE.Points(dGeo, dMat); scene.add(dust);
  let dustT = 9;
  function puff(x, z, strength) {
    const r = rng((Math.random() * 1e9) | 0);
    for (let i = 0; i < DUST_N; i++) {
      dPos[i * 3] = x + (r() - .5) * 0.4; dPos[i * 3 + 1] = 0.1; dPos[i * 3 + 2] = z + (r() - .5) * 0.4;
      const a = r() * Math.PI * 2, v = (0.6 + r() * 1.6) * strength;
      dVel[i * 3] = Math.cos(a) * v; dVel[i * 3 + 1] = 0.3 + r() * 1.1 * strength; dVel[i * 3 + 2] = Math.sin(a) * v;
    }
    dustT = 0; dGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- Simulação da cravação ---------- */
  const PILE_LEN = 10, MAX_DEPTH = 8.2;
  const state = { depth: 0, blows: 0, phase: 0, period: 1.25, shake: 0 };
  const penAt = d => (d < 2 ? 0.07 : d < 5 ? 0.05 : d < 7 ? 0.025 : 0.012);
  let onBlow = opts.onBlow || null;
  let pendingManual = 0;

  function strike(manual) {
    const p = penAt(state.depth) * (manual ? 2.2 : 1);
    state.depth = Math.min(MAX_DEPTH, state.depth + p);
    state.blows++;
    state.shake = manual ? 0.12 : 0.04;
    puff(LX, LZ + 0.97, manual ? 1.6 : 0.8);
    if (onBlow) onBlow({ depth: state.depth, blows: state.blows, nega: penAt(state.depth) * 10 * 1000, manual });
    if (state.depth >= MAX_DEPTH) setTimeout(() => { state.depth = 0; state.blows = 0; if (onBlow) onBlow({ depth: 0, blows: 0, nega: null, reset: true }); }, 2200);
  }

  function placeDrive(lift) {
    const top = PILE_LEN - state.depth;
    drivePile.position.y = top - PILE_LEN / 2;
    hammer.position.y = top + 0.25 + lift;
    const c = cable.geometry; // o cabo acompanha o martelo
    const len = LEAD_H + 1.2 - (hammer.position.y + 2.6);
    cable.scale.y = Math.max(0.05, len / (LEAD_H + 1.2 - 8));
    cable.position.y = hammer.position.y + 2.6 + len / 2;
    void c;
  }

  /* ---------- Câmeras ---------- */
  const SHOTS = {
    hero:      { pos: [-8.5, 3.4, 21], look: [-4.2, 5.4, -2], fov: 38 },
    heroWide:  { pos: [-15, 7, 34], look: [-6, 6.5, -4], fov: 34 },
    estacas:   { pos: [-6.6, 1.15, 9.6], look: [-9.6, 1.0, 7.4], fov: 32 },
    fundacao:  { pos: [7, 9.5, 21], look: [1.5, 3.2, -2], fov: 36 },
    central:   { pos: [11, 1.6, -3], look: [27, 10, -22], fov: 42 },
    protensao: { pos: [-9, 3.4, -7.5], look: [-30, 0.4, -12.2], fov: 40 },
    logistica: { pos: [22, 6.5, 24], look: [12.5, 1.6, 8], fov: 36 },
    aerea:     { pos: [42, 30, 40], look: [-6, 0, -10], fov: 38, fog: [80, 260] },
    pilha:     { pos: [-1.5, 2.6, 13], look: [-11, 1.4, 2], fov: 30 },
  };
  const look = new THREE.Vector3();
  function setShot(name) {
    const s = SHOTS[name] || SHOTS.hero;
    camera.position.set(...s.pos); look.set(...s.look); camera.fov = s.fov; camera.lookAt(look);
    scene.fog.near = s.fog ? s.fog[0] : 38; scene.fog.far = s.fog ? s.fog[1] : 150;
    camera.updateProjectionMatrix();
    current = s;
  }
  let current = SHOTS.hero;

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // em telas estreitas, recua a câmera para manter o bate-estacas no quadro
    camera.fov = current.fov * (w / h < 1 ? 1.45 : 1);
    camera.updateProjectionMatrix();
  }

  /* ---------- Loop ---------- */
  const clock = new THREE.Clock();
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false, raf = 0, tAll = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    tAll += dt;
    // ciclo do martelo: sobe devagar, cai rápido
    state.phase += dt / state.period;
    if (pendingManual === 1) { pendingManual = 2; state.phase = Math.max(state.phase, 0.86); }
    if (state.phase >= 1) { state.phase -= 1; strike(pendingManual === 2); pendingManual = 0; }
    const ph = state.phase;
    const lift = ph < 0.86 ? 1.3 * Math.sin((ph / 0.86) * Math.PI / 2) : 1.3 * (1 - Math.pow((ph - 0.86) / 0.14, 2));
    placeDrive(Math.max(0, lift));

    // poeira
    if (dustT < 3) {
      dustT += dt;
      for (let i = 0; i < DUST_N; i++) {
        dPos[i * 3] += dVel[i * 3] * dt; dPos[i * 3 + 1] += dVel[i * 3 + 1] * dt; dPos[i * 3 + 2] += dVel[i * 3 + 2] * dt;
        dVel[i * 3] *= 0.96; dVel[i * 3 + 2] *= 0.96; dVel[i * 3 + 1] *= 0.97;
      }
      dGeo.attributes.position.needsUpdate = true;
      dMat.opacity = Math.max(0, 0.55 * (1 - dustT / 2.4));
      dMat.size = 0.7 + dustT * 0.9;
    }

    // câmera: deriva lenta + paralaxe do ponteiro + tremor do impacto
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    const s = current;
    state.shake *= 0.86;
    camera.position.set(
      s.pos[0] + Math.sin(tAll * 0.12) * 1.2 + pointer.x * 2.2 + (Math.random() - .5) * state.shake,
      s.pos[1] + pointer.y * 1.1 + (Math.random() - .5) * state.shake,
      s.pos[2] + Math.cos(tAll * 0.1) * 0.8
    );
    camera.lookAt(look);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  setShot(opts.shot || "hero");
  placeDrive(0.6);

  return {
    renderer, scene, camera, setShot, resize,
    renderStill(name, w, h, depth) {
      setShot(name);
      if (depth != null) state.depth = depth;
      placeDrive(name === "fundacao" ? 1.1 : 0.9);
      resize(w, h);
      camera.lookAt(look);
      renderer.render(scene, camera);
    },
    start() { if (!running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    pointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; },
    strikeNow() { pendingManual = 1; },
    set onBlow(fn) { onBlow = fn; },
    state,
  };
}
