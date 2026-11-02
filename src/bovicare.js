/* ============================================================
   BOVICARE — brete de contenção inteligente · modelo 3D interativo
   Unidades em metros. Frente (contenção de cabeça) em +X, altura em +Y.
   Lado de apresentação em -Z.
   Motor (câmera, interface, simulação) compartilhado com o SafeBov.
   ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DS = -1;                       // lado de apresentação
const FLOOR = 0.14;                  // altura do piso interno
const DOOR_ANG = THREE.MathUtils.degToRad(100);
const REAR_ANG = THREE.MathUtils.degToRad(100);
const TILT_ANG = THREE.MathUtils.degToRad(80);
const HEAD_CLOSED = 0.125, HEAD_OPEN = 0.27;
const BELLY_LOW = 0.12, BELLY_HIGH = 0.725;
const COW_HOME = 0.70, COW_START = -4.0;
const UP = new THREE.Vector3(0, 1, 0);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const lerp = THREE.MathUtils.lerp;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 2.2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- renderizador / cena ---------- */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.0;
controls.maxDistance = 15;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight(0xf3f7f1, 0x6f6b60, 0.85));
const key = new THREE.DirectionalLight(0xfff4e6, 2.7);
key.position.set(3.2, 6.8, -4.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 22 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);
const fill = new THREE.DirectionalLight(0xe2ecff, 0.75);
fill.position.set(-5, 3.5, 4);
scene.add(fill);

/* ---------- texturas procedurais ---------- */
function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
function repeatOf(tex, rx, ry) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
// piso modular: pinos + juntas das placas
const studBump = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, w, w);
  g.filter = 'blur(1px)';
  g.fillStyle = '#ededed';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    g.beginPath(); g.arc(i * w / 8 + w / 16 + (j % 2 ? w / 16 : 0), j * w / 8 + w / 16, w / 34, 0, Math.PI * 2); g.fill();
  }
  g.filter = 'none';
  g.fillStyle = '#2a2a2a';
  g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, w);
}, { srgb: false });
const groundTex = canvasTex(512, 512, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(110,96,74,0.30)');
  r.addColorStop(0.55, 'rgba(110,96,74,0.13)');
  r.addColorStop(1, 'rgba(110,96,74,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const woodTex = canvasTex(512, 128, (g, w, h) => {
  const R = rng(7);
  g.fillStyle = '#8a5a34'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    const y = R() * h, a = 0.05 + R() * 0.12;
    g.strokeStyle = R() > 0.5 ? `rgba(60,34,16,${a})` : `rgba(196,140,90,${a})`;
    g.lineWidth = 1 + R() * 3;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x / 70 + i) * 3 + (R() - 0.5) * 2);
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const x = R() * w, y = R() * h;
    g.fillStyle = 'rgba(70,40,18,0.35)';
    g.beginPath(); g.ellipse(x, y, 10 + R() * 8, 4, 0, 0, Math.PI * 2); g.fill();
  }
});
// pelagem Hereford: corpo castanho, linha inferior e manchas brancas
const coatTex = canvasTex(1024, 512, (g, w, h) => {
  const R = rng(11);
  g.fillStyle = '#8c4524'; g.fillRect(0, 0, w, h);
  g.filter = 'blur(10px)';
  g.fillStyle = '#efe8dc';
  g.beginPath();
  g.moveTo(w * 0.15, 0);
  for (let y = 0; y <= h; y += 32) g.lineTo(w * (0.15 + R() * 0.03), y);
  g.lineTo(w * 0.36, h);
  for (let y = h; y >= 0; y -= 32) g.lineTo(w * (0.34 + R() * 0.03), y);
  g.fill();
  g.fillRect(0, 0, w, h * 0.12);                              // peito
  for (const [u, v, rx] of [[0.56, 0.45, 90], [0.47, 0.72, 62], [0.63, 0.66, 46], [0.05, 0.50, 80], [0.94, 0.40, 70], [0.80, 0.80, 40]]) {
    g.beginPath(); g.ellipse(u * w, v * h, rx, rx * 0.5, (R() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
  }
});
const plateCanvas = document.createElement('canvas');
plateCanvas.width = 512; plateCanvas.height = 80;
function drawPlate() {
  const g = plateCanvas.getContext('2d');
  g.fillStyle = '#163222'; g.fillRect(0, 0, 512, 80);
  g.fillStyle = '#efe9da';
  g.font = '700 50px "Playfair Display", Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BOVICARE', 256, 43);
}
drawPlate();
const plateTex = new THREE.CanvasTexture(plateCanvas);
plateTex.colorSpace = THREE.SRGBColorSpace;

/* ---------- materiais ---------- */
const M = {
  green: new THREE.MeshStandardMaterial({ name: 'Aço com pintura epóxi verde', color: 0x1f4a30, metalness: 0.4, roughness: 0.42 }),
  greenPanel: new THREE.MeshStandardMaterial({ name: 'Chapa verde', color: 0x24563a, metalness: 0.3, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ name: 'Aço preto', color: 0x1b1d1c, metalness: 0.5, roughness: 0.45 }),
  galv: new THREE.MeshStandardMaterial({ name: 'Aço galvanizado', color: 0xaab1b4, metalness: 0.9, roughness: 0.3 }),
  wood: new THREE.MeshStandardMaterial({ name: 'Madeira plástica', map: woodTex, roughness: 0.72, metalness: 0 }),
  red: new THREE.MeshStandardMaterial({ name: 'Manopla vermelha', color: 0xc0262d, roughness: 0.35, metalness: 0.1 }),
  pad: new THREE.MeshStandardMaterial({ name: 'Acolchoamento EVA', color: 0x1a1b1c, roughness: 0.62 }),
  inox: new THREE.MeshStandardMaterial({ name: 'Aço inoxidável', color: 0xdfe3e6, metalness: 1, roughness: 0.2 }),
  water: new THREE.MeshStandardMaterial({ name: 'Água', color: 0x6fa8c8, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.75 }),
  feed: new THREE.MeshStandardMaterial({ name: 'Ração', color: 0x9c7a46, roughness: 0.95 }),
  lampBody: new THREE.MeshStandardMaterial({ name: 'Luminária', color: 0x232526, metalness: 0.6, roughness: 0.35 }),
  lamp: new THREE.MeshStandardMaterial({ name: 'LED', color: 0xf4f1ea, emissive: 0xfff3d6, emissiveIntensity: 0, roughness: 0.3 }),
  plate: new THREE.MeshStandardMaterial({ name: 'Placa BOVICARE', map: plateTex, roughness: 0.5, metalness: 0.2 }),
};
const floorMat = new THREE.MeshStandardMaterial({ name: 'Piso emborrachado modular', color: 0x1c1d1e, roughness: 0.9, bumpMap: repeatOf(studBump, 14, 3), bumpScale: 2.5 });

/* ---------- utilitários de geometria ---------- */
const geoCache = new Map();
function boxGeo(w, h, d, r) {
  const k = [w, h, d, r].map((v) => v.toFixed(4)).join('|');
  if (!geoCache.has(k)) {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 1e-4);
    geoCache.set(k, rr > 0.0005 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d));
  }
  return geoCache.get(k);
}
function sh(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function box(parent, w, h, d, mat, x, y, z, r = 0.007) {
  const m = sh(new THREE.Mesh(boxGeo(w, h, d, r), mat));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function rod(parent, a, b, r, mat, seg = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const m = sh(new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(m);
  return m;
}
function pipe(parent, pts, r, mat) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const m = sh(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 14), r, 12, false), mat));
  parent.add(m);
  return m;
}
function actuator(parent, barrelLen, rb = 0.032, rr = 0.015) {
  const g = new THREE.Group();
  g.name = 'Cilindro hidráulico';
  g.userData.noMerge = true;
  parent.add(g);
  const barrel = sh(new THREE.Mesh(new THREE.CylinderGeometry(rb, rb, barrelLen, 22), M.green));
  barrel.position.y = barrelLen / 2;
  const capA = sh(new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.12, rb * 1.12, 0.03, 22), M.galv));
  capA.position.y = 0.015;
  const capB = capA.clone(); capB.position.y = barrelLen - 0.015;
  const rodM = sh(new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 1, 14), M.chrome));
  const eye = sh(new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.6, rr * 1.6, 0.03, 14), M.galv));
  g.add(barrel, capA, capB, rodM, eye);
  const d = new THREE.Vector3();
  return {
    group: g,
    update(A, B) {
      d.copy(B).sub(A);
      const L = d.length();
      g.position.copy(A);
      g.quaternion.setFromUnitVectors(UP, d.normalize());
      const rl = Math.max(0.02, L - barrelLen + 0.03);
      rodM.scale.y = rl;
      rodM.position.y = L - rl / 2;
      eye.position.y = L;
    },
  };
}

