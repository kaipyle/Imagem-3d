/* ============================================================
   SafeBov — brete de contenção bovina · modelo 3D interativo
   Unidades em metros. Frente (cabeceira) em +X, altura em +Y.
   Lado de apresentação (painel, degrau) em -Z.
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
const HEAD_CLOSED = 0.125, HEAD_OPEN = 0.27;
const COW_HOME = 0.08, COW_START = -3.5;
const UP = new THREE.Vector3(0, 1, 0);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s) => document.querySelector(s);
const lerp = THREE.MathUtils.lerp;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 2.2);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- ícone (cabeça de boi em traço) ---------- */
const ICON = [
  'M30 30 C22 29 15 24 13 15 C19 20 25 22 33 23',
  'M70 30 C78 29 85 24 87 15 C81 20 75 22 67 23',
  'M33 23 C40 18 60 18 67 23 C70 30 69 44 66 54 C64 62 63 70 60 77 C57 84 43 84 40 77 C37 70 36 62 34 54 C31 44 30 30 33 23 Z',
  'M32 33 C24 36 16 35 10 30 C16 27 25 27 32 29',
  'M68 33 C76 36 84 35 90 30 C84 27 75 27 68 29',
  'M44 24 C46 28 50 28 52 24 C53 27 56 28 58 25',
  'M41 70 C46 67 54 67 59 70',
  'M43 75 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
  'M53 75 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
  'M39.4 45 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
  'M57.4 45 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
];
const iconSVG = ICON.map((d) => `<path d="${d}"/>`).join('');
document.querySelectorAll('svg.logo').forEach((s) => { s.innerHTML = iconSVG; });

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
const diamondBump = canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, w);
  g.filter = 'blur(1.4px)';
  const n = 4, cell = w / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.save();
    g.translate((i + 0.5) * cell, (j + 0.5) * cell);
    g.rotate((i + j) % 2 ? Math.PI / 4 : -Math.PI / 4);
    g.fillStyle = '#f2f2f2';
    g.beginPath(); g.ellipse(0, 0, cell * 0.36, cell * 0.075, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}, { srgb: false });
