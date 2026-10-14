/* Kit de construção da maquete: montador que funde peças por material
   e os equipamentos/figuras do pátio, modelados peça por peça. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { rng } from "./tex.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------- Montador ---------- */
export class Builder {
  constructor() { this.parts = new Map(); this.stack = [new THREE.Matrix4()]; }
  get top() { return this.stack[this.stack.length - 1]; }
  push(m) { this.stack.push(this.top.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  /* executa fn num referencial local (posição, rotação Y/X/Z) */
  at(x, y, z, ry = 0, fn, rx = 0, rz = 0) {
    this.push(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(1, 1, 1)));
    fn(this); this.pop();
  }
  add(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(sx, sy, sz));
    return this.addM(geo, mat, m);
  }
  addM(geo, mat, m) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(this.top.clone().multiply(m));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }
  /* cilindro entre dois pontos (no referencial atual) */
  rod(a, b, r, mat, seg = 10) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), q, V(1, 1, 1));
    return this.addM(new THREE.CylinderGeometry(r, r, len, seg, 1), mat, m);
  }
  /* tubo seguindo uma curva (cabos, mangueiras) */
  tube(points, r, mat, seg = 32) {
    return this.addM(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8, false), mat, new THREE.Matrix4());
  }
  build(name = "conjunto") {
    const group = new THREE.Group(); group.name = name;
    for (const [mat, list] of this.parts) {
      for (let i = 0; i < list.length; i += 4000) {
        const merged = mergeGeometries(list.slice(i, i + 4000), false);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    this.parts.clear();
    return group;
  }
}

/* ---------- Geometrias base ---------- */
const cache = new Map();
const memo = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
export const box = (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const rbox = (w, h, d, r = 0.04) => memo(`r${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
export const cyl = (rt, rb, h, s = 20) => memo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1));
export const sph = (r, w = 16, h = 12) => memo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
export const tor = (r, t, rs = 8, ts = 24) => memo(`t${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
export const cap = (r, l, s = 10) => memo(`k${r},${l},${s}`, () => new THREE.CapsuleGeometry(r, l, 4, s));

/* Seção de estaca extrudada com chanfro (eixo Z, centrada) */
export function pileGeometry(forma, d, len, hollow = 0) {
  return memo(`p${forma}${d}${len}${hollow}`, () => {
    const shape = new THREE.Shape();
    if (forma === "quadrada") {
      const h = d / 2, c = 0.012;
      shape.moveTo(-h + c, -h); shape.lineTo(h - c, -h); shape.lineTo(h, -h + c); shape.lineTo(h, h - c);
      shape.lineTo(h - c, h); shape.lineTo(-h + c, h); shape.lineTo(-h, h - c); shape.lineTo(-h, -h + c); shape.closePath();
    } else {
      const n = forma === "hexagonal" ? 6 : 40, R = d / 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (forma === "hexagonal" ? 0 : 0);
        const p = [R * Math.cos(a), R * Math.sin(a)];
        i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1]);
      }
      shape.closePath();
    }
    if (hollow) { const hole = new THREE.Path(); hole.absarc(0, 0, hollow, 0, Math.PI * 2, true); shape.holes.push(hole); }
    const bevel = 0.01;
    const g = new THREE.ExtrudeGeometry(shape, { depth: len - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 40 });
    g.translate(0, 0, -(len - bevel * 2) / 2);
    // UV em metros: o mapa de concreto fica na escala certa nas laterais e nos topos
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (Math.abs(nor.getZ(i)) > 0.7) uv.setXY(i, x * 0.8 + 0.5, y * 0.8 + 0.5);
      else uv.setXY(i, (Math.atan2(y, x) / (Math.PI * 2)) * d * 2.6, z * 0.35);
    }
    g.computeVertexNormals();
    return g;
  });
}

export function strandOffsets(forma, d) {
  const out = [];
  if (forma === "quadrada") { const h = d / 2 - 0.045; [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].forEach(p => out.push([p[0] * h, p[1] * h])); }
  else { const r = d / 2 - (forma === "hexagonal" ? 0.058 : 0.045); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; out.push([r * Math.cos(a), r * Math.sin(a)]); } }
  return out;
}

/* ---------- Figuras humanas (operários com EPI, articulados) ---------- */
/* Poses em radianos: ombro (frente/lado), cotovelo, quadril, joelho; L = esquerda, R = direita.
   Rotação positiva em X leva o membro para trás; negativa, para a frente. */