/* ---------- partes ---------- */
const model = new THREE.Group();
model.name = 'BOVICARE – brete de contenção inteligente';
scene.add(model);
const parts = {};
function part(id, name, parent = model) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.part = id;
  parent.add(g);
  (parts[id] ||= []).push(g);
  return g;
}
function group(parent, name, noMerge = false) {
  const g = new THREE.Group();
  g.name = name;
  if (noMerge) g.userData.noMerge = true;
  parent.add(g);
  return g;
}
// manopla vermelha: haste preta + bola vermelha
function knob(parent, a, b, r = 0.022) {
  rod(parent, a, b, 0.009, M.black, 10);
  const k = sh(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), M.red));
  k.position.set(...b);
  parent.add(k);
}
function planks(parent, x0, x1, y0, y1, n, z, gap = 0.025) {
  const h = (y1 - y0 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) box(parent, x1 - x0, h, 0.035, M.wood, (x0 + x1) / 2, y0 + h / 2 + i * (h + gap), z, 0);
}

const T = 0.08, PZ = 0.41;
const POSTS = [-1.71, -0.75, 0.20, 1.15, 1.71];

/* Estrutura */
const frame = part('estrutura', 'Estrutura');
for (const s of [-1, 1]) {
  box(frame, 3.50, 0.12, 0.08, M.black, 0, 0.06, s * PZ);
  for (const x of POSTS) {
    box(frame, T, 1.98, T, M.green, x, 0.12 + 0.99, s * PZ);
    box(frame, 0.16, 0.012, 0.16, M.black, x, 0.006, s * PZ, 0.003);
  }
  box(frame, 3.50, T, T, M.green, 0, 2.06, s * PZ);
  box(frame, 3.42, 0.05, 0.05, M.green, 0, 1.84, s * PZ);
  // baia traseira (fixa): chapa verde + madeira
  box(frame, 0.88, 0.40, 0.02, M.greenPanel, -1.23, 0.36, s * 0.43, 0.004);
  box(frame, 0.88, 0.05, 0.05, M.green, -1.23, 0.60, s * PZ);
  planks(frame, -1.67, -0.79, 0.64, 1.80, 5, s * 0.415);
  // baia dianteira: chapa verde inferior
  box(frame, 0.87, 0.40, 0.02, M.greenPanel, 0.675, 0.36, s * 0.43, 0.004);
  box(frame, 0.87, 0.05, 0.05, M.green, 0.675, 0.60, s * PZ);
  box(frame, 0.87, 0.05, 0.05, M.green, 0.675, 1.055, s * PZ);
  // baia da cabeça
  box(frame, 0.48, 0.40, 0.02, M.greenPanel, 1.43, 0.36, s * 0.43, 0.004);
  for (const y of [0.60, 1.055, 1.30, 1.57]) box(frame, 0.48, 0.045, 0.045, M.green, 1.43, y, s * PZ);
  // dobradiças das portas laterais
  for (const y of [0.40, 1.55]) box(frame, 0.05, 0.06, 0.03, M.black, -0.69, y, s * 0.465, 0.004);
}
for (const x of [...POSTS, 0.80]) box(frame, T, T, 0.74, M.green, x, 2.06, 0);
for (const x of POSTS) box(frame, T, 0.10, 0.74, M.black, x, 0.05, 0);
box(frame, 3.34, 0.06, 0.06, M.black, 0, 2.07, 0);                                   // viga central superior
for (const y of [0.45, 1.65]) box(frame, 0.04, 0.06, 0.05, M.black, -1.77, y, -DS * 0.43, 0.004); // dobradiças traseiras
const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.075), M.plate);
plate.rotation.y = DS < 0 ? Math.PI : 0;
plate.position.set(0.68, 2.06, DS * 0.4515);
frame.add(plate);

/* Piso */
const floor = part('piso', 'Piso emborrachado');
box(floor, 3.42, 0.03, 0.74, floorMat, 0, 0.125, 0, 0);

/* Contenção de cabeça */
const head = part('cabeca', 'Contenção de cabeça');
box(head, 0.06, 0.10, 0.98, M.black, 1.80, 1.98, 0);
box(head, 0.06, 0.06, 0.98, M.black, 1.80, 0.17, 0);
knob(head, [1.84, 2.03, DS * 0.47], [1.95, 2.03, DS * 0.47]);
function padGeo() {
  const p = new THREE.Shape();
  const r = 0.07;
  p.moveTo(0.0, 0.95 + r);
  p.quadraticCurveTo(0.0, 0.95, r, 0.95);
  p.lineTo(0.19 - r, 0.95);
  p.quadraticCurveTo(0.19, 0.95, 0.20, 0.95 + r);
  p.quadraticCurveTo(0.215, 1.40, 0.20, 1.86 - r);
  p.quadraticCurveTo(0.20, 1.86, 0.20 - r, 1.86);
  p.lineTo(r, 1.86);
  p.quadraticCurveTo(0.0, 1.86, 0.0, 1.86 - r);
  p.quadraticCurveTo(-0.02, 1.40, 0.0, 0.95 + r);
  const g = new THREE.ExtrudeGeometry(p, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.022, bevelSegments: 5, curveSegments: 10 });
  g.rotateY(-Math.PI / 2);
  return g;
}
const padG = padGeo();
function buildHalf(s) {
  const g = new THREE.Group();
  g.name = s > 0 ? 'Folha da contenção (esq.)' : 'Folha da contenção (dir.)';
  const H0 = 0.21, H1 = 1.92, W = 0.22;
  box(g, 0.045, H1 - H0, 0.045, M.green, 0, (H0 + H1) / 2, 0.0225);
  box(g, 0.045, H1 - H0, 0.045, M.green, 0, (H0 + H1) / 2, W - 0.0225);
  for (const y of [0.24, 0.80, 1.89]) box(g, 0.04, 0.04, W, M.green, 0, y, W / 2);
  const c = sh(new THREE.Mesh(padG, M.pad));
  c.position.x = 0.075;
  g.add(c);
  box(g, 0.07, 0.90, 0.05, M.pad, 0.01, 1.20, 0.0, 0.022);
  if (s < 0) g.scale.z = -1;
  head.add(g);
  return g;
}
const halves = { 1: buildHalf(1), [-1]: buildHalf(-1) };
halves[1].position.x = halves[-1].position.x = 1.80;

