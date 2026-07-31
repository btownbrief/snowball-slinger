// SNOWBALL SLINGER — three.js renderer. Low-poly Burlington winter at golden
// hour: layered parallax backdrops, soft shadows, drifting snow, and all the
// juice (debris, puffs, sparkles, dizzy-spiral bonks). Pure view layer — it
// mirrors js/sim.js every frame and never touches game rules.

import * as THREE from '../vendor/three.module.min.js';
import { AMMO, SQUIRREL, SLING } from './levels.js';

const DEG = Math.PI / 180;

// One golden-hour palette per Burlington backdrop.
const LOCALES = {
  battery:    { top: '#3a72c0', mid: '#f0ac72', bot: '#ffe2b0', fog: '#e8cba6', sun: '#ffdf9e', sunX: -18, sunY: 7,  light: 0xffdcae, amb: 1.0 },
  waterfront: { top: '#4a74c4', mid: '#f49a6d', bot: '#ffd9a6', fog: '#ecc29c', sun: '#ffd484', sunX: -10, sunY: 5,  light: 0xffd39c, amb: 0.95 },
  oakledge:   { top: '#2f549e', mid: '#e8875e', bot: '#ffc98f', fog: '#dcb090', sun: '#ffcf7f', sunX: -24, sunY: 9,  light: 0xffc890, amb: 0.9 },
  church:     { top: '#252a5e', mid: '#b06084', bot: '#f2a978', fog: '#b088a0', sun: '#ffc27a', sunX: -26, sunY: 4,  light: 0xf0b48a, amb: 0.8 },
};

const COLORS = {
  snowBlock: 0xffffff, snowBlock2: 0xeff5ff, ice: 0xb9e2f7, wood: 0xb0763d,
  ground: 0xffffff, squirrel: 0x8b8f99, cream: 0xe9e1d2, candy: 0xf0a83c,
};

// Blocked or unsupported WebGL would otherwise leave a blank page: show a
// full-screen notice (styled like the game's cards) instead of a dead canvas.
function showWebglNotice(canvas) {
  const el = document.createElement('div');
  el.className = 'screen';
  el.id = 'webglFail';
  el.innerHTML = `
    <div class="menu-inner">
      <div class="card">
        <div class="card-title">THIS GAME NEEDS WEBGL</div>
        <div class="card-sub">Your browser blocked or can't run 3D graphics.<br>
          Updating the browser or turning off battery saver usually fixes it.</div>
        <div class="card-btns">
          <button class="big-btn" id="webglRetry">↻&nbsp;TRY AGAIN</button>
          <a class="chip-btn" href="https://play.btownbrief.com/">MORE BTOWN GAMES&nbsp;→</a>
        </div>
      </div>
    </div>`;
  (canvas.parentElement || document.body).appendChild(el);
  el.querySelector('#webglRetry').addEventListener('click', () => location.reload());
}

