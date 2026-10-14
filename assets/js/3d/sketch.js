/* Renderização em rascunho técnico: contornos por profundidade/normais com traço trêmulo,
   hachura a partir da luz da cena e papel (grafite) ou prancha azul (blueprint). */
import * as THREE from "three";

const QUAD_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

const SKETCH_FS = /* glsl */`
precision highp float;
uniform sampler2D tLit, tNormal, tDepth;
uniform vec2 res;
uniform float near, far, px, seed, hatch, fadeNear, fadeFar, grid, inkAlpha, accentK;
uniform vec3 paper, ink, accent;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float viewZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float z = d * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near)); }
vec3 nrm(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

/* contorno numa posição (já deslocada pelo tremor) */
float edgeAt(vec2 uv, float w){
  vec2 o = w * px / res;
  float z = viewZ(uv); vec3 n = nrm(uv);
  float de = 0.0, ne = 0.0;
  vec2 offs[8]; offs[0]=vec2(1,0); offs[1]=vec2(-1,0); offs[2]=vec2(0,1); offs[3]=vec2(0,-1);
  offs[4]=vec2(1,1); offs[5]=vec2(-1,-1); offs[6]=vec2(1,-1); offs[7]=vec2(-1,1);
  for (int i = 0; i < 8; i++) {
    vec2 q = uv + offs[i] * o;
    float zq = viewZ(q);
    de = max(de, abs(zq - z) / max(z, 0.5));
    ne = max(ne, 1.0 - dot(n, nrm(q)));
  }
  float e1 = smoothstep(0.018, 0.06, de);
  float e2 = smoothstep(0.25, 0.6, ne);
  return max(e1, e2 * 0.85);
}

void main(){
  vec2 frag = vUv * res;
  // tremor da mão: desloca a leitura com ruído de baixa frequência
  vec2 wob = (vec2(noise(frag * 0.012 + 3.1), noise(frag * 0.012 + 7.7)) - 0.5) * 2.2 * px;
  vec2 uv1 = vUv + wob / res;
  vec2 uv2 = vUv + (wob * -0.8 + vec2(noise(frag * 0.03), noise(frag * 0.03 + 9.0)) * 1.4 * px) / res;
  float zc = viewZ(vUv);
  float isBg = step(far * 0.98, zc);
  float fade = 1.0 - smoothstep(fadeNear, fadeFar, zc);

  float e = max(edgeAt(uv1, 1.0), edgeAt(uv2, 1.0) * 0.55);
  e *= mix(0.65, 1.0, noise(frag * 0.08));                 // pressão variável do lápis

  // tom a partir da cena iluminada
  vec3 lit = texture2D(tLit, vUv).rgb;
  float L = dot(1.0 - exp(-lit * 1.6), vec3(0.3, 0.59, 0.11));
  float jit = (noise(frag * 0.05) - 0.5) * 0.12;
  vec2 p = frag / px;
  float sp = 6.5;
  vec3 nC = nrm(vUv);
  float floorK = mix(1.0, 0.18, smoothstep(0.75, 0.95, nC.y));        // chão quase sem hachura
  float line1 = 1.0 - smoothstep(0.06, 0.16, abs(fract((p.x + p.y + noise(p * 0.02) * 6.0) / sp) - 0.5));
  float line2 = 1.0 - smoothstep(0.06, 0.16, abs(fract((p.x - p.y + noise(p * 0.02 + 5.0) * 6.0) / sp) - 0.5));
  float h1 = smoothstep(0.32, 0.2, L + jit) * line1;
  float h2 = smoothstep(0.09, 0.04, L + jit) * line2;
  float hatchAmt = max(h1 * 0.4, h2 * 0.32) * hatch * floorK * mix(0.55, 1.0, noise(p * 0.05));

  // destaque: pinturas amarelas (equipamentos) recebem um véu de cor
  float sat = max(lit.r, max(lit.g, lit.b)) - min(lit.r, min(lit.g, lit.b));
  float mx = max(lit.r, max(lit.g, lit.b));
  float yellow = smoothstep(0.35, 0.6, sat / max(mx, 1e-3)) * step(0.12, mx) * step(lit.b * 2.2, lit.g) * smoothstep(0.55, 0.85, lit.g / max(lit.r, 1e-3)) * (1.0 - smoothstep(0.75, 0.95, nC.y));

  float inkAmt = clamp(max(e, hatchAmt), 0.0, 1.0) * fade * (1.0 - isBg) * inkAlpha;

  // papel: fibras e grão; prancha: grade técnica
  float grain = (noise(frag * 0.9) - 0.5) * 0.04 + (noise(frag * vec2(0.02, 0.6)) - 0.5) * 0.025;
  vec3 base = paper + grain;
  if (grid > 0.0) {
    vec2 g = abs(fract(frag / (48.0 * px)) - 0.5);
    base = mix(base, ink, 0.035 * grid * step(0.488, max(g.x, g.y)));
  }
  vec3 col = mix(base, accent, yellow * fade * (1.0 - isBg) * accentK);
  col = mix(col, ink, inkAmt);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createSketch(renderer, scene, camera, style = "blueprint") {
  const S = {
    blueprint: { paper: 0x0d2747, ink: 0xd3e2f3, accent: 0xffcc00, grid: 1, hatch: 0.6, inkAlpha: 0.9, accentK: 0.1 },
    paper:     { paper: 0xf1ede4, ink: 0x1d2b3d, accent: 0xf2b400, grid: 0, hatch: 0.8, inkAlpha: 0.88, accentK: 0.16 },
  }[style];
  const opts = { type: THREE.HalfFloatType };
  let rtLit = null, rtNor = null;
  const normalMat = new THREE.MeshNormalMaterial();
  const quadMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VS, fragmentShader: SKETCH_FS, depthTest: false, depthWrite: false,
    uniforms: {
      tLit: { value: null }, tNormal: { value: null }, tDepth: { value: null },
      res: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far },
      px: { value: 1 }, seed: { value: 3.7 }, hatch: { value: S.hatch }, grid: { value: S.grid }, inkAlpha: { value: S.inkAlpha }, accentK: { value: S.accentK },
      fadeNear: { value: 38 }, fadeFar: { value: 120 },
      paper: { value: new THREE.Color(S.paper) }, ink: { value: new THREE.Color(S.ink) }, accent: { value: new THREE.Color(S.accent) },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
  const quadScene = new THREE.Scene(); quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function setSize(w, h) {
    const pr = renderer.getPixelRatio(), W = Math.round(w * pr), H = Math.round(h * pr);
    rtLit?.dispose(); rtNor?.dispose();
    rtLit = new THREE.WebGLRenderTarget(W, H, opts);
    rtNor = new THREE.WebGLRenderTarget(W, H, opts);
    rtNor.depthTexture = new THREE.DepthTexture(W, H); rtNor.depthTexture.type = THREE.UnsignedIntType;
    quadMat.uniforms.res.value.set(W, H);
    quadMat.uniforms.px.value = pr;
  }
  function render() {
    const tm = renderer.toneMapping;
    renderer.setRenderTarget(rtLit); renderer.render(scene, camera);
    const bg = scene.background, fog = scene.fog;
    scene.overrideMaterial = normalMat; scene.background = null; scene.fog = null;
    renderer.setRenderTarget(rtNor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
    scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    quadMat.uniforms.tLit.value = rtLit.texture; quadMat.uniforms.tNormal.value = rtNor.texture; quadMat.uniforms.tDepth.value = rtNor.depthTexture;
    quadMat.uniforms.near.value = camera.near; quadMat.uniforms.far.value = camera.far;
    renderer.setRenderTarget(null); renderer.toneMapping = THREE.NoToneMapping;
    renderer.render(quadScene, quadCam);
    renderer.toneMapping = tm;
  }
  return { setSize, render, uniforms: quadMat.uniforms };
}