/* Ajuste de largura e altura */
const adj = part('ajuste', 'Ajuste de largura e altura');
box(adj, 0.10, 0.08, 1.12, M.black, 1.60, 2.17, 0, 0.01);
for (const s of [-1, 1]) {
  box(adj, 0.06, 0.07, 0.06, M.black, 1.60, 2.115, s * PZ, 0.006);
  rod(adj, [1.60, 2.10, s * 0.25], [1.60, 2.30, s * 0.25], 0.012, M.galv, 12);
  box(adj, 0.05, 0.03, 0.05, M.black, 1.60, 2.29, s * 0.25, 0.006);
  rod(adj, [1.60, 2.17, s * 0.56], [1.60, 2.17, s * 0.63], 0.012, M.black, 10);
  knob(adj, [1.60, 2.17, s * 0.63], [1.72, 2.17, s * 0.63], 0.024);
}

/* Painéis laterais móveis (portas da baia central) */
const doorsG = part('paineis', 'Painéis laterais móveis');
const doors = [];
for (const s of [-1, 1]) {
  const pivot = group(doorsG, `Painel lateral ${s === DS ? '(lado do operador)' : '(lado oposto)'}`);
  pivot.position.set(-0.71, 0, s * 0.455);
  const w = 0.87, y0 = 0.16, y1 = 1.80, cx = w / 2;
  box(pivot, 0.05, y1 - y0, 0.05, M.green, 0.025, (y0 + y1) / 2, 0);
  box(pivot, 0.05, y1 - y0, 0.05, M.green, w - 0.025, (y0 + y1) / 2, 0);
  for (const y of [y0 + 0.025, 0.95, y1 - 0.025]) box(pivot, w, 0.05, 0.05, M.green, cx, y, 0);
  for (const y of [1.21, 1.47]) box(pivot, w - 0.05, 0.04, 0.04, M.green, cx, y, 0);
  planks(pivot, 0.05, w - 0.05, 0.21, 0.92, 3, 0);
  for (const y of [0.40, 1.55]) rod(pivot, [0, y - 0.05, s * 0.03], [0, y + 0.05, s * 0.03], 0.017, M.black);
  box(pivot, 0.04, 0.07, 0.035, M.black, w - 0.03, 1.05, s * 0.035, 0.005);
  knob(pivot, [w - 0.03, 1.05, s * 0.05], [w - 0.03, 1.05, s * 0.13]);
  doors.push({ pivot, sign: -s });
}

/* Porta lateral basculante (alto da baia dianteira) */
const tiltG = part('basculante', 'Porta lateral basculante');
const tilts = [];
for (const s of [-1, 1]) {
  const pivot = group(tiltG, `Porta basculante ${s === DS ? '(lado do operador)' : '(lado oposto)'}`);
  pivot.position.set(0.675, 1.085, s * 0.455);
  const w = 0.82, h = 0.70;
  box(pivot, w, 0.045, 0.045, M.green, 0, 0.0225, 0);
  box(pivot, w, 0.045, 0.045, M.green, 0, h - 0.0225, 0);
  for (const x of [-w / 2 + 0.0225, w / 2 - 0.0225]) box(pivot, 0.045, h, 0.045, M.green, x, h / 2, 0);
  for (let i = 1; i <= 5; i++) box(pivot, 0.03, h - 0.06, 0.03, M.green, -w / 2 + i * w / 6, h / 2, 0);
  box(pivot, w - 0.05, 0.035, 0.035, M.green, 0, h / 2, 0);
  for (const x of [-0.28, 0.28]) rod(pivot, [x - 0.05, 0, s * 0.028], [x + 0.05, 0, s * 0.028], 0.015, M.black);
  knob(pivot, [0, h - 0.02, s * 0.03], [0, h + 0.06, s * 0.10]);
  tilts.push({ pivot, sign: s });
}

/* Porta traseira ampla */
const rearG = part('traseira', 'Porta traseira');
const rearPivot = group(rearG, 'Folha da porta traseira');
rearPivot.position.set(-1.79, 0, -DS * 0.41);
{
  const u = (v) => DS * v;
  const y0 = 0.16, y1 = 1.90, W = 0.82;
  for (const v of [0.025, W - 0.025]) box(rearPivot, 0.05, y1 - y0, 0.05, M.green, 0, (y0 + y1) / 2, u(v));
  for (const y of [y0 + 0.025, 1.02, y1 - 0.025]) box(rearPivot, 0.05, 0.05, W, M.green, 0, y, u(W / 2));
  box(rearPivot, 0.02, 0.80, W - 0.06, M.greenPanel, 0, 0.60, u(W / 2), 0.004);
  box(rearPivot, 0.025, 0.56, W - 0.26, M.green, -0.012, 0.60, u(W / 2), 0.006);
  for (let i = 1; i < 8; i++) rod(rearPivot, [0, 1.045, u(W * i / 8)], [0, 1.85, u(W * i / 8)], 0.009, M.green, 8);
  for (let y = 1.20; y < 1.84; y += 0.16) rod(rearPivot, [0, y, u(0.05)], [0, y, u(W - 0.05)], 0.009, M.green, 8);
  for (const y of [0.45, 1.65]) rod(rearPivot, [0, y - 0.05, 0], [0, y + 0.05, 0], 0.02, M.black);
  box(rearPivot, 0.035, 0.07, 0.04, M.black, -0.03, 1.05, u(W - 0.03), 0.005);
  knob(rearPivot, [-0.05, 1.05, u(W - 0.03)], [-0.13, 1.05, u(W - 0.03)]);
}

/* Sistema de elevação abdominal */
const belly = part('abdominal', 'Elevação abdominal');
const BELLY_X = 0.80;
const roller = group(belly, 'Rolo do guincho');
roller.position.set(BELLY_X, 1.965, 0);
{
  const cyl = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.80, 20), M.black));
  cyl.rotation.x = Math.PI / 2;
  roller.add(cyl);
  for (const s of [-1, 1]) {
    const d = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), M.green));
    d.rotation.x = Math.PI / 2;
    d.position.z = s * 0.37;
    roller.add(d);
  }
}
for (const s of [-1, 1]) box(belly, 0.06, 0.10, 0.04, M.black, BELLY_X, 2.0, s * 0.395, 0.006);
rod(belly, [BELLY_X, 1.965, DS * 0.40], [BELLY_X, 1.965, DS * 0.52], 0.012, M.black, 10);
rod(belly, [BELLY_X, 1.965, DS * 0.52], [BELLY_X, 1.83, DS * 0.52], 0.01, M.black, 10);
knob(belly, [BELLY_X, 1.83, DS * 0.52], [BELLY_X, 1.83, DS * 0.60], 0.024);
const sling = group(belly, 'Cinta acolchoada');
sling.position.x = BELLY_X;
{
  const a = 0.31, b = 0.20, t = 0.045, n = 24;
  const p = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const th = -Math.PI / 2 + Math.PI * i / n; p[i ? 'lineTo' : 'moveTo'](a * Math.sin(th), b * (1 - Math.cos(th))); }
  for (let i = n; i >= 0; i--) { const th = -Math.PI / 2 + Math.PI * i / n; p.lineTo((a - t) * Math.sin(th), t + (b - t) * (1 - Math.cos(th))); }
  const g = new THREE.ExtrudeGeometry(p, { depth: 0.30, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.15, 0, 0);
  sling.add(sh(new THREE.Mesh(g, M.pad)));
  for (const s of [-1, 1]) box(sling, 0.30, 0.04, 0.03, M.galv, 0, b + 0.01, s * a, 0.006);
}
const strapG = group(belly, 'Fitas da cinta', true);
const straps = [];
for (const s of [-1, 1]) {
  const st = sh(new THREE.Mesh(new THREE.BoxGeometry(0.11, 1, 0.01), M.black));
  st.position.set(BELLY_X, 1, s * 0.315);
  strapG.add(st);
  straps.push(st);
}