export function createRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('WebGL context unavailable');
  } catch (err) {
    showWebglNotice(canvas);
    throw err; // stops main.js booting; the notice above is the whole UI now
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let pixelCap = 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelCap));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 240);

  // ------------------------------------------------------------- materials
  const matCache = new Map();
  const lambert = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
    return matCache.get(key);
  };
  const iceMat = new THREE.MeshPhongMaterial({
    color: COLORS.ice, transparent: true, opacity: 0.88, shininess: 90, specular: 0xbfe4ff,
  });

  const geoCache = new Map();
  const boxGeo = (w, h, d) => {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  };

  function mesh(geo, material, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const box = (w, h, d, color, x, y, z, parent) => mesh(boxGeo(w, h, d), lambert(color), x, y, z, parent);

  // ---------------------------------------------------------------- lights
  // cool blue fill so snow shadows read wintry; the warm key light is the sun
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x9db0cc, 1.0);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffdcae, 1.75);
  sunLight.position.set(-14, 18, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunLight.shadow.camera, { left: -18, right: 20, top: 14, bottom: -2, near: 1, far: 60 });
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight, sunLight.target);

  // ------------------------------------------------------------ sky + sun
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 2; skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyPlane = mesh(new THREE.PlaneGeometry(320, 78),
    new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false }), 2, 26, -70);
  const sunDisc = mesh(new THREE.CircleGeometry(4.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffdf9e, fog: false }), -18, 7, -68);
  const sunGlow = mesh(new THREE.CircleGeometry(10, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd98f, fog: false, transparent: true, opacity: 0.3, depthWrite: false }), -18, 7, -68.5);

  function paintSky(loc) {
    const g = skyCanvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, loc.top); grad.addColorStop(0.72, loc.mid); grad.addColorStop(1, loc.bot);
    g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
    skyTex.needsUpdate = true;
    sunDisc.material.color.set(loc.sun);
    sunGlow.material.color.set(loc.sun);
    sunDisc.position.set(loc.sunX, loc.sunY, -68);
    sunGlow.position.set(loc.sunX, loc.sunY, -68.5);
    scene.fog = new THREE.Fog(new THREE.Color(loc.fog), 52, 140);
    sunLight.color.set(loc.light);
    hemi.intensity = loc.amb;
    hemi.color.set(loc.top).lerp(new THREE.Color('#ffffff'), 0.55);
  }

  // ---------------------------------------------------------------- ground
  const ground = box(200, 2, 44, COLORS.ground, 2, -1, -2);
  ground.receiveShadow = true;
  for (let i = 0; i < 7; i++) { // soft snow drifts
    const s = mesh(new THREE.SphereGeometry(1.6 + (i % 3) * 0.7, 10, 8), lambert(0xf6fafe),
      -14 + i * 5.4, -0.9 - (i % 2) * 0.3, -3.5 - (i % 3) * 2.2);
    s.scale.y = 0.42; s.receiveShadow = true;
  }

  // ------------------------------------------------------------- slingshot
  const sling = new THREE.Group();
  sling.position.set(SLING.x, 0, 0);
  scene.add(sling);
  const post = mesh(new THREE.CylinderGeometry(0.13, 0.17, 1.7, 8), lambert(0x77461f), 0, 0.85, 0, sling);
  post.castShadow = true;
  // fork opens in X so the Y-shape reads from the side-on camera
  const forkTips = [];
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8), lambert(0x8a5426), s * 0.22, 2.0, s * 0.1, sling);
    arm.rotation.z = -s * 0.42;
    arm.rotation.x = -s * 0.18;
    arm.castShadow = true;
    forkTips.push(new THREE.Vector3(SLING.x + s * 0.44, 2.55, s * 0.2));
  }
  const bandMat = new THREE.MeshBasicMaterial({ color: 0x8e3b2f });
  const bandGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
  const bands = [mesh(bandGeo, bandMat, 0, 0, 0), mesh(bandGeo, bandMat, 0, 0, 0)];
  const pouch = box(0.34, 0.2, 0.34, 0x5e3418, SLING.x + 0.3, 2.1, 0);
  const POUCH_REST = new THREE.Vector3(SLING.x + 0.3, 2.1, 0);

  const up = new THREE.Vector3(0, 1, 0);
  function stretchBand(band, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = Math.max(dir.length(), 0.001);
    band.position.copy(from).addScaledVector(dir, 0.5);
    band.scale.set(1, len, 1);
    band.quaternion.setFromUnitVectors(up, dir.normalize());
  }
  function layoutSling() {
    for (let i = 0; i < 2; i++) stretchBand(bands[i], forkTips[i], pouch.position);
  }
  layoutSling();

  // ------------------------------------------------------------- snowfall
  const SNOW_N = 320;
  const snowPos = new Float32Array(SNOW_N * 3);
  const snowVel = new Float32Array(SNOW_N * 2);
  for (let i = 0; i < SNOW_N; i++) {
    snowPos[i * 3] = -24 + Math.random() * 48;
    snowPos[i * 3 + 1] = Math.random() * 18;
    snowPos[i * 3 + 2] = -16 + Math.random() * 22;
    snowVel[i * 2] = 0.3 + Math.random() * 0.5;      // fall speed
    snowVel[i * 2 + 1] = Math.random() * Math.PI * 2; // drift phase
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snowPts = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  scene.add(snowPts);

  // ------------------------------------------------------- trajectory hint
  const trajMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), 24);
  trajMesh.count = 0;
  scene.add(trajMesh);
  const ghostMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.065, 5, 5),
    new THREE.MeshBasicMaterial({
      color: 0xdff1ff, transparent: true, opacity: 0.28, depthWrite: false,
    }), 28);
  ghostMesh.count = 0;
  scene.add(ghostMesh);
  const tmpMat4 = new THREE.Matrix4();
  let trackedShot = null;
  let trackedPoints = [];
  let lastTrackedPoint = null;

  // ---------------------------------------------------------- locale sets
  const localeGroups = {};
  let activeLocale = null;

  function ridge(parent, x, z, w, h, color) {
    const m = mesh(new THREE.ConeGeometry(w, h, 4), lambert(color), x, h / 2, z, parent);
    m.scale.z = 0.35;
    m.rotation.y = Math.PI / 4;
    return m;
  }
  function pine(parent, x, z, s, color = 0x2f5d46) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.09 * s, 0.12 * s, 0.7 * s, 6), lambert(0x5d3a1e), 0, 0.35 * s, 0, g);
    mesh(new THREE.ConeGeometry(0.75 * s, 1.5 * s, 7), lambert(color), 0, 1.3 * s, 0, g);
    mesh(new THREE.ConeGeometry(0.55 * s, 1.1 * s, 7), lambert(color), 0, 2.1 * s, 0, g);
    mesh(new THREE.SphereGeometry(0.16 * s, 6, 5), lambert(0xf6fafe), 0, 2.65 * s, 0, g); // snow cap
    return g;
  }
  function bareTree(parent, x, z, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 1.6 * s, 6), lambert(0x6b5442), 0, 0.8 * s, 0, g);
    for (const [rx, rz, ry] of [[0.5, 0.2, 0.5], [-0.55, -0.1, 1.1], [0.15, -0.5, 1.5]]) {
      const b = mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.9 * s, 5), lambert(0x6b5442), rx * 0.3 * s, (1.5 + ry * 0.3) * s, rz * 0.2 * s, g);
      b.rotation.z = rx; b.rotation.x = rz;
    }
    return g;
  }
  function lamp(parent, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 6), lambert(0x2c3442), 0, 1.3, 0, g);
    mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd27f }), 0, 2.7, 0, g);
    return g;
  }
  function lakeStrip(parent, z, w, color) {
    const m = box(w, 0.3, 10, color, 0, -0.35, z, parent);
    m.material = lambert(color);
    return m;
  }

  function buildLocale(name) {
    const g = new THREE.Group();
    if (name === 'battery') {
      ridge(g, -26, -46, 26, 7, 0x7d89b8); ridge(g, -2, -48, 34, 9, 0x707ead); ridge(g, 26, -46, 28, 6, 0x8791bd);
      lakeStrip(g, -30, 240, 0x9fb4d6);
      // the park cannon, pointed out over the lake
      const cn = new THREE.Group(); cn.position.set(-17.5, 0, -7); g.add(cn);
      const barrel = mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 8), lambert(0x2e3540), 0, 1.0, 0, cn);
      barrel.rotation.z = 65 * DEG;
      mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 10), lambert(0x54402a), -0.3, 0.5, 0.28, cn).rotation.x = 90 * DEG;
      mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.24, 10), lambert(0x54402a), -0.3, 0.5, -0.28, cn).rotation.x = 90 * DEG;
      bareTree(g, -18, -9, 1.6); bareTree(g, 16, -8, 1.9); bareTree(g, 20, -5, 1.3);
      lamp(g, -13, -5); lamp(g, 3, -7); lamp(g, 14, -6);
    } else if (name === 'waterfront') {
      ridge(g, -20, -50, 30, 8, 0x8087b5); ridge(g, 14, -48, 36, 6, 0x8a8fbb);
      lakeStrip(g, -26, 240, 0xf0b183); // sunset on the broad lake
      lakeStrip(g, -17, 240, 0xc2a9c4);
      // the community boathouse
      const bh = new THREE.Group(); bh.position.set(-17, 0, -11); g.add(bh);
      box(5, 2.2, 3, 0x9a4f3a, 0, 1.1, 0, bh);
      const roof = box(5.6, 1.1, 3.4, 0x50394a, 0, 2.6, 0, bh);
      roof.rotation.z = 0; roof.scale.y = 0.6;
      box(0.8, 0.6, 0.1, 0xffd9a0, -1.2, 1.2, 1.56, bh); box(0.8, 0.6, 0.1, 0xffd9a0, 1.2, 1.2, 1.56, bh);
      // sail masts poking over the breakwater
      for (const [mx, mz, mh] of [[-8, -14, 4.5], [-4, -16, 3.6], [16, -13, 4.2], [20, -15, 3.2]]) {
        mesh(new THREE.CylinderGeometry(0.05, 0.07, mh, 5), lambert(0xd8d2c4), mx, mh / 2 + 0.4, mz, g);
        box(1.4, 0.08, 0.08, 0xd8d2c4, mx, mh * 0.72, mz, g);
      }
      // breakwater light
      const lh = new THREE.Group(); lh.position.set(24, 0, -22); g.add(lh);
      mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.6, 8), lambert(0xe8e4da), 0, 1.3, 0, lh);
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), lambert(0xb03d2e), 0, 2.8, 0, lh);
      lamp(g, -12, -6);
    } else if (name === 'oakledge') {
      ridge(g, -24, -44, 30, 10, 0x5f6b9e); ridge(g, 8, -46, 40, 8, 0x6b74a6);
      lakeStrip(g, -28, 240, 0xdda183);
      pine(g, -16, -7, 1.7); pine(g, -13, -11, 2.3); pine(g, 15, -6, 1.9);
      pine(g, 19, -10, 2.6); pine(g, 23, -6, 1.5); pine(g, -20, -13, 2.8);
      // the ledge itself
      box(6, 1.6, 4, 0x8d8a93, -19, 0.4, -16, g).rotation.y = 0.3;
      box(4, 1.1, 3, 0x9b98a0, -15, 0.3, -18, g).rotation.y = -0.2;
      bareTree(g, 12, -12, 2.2);
    } else if (name === 'church') {
      // dusk on the marketplace: brick storefronts + the church spire
      const shops = [
        [-19, 4.6, 3.4, 0x8a4438], [-13.5, 5.4, 3.0, 0x6e3d52], [15, 4.9, 3.2, 0x845038],
        [20.5, 5.8, 3.0, 0x5c4a63], [25.5, 4.4, 3.2, 0x8a4438],
      ];
      for (const [sx, sh, sw, sc] of shops) {
        box(sw + 1.4, sh, 2.6, sc, sx, sh / 2, -10, g);
        // warm lit windows
        for (let wy = 1.4; wy < sh - 0.6; wy += 1.5) {
          box(0.7, 0.9, 0.06, 0xffd27f, sx - 0.9, wy, -8.65, g).material =
            new THREE.MeshBasicMaterial({ color: 0xffd27f });
          box(0.7, 0.9, 0.06, 0xffc79f, sx + 0.9, wy, -8.65, g).material =
            new THREE.MeshBasicMaterial({ color: 0xffc79f });
        }
      }
      // the spire down the street
      const ch = new THREE.Group(); ch.position.set(-2, 0, -30); g.add(ch);
      box(3.4, 6, 3, 0xcfc4b2, 0, 3, 0, ch);
      mesh(new THREE.ConeGeometry(1.4, 4.5, 6), lambert(0x8f4a3c), 0, 8.2, 0, ch);
      // marquee string lights across the street — one instanced draw call
      const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffe0a1 }), 42);
      let bi = 0;
      for (let row = 0; row < 3; row++) {
        const zRow = -6.5 - row * 1.6, x0 = -18 + row * 3, span = 30 - row * 3;
        for (let k = 0; k < 14; k++) {
          const t = k / 13;
          const bx = x0 + t * span;
          const by = 6.2 - Math.sin(t * Math.PI) * 1.1 - row * 0.3;
          tmpMat4.makeTranslation(bx, by, zRow);
          bulbs.setMatrixAt(bi++, tmpMat4);
        }
      }
      bulbs.instanceMatrix.needsUpdate = true;
      g.add(bulbs);
      lamp(g, -11, -5.5); lamp(g, 12, -5.5);
    }
    // a small hoarded candy pile behind the forts (story dressing)
    for (let i = 0; i < 5; i++) {
      const c = mesh(new THREE.IcosahedronGeometry(0.16, 0), lambert(COLORS.candy, { emissive: 0x7a4a10 }),
        13.2 + (i % 3) * 0.34 - 0.3, 0.14 + Math.floor(i / 3) * 0.26, -1.8 + (i % 2) * 0.3, g);
      c.castShadow = true;
    }
    scene.add(g);
    return g;
  }

  function setLocale(name) {
    if (activeLocale === name) return;
    for (const key of Object.keys(localeGroups)) localeGroups[key].visible = false;
    if (!localeGroups[name]) localeGroups[name] = buildLocale(name);
    localeGroups[name].visible = true;
    activeLocale = name;
    paintSky(LOCALES[name]);
  }

  // ------------------------------------------------------- level meshes
  let levelGroup = new THREE.Group();
  scene.add(levelGroup);
  const bodyMeshes = new Map(); // cannon body id → THREE object

  function blockMesh(block, index) {
    const { def } = block;
    const d = def.d ?? 1.1;
    let material;
    if (def.m === 'ice') material = iceMat;
    else if (def.m === 'wood') material = lambert(COLORS.wood);
    else material = lambert(index % 2 ? COLORS.snowBlock : COLORS.snowBlock2);
    const m = mesh(boxGeo(def.w, def.h, d), material, def.x, def.y, 0, levelGroup);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  function squirrelMesh(def) {
    const g = new THREE.Group();
    g.position.set(def.x, def.y, 0);
    const gray = lambert(COLORS.squirrel), cream = lambert(COLORS.cream);
    const body = mesh(new THREE.SphereGeometry(0.26, 10, 8), gray, 0, -0.08, 0, g);
    body.scale.set(1, 1.25, 0.9); body.castShadow = true;
    mesh(new THREE.SphereGeometry(0.17, 9, 7), cream, -0.12, -0.1, 0.06, g).scale.set(0.8, 1.1, 0.7);
    const head = mesh(new THREE.SphereGeometry(0.17, 10, 8), gray, -0.12, 0.26, 0, g);
    head.castShadow = true;
    mesh(new THREE.SphereGeometry(0.07, 7, 6), cream, -0.26, 0.22, 0, g);
    for (const s of [-1, 1]) {
      mesh(new THREE.ConeGeometry(0.05, 0.13, 5), gray, -0.08, 0.43, s * 0.08, g);
      mesh(new THREE.SphereGeometry(0.026, 6, 5), lambert(0x1c1c22), -0.26, 0.31, s * 0.07, g);
    }
    const tail = mesh(new THREE.TorusGeometry(0.21, 0.09, 7, 10, 3.6), gray, 0.22, 0.08, 0, g);
    tail.rotation.z = -0.6; tail.castShadow = true;
    mesh(new THREE.SphereGeometry(0.1, 7, 6), gray, 0.3, 0.36, 0, g);
    const candy = mesh(new THREE.IcosahedronGeometry(0.09, 0), lambert(COLORS.candy, { emissive: 0x6e4210 }), -0.3, 0.02, 0.08, g);
    candy.castShadow = true;
    levelGroup.add(g);
    return g;
  }

  function projectileMesh(type) {
    const spec = AMMO[type];
    let m;
    if (type === 'ice') {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.r, 0), iceMat);
    } else if (type === 'slush') {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.r, 1), lambert(0xd7ecdd));
      m.scale.y = 0.88;
    } else {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(spec.r, 1), lambert(0xffffff));
    }
    m.castShadow = true;
    scene.add(m);
    return m;
  }

  function buildLevel(sim, locale) {
    scene.remove(levelGroup);
    disposeOwned(levelGroup);
    levelGroup = new THREE.Group();
    scene.add(levelGroup);
    bodyMeshes.clear();
    clearShotTrail();
    setLocale(locale);
    sim.blocks.forEach((b, i) => bodyMeshes.set(b.body.id, blockMesh(b, i)));
    sim.squirrels.forEach((s) => bodyMeshes.set(s.body.id, squirrelMesh(s.def)));
  }

  function attachProjectile(proj) {
    const m = projectileMesh(proj.type);
    bodyMeshes.set(proj.body.id, m);
    return m;
  }

  function syncBodies(sim) {
    const all = [...sim.blocks.map((b) => b.body), ...sim.squirrels.map((s) => s.body),
      ...sim.projectiles.filter((p) => !p.done).map((p) => p.body)];
    for (const body of all) {
      const m = bodyMeshes.get(body.id);
      if (!m || !m.parent) continue;
      m.position.copy(body.position);
      m.quaternion.copy(body.quaternion);
    }
    sampleShotTrail();
  }

  // The live path stays private until a shot ends; only then does it replace
  // the faint previous-shot guide. This is visual history, never aim logic.
  function sampleShotTrail() {
    if (!trackedShot || trackedPoints.length >= 120) return;
    const { x, y, z } = trackedShot.position;
    if (lastTrackedPoint) {
      const dx = x - lastTrackedPoint.x;
      const dy = y - lastTrackedPoint.y;
      const dz = z - lastTrackedPoint.z;
      if (dx * dx + dy * dy + dz * dz < 0.09) return;
    }
    lastTrackedPoint = { x, y, z };
    trackedPoints.push(lastTrackedPoint);
  }

  function beginShotTrail(body) {
    trackedShot = body;
    trackedPoints = [];
    lastTrackedPoint = null;
    sampleShotTrail();
  }

  function finishShotTrail() {
    sampleShotTrail();
    const count = Math.min(trackedPoints.length, 28);
    ghostMesh.count = count;
    for (let i = 0; i < count; i++) {
      const at = count === 1 ? 0 : Math.round((i * (trackedPoints.length - 1)) / (count - 1));
      const p = trackedPoints[at];
      tmpMat4.makeTranslation(p.x, p.y, p.z);
      ghostMesh.setMatrixAt(i, tmpMat4);
    }
    ghostMesh.instanceMatrix.needsUpdate = true;
    trackedShot = null;
    trackedPoints = [];
    lastTrackedPoint = null;
  }

  function cancelShotTrail() {
    trackedShot = null;
    trackedPoints = [];
    lastTrackedPoint = null;
  }

  function clearShotTrail() {
    cancelShotTrail();
    ghostMesh.count = 0;
  }

  // --------------------------------------------------- asset ownership
  // Cached assets (geoCache boxes, matCache lamberts, iceMat, band/debris)
  // are shared across meshes and live for the whole session — never dispose
  // them. Anything a mesh creates for itself (per-instance geometry, one-off
  // materials) is owned, and must be freed when the mesh is discarded or
  // long sessions leak GPU memory on phones.
  function isSharedGeo(geo) {
    if (geo === debrisGeo || geo === bandGeo) return true;
    for (const g of geoCache.values()) if (g === geo) return true;
    return false;
  }
  function isSharedMat(mat) {
    if (mat === iceMat || mat === bandMat) return true;
    for (const m of matCache.values()) if (m === mat) return true;
    return false;
  }
  function disposeOwned(root) {
    root.traverse((o) => {
      if (o.geometry && !isSharedGeo(o.geometry)) o.geometry.dispose();
      if (o.material && !isSharedMat(o.material)) o.material.dispose();
    });
  }

  // detach only — bonkSquirrel keeps the mesh alive for its send-off spiral
  function detachBodyMesh(body) {
    const m = bodyMeshes.get(body.id);
    if (m) m.parent?.remove(m);
    bodyMeshes.delete(body.id);
    return m;
  }
  function removeBodyMesh(body) {
    const m = detachBodyMesh(body);
    if (m) disposeOwned(m);
  }
  // for meshes with no physics body (the loaded pouch ball in game.js)
  function releaseMesh(m) {
    m.parent?.remove(m);
    disposeOwned(m);
  }

  // ------------------------------------------------------------ effects
  const fx = []; // { update(dt) → false when finished }

  const debrisGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  function burstDebris(pos, color, n = 6, spread = 4.5) {
    for (let i = 0; i < n; i++) {
      const m = mesh(debrisGeo, lambert(color), pos.x, pos.y, pos.z + (Math.random() - 0.5) * 0.6);
      m.castShadow = true;
      const vel = new THREE.Vector3((Math.random() - 0.5) * spread * 2, 2 + Math.random() * 5, (Math.random() - 0.5) * spread);
      const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      let life = 0.9 + Math.random() * 0.4;
      fx.push({ update(dt) {
        life -= dt;
        vel.y -= 22 * dt;
        m.position.addScaledVector(vel, dt);
        if (m.position.y < 0.1 && vel.y < 0) { vel.y *= -0.3; vel.x *= 0.6; }
        m.rotation.x += spin.x * dt; m.rotation.z += spin.z * dt;
        const s = Math.max(0.001, Math.min(1, life * 2.2));
        m.scale.setScalar(s);
        if (life <= 0) { scene.remove(m); return false; }
        return true;
      } });
    }
  }

  function puff(pos, color = 0xffffff, n = 5, size = 0.34) {
    for (let i = 0; i < n; i++) {
      const m = mesh(new THREE.SphereGeometry(size * (0.7 + Math.random() * 0.6), 6, 5),
        lambert(color), pos.x + (Math.random() - 0.5) * 0.7, pos.y + (Math.random() - 0.5) * 0.7, pos.z + 0.3);
      const vy = 0.8 + Math.random() * 1.4, vx = (Math.random() - 0.5) * 2;
      let life = 0.55 + Math.random() * 0.25;
      fx.push({ update(dt) {
        life -= dt;
        m.position.y += vy * dt; m.position.x += vx * dt;
        m.scale.multiplyScalar(1 + 1.6 * dt);
        if (life <= 0) { scene.remove(m); m.geometry.dispose(); return false; }
        return true;
      } });
    }
  }

  function sparkles(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      const m = mesh(new THREE.OctahedronGeometry(0.09, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd76e : 0xffb347 }),
        pos.x, pos.y, pos.z + 0.4);
      const a = (i / n) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * 2.4, 1.8 + Math.sin(a) * 1.6, 0.4);
      let life = 0.8;
      fx.push({ update(dt) {
        life -= dt; vel.y -= 6 * dt;
        m.position.addScaledVector(vel, dt);
        m.rotation.z += 9 * dt;
        m.scale.setScalar(Math.max(0.001, life / 0.8));
        if (life <= 0) { scene.remove(m); disposeOwned(m); return false; }
        return true;
      } });
    }
  }

  // Cartoon bonk: the squirrel dizzy-spirals up and away, stars orbiting.
  function bonkSquirrel(body) {
    const g = detachBodyMesh(body);
    if (!g) return;
    scene.add(g);
    const start = g.position.clone();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const stars = [];
    for (let i = 0; i < 3; i++) {
      const s = mesh(new THREE.OctahedronGeometry(0.11, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a }), start.x, start.y, start.z);
      stars.push(s);
    }
    let t = 0;
    fx.push({ update(dt) {
      t += dt;
      g.position.set(
        start.x + Math.sin(t * 9) * 0.5 + dir * t * 1.2,
        start.y + t * 4.2,
        start.z + Math.cos(t * 9) * 0.3,
      );
      g.rotation.z += 13 * dt;
      const k = Math.max(0.001, 1 - t / 1.15);
      g.scale.setScalar(k);
      stars.forEach((s, i) => {
        const a = t * 7 + (i * Math.PI * 2) / 3;
        s.position.set(g.position.x + Math.cos(a) * 0.55, g.position.y + 0.3 + Math.sin(a) * 0.2, g.position.z + 0.3);
        s.rotation.z += 8 * dt;
        s.scale.setScalar(k);
      });
      if (t > 1.15) {
        scene.remove(g); disposeOwned(g); // squirrel parts are per-instance
        stars.forEach((s) => { scene.remove(s); disposeOwned(s); });
        return false;
      }
      return true;
    } });
  }

  // brief squash-and-recover on the flying ball when it whacks something
  function squash(body) {
    const m = bodyMeshes.get(body.id);
    if (!m) return;
    let t = 0;
    fx.push({ update(dt) {
      t += dt;
      const k = t / 0.18;
      if (k >= 1 || !m.parent) { m.scale.setScalar(1); return false; }
      const sq = 1 - 0.35 * Math.sin(Math.PI * k);
      m.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      return true;
    } });
  }

  // ------------------------------------------------------------- camera
  const camState = {
    mode: 'idle', followBody: null,
    look: new THREE.Vector3(0, 2.8, 0), pos: new THREE.Vector3(2, 4, 20),
  };
  function setCameraMode(mode, followBody = null) {
    camState.mode = mode;
    camState.followBody = followBody;
  }
  function desiredCamera(out) {
    const a = camera.aspect;
    const D = THREE.MathUtils.clamp(13.2 / (0.5206 * a), 13, 27);
    const halfW = D * 0.5206 * a; // world half-width visible at the play plane
    let lookX, dist = D;
    if (camState.mode === 'aim') {
      // pull-back zoom, slingshot pinned near the left edge
      dist = D * 1.13;
      lookX = SLING.x + dist * 0.5206 * a * 0.72;
    } else if (camState.mode === 'follow' && camState.followBody) {
      lookX = THREE.MathUtils.clamp(camState.followBody.position.x, SLING.x + 2, 12);
    } else if (camState.mode === 'fort') lookX = 7;
    else lookX = SLING.x + halfW * 0.8; // idle: slingshot visible with margin
    out.look.set(lookX, 3.1, 0);
    out.pos.set(lookX + 1.6, 4.1, dist);
  }
  const camTarget = { look: new THREE.Vector3(), pos: new THREE.Vector3() };

  // --------------------------------------------------- adaptive quality
  let fpsEma = 60, lowTime = 0, qualityTier = 0;
  function autoQuality(dt) {
    fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
    if (fpsEma < 45) lowTime += dt; else lowTime = Math.max(0, lowTime - dt * 2);
    if (lowTime > 2.5 && qualityTier === 0) {
      qualityTier = 1; lowTime = 0;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    } else if (lowTime > 2.5 && qualityTier === 1) {
      qualityTier = 2; lowTime = 0;
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      sunLight.castShadow = false;
    }
  }

  // ---------------------------------------------------------------- api
  let snowTime = 0;
  function update(dt) {
    autoQuality(dt);
    snowTime += dt;
    const pos = snowGeo.attributes.position.array;
    for (let i = 0; i < SNOW_N; i++) {
      pos[i * 3 + 1] -= snowVel[i * 2] * dt * 2.2;
      pos[i * 3] += Math.sin(snowTime * 0.8 + snowVel[i * 2 + 1]) * dt * 0.5;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 16 + Math.random() * 2;
    }
    snowGeo.attributes.position.needsUpdate = true;

    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(dt)) fx.splice(i, 1);

    desiredCamera(camTarget);
    const k = 1 - Math.exp(-4.5 * dt);
    camState.pos.lerp(camTarget.pos, k);
    camState.look.lerp(camTarget.look, k);
    camera.position.copy(camState.pos);
    camera.lookAt(camState.look);

    layoutSling();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pointerToWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    const t = -o.z / d.z;
    return { x: o.x + d.x * t, y: o.y + d.y * t };
  }

  const v3 = new THREE.Vector3();
  function worldToScreen(x, y, z = 0) {
    v3.set(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v3.x * 0.5 + 0.5) * r.width + r.left, y: (-v3.y * 0.5 + 0.5) * r.height + r.top };
  }

  function setPouch(worldPt, loadedMesh) {
    if (worldPt) pouch.position.set(worldPt.x, Math.max(worldPt.y, 0.35), 0);
    else pouch.position.copy(POUCH_REST);
    if (loadedMesh) loadedMesh.position.set(pouch.position.x, pouch.position.y + 0.22, 0);
  }

  function setTrajectory(points) {
    if (!points) { trajMesh.count = 0; return; }
    trajMesh.count = Math.min(points.length, 24);
    points.slice(0, 24).forEach((p, i) => {
      tmpMat4.makeTranslation(p.x, p.y, 0);
      trajMesh.setMatrixAt(i, tmpMat4);
    });
    trajMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    update, resize, buildLevel, attachProjectile, syncBodies, removeBodyMesh, releaseMesh,
    burstDebris, puff, sparkles, bonkSquirrel, squash,
    setCameraMode, pointerToWorld, worldToScreen, setPouch, setTrajectory,
    beginShotTrail, finishShotTrail, cancelShotTrail,
    projectileMesh, POUCH_REST, colors: COLORS,
    stats: () => ({ fps: Math.round(fpsEma), tier: qualityTier, drawCalls: renderer.info.render.calls }),
  };
}
