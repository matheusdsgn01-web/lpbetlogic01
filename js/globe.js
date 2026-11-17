/* =========================================================
   Seção Mercados — globo 3D interativo
   - Terra 360° (mapas NASA) recolorida nas cores da marca
   - Pontilhado no formato de cada país (fronteiras Natural Earth),
     flutuando sobre o globo; o país ativo "sobe" e brilha
   - Clique num país da lista → o globo gira até ele e o card troca
   - Arraste (mouse/dedo) → gira; o país que fica na frente é ativado
   Dados do card: objeto COUNTRIES abaixo.
   ========================================================= */
import * as THREE from "three";

/* ---------- Países ---------- */
// status: "live" (disponível) | "soon" (em breve)
// kpis: briefing "BetLogic — Mercados de iGaming online 2025–2028" (valores em US$).
//   "~" = estimativa/aproximação; volume apostado = GGR ÷ 10% (hold hipotético).
const k = (ggr, ggr28, cagr, vol) => ({ ggr: usd(ggr), ggr28: usd(ggr28), cagr: `${cagr} a.a.`, vol: usd(vol) });
const usd = (v) => (v.startsWith("~") ? `~US$ ${v.slice(1)}` : `US$ ${v}`);
const COUNTRIES = [
  { code: "BR", iso: "076", name: "Brasil",        flag: "brasil",        status: "live", kpis: k("6,30 bi", "7,41 bi", "+5,6%", "~63,0 bi") },
  { code: "MX", iso: "484", name: "México",        flag: "mexico",        status: "live", kpis: k("2,85 bi", "4,95 bi", "+20,2%", "~28,5 bi") },
  { code: "AR", iso: "032", name: "Argentina",     flag: "argentina",     status: "live", kpis: k("951 mi", "1,76 bi", "+22,7%", "~9,51 bi") },
  { code: "CO", iso: "170", name: "Colômbia",      flag: "colombia",      status: "live", kpis: k("566 mi", "704 mi", "+7,5%", "~5,66 bi") },
  { code: "PE", iso: "604", name: "Peru",          flag: "peru",          status: "live", kpis: k("530 mi", "768 mi", "+13,1%", "~5,30 bi") },
  { code: "CL", iso: "152", name: "Chile",         flag: "chile",         status: "live", kpis: k("625 mi", "1,20 bi", "+24,3%", "~6,25 bi") },
  { code: "UY", iso: "858", name: "Uruguai",       flag: "uruguai",       status: "live", kpis: k("72 mi", "100 mi", "+11,5%", "~720 mi") },
  { code: "PY", iso: "600", name: "Paraguai",      flag: "paraguai",      status: "live", kpis: k("~114 mi", "~139 mi", "+6,8%", "~1,14 bi") },
  { code: "BO", iso: "068", name: "Bolívia",       flag: "bolivia",       status: "live", kpis: k("~77 mi", "~97 mi", "+8,0%", "~770 mi") },
  { code: "EC", iso: "218", name: "Equador",       flag: "equador",       status: "live", kpis: k("~227 mi", "~302 mi", "+10,0%", "~2,27 bi") },
  { code: "CR", iso: "188", name: "Costa Rica",    flag: "costa-rica",    status: "live", kpis: k("~40 mi", "~50 mi", "+7,7%", "~400 mi") },
  { code: "ZA", iso: "710", name: "África do Sul", flag: "africa-do-sul", status: "soon", kpis: k("3,30 bi", "~4,65 bi", "+12,1%", "~33,0 bi") },
  { code: "NG", iso: "566", name: "Nigéria",       flag: "nigeria",       status: "soon", kpis: k("1,10 bi", "~1,42 bi", "+8,9%", "~11,0 bi") },
  { code: "GH", iso: "288", name: "Gana",          flag: "gana",          status: "soon", kpis: k("883 mi", "~1,11 bi", "+7,9%", "~8,83 bi") }
];
const START = "MX";

const CFG = {
  frontAz: 0.36,      // o país ativo fica um pouco à esquerda do centro (o card cobre a direita)
  frontEl: -0.14,     // ...e um pouco abaixo (o card cobre o topo)
  rotateDur: 1.5,     // s para girar até o país clicado
  dragSpeed: 0.0055,  // rad por px arrastado
  pickAngle: 0.38,    // rad: distância máxima da "frente" para ativar o país ao arrastar
  liveColor: new THREE.Color(0x6fe0ff),
  soonColor: new THREE.Color(0xa8becf)
};