/* Iluminação em LED */
const ledG = part('led', 'Iluminação em LED');
box(ledG, 0.56, 0.05, 0.14, M.lampBody, -0.15, 2.015, 0, 0.012);
const lampPanel = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.016, 0.10), M.lamp);
lampPanel.position.set(-0.15, 1.984, 0);
ledG.add(lampPanel);
const glow = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.75, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
glow.name = 'Facho de luz';
glow.position.set(-0.15, 1.10, 0);
glow.scale.set(1, 1, 0.6);
glow.raycast = () => {};
scene.add(glow);
const spot = new THREE.SpotLight(0xfff1d6, 0, 5, 0.8, 0.55, 1.0);
spot.position.set(-0.15, 1.96, 0);
spot.target.position.set(-0.05, 0.2, 0);
scene.add(spot, spot.target);

/* Cocho e bebedouro integrado */
const trough = part('cocho', 'Cocho e bebedouro');
box(trough, 0.20, 0.60, 0.60, M.greenPanel, 2.00, 0.30, 0, 0.01);
box(trough, 0.24, 0.03, 0.66, M.green, 2.00, 0.615, 0, 0.006);
{
  const x0 = 1.86, x1 = 2.14, z0 = -0.37, z1 = 0.37, yb = 0.63, yt = 0.85, t = 0.012;
  box(trough, x1 - x0, t, z1 - z0, M.inox, (x0 + x1) / 2, yb + t / 2, 0, 0.003);
  box(trough, t, yt - yb, z1 - z0, M.inox, x0 + t / 2, (yb + yt) / 2, 0, 0.003);
  box(trough, t, yt - yb, z1 - z0, M.inox, x1 - t / 2, (yb + yt) / 2, 0, 0.003);
  for (const z of [z0 + t / 2, 0, z1 - t / 2]) box(trough, x1 - x0, yt - yb, t, M.inox, (x0 + x1) / 2, (yb + yt) / 2, z, 0.003);
  for (const z of [z0, z1]) rod(trough, [x0, yt, z], [x1, yt, z], 0.009, M.inox, 10);
  for (const x of [x0, x1]) rod(trough, [x, yt, z0], [x, yt, z1], 0.009, M.inox, 10);
  box(trough, x1 - x0 - 0.03, 0.10, 0.35, M.feed, (x0 + x1) / 2, yb + 0.06, -0.19, 0.01);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.025, 0.35), M.water);
  w.rotation.x = -Math.PI / 2;
  w.position.set((x0 + x1) / 2, yt - 0.04, 0.19);
  trough.add(w);
  rod(trough, [2.10, 0.0, 0.32], [2.10, 0.95, 0.32], 0.011, M.inox, 12);           // entrada de água
  rod(trough, [2.10, 0.95, 0.32], [2.04, 0.95, 0.32], 0.011, M.inox, 12);
  box(trough, 0.05, 0.04, 0.04, M.inox, 2.03, 0.93, 0.32, 0.008);
}

/* ---------- animal ilustrativo (pelagem Hereford) ---------- */
const cow = new THREE.Group();
cow.name = 'Animal (ilustrativo)';
cow.userData.part = 'animal';
model.add(cow);
const legs = [];
{
  const coat = new THREE.MeshPhysicalMaterial({ name: 'Pelagem', map: coatTex, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc89a74) });
  const brown = new THREE.MeshPhysicalMaterial({ name: 'Pelagem castanha', color: 0x8c4524, roughness: 0.75, sheen: 0.6, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xc89a74) });
  const white = new THREE.MeshPhysicalMaterial({ name: 'Pelagem branca', color: 0xefe8dc, roughness: 0.78, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
  const muzzle = new THREE.MeshStandardMaterial({ name: 'Focinho', color: 0xd29c8c, roughness: 0.45 });
  const hoof = new THREE.MeshStandardMaterial({ name: 'Casco', color: 0x2a2420, roughness: 0.5 });
  const eyeM = new THREE.MeshStandardMaterial({ name: 'Olho', color: 0x050505, roughness: 0.1, metalness: 0.2 });
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const ell = (p, rx, ry, rz, x, y, z, mat = brown, rot = null) => {
    const m = sh(new THREE.Mesh(sphere, mat));
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    p.add(m);
    return m;
  };
  const prof = [[-0.97, 0.0], [-0.955, 0.12], [-0.92, 0.22], [-0.86, 0.29], [-0.75, 0.335], [-0.55, 0.35], [-0.30, 0.335], [0.0, 0.345], [0.30, 0.365], [0.52, 0.36], [0.66, 0.32], [0.76, 0.24], [0.81, 0.13], [0.825, 0.0]]
    ;
  const even = [];
  for (let i = 0; i <= 44; i++) {
    const x = lerp(prof[0][0], prof[prof.length - 1][0], i / 44);
    let k = 0;
    while (k < prof.length - 2 && prof[k + 1][0] < x) k++;
    const [xa, ra] = prof[k], [xb, rb] = prof[k + 1];
    even.push(new THREE.Vector2(i === 0 || i === 44 ? 0 : lerp(ra, rb, (x - xa) / (xb - xa)), x));
  }
  const bodyGeo = new THREE.LatheGeometry(even, 48);
  bodyGeo.rotateZ(-Math.PI / 2);
  const body = sh(new THREE.Mesh(bodyGeo, coat));
  body.scale.set(1, 1.04, 0.82);
  body.position.set(0, 1.0, 0);
  cow.add(body);
  ell(cow, 0.20, 0.24, 0.17, 0.66, 0.84, 0, white);
  ell(cow, 0.30, 0.22, 0.185, 0.86, 1.06, 0, brown, [0, 0, -0.38]);
  const hd = new THREE.Group();
  hd.position.set(1.08, 1.04, 0);
  hd.rotation.z = -0.55;
  cow.add(hd);
  ell(hd, 0.135, 0.13, 0.125, 0.05, 0.0, 0, white);
  const faceGeo = new THREE.CylinderGeometry(0.072, 0.112, 0.30, 28, 1, false);
  faceGeo.rotateZ(-Math.PI / 2);
  const face = sh(new THREE.Mesh(faceGeo, white));
  face.position.set(0.22, -0.01, 0);
  face.scale.set(1, 0.92, 1);
  hd.add(face);
  ell(hd, 0.066, 0.062, 0.076, 0.37, -0.012, 0, muzzle);
  ell(hd, 0.07, 0.035, 0.1, 0.0, 0.12, 0, white);
  for (const s of [-1, 1]) {
    ell(hd, 0.01, 0.01, 0.01, 0.432, 0.0, s * 0.03, hoof);
    ell(hd, 0.016, 0.016, 0.014, 0.11, 0.06, s * 0.098, eyeM);
    const ear = ell(hd, 0.028, 0.045, 0.105, 0.16, 0.05, s * 0.185, brown, [s * 0.3, 0, 0]);
    ear.name = 'Orelha';
  }
  const legDef = [[0.48, 0.14, 0, false], [0.48, -0.14, Math.PI, false], [-0.56, 0.14, Math.PI, true], [-0.56, -0.14, 0, true]];
  for (const [x, z, off, hind] of legDef) {
    const g = new THREE.Group();
    g.position.set(x, 0.86, z);
    cow.add(g);
    const up = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.44, 18), brown));
    up.position.y = -0.22;
    g.add(up);
    if (hind) ell(g, 0.16, 0.24, 0.12, -0.02, -0.04, 0); else ell(g, 0.11, 0.20, 0.10, 0.0, -0.08, 0);
    ell(g, 0.05, 0.05, 0.05, 0, -0.44, 0, white);
    const lo = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.36, 14), white));
    lo.position.y = -0.62;
    g.add(lo);
    const hf = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 0.06, 16), hoof));
    hf.position.y = -0.83;
    g.add(hf);
    legs.push({ g, off });
  }
  pipe(cow, [[-0.88, 1.22, 0], [-0.95, 1.05, 0], [-0.97, 0.80, 0], [-0.96, 0.52, 0]], 0.02, brown);
  ell(cow, 0.035, 0.09, 0.035, -0.96, 0.45, 0, white);
}