const studBump = canvasTex(128, 128, (g, w) => {
  g.fillStyle = '#6a6a6a'; g.fillRect(0, 0, w, w);
  g.filter = 'blur(1px)';
  g.fillStyle = '#ededed';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const off = j % 2 ? w / 8 : 0;
    g.beginPath(); g.arc(i * w / 4 + w / 8 + off, j * w / 4 + w / 8, w / 15, 0, Math.PI * 2); g.fill();
  }
}, { srgb: false });
const groundTex = canvasTex(512, 512, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(96,108,94,0.30)');
  r.addColorStop(0.55, 'rgba(96,108,94,0.14)');
  r.addColorStop(1, 'rgba(96,108,94,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

const logoCanvas = document.createElement('canvas');
logoCanvas.width = 1024; logoCanvas.height = 512;
function drawLogo() {
  const g = logoCanvas.getContext('2d');
  g.clearRect(0, 0, 1024, 512);
  g.strokeStyle = '#e6ece4'; g.fillStyle = '#e6ece4';
  g.lineWidth = 4.2; g.lineCap = 'round'; g.lineJoin = 'round';
  g.save(); g.translate(352, 30); g.scale(3.2, 3.2);
  ICON.forEach((d) => g.stroke(new Path2D(d)));
  g.restore();
  g.font = '700 168px Caveat, "Segoe Print", "Bradley Hand", cursive';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('SafeBov', 512, 470);
}
drawLogo();
const logoTex = new THREE.CanvasTexture(logoCanvas);
logoTex.colorSpace = THREE.SRGBColorSpace;
logoTex.anisotropy = 8;

/* ---------- materiais ---------- */
const M = {
  steel: new THREE.MeshStandardMaterial({ name: 'Aço carbono (pintura)', color: 0x353a3d, metalness: 0.6, roughness: 0.4 }),
  steelDark: new THREE.MeshStandardMaterial({ name: 'Aço carbono (base)', color: 0x26292b, metalness: 0.55, roughness: 0.5 }),
  plate: new THREE.MeshStandardMaterial({ name: 'Chapa lateral', color: 0x2c3032, metalness: 0.45, roughness: 0.55 }),
  galv: new THREE.MeshStandardMaterial({ name: 'Aço galvanizado', color: 0xaab1b4, metalness: 0.9, roughness: 0.3 }),
  green: new THREE.MeshStandardMaterial({ name: 'Pintura verde', color: 0x2b6a3d, metalness: 0.35, roughness: 0.38 }),
  pad: new THREE.MeshStandardMaterial({ name: 'Borracha de alta densidade', color: 0x2f7544, metalness: 0, roughness: 0.6 }),
  padDark: new THREE.MeshStandardMaterial({ name: 'Borracha (colar)', color: 0x1f4c2d, roughness: 0.78 }),
  hose: new THREE.MeshStandardMaterial({ name: 'Mangueira hidráulica', color: 0x121314, roughness: 0.5, metalness: 0.1 }),
  chrome: new THREE.MeshStandardMaterial({ name: 'Haste cromada', color: 0xe4e8ea, metalness: 1, roughness: 0.12 }),
  housing: new THREE.MeshStandardMaterial({ name: 'Caixa do painel', color: 0x2a2e30, metalness: 0.3, roughness: 0.5 }),
  button: new THREE.MeshStandardMaterial({ name: 'Botão', color: 0x39b25a, roughness: 0.3, emissive: 0x0c3a19, emissiveIntensity: 0.6 }),
  black: new THREE.MeshStandardMaterial({ name: 'Preto', color: 0x0e0f10, roughness: 0.4 }),
  logo: new THREE.MeshStandardMaterial({ name: 'Logotipo', map: logoTex, transparent: true, roughness: 0.55, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
};
function checker(rx, ry) {
  return new THREE.MeshStandardMaterial({ name: 'Chapa xadrez antiderrapante', color: 0x7b8185, metalness: 0.85, roughness: 0.42, bumpMap: repeatOf(diamondBump, rx, ry), bumpScale: 2.2 });
}
const floorMat = new THREE.MeshStandardMaterial({ name: 'Piso emborrachado', color: 0x1c1d1e, roughness: 0.9, bumpMap: repeatOf(studBump, 40, 13), bumpScale: 2.5 });

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
model.name = 'SafeBov – brete de contenção';
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

/* Estrutura */
const frame = part('estrutura', 'Estrutura');
const T = 0.08, PZ = 0.41;
for (const s of [-1, 1]) {
  box(frame, 2.40, 0.12, 0.08, M.steelDark, -0.05, 0.06, s * PZ);              // longarina da base
  for (const x of [-1.21, 0.91, 1.11]) {
    box(frame, T, 1.98, T, M.steel, x, 0.12 + 0.99, s * PZ);                    // colunas
    box(frame, 0.16, 0.012, 0.16, M.galv, x, 0.006, s * PZ, 0.003);             // sapatas
  }
  box(frame, 0.07, 0.96, 0.07, M.steel, -0.17, 1.58, s * PZ);                   // coluna central superior
  box(frame, 2.40, T, T, M.steel, -0.05, 2.06, s * PZ);                         // longarina superior
  box(frame, 2.04, 0.07, 0.07, M.steel, -0.15, 1.075, s * PZ);                  // travessa sobre as portas
  box(frame, 2.04, 0.05, 0.05, M.steel, -0.15, 1.45, s * PZ);                   // barras superiores
  box(frame, 2.04, 0.05, 0.05, M.steel, -0.15, 1.78, s * PZ);
  box(frame, 2.04, 0.22, 0.025, M.plate, -0.15, 0.25, s * 0.43, 0.004);         // rodapé
  box(frame, 2.04, 0.045, 0.06, M.steel, -0.15, 0.385, s * PZ);
  box(frame, 0.16, 0.05, 0.05, M.steel, 1.01, 1.075, s * PZ);                   // quadro da cabeceira
  box(frame, 0.16, 0.05, 0.05, M.steel, 1.01, 0.385, s * PZ);
  box(frame, 0.16, 0.05, 0.05, M.steel, 1.01, 1.78, s * PZ);
}
for (const y of [0.45, 1.65]) box(frame, 0.06, 0.05, 0.03, M.galv, -1.25, y, 0.41 * -DS, 0.004); // dobradiças do portão
for (const x of [-1.21, -0.17, 0.91, 1.11]) box(frame, T, T, 0.74, M.steel, x, 2.06, 0);
for (const x of [-1.21, -0.17, 0.91, 1.11]) box(frame, T, 0.10, 0.74, M.steelDark, x, 0.05, 0);
box(frame, 0.05, 0.37, 0.04, M.steel, -0.72, 1.26, DS * 0.41, 0.005);           // suporte do painel
box(frame, 0.04, 0.12, 0.10, M.steel, -0.95, 1.99, -DS * 0.47, 0.005);          // apoio do cilindro traseiro
box(frame, 0.05, 0.06, 0.05, M.galv, -1.27, 1.10, DS * 0.43, 0.004);            // receptor da trava traseira
// alavanca superior verde
pipe(frame, [[1.13, 2.10, DS * 0.25], [1.02, 2.22, DS * 0.25], [0.70, 2.28, DS * 0.25], [-0.70, 2.28, DS * 0.25], [-1.02, 2.22, DS * 0.25], [-1.17, 2.10, DS * 0.25]], 0.024, M.green);
rod(frame, [-0.17, 2.10, DS * 0.25], [-0.17, 2.28, DS * 0.25], 0.016, M.green);

/* Piso */
const floor = part('piso', 'Piso antiderrapante');
box(floor, 2.30, 0.03, 0.74, floorMat, -0.05, 0.125, 0, 0);
box(floor, 0.34, 0.03, 0.90, checker(4, 10), 1.38, 0.105, 0, 0);               // saída frontal
box(floor, 0.06, 0.09, 0.86, M.steelDark, 1.52, 0.045, 0);
const ramp = box(floor, 0.44, 0.025, 0.82, checker(5, 9), -1.52, 0.07, 0, 0);    // rampa de entrada
ramp.rotation.z = Math.atan2(0.13, 0.42);

/* Cabeceira */
const head = part('cabeceira', 'Cabeceira');
box(head, 0.06, 0.10, 0.98, M.steel, 1.18, 1.98, 0);
box(head, 0.06, 0.06, 0.98, M.steel, 1.18, 0.17, 0);
box(head, 0.03, 0.06, 0.08, M.galv, 1.225, 2.07, 0, 0.004);
const pads = part('acolchoamento', 'Acolchoamento');
for (const s of [-1, 1]) box(pads, 1.96, 0.10, 0.03, M.pad, -0.15, 1.45, s * (PZ - 0.04), 0.012);

function cushionGeo() {
  const sh2 = new THREE.Shape();
  sh2.moveTo(0.03, 0.50);
  sh2.lineTo(0.17, 0.50);
  sh2.quadraticCurveTo(0.20, 0.50, 0.20, 0.56);
  sh2.lineTo(0.215, 1.20);
  sh2.quadraticCurveTo(0.225, 1.55, 0.27, 1.74);
  sh2.quadraticCurveTo(0.28, 1.80, 0.22, 1.80);
  sh2.lineTo(0.06, 1.80);
  sh2.quadraticCurveTo(0.02, 1.80, 0.02, 1.74);
  sh2.lineTo(0.0, 0.56);
  sh2.quadraticCurveTo(0.0, 0.50, 0.03, 0.50);
  const g = new THREE.ExtrudeGeometry(sh2, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 4, curveSegments: 10 });
  g.rotateY(-Math.PI / 2);
  return g;
}
const cushion = cushionGeo();
function buildHalf(s) {
  const g = new THREE.Group();
  g.name = s > 0 ? 'Folha da cabeceira (esq.)' : 'Folha da cabeceira (dir.)';
  const H0 = 0.21, H1 = 1.92, W = 0.22;
  box(g, 0.045, H1 - H0, 0.045, M.steel, 0, (H0 + H1) / 2, 0.0225);
  box(g, 0.045, H1 - H0, 0.045, M.steel, 0, (H0 + H1) / 2, W - 0.0225);
  for (const y of [0.24, 0.95, 1.89]) box(g, 0.04, 0.04, W, M.steel, 0, y, W / 2);
  box(g, 0.02, 0.26, 0.04, M.steel, 0.045, 1.98, W - 0.02, 0.004);             // aba do cilindro
  const c = sh(new THREE.Mesh(cushion, M.pad));
  c.position.x = 0.085;
  c.userData.part = 'acolchoamento';
  g.add(c);
  const collar = box(g, 0.07, 0.86, 0.05, M.padDark, 0.01, 1.12, 0.0, 0.02);    // colar do pescoço
  collar.userData.part = 'acolchoamento';
  if (s < 0) g.scale.z = -1;
  head.add(g);
  return g;
}
const halves = { 1: buildHalf(1), [-1]: buildHalf(-1) };
halves[1].position.x = halves[-1].position.x = 1.18;

/* Laterais articuladas */
const doorsG = part('laterais', 'Laterais articuladas');
const doors = [];
function buildDoor(s, hingeX, dir, w, withLogo) {
  const pivot = new THREE.Group();
  pivot.name = withLogo ? 'Porta lateral dianteira' : 'Porta lateral traseira';
  pivot.position.set(hingeX, 0, s * 0.455);
  doorsG.add(pivot);
  const y0 = 0.42, y1 = 1.03, yc = (y0 + y1) / 2, hh = y1 - y0;
  const cx = dir * w / 2;
  box(pivot, w, 0.04, 0.04, M.steel, cx, y1 - 0.02, 0);
  box(pivot, w, 0.04, 0.04, M.steel, cx, y0 + 0.02, 0);
  box(pivot, 0.04, hh, 0.04, M.steel, dir * 0.02, yc, 0);
  box(pivot, 0.04, hh, 0.04, M.steel, dir * (w - 0.02), yc, 0);
  box(pivot, w - 0.06, hh - 0.06, 0.012, M.plate, cx, yc, 0, 0.002);
  if (!withLogo) for (const y of [0.62, 0.83]) box(pivot, w - 0.12, 0.025, 0.012, M.steel, cx, y, s * 0.01, 0.004);
  for (const y of [0.52, 0.93]) rod(pivot, [0, y - 0.045, s * 0.03], [0, y + 0.045, s * 0.03], 0.017, M.galv);
  if (withLogo) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.32), M.logo);
    if (s < 0) pl.rotation.y = Math.PI;
    pl.position.set(cx, yc + 0.005, s * 0.0075);
    pl.renderOrder = 2;
    pivot.add(pl);
    // trava de segurança
    const fx = dir * (w - 0.05);
    box(pivot, 0.05, 0.08, 0.03, M.galv, fx, 0.80, s * 0.03, 0.004);
    const lever = rod(pivot, [fx, 0.80, s * 0.06], [fx - dir * 0.0, 0.66, s * 0.075], 0.013, M.green);
    lever.name = 'Trava de segurança';
    box(pivot, 0.04, 0.035, 0.035, M.green, fx, 0.655, s * 0.075, 0.01);
  }
  doors.push({ pivot, sign: -s * dir });
}
for (const s of [-1, 1]) {
  buildDoor(s, -1.165, 1, 0.985, false);
  buildDoor(s, 0.865, -1, 1.015, true);
}