const POSES = {
  stand:     { sL: [0.08, 0.1], eL: -0.15, sR: [0.08, -0.1], eR: -0.15, hL: 0, kL: 0, hR: 0, kR: 0, head: 0, spine: 0 },
  point:     { sL: [0.05, 0.12], eL: -0.2, sR: [-1.45, -0.25], eR: -0.05, hL: 0, kL: 0, hR: -0.05, kR: 0.08, head: -0.15, spine: 0 },
  signal:    { sL: [-2.75, 0.25], eL: -0.35, sR: [0.1, -0.12], eR: -0.25, hL: 0.05, kL: 0, hR: -0.08, kR: 0.1, head: -0.05, spine: 0 },
  clipboard: { sL: [-0.55, 0.25], eL: -1.25, sR: [-0.35, -0.2], eR: -1.35, hL: 0, kL: 0, hR: 0, kR: 0, head: 0.35, spine: 0.06 },
  measure:   { sL: [-0.7, 0.2], eL: -0.7, sR: [-0.95, -0.15], eR: -0.45, hL: -0.35, kL: 0.55, hR: -0.1, kR: 0.25, head: 0.4, spine: 0.32 },
  walk:      { sL: [0.4, 0.08], eL: -0.35, sR: [-0.4, -0.08], eR: -0.35, hL: -0.42, kL: 0.15, hR: 0.32, kR: 0.55, head: 0, spine: 0.04 },
  crouch:    { sL: [-0.8, 0.25], eL: -0.9, sR: [-0.9, -0.2], eR: -0.8, hL: -1.55, kL: 2.2, hR: -1.25, kR: 2.0, head: 0.25, spine: 0.35, drop: 0.42 },
};
export function person(b, M, x, z, ry, opts = {}) {
  const r = rng(opts.seed || ((x * 73 + z * 31) | 0));
  const skin = M.skin[(r() * M.skin.length) | 0];
  const vest = opts.vest || (r() < 0.6 ? M.vestOrange : M.vestLime);
  const helmet = opts.helmet || (r() < 0.55 ? M.helmetWhite : M.helmetYellow);
  const pants = r() < 0.5 ? M.pantsNavy : M.pantsKhaki;
  const P = POSES[opts.pose] || POSES.stand;
  const s = 0.95 + r() * 0.09;
  const thigh = 0.44, shin = 0.43, upper = 0.3, fore = 0.27, hipY = 0.93;

  /* perna: quadril -> coxa -> joelho -> canela -> botina */
  const leg = (sx, hip, knee) => {
    b.at(sx, hipY - (P.drop || 0), 0, 0, () => {
      b.add(cap(0.078, thigh - 0.1, 10), pants, 0, -thigh / 2, 0);
      b.add(rbox(0.1, 0.12, 0.05, 0.02), pants, sx > 0 ? 0.075 : -0.075, -thigh * 0.55, 0.01); // bolso lateral
      b.at(0, -thigh, 0, 0, () => {
        b.add(sph(0.07, 10, 8), pants, 0, 0, 0);
        b.add(cap(0.064, shin - 0.1, 10), pants, 0, -shin / 2, 0);
        b.at(0, -shin, 0, 0, () => {
          b.add(rbox(0.12, 0.13, 0.29, 0.04), M.boot, 0, -0.035, 0.055, -knee - hip);
          b.add(rbox(0.125, 0.03, 0.3, 0.012), M.coneBase, 0, -0.095, 0.055, -knee - hip);
        });
      }, knee);
    }, hip);
  };
  /* braço: ombro -> braço -> cotovelo -> antebraço -> mão (luva) */
  const arm = (sx, [pitch, roll], elbow, holding) => {
    b.at(sx, 0.36, 0, 0, () => {
      b.add(sph(0.072, 10, 8), M.shirt, 0, 0, 0);
      b.add(cap(0.06, upper - 0.08, 10), M.shirt, 0, -upper / 2, 0);
      b.at(0, -upper, 0, 0, () => {
        b.add(sph(0.055, 10, 8), M.shirt, 0, 0, 0);
        b.add(cap(0.05, fore - 0.08, 10), M.shirt, 0, -fore / 2, 0);
        b.add(cyl(0.055, 0.055, 0.04, 12), M.glove, 0, -fore + 0.03, 0);
        b.add(rbox(0.07, 0.1, 0.045, 0.02), M.glove, 0, -fore - 0.04, 0.005);
        b.add(rbox(0.025, 0.06, 0.025, 0.01), M.glove, sx > 0 ? -0.04 : 0.04, -fore - 0.02, 0.02, 0.3);
        if (holding) holding();
      }, elbow);
    }, pitch, -roll);   // roll > 0 no braço esquerdo (< 0 no direito) abre o braço
  };

  b.at(x, 0, z, ry, () => {
    b.push(new THREE.Matrix4().makeScale(s, s, s));
    leg(-0.095, P.hL, P.kL);
    leg(0.095, P.hR, P.kR);
    // pelve, cinto e fivela
    b.at(0, hipY - (P.drop || 0), 0, 0, () => {
      b.add(rbox(0.34, 0.16, 0.21, 0.07), pants, 0, 0.03, 0);
      b.add(cyl(0.175, 0.175, 0.045, 20), M.coneBase, 0, 0.1, 0, 0, 0, 0, 1, 1, 0.64);
      b.add(rbox(0.05, 0.04, 0.02, 0.006), M.chrome, 0, 0.1, 0.112);
      // tronco (inclina com spine)
      b.at(0, 0.1, 0, 0, () => {
        b.add(cap(0.155, 0.3, 14), M.shirt, 0, 0.24, 0, 0, 0, 0, 1.08, 1, 0.7);
        // colete: frente e costas com faixas refletivas e zíper
        b.add(cap(0.164, 0.24, 14), vest, 0, 0.27, 0, 0, 0, 0, 1.1, 1, 0.74);
        for (const yy of [0.17, 0.33]) b.add(cyl(0.172, 0.172, 0.032, 22), M.reflective, 0, yy, 0, 0, 0, 0, 1.11, 1, 0.75);
        for (const sx of [-0.07, 0.07]) b.add(box(0.03, 0.22, 0.012), M.reflective, sx, 0.47, 0.105, -0.12); // suspensório refletivo
        b.add(box(0.008, 0.3, 0.008), M.coneBase, 0, 0.26, 0.124);
        b.add(rbox(0.07, 0.05, 0.02, 0.008), M.coneBase, 0.07, 0.4, 0.118);  // rádio/caneta no bolso
        b.add(rbox(0.07, 0.11, 0.035, 0.01), M.darkPaint, -0.16, 0.0, 0.0);  // rádio no cinto
        arm(-0.215, P.sL, P.eL, opts.pose === "clipboard" ? () => b.add(box(0.22, 0.3, 0.012), M.clipboard, 0.09, -0.32, 0.04, -0.3) : null);
        arm(0.215, P.sR, P.eR, opts.pose === "measure" ? () => b.add(box(0.026, 0.012, 0.8), M.yellow, 0, -0.33, 0.38, 0.5) : null);
        // pescoço e cabeça
        b.at(0, 0.5, 0, 0, () => {
          b.add(cyl(0.05, 0.058, 0.09, 10), skin, 0, 0.0, 0);
          b.add(sph(0.105, 18, 14), skin, 0, 0.13, 0.005, 0, 0, 0, 0.9, 1.07, 0.98);
          b.add(rbox(0.03, 0.045, 0.04, 0.012), skin, 0, 0.12, 0.1);        // nariz
          for (const ex of [-0.094, 0.094]) b.add(sph(0.025, 8, 6), skin, ex, 0.13, -0.005, 0, 0, 0, 0.5, 1, 0.8); // orelhas
          b.add(rbox(0.14, 0.032, 0.03, 0.01), M.glasses, 0, 0.145, 0.088); // óculos
          b.add(new THREE.SphereGeometry(0.124, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 0.17, 0);
          b.add(cyl(0.15, 0.15, 0.013, 24), helmet, 0, 0.172, 0.02, 0, 0, 0, 1, 1, 1.14);
          b.add(rbox(0.028, 0.05, 0.22, 0.012), helmet, 0, 0.285, 0);
          b.add(box(0.2, 0.012, 0.012), M.coneBase, 0, 0.1, -0.035, 0.6); // jugular
        }, P.head);
      }, P.spine);
    });
    b.pop();
  });
}

/* ---------- Bate-estacas ---------- */
export const RIG = { leaderH: 20, leaderZ: -0.78, pileZ: 0.2 };
export function pileDriver(b, M) {
  const LH = RIG.leaderH, LZ = RIG.leaderZ;
  // Esteiras: armação, rodas motrizes, roletes e sapatas com garras
  for (const sx of [-1.55, 1.55]) {
    b.add(rbox(0.5, 0.55, 4.6, 0.08), M.darkPaint, sx, 0.62, -3.3);
    for (const zz of [-5.45, -1.15]) {
      b.add(cyl(0.42, 0.42, 0.62, 28), M.darkPaint, sx, 0.55, zz, 0, 0, Math.PI / 2);
      b.add(cyl(0.2, 0.2, 0.66, 16), M.steelM, sx, 0.55, zz, 0, 0, Math.PI / 2);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; b.add(box(0.6, 0.08, 0.1), M.steelM, sx, 0.55 + Math.sin(a) * 0.43, zz + Math.cos(a) * 0.43, a); }
    }
    for (let k = 0; k < 6; k++) b.add(cyl(0.13, 0.13, 0.56, 14), M.steelM, sx, 0.22, -4.75 + k * 0.72, 0, 0, Math.PI / 2);
    for (let k = 0; k < 3; k++) b.add(cyl(0.09, 0.09, 0.5, 12), M.steelM, sx, 0.98, -4.5 + k * 1.2, 0, 0, Math.PI / 2);
    // sapatas ao longo do contorno da esteira
    const path = [];
    const R = 0.5, z0 = -5.45, z1 = -1.15;
    for (let i = 0; i <= 40; i++) path.push([0.05, z0 + (z1 - z0) * i / 40, 0]);
    for (let i = 1; i < 14; i++) { const a = -Math.PI / 2 + i / 14 * Math.PI; path.push([0.55 + Math.sin(a) * R, z1 + Math.cos(a) * R, a + Math.PI / 2]); }
    for (let i = 0; i <= 40; i++) path.push([1.05, z1 - (z1 - z0) * i / 40, Math.PI]);
    for (let i = 1; i < 14; i++) { const a = Math.PI / 2 + i / 14 * Math.PI; path.push([0.55 + Math.sin(a) * R, z0 + Math.cos(a) * R, a + Math.PI / 2]); }
    for (const [y, z, a] of path) {
      b.add(box(0.72, 0.05, 0.1), M.trackShoe, sx, y, z, a);
      b.add(box(0.72, 0.035, 0.02), M.trackShoe, sx, y + Math.cos(a) * -0.04, z + Math.sin(a) * 0.04, a);
    }
  }
  b.add(rbox(2.6, 0.45, 1.6, 0.05), M.darkPaint, 0, 0.75, -3.3);
  b.add(cyl(0.95, 0.95, 0.3, 32), M.steelM, 0, 1.12, -3.4);

  // Superestrutura giratória
  b.at(0, 1.27, -3.6, 0, () => {
    b.add(rbox(3.2, 0.3, 4.9, 0.05), M.darkPaint, 0, 0.15, 0);
    // casa de máquinas com venezianas
    b.add(rbox(2.0, 1.55, 3.0, 0.1), M.yellowP, 0.55, 1.08, -0.6);
    for (let k = 0; k < 9; k++) b.add(box(0.02, 0.06, 1.1), M.darkPaint, 1.56, 0.7 + k * 0.1, -1.2, 0, 0, 0.5);
    for (let k = 0; k < 7; k++) b.add(box(1.4, 0.035, 0.08), M.darkPaint, 0.55, 1.87, -1.6 + k * 0.18);
    b.add(rbox(3.15, 0.18, 4.8, 0.04), M.hazard, 0, 0.36, 0);
    // contrapeso
    b.add(rbox(3.2, 1.25, 1.0, 0.12), M.darkPaint, 0, 0.92, -2.5);
    for (let k = 0; k < 5; k++) b.add(box(3.22, 0.04, 1.02), M.steelM, 0, 0.45 + k * 0.25, -2.5);
    // escapamento
    b.add(cyl(0.07, 0.07, 1.0, 12), M.steelM, 1.2, 2.2, -1.4);
    b.add(cyl(0.085, 0.07, 0.12, 12), M.darkPaint, 1.2, 2.72, -1.4);
    // cabine com caixilhos, vidros, giroflex, espelho
    b.at(-0.95, 0.3, 1.0, 0, () => {
      b.add(rbox(1.15, 1.75, 1.65, 0.07), M.yellowP, 0, 0.88, 0);
      b.add(box(1.17, 0.95, 1.2), M.glassM, 0, 1.15, 0.05);
      b.add(box(0.9, 0.95, 0.02), M.glassM, 0, 1.15, 0.83);
      for (const zz of [-0.55, 0.05, 0.62]) b.add(box(1.19, 1.0, 0.05), M.darkPaint, 0, 1.15, zz);
      b.add(box(1.19, 0.05, 1.3), M.darkPaint, 0, 1.64, 0.05);
      b.add(box(1.19, 0.05, 1.3), M.darkPaint, 0, 0.66, 0.05);
      b.add(box(0.05, 1.0, 0.05), M.darkPaint, 0.46, 1.15, 0.83); b.add(box(0.05, 1.0, 0.05), M.darkPaint, -0.46, 1.15, 0.83);
      b.add(rbox(1.25, 0.08, 1.75, 0.03), M.darkPaint, 0, 1.8, 0);
      b.add(cyl(0.07, 0.08, 0.13, 14), M.beacon, 0.35, 1.9, -0.4);
      b.add(rbox(0.3, 0.4, 0.04, 0.02), M.darkPaint, -0.66, 0.9, 0.2); // porta/maçaneta
      b.rod(V(-0.6, 1.5, 0.8), V(-0.85, 1.5, 1.05), 0.012, M.darkPaint);
      b.add(box(0.03, 0.18, 0.12), M.glassM, -0.86, 1.5, 1.05);
      // banco e painel visíveis pelo vidro
      b.add(rbox(0.45, 0.5, 0.45, 0.05), M.seat, 0.05, 0.75, -0.2);
      b.add(rbox(0.8, 0.25, 0.2, 0.03), M.darkPaint, 0, 0.8, 0.6);
    });
    // guarda-corpo e escada na lateral
    for (const zz of [-1.8, -0.3, 1.1]) b.rod(V(1.6, 0.3, zz), V(1.6, 1.25, zz), 0.022, M.yellowP);
    b.rod(V(1.6, 1.25, -1.8), V(1.6, 1.25, 1.1), 0.022, M.yellowP);
    b.rod(V(1.6, 0.8, -1.8), V(1.6, 0.8, 1.1), 0.018, M.yellowP);
    for (let k = 0; k < 4; k++) b.add(box(0.4, 0.03, 0.12), M.steelM, -1.5, -0.6 + k * 0.28, 1.8);
    // guincho com cabo enrolado
    b.add(cyl(0.32, 0.32, 1.3, 26), M.darkPaint, 0.2, 2.05, 0.9, 0, 0, Math.PI / 2);
    b.add(cyl(0.27, 0.27, 1.18, 26), M.cable, 0.2, 2.05, 0.9, 0, 0, Math.PI / 2);
    for (let k = 0; k < 18; k++) b.add(tor(0.275, 0.012, 6, 26), M.cable, -0.35 + k * 0.065, 2.05, 0.9, 0, Math.PI / 2);
  });

  // Torre-guia treliçada: 4 montantes, travessas e diagonais
  const W = 0.62, base = 0.75, bay = 0.62, nb = Math.floor((LH - base) / bay);
  const cx = 0, cz = LZ, h = W / 2;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  for (const [ox, oz] of corners) b.rod(V(cx + ox, base, cz + oz), V(cx + ox, LH, cz + oz), 0.045, M.yellowP, 8);
  for (let i = 0; i <= nb; i++) {
    const y = base + i * bay;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      b.rod(V(cx + ax, y, cz + az), V(cx + bx, y, cz + bz), 0.022, M.yellowP, 6);
      if (i < nb) {
        const flip = (i + k) % 2;
        b.rod(V(cx + (flip ? ax : bx), y, cz + (flip ? az : bz)), V(cx + (flip ? bx : ax), y + bay, cz + (flip ? bz : az)), 0.018, M.yellowP, 6);
      }
    }
  }
  // trilhos-guia frontais do martelo
  for (const sx of [-0.2, 0.2]) b.add(box(0.07, LH - 1.2, 0.09), M.steelM, sx, base + (LH - 1.2) / 2 + 0.4, cz + h + 0.06);
  // escada de acesso na lateral da torre
  for (let i = 0; i < 26; i++) b.rod(V(-h - 0.18, 1.2 + i * 0.32, cz - 0.15), V(-h - 0.18, 1.2 + i * 0.32, cz + 0.15), 0.012, M.steelM, 6);
  for (const zz of [-0.15, 0.15]) b.rod(V(-h - 0.18, 1.0, cz + zz), V(-h - 0.18, 9.6, cz + zz), 0.016, M.steelM, 6);
  for (let i = 0; i < 8; i++) b.add(tor(0.32, 0.014, 6, 24), M.steelM, -h - 0.36, 3.2 + i * 0.9, cz, Math.PI / 2);
  // cabeça da torre com polias
  b.add(rbox(1.0, 0.7, 1.2, 0.06), M.yellowP, cx, LH + 0.3, cz + 0.1);
  for (const sx of [-0.18, 0.18]) {
    b.add(cyl(0.34, 0.34, 0.1, 30), M.steelM, cx + sx, LH + 0.75, cz + 0.42, 0, 0, Math.PI / 2);
    b.add(cyl(0.08, 0.08, 0.14, 12), M.darkPaint, cx + sx, LH + 0.75, cz + 0.42, 0, 0, Math.PI / 2);
  }
  b.add(cyl(0.07, 0.07, 0.12, 12), M.beacon, cx, LH + 0.72, cz - 0.3);
  // pé da torre apoiado no solo + base articulada
  b.add(rbox(1.2, 0.35, 1.2, 0.05), M.darkPaint, cx, 0.42, cz);
  b.add(rbox(1.5, 0.12, 1.5, 0.03), M.steelM, cx, 0.12, cz);
  // estais hidráulicos: cilindro + haste
  for (const sx of [-0.55, 0.55]) {
    const a = V(sx * 0.8, 3.2, -5.0), m1 = V(sx * 0.35, 8.0, LZ - 0.55), top = V(sx * 0.32, 12.4, LZ - 0.3);
    b.rod(a, m1, 0.11, M.yellowP, 14);
    b.rod(m1, top, 0.055, M.chrome, 12);
    b.add(sph(0.13, 12, 10), M.darkPaint, a.x, a.y, a.z);
  }
  b.rod(V(-0.5, 1.8, -1.6), V(-0.2, 1.0, LZ - 0.3), 0.1, M.yellowP, 12);
  b.rod(V(0.5, 1.8, -1.6), V(0.2, 1.0, LZ - 0.3), 0.1, M.yellowP, 12);
  // mangueiras hidráulicas penduradas da torre até a casa de máquinas
  for (const [sx, sag] of [[-0.12, 0.6], [0.0, 0.8], [0.12, 1.0]]) {
    b.tube([V(sx, 9.5, LZ + 0.1), V(sx + 0.4, 6.5 - sag, LZ - 0.9), V(sx + 0.5, 3.6, -2.4), V(sx + 0.7, 3.05, -3.3)], 0.03, M.hose);
  }
}

