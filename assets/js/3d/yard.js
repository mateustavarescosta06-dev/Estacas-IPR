/* IPR Estacas — maquete 3D detalhada do pátio da fábrica.
   Monta a cena, a iluminação de fim de tarde, o pós-processamento e as câmeras.
   Usada ao vivo na capa (hero3d.js) e para exportar imagens (tools/render.html). */
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { makeTextures, stencilTexture, rng } from "./tex.js";
import {
  Builder, box, rbox, cyl, sph, tor, pileGeometry, strandOffsets, person, pileDriver, hammerParts, RIG,
  truck, cone, barrier, lightTower, office, spool, pallet, coil,
} from "./kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* Gradação final: vinheta, granulação e leve separação quente/fria */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.035 }, vignette: { value: 0.32 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vignette; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.299,.587,.114));
      c = mix(c, c * vec3(1.04, 1.0, .94), smoothstep(.45, 1., l));      // altas quentes
      c = mix(c, c * vec3(.92, .98, 1.08), 1. - smoothstep(0., .35, l)); // sombras frias
      vec2 d = vUv - .5; c *= 1. - vignette * dot(d, d) * 2.2;
      c += (h(vUv * 1000.) - .5) * grain;
      gl_FragColor = vec4(c, 1.);
    }`,
};

export function createYard(canvas, opts = {}) {
  const live = !!opts.live;
  const q = opts.quality ?? (live ? 0.6 : 1);   // 1 = máximo (renders), < 1 = tempo real
  const post = opts.post ?? true;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !post, preserveDrawingBuffer: !live, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.pixelRatio || 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.74;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const T = makeTextures(q >= 1 ? 1 : 0.5);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.08, 3000);

  /* ---------- Céu físico, sol e ambiente ---------- */
  const sky = new Sky();
  sky.scale.setScalar(4000);
  const su = sky.material.uniforms;
  su.turbidity.value = 7.5; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 13), THREE.MathUtils.degToRad(-72));
  su.sunPosition.value.copy(sunDir);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(1000);
  Object.keys(su).forEach(k => sky2.material.uniforms[k].value = su[k].value);
  envScene.add(sky2);
  const groundDisc = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4a3f33 }));
  groundDisc.position.y = -2; envScene.add(groundDisc);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.FogExp2(0xc4a888, 0.0062);

  const sun = new THREE.DirectionalLight(0xffc790, 3.6);
  sun.position.copy(sunDir).multiplyScalar(120);
  sun.castShadow = true;
  const SM = q >= 1 ? 4096 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xa9bdd6, 0x5a4a3a, 0.35));

  /* Nuvens: cartões grandes no alto, sem névoa */
  const cloudMat = new THREE.MeshBasicMaterial({ map: T.cloud, transparent: true, depthWrite: false, fog: false, color: 0xffe2c4, opacity: 0.8 });
  const cr = rng(99);
  for (let i = 0; i < 16; i++) {
    const a = -1.4 + cr() * 3.6, d = 700 + cr() * 600, s = 260 + cr() * 340;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.32), cloudMat);
    m.position.set(Math.cos(a) * d, 120 + cr() * 180, Math.sin(a) * d * -1);
    m.lookAt(0, m.position.y * 0.6, 0);
    m.renderOrder = -1;
    scene.add(m);
  }

  /* ---------- Materiais ---------- */
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const tx = (t, rep) => { const c = t.clone(); c.repeat.set(rep[0], rep[1]); c.needsUpdate = true; return c; };
  const pbr = (set, extra = {}, rep = [1, 1], ns = 1) => std({
    map: tx(set.map, rep), roughnessMap: tx(set.roughnessMap, rep), normalMap: tx(set.normalMap, rep),
    normalScale: new THREE.Vector2(ns, ns), roughness: 1, ...extra,
  });
  const M = {
    concrete: pbr(T.concrete, { color: 0xf3f1ee, envMapIntensity: 0.6 }, [1, 1], 1.6),
    concreteFresh: pbr(T.slab, { color: 0x8f8a82, roughness: 0.7 }, [6, 1]),
    slab: pbr(T.slab, {}, [1, 1], 0.6),
    yellowP: pbr(T.yellow, { metalness: 0.35 }, [1, 1], 0.5),
    navyP: pbr(T.navy, { metalness: 0.4 }, [1, 1], 0.5),
    whiteP: pbr(T.white, { metalness: 0.2 }, [1, 1], 0.4),
    orangeP: pbr(T.orange, { metalness: 0.2 }),
    darkPaint: std({ color: 0x23272d, roughness: 0.55, metalness: 0.45 }),
    steelM: pbr(T.steel, { metalness: 0.85 }, [1, 1], 0.5),
    chrome: std({ color: 0xd8dde2, roughness: 0.12, metalness: 1 }),
    strand: std({ color: 0xa7b0b8, roughness: 0.28, metalness: 1 }),
    ringSteel: pbr(T.steel, { metalness: 0.9, color: 0xb8a28a }, [1, 1], 0.6),
    cable: std({ color: 0x2b2d30, roughness: 0.5, metalness: 0.7 }),
    hose: std({ color: 0x151617, roughness: 0.7 }),
    trackShoe: std({ color: 0x2d2f33, roughness: 0.62, metalness: 0.7 }),
    tire: pbr(T.rubber, { color: 0x9a9a9a }, [1, 1], 1),
    rim: std({ color: 0xc9ccd0, roughness: 0.3, metalness: 0.9 }),
    glassM: new THREE.MeshPhysicalMaterial({ color: 0x0e1822, roughness: 0.04, metalness: 0.1, clearcoat: 1, reflectivity: 0.9 }),
    grille: std({ color: 0x0c0d0f, roughness: 0.5, metalness: 0.6 }),
    headlight: std({ color: 0xf3f0e6, emissive: 0xfff3d6, emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.4 }),
    indicator: std({ color: 0xf28c1a, emissive: 0xf28c1a, emissiveIntensity: 0.15, roughness: 0.2 }),
    tailLight: std({ color: 0xb01818, emissive: 0x900, emissiveIntensity: 0.2, roughness: 0.2 }),
    beacon: std({ color: 0xff8a00, emissive: 0xff7a00, emissiveIntensity: 1.6, roughness: 0.2 }),
    lamp: std({ color: 0xfff6dc, emissive: 0xfff1c9, emissiveIntensity: 0.5 }),
    seat: std({ color: 0x1d1f22, roughness: 0.8 }),
    hazard: std({ map: (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#f2b400"; x.fillRect(0, 0, 256, 64); x.fillStyle = "#15171a"; for (let i = -64; i < 320; i += 48) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 24, 64); x.lineTo(i + 88, 0); x.lineTo(i + 64, 0); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })(), roughness: 0.5, metalness: 0.3 }),
    corrugated: pbr(T.corrugated, { metalness: 0.65, side: THREE.DoubleSide }, [1, 1], 1),
    roofSheet: pbr(T.corrugated, { metalness: 0.7, color: 0xc4ccd4, side: THREE.DoubleSide }, [1, 1], 1),
    skylight: std({ color: 0xe9eef2, roughness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    woodM: pbr(T.wood, {}, [1, 1], 0.8),
    gravel: pbr(T.gravel, {}, [60, 60], 1.3),
    dirt: pbr(T.dirt, {}, [3, 30], 1),
    grass: pbr(T.grass, {}, [90, 90], 1),
    aggregate: [pbr(T.gravel, { color: 0xb3aca3 }, [3, 3], 1.6), pbr(T.gravel, { color: 0xd8c3a0 }, [3, 3], 1.2), pbr(T.gravel, { color: 0x8e8a86 }, [3, 3], 1.8)],
    puddle: new THREE.MeshPhysicalMaterial({ color: 0x2a2620, roughness: 0.04, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.92 }),
    skin: [0x8d5a3b, 0xc68863, 0x6b4127, 0xe0ac86, 0xa86f4c].map(c => std({ color: c, roughness: 0.6 })),
    vestOrange: std({ color: 0xff6a13, roughness: 0.65, emissive: 0x401400, emissiveIntensity: 0.4 }),
    vestLime: std({ color: 0xc8f02a, roughness: 0.65, emissive: 0x2a3300, emissiveIntensity: 0.4 }),
    reflective: std({ color: 0xdfe3e6, roughness: 0.25, metalness: 0.8 }),
    helmetWhite: std({ color: 0xf2f2ee, roughness: 0.3 }),
    helmetYellow: std({ color: 0xf6c300, roughness: 0.3 }),
    pantsNavy: std({ color: 0x1d2b40, roughness: 0.85 }),
    pantsKhaki: std({ color: 0x7a6a4f, roughness: 0.9 }),
    shirt: std({ color: 0x2e4d6d, roughness: 0.85 }),
    boot: std({ color: 0x3b2a1d, roughness: 0.75 }),
    glove: std({ color: 0xd9c38a, roughness: 0.9 }),
    glasses: std({ color: 0x111111, roughness: 0.1, metalness: 0.5 }),
    clipboard: std({ color: 0xece6d6, roughness: 0.8 }),
    coneOrange: std({ color: 0xff5a14, roughness: 0.5 }),
    coneBase: std({ color: 0x141414, roughness: 0.8 }),
    barrierWhite: std({ color: 0xeeeeea, roughness: 0.5 }),
    barrierRed: std({ color: 0xc81e1e, roughness: 0.5 }),
    sign: std({ color: 0x0f2c52, roughness: 0.5 }),
    tree: [0x3e4a2f, 0x4b5634, 0x56603a, 0x3a4530].map(c => std({ color: c, roughness: 1 })),
    trunk: std({ color: 0xb8ab97, roughness: 1 }),
    fence: std({ color: 0x8a9096, metalness: 0.8, roughness: 0.4, alphaMap: tx(T.fence, [40, 2.4]), alphaTest: 0.5, side: THREE.DoubleSide }),
  };
  M.yellow = M.yellowP;

  const b = new Builder();

  /* ---------- Terreno ---------- */
  const terrainGeo = new THREE.PlaneGeometry(1400, 1400, 160, 160).rotateX(-Math.PI / 2);
  { const p = terrainGeo.attributes.position, r = rng(4);
    const hill = (x, z) => Math.sin(x * 0.006 + 1.3) * Math.cos(z * 0.0045) * 9 + Math.sin(x * 0.017 + z * 0.011) * 3;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z + 10);
      const k = THREE.MathUtils.smoothstep(d, 75, 200);
      p.setY(i, (hill(x, z) + 6) * k + (r() - 0.5) * 0.04 * k - 0.04);
    }
    terrainGeo.computeVertexNormals(); }
  const terrain = new THREE.Mesh(terrainGeo, M.grass); terrain.receiveShadow = true; scene.add(terrain);
  const yardGround = new THREE.Mesh(new THREE.PlaneGeometry(140, 110).rotateX(-Math.PI / 2), M.gravel);
  yardGround.position.set(-4, 0.004, -10); yardGround.receiveShadow = true; scene.add(yardGround);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(130, 7.5).rotateX(-Math.PI / 2), M.dirt);
  road.material.map.repeat.set(30, 2); road.material.normalMap.repeat.set(30, 2); road.material.roughnessMap.repeat.set(30, 2);
  road.position.set(-2, 0.012, 13.5); road.receiveShadow = true; scene.add(road);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(62, 26).rotateX(-Math.PI / 2), M.slab);
  pad.material.map.repeat.set(10, 4); pad.position.set(-32, 0.016, -24); pad.receiveShadow = true; scene.add(pad);
  for (const [x, z, sx, sz, r] of [[4.2, 9.2, 2.4, 1.2, 0.3], [-6.5, 12.8, 3.2, 1.0, -0.2], [16, 2.5, 1.6, 0.9, 1], [-14, -8, 2.2, 1.3, 0.6]]) {
    const pd = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), M.puddle);
    pd.scale.set(sx, 1, sz); pd.rotation.y = r; pd.position.set(x, 0.022, z); pd.receiveShadow = true; scene.add(pd);
  }

  /* ---------- Estacas instanciadas (pilhas, caminhão, cravadas) ---------- */
  const piles = [];   // {forma,d,len,pos:Vector3,rot:Euler,label?}
  const P = (forma, d, len, x, y, z, ry = 0, rx = 0) => piles.push({ forma, d, len, pos: V(x, y, z), rot: new THREE.Euler(rx, ry, 0, "YXZ") });

  function stack(forma, d, len, cx, cz, perLayer, layers, ry = 0, labelEvery = 0) {
    const gap = 0.06, sl = 0.12;
    const hh = forma === "hexagonal" ? d * 0.866 : d;
    const rot = new THREE.Matrix4().makeRotationY(ry);
    let y = sl;
    b.at(cx, 0, cz, ry, () => {
      for (let L = 0; L < layers; L++) {
        const n = perLayer - (L === layers - 1 ? 2 : 0) - (L === layers - 2 && layers > 4 ? 1 : 0);
        for (const zz of [-len * 0.38, 0, len * 0.38]) b.add(rbox(perLayer * (d + gap) + 0.32, sl, 0.15, 0.015), M.woodM, 0, y - sl / 2, zz, 0, 0, 0, 1, 1, 1);
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * (d + gap);
          const w = V(x, y + hh / 2, 0).applyMatrix4(rot).add(V(cx, 0, cz));
          const jitter = (Math.sin(i * 12.9 + L * 7.1) * 0.5) * 0.03;
          piles.push({ forma, d, len, pos: w.add(V(0, 0, 0)).add(new THREE.Vector3(0, 0, jitter).applyMatrix4(rot)), rot: new THREE.Euler(0, ry, forma === "hexagonal" ? 0 : 0, "YXZ"), label: labelEvery && L < 3 && i % labelEvery === 1 });
        }
        y += hh + sl;
      }
    });
  }
  stack("hexagonal", 0.33, 10, -9, 3, 10, 6, 0, 3);
  stack("hexagonal", 0.28, 10, -14.8, 2.6, 11, 5, 0);
  stack("circular", 0.3, 10, -20.4, 2.8, 10, 5, 0);
  stack("circular", 0.26, 8, 8.5, -7, 11, 4, Math.PI / 2);
  stack("quadrada", 0.3, 10, -9.4, -10.5, 9, 4, 0.04);
  stack("hexagonal", 0.21, 8, 9.2, -14.6, 13, 6, Math.PI / 2);
  stack("circular", 0.23, 10, -26.4, -3, 11, 4, 0.1);
  stack("circular", 0.2, 6, -3.6, -12.5, 12, 5, 0.2);

  // carga do caminhão
  const TR = { x: 14, z: 9, ry: -0.55 };
  const trRot = new THREE.Matrix4().makeRotationY(TR.ry);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7 - r; c++) {
    const w = V((c - (6 - r) / 2) * 0.27, 1.62 + r * 0.235, -1.9).applyMatrix4(trRot).add(V(TR.x, 0, TR.z));
    piles.push({ forma: "circular", d: 0.26, len: 8, pos: w, rot: new THREE.Euler(0, TR.ry, 0, "YXZ") });
  }
  // cintas de amarração sobre a carga
  b.at(TR.x, 0, TR.z, TR.ry, () => {
    for (const zz of [-4.8, -1.9, 1.0]) {
      const pts = [V(-1.22, 1.45, zz), V(-1.0, 2.35, zz), V(-0.4, 2.6, zz), V(0.4, 2.6, zz), V(1.0, 2.35, zz), V(1.22, 1.45, zz)];
      b.tube(pts, 0.012, M.orangeP, 24);
      b.add(rbox(0.1, 0.16, 0.08, 0.02), M.steelM, 1.22, 1.6, zz);
    }
  });

  // estacas cravadas com cabeça arrasada + piquetes de locação
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const x = 2.8 + i * 1.6, z = 1.4 + j * 1.6;
    if (i === 4 && j > 1) { // piquete com fita
      b.add(box(0.04, 0.5, 0.04), M.woodM, x, 0.25, z);
      b.add(box(0.06, 0.12, 0.004), M.coneOrange, x + 0.03, 0.42, z);
      continue;
    }
    P("hexagonal", 0.33, 0.9, x, 0.25, z, 0, -Math.PI / 2);
  }
  for (const [x, z] of [[-2.4, 1.6], [-2.4, 3.2], [-4.0, 1.6], [-4.0, 3.2]]) { b.add(box(0.04, 0.5, 0.04), M.woodM, x, 0.25, z); b.add(box(0.06, 0.12, 0.004), M.coneOrange, x + 0.03, 0.42, z); }

  /* ---------- Bate-estacas ---------- */
  pileDriver(b, M);
  const hb = new Builder(); hammerParts(hb, M);
  const hammer = hb.build("martelo"); scene.add(hammer);
  const drivePile = new THREE.Mesh(pileGeometry("hexagonal", 0.33, 10), M.concrete);
  drivePile.rotation.x = -Math.PI / 2; drivePile.castShadow = drivePile.receiveShadow = true; scene.add(drivePile);
  const driveRing = new THREE.Mesh(pileGeometry("hexagonal", 0.345, 0.08), M.ringSteel);
  driveRing.rotation.x = -Math.PI / 2; driveRing.castShadow = true; scene.add(driveRing);
  const cableMat = M.cable;
  const cables = [-0.18, 0.18].map(sx => { const c = new THREE.Mesh(cyl(0.016, 0.016, 1, 6), cableMat); c.castShadow = true; c.userData.sx = sx; scene.add(c); return c; });
  const PZ = 0.12;

  /* ---------- Operários ---------- */
  person(b, M, 0.95, 1.05, -2.2, { pose: "measure", seed: 3 });        // medindo a nega
  person(b, M, -3.6, 6.6, 2.6, { pose: "signal", seed: 8 });           // sinaleiro
  person(b, M, 3.3, 5.6, -2.4, { pose: "clipboard", seed: 11, helmet: M.helmetWhite });
  person(b, M, 12.2, 4.9, 0.4, { pose: "point", seed: 15 });           // junto ao caminhão
  person(b, M, 15.6, 6.3, -1.2, { pose: "stand", seed: 21 });
  person(b, M, -12.2, 9.6, 2.6, { pose: "clipboard", seed: 27 });      // inspeção da pilha
  person(b, M, -16.8, 9.0, 0.3, { pose: "walk", seed: 33 });
  person(b, M, -18.5, -18.2, 1.4, { pose: "crouch", seed: 41 });       // pista de protensão
  person(b, M, -21.0, -17.6, 2.0, { pose: "stand", seed: 44 });
  person(b, M, 22.5, -12.5, -0.6, { pose: "walk", seed: 52 });          // central

  /* ---------- Caminhão, acessórios ---------- */
  truck(b, M, TR.x, TR.z, TR.ry);
  for (let k = 0; k < 6; k++) cone(b, M, 1.5 + k * 1.9, 10.2);
  for (let k = 0; k < 4; k++) cone(b, M, -10 + k * 2.2, 16.8);
  barrier(b, M, -12, -15.6, 0.05); barrier(b, M, -9.9, -15.5, 0.05); barrier(b, M, 4.5, 16.6, -0.1);
  lightTower(b, M, -1.5, -17.5, 0.3);
  lightTower(b, M, -24, -9.5, 0.6);
  office(b, M, -31, 11.5, 0.55);
  office(b, M, -31.8, 14.4, 0.55);
  spool(b, M, -16.5, -12.5, 0.4); spool(b, M, -15.0, -13.3, 0.2);
  coil(b, M, -18.6, -11.4); coil(b, M, -19.9, -12.6); coil(b, M, -18.2, -13.1);
  for (let k = 0; k < 4; k++) pallet(b, M, -22 + k * 1.4, -11.8, 0.1 * k);
  // cerca do pátio
  b.add(new THREE.PlaneGeometry(140, 2.2), M.fence, -4, 1.1, -64);
  for (let k = 0; k < 29; k++) b.add(cyl(0.04, 0.04, 2.3, 8), M.steelM, -74 + k * 5, 1.15, -64);

  /* ---------- Galpão de produção (estrutura metálica treliçada) ---------- */
  const SH = { x: -38, z: -26, w: 34, d: 20, h: 9 };
  b.at(SH.x, 0, SH.z, 0, () => {
    const nF = 7, dx = SH.w / (nF - 1);
    for (let i = 0; i < nF; i++) {
      const x = -SH.w / 2 + i * dx;
      for (const zz of [-SH.d / 2, SH.d / 2]) {           // pilares perfil I
        b.add(box(0.3, SH.h, 0.12), M.navyP, x, SH.h / 2, zz);
        b.add(box(0.03, SH.h, 0.36), M.navyP, x, SH.h / 2, zz);
        b.add(rbox(0.6, 0.4, 0.6, 0.03), M.slab, x, 0.2, zz);
      }
      // tesoura (treliça) do telhado
      const ridge = 2.6, half = SH.d / 2, nP = 10;
      const top = (t) => V(x, SH.h + ridge * (1 - Math.abs(t)), t * half);
      for (let k = 0; k < nP; k++) {
        const t0 = -1 + k * 2 / nP, t1 = -1 + (k + 1) * 2 / nP;
        b.rod(top(t0), top(t1), 0.07, M.navyP, 6);
        b.rod(V(x, SH.h, t0 * half), V(x, SH.h, t1 * half), 0.06, M.navyP, 6);
        b.rod(V(x, SH.h, t0 * half), top(t1), 0.035, M.navyP, 6);
        b.rod(V(x, SH.h, t1 * half), top(t1), 0.035, M.navyP, 6);
      }
    }
    // terças e telhas com faixas translúcidas
    const ridge = 2.6, half = SH.d / 2, slope = Math.atan2(ridge, half), L = Math.hypot(ridge, half);
    for (const s of [-1, 1]) {
      for (let k = 0; k <= 8; k++) { const t = k / 8; b.add(box(SH.w, 0.12, 0.08), M.steelM, 0, SH.h + ridge * t + 0.1, s * half * (1 - t)); }
      const nS = 12, sw = SH.w / nS;
      for (let k = 0; k < nS; k++) {
        const mat = k % 4 === 2 ? M.skylight : M.roofSheet;
        b.add(box(sw - 0.02, 0.04, L + 0.6), mat, -SH.w / 2 + sw * (k + 0.5), SH.h + ridge / 2 + 0.2, s * half / 2, s * slope);
      }
    }
    b.add(box(SH.w + 0.4, 0.3, 0.5), M.steelM, 0, SH.h + ridge + 0.25, 0);
    // fechamentos: fundo e laterais em chapa, frente aberta com platibanda
    b.add(box(SH.w, SH.h - 1.2, 0.05), M.corrugated, 0, (SH.h - 1.2) / 2 + 1.2, -SH.d / 2 - 0.1);
    b.add(box(SH.w, 1.2, 0.2), M.slab, 0, 0.6, -SH.d / 2 - 0.1);
    for (const sx of [-1, 1]) { b.add(box(0.05, SH.h - 1.2, SH.d * 0.6), M.corrugated, sx * (SH.w / 2 + 0.1), (SH.h - 1.2) / 2 + 1.2, -SH.d * 0.2); b.add(box(0.2, 1.2, SH.d), M.slab, sx * (SH.w / 2 + 0.1), 0.6, 0); }
    b.add(box(SH.w, 1.4, 0.05), M.corrugated, 0, SH.h - 0.4, SH.d / 2 + 0.15);
    b.add(rbox(7.5, 1.1, 0.12, 0.03), M.navyP, -8, SH.h - 0.4, SH.d / 2 + 0.22);
    // ponte rolante interna
    for (const zz of [-SH.d / 2 + 0.6, SH.d / 2 - 0.6]) b.add(box(SH.w - 1, 0.4, 0.3), M.yellowP, 0, SH.h - 1.8, zz);
    b.add(box(0.6, 0.7, SH.d - 1.2), M.yellowP, 6, SH.h - 1.35, 0);
    b.add(rbox(1.2, 0.6, 1.0, 0.05), M.darkPaint, 6, SH.h - 2.0, 2);
    b.rod(V(6, SH.h - 2.3, 2), V(6, 3.2, 2), 0.02, M.cable);
    b.add(rbox(0.4, 0.5, 0.25, 0.04), M.yellowP, 6, 3.0, 2);
    // luminárias
    for (let i = 0; i < 5; i++) for (const zz of [-5, 5]) { b.rod(V(-14 + i * 7, SH.h, zz), V(-14 + i * 7, SH.h - 1, zz), 0.01, M.cable); b.add(cyl(0.18, 0.32, 0.25, 18), M.darkPaint, -14 + i * 7, SH.h - 1.1, zz); b.add(cyl(0.3, 0.3, 0.02, 18), M.lamp, -14 + i * 7, SH.h - 1.23, zz); }
  });

  /* ---------- Pista de protensão (dentro e fora do galpão) ---------- */
  const BED = { x0: -55, x1: -6, z: -22, lanes: 6 };
  const BL = BED.x1 - BED.x0, bx = (BED.x0 + BED.x1) / 2;
  b.add(box(BL, 0.3, 6.8), M.slab, bx, 0.15, BED.z);
  const stirrups = [], strandsList = [];
  for (let k = 0; k < BED.lanes; k++) {
    const z = BED.z - 2.6 + k * 1.04;
    // fôrma metálica hexagonal aberta (fundo e abas inclinadas)
    b.add(box(BL - 3, 0.04, 0.2), M.steelM, bx, 0.33, z);
    for (const s of [-1, 1]) {
      b.add(box(BL - 3, 0.2, 0.025), M.steelM, bx, 0.43, z + s * 0.15, s * 0.52);
      b.add(box(BL - 3, 0.04, 0.12), M.steelM, bx, 0.56, z + s * 0.27);
    }
    for (let j = 0; j < 24; j++) b.add(box(0.06, 0.24, 0.62), M.darkPaint, BED.x0 + 2 + j * (BL - 4) / 23, 0.42, z);
    const state = ["concreto", "concreto", "armado", "armado", "cordoalha", "vazio"][k];
    if (state === "concreto") b.add(pileGeometry("hexagonal", 0.33, BL - 4), M.concreteFresh, bx, 0.47, z, 0, Math.PI / 2, Math.PI / 6);
    if (state !== "vazio") {
      for (const [ox, oy] of strandOffsets("hexagonal", 0.33)) strandsList.push(V(0, 0.47 + oy, z + ox));
      if (state === "armado") for (let s = BED.x0 + 2; s < BED.x1 - 2; s += 0.22) stirrups.push(V(s, 0.47, z));
    }
  }
  // cabeceiras de ancoragem com placas, cunhas e macaco hidráulico
  for (const [sx, dir] of [[BED.x0 + 0.2, -1], [BED.x1 - 0.2, 1]]) {
    b.add(rbox(1.4, 1.6, 7.0, 0.06), M.slab, sx + dir * 0.7, 0.8, BED.z);
    b.add(box(0.06, 1.0, 6.4), M.steelM, sx, 0.75, BED.z);
    b.add(rbox(0.3, 0.3, 6.8, 0.03), M.hazard, sx + dir * 0.7, 1.75, BED.z);
    for (const p of strandsList) if (Math.abs(p.z - BED.z) < 3.4) b.add(cyl(0.022, 0.03, 0.08, 10), M.chrome, sx - dir * 0.06, p.y, p.z, 0, 0, Math.PI / 2);
  }
  b.add(cyl(0.16, 0.16, 0.7, 18), M.yellowP, BED.x1 + 0.3, 0.8, BED.z + 1.6, 0, 0, Math.PI / 2);
  b.add(cyl(0.06, 0.06, 0.4, 10), M.chrome, BED.x1 - 0.2, 0.8, BED.z + 1.6, 0, 0, Math.PI / 2);
  b.tube([V(BED.x1 + 0.6, 0.8, BED.z + 1.6), V(BED.x1 + 1.4, 0.2, BED.z + 2.4), V(BED.x1 + 2.6, 0.05, BED.z + 3.5), V(BED.x1 + 3.2, 0.4, BED.z + 4.2)], 0.025, M.hose);
  b.add(rbox(0.7, 0.8, 0.5, 0.05), M.yellowP, BED.x1 + 3.3, 0.4, BED.z + 4.4);
  const strandMesh = new THREE.InstancedMesh(cyl(0.0065, 0.0065, BL - 0.6, 5), M.strand, strandsList.length);
  strandsList.forEach((p, i) => { const m = new THREE.Matrix4().compose(V(bx, p.y, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), V(1, 1, 1)); strandMesh.setMatrixAt(i, m); });
  strandMesh.castShadow = true; scene.add(strandMesh);
  const stirMesh = new THREE.InstancedMesh(tor(0.12, 0.0045, 4, 12), M.strand, stirrups.length);
  stirrups.forEach((p, i) => { const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), V(1, 1, 1)); stirMesh.setMatrixAt(i, m); });
  stirMesh.castShadow = true; scene.add(stirMesh);

  // pórtico rolante sobre a pista, içando uma estaca
  b.at(-14, 0, BED.z, 0, () => {
    for (const zz of [-4.6, 4.6]) {
      b.add(box(2.6, 0.12, 0.25), M.steelM, 0, 0.06, zz);
      for (const sx of [-1, 1]) { b.rod(V(sx * 1.1, 0.4, zz), V(sx * 0.3, 7.6, zz), 0.16, M.yellowP, 12); b.add(cyl(0.22, 0.22, 0.22, 16), M.darkPaint, sx * 1.1, 0.26, zz, 0, 0, Math.PI / 2); }
      b.add(rbox(2.6, 0.5, 0.6, 0.04), M.yellowP, 0, 0.45, zz);
      b.rod(V(-0.9, 2.5, zz), V(0.9, 2.5, zz), 0.07, M.yellowP);
    }
    b.add(rbox(1.0, 0.9, 10.2, 0.05), M.yellowP, 0, 8.0, 0);
    b.add(rbox(1.04, 0.2, 10.24, 0.03), M.hazard, 0, 7.5, 0);
    b.add(rbox(1.4, 0.8, 1.2, 0.05), M.darkPaint, 0, 8.85, 1.2);
    for (const sx of [-0.15, 0.15]) b.rod(V(sx, 8.4, 1.2), V(sx, 3.4, 1.2), 0.013, M.cable, 6);
    b.add(rbox(0.5, 0.6, 0.3, 0.05), M.yellowP, 0, 3.15, 1.2);
    b.add(rbox(0.2, 0.2, 6.2, 0.04), M.yellowP, 0, 2.6, 1.2, 0, Math.PI / 2);   // balancim
    for (const sx of [-2.4, 2.4]) { b.rod(V(sx, 2.5, 1.2), V(sx * 0.95, 1.55, 1.2), 0.012, M.orangeP, 6); }
  });
  P("hexagonal", 0.33, 8, -14, 1.45, BED.z + 1.2, Math.PI / 2);

  /* ---------- Central de concreto ---------- */
  const PL = { x: 26, z: -26 };
  b.at(PL.x, 0, PL.z, 0, () => {
    for (let i = 0; i < 3; i++) {
      const sx = i * 4.8, R = 1.85;
      b.add(cyl(R, R, 11, 48), M.yellowP, sx, 11.8, 0);
      b.add(cyl(R, 0.32, 2.4, 48), M.yellowP, sx, 5.1, 0);
      b.add(cyl(R + 0.04, R + 0.04, 0.22, 48), M.darkPaint, sx, 17.35, 0);
      b.add(new THREE.ConeGeometry(R + 0.05, 0.7, 48), M.yellowP, sx, 17.8, 0);
      for (let r = 0; r < 6; r++) b.add(tor(R + 0.01, 0.035, 6, 48), M.darkPaint, sx, 6.9 + r * 1.9, 0, Math.PI / 2);
      for (let k = 0; k < 4; k++) {        // pernas em perfil + contraventamento
        const a = Math.PI / 4 + k * Math.PI / 2, lx = sx + Math.cos(a) * 1.35, lz = Math.sin(a) * 1.35;
        b.add(box(0.22, 6.3, 0.22), M.darkPaint, lx, 3.15, lz);
        b.add(rbox(0.5, 0.2, 0.5, 0.03), M.slab, lx, 0.1, lz);
        const a2 = a + Math.PI / 2, nx = sx + Math.cos(a2) * 1.35, nz = Math.sin(a2) * 1.35;
        b.rod(V(lx, 0.6, lz), V(nx, 3.6, nz), 0.035, M.darkPaint, 6);
        b.rod(V(lx, 3.6, lz), V(nx, 0.6, nz), 0.035, M.darkPaint, 6);
      }
      // plataforma superior com guarda-corpo e filtro de manga
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; b.rod(V(sx + Math.cos(a) * (R + 0.1), 18.05, Math.sin(a) * (R + 0.1)), V(sx + Math.cos(a) * (R + 0.1), 19.1, Math.sin(a) * (R + 0.1)), 0.02, M.yellowP, 6); }
      b.add(tor(R + 0.1, 0.025, 6, 40), M.yellowP, sx, 19.1, 0, Math.PI / 2);
      b.add(tor(R + 0.1, 0.02, 6, 40), M.yellowP, sx, 18.6, 0, Math.PI / 2);
      b.add(rbox(0.9, 1.0, 0.9, 0.05), M.whiteP, sx + 0.6, 18.6, -0.4);
      b.add(cyl(0.12, 0.12, 2.4, 12), M.steelM, sx - R - 0.1, 16.5, 0.5, 0.2);   // tubo de carga
      // escada marinheiro com gaiola
      const lx = sx + R + 0.22;
      for (const zz of [-0.22, 0.22]) b.rod(V(lx, 0.2, zz), V(lx, 19.0, zz), 0.022, M.steelM, 6);
      for (let k = 0; k < 60; k++) b.rod(V(lx, 0.5 + k * 0.31, -0.22), V(lx, 0.5 + k * 0.31, 0.22), 0.012, M.steelM, 5);
      for (let k = 0; k < 18; k++) b.add(new THREE.TorusGeometry(0.42, 0.016, 5, 20, Math.PI * 1.2), M.steelM, lx + 0.05, 3 + k * 0.9, 0, Math.PI / 2, 0, -Math.PI * 0.1);
      for (let k = 0; k < 5; k++) { const a = -Math.PI * 0.5 + k / 4 * Math.PI; b.rod(V(lx + 0.05 + Math.cos(a) * 0.42, 3, Math.sin(a) * 0.42), V(lx + 0.05 + Math.cos(a) * 0.42, 19, Math.sin(a) * 0.42), 0.012, M.steelM, 5); }
      // rosca transportadora até a torre
      const a0 = V(sx, 3.9, 0), a1 = V(14.2, 10.2, 3.6);
      b.rod(a0, a1, 0.2, M.steelM, 16);
      const dd = new THREE.Vector3().subVectors(a1, a0);
      for (let k = 1; k < 9; k++) { const p = a0.clone().addScaledVector(dd, k / 9); b.rod(p.clone().add(dd.clone().normalize().multiplyScalar(-0.03)), p.clone().add(dd.clone().normalize().multiplyScalar(0.03)), 0.26, M.darkPaint, 16); }
    }
    // torre dosadora/misturadora
    b.at(15.2, 0, 3.8, 0, () => {
      for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2], [2.6, 2.2], [-2.6, 2.2]]) b.add(box(0.3, 13, 0.3), M.navyP, x, 6.5, z);
      for (const y of [4.5, 8.5, 12.8]) { b.add(box(5.5, 0.25, 0.3), M.navyP, 0, y, -2.2); b.add(box(5.5, 0.25, 0.3), M.navyP, 0, y, 2.2); b.add(box(0.3, 0.25, 4.7), M.navyP, -2.6, y, 0); b.add(box(0.3, 0.25, 4.7), M.navyP, 2.6, y, 0); }
      for (const z of [-2.2, 2.2]) { b.rod(V(-2.6, 0.2, z), V(2.6, 4.5, z), 0.05, M.navyP, 6); b.rod(V(2.6, 0.2, z), V(-2.6, 4.5, z), 0.05, M.navyP, 6); }
      b.add(box(5.6, 4.3, 4.8), M.corrugated, 0, 10.7, 0);
      b.add(rbox(5.8, 0.4, 5.0, 0.05), M.navyP, 0, 13.0, 0);
      b.add(rbox(5.72, 0.3, 4.92, 0.03), M.hazard, 0, 8.7, 0);
      for (const x of [-1.6, 0, 1.6]) b.add(box(0.9, 0.7, 0.05), M.glassM, x, 11.4, 2.43);
      b.add(rbox(3.0, 1.8, 2.2, 0.15), M.whiteP, 0, 6.2, 0);               // misturador
      b.add(cyl(0.45, 0.25, 1.4, 20), M.steelM, 0, 4.6, 0);
      b.add(cyl(0.25, 0.25, 0.5, 14), M.darkPaint, 0, 3.7, 0);
      // escada externa em lances
      for (let f = 0; f < 3; f++) for (let k = 0; k < 14; k++) b.add(box(0.9, 0.04, 0.26), M.steelM, -3.2 - 0.0, 0.3 + f * 4.2 + k * 0.3, -1.8 + (f % 2 ? 3.6 - k * 0.26 : k * 0.26));
      for (let f = 0; f < 3; f++) b.add(box(1.0, 0.06, 1.0), M.steelM, -3.2, 4.4 + f * 4.2, f % 2 ? -1.9 : 1.9);
    });
    // silos de agregado com correia transportadora
    for (let k = 0; k < 4; k++) {
      b.add(new THREE.CylinderGeometry(1.5, 0.3, 2.2, 4, 1), M.yellowP, -1 + k * 3.2, 4.2, 16, 0, Math.PI / 4);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.add(box(0.14, 3.2, 0.14), M.darkPaint, -1 + k * 3.2 + x, 1.6, 16 + z);
    }
    const c0 = V(-2.2, 2.6, 16), c1 = V(13, 11.6, 6.0), cd = new THREE.Vector3().subVectors(c1, c0), cn = cd.clone().normalize();
    const cyaw = Math.atan2(cd.x, cd.z), cpitch = -Math.asin(cn.y);
    b.addM(box(0.9, 0.06, cd.length()), M.hose, new THREE.Matrix4().compose(c0.clone().addScaledVector(cd, 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(cpitch, cyaw, 0, "YXZ")), V(1, 1, 1)));
    for (let k = 0; k <= 18; k++) {
      const p = c0.clone().addScaledVector(cd, k / 18);
      for (const s of [-0.55, 0.55]) { const side = V(Math.cos(cyaw) * s, 0, -Math.sin(cyaw) * s); b.rod(p.clone().add(side), p.clone().add(side).add(V(0, -0.5, 0)), 0.03, M.navyP, 5); }
      if (k % 3 === 0 && k > 0 && k < 18) b.rod(p.clone().add(V(0, -0.5, 0)), V(p.x, 0, p.z), 0.06, M.navyP, 6);
    }
    // pilhas de agregados e baias
    [[-3.2, 22.4, 0], [2.6, 22.6, 1], [8.4, 22.2, 2]].forEach(([x, z, i]) => {
      const g = new THREE.SphereGeometry(3.0, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = g.attributes.position, r = rng(i + 5);
      for (let v = 0; v < p.count; v++) { const y = p.getY(v); p.setY(v, y * 0.72 + (y > 0.2 ? (r() - 0.5) * 0.12 : 0)); }
      g.computeVertexNormals();
      b.add(g, M.aggregate[i], x, 0, z, 0, r() * 3, 0, 1, 1, 0.8);
    });
    for (let k = 0; k < 4; k++) b.add(box(0.4, 2.2, 6), M.slab, -6.1 + k * 5.8, 1.1, 22.5);
    // reservatório de água
    b.add(cyl(1.6, 1.6, 3.2, 36), M.whiteP, 22.5, 7.4, 2);
    b.add(new THREE.ConeGeometry(1.65, 0.6, 36), M.whiteP, 22.5, 9.3, 2);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6; b.add(box(0.18, 5.8, 0.18), M.darkPaint, 22.5 + Math.cos(a) * 1.2, 2.9, 2 + Math.sin(a) * 1.2); }
  });

  /* ---------- Entorno: árvores, galpões vizinhos, torres de transmissão ---------- */
  const tr = rng(21);
  for (let i = 0; i < (q >= 1 ? 340 : 200); i++) {
    const a = tr() * Math.PI * 2, d = 82 + tr() * 70;
    const x = Math.cos(a) * d, z = Math.sin(a) * d - 12;
    if (z > 40 && Math.abs(x) < 60) continue;
    const hgt = 11 + tr() * 12;
    b.add(cyl(0.16, 0.32, hgt * 0.75, 6), M.trunk, x, hgt * 0.37, z);
    const crowns = 4 + ((tr() * 4) | 0), mat = M.tree[(tr() * M.tree.length) | 0];
    for (let c = 0; c < crowns; c++) {
      const cr2 = 1.6 + tr() * 1.8;
      b.add(new THREE.IcosahedronGeometry(cr2, 1), mat, x + (tr() - .5) * 3, hgt * (0.62 + tr() * 0.38), z + (tr() - .5) * 3, tr(), tr(), 0, 1, 0.8 + tr() * 0.6, 1);
    }
  }
  for (const [x, z, w, h, d] of [[48, -58, 34, 12, 16], [-6, -76, 26, 9, 14], [-68, -48, 20, 10, 18], [60, -18, 16, 8, 24]]) {
    b.add(box(w, h, d), M.corrugated, x, h / 2, z);
    b.add(box(w + 1, 0.5, d + 1), M.roofSheet, x, h + 0.25, z);
    b.add(box(w * 0.25, h * 0.6, 0.1), M.navyP, x - w * 0.2, h * 0.3, z + d / 2 + 0.05);
  }
  const towerAt = (x, z) => {
    const H = 34, legs = [[-3, -3], [3, -3], [3, 3], [-3, 3]];
    for (const [lx, lz] of legs) b.rod(V(x + lx, 0, z + lz), V(x + lx * 0.18, H, z + lz * 0.18), 0.12, M.steelM, 5);
    for (let k = 0; k < 8; k++) {
      const t0 = k / 8, t1 = (k + 1) / 8, s0 = 1 - t0 * 0.82, s1 = 1 - t1 * 0.82;
      for (let e = 0; e < 4; e++) { const [ax, az] = legs[e], [bx2, bz2] = legs[(e + 1) % 4];
        b.rod(V(x + ax * s0, H * t0, z + az * s0), V(x + bx2 * s1, H * t1, z + bz2 * s1), 0.05, M.steelM, 4);
        b.rod(V(x + bx2 * s0, H * t0, z + bz2 * s0), V(x + ax * s1, H * t1, z + az * s1), 0.05, M.steelM, 4); }
    }
    for (const y of [H * 0.78, H * 0.92]) b.add(box(14, 0.4, 0.6), M.steelM, x, y, z);
    return V(x, H * 0.78, z);
  };
  const tops = [-260, -130, 0, 130, 260].map(x => towerAt(x, -210));
  for (let i = 0; i < tops.length - 1; i++) for (const off of [-6.5, 6.5]) for (const yo of [0, H_OFF()]) {
    const a = tops[i].clone().add(V(off, yo - 1.2, 0)), c = tops[i + 1].clone().add(V(off, yo - 1.2, 0));
    const mid = a.clone().lerp(c, 0.5).add(V(0, -7, 0));
    b.tube([a, a.clone().lerp(mid, 0.5).add(V(0, -2.2, 0)), mid, mid.clone().lerp(c, 0.5).add(V(0, -2.2, 0)), c], 0.06, M.cable, 24);
  }
  function H_OFF() { return 34 * 0.14; }

  scene.add(b.build("patio"));

  /* ---------- Estacas instanciadas + anéis de emenda + pontas de cordoalha + estêncil ---------- */
  const groups = new Map();
  for (const p of piles) { const k = `${p.forma}|${p.d}|${p.len}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const rc = rng(5), dummy = new THREE.Object3D();
  const strandEnds = [];
  for (const [k, list] of groups) {
    const [forma, ds, ls] = k.split("|"), d = +ds, len = +ls;
    const mesh = new THREE.InstancedMesh(pileGeometry(forma, d, len), M.concrete, list.length);
    const ring = len > 2 ? new THREE.InstancedMesh(pileGeometry(forma, d + 0.012, 0.07), M.ringSteel, list.length * 2) : null;
    list.forEach((p, i) => {
      dummy.position.copy(p.pos); dummy.rotation.copy(p.rot);
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const tone = 0.9 + rc() * 0.16; mesh.setColorAt(i, new THREE.Color(tone, tone * (0.985 + rc() * 0.02), tone * (0.965 + rc() * 0.03)));
      const base = dummy.matrix.clone();
      if (ring) [-1, 1].forEach((s, j) => { ring.setMatrixAt(i * 2 + j, base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, s * (len / 2 - 0.04)))); });
      if (len > 2) for (const [ox, oy] of strandOffsets(forma, d)) for (const s of [-1, 1]) strandEnds.push(base.clone().multiply(new THREE.Matrix4().makeTranslation(ox, oy, s * (len / 2 + 0.004))));
      if (p.label) labelPile(base, forma, d, len);
    });
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    if (ring) { ring.castShadow = true; ring.receiveShadow = true; scene.add(ring); }
  }
  const sEnd = new THREE.InstancedMesh(cyl(0.0075, 0.0075, 0.025, 7).rotateX(Math.PI / 2), M.strand, strandEnds.length);
  strandEnds.forEach((m, i) => sEnd.setMatrixAt(i, m)); scene.add(sEnd);

  function labelPile(base, forma, d, len) {
    const id = `${forma === "hexagonal" ? "H" : forma === "circular" ? "C" : "Q"}${Math.round(d * 100)}`;
    const lot = `L-${(4100 + ((rc() * 800) | 0))}  ${len}M`;
    const mat = new THREE.MeshStandardMaterial({ map: stencilTexture([id, lot]), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.62, d * 0.155), mat);
    pl.applyMatrix4(base.clone().multiply(new THREE.Matrix4().makeTranslation(0, -d * 0.02, len / 2 + 0.006)));
    scene.add(pl);
  }

  /* ---------- Poeira do impacto ---------- */
  const DUST_N = 90, dPos = new Float32Array(DUST_N * 3), dVel = new Float32Array(DUST_N * 3);
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  const dMat = new THREE.PointsMaterial({ map: T.dust, size: 0.9, transparent: true, depthWrite: false, opacity: 0, color: 0xd9c7a8 });
  scene.add(new THREE.Points(dGeo, dMat));
  let dustT = 9;
  function puff(strength) {
    for (let i = 0; i < DUST_N; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random() * 1.6) * strength;
      dPos.set([Math.cos(a) * 0.2, 0.05, PZ + Math.sin(a) * 0.2], i * 3);
      dVel.set([Math.cos(a) * v, 0.25 + Math.random() * 0.9 * strength, Math.sin(a) * v], i * 3);
    }
    dustT = 0; dGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- Cravação ---------- */
  const PILE_LEN = 10, MAX_DEPTH = 8.4;
  const state = { depth: 3.2, blows: 64, phase: 0, period: 1.25, shake: 0 };
  const penAt = (d) => (d < 2 ? 0.07 : d < 5 ? 0.05 : d < 7 ? 0.025 : 0.012);
  let onBlow = null, pendingManual = 0;
  function strike(manual) {
    state.depth = Math.min(MAX_DEPTH, state.depth + penAt(state.depth) * (manual ? 2.2 : 1));
    state.blows++; state.shake = manual ? 0.1 : 0.03; puff(manual ? 1.5 : 0.8);
    if (onBlow) onBlow({ depth: state.depth, blows: state.blows, nega: penAt(state.depth) * 10000, manual });
    if (state.depth >= MAX_DEPTH) setTimeout(() => { state.depth = 0.6; state.blows = 0; if (onBlow) onBlow({ depth: state.depth, blows: 0, nega: null }); }, 2400);
  }
  function placeDrive(lift) {
    const top = PILE_LEN - state.depth;
    drivePile.position.set(0, top - PILE_LEN / 2, PZ);
    driveRing.position.set(0, top - 0.04, PZ);
    hammer.position.set(0, top + 0.12 + lift, PZ);
    for (const c of cables) {
      const y0 = hammer.position.y + 4.2, y1 = RIG.leaderH + 0.75;
      c.position.set(c.userData.sx * 0.4, (y0 + y1) / 2, PZ + 0.05);
      c.scale.y = Math.max(0.05, y1 - y0);
    }
  }

  /* ---------- Pós-processamento ---------- */
  let composer = null, gtao = null, bokeh = null, grade = null;
  function setupPost(w, h) {
    if (!post) return;
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, w * pr, h * pr);
    gtao.blendIntensity = 0.95;
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: q >= 1 ? 24 : 10, distanceFallOff: 1, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: q >= 1 ? 6 : 4, rings: 2, samples: q >= 1 ? 16 : 8 });
    composer.addPass(gtao);
    bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0, maxblur: 0.006 });
    bokeh.enabled = false; composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GradeShader); composer.addPass(grade);
    composer.addPass(new SMAAPass(w * pr, h * pr));
  }

  /* ---------- Câmeras ---------- */
  const SHOTS = {
    hero:      { pos: [-8.5, 3.0, 21.5], look: [-4.0, 5.6, -2], fov: 38, focus: [0, 3, 0], shadow: 34 },
    estacas:   { pos: [-6.7, 1.05, 10.3], look: [-9.4, 0.95, 8.0], fov: 32, focus: [-9, 1, 6], shadow: 9, dof: { focus: 2.6, aperture: 0.012 }, sunAz: -30, sunEl: 30 },
    cravacao:  { pos: [-3.0, 1.55, 4.6], look: [0.45, 1.5, 0.3], fov: 34, focus: [0, 1, 0.5], shadow: 8, dof: { focus: 5.4, aperture: 0.003 } },
    fundacao:  { pos: [9.5, 6.2, 15.5], look: [1.6, 2.4, 0.4], fov: 36, focus: [3, 0, 2], shadow: 22 },
    central:   { pos: [17.5, 1.7, -14.5], look: [32, 10.5, -26], fov: 46, focus: [32, 0, -22], shadow: 26 },
    protensao: { pos: [-6.4, 2.9, -21.2], look: [-40, 0.6, -22.4], fov: 40, focus: [-22, 0, -22], shadow: 26 },
    logistica: { pos: [23, 4.0, 21], look: [13.2, 1.8, 8.6], fov: 34, focus: [13, 0, 8], shadow: 14 },
    aerea:     { pos: [52, 36, 50], look: [-6, 0, -10], fov: 38, focus: [-4, 0, -10], shadow: 62, fogD: 0.0024 },
    pilha:     { pos: [-1.2, 2.5, 16], look: [-12.5, 1.4, 3], fov: 30, focus: [-14, 0, 2], shadow: 18, sunAz: -45, sunEl: 24 },
  };
  const look = new THREE.Vector3();
  let current = SHOTS.hero;
  function setShot(name) {
    current = SHOTS[name] || SHOTS.hero;
    camera.position.set(...current.pos); look.set(...current.look); camera.fov = current.fov;
    camera.lookAt(look); camera.updateProjectionMatrix();
    scene.fog.density = current.fogD ?? 0.0058;
    const el = current.sunEl ?? 13;
    sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - el), THREE.MathUtils.degToRad(current.sunAz ?? -72));
    sun.color.set(0xffc790).lerp(new THREE.Color(0xfff1df), THREE.MathUtils.smoothstep(el, 13, 35));
    su.sunPosition.value.copy(sunDir);
    const f = V(...current.focus), s = current.shadow;
    sun.target.position.copy(f); sun.position.copy(f).addScaledVector(sunDir, 140);
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 20, far: 320 });
    sun.shadow.camera.updateProjectionMatrix();
    if (bokeh) {
      bokeh.enabled = !!current.dof && !live;
      if (current.dof) { bokeh.uniforms.focus.value = current.dof.focus; bokeh.uniforms.aperture.value = current.dof.aperture; }
    }
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = current.fov * (w / h < 1 ? 1.45 : 1);
    camera.updateProjectionMatrix();
    if (!composer && post) setupPost(w, h);
    else if (composer) { composer.setSize(w, h); gtao.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); }
  }
  function draw() { if (composer) { grade.uniforms.time.value = (performance.now() % 1000) / 1000; composer.render(); } else renderer.render(scene, camera); }

  /* ---------- Loop ao vivo ---------- */
  const clock = new THREE.Clock(), pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false, raf = 0, tAll = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); tAll += dt;
    state.phase += dt / state.period;
    if (pendingManual === 1) { pendingManual = 2; state.phase = Math.max(state.phase, 0.86); }
    if (state.phase >= 1) { state.phase -= 1; strike(pendingManual === 2); pendingManual = 0; }
    const ph = state.phase;
    const lift = ph < 0.86 ? 1.4 * Math.sin((ph / 0.86) * Math.PI / 2) : 1.4 * (1 - Math.pow((ph - 0.86) / 0.14, 2));
    placeDrive(Math.max(0, lift));
    M.beacon.emissiveIntensity = 0.6 + Math.max(0, Math.sin(tAll * 7)) * 2.2;
    if (dustT < 3) {
      dustT += dt;
      for (let i = 0; i < DUST_N * 3; i += 3) {
        dPos[i] += dVel[i] * dt; dPos[i + 1] += dVel[i + 1] * dt; dPos[i + 2] += dVel[i + 2] * dt;
        dVel[i] *= 0.96; dVel[i + 2] *= 0.96; dVel[i + 1] *= 0.97;
      }
      dGeo.attributes.position.needsUpdate = true;
      dMat.opacity = Math.max(0, 0.5 * (1 - dustT / 2.4)); dMat.size = 0.6 + dustT * 0.9;
    }
    pointer.x += (pointer.tx - pointer.x) * 0.05; pointer.y += (pointer.ty - pointer.y) * 0.05;
    state.shake *= 0.86;
    const s = current;
    camera.position.set(
      s.pos[0] + Math.sin(tAll * 0.12) * 1.0 + pointer.x * 2.0 + (Math.random() - .5) * state.shake,
      s.pos[1] + pointer.y * 0.9 + (Math.random() - .5) * state.shake,
      s.pos[2] + Math.cos(tAll * 0.1) * 0.7);
    camera.lookAt(look);
    draw();
    if (running) raf = requestAnimationFrame(frame);
  }

  setShot(opts.shot || "hero");
  placeDrive(0.7);

  return {
    renderer, scene, camera, state, SHOTS,
    setShot, resize,
    renderStill(name, w, h, depth) {
      setShot(name);
      if (depth != null) state.depth = depth;
      placeDrive(name === "cravacao" ? 0.25 : 0.8);
      M.beacon.emissiveIntensity = 1.6;
      resize(w, h); camera.lookAt(look);
      draw();
    },
    start() { if (!running) { running = true; clock.getDelta(); raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    pointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; },
    strikeNow() { pendingManual = 1; },
    set onBlow(fn) { onBlow = fn; },
  };
}