/* Portão traseiro */
const rearG = part('portao', 'Portão traseiro');
const rearPivot = new THREE.Group();
rearPivot.name = 'Folha do portão traseiro';
rearPivot.position.set(-1.29, 0, -DS * 0.41);
rearG.add(rearPivot);
{
  const u = (v) => DS * v;           // eixo da largura do portão
  const y0 = 0.18, y1 = 1.92, W = 0.82;
  for (const v of [0.025, W - 0.025]) box(rearPivot, 0.045, y1 - y0, 0.045, M.steel, 0, (y0 + y1) / 2, u(v));
  for (const y of [0.205, 1.895, 1.05, 1.45]) box(rearPivot, 0.04, y === 0.205 || y === 1.895 ? 0.045 : 0.035, W, M.steel, 0, y, u(W / 2));
  box(rearPivot, 0.012, 0.30, W - 0.05, M.plate, 0, 0.37, u(W / 2), 0.003);
  for (const v of [0.29, 0.53]) box(rearPivot, 0.04, 1.40, 0.04, M.steel, 0, 1.2, u(v));
  for (let y = 0.62; y < 1.85; y += 0.18) rod(rearPivot, [0, y, u(0.29)], [0, y, u(0.53)], 0.013, M.galv);
  box(rearPivot, 0.02, 0.12, 0.04, M.steel, 0, 1.96, u(0.30), 0.004);           // aba do cilindro
  for (const y of [0.45, 1.65]) rod(rearPivot, [0, y - 0.05, 0], [0, y + 0.05, 0], 0.02, M.galv);
  const latch = rod(rearPivot, [-0.03, 1.10, u(W - 0.02)], [-0.03, 1.10, u(W + 0.06)], 0.014, M.green);
  latch.name = 'Trava do portão';
  box(rearPivot, 0.05, 0.04, 0.04, M.green, -0.03, 1.10, u(W + 0.07), 0.012);
}
const rearTab = new THREE.Object3D();
rearTab.position.set(-0.03, 1.96, DS * 0.30);
rearPivot.add(rearTab);