/* ---------- otimização: une peças fixas que compartilham material ---------- */
function mergeStatic(root) {
  const containers = [];
  root.traverse((o) => { if (!o.isMesh && !o.userData.noMerge) containers.push(o); });
  for (const g of containers) {
    const buckets = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.userData.part || c.children.length || !c.material.isMeshStandardMaterial || c.material.transparent) continue;
      if (!buckets.has(c.material)) buckets.set(c.material, []);
      buckets.get(c.material).push(c);
    }
    for (const [mat, list] of buckets) {
      if (list.length < 2) continue;
      let geos = list.map((m) => {
        m.updateMatrix();
        const ge = m.geometry.clone();
        ge.applyMatrix4(m.matrix);
        for (const k of Object.keys(ge.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ge.deleteAttribute(k);
        return ge;
      });
      if (geos.some((ge) => !ge.index)) geos = geos.map((ge) => (ge.index ? ge.toNonIndexed() : ge));
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mesh = sh(new THREE.Mesh(merged, mat));
      mesh.name = `${g.name || 'Peças'} · ${mat.name}`;
      list.forEach((m) => g.remove(m));
      g.add(mesh);
    }
  }
}

/* ---------- cotas ---------- */
const dims = new THREE.Group();
dims.name = 'Cotas';
scene.add(dims);
const dimMat = new THREE.MeshBasicMaterial({ color: 0x1d4a2c, toneMapped: false });
const extMat = new THREE.MeshBasicMaterial({ color: 0x1d4a2c, toneMapped: false, transparent: true, opacity: 0.35 });
const cone = new THREE.ConeGeometry(0.022, 0.07, 16);
function dimension(a, b, extA, extB, text) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  rod(dims, a, b, 0.0055, dimMat, 8).castShadow = false;
  const d = B.clone().sub(A).normalize();
  for (const [p, dir] of [[A, d.clone().negate()], [B, d]]) {
    const c = new THREE.Mesh(cone, dimMat);
    c.quaternion.setFromUnitVectors(UP, dir);
    c.position.copy(p).addScaledVector(dir, -0.035);
    dims.add(c);
  }
  for (const [p0, p1] of [extA, extB]) if (p0) rod(dims, p0, p1, 0.003, extMat, 6).castShadow = false;
  labels.push({ pos: A.clone().add(B).multiplyScalar(0.5), text });
}
const labels = [];
dimension([-1.75, 0.02, DS * 0.95], [1.75, 0.02, DS * 0.95], [[-1.75, 0.02, DS * 0.47], [-1.75, 0.02, DS * 1.02]], [[1.75, 0.02, DS * 0.47], [1.75, 0.02, DS * 1.02]], '3,50 m');
dimension([2.45, 0.0, DS * 0.45], [2.45, 2.10, DS * 0.45], [null], [[1.77, 2.10, DS * 0.45], [2.52, 2.10, DS * 0.45]], '2,10 m');
dimension([2.45, 0.02, -0.45], [2.45, 0.02, 0.45], [[2.17, 0.02, -0.45], [2.52, 0.02, -0.45]], [[2.17, 0.02, 0.45], [2.52, 0.02, 0.45]], '0,90 a 1,00 m');
dims.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
dims.visible = false;

mergeStatic(model);

/* ---------- chão ---------- */
const shadowGround = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
shadowGround.rotation.x = -Math.PI / 2;
shadowGround.receiveShadow = true;
scene.add(shadowGround);
const disk = new THREE.Mesh(new THREE.CircleGeometry(4.6, 72), new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false, toneMapped: false }));
disk.rotation.x = -Math.PI / 2;
disk.position.y = -0.003;
scene.add(disk);

