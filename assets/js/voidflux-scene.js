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
// Intensities are linear-space multipliers on the palette colour, so a value
// above 1 clips to white and anything well below 1 stays a dim coloured haze.
const GLOW_SHELLS = [
  { scale: 3.6, intensity: 0.28, power: 1.6 },
  { scale: 11.0, intensity: 0.06, power: 2.2 },
];
const LOOP_SHAPES = 5;
const LOOP_R = 1.55;
const MAX_LOOPS = 10;
// A narrow viewport sees a narrow slice of the world, so at full size only two
// loops would fit and they would read as stray arcs rather than a chain.
// Shrinking them keeps the composition - overlapping loops across the whole
// width - at phone widths. Tube radius is unchanged, so the neon keeps its
// weight.
const NARROW_WORLD_WIDTH = 9;
const NARROW_LOOP_SCALE = 0.6;

// The gem hull mesh has a max radius of 1.202, so these scales put a gem at
// roughly a quarter of the banner's height. Charge geometry keeps the game's
// proportions: sphere radius 0.2 and circle radius 0.5 in container units are
// kChargeRadius and 2.5x it, divided through by kGemScale.
const GEM_MESH_URL = new URL('../data/voidflux-gem.json', import.meta.url);
const CHARGE_RADIUS = 0.2;
const CHARGE_CIRCLE_RADIUS = CHARGE_RADIUS * 2.5;
const GEM_TILT = -0.95;
// Matches the width at which the banner stylesheet stacks the copy below the
// scene; the whole stage then lifts clear of the copy.
const STACKED_BREAKPOINT = 860;
const STACKED_STAGE_LIFT = 0.55;
const GEMS = [
  { charge: 3, xFrac: -0.10, y: 0.72, z: 0.95, scale: 0.64 },
  { charge: -2, xFrac: 0.26, y: -0.72, z: 0.35, scale: 0.56 },
  { charge: 4, xFrac: 0.55, y: 0.48, z: 1.25, scale: 0.70 },
  { charge: -1, xFrac: 0.74, y: -0.58, z: 0.6, scale: 0.52 },
];

// Idle-float constants from `makeGemIdleFloatAction`. The drift amplitude is
// 0.030 world units against a gem of radius kGemScale * 1.202, so it scales
// with each gem here rather than being copied literally.
const GEM_DRIFT_AMP = 0.03 / (0.15 * 1.202);
const GEM_TILT_CONE = (30 * Math.PI) / 180;
const GEM_LEAD_IN = 1.0;
// Where reduced motion parks the scene: far enough in that the lead-in has
// opened the precession cone and nothing sits at its starting pose.
const STILL_TIME = 6.0;

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
//
// The game gets its soft neon falloff from a bloom pass. Here the same falloff
// is baked into the material: alpha tracks how squarely a facet faces the
// camera, which on a swept tube or a sphere is exactly the distance in from the
// silhouette. Without it, additive geometry renders as a hard-edged band of
// flat colour rather than a glow.
const GLOW_VERTEX_SHADER = `
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const GLOW_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uPower;
uniform float uOpacity;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  float facing = abs(dot(normalize(vNormalW), normalize(vViewDir)));
  float weight = pow(facing, uPower) * uIntensity * uOpacity;
  // Premultiplied, so a weight above 1 drives channels past full and the
  // framebuffer clips them. That is what leaves a white-hot core with the palette
  // colour surviving at the edges - in a real capture the game's loop lines peak
  // at (245,255,255), not at flat teal.
  gl_FragColor = vec4(uColor * weight, 1.0);
  #include <colorspace_fragment>
  // This canvas composites over the grid canvas, so alpha has to track the light
  // actually emitted. Writing a flat 1.0 turns the dark part of every glow into
  // an opaque black rope that hides the grid behind it.
  gl_FragColor.a = clamp(max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b), 0.0, 1.0);
}
`;