/* Hidráulica */
const hyd = part('hidraulico', 'Sistema hidráulico');
const headCyl = { 1: actuator(hyd, 0.24), [-1]: actuator(hyd, 0.24) };
const rearCyl = actuator(hyd, 0.40);
const REAR_A = new THREE.Vector3(-0.95, 1.95, -DS * 0.50);
const hoseR = 0.011;
pipe(hyd, [[-0.67, 1.58, DS * 0.52], [-0.63, 1.72, DS * 0.50], [-0.42, 1.92, DS * 0.475], [0.30, 2.13, DS * 0.475], [0.95, 2.14, DS * 0.475], [1.14, 2.15, DS * 0.30], [1.235, 2.11, DS * 0.08]], hoseR, M.hose);
pipe(hyd, [[-0.64, 1.58, DS * 0.52], [-0.59, 1.70, DS * 0.50], [-0.38, 1.90, DS * 0.49], [0.32, 2.155, DS * 0.49], [0.97, 2.165, DS * 0.48], [1.18, 2.17, DS * 0.25], [1.25, 2.13, 0.0], [1.235, 2.11, -DS * 0.08]], hoseR, M.hose);
pipe(hyd, [[-0.78, 1.58, DS * 0.52], [-0.86, 1.74, DS * 0.50], [-0.95, 2.13, DS * 0.42], [-0.97, 2.15, 0], [-0.96, 2.13, -DS * 0.40], [-0.95, 2.02, -DS * 0.50]], hoseR, M.hose);
pipe(hyd, [[-0.81, 1.58, DS * 0.52], [-0.90, 1.74, DS * 0.49], [-1.00, 2.14, DS * 0.40], [-1.02, 2.165, 0], [-1.01, 2.14, -DS * 0.38], [-0.99, 2.03, -DS * 0.49]], hoseR, M.hose);