/* ---------- estado e animação ---------- */
const S = { head: 0, doors: 0, tilt: 0, belly: 0, rear: 0, led: 0, cowX: COW_HOME };
const target = { head: 0, doors: 0, tilt: 0, belly: 0, rear: 0, led: 0 };
const tweens = new Set();
function tweenTo(obj, k, to, dur, fn = ease) {
  for (const tw of tweens) if (tw.obj === obj && tw.k === k) { tweens.delete(tw); tw.res(); }
  return new Promise((res) => {
    const span = Math.abs(to - obj[k]);
    if (span < 1e-4 || dur <= 0) { obj[k] = to; res(); return; }
    tweens.add({ obj, k, from: obj[k], to, dur: k === 'cowX' ? dur : Math.max(0.25, dur * Math.min(1, span)), t: 0, fn, res });
  });
}
function stepTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.obj[tw.k] = tw.from + (tw.to - tw.from) * tw.fn(k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let walkPhase = 0, walkAmp = 0, lastCowX = S.cowX;
function applyPose(dt = 0) {
  const inner = lerp(HEAD_CLOSED, HEAD_OPEN, S.head);
  for (const s of [-1, 1]) halves[s].position.z = s * inner;
  for (const d of doors) d.pivot.rotation.y = d.sign * S.doors * DOOR_ANG;
  for (const t of tilts) t.pivot.rotation.x = t.sign * S.tilt * TILT_ANG;
  rearPivot.rotation.y = -DS * S.rear * REAR_ANG;
  const by = lerp(BELLY_LOW, BELLY_HIGH, S.belly);
  sling.position.y = by;
  const y0 = by + 0.20, y1 = 1.95;
  for (const st of straps) { st.scale.y = y1 - y0; st.position.y = (y0 + y1) / 2; }
  roller.rotation.z = -S.belly * 9;
  M.lamp.emissiveIntensity = S.led * 4;
  spot.intensity = S.led * 32;
  glow.material.opacity = S.led * 0.10;
  glow.visible = S.led > 0.01;
  // animal
  const dx = S.cowX - lastCowX;
  lastCowX = S.cowX;
  const moving = Math.abs(dx) > 1e-5;
  walkAmp = lerp(walkAmp, moving ? 0.34 : 0, Math.min(1, dt * 6));
  walkPhase += dx * (Math.PI * 2 / 1.15);
  for (const l of legs) l.g.rotation.z = walkAmp * Math.sin(walkPhase + l.off);
  cow.position.set(S.cowX, FLOOR * smooth(-2.85, -1.85, S.cowX) + Math.abs(Math.sin(walkPhase)) * walkAmp * 0.03, 0);
}

/* ---------- vistas e câmera ---------- */
const VIEWS = {
  perspectiva: { pos: [3.9, 2.5, -6.4], target: [0.25, 0.95, 0] },
  frontal: { pos: [7.4, 1.15, 0.0001], target: [0.6, 1.05, 0] },
  lateral: { pos: [0.25, 1.15, -8.0], target: [0.25, 1.05, 0] },
  traseira: { pos: [-7.2, 1.2, 0.0001], target: [-0.5, 1.05, 0] },
  superior: { pos: [0.25, 9.0, -0.001], target: [0.25, 0.8, 0] },
  manejo: { pos: [-1.6, 3.6, -12.2], target: [-1.2, 0.85, 0] },
};
const isNarrow = () => window.innerWidth <= 760 || window.innerHeight <= 500;
const panelOpen = () => !document.body.classList.contains('presenting') && !isNarrow();
function fitFactor() {
  const w = window.innerWidth - (panelOpen() ? 332 : 0);
  const a = w / Math.max(1, window.innerHeight - 44);
  return 1.06 * (a < 1.5 ? Math.min(2.6, Math.pow(1.5 / a, 0.85)) : 1);
}
let fly = null;
function flyTo(v, dur = 1.25) {
  const t1 = new THREE.Vector3(...v.target);
  const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  const s1 = new THREE.Spherical().setFromVector3(new THREE.Vector3(...v.pos).sub(t1).multiplyScalar(fitFactor()));
  s1.makeSafe();
  let dth = s1.theta - s0.theta;
  while (dth > Math.PI) dth -= Math.PI * 2;
  while (dth < -Math.PI) dth += Math.PI * 2;
  fly = { s0, s1, dth, t0: controls.target.clone(), t1, t: 0, dur: reduceMotion ? 0.001 : dur };
}
const sph = new THREE.Spherical();
function stepFly(dt) {
  if (!fly) return;
  fly.t += dt;
  const k = ease(Math.min(1, fly.t / fly.dur));
  controls.target.lerpVectors(fly.t0, fly.t1, k);
  sph.set(lerp(fly.s0.radius, fly.s1.radius, k), lerp(fly.s0.phi, fly.s1.phi, k), fly.s0.theta + fly.dth * k);
  camera.position.setFromSpherical(sph).add(controls.target);
  if (k >= 1) fly = null;
}
controls.addEventListener('start', () => { fly = null; setView(null); hideHint(); });

// No celular, o modelo é recentralizado no espaço livre acima (ou ao lado) do cartão aberto.
let sheet = null;                       // celular: null | 'panel' | 'info'
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  let ox = 0, oy = 0;
  if (isNarrow()) {
    const el = sheet === 'panel' ? $('#panel') : sheet === 'info' && !info.hidden ? info : null;
    const foot = 38, bar = 66;
    if (w > h && w >= 600) {
      ox = el ? -Math.round((el.offsetWidth + 12) / 2) : 0;
      oy = Math.round((foot + bar - 56) / 2);
    } else {
      const top = 60, bottom = foot + bar + (el ? el.offsetHeight + 8 : 0);
      oy = Math.round((bottom - top) / 2);
    }
  } else {
    ox = panelOpen() ? -30 : 0;
    oy = 22;
  }
  camera.setViewOffset(w, h, ox, oy, w, h);
  camera.updateProjectionMatrix();
}
const layoutSoon = () => requestAnimationFrame(() => { resize(); invalidate(); });
window.addEventListener('resize', () => { updateInfoVisibility(); resize(); invalidate(); });
controls.addEventListener('change', () => invalidate());

/* ---------- destaques ---------- */
const MECHS = {
  head: { state: ['Fechada', 'Aberta'], btn: ['Abrir', 'Fechar'], act: ['Abrir contenção', 'Fechar contenção'] },
  doors: { state: ['Fechados', 'Abertos'], btn: ['Abrir', 'Fechar'], act: ['Abrir painéis', 'Fechar painéis'] },
  tilt: { state: ['Fechada', 'Aberta'], btn: ['Abrir', 'Fechar'], act: ['Abrir porta basculante', 'Fechar porta basculante'] },
  belly: { state: ['Recolhida', 'Elevada'], btn: ['Elevar', 'Baixar'], act: ['Elevar cinta', 'Baixar cinta'] },
  rear: { state: ['Fechada', 'Aberta'], btn: ['Abrir', 'Fechar'], act: ['Abrir porta traseira', 'Fechar porta traseira'] },
  led: { state: ['Desligada', 'Ligada'], btn: ['Ligar', 'Desligar'], act: ['Ligar iluminação', 'Desligar iluminação'] },
};
const HOTSPOTS = [
  { id: 'cabeca', part: 'cabeca', title: 'Contenção de cabeça anatômica e acolchoada', text: 'Duas folhas com almofadas fecham ao redor do pescoço, com ajuste de largura e altura. Reduz o estresse e evita lesões.', anchor: [1.86, 2.0, 0], view: { pos: [4.4, 1.9, -2.3], target: [1.75, 1.2, 0] }, action: 'head' },
  { id: 'paineis', part: 'paineis', title: 'Painéis laterais móveis com abertura total', text: 'Abrem por inteiro e facilitam o acesso para exame físico, palpação, ultrassom, coleta de sangue e aplicação de medicamentos.', anchor: [-0.27, 1.33, DS * 0.49], view: { pos: [0.5, 1.6, -4.8], target: [-0.25, 0.95, 0] }, action: 'doors' },
  { id: 'abdominal', part: 'abdominal', title: 'Sistema de elevação abdominal', text: 'Cinta acolchoada sob o abdômen, acionada por guincho. Auxilia em procedimentos obstétricos, cesariana, palpação e exames, com mais segurança para o animal e a equipe.', anchor: [0.80, 0.93, DS * 0.33], view: { pos: [1.7, 1.3, -3.2], target: [0.8, 0.85, 0] }, action: 'belly' },
  { id: 'cocho', part: 'cocho', title: 'Cocho e bebedouro integrado', text: 'Ração e água na frente do animal durante a contenção. Ajuda a mantê-lo calmo e associa o manejo a uma experiência positiva.', anchor: [2.0, 0.95, 0.22], view: { pos: [3.9, 1.7, -1.7], target: [1.95, 0.85, 0] } },
  { id: 'piso', part: 'piso', title: 'Piso emborrachado antiderrapante', text: 'Placas modulares de borracha com relevo. Garantem conforto e reduzem o risco de escorregões.', anchor: [0.45, 0.17, DS * 0.22], view: { pos: [1.8, 2.8, -2.8], target: [0.5, 0.2, 0] } },
  { id: 'led', part: 'led', title: 'Iluminação em LED', text: 'Luminária no alto do brete. Melhora a visualização e facilita procedimentos em ambientes com pouca luz.', anchor: [-0.15, 2.13, 0], view: { pos: [-0.9, 3.5, -3.2], target: [-0.15, 1.5, 0] }, action: 'led' },
  { id: 'traseira', part: 'traseira', title: 'Porta traseira ampla', text: 'Abertura larga e fechamento com trava. Permite a entrada e a saída rápida e segura do animal.', anchor: [-1.85, 1.45, 0], view: { pos: [-4.9, 1.9, -2.1], target: [-1.6, 1.0, 0] }, action: 'rear' },
  { id: 'basculante', part: 'basculante', title: 'Porta lateral basculante', text: 'A parte alta da lateral dianteira se inclina para fora e dá acesso rápido ao pescoço e ao tronco do animal.', anchor: [0.68, 1.62, DS * 0.49], view: { pos: [1.5, 1.8, -3.5], target: [0.68, 1.3, 0] }, action: 'tilt' },
  { id: 'ajuste', part: 'ajuste', title: 'Ajuste de largura e altura', text: 'Manoplas no alto da cabeceira regulam a contenção para diferentes portes. A largura interna varia entre 0,90 e 1,00 m.', anchor: [1.60, 2.30, DS * 0.56], view: { pos: [3.4, 3.3, -2.7], target: [1.5, 1.9, 0] } },
  { id: 'estrutura', part: 'estrutura', title: 'Estrutura em aço e madeira plástica', text: 'Aço carbono galvanizado ou com pintura epóxi na estrutura; madeira plástica ou tratada nos painéis laterais.', anchor: [-1.23, 1.25, DS * 0.46], view: { pos: [3.9, 2.5, -6.4], target: [0.25, 0.95, 0] } },
];
const ACTION_LABEL = Object.fromEntries(Object.entries(MECHS).map(([k, m]) => [k, m.act]));