function makeAdditiveGlowMaterial(color, { intensity = 1.6, power = 0.5, side = THREE.DoubleSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uOpacity: { value: 1 },
    },
    vertexShader: GLOW_VERTEX_SHADER,
    fragmentShader: GLOW_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side,
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
  for (const shell of GLOW_SHELLS) {
    const geo = new THREE.TubeGeometry(curve, 160, TUBE_R * shell.scale, 10, true);
    group.add(new THREE.Mesh(geo, makeAdditiveGlowMaterial(color, {
      intensity: shell.intensity,
      power: shell.power,
      side: THREE.FrontSide,
    })));
  }
  const core = new THREE.TubeGeometry(curve, 220, TUBE_R, 8, true);
  group.add(new THREE.Mesh(core, makeAdditiveGlowMaterial(color)));
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

function loopCount(worldWidth, radiusScale) {
  const spacing = LOOP_R * radiusScale * 1.32;
  return Math.min(MAX_LOOPS, Math.max(3, Math.ceil(worldWidth / spacing) + 1));
}

function buildLoops(parent, radiusScale, count) {
  const rng = mulberry32(0x5eed);
  const shapes = [];
  for (let i = 0; i < LOOP_SHAPES; i++) {
    const radius = LOOP_R * radiusScale * (0.85 + rng() * 0.32);
    shapes.push(loopCurve(rng, radius));
  }

  const loops = [];
  for (let i = 0; i < count; i++) {
    // Alternating flux signs, teal for positive and pink for negative, exactly
    // as `loopColor` assigns them.
    const positive = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0][i] === 1;
    const group = makeLoopMesh(shapes[i % LOOP_SHAPES], positive ? colorPositive : colorNegative);
    const rotZ = rng() * Math.PI * 2;
    group.rotation.set((rng() - 0.5) * 0.5, (rng() - 0.5) * 0.7, rotZ);
    parent.add(group);
    loops.push({
      group,
      rotZ,
      yOffset: (rng() - 0.5) * 1.5 * radiusScale,
      zOffset: (rng() - 0.5) * 0.9,
      spin: (rng() - 0.5) * 0.06,
      driftPhase: rng() * Math.PI * 2,
      driftRate: 0.14 + rng() * 0.12,
      flicker: makeFlicker(rng),
    });
  }
  return loops;
}

