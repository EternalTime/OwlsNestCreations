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
const TUBE_R = 0.026;
// Intensities are linear-space multipliers on the palette colour, so a value
// above 1 clips to white and anything well below 1 stays a dim coloured haze.
// The halo stays tight and weak: a wide one desaturates the wire into a soft
// pastel stroke instead of the game's thin saturated line.
const GLOW_SHELLS = [
  { scale: 2.6, intensity: 0.3, power: 2.0 },
  { scale: 5.5, intensity: 0.08, power: 3.0 },
];

// The loops are a chain strung right across the banner. Centres sit closer
// together than a loop's own diameter, so every loop overlaps its neighbours
// and the field reads as a tangle of flux rather than a row of beads.
const CHAIN_RADIUS = 1.25;
const CHAIN_SPACING = 1.45;
const CHAIN_SHAPES = 5;
const CHAIN_MIN = 5;
const CHAIN_MAX = 13;
// A phone sees roughly a third of the world width a desktop does, so below this
// reference the loops shrink; at full size a narrow frame would hold two stray
// arcs instead of a chain.
const REF_WIDTH = 14;
const MIN_FIT = 0.4;
// Alternating flux signs, teal for positive and pink for negative, exactly as
// `loopColor` assigns them. Not a strict alternation, so the eye does not read
// a stripe pattern.
const CHAIN_SIGNS = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1];

// One loop is far larger than the rest and runs off both edges. It is mirrored
// left-to-right so its long sweep rises away from the copy rather than into it.
const SPANNING_HALF_WIDTH = 0.57;
const SPANNING_HALF_HEIGHT = 0.42;
const SPANNING = {
  positive: true,
  y: 0.1,
  z: -0.5,
  rot: [0.06, -0.1, 0.03],
  waves: [2, 3],
  speeds: [0.19, -0.13],
  amp: 0.05,
};

// Loops are the furthest thing in the scene and gems the nearest, so every wire
// paints before every gem. Depth testing is off throughout (the glow materials
// need it off), which makes this ordering the only thing establishing depth.
const ORDER = { loop: 10, gemShell: 100, gemRim: 101, chargeHalo: 110, chargeCore: 120 };

// The gem hull mesh has a max radius of 1.202, so these scales put a gem at
// roughly a quarter of the banner's height. Charge geometry keeps the game's
// proportions: sphere radius 0.2 and circle radius 0.5 in container units are
// kChargeRadius and 2.5x it, divided through by kGemScale.
const GEM_MESH_URL = new URL('../data/voidflux-gem.json', import.meta.url);
// A charge is a hot point, not a ball of fog, so the sphere is small and its
// halo hugs it. The ring stays at the game's 2.5x sphere radius.
const CHARGE_RADIUS = 0.11;
const CHARGE_CIRCLE_RADIUS = CHARGE_RADIUS * 2.5;
const CHARGE_HALO_SCALE = 1.9;
const GEM_TILT = -0.95;
// Matches the width at which the banner stylesheet stacks the copy below the
// scene; the whole stage then lifts clear of the copy.
const STACKED_BREAKPOINT = 860;
const STACKED_STAGE_LIFT = 0.55;
const GEMS = [
  { charge: 3, xFrac: -0.10, y: 0.70, z: 0.95, scale: 0.40 },
  { charge: -2, xFrac: 0.26, y: -0.70, z: 0.35, scale: 0.34 },
  { charge: 4, xFrac: 0.55, y: 0.46, z: 1.25, scale: 0.44 },
  { charge: -1, xFrac: 0.74, y: -0.56, z: 0.6, scale: 0.32 },
];

