import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import ART from "./first-workout-badge-art.json";

// The 1st Workout badge in 3D: a medal with a frosted enamel face, a gold rim,
// and the Move Mindful mark and "1ST WORKOUT" raised in gold. Loaded on demand
// by first-workout-badge.tsx, so Three.js stays out of the player's bundle.
//
// ART is the raised artwork, traced by design/first-workout-badge/gen_art.py:
// shapes as [outer, hole, hole…], each ring a flat [x, y, …] in coin units
// (radius 1). The design preview is in the README there.

/** One slow turn takes this long. */
const PERIOD_S = 9;
/**
 * How much the turn eases: angle = 2πu − K·sin(4πu), so the badge lingers
 * face-on (front and back) and sweeps quickly past the edge. Under 0.5.
 */
const K = 0.33;
/** The entrance: a spin in, slowing to a stop face-on, before the slow turn begins. */
const INTRO_S = 1.6;
const INTRO_TURNS = 1.5;

const FACE_Z = 0.05; // the enamel surface, each side
const BEVEL = 0.0048;

/**
 * Draws the badge into `canvas` and keeps it turning; drag to turn it by hand.
 * Throws if WebGL isn't available. Returns a function that stops it and frees
 * everything, the WebGL context included.
 */
export function mountBadge(canvas: HTMLCanvasElement, { reduceMotion }: { reduceMotion: boolean }): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 50);
  camera.position.set(0, 0.18, 5.3);
  camera.lookAt(0, 0, 0);

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 5);
  const fill = new THREE.DirectionalLight(0xfff3e2, 0.9);
  fill.position.set(4, -1.5, 3);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(1, 2.5, -5);
  scene.add(key, fill, rim);

  // ── materials ──
  const gold = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setRGB(1.0, 0.63, 0.22, THREE.LinearSRGBColorSpace),
    metalness: 1,
    roughness: 0.17,
    envMapIntensity: 1.15,
  });
  const grain = grainTexture();
  const glow = glowTexture();
  const enamel = new THREE.MeshPhysicalMaterial({
    color: 0xf1eee7,
    map: glow,
    roughness: 0.55,
    roughnessMap: grain,
    bumpMap: grain,
    bumpScale: 0.35,
    clearcoat: 0.55,
    clearcoatRoughness: 0.4,
    sheen: 0.5,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xffffff),
  });

  // ── geometry ──
  const coin = new THREE.Group();
  scene.add(coin);

  // The rim: a lathe profile from the back lip, round the edge, to the front
  // lip. Two shallow grooves on the edge give it the stacked look of a medal.
  const profile = [
    [0.935, -0.05], [0.945, -0.06], [0.952, -0.07], [0.962, -0.075], [0.978, -0.075], [0.99, -0.07],
    [0.998, -0.062], [1.0, -0.052], [1.0, -0.027], [0.994, -0.021], [0.994, -0.016], [1.0, -0.01],
    [1.0, 0.01], [0.994, 0.016], [0.994, 0.021], [1.0, 0.027], [1.0, 0.052], [0.998, 0.062],
    [0.99, 0.07], [0.978, 0.075], [0.962, 0.075], [0.952, 0.07], [0.945, 0.06], [0.935, 0.05],
  ].map(([r, h]) => new THREE.Vector2(r, h));
  const rimGeo = new THREE.LatheGeometry(profile, 160);
  rimGeo.rotateX(Math.PI / 2);
  coin.add(new THREE.Mesh(rimGeo, gold));

  const faceGeo = new THREE.CircleGeometry(0.952, 160);
  const extruded = new THREE.ExtrudeGeometry(
    (ART as number[][][]).map(([outer, ...holes]) => {
      const shape = new THREE.Shape(points(outer));
      for (const h of holes) shape.holes.push(new THREE.Path(points(h)));
      return shape;
    }),
    {
      depth: 0.004,
      bevelEnabled: true,
      bevelThickness: 0.0085,
      bevelSize: BEVEL,
      bevelOffset: -BEVEL,
      bevelSegments: 3,
      curveSegments: 1,
    },
  );
  // Smooth across the bevel's steps, but keep the corners of the letters crisp.
  const artGeo = toCreasedNormals(extruded, THREE.MathUtils.degToRad(50));
  extruded.dispose();
  // Sunk a hair into the enamel, so it reads as inlaid rather than stuck on.
  artGeo.translate(0, 0, FACE_Z - 0.004 + 0.0085);

  for (const back of [false, true]) {
    const half = new THREE.Group();
    const face = new THREE.Mesh(faceGeo, enamel);
    face.position.z = FACE_Z;
    half.add(face, new THREE.Mesh(artGeo, gold));
    // The back is the same design turned round, so it reads right from behind too.
    if (back) half.rotation.y = Math.PI;
    coin.add(half);
  }
  // The body between the faces, behind the rim: keeps the coin solid edge-on.
  const coreGeo = new THREE.CylinderGeometry(0.94, 0.94, FACE_Z * 2, 96, 1, true);
  const core = new THREE.Mesh(coreGeo, enamel);
  core.rotation.x = Math.PI / 2;
  coin.add(core);

  // ── turning, and dragging to turn it ──
  let u = 0; // where it is in the slow turn: 0–1 is one revolution
  let intro = reduceMotion ? 1 : 0; // 0–1 through the entrance
  let manual = reduceMotion ? -0.35 : 0; // turned by hand (and a still three-quarter view)
  let vel = 0;
  let t = 0;
  let drag: { x: number; at: number } | null = null;

  function onDown(e: PointerEvent) {
    drag = { x: e.clientX, at: performance.now() };
    vel = 0;
    canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!drag) return;
    const now = performance.now();
    const d = (e.clientX - drag.x) * 0.014;
    manual += d;
    vel = (d / Math.max(1, now - drag.at)) * 1000;
    drag = { x: e.clientX, at: now };
  }
  function onUp() {
    drag = null;
  }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const timer = new THREE.Timer();
  let frame = 0;
  function draw() {
    // Timed by the timer's own clock, not the frame's timestamp: a first frame
    // stamped before the timer started would step backwards. And never more
    // than a frame's worth after a stall.
    timer.update();
    const dt = THREE.MathUtils.clamp(timer.getDelta(), 0, 0.05);
    if (intro < 1) intro = Math.min(1, intro + dt / INTRO_S);
    else if (!reduceMotion && !drag) u = (u + dt / PERIOD_S) % 1;
    if (!drag) {
      manual += vel * dt;
      vel *= Math.exp(-3.5 * dt);
    }
    if (!reduceMotion) t += dt;

    // The entrance spins the same way as the slow turn, slowing to a stop face-on.
    const spinIn = -(1 - easeOutCubic(intro)) * INTRO_TURNS * 2 * Math.PI;
    coin.rotation.y = 2 * Math.PI * u - K * Math.sin(4 * Math.PI * u) + manual + spinIn;
    coin.rotation.x = -0.05 + 0.03 * Math.sin(t * 0.8);
    coin.position.y = 0.03 * Math.sin(t * 1.25);
    coin.scale.setScalar(0.55 + 0.45 * easeOutBack(intro));

    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  }
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    for (const g of [rimGeo, faceGeo, artGeo, coreGeo]) g.dispose();
    for (const m of [gold, enamel]) m.dispose();
    for (const tex of [grain, glow, env]) tex.dispose();
    pmrem.dispose();
    renderer.dispose();
    // Let go of the WebGL context now, not whenever it's collected: browsers
    // only allow a handful at once, and each finish makes a new one.
    renderer.forceContextLoss();
  };
}

function points(flat: number[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push(new THREE.Vector2(flat[i], flat[i + 1]));
  return out;
}

/** A fine frosted grain, for the enamel's bump and roughness. */
function grainTexture(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 60;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(1.4px)";
  g.drawImage(c, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** The enamel a touch brighter in the middle, cooling toward the rim. */
function glowTexture(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, "#ffffff");
  r.addColorStop(0.7, "#f3f0ea");
  r.addColorStop(1, "#dcd8cf");
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function easeOutCubic(x: number): number {
  return 1 - (1 - x) ** 3;
}

function easeOutBack(x: number): number {
  const c = 1.4;
  return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
}
