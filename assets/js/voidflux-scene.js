// The WebGL half of the VoidFlux banner: glowing flux loops and the game's
// real gem mesh, floating over the perspective grid drawn by voidflux-banner.js.
//
// three.js is vendored (assets/js/lib) rather than CDN-loaded: this is a static
// GitHub Pages site with no build step, and a pinned local copy means no
// third-party runtime dependency, no CDN outage, and no cross-origin request.

import * as THREE from './lib/three.module.min.js';
import { Palette, colorPositive, colorNegative } from './voidflux-palette.js';

const MAX_DPR = 1.75;

// The camera frames REF_HEIGHT world units vertically at z = 0, whatever the
// banner's aspect, so world sizes below are stable across viewports and only
// the visible width changes.
const FOV = 40;
const REF_HEIGHT = 6;
const CAM_Z = REF_HEIGHT / 2 / Math.tan((FOV / 2) * (Math.PI / 180));

const LOOP_Z = -1.2;
// kTopTubeRadius is 0.01 against a lattice of half-extent 1.0; at this loop
// scale that is the same hairline-with-a-halo the game renders.
const TUBE_R = 0.014;
const GLOW_SHELLS = [
  { scale: 3.4, opacity: 0.17 },
  { scale: 9.0, opacity: 0.055 },
];
const LOOP_SHAPES = 5;
const LOOP_R = 1.55;
const LOOP_SPACING = LOOP_R * 1.32;
const MAX_LOOPS = 10;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ported from `makeAdditiveGlowMaterial`: constant lighting, additive blend,
// no depth read or write.
function makeAdditiveGlowMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// A closed smooth curve: a circle with two low harmonics of radial and
// out-of-plane wobble, so it reads as a flux loop rather than a ring.
function loopCurve(rng, radius) {
  const n = 13;
  const k1 = 2 + Math.floor(rng() * 2);
  const k2 = 3 + Math.floor(rng() * 2);
  const a1 = 0.07 + rng() * 0.1;
  const a2 = 0.03 + rng() * 0.05;
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const az = 0.12 + rng() * 0.22;
  const pz = rng() * Math.PI * 2;
  const squash = 0.88 + rng() * 0.22;

  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const r = radius * (1 + a1 * Math.sin(k1 * t + p1) + a2 * Math.sin(k2 * t + p2));
    pts.push(new THREE.Vector3(
      r * Math.cos(t),
      r * squash * Math.sin(t),
      radius * az * Math.sin(k1 * t + pz)
    ));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

function makeLoopMesh(curve, color) {
  const group = new THREE.Group();
  const core = new THREE.TubeGeometry(curve, 220, TUBE_R, 6, true);
  group.add(new THREE.Mesh(core, makeAdditiveGlowMaterial(color, 1)));
  for (const shell of GLOW_SHELLS) {
    const geo = new THREE.TubeGeometry(curve, 160, TUBE_R * shell.scale, 8, true);
    group.add(new THREE.Mesh(geo, makeAdditiveGlowMaterial(color, shell.opacity)));
  }
  group.renderOrder = 100;
  return group;
}

// Port of `makeNeonFlickerAction`: bursts of rapid 50ms-out/50ms-in dips,
// separated by multi-second holds, repeating forever. Precomputed into dip
// windows so per-frame cost is a couple of comparisons.
function makeFlicker(rng) {
  const intervals = Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 9));
  const dips = [];
  let t = 0;
  intervals.forEach((interval, idx) => {
    if (idx % 2 === 0) {
      t += interval;
    } else {
      for (let i = 0; i < Math.max(1, interval); i++) {
        dips.push([t, t + 0.1]);
        t += 0.1;
      }
    }
  });
  const cycle = t;
  const phase = rng() * cycle;
  return (elapsed) => {
    const u = (elapsed + phase) % cycle;
    for (const [a, b] of dips) {
      if (u < a) break;
      if (u < b) return Math.abs((u - a) / 0.05 - 1);
    }
    return 1;
  };
}

export function buildLoops(scene) {
  const rng = mulberry32(0x5eed);
  const shapes = [];
  for (let i = 0; i < LOOP_SHAPES; i++) {
    const radius = LOOP_R * (0.85 + rng() * 0.32);
    shapes.push(loopCurve(rng, radius));
  }

  const loops = [];
  for (let i = 0; i < MAX_LOOPS; i++) {
    // Alternating flux signs, teal for positive and pink for negative, exactly
    // as `loopColor` assigns them.
    const positive = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0][i] === 1;
    const group = makeLoopMesh(shapes[i % LOOP_SHAPES], positive ? colorPositive : colorNegative);
    group.rotation.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.7, rng() * Math.PI * 2);
    group.visible = false;
    scene.add(group);
    loops.push({
      group,
      baseOpacity: group.children.map((m) => m.material.opacity),
      yOffset: (rng() - 0.5) * 1.5,
      zOffset: (rng() - 0.5) * 0.9,
      spin: (rng() - 0.5) * 0.06,
      driftPhase: rng() * Math.PI * 2,
      driftRate: 0.14 + rng() * 0.12,
      flicker: makeFlicker(rng),
    });
  }
  return loops;
}

function layoutLoops(loops, worldWidth) {
  const count = Math.min(MAX_LOOPS, Math.max(3, Math.ceil(worldWidth / LOOP_SPACING) + 1));
  const span = (count - 1) * LOOP_SPACING;
  loops.forEach((loop, i) => {
    loop.group.visible = i < count;
    if (i >= count) return;
    loop.x = -span / 2 + i * LOOP_SPACING;
    loop.group.position.set(loop.x, loop.yOffset, LOOP_Z + loop.zOffset);
  });
}

function visibleWidth(camera, z) {
  const d = camera.position.z - z;
  return 2 * d * Math.tan((FOV / 2) * (Math.PI / 180)) * camera.aspect;
}

function makeRenderer(canvas) {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    return renderer;
  } catch {
    return null;
  }
}

export function mount(banner) {
  const canvas = banner.querySelector('.vf-scene');
  if (!canvas) return;

  const renderer = makeRenderer(canvas);
  if (!renderer) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const loops = buildLoops(scene);

  const resize = () => {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    layoutLoops(loops, visibleWidth(camera, LOOP_Z));
  };
  resize();
  new ResizeObserver(resize).observe(banner);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Only run the loop while the banner is on screen, so scrolling past it
  // costs nothing.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { rootMargin: '100px' }
  ).observe(banner);

  const clock = new THREE.Clock();
  let elapsed = 0;

  const frame = () => {
    requestAnimationFrame(frame);
    const dt = clock.getDelta();
    if (!visible) return;
    if (!reduceMotion.matches) {
      elapsed += dt;
      for (const loop of loops) {
        if (!loop.group.visible) continue;
        loop.group.rotation.z += loop.spin * dt;
        loop.group.position.y =
          loop.yOffset + 0.12 * Math.sin(elapsed * loop.driftRate + loop.driftPhase);
        const f = loop.flicker(elapsed);
        loop.group.children.forEach((m, i) => { m.material.opacity = loop.baseOpacity[i] * f; });
      }
    }
    renderer.render(scene, camera);
  };

  banner.setAttribute('data-vf-ready', '');
  frame();
}