/* Martelo hidráulico (parte móvel). Origem na base do capacete. */
export function hammerParts(b, M) {
  b.add(rbox(0.82, 0.55, 0.82, 0.05), M.darkPaint, 0, 0.27, 0);          // capacete
  b.add(cyl(0.3, 0.36, 0.25, 6), M.steelM, 0, -0.06, 0);                   // coxim sobre a estaca
  b.add(rbox(0.92, 3.1, 0.92, 0.08), M.yellowP, 0, 2.1, 0);               // corpo
  b.add(rbox(0.94, 0.38, 0.94, 0.06), M.hazard, 0, 2.5, 0);
  b.add(rbox(0.96, 0.25, 0.96, 0.05), M.darkPaint, 0, 3.75, 0);
  for (const y of [1.0, 3.25]) for (const sx of [-0.2, 0.2]) b.add(box(0.12, 0.24, 0.12), M.steelM, sx, y, -0.5); // guias
  b.add(cyl(0.12, 0.12, 0.7, 14), M.chrome, 0.33, 3.9, 0.2);
  b.add(cyl(0.16, 0.16, 0.35, 14), M.darkPaint, 0.33, 4.2, 0.2);
  b.add(tor(0.16, 0.04, 8, 18), M.steelM, 0, 4.15, 0, 0, Math.PI / 2);  // olhal
  for (let k = 0; k < 3; k++) b.add(cyl(0.04, 0.04, 0.5, 8), M.hose, -0.3 + k * 0.08, 3.6, -0.45, Math.PI / 2);
}