function disposeLoops(parent, loops) {
  for (const loop of loops) {
    parent.remove(loop.group);
    for (const mesh of loop.group.children) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

function layoutLoops(loops, radiusScale) {
  const spacing = LOOP_R * radiusScale * 1.32;
  const span = (loops.length - 1) * spacing;
  loops.forEach((loop, i) => {
    loop.group.position.set(-span / 2 + i * spacing, loop.yOffset, LOOP_Z + loop.zOffset);
  });
}

// The six-face reflection cubemap from `makeBoard`, in three's face order
// (+X, -X, +Y, -Y, +Z, -Z), which matches SceneKit's.
function makeReflectionCubemap() {
  const faces = [
    Palette.cyanBright,
    Palette.whitePure,
    Palette.steelLight,
    Palette.cyan,
    Palette.whitePure,
    Palette.pink,
  ];
  const size = 128;
  const images = faces.map((color) => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    return c;
  });
  const tex = new THREE.CubeTexture(images);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

async function loadGemGeometry() {
  const res = await fetch(GEM_MESH_URL);
  const data = await res.json();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  return geo;
}

// The gem material from `makeBoard`: near-black diffuse, metalness 1.0,
// roughness 0.01, reflecting the cubemap, and 10% opaque so the charges inside
// show through.
//
// The near-black albedo is the whole point. For a metal it is also the
// reflectance at normal incidence, so Schlick's Fresnel makes a facet facing
// the camera reflect almost nothing while a facet at a grazing angle reflects
// almost everything. That is what makes the game's gem a black crystal with
// bright rim facets rather than a uniformly lit pebble - measured off a real
// capture, half its body is as dark as the background.
//
// uGain replaces the bloom the game applies afterwards, and is calibrated so a
// grazing facet lands at the same brightness the capture shows.
const GEM_VERTEX_SHADER = `
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const GEM_FRAGMENT_SHADER = `
uniform samplerCube uEnv;
uniform vec3 uF0;
uniform float uGain;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  float cosTheta = clamp(dot(N, V), 0.0, 1.0);
  vec3 F = uF0 + (1.0 - uF0) * pow(1.0 - cosTheta, 5.0);
  vec3 reflected = textureCube(uEnv, reflect(-V, N)).rgb;
  gl_FragColor = vec4(reflected * F * uGain, 1.0);
  #include <colorspace_fragment>
  // Dark facets stay see-through, lit rims read solid - the same reason the
  // glow material derives alpha from its own output.
  gl_FragColor.a = clamp(max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b), 0.0, 1.0);
}
`;

// The material splits into the two things SceneKit combines in one pass: a
// 10%-opaque near-black shell that gives the gem a body against whatever is
// behind it, and the Fresnel-weighted cubemap reflection added on top. In the
// game the gems sit over near-black board; here they cross a lit grid, and
// without the shell a Fresnel-only gem has no silhouette at all.
function makeGemMaterials(envMap) {
  const f0 = new THREE.Color(Palette.voidBlack);
  // Deeper than the game's literal 0.1: its gems sit on a near-black board,
  // while these cross a lit grid that would otherwise read straight through them.
  const shell = new THREE.MeshBasicMaterial({
    color: new THREE.Color(Palette.voidBlack),
    transparent: true,
    opacity: 0.32,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,
  });
  const rim = new THREE.ShaderMaterial({
    uniforms: {
      uEnv: { value: envMap },
      uF0: { value: new THREE.Vector3(f0.r, f0.g, f0.b) },
      uGain: { value: 0.9 },
    },
    vertexShader: GEM_VERTEX_SHADER,
    fragmentShader: GEM_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
  });
  return { shell, rim };
}

// Port of `makeChargeNodes`: n = |charge| additive glowing spheres arranged on
// a circle of 2.5x the sphere radius, teal for positive and pink for negative.
// The wider halo sphere is the bloom the game renders around each charge.
function addChargeNodes(container, charge, geo, haloGeo) {
  const n = Math.abs(charge);
  const color = charge > 0 ? colorPositive : colorNegative;
  // A hot centre grading out through the palette colour, which is how the
  // game's bloomed charge spheres read: white-hot core, coloured rim.
  const coreMat = makeAdditiveGlowMaterial(color, { intensity: 3.4, power: 3.5 });
  const haloMat = makeAdditiveGlowMaterial(color, {
    intensity: 0.18,
    power: 2.2,
    side: THREE.FrontSide,
  });

  for (let i = 0; i < n; i++) {
    const position = new THREE.Vector3();
    if (n > 1) {
      const theta = (2 * Math.PI * i) / n;
      position.set(
        CHARGE_CIRCLE_RADIUS * Math.cos(theta),
        0,
        CHARGE_CIRCLE_RADIUS * Math.sin(theta)
      );
    }

    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(position);
    halo.renderOrder = 1005;
    container.add(halo);

    const core = new THREE.Mesh(geo, coreMat);
    core.position.copy(position);
    core.renderOrder = 1010;
    container.add(core);
  }
}

function buildGems(parent, geometry, materials) {
  const rng = mulberry32(0x6e33);
  const chargeGeo = new THREE.SphereGeometry(CHARGE_RADIUS, 20, 14);
  const haloGeo = new THREE.SphereGeometry(CHARGE_RADIUS * 2.4, 20, 14);
  return GEMS.map((spec) => {
    // Outer node holds the fixed tilt that stands in for the game's elevated
    // camera; the inner container is what precesses.
    const pivot = new THREE.Group();
    pivot.rotation.x = GEM_TILT;
    pivot.scale.setScalar(spec.scale);

    const container = new THREE.Group();
    container.renderOrder = 1010;
    pivot.add(container);

    const hull = new THREE.Group();
    hull.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, 0);
    const shell = new THREE.Mesh(geometry, materials.shell);
    shell.renderOrder = 1000;
    const rim = new THREE.Mesh(geometry, materials.rim);
    rim.renderOrder = 1001;
    hull.add(shell, rim);
    container.add(hull);

    addChargeNodes(container, spec.charge, chargeGeo, haloGeo);

    parent.add(pivot);

    const theta = rng() * Math.PI * 2;
    return {
      ...spec,
      pivot,
      container,
      drift: new THREE.Vector3(Math.cos(theta), 1, Math.sin(theta)),
      driftPeriod: 3.0 + rng() * 1.5,
      driftPhase: rng() * Math.PI * 2,
      precess: 7.0 + rng() * 4.0,
      // Sweep sense follows the charge sign, as the game's `dir` does.
      dir: spec.charge < 0 ? -1 : 1,
      phi0: rng() * Math.PI * 2,
      base: new THREE.Vector3(),
    };
  });
}

// Port of `orientPrecession`: yaw out by phi, tilt, yaw back, so the gem's
// up-axis traces a cone without the body itself spinning.
const PRECESS_X = new THREE.Vector3(1, 0, 0);
const PRECESS_Y = new THREE.Vector3(0, 1, 0);
const qTilt = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const qYawBack = new THREE.Quaternion();

function orientPrecession(node, phi, tilt, tiltScale) {
  qTilt.setFromAxisAngle(PRECESS_X, tilt * tiltScale);
  qYaw.setFromAxisAngle(PRECESS_Y, phi);
  qYawBack.setFromAxisAngle(PRECESS_Y, -phi);
  node.quaternion.copy(qYaw).multiply(qTilt).multiply(qYawBack);
}

function animateGem(gem, t) {
  if (!gem.pivot.visible) return;
  const s = (1 - Math.cos((2 * Math.PI * t) / gem.driftPeriod + gem.driftPhase)) / 2;
  gem.pivot.position.set(
    gem.base.x + gem.drift.x * s,
    gem.base.y + gem.drift.y * s,
    gem.base.z + gem.drift.z * s
  );
  const phi = gem.phi0 + gem.dir * (t / gem.precess) * 2 * Math.PI;
  orientPrecession(gem.container, phi, GEM_TILT_CONE, Math.min(1, t / GEM_LEAD_IN));
}

// Gem size and count follow the visible width: on a phone slice, four gems at
// full size would pile on top of one another.
function layoutGems(gems, camera, worldWidth) {
  const fit = Math.min(1, Math.max(0.55, worldWidth / 14));
  const count = worldWidth >= 12 ? 4 : worldWidth >= 7 ? 3 : 2;
  gems.forEach((gem, i) => {
    gem.pivot.visible = i < count;
    if (i >= count) return;
    gem.pivot.scale.setScalar(gem.scale * fit);
    gem.drift.setLength(GEM_DRIFT_AMP * gem.scale * fit);
    const halfW = visibleWidth(camera, gem.z) / 2;
    gem.base.set(gem.xFrac * halfW, gem.y, gem.z);
    gem.pivot.position.copy(gem.base);
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

  const envMap = makeReflectionCubemap();

  const stage = new THREE.Group();
  scene.add(stage);

  let loopKey = '';
  let loops = [];
  let gems = [];
  let posed = false;

  const resize = () => {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    stage.position.y = w <= STACKED_BREAKPOINT ? STACKED_STAGE_LIFT : 0;

    const loopWidth = visibleWidth(camera, LOOP_Z);
    const scale = loopWidth >= NARROW_WORLD_WIDTH ? 1 : NARROW_LOOP_SCALE;
    const count = loopCount(loopWidth, scale);
    if (`${scale}:${count}` !== loopKey) {
      disposeLoops(stage, loops);
      loops = buildLoops(stage, scale, count);
      loopKey = `${scale}:${count}`;
    }
    layoutLoops(loops, scale);
    layoutGems(gems, camera, visibleWidth(camera, 0));
    posed = false;
  };
  resize();
  new ResizeObserver(resize).observe(banner);

  loadGemGeometry()
    .then((geometry) => {
      gems = buildGems(stage, geometry, makeGemMaterials(envMap));
      layoutGems(gems, camera, visibleWidth(camera, 0));
      posed = false;
    })
    .catch(() => {
      // Loops and grid still carry the banner.
    });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Only run the loop while the banner is on screen, so scrolling past it
  // costs nothing.
  let visible = true;
  new IntersectionObserver(
    ([entry]) => { visible = entry.isIntersecting; },
    { rootMargin: '100px' }
  ).observe(banner);

  const animate = (t, still = false) => {
    for (const loop of loops) {
      loop.group.rotation.z = loop.rotZ + loop.spin * t;
      loop.group.position.y =
        loop.yOffset + 0.12 * Math.sin(t * loop.driftRate + loop.driftPhase);
      const f = still ? 1 : loop.flicker(t);
      for (const mesh of loop.group.children) mesh.material.uniforms.uOpacity.value = f;
    }
    for (const gem of gems) animateGem(gem, t);
  };

  const clock = new THREE.Clock();
  let elapsed = 0;

  const frame = () => {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible) return;

    if (reduceMotion.matches) {
      if (posed) return;
      animate(STILL_TIME, true);
      posed = true;
    } else {
      posed = false;
      elapsed += dt;
      animate(elapsed);
    }
    renderer.render(scene, camera);
  };

  banner.setAttribute('data-vf-ready', '');
  frame();
}