const hsLayer = $('#hotspots');
HOTSPOTS.forEach((h, i) => {
  const b = document.createElement('button');
  b.className = 'hs';
  b.type = 'button';
  b.textContent = String(i + 1);
  b.setAttribute('aria-label', `${i + 1}. ${h.title}`);
  b.title = h.title;
  b.addEventListener('click', () => select(h.id));
  hsLayer.appendChild(b);
  h.el = b;
  h.pos = new THREE.Vector3(...h.anchor);
});
const lblLayer = $('#labels');
for (const l of labels) {
  const e = document.createElement('div');
  e.className = 'dim';
  e.textContent = l.text;
  lblLayer.appendChild(e);
  l.el = e;
}

/* realce */
const hiCache = new Map();
let hiParts = [];
function setHighlight(id) {
  for (const m of hiParts) m.material = m.userData.baseMat;
  hiParts = [];
  if (!id) return;
  const roots = [...(parts[id] || [])];
  model.traverse((o) => { if (o.userData.part === id && !roots.includes(o)) roots.push(o); });
  for (const r of roots) r.traverse((m) => {
    if (!m.isMesh || !m.material.isMeshStandardMaterial) return;
    if (m !== r && m.userData.part && m.userData.part !== id) return;
    m.userData.baseMat = m.material;
    if (!hiCache.has(m.material)) {
      const c = m.material.clone();
      c.emissive = new THREE.Color(0x46c46e);
      hiCache.set(m.material, c);
    }
    m.material = hiCache.get(m.material);
    hiParts.push(m);
  });
}

/* ---------- interface ---------- */
const info = $('#info');
const FICHA = `
  <h3>Ficha técnica</h3>
  <dl class="specs">
    <div><dt>Comprimento</dt><dd>3,50 m</dd></div>
    <div><dt>Largura</dt><dd>0,90–1,00 m</dd></div>
    <div><dt>Altura</dt><dd>2,10 m</dd></div>
  </dl>
  <h4>Materiais sugeridos</h4>
  <ul class="mats">
    <li><i class="sw sw-epoxy"></i>Aço galvanizado ou epóxi <span>estrutura</span></li>
    <li><i class="sw sw-wood"></i>Madeira plástica ou tratada <span>painéis</span></li>
    <li><i class="sw sw-eva"></i>EVA ou borracha densa <span>acolchoamento</span></li>
    <li><i class="sw sw-floor"></i>Piso emborrachado modular <span>antiderrapante</span></li>
    <li><i class="sw sw-inox"></i>Aço inoxidável <span>cocho e bebedouro</span></li>
  </ul>
  <div class="diffs-block">
    <h4>Diferenciais</h4>
    <ul class="diffs">
      <li>Mais conforto e bem-estar animal</li>
      <li>Maior segurança para a equipe</li>
      <li>Acesso fácil para exames</li>
      <li>Menos estresse no manejo</li>
      <li>Agilidade no atendimento</li>
      <li>Ajustável a diferentes portes</li>
    </ul>
  </div>
  <p class="hint-small">Toque nos números sobre o modelo para ver cada detalhe.</p>`;
let selected = null;
function renderInfo() {
  const h = HOTSPOTS.find((x) => x.id === selected);
  const body = $('#info-body');
  info.classList.toggle('is-detail', !!h);
  layoutSoon();
  if (!h) { body.innerHTML = FICHA; return; }
  const n = HOTSPOTS.indexOf(h) + 1;
  const act = h.action ? `<button type="button" class="act" id="info-act">${ACTION_LABEL[h.action][target[h.action] > 0.5 ? 1 : 0]}</button>` : '';
  body.innerHTML = `
    <div class="info-head"><b class="num">${n}</b><h3>${h.title}</h3></div>
    <p>${h.text}</p>
    <div class="info-actions">${act}<button type="button" class="ghost" id="info-back">Ver ficha técnica</button></div>`;
  $('#info-back').onclick = () => { select(null); flyTo(VIEWS.perspectiva); setView('perspectiva'); };
  if (h.action) $('#info-act').onclick = () => toggleMech(h.action);
}
function select(id) {
  selected = id;
  invalidate();
  HOTSPOTS.forEach((h) => h.el.classList.toggle('active', h.id === id));
  setHighlight(id);
  renderInfo();
  if (id) {
    flyTo(HOTSPOTS.find((h) => h.id === id).view);
    setView(null);
    hideHint();
    if (isNarrow()) setSheet('info');
  }
}

let busy = false;
function syncUI() {
  for (const k of Object.keys(MECHS)) {
    const open = target[k] > 0.5;
    const row = document.querySelector(`.mech[data-mech="${k}"]`);
    row.querySelector('.state').textContent = MECHS[k].state[open ? 1 : 0];
    row.classList.toggle('open', open);
    const b = row.querySelector('button');
    b.textContent = MECHS[k].btn[open ? 1 : 0];
    b.disabled = busy;
  }
  $('#simulate').disabled = busy;
  $('#simulate').textContent = busy ? 'Simulando…' : 'Simular manejo';
  const ia = $('#info-act');
  if (ia && selected) {
    const h = HOTSPOTS.find((x) => x.id === selected);
    if (h.action) { ia.textContent = ACTION_LABEL[h.action][target[h.action] > 0.5 ? 1 : 0]; ia.disabled = busy; }
  }
}
function mech(k, to, dur = 1.2) { target[k] = to; syncUI(); return tweenTo(S, k, to, dur); }
function toggleMech(k) { if (!busy) mech(k, target[k] > 0.5 ? 0 : 1); }
document.querySelectorAll('.mech button').forEach((b) => b.addEventListener('click', () => toggleMech(b.closest('.mech').dataset.mech)));

function setView(name) {
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  flyTo(VIEWS[b.dataset.view]);
  setView(b.dataset.view);
  hideHint();
}));

function bindToggle(id, fn) {
  const b = $(id);
  b.addEventListener('click', () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); fn(v); invalidate(); });
  return (v) => { b.setAttribute('aria-checked', String(v)); fn(v); invalidate(); };
}
const setCow = bindToggle('#tg-cow', (v) => { cow.visible = v; });
bindToggle('#tg-dims', (v) => { dims.visible = v; lblLayer.hidden = !v; });
bindToggle('#tg-hs', (v) => { hsLayer.hidden = !v; });
const setSpin = bindToggle('#tg-spin', (v) => { controls.autoRotate = v; });
lblLayer.hidden = true;