/* ---------- Caminhão com guindaste articulado ---------- */
export function truck(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    // longarinas e para-lamas
    for (const sx of [-0.45, 0.45]) b.add(box(0.12, 0.28, 11.6), M.darkPaint, sx, 1.0, -1.1);
    // cabine
    b.at(0, 0, 4.65, 0, () => {
      b.add(rbox(2.5, 2.0, 2.2, 0.14), M.navyP, 0, 2.35, 0);
      b.add(rbox(2.52, 0.9, 1.85, 0.08), M.navyP, 0, 1.25, 0.12);
      b.add(box(2.2, 0.85, 0.04), M.glassM, 0, 2.75, 1.11);                   // para-brisa
      for (const sx of [-1.26, 1.26]) { b.add(box(0.03, 0.75, 1.05), M.glassM, sx, 2.75, 0.35); b.add(box(0.04, 0.05, 1.1), M.darkPaint, sx, 2.36, 0.35); }
      b.add(box(1.5, 0.6, 0.05), M.grille, 0, 1.55, 1.08);                     // grade
      for (let k = 0; k < 6; k++) b.add(box(1.5, 0.03, 0.06), M.chrome, 0, 1.3 + k * 0.1, 1.1);
      for (const sx of [-0.95, 0.95]) { b.add(rbox(0.36, 0.2, 0.06, 0.03), M.headlight, sx, 1.35, 1.1); b.add(rbox(0.36, 0.08, 0.06, 0.02), M.indicator, sx, 1.55, 1.1); }
      b.add(rbox(2.6, 0.3, 0.3, 0.06), M.darkPaint, 0, 0.82, 1.15);           // para-choque
      b.add(rbox(2.4, 0.22, 0.6, 0.06), M.darkPaint, 0, 3.45, -0.3);           // defletor
      for (const sx of [-1.4, 1.4]) {                                          // retrovisores
        b.rod(V(sx * 0.9, 2.55, 0.95), V(sx, 2.75, 1.0), 0.02, M.darkPaint);
        b.add(rbox(0.08, 0.38, 0.2, 0.02), M.darkPaint, sx, 2.75, 1.0);
      }
      for (const sx of [-1.15, 1.15]) for (let k = 0; k < 2; k++) b.add(box(0.36, 0.04, 0.24), M.steelM, sx, 0.62 + k * 0.32, 0.25); // degraus
      b.add(cyl(0.3, 0.3, 0.9, 20), M.chrome, 1.0, 0.95, -1.6, Math.PI / 2);   // tanque
      b.add(cyl(0.09, 0.09, 1.5, 12), M.chrome, -1.15, 3.0, -1.25);           // escape vertical
      b.add(rbox(0.4, 0.12, 0.12, 0.03), M.beacon, 0.6, 3.6, 0.1);
    });
    // rodas: pneu (toro + banda), aro, porcas
    const wheel = (wx, wz) => {
      b.add(cyl(0.53, 0.53, 0.36, 34), M.tire, wx, 0.53, wz, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) b.add(tor(0.43, 0.1, 10, 34), M.tire, wx + s * 0.13, 0.53, wz, 0, Math.PI / 2);
      b.add(cyl(0.3, 0.3, 0.38, 26), M.rim, wx, 0.53, wz, 0, 0, Math.PI / 2);
      b.add(cyl(0.11, 0.13, 0.42, 16), M.darkPaint, wx, 0.53, wz, 0, 0, Math.PI / 2);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; b.add(cyl(0.022, 0.022, 0.44, 6), M.chrome, wx, 0.53 + Math.sin(a) * 0.19, wz + Math.cos(a) * 0.19, 0, 0, Math.PI / 2); }
    };
    for (const wz of [4.6, -2.3, -3.65, -5.0]) for (const wx of [-1.06, 1.06]) wheel(wx, wz);
    for (const wz of [-2.3, -3.65, -5.0]) for (const wx of [-0.74, 0.74]) wheel(wx, wz);
    b.add(rbox(2.6, 0.08, 4.4, 0.03), M.darkPaint, 0, 1.18, -3.65);           // para-lamas traseiro
    // carroceria com fueiros
    b.add(rbox(2.55, 0.22, 8.8, 0.03), M.navyP, 0, 1.35, -1.8);
    for (let k = 0; k < 14; k++) b.add(box(2.5, 0.05, 0.08), M.steelM, 0, 1.47, -6.0 + k * 0.62);
    for (const sx of [-1.22, 1.22]) for (let k = 0; k < 5; k++) b.add(box(0.09, 1.25, 0.09), M.yellowP, sx, 2.05, 2.0 - k * 1.9);
    b.add(rbox(2.6, 0.12, 0.14, 0.03), M.hazard, 0, 1.2, -6.25);
    for (const sx of [-0.9, 0.9]) b.add(rbox(0.3, 0.12, 0.05, 0.02), M.tailLight, sx, 1.2, -6.33);
    // guindaste articulado recolhido atrás da cabine
    b.at(0, 1.47, 2.9, 0, () => {
      b.add(rbox(1.6, 0.35, 0.9, 0.04), M.darkPaint, 0, 0.17, 0);
      b.add(cyl(0.38, 0.42, 0.9, 22), M.yellowP, 0, 0.8, 0);
      b.add(rbox(0.5, 1.5, 0.5, 0.06), M.yellowP, 0, 1.75, 0);
      b.add(rbox(0.42, 0.42, 4.6, 0.06), M.yellowP, 0, 2.55, -1.9, -0.06);
      b.add(rbox(0.34, 0.34, 3.6, 0.05), M.yellowP, 0, 2.15, -1.4, 0.04);
      b.rod(V(0, 0.9, 0.2), V(0, 2.4, -0.9), 0.08, M.chrome);
      for (const sx of [-1.25, 1.25]) { b.add(rbox(0.25, 0.25, 0.25, 0.04), M.darkPaint, sx, 0.15, 0); b.add(cyl(0.06, 0.06, 0.9, 10), M.chrome, sx, -0.4, 0); }
    });
  });
}