/* Painel de controle */
const panelG = part('painel', 'Painel de controle hidráulico');
panelG.position.set(-0.72, 1.36, DS * 0.52);
box(panelG, 0.30, 0.44, 0.09, M.housing, 0, 0, 0, 0.016);
box(panelG, 0.10, 0.05, 0.05, M.steel, 0, 0.09, -DS * 0.065, 0.005);
box(panelG, 0.24, 0.17, 0.008, M.black, 0, 0.09, DS * 0.047, 0.004);
const lcdCanvas = document.createElement('canvas');
lcdCanvas.width = 512; lcdCanvas.height = 320;
const lcdTex = new THREE.CanvasTexture(lcdCanvas);
lcdTex.colorSpace = THREE.SRGBColorSpace;
const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.13125), new THREE.MeshBasicMaterial({ map: lcdTex, toneMapped: false, name: 'Visor' }));
if (DS < 0) lcd.rotation.y = Math.PI;
lcd.position.set(0, 0.09, DS * 0.0515);
panelG.add(lcd);
const btnGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.016, 24);
for (const [bx, by] of [[-0.05, -0.06], [0.05, -0.06], [-0.05, -0.135], [0.05, -0.135]]) {
  const b = sh(new THREE.Mesh(btnGeo, M.button));
  b.rotation.x = Math.PI / 2;
  b.position.set(bx, by, DS * 0.05);
  panelG.add(b);
  const ring = sh(new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 8, 24), M.galv));
  ring.position.set(bx, by, DS * 0.046);
  panelG.add(ring);
}
const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x5dff8e, toneMapped: false }));
led.position.set(0.12, 0.195, DS * 0.047);
panelG.add(led);

/* Degrau do operador */
const stepG = part('plataforma', 'Degrau do operador');
box(stepG, 0.70, 0.03, 0.42, checker(7, 4), -0.77, 0.285, DS * 0.70, 0);
box(stepG, 0.70, 0.03, 0.22, checker(7, 2), -0.77, 0.145, DS * 1.02, 0);
for (const x of [-1.10, -0.44]) {
  box(stepG, 0.04, 0.06, 0.66, M.steel, x, 0.24, DS * 0.82, 0.005);
  box(stepG, 0.04, 0.27, 0.04, M.steel, x, 0.135, DS * 0.89, 0.005);
  box(stepG, 0.04, 0.13, 0.04, M.steel, x, 0.065, DS * 1.11, 0.005);
  box(stepG, 0.04, 0.04, 0.10, M.steel, x, 0.12, DS * 0.47, 0.005);
}