const root = document.querySelector(".globe");
const canvas = root && root.querySelector(".globe__gl");
const card = document.querySelector(".country-card");
const chips = [...document.querySelectorAll(".chip[data-country]")];
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Utilidades geográficas ---------- */
const D2R = Math.PI / 180;
// mesmo mapeamento UV do THREE.SphereGeometry
function latLonToVec(lat, lon, r = 1) {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}
function wrapPi(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

// TopoJSON → anéis de polígonos [[lon,lat],...]
function decodeTopo(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const ring = (ids) => {
    const out = [];
    ids.forEach((i, k) => {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      out.push(...(k ? a.slice(1) : a));
    });
    return out;
  };
  const byId = {};
  topo.objects.countries.geometries.forEach((g) => {
    const polys = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
    byId[g.id] = polys.map((p) => p.map(ring));
  });
  return byId;
}
function inRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolys(x, y, polys) {
  return polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
}
// grade de pontos dentro do país (espaçamento proporcional ao tamanho)
function countryDots(polys) {
  let minX = 180, maxX = -180, minY = 90, maxY = -90;
  polys.forEach((p) => p[0].forEach(([x, y]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }));
  const ext = Math.max(maxX - minX, maxY - minY);
  const step = Math.min(1.05, Math.max(0.32, ext / 16));
  const pts = [];
  for (let lat = minY + step / 2; lat <= maxY; lat += step) {
    const lstep = step / Math.max(0.35, Math.cos(lat * D2R));
    const off = (Math.round((lat - minY) / step) % 2) * lstep * 0.5;   // grade intercalada
    for (let lon = minX + off; lon <= maxX; lon += lstep) {
      if (inPolys(lon, lat, polys)) pts.push([lat, lon]);
    }
  }
  return { pts, step };
}

/* ---------- Shaders ---------- */
const EARTH_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const EARTH_FS = `
uniform sampler2D dayMap, lightsMap, specMap, cloudMap;
uniform float time;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){
  vec3 n = normalize(vN), v = normalize(vV);
  vec3 L = normalize(vec3(-0.55, 0.35, 0.75));
  vec3 day = texture2D(dayMap, vUv).rgb;
  float ocean = texture2D(specMap, vUv).r;
  float lum = dot(day, vec3(0.299, 0.587, 0.114));
  // terra e mar recoloridos na paleta da marca
  // azuis escuros bem mais fundos; as partes claras da terra continuam claras
  float lt = smoothstep(0.06, 0.6, lum);
  vec3 land = mix(vec3(0.012, 0.045, 0.11), vec3(0.42, 0.66, 0.86), lt * lt * (3.0 - 2.0 * lt));
  vec3 sea  = mix(vec3(0.002, 0.012, 0.045), vec3(0.012, 0.075, 0.21), smoothstep(0.0, 0.3, lum) * 0.6 + 0.1);
  vec3 col = mix(land, sea, ocean);
  float diff = max(dot(n, L), 0.0);
  col *= 0.22 + 1.0 * diff;
  // luzes das cidades em ciano (em vez do dourado da foto)
  float lights = texture2D(lightsMap, vUv).r;
  col += vec3(0.55, 0.92, 1.0) * lights * (1.0 - ocean) * (0.3 + 0.7 * (1.0 - diff));
  // nuvens girando devagar (a textura se repete → volta contínua, sem emenda)
  vec4 c = texture2D(cloudMap, vUv + vec2(time * 0.0025, 0.0));
  float cl = c.r * c.a;
  col = mix(col, vec3(0.80, 0.93, 1.0) * (0.35 + 0.75 * diff), cl * 0.5);
  // polos: as linhas do mapa viram círculos ali → suaviza para um tom liso
  // cor média da faixa vizinha do mapa (gelo), lida um pouco antes do polo → sem "buraco"
  float edgeV = vUv.y < 0.5 ? 0.075 : 0.925;
  vec3 iceDay = texture2D(dayMap, vec2(vUv.x, edgeV), 7.0).rgb;   // bias alto = média borrada, sem raios
  float iceLum = dot(iceDay, vec3(0.299, 0.587, 0.114));
  vec3 ice = mix(vec3(0.012, 0.045, 0.11), vec3(0.42, 0.66, 0.86), smoothstep(0.06, 0.6, iceLum));
  float polar = smoothstep(0.84, 0.97, abs(vUv.y - 0.5) * 2.0);
  vec3 polarCol = ice * (0.22 + 1.0 * diff);
  col = mix(col, polarCol, polar);
  // borda: só um contorno fino para dar volume (sem brilho difuso)
  float fr = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  col += vec3(0.20, 0.62, 0.95) * fr * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;
const DOTS_VS = `
attribute float aCountry; attribute float aRand; attribute float aStep; attribute vec3 aColor;
uniform float uActive, uProg, uTime, uRadiusPx;
varying float vAlpha; varying vec3 vColor;
void main(){
  float isAct = 1.0 - step(0.5, abs(aCountry - uActive));
  float p = clamp((uProg - aRand * 0.45) / 0.55, 0.0, 1.0);
  p = 1.0 - pow(1.0 - p, 3.0);
  float lift = 1.006 + isAct * p * 0.045;             // o país ativo "sobe" sobre o globo
  vec4 mv = modelViewMatrix * vec4(position * lift, 1.0);
  float facing = dot(normalize(normalMatrix * position), vec3(0.0, 0.0, 1.0));
  float size = aStep * 0.01745 * uRadiusPx * mix(0.42, 0.62 + 0.12 * p, isAct);
  gl_PointSize = size * (4.3 / -mv.z);
  float tw = 0.78 + 0.22 * sin(uTime * 2.6 + aRand * 40.0);
  vAlpha = mix(0.22, p * tw, isAct) * smoothstep(0.02, 0.3, facing);
  vColor = aColor;
  gl_Position = projectionMatrix * mv;
}`;
const DOTS_FS = `
varying float vAlpha; varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = vAlpha * smoothstep(0.5, 0.18, d);
  gl_FragColor = vec4(vColor * a, a);
}`;

/* ---------- Card ---------- */
const $cc = (k) => card && card.querySelector(`[data-cc="${k}"]`);
function fillCard(c) {
  if (!card) return;
  card.classList.add("is-swapping");
  setTimeout(() => {
    $cc("flag").src = `assets/flag-${c.flag}.svg`;
    $cc("name").textContent = c.name;
    const pill = $cc("status");
    const live = c.status === "live";
    pill.classList.toggle("pill--glow", live);
    pill.innerHTML = live ? '<img src="assets/dot.svg" alt="">Disponível' : "Em breve";
    const k = c.kpis || {};
    ["ggr", "ggr28", "cagr", "vol"].forEach((key) => { $cc(key).textContent = k[key] || "—"; });
    card.classList.remove("is-swapping");
  }, 220);
}

/* ---------- Início ---------- */
async function init() {
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.35);

  const loader = new THREE.TextureLoader();
  const load = (f) => new Promise((res, rej) => loader.load(`assets/globe/${f}`, res, undefined, rej));
  const [dayMap, lightsMap, specMap, cloudMap, topo] = await Promise.all([
    load("earth_atmos_2048.jpg"), load("earth_lights_2048.png"),
    load("earth_specular_2048.jpg"), load("earth_clouds_1024.png"),
    fetch("assets/globe/countries-50m.json").then((r) => r.json())
  ]);
  [dayMap, lightsMap, specMap, cloudMap].forEach((t) => {
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.wrapS = THREE.RepeatWrapping;          // dá a volta no globo sem emenda
    t.needsUpdate = true;
  });

  const globe = new THREE.Group();
  globe.rotation.order = "XYZ";
  scene.add(globe);

  const earthMat = new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: dayMap }, lightsMap: { value: lightsMap }, specMap: { value: specMap }, cloudMap: { value: cloudMap }, time: { value: 0 } },
    vertexShader: EARTH_VS, fragmentShader: EARTH_FS
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), earthMat));


  /* pontilhado dos países */
  const shapes = decodeTopo(topo);
  const pos = [], aCountry = [], aRand = [], aStep = [], aColor = [];
  COUNTRIES.forEach((c, idx) => {
    const polys = shapes[c.iso];
    if (!polys) return;
    const { pts, step } = countryDots(polys);
    const col = c.status === "live" ? CFG.liveColor : CFG.soonColor;
    const center = new THREE.Vector3();
    pts.forEach(([lat, lon]) => {
      const v = latLonToVec(lat, lon);
      center.add(v);
      pos.push(v.x, v.y, v.z);
      aCountry.push(idx); aRand.push(Math.random()); aStep.push(step);
      aColor.push(col.r, col.g, col.b);
    });
    center.normalize();
    c.idx = idx;
    c.lat = Math.asin(center.y) / D2R;
    c.lon = Math.atan2(-center.z, center.x) / D2R;
    c.vec = center;
  });
  const dotsGeo = new THREE.BufferGeometry();
  dotsGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  dotsGeo.setAttribute("aCountry", new THREE.Float32BufferAttribute(aCountry, 1));
  dotsGeo.setAttribute("aRand", new THREE.Float32BufferAttribute(aRand, 1));
  dotsGeo.setAttribute("aStep", new THREE.Float32BufferAttribute(aStep, 1));
  dotsGeo.setAttribute("aColor", new THREE.Float32BufferAttribute(aColor, 3));
  const dotsMat = new THREE.ShaderMaterial({
    uniforms: { uActive: { value: -1 }, uProg: { value: 0 }, uTime: { value: 0 }, uRadiusPx: { value: 300 } },
    vertexShader: DOTS_VS, fragmentShader: DOTS_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  globe.add(new THREE.Points(dotsGeo, dotsMat));

  /* ---------- Tamanho ---------- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dotsMat.uniforms.uRadiusPx.value = (h / 2) * 0.86;
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- Rotação ---------- */
  // ângulos que colocam (lat, lon) na "frente" (levemente à esquerda e abaixo do centro)
  // no desktop o card cobre a direita/topo do globo → país fica à esquerda e abaixo;
  // no celular o card fica embaixo do globo → país no centro
  // (até 640px o card sai de cima do globo; acima disso ele cobre a direita/topo)
  const front = () => (window.innerWidth <= 640 ? { az: 0, el: 0 } : { az: CFG.frontAz, el: CFG.frontEl });
  const targetFor = (c) => {
    const f = front();
    return { ry: -Math.PI / 2 - c.lon * D2R - f.az, rx: c.lat * D2R - f.el };
  };
  let tween = null, vel = 0, dragging = false;

  function rotateTo(c, instant) {
    const t = targetFor(c);
    const from = { ry: globe.rotation.y, rx: globe.rotation.x };
    const to = { ry: from.ry + wrapPi(t.ry - from.ry), rx: t.rx };
    if (instant || reduce) { globe.rotation.y = to.ry; globe.rotation.x = to.rx; tween = null; return; }
    tween = { from, to, t0: performance.now(), dur: CFG.rotateDur * 1000 };
  }

  /* ---------- Ativação ---------- */
  let active = null, progStart = 0;
  function setActive(c, { rotate = true, instant = false } = {}) {
    if (!c) return;
    if (rotate) rotateTo(c, instant);
    if (active === c) return;
    active = c;
    dotsMat.uniforms.uActive.value = c.idx;
    progStart = performance.now() + (rotate && !instant ? 350 : 0);
    dotsMat.uniforms.uProg.value = 0;
    chips.forEach((b) => b.classList.toggle("is-active", b.dataset.country === c.code));
    fillCard(c);
  }

  // país mais próximo da "frente" (para o arraste)
  const frontVec = new THREE.Vector3();
  const inv = new THREE.Quaternion();
  function pickFront() {
    // direção da frente no espaço do globo
    const f = front();
    frontVec.set(Math.sin(-f.az) * Math.cos(f.el), Math.sin(f.el), Math.cos(f.az) * Math.cos(f.el));
    inv.copy(globe.quaternion).invert();
    frontVec.applyQuaternion(inv);
    let best = null, bestA = CFG.pickAngle;
    COUNTRIES.forEach((c) => {
      if (!c.vec) return;
      const a = c.vec.angleTo(frontVec);
      if (a < bestA) { bestA = a; best = c; }
    });
    return best;
  }

  chips.forEach((b) => b.addEventListener("click", () => {
    setActive(COUNTRIES.find((c) => c.code === b.dataset.country));
  }));

  /* ---------- Arrastar ---------- */
  let lastX = 0, lastY = 0, lastPick = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; tween = null; vel = 0;
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    globe.rotation.y += dx * CFG.dragSpeed;
    // inclinação vertical limitada: os polos não ficam de frente
    globe.rotation.x = Math.max(-0.75, Math.min(0.75, globe.rotation.x + dy * CFG.dragSpeed));
    // inércia suavizada e limitada (um "flick" rápido não faz o globo dar várias voltas)
    vel = Math.max(-0.045, Math.min(0.045, vel * 0.5 + dx * CFG.dragSpeed * 0.5));
    const now = performance.now();
    if (now - lastPick > 120) { lastPick = now; setActive(pickFront(), { rotate: false }); }
  });
  const endDrag = () => { if (!dragging) return; dragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  /* ---------- Loop ---------- */
  let visible = true, raf = 0;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function frame(now) {
    raf = 0;
    const t = now / 1000;
    earthMat.uniforms.time.value = t % 400;   // 400s × 0.0025 = 1 volta exata → reinício sem salto
    dotsMat.uniforms.uTime.value = t;
    dotsMat.uniforms.uProg.value = reduce ? 1 : Math.max(0, Math.min(1, (now - progStart) / 1100));

    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur);
      const e = ease(k);
      globe.rotation.y = tween.from.ry + (tween.to.ry - tween.from.ry) * e;
      globe.rotation.x = tween.from.rx + (tween.to.rx - tween.from.rx) * e;
      if (k >= 1) tween = null;
    } else if (!dragging && Math.abs(vel) > 0.0001) {
      // inércia depois de soltar
      globe.rotation.y += vel;
      vel *= 0.93;
      if (Math.abs(vel) < 0.0004) { vel = 0; setActive(pickFront(), { rotate: false }); }
    }
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  setActive(COUNTRIES.find((c) => c.code === START), { instant: true });
  frame(performance.now());
  root.classList.add("is-3d");

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }, { rootMargin: "200px" }).observe(root);
  }
  kick();
}

init().catch((err) => console.warn("Globo 3D indisponível, usando imagem:", err));