/* ---------- Acessórios do canteiro ---------- */
export function cone(b, M, x, z) {
  b.add(rbox(0.38, 0.04, 0.38, 0.02), M.coneBase, x, 0.02, z);
  b.add(cyl(0.025, 0.16, 0.7, 20), M.coneOrange, x, 0.39, z);
  for (const y of [0.42, 0.58]) b.add(cyl(0.11 - (y - 0.39) * 0.2, 0.12 - (y - 0.39) * 0.2, 0.07, 20), M.reflective, x, y, z);
}
export function barrier(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    b.add(rbox(2.0, 0.8, 0.45, 0.08), M.barrierWhite, 0, 0.4, 0);
    for (let k = 0; k < 4; k++) b.add(box(0.28, 0.82, 0.47), M.barrierRed, -0.75 + k * 0.5, 0.4, 0, 0, 0, 0.5);
  });
}
export function lightTower(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    b.add(rbox(1.4, 1.1, 2.4, 0.08), M.yellowP, 0, 0.95, 0);
    for (const sx of [-0.7, 0.7]) b.add(cyl(0.3, 0.3, 0.2, 20), M.tire, sx, 0.3, 0.3, 0, 0, Math.PI / 2);
    b.add(cyl(0.07, 0.09, 8.5, 12), M.steelM, 0, 5.6, -0.6);
    b.add(box(1.8, 0.08, 0.08), M.steelM, 0, 9.6, -0.6);
    for (let k = 0; k < 4; k++) { b.add(rbox(0.42, 0.32, 0.18, 0.03), M.darkPaint, -0.7 + k * 0.47, 9.85, -0.5, -0.3); b.add(box(0.36, 0.26, 0.02), M.lamp, -0.7 + k * 0.47, 9.85, -0.4, -0.3); }
  });
}
export function office(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    b.add(box(6.06, 2.6, 2.44), M.whiteP, 0, 1.6, 0);
    for (let k = 0; k < 14; k++) b.add(box(0.06, 2.5, 2.46), M.whiteP, -2.9 + k * 0.45, 1.6, 0);
    b.add(box(6.1, 0.15, 2.5), M.darkPaint, 0, 0.25, 0);
    b.add(box(6.1, 0.12, 2.5), M.darkPaint, 0, 2.95, 0);
    for (const sx of [-1.8, 1.2]) { b.add(box(1.1, 0.8, 0.05), M.glassM, sx, 1.9, 1.23); b.add(box(1.2, 0.9, 0.03), M.darkPaint, sx, 1.9, 1.22); }
    b.add(box(0.85, 2.0, 0.05), M.navyP, -0.3, 1.32, 1.23);
    b.add(rbox(0.6, 0.5, 0.28, 0.04), M.whiteP, 2.3, 2.3, 1.36);
    for (let k = 0; k < 3; k++) b.add(box(1.0, 0.05, 0.3), M.steelM, -0.3, 0.12 + k * 0.0 + 0.0, 1.45 + k * 0.3);
    b.add(rbox(1.3, 0.35, 0.03, 0.02), M.sign, -1.8, 2.55, 1.25);
  });
}
export function spool(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    for (const s of [-0.45, 0.45]) b.add(cyl(0.75, 0.75, 0.06, 30), M.woodM, s, 0.75, 0, 0, 0, Math.PI / 2);
    b.add(cyl(0.5, 0.5, 0.86, 26), M.cable, 0, 0.75, 0, 0, 0, Math.PI / 2);
  });
}
export function pallet(b, M, x, z, ry) {
  b.at(x, 0, z, ry, () => {
    for (const sx of [-0.5, 0, 0.5]) b.add(box(0.1, 0.1, 1.2), M.woodM, sx, 0.05, 0);
    for (let k = 0; k < 7; k++) b.add(box(1.2, 0.025, 0.12), M.woodM, 0, 0.11, -0.54 + k * 0.18);
  });
}
/* Feixe de vergalhões/cordoalhas em rolo */
export function coil(b, M, x, z) {
  for (let k = 0; k < 14; k++) b.add(tor(0.55, 0.035, 6, 30), M.strand, x, 0.06 + k * 0.05, z, Math.PI / 2, 0, (k % 2) * 0.05);
  b.add(cyl(0.4, 0.4, 0.72, 18), M.darkPaint, x, 0.36, z);
}