const cap = $('#caption');
function caption(n, text) {
  if (!n) { cap.hidden = true; return; }
  cap.hidden = false;
  $('#cap-n').textContent = n;
  $('#cap-t').textContent = text;
}
async function simulate() {
  if (busy) return;
  busy = true;
  select(null);
  setSheet(null);
  syncUI();
  setCow(true);
  setSpin(false);
  caption('·', 'Preparando o brete');
  await Promise.all([mech('doors', 0, 0.9), mech('tilt', 0, 0.9), mech('belly', 0, 0.9), mech('led', 0, 0.5), mech('head', 1, 0.9), mech('rear', 1, 1.1)]);
  S.cowX = lastCowX = COW_START;
  flyTo(VIEWS.manejo, 1.4);
  setView(null);
  await sleep(500);
  caption('1', 'Entrada do animal pela porta traseira ampla');
  await tweenTo(S, 'cowX', COW_HOME, 5.0, easeOut);
  caption('2', 'Porta traseira fecha atrás do animal');
  await mech('rear', 0, 1.3);
  flyTo(VIEWS.perspectiva, 1.6);
  caption('3', 'Contenção de cabeça acolchoada');
  await sleep(300);
  await mech('head', 0, 1.2);
  caption('4', 'Cinta abdominal sobe e apoia o animal');
  await mech('belly', 1, 1.8);
  caption('5', 'Iluminação em LED para o procedimento');
  await mech('led', 1, 0.7);
  caption('6', 'Painéis laterais abrem para o exame');
  await mech('doors', 1, 1.6);
  await sleep(2200);
  caption(null);
  busy = false;
  updateInfoVisibility();
  layoutSoon();
  syncUI();
}
$('#simulate').addEventListener('click', simulate);

/* modo apresentação, tela cheia, painel móvel */
function setPresenting(v) {
  document.body.classList.toggle('presenting', v);
  $('#exit-present').hidden = !v;
  if (v && isNarrow()) setSheet(null);
  resize();
  invalidate();
}
$('#present').addEventListener('click', () => setPresenting(true));
$('#exit-present').addEventListener('click', () => setPresenting(false));
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  } catch (e) { /* sem suporte */ }
}
$('#fullscreen').addEventListener('click', toggleFullscreen);
// Cartões do celular: um de cada vez (Comandos ou Ficha técnica / detalhe).
function updateInfoVisibility() {
  info.hidden = isNarrow() ? sheet !== 'info' : busy;
}
function setSheet(which) {
  sheet = which;
  document.body.classList.toggle('panel-open', which === 'panel');
  $('#m-panel').setAttribute('aria-expanded', String(which === 'panel'));
  $('#m-info').setAttribute('aria-expanded', String(which === 'info'));
  updateInfoVisibility();
  layoutSoon();
}
$('#m-panel').addEventListener('click', () => setSheet(sheet === 'panel' ? null : 'panel'));
$('#m-info').addEventListener('click', () => {
  if (sheet === 'info' && selected) select(null);        // do detalhe, volta para a ficha
  else setSheet(sheet === 'info' ? null : 'info');
});
$('#panel-close').addEventListener('click', () => setSheet(null));
$('#info-close').addEventListener('click', () => { if (selected) select(null); setSheet(null); });
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === 'p') setPresenting(!document.body.classList.contains('presenting'));
  else if (k === 'f') toggleFullscreen();
  else if (k === 'r') { const b = $('#tg-spin'); b.click(); }
  else if (k === 'escape') { if (selected) select(null); else if (sheet) setSheet(null); else if (document.body.classList.contains('presenting')) setPresenting(false); }
});

const hint = $('#hint');
function hideHint() { hint.classList.add('gone'); }

/* clique direto nas peças */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downXY = null;
canvas.addEventListener('pointerdown', (e) => { downXY = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downXY || Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) > 6) return;
  const hit = pick(e);
  const h = hit && HOTSPOTS.find((x) => x.part === hit);
  if (h) select(h.id);
});
let hoverT = 0;
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons || performance.now() - hoverT < 60) return;
  hoverT = performance.now();
  const p = pick(e);
  canvas.style.cursor = p && HOTSPOTS.some((h) => h.part === p) ? 'pointer' : '';
});
function pick(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(model, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.part) o = o.parent;
    if (o && o.userData.part !== 'animal') return o.userData.part;
    if (o && o.userData.part === 'animal') return null;
  }
  return null;
}

/* ---------- projeção dos rótulos ---------- */
const pv = new THREE.Vector3();
const occRay = new THREE.Raycaster();
let frameN = 0;
let dirty = 3;
const invalidate = () => { dirty = Math.max(dirty, 2); };
function placeOverlay(el, pos, check) {
  pv.copy(pos).project(camera);
  const vis = pv.z < 1 && Math.abs(pv.x) < 1.1 && Math.abs(pv.y) < 1.1;
  el.style.visibility = vis ? '' : 'hidden';
  if (!vis) return;
  const x = (pv.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-pv.y * 0.5 + 0.5) * window.innerHeight;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  if (check) {
    const dir = pos.clone().sub(camera.position);
    const dist = dir.length();
    occRay.set(camera.position, dir.normalize());
    occRay.far = dist - 0.06;
    const hit = occRay.intersectObject(model, true).length > 0;
    el.classList.toggle('occluded', hit);
  }
}

/* ---------- laço principal ---------- */
const clock = new THREE.Clock();
const tMin = new THREE.Vector3(-3.2, 0, -2), tMax = new THREE.Vector3(3.2, 2.4, 2);
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  const animating = tweens.size > 0 || !!fly || controls.autoRotate || hiParts.length > 0 || walkAmp > 0.002;
  stepTweens(dt);
  stepFly(dt);
  const moved = controls.update();
  controls.target.clamp(tMin, tMax);
  if (!animating && !moved && dirty <= 0) return;   // nada mudou: não redesenha
  if (dirty > 0) dirty--;
  applyPose(dt);
  if (hiParts.length) {
    const t = performance.now() / 1000;
    for (const m of hiCache.values()) m.emissiveIntensity = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 3.2));
  }
  renderer.render(scene, camera);
  frameN++;
  const check = frameN % 6 === 0 || (!animating && !moved);
  if (!hsLayer.hidden) for (const h of HOTSPOTS) placeOverlay(h.el, h.pos, check);
  if (dims.visible) for (const l of labels) placeOverlay(l.el, l.pos, false);
}

/* ---------- exportação GLB (Blender) ---------- */
async function exportGLB() {
  const saved = { ...S };
  Object.assign(S, { head: 0, doors: 0, tilt: 0, belly: 0, rear: 0, led: 0, cowX: COW_HOME });
  lastCowX = COW_HOME; walkAmp = 0;
  applyPose(0);
  setHighlight(null);
  model.updateMatrixWorld(true);
  const buf = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: false });
  Object.assign(S, saved);
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
window.__bovicare = { exportGLB, S, flyTo, VIEWS, select, mech, setView, setSheet, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, meshes: (() => { let n = 0; model.traverse((o) => { if (o.isMesh) n++; }); return n; })() }) };

/* ---------- início ---------- */
resize();
applyPose(0);
renderInfo();
updateInfoVisibility();
syncUI();
{
  const v = VIEWS.perspectiva;
  const t = new THREE.Vector3(...v.target);
  const off = new THREE.Vector3(...v.pos).sub(t).multiplyScalar(fitFactor() * 1.35);
  off.applyAxisAngle(UP, reduceMotion ? 0 : -0.9);
  controls.target.copy(t);
  camera.position.copy(t).add(off);
  flyTo(v, 2.2);
  setView('perspectiva');
}
loop();
if (document.fonts && document.fonts.load) {
  document.fonts.load('700 50px "Playfair Display"')
    .then(() => { drawPlate(); plateTex.needsUpdate = true; invalidate(); })
    .catch(() => {});
}