/* ---------- animal ilustrativo ---------- */
const cow = new THREE.Group();
cow.name = 'Animal (ilustrativo)';
cow.userData.part = 'animal';
model.add(cow);
const legs = [];
{
  const hide = new THREE.MeshPhysicalMaterial({ name: 'Pelagem', color: 0x2a1c15, roughness: 0.74, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x8a6a52) });
  const muzzle = new THREE.MeshStandardMaterial({ name: 'Focinho', color: 0x1b1412, roughness: 0.38 });
  const hoof = new THREE.MeshStandardMaterial({ name: 'Casco', color: 0x141110, roughness: 0.5 });
  const eyeM = new THREE.MeshStandardMaterial({ name: 'Olho', color: 0x050505, roughness: 0.1, metalness: 0.2 });
  const tag = new THREE.MeshStandardMaterial({ name: 'Brinco', color: 0xf2c230, roughness: 0.45 });
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const ell = (p, rx, ry, rz, x, y, z, mat = hide, rot = null) => {
    const m = sh(new THREE.Mesh(sphere, mat));
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    p.add(m);
    return m;
  };
  // corpo: perfil de revolução (liso, sem emendas)
  const prof = [[-0.97, 0.0], [-0.955, 0.12], [-0.92, 0.22], [-0.86, 0.29], [-0.75, 0.335], [-0.55, 0.35], [-0.30, 0.335], [0.0, 0.345], [0.30, 0.365], [0.52, 0.36], [0.66, 0.32], [0.76, 0.24], [0.81, 0.13], [0.825, 0.0]]
    .map(([x, r]) => new THREE.Vector2(r, x));
  const bodyGeo = new THREE.LatheGeometry(prof, 48);
  bodyGeo.rotateZ(-Math.PI / 2);
  const body = sh(new THREE.Mesh(bodyGeo, hide));
  body.scale.set(1, 1.04, 0.82);
  body.position.set(0, 1.0, 0);
  cow.add(body);
  ell(cow, 0.42, 0.08, 0.22, -0.60, 1.275, 0);                    // garupa
  ell(cow, 0.36, 0.08, 0.2, 0.38, 1.29, 0);                       // cernelha
  ell(cow, 0.20, 0.24, 0.17, 0.66, 0.84, 0);                      // peito / barbela
  ell(cow, 0.30, 0.22, 0.185, 0.86, 1.06, 0, hide, [0, 0, -0.38]); // pescoço
  const hd = new THREE.Group();
  hd.position.set(1.08, 1.04, 0);
  hd.rotation.z = -0.55;
  cow.add(hd);
  ell(hd, 0.135, 0.13, 0.125, 0.05, 0.0, 0);                      // crânio
  const faceGeo = new THREE.CylinderGeometry(0.072, 0.112, 0.30, 28, 1, false);
  faceGeo.rotateZ(-Math.PI / 2);
  const face = sh(new THREE.Mesh(faceGeo, hide));
  face.position.set(0.22, -0.01, 0);
  face.scale.set(1, 0.92, 1);
  hd.add(face);
  ell(hd, 0.066, 0.062, 0.076, 0.37, -0.012, 0, muzzle);         // focinho
  ell(hd, 0.07, 0.035, 0.1, 0.0, 0.12, 0);                        // nuca
  for (const s of [-1, 1]) {
    ell(hd, 0.01, 0.01, 0.01, 0.432, 0.0, s * 0.03, hoof);
    ell(hd, 0.016, 0.016, 0.014, 0.11, 0.06, s * 0.098, eyeM);
    const ear = ell(hd, 0.028, 0.045, 0.105, 0.16, 0.05, s * 0.185, hide, [s * 0.3, 0, 0]);
    ear.name = 'Orelha';
    const tg = sh(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.04), tag));
    tg.position.set(0.17, 0.02, s * 0.255);
    hd.add(tg);
  }
  const legDef = [[0.48, 0.14, 0, false], [0.48, -0.14, Math.PI, false], [-0.56, 0.14, Math.PI, true], [-0.56, -0.14, 0, true]];
  for (const [x, z, off, hind] of legDef) {
    const g = new THREE.Group();
    g.position.set(x, 0.86, z);
    cow.add(g);
    const up = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.44, 18), hide));
    up.position.y = -0.22;
    g.add(up);
    if (hind) ell(g, 0.16, 0.24, 0.12, -0.02, -0.04, 0); else ell(g, 0.11, 0.20, 0.10, 0.0, -0.08, 0);
    ell(g, 0.05, 0.05, 0.05, 0, -0.44, 0);
    const lo = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.36, 14), hide));
    lo.position.y = -0.62;
    g.add(lo);
    const hf = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.056, 0.06, 16), hoof));
    hf.position.y = -0.83;
    g.add(hf);
    legs.push({ g, off });
  }
  pipe(cow, [[-0.88, 1.22, 0], [-0.95, 1.05, 0], [-0.97, 0.80, 0], [-0.96, 0.52, 0]], 0.02, hide);
  ell(cow, 0.035, 0.09, 0.035, -0.96, 0.45, 0);
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
dimension([-1.25, 0.02, DS * 1.45], [1.55, 0.02, DS * 1.45], [[-1.25, 0.02, DS * 0.47], [-1.25, 0.02, DS * 1.52]], [[1.55, 0.02, DS * 0.47], [1.55, 0.02, DS * 1.52]], '2,80 m');
dimension([1.85, 0.0, DS * 0.45], [1.85, 2.10, DS * 0.45], [null], [[1.17, 2.10, DS * 0.45], [1.92, 2.10, DS * 0.45]], '2,10 m');
dimension([1.85, 0.02, -0.45], [1.85, 0.02, 0.45], [[1.57, 0.02, -0.45], [1.92, 0.02, -0.45]], [[1.57, 0.02, 0.45], [1.92, 0.02, 0.45]], '0,90 m');
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
const S = { head: 0, doors: 0, rear: 0, cowX: COW_HOME };
const target = { head: 0, doors: 0, rear: 0 };
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

const vA = new THREE.Vector3(), vB = new THREE.Vector3();
let walkPhase = 0, walkAmp = 0, lastCowX = S.cowX, lcdKey = '';
function applyPose(dt = 0) {
  const inner = lerp(HEAD_CLOSED, HEAD_OPEN, S.head);
  for (const s of [-1, 1]) {
    halves[s].position.z = s * inner;
    headCyl[s].update(vA.set(1.235, 2.07, s * 0.035), vB.set(1.235, 2.07, s * (inner + 0.20)));
  }
  for (const d of doors) d.pivot.rotation.y = d.sign * S.doors * DOOR_ANG;
  rearPivot.rotation.y = -DS * S.rear * REAR_ANG;
  rearPivot.updateMatrixWorld(true);
  rearCyl.update(REAR_A, rearTab.getWorldPosition(vB));
  // animal
  const dx = S.cowX - lastCowX;
  lastCowX = S.cowX;
  const moving = Math.abs(dx) > 1e-5;
  walkAmp = lerp(walkAmp, moving ? 0.34 : 0, Math.min(1, dt * 6));
  walkPhase += dx * (Math.PI * 2 / 1.15);
  for (const l of legs) l.g.rotation.z = walkAmp * Math.sin(walkPhase + l.off);
  cow.position.set(S.cowX, FLOOR * smooth(-2.35, -1.35, S.cowX) + Math.abs(Math.sin(walkPhase)) * walkAmp * 0.03, 0);
  updateLCD();
}