// Idle-float constants from `makeGemIdleFloatAction`. The drift amplitude is
// 0.030 world units against a gem of radius kGemScale * 1.202, so it scales
// with each gem here rather than being copied literally.
const GEM_DRIFT_AMP = 0.03 / (0.15 * 1.202);
// Gem sizing shares `REF_WIDTH` with the loop chain, so the two halves of the
// banner shrink together. Below these visible widths a gem drops out entirely.
const GEM_MIN_FIT = 0.55;
const GEM_FOUR_WIDTH = 12;
const GEM_THREE_WIDTH = 7;
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
// uv.x runs 0..1 along a TubeGeometry, so it is the position along the curve.
// Displacing by it in and out of the loop's own plane makes the curve itself
// ripple and flex, which reads as breathing; translating or spinning the whole
// shape instead just slides a rigid outline across the frame.
//
// The core tube and its halo shells share a curve and this parameterisation, so
// the same field displaces all three and they stay concentric.
const GLOW_VERTEX_SHADER = `
uniform float uTime;
uniform float uAmp;
uniform vec2 uWaves;
uniform vec2 uSpeeds;
uniform vec2 uPhases;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec3 pos = position;
  if (uAmp > 0.0) {
    float t = uv.x;
    float a = sin(6.2831853 * uWaves.x * t + uPhases.x + uTime * uSpeeds.x);
    float b = sin(6.2831853 * uWaves.y * t + uPhases.y + uTime * uSpeeds.y);
    vec3 radial = normalize(vec3(position.xy, 0.0) + vec3(1e-5));
    pos += radial * (uAmp * (a + 0.55 * b));
    pos.z += uAmp * 0.7 * b;
  }
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
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

// The default intensity drives the wire's core past full so it clips to a hot
// centre with the palette colour surviving at its edges, which is how the
// game's loop lines read against the black.
// A thicker tube presents more of its width square-on to the camera, so a
// shallow falloff clips most of it to white and the hue disappears. The steeper
// default keeps the hot core narrow and lets saturated teal and pink survive
// across the rest of the wire.
function makeAdditiveGlowMaterial(color, {
  intensity = 2.3,
  power = 1.2,
  side = THREE.DoubleSide,
  undulation = null,
} = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uAmp: { value: undulation ? undulation.amp : 0 },
      uWaves: { value: new THREE.Vector2(...(undulation ? undulation.waves : [0, 0])) },
      uSpeeds: { value: new THREE.Vector2(...(undulation ? undulation.speeds : [0, 0])) },
      uPhases: { value: new THREE.Vector2(...(undulation ? undulation.phases : [0, 0])) },
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
function loopCurve(rng, radius, squash, mirrored = false) {
  const n = 13;
  const k1 = 2 + Math.floor(rng() * 2);
  const k2 = 3 + Math.floor(rng() * 2);
  const a1 = 0.07 + rng() * 0.1;
  const a2 = 0.03 + rng() * 0.05;
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const az = 0.12 + rng() * 0.22;
  const pz = rng() * Math.PI * 2;

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
  // Mirroring across the vertical axis reverses the traversal as well as x, so
  // the swept tube keeps its winding and its faces stay front-facing.
  if (mirrored) {
    pts.reverse();
    for (const p of pts) p.x = -p.x;
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

// The tube geometry is baked from the curve, so a handful of shapes are built
// once and shared by every instance that uses them. The undulation lives in the
// vertex shader and is driven by per-instance uniforms, which is what lets one
// geometry serve loops that are all flexing out of step with each other.
function makeLoopShape(curve, radius) {
  return {
    radius,
    shells: GLOW_SHELLS.map((shell) =>
      new THREE.TubeGeometry(curve, 160, TUBE_R * shell.scale, 8, true)),
    core: new THREE.TubeGeometry(curve, 220, TUBE_R, 8, true),
  };
}

function makeLoopMesh(shape, color, undulation) {
  const group = new THREE.Group();
  shape.shells.forEach((geo, i) => {
    const mesh = new THREE.Mesh(geo, makeAdditiveGlowMaterial(color, {
      intensity: GLOW_SHELLS[i].intensity,
      power: GLOW_SHELLS[i].power,
      side: THREE.FrontSide,
      undulation,
    }));
    mesh.renderOrder = ORDER.loop;
    group.add(mesh);
  });
  const core = new THREE.Mesh(shape.core, makeAdditiveGlowMaterial(color, { undulation }));
  core.renderOrder = ORDER.loop;
  group.add(core);
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

// How the chain sizes itself to the visible frame. Quantised, because a change
// here rebakes every tube geometry and a drag-resize must not churn through it.
function loopPlan(worldWidth, worldHeight) {
  const fit = Math.min(1, Math.max(MIN_FIT, worldWidth / REF_WIDTH));
  const radius = Math.round(CHAIN_RADIUS * fit * 20) / 20;
  const spacing = radius * CHAIN_SPACING;
  const count = Math.min(CHAIN_MAX, Math.max(CHAIN_MIN, Math.ceil(worldWidth / spacing) + 2));
  // The spanning loop's size is baked into its curve rather than applied as a
  // scale, because a non-uniform scale would stretch the swept tube itself and
  // the wire has to keep one weight all the way round.
  const spanRadius = Math.round(worldWidth * SPANNING_HALF_WIDTH * 4) / 4;
  const spanSquash =
    Math.min(spanRadius * 0.45, worldHeight * SPANNING_HALF_HEIGHT) / spanRadius;
  return {
    radius,
    spacing,
    count,
    spanRadius,
    spanSquash: Math.round(spanSquash * 50) / 50,
    key: `${radius}/${count}/${spanRadius}/${Math.round(spanSquash * 50)}`,
  };
}

function buildLoops(parent, plan) {
  const rng = mulberry32(0x5eed);

  const shapes = [];
  for (let i = 0; i < CHAIN_SHAPES; i++) {
    const radius = plan.radius * (0.78 + rng() * 0.55);
    shapes.push(makeLoopShape(loopCurve(rng, radius, 0.85 + rng() * 0.3), radius));
  }

  const instances = [];
  const add = (shape, positive, undulation, rot, place) => {
    const group = makeLoopMesh(shape, positive ? colorPositive : colorNegative, undulation);
    group.rotation.set(...rot);
    parent.add(group);
    instances.push({ group, place, flicker: makeFlicker(rng) });
  };

  for (let i = 0; i < plan.count; i++) {
    const shape = shapes[i % CHAIN_SHAPES];
    const yFrac = (rng() - 0.5) * 1.1;
    const z = (rng() - 0.5) * 1.1;
    const x = i - (plan.count - 1) / 2;
    add(
      shape,
      CHAIN_SIGNS[i % CHAIN_SIGNS.length] === 1,
      {
        // Amplitude is a fraction of the loop's own radius, so every loop flexes
        // by the same visual proportion whatever its size.
        amp: shape.radius * (0.09 + rng() * 0.09),
        waves: [2 + Math.floor(rng() * 3), 4 + Math.floor(rng() * 3)],
        speeds: [0.16 + rng() * 0.2, -(0.12 + rng() * 0.18)],
        phases: [rng() * Math.PI * 2, rng() * Math.PI * 2],
      },
      [(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.7, rng() * Math.PI * 2],
      (group, worldWidth, worldHeight) => {
        group.position.set(x * plan.spacing, yFrac * worldHeight, LOOP_Z + z);
      }
    );
  }

  const spanShape = makeLoopShape(
    loopCurve(rng, plan.spanRadius, plan.spanSquash, true),
    plan.spanRadius
  );
  add(
    spanShape,
    SPANNING.positive,
    {
      amp: plan.spanRadius * SPANNING.amp,
      waves: SPANNING.waves,
      speeds: SPANNING.speeds,
      phases: [rng() * Math.PI * 2, rng() * Math.PI * 2],
    },
    SPANNING.rot,
    (group) => group.position.set(0, SPANNING.y, LOOP_Z + SPANNING.z)
  );

  return { instances, shapes: [...shapes, spanShape] };
}

function disposeLoops(parent, field) {
  for (const loop of field.instances) {
    parent.remove(loop.group);
    for (const mesh of loop.group.children) mesh.material.dispose();
  }
  for (const shape of field.shapes) {
    shape.core.dispose();
    for (const geo of shape.shells) geo.dispose();
  }
}

function layoutLoops(field, worldWidth, worldHeight) {
  for (const loop of field.instances) loop.place(loop.group, worldWidth, worldHeight);
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

// A grazing facet reflects back along the view direction, so which cubemap face
// lights up the rim depends entirely on where the camera sits. The game's is at
// (4,4,0), which puts steelLight and cyanBright on its gems' rims; a camera down
// the z axis would instead sample the pink face for every rim on screen. This
// rotates the lookup into the game's camera frame so the rims come out the
// colours the game actually shows.
function gameEnvRotation() {
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(4, 4, 0).normalize()
  );
  return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
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
uniform mat3 uEnvRotation;
uniform vec3 uF0;
uniform float uGain;
uniform float uSheen;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  float cosTheta = clamp(dot(N, V), 0.0, 1.0);
  // Schlick, so only grazing facets blaze. uSheen is SceneKit's reflective
  // term, flat on top, which tints the gem's inward-facing facets a faint
  // steel-cyan instead of leaving them dead black.
  vec3 F = uF0 + (1.0 - uF0) * pow(1.0 - cosTheta, 5.0) + uSheen;
  vec3 reflected = textureCube(uEnv, uEnvRotation * reflect(-V, N)).rgb;
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
  // A gem is a polished near-black stone, not a window. It occludes what is
  // behind it and you read its shape from the specular edges, not through it.
  const shell = new THREE.MeshBasicMaterial({
    color: new THREE.Color(Palette.voidBlack),
    transparent: true,
    opacity: 0.94,
    side: THREE.FrontSide,
    depthWrite: false,
    depthTest: false,
  });
  const rim = new THREE.ShaderMaterial({
    uniforms: {
      uEnv: { value: envMap },
      uEnvRotation: { value: gameEnvRotation() },
      uF0: { value: new THREE.Vector3(f0.r, f0.g, f0.b) },
      uGain: { value: 1.05 },
      uSheen: { value: 0.05 },
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
  // A steep falloff off a very high peak: the centre clips every channel to
  // near-white and drops back through the palette colour within a fraction of
  // the radius, which is the game's hot point rather than a soft orb.
  const coreMat = makeAdditiveGlowMaterial(color, { intensity: 12, power: 6 });
  const haloMat = makeAdditiveGlowMaterial(color, {
    intensity: 0.5,
    power: 3,
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
    halo.renderOrder = ORDER.chargeHalo;
    container.add(halo);

    const core = new THREE.Mesh(geo, coreMat);
    core.position.copy(position);
    core.renderOrder = ORDER.chargeCore;
    container.add(core);
  }
}

function buildGems(parent, geometry, materials) {
  const rng = mulberry32(0x6e33);
  const chargeGeo = new THREE.SphereGeometry(CHARGE_RADIUS, 20, 14);
  const haloGeo = new THREE.SphereGeometry(CHARGE_RADIUS * CHARGE_HALO_SCALE, 20, 14);
  return GEMS.map((spec) => {
    // Outer node holds the fixed tilt that stands in for the game's elevated
    // camera; the inner container is what precesses.
    const pivot = new THREE.Group();
    pivot.rotation.x = GEM_TILT;
    pivot.scale.setScalar(spec.scale);

    // No group on the gem path carries a renderOrder: three.js takes a group's
    // renderOrder as the sort key for everything under it, so a nested group
    // would reset its meshes' ordering and drop the gem behind the loops.
    const container = new THREE.Group();
    pivot.add(container);

    const hull = new THREE.Group();
    hull.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, 0);
    const shell = new THREE.Mesh(geometry, materials.shell);
    shell.renderOrder = ORDER.gemShell;
    const rim = new THREE.Mesh(geometry, materials.rim);
    rim.renderOrder = ORDER.gemRim;
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
  const fit = Math.min(1, Math.max(GEM_MIN_FIT, worldWidth / REF_WIDTH));
  const count = worldWidth >= GEM_FOUR_WIDTH ? 4 : worldWidth >= GEM_THREE_WIDTH ? 3 : 2;
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
  let loopField = { instances: [], shapes: [] };
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
    const loopHeight = loopWidth / camera.aspect;
    const plan = loopPlan(loopWidth, loopHeight);
    if (plan.key !== loopKey) {
      disposeLoops(stage, loopField);
      loopField = buildLoops(stage, plan);
      loopKey = plan.key;
    }
    layoutLoops(loopField, loopWidth, loopHeight);
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
    for (const loop of loopField.instances) {
      const f = still ? 1 : loop.flicker(t);
      for (const mesh of loop.group.children) {
        mesh.material.uniforms.uOpacity.value = f;
        mesh.material.uniforms.uTime.value = t;
      }
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
