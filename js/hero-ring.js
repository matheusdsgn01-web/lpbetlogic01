/* =========================================================
   Hero — anel 3D girando ("sempre carregando")
   Modelo gerado a partir do vetor do símbolo (assets/symbol.svg):
   cada uma das 82 barras vira um bloco 3D com chanfro.
   Ajustes rápidos: objeto CFG abaixo.
   ========================================================= */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const CFG = {
  speed: 0.22,                // rad/s no próprio eixo (~29s por volta)
  floatAmp: 0.05,             // flutuação vertical (≈ 10px para cima e para baixo)
  floatSpeed: 0.75,           // velocidade da flutuação (~8s por ciclo)
  tiltY: 0.62,                // giro lateral (mostra a lateral esquerda, como na foto)
  tiltX: -0.08,               // leve inclinação vertical
  outerDepth: 0.22,           // espessura das barras externas
  innerDepth: 0.36,           // barras internas mais fundas (formam o "túnel")
  innerOffset: -0.06,         // anel interno levemente recuado
  twist: 0.24,                // inclinação de cada barra (rad ≈ 14°), como pás de turbina
  color: 0x6f9cc4,            // azul aço (mais próximo do render original)
  metalness: 0.74,
  roughness: 0.3,
  envIntensity: 0.24          // reflexo do ambiente: menor = laterais mais escuras
};

const wrap = document.querySelector(".hero__ring");
const canvas = wrap && wrap.querySelector(".hero__ring-gl");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function init() {
  if (!canvas) return;

  /* ---------- Geometria a partir do SVG ---------- */
  const svg = await fetch("assets/symbol.svg").then((r) => r.text());
  const d = (svg.match(/ d="([^"]+)"/) || [])[1];
  if (!d) return;
  const CX = 396.5, CY = 397.5, S = 1 / 397;

  const outer = [], inner = [];
  const bevel = { bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.005, bevelSegments: 2, curveSegments: 1 };

  for (const m of d.matchAll(/M([^Z]+)Z/g)) {
    const pts = m[1].trim().split(/\s*L\s*/).map((p) => {
      const [x, y] = p.split(",").map(Number);
      return new THREE.Vector2((x - CX) * S, -(y - CY) * S);
    });
    if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(1 / pts.length);
    const isInner = c.length() < 0.62;
    const depth = isInner ? CFG.innerDepth : CFG.outerDepth;
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, ...bevel });
    // centraliza a profundidade; o anel interno fica um pouco recuado
    g.translate(0, 0, -depth / 2 + (isInner ? CFG.innerOffset : 0));
    // gira a barra em torno do próprio eixo radial (efeito turbina)
    const axis = new THREE.Vector3(c.x, c.y, 0).normalize();
    const m4 = new THREE.Matrix4()
      .makeTranslation(c.x, c.y, 0)
      .multiply(new THREE.Matrix4().makeRotationAxis(axis, CFG.twist))
      .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, 0));
    g.applyMatrix4(m4);
    (isInner ? inner : outer).push(g);
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: CFG.color,
    metalness: CFG.metalness,
    roughness: CFG.roughness,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    envMapIntensity: CFG.envIntensity
  });

  const spin = new THREE.Group();
  spin.add(new THREE.Mesh(mergeGeometries(outer), material));
  spin.add(new THREE.Mesh(mergeGeometries(inner), material));

  const tilt = new THREE.Group();
  tilt.rotation.set(CFG.tiltX, CFG.tiltY, 0);
  tilt.add(spin);

  /* ---------- Cena, luz e câmera ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(tilt);

  // luz principal de frente-direita: acende as faces frontais (azul claro)
  const key = new THREE.DirectionalLight(0xdfeeff, 2.8);
  key.position.set(2.4, 2.2, 4);
  // contraluz ciano por trás à direita (combina com a onda)
  const rim = new THREE.DirectionalLight(0x6fe0ff, 2.2);
  rim.position.set(4, -1.5, -3);
  // preenchimento azul-marinho fraco: laterais escuras, mas com volume
  const fill = new THREE.DirectionalLight(0x1d3a5c, 0.9);
  fill.position.set(-4, -1, 1);
  scene.add(key, rim, fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);   // distância: anel com folga do botão e da borda inferior

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", () => { resize(); renderer.render(scene, camera); });

  /* ---------- Animação ---------- */
  let visible = true, last = performance.now(), raf = 0;
  const t0 = performance.now();
  function loop(now) {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (now - t0) / 1000;
    spin.rotation.z -= dt * CFG.speed;     // gira no próprio eixo (sentido horário)
    // flutuando: sobe e desce devagar, com um leve balanço
    tilt.position.y = Math.sin(t * CFG.floatSpeed) * CFG.floatAmp;
    tilt.rotation.x = CFG.tiltX + Math.sin(t * CFG.floatSpeed - 0.8) * 0.025;
    tilt.rotation.y = CFG.tiltY + Math.sin(t * CFG.floatSpeed * 0.6) * 0.02;
    renderer.render(scene, camera);
    if (visible && !reduce) raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && visible && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  renderer.render(scene, camera);
  wrap.classList.add("is-3d");
  kick();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }).observe(wrap);
  }
}

init().catch((err) => console.warn("Anel 3D indisponível, usando imagem:", err));