function updateLCD() {
  const st = [
    ['CABEÇA', S.head < 0.5 ? 'FECHADA' : 'ABERTA', S.head < 0.5],
    ['LATERAIS', S.doors < 0.5 ? 'FECHADAS' : 'ABERTAS', S.doors < 0.5],
    ['PORTÃO', S.rear < 0.5 ? 'FECHADO' : 'ABERTO', S.rear < 0.5],
  ];
  const keyS = st.map((r) => r[1]).join();
  if (keyS === lcdKey) return;
  lcdKey = keyS;
  const g = lcdCanvas.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 320);
  grd.addColorStop(0, '#11261a'); grd.addColorStop(1, '#0a160f');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#7fe0a0';
  g.font = '700 34px "Nunito Sans", Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('SafeBov', 26, 38);
  g.font = '600 24px "Nunito Sans", Arial, sans-serif';
  g.fillStyle = '#5c8a6c';
  g.textAlign = 'right'; g.fillText('120 bar', 486, 40); g.textAlign = 'left';
  g.fillStyle = '#244a33'; g.fillRect(26, 70, 460, 3);
  st.forEach(([label, value, ok], i) => {
    const y = 118 + i * 66;
    g.fillStyle = '#9fc7ad'; g.font = '700 28px "Nunito Sans", Arial, sans-serif';
    g.fillText(label, 26, y);
    g.fillStyle = ok ? '#5ce08a' : '#f2c14e';
    g.beginPath(); g.arc(300, y, 10, 0, Math.PI * 2); g.fill();
    g.font = '800 28px "Nunito Sans", Arial, sans-serif';
    g.fillText(value, 322, y);
  });
  lcdTex.needsUpdate = true;
}

/* ---------- vistas e câmera ---------- */
const VIEWS = {
  perspectiva: { pos: [3.1, 2.25, -5.0], target: [0.1, 0.95, 0] },
  frontal: { pos: [6.2, 1.15, 0.0001], target: [0.3, 1.05, 0] },
  lateral: { pos: [0.15, 1.15, -6.6], target: [0.15, 1.05, 0] },
  traseira: { pos: [-6.2, 1.2, 0.0001], target: [-0.3, 1.05, 0] },
  superior: { pos: [0.15, 7.6, -0.001], target: [0.15, 0.8, 0] },
  manejo: { pos: [-1.7, 3.3, -10.6], target: [-1.5, 0.85, 0] },
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
    ox = panelOpen() ? 40 : 0;
    oy = 22;
  }
  camera.setViewOffset(w, h, ox, oy, w, h);
  camera.updateProjectionMatrix();
}
const layoutSoon = () => requestAnimationFrame(() => { resize(); invalidate(); });
window.addEventListener('resize', () => { updateInfoVisibility(); resize(); invalidate(); });
controls.addEventListener('change', () => invalidate());

/* ---------- destaques ---------- */
const HOTSPOTS = [
  { id: 'cabeceira', part: 'cabeceira', title: 'Cabeceira com contenção ajustável', text: 'Duas folhas deslizantes fecham ao redor do pescoço por acionamento hidráulico. A abertura se ajusta ao porte do animal.', anchor: [1.27, 1.86, 0], view: { pos: [3.5, 1.8, -2.0], target: [1.1, 1.15, 0] }, action: 'head' },
  { id: 'acolchoamento', part: 'acolchoamento', title: 'Acolchoamento de alta densidade', text: 'Placas de borracha na cabeceira e nas laterais amortecem o contato, reduzem o estresse e o risco de lesões.', anchor: [1.30, 1.30, DS * 0.33], view: { pos: [2.7, 1.5, -2.2], target: [1.1, 1.15, -0.15] } },
  { id: 'laterais', part: 'laterais', title: 'Laterais articuladas com trava', text: 'As portas inferiores abrem para fora e liberam acesso total ao animal: exame físico, coleta de sangue, aplicação de medicamentos e casqueamento.', anchor: [0.36, 0.86, DS * 0.48], view: { pos: [0.9, 1.5, -4.2], target: [-0.15, 0.75, 0] }, action: 'doors' },
  { id: 'painel', part: 'painel', title: 'Painel de controle hidráulico', text: 'Comandos simples e rápidos ao alcance do operador. O visor mostra o estado da cabeceira, das laterais e do portão.', anchor: [-0.72, 1.64, DS * 0.56], view: { pos: [-0.15, 1.6, -1.9], target: [-0.72, 1.32, -0.5] } },
  { id: 'portao', part: 'portao', title: 'Portão traseiro', text: 'Fecha atrás do animal com travamento seguro e acionamento hidráulico, impedindo o recuo durante o manejo.', anchor: [-1.34, 1.30, 0], view: { pos: [-3.8, 1.8, -1.7], target: [-1.2, 1.0, 0] }, action: 'rear' },
  { id: 'piso', part: 'piso', title: 'Piso antiderrapante', text: 'Borracha com relevo no interior do brete e chapa xadrez na entrada, na saída e no degrau. Reduz escorregões do animal e da equipe.', anchor: [1.40, 0.16, 0.20], view: { pos: [3.0, 1.4, -1.5], target: [1.0, 0.2, 0] } },
  { id: 'plataforma', part: 'plataforma', title: 'Degrau do operador', text: 'Plataforma com chapa antiderrapante que coloca o operador na altura do painel e da lateral do animal.', anchor: [-0.60, 0.34, DS * 0.80], view: { pos: [0.4, 1.3, -2.9], target: [-0.75, 0.45, -0.7] } },
  { id: 'hidraulico', part: 'hidraulico', title: 'Cilindros e mangueiras hidráulicas', text: 'Os cilindros movem a cabeceira e o portão traseiro. As mangueiras saem do painel e correm pelo alto da estrutura, longe do animal.', anchor: [-1.08, 2.02, -DS * 0.30], view: { pos: [-2.8, 3.2, -2.0], target: [-0.6, 1.85, 0.1] } },
  { id: 'estrutura', part: 'estrutura', title: 'Estrutura em aço carbono galvanizado', text: 'Tubos de aço carbono com proteção galvanizada contra corrosão. Superfícies lisas e de fácil higienização.', anchor: [0.45, 2.12, DS * 0.45], view: { pos: [3.1, 2.6, -5.2], target: [0.05, 1.0, 0] } },
];
const ACTION_LABEL = { head: ['Abrir cabeceira', 'Fechar cabeceira'], doors: ['Abrir laterais', 'Fechar laterais'], rear: ['Abrir portão', 'Fechar portão'] };

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
    <div><dt>Comprimento</dt><dd>2,80 m</dd></div>
    <div><dt>Largura</dt><dd>0,90 m</dd></div>
    <div><dt>Altura</dt><dd>2,10 m</dd></div>
  </dl>
  <h4>Principais materiais</h4>
  <ul class="mats">
    <li><i class="sw sw-steel"></i>Aço carbono <span>estrutura</span></li>
    <li><i class="sw sw-galv"></i>Aço galvanizado <span>proteção contra corrosão</span></li>
    <li><i class="sw sw-pad"></i>Borracha de alta densidade <span>acolchoamento</span></li>
    <li><i class="sw sw-floor"></i>Piso antiderrapante <span>segurança</span></li>
    <li><i class="sw sw-hose"></i>Mangueiras hidráulicas <span>acionamento</span></li>
  </ul>
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
const MECH_TEXT = { head: ['Fechada', 'Aberta'], doors: ['Fechadas', 'Abertas'], rear: ['Fechado', 'Aberto'] };
function syncUI() {
  for (const k of ['head', 'doors', 'rear']) {
    const open = target[k] > 0.5;
    const row = document.querySelector(`.mech[data-mech="${k}"]`);
    row.querySelector('.state').textContent = MECH_TEXT[k][open ? 1 : 0];
    row.classList.toggle('open', open);
    const b = row.querySelector('button');
    b.textContent = open ? 'Fechar' : 'Abrir';
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
  await Promise.all([mech('doors', 0, 0.9), mech('head', 1, 0.9), mech('rear', 1, 1.1)]);
  S.cowX = lastCowX = COW_START;
  flyTo(VIEWS.manejo, 1.4);
  setView(null);
  await sleep(500);
  caption('1', 'Entrada do animal pelo portão traseiro');
  await tweenTo(S, 'cowX', COW_HOME, 4.2, easeOut);
  caption('2', 'Portão traseiro fecha e trava');
  await mech('rear', 0, 1.3);
  flyTo(VIEWS.perspectiva, 1.6);
  caption('3', 'Cabeceira contém o pescoço com acolchoamento');
  await sleep(300);
  await mech('head', 0, 1.2);
  caption('4', 'Laterais abrem para exame e procedimentos');
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
const tMin = new THREE.Vector3(-2.5, 0, -2), tMax = new THREE.Vector3(2.5, 2.4, 2);
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
  Object.assign(S, { head: 0, doors: 0, rear: 0, cowX: COW_HOME });
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
window.__safebov = { exportGLB, S, flyTo, VIEWS, select, mech, setView, setSheet, stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, meshes: (() => { let n = 0; model.traverse((o) => { if (o.isMesh) n++; }); return n; })() }) };

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
  Promise.all([document.fonts.load('700 168px Caveat'), document.fonts.load('700 28px "Nunito Sans"')])
    .then(() => { drawLogo(); logoTex.needsUpdate = true; lcdKey = ''; invalidate(); })
    .catch(() => {});
}
