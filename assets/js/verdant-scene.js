// The WebGL half of the Verdant Engine banner: the island in the sky, rock
// under it and treetops on it, with the cloud banks drifting past - over the
// backdrop verdant-banner.js has already painted.
//
// Every construction here is the game's own, ported from the render code:
// the rock is IslandRockNode's strata - beds stepped in to a keel, each bed
// toned with a per-facet wobble (the `dealt` hash is copied digit for digit) -
// the treetops are TreeStand's leaf ramp, and a cloud is CloudBank's puff:
// a low-segment geodesic sphere squashed (1.35, 0.62, 1.0), lambert-lit in
// Palette.cloud with a dimmed emission so its underside stays cloud rather
// than going grey. The drift is CloudDrift's arithmetic at cluster level:
// each mass walks a slow seeded orbit and breathes.
//
// three.js is the site's vendored copy, shared with the VoidFlux banner.

import * as THREE from './lib/three.module.min.js';
import { Palette } from './verdant-palette.js';

const MAX_DPR = 1.75;

// The camera frames REF_HEIGHT world units vertically whatever the banner's
// aspect - the VoidFlux banner's convention, kept so world sizes are stable
// across viewports and only the visible width changes.
const FOV = 40;
const REF_HEIGHT = 6;
const CAM_Z = REF_HEIGHT / 2 / Math.tan((FOV / 2) * (Math.PI / 180));

// The camera is level, so its eye line - world y = 0 - is the true horizon
// of the ground plane far below. The painted horizon in verdant-banner.js
// (HORIZON = 0.6) is put in the same place by stretching the projection:
// the camera renders a frame VIEW_STRETCH taller and the banner shows its
// top, which drops eye level to 0.6 of the visible height.
const HORIZON_Y = 0;
const VIEW_STRETCH = 1.2;

// ---- The island ----

const ISLAND = {
  x: 0.85,
  shoulderY: 1.14,
  radius: 1.6,
  // IslandRock: nine courses, the first 0.55 deep and each 1.28 times the
  // one above, drawing in to a keel. Scaled to scene units.
  courses: 9,
  firstCourse: 0.55,
  courseGrowth: 1.28,
  keelDrop: 2.0,
  keelHalf: 0.5,
  drawInPower: 1.6,
  // How far each course's tread steps in before its face falls, as a share
  // of the drawing-in that course does: the beds read as beds because the
  // rim of each is a ledge, not a slope.
  tread: 0.55,
  columns: 72,
  bobAmp: 0.07,
  bobRate: 0.5,
};

// IslandRockNode.dealt, exactly.
function dealt(index) {
  const hashed = Math.sin(index * 12.9898) * 43758.5453;
  return hashed - Math.floor(hashed);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colour(hex) {
  return new THREE.Color(hex);
}

const bedrockPale = colour(Palette.bedrockPale);
const bedrockMid = colour(Palette.bedrockMid);
const bedrockDeep = colour(Palette.bedrockDeep);
const soilDark = colour(Palette.soilDark);
const leafSun = colour(Palette.leafSun);
const leafMid = colour(Palette.leafMid);
const leafDeep = colour(Palette.leafDeep);
const leafShadow = colour(Palette.leafShadow);

function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// The island's outline in plan: a seeded wander on a circle, low harmonics
// only, so the rim reads as ground and never as a gear.
function rimRadius(theta) {
  return (
    ISLAND.radius *
    (1 +
      0.12 * Math.sin(3 * theta + 1.7) +
      0.06 * Math.sin(7 * theta + 4.1) +
      0.035 * Math.sin(11 * theta + 2.3) +
      0.022 * Math.sin(17 * theta + 0.9))
  );
}

// Course depths, IslandRock's own progression normalised to the keel drop.
function courseDepths() {
  const raw = [];
  let d = ISLAND.firstCourse;
  for (let i = 0; i < ISLAND.courses; i++) {
    raw.push(d);
    d *= ISLAND.courseGrowth;
  }
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (v * ISLAND.keelDrop) / total);
}

// Where a rim column lands when it has drawn all the way in: on the keel, a
// short medial ridge rather than a point, as the game's stadium keel is.
function keelPoint(theta) {
  const c = Math.cos(theta);
  const x = Math.sign(c) * Math.min(Math.abs(c) * ISLAND.radius, ISLAND.keelHalf);
  return { x, z: 0 };
}

function buildRock() {
  const depths = courseDepths();
  const N = ISLAND.columns;
  const total = ISLAND.keelDrop;

  // A ring of the outline drawn in by fraction f, at height y, with the bed's
  // seeded wander in height - IslandRock's bedWander at our scale.
  const ringAt = (f, y, level) => {
    const ring = [];
    for (let j = 0; j < N; j++) {
      const theta = (j / N) * Math.PI * 2;
      const r = rimRadius(theta);
      const keel = keelPoint(theta);
      const x = (1 - f) * (r * Math.cos(theta)) + f * keel.x;
      const z = (1 - f) * (r * Math.sin(theta)) + f * keel.z;
      const wander = level === 0 ? 0 : (dealt(j * 13 + level * 71) - 0.5) * 0.15 * (0.4 + f);
      ring.push({ x, y: y + wander, z });
    }
    return ring;
  };

  // Each course is a tread and a face: the ledge that steps in at the top of
  // the bed, then the drop to the next bed's rim. That step is what makes
  // nine courses read as strata rather than as a slope.
  const insetAt = (walked) => Math.pow(walked / total, ISLAND.drawInPower);

  // Crag: the columns disagree a little about how far in their bed has
  // drawn, so the silhouette is a rock and not a lathe. Applied to a ring
  // once, and every band reads the same ring, so the beds stay watertight -
  // a bed cragged twice is a seam of bright slivers.
  const cragged = (ring, salt) => {
    for (let j = 0; j < ring.length; j++) {
      const crag = (dealt(j * 29 + salt * 113) - 0.5) * 0.22;
      const p = ring[j];
      const len = Math.hypot(p.x, p.z) || 1;
      p.x += (p.x / len) * crag;
      p.z += (p.z / len) * crag;
    }
    return ring;
  };

  // Ring stack: each course's floor ring is the next course's rim, shared by
  // reference so the mass has no seams.
  const outers = [];
  const inners = [];
  {
    let walkedTo = 0;
    for (let level = 0; level < ISLAND.courses; level++) {
      const below = walkedTo + depths[level];
      const fTop = insetAt(walkedTo);
      const fNext = insetAt(below);
      const fTread = fTop + ISLAND.tread * (fNext - fTop);
      outers.push(level === 0 ? ringAt(fTop, -walkedTo, level) : outers[level]);
      if (outers.length === level) outers.push(ringAt(fTop, -walkedTo, level));
      inners.push(cragged(ringAt(fTread, -walkedTo - depths[level] * 0.12, level), level * 2 + 1));
      outers[level + 1] = cragged(ringAt(fNext, -below, level + 1), level * 2 + 2);
      walkedTo = below;
    }
  }
  const bands = [];
  for (let level = 0; level < ISLAND.courses; level++) {
    bands.push({ level, outer: outers[level], inner: inners[level], lower: outers[level + 1] });
  }

  const positions = [];
  const colors = [];
  const pushTri = (a, b, c, col) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) colors.push(col.r, col.g, col.b);
  };

  const facetColour = (level, columnJ, midY, isTread) => {
    // IslandRockNode.tone: the bed's own tone with a per-facet wobble, the
    // tread hashed apart from the face as the game hashes it.
    const bed = dealt(level * 977 + 31);
    const wobble = dealt(columnJ * 61 + level * 17 + (isTread ? 5 : 0));
    const tone = Math.min(Math.max(bed * 0.85 + wobble * 0.15, 0), 1);
    const col = bedrockMid.clone().lerp(bedrockPale, tone);
    // Darkening as the mass falls away from the light, so the keel goes
    // toward black - the "land hanging in the air" read of the rock shader.
    const drop = -midY / ISLAND.keelDrop;
    col.lerp(bedrockDeep, 0.55 * smoothstep(0.3, 1.0, drop));
    // The first course is the crust of earth the garden grows in.
    if (level === 0 && !isTread) col.copy(soilDark).lerp(bedrockMid, 0.2 * wobble);
    return col;
  };

  for (const band of bands) {
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      // Tread: outer rim to the stepped-in ring.
      let a = band.outer[j], b = band.outer[k], c = band.inner[k], d = band.inner[j];
      let col = facetColour(band.level, j, (a.y + c.y) / 2, true);
      pushTri(a, b, c, col);
      pushTri(a, c, d, facetColour(band.level, j + N, (a.y + c.y) / 2, true));
      // Face: stepped-in ring down to the next bed's rim.
      a = band.inner[j]; b = band.inner[k]; c = band.lower[k]; d = band.lower[j];
      col = facetColour(band.level, j, (a.y + c.y) / 2, false);
      pushTri(a, b, c, col);
      pushTri(a, c, d, facetColour(band.level, j + N, (a.y + c.y) / 2, false));
    }
  }

  // Close the keel: the last rim fans onto the medial line.
  const last = bands[bands.length - 1].lower;
  const keelY = -ISLAND.keelDrop;
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    const mid = { x: (last[j].x + last[k].x) / 2 * 0.4, y: keelY - 0.05, z: 0 };
    pushTri(last[j], last[k], mid, facetColour(ISLAND.courses - 1, j, keelY, false));
  }
  const rings = [bands[0].outer];

  // A lid just under the canopy, so no camera angle sees down into the shell.
  const lid = { x: 0, y: 0.02, z: 0 };
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    const col = soilDark.clone().lerp(leafShadow, 0.5);
    pushTri({ ...rings[0][k], y: 0.02 }, { ...rings[0][j], y: 0.02 }, lid, col);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

// Where the gardener stands: on the rim's edge, on the side the camera and
// the copy both face, with the drop under her toes. The treetops keep clear
// of the spot so she reads against sky and cloud.
const GARDENER_THETA = 0.15;
function gardenerSpot() {
  const r = rimRadius(GARDENER_THETA);
  return { x: Math.cos(GARDENER_THETA) * r, z: Math.sin(GARDENER_THETA) * r };
}

// Distance from a point to her walk - the short stretch around where she
// peeks from the treeline. The wood grows back over the rim beyond it.
function distanceToWalk(x, z, spot) {
  const ax = spot.x * 0.55, az = spot.z * 0.55;
  const bx = spot.x * 0.78, bz = spot.z * 0.78;
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / len2, 0), 1);
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

// ---- The treetops ----

// TreeStand's crown masses, ported exactly: a mass is an icosahedron
// (subdivided once - three's detail-1 solid) whose vertices ride the game's
// smooth three-sine lump, so every mass is a closed surface and the wood
// cannot tear open. The colour is the leaf shader read as vertex colours:
// the shadow-deep-mid-sun ramp up the crown, then the two-lattice clump
// mottle so no facet is a flat swatch.

const CANOPY_Y_MIN = -0.2;
const CANOPY_Y_MAX = 1.15;

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

// fract(sin(dot(cell, k)) * m), the shader's own cell hash.
function cellHash(cx, cy, kx, ky, m) {
  const v = Math.sin(cx * kx + cy * ky) * m;
  return v - Math.floor(v);
}

// The leaf modifier's grain: two rotated lattices of clumps and a fine
// dust, in the mass's own metres.
function leafGrain(x, y, z) {
  const m0 = x + 0.6 * z;
  const m1 = y * 3.2;
  const clump = cellHash(
    Math.floor((m0 * 0.94 - m1 * 0.34) * 5.5),
    Math.floor((m0 * 0.34 + m1 * 0.94) * 5.5),
    12.9898, 78.233, 43758.5453);
  const fleck = cellHash(
    Math.floor((m0 * 0.42 + m1 * 0.91) * 13.0),
    Math.floor((m1 * 0.42 - m0 * 0.91) * 13.0),
    39.3468, 11.135, 24634.6345);
  const dust = cellHash(
    Math.floor(m0 * 31.0 + 2.7),
    Math.floor(m1 * 31.0 + 2.7),
    21.7, 93.41, 15731.743);
  return clump * 0.5 + fleck * 0.32 + dust * 0.18;
}

// The leaf modifier's tone: shadow at the underside, deep, mid, sun at the
// top, the brighter clumps stepping up a tone as well as brightening.
function leafColour(y, grain) {
  const rise = clamp01((y - CANOPY_Y_MIN) / (CANOPY_Y_MAX - CANOPY_Y_MIN));
  const col = leafShadow.clone().lerp(leafDeep, clamp01(rise * 2.6));
  col.lerp(leafMid, clamp01((rise - 0.3) * 2.4));
  col.lerp(leafSun, clamp01((rise - 0.68) * 3.0));
  const stepped = col.clone().lerp(leafMid, 0.55);
  col.lerp(stepped, clamp01((grain - 0.45) * 2.2));
  col.multiplyScalar(0.68 + 0.5 * grain);
  return col;
}

function buildCanopy() {
  const rand = mulberry32(0x9e551);
  const positions = [];
  const colors = [];
  const pushVertex = (x, y, z) => {
    positions.push(x, y, z);
    const col = leafColour(y, leafGrain(x, y, z));
    colors.push(col.r, col.g, col.b);
  };

  // The lay of the wood: broad masses over a mound, the outer ring leaning
  // past the rim, a second planting packed over the summit, and the
  // gardener's corridor kept clear.
  const masses = [];
  const spot = gardenerSpot();
  for (let i = 0; i < 700 && masses.length < 64; i++) {
    const t = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * ISLAND.radius * 0.98;
    const x = Math.cos(t) * d;
    const z = Math.sin(t) * d;
    const r = 0.4 + rand() * 0.28;
    if (distanceToWalk(x, z, spot) < 0.3 + r * 1.35) continue;
    if (masses.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (0.3 * (c.r + r)) ** 2)) continue;
    const mound = 1 - (d / (ISLAND.radius * 1.1)) ** 2;
    masses.push({ x, z, r, y: -0.08 + mound * 0.62 + r * 0.4, seed: 7 + i });
  }
  for (let i = 0; i < 260 && masses.length < 84; i++) {
    const t = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * ISLAND.radius * 0.55;
    const x = Math.cos(t) * d;
    const z = Math.sin(t) * d;
    const r = 0.32 + rand() * 0.22;
    if (masses.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (0.22 * (c.r + r)) ** 2)) continue;
    const mound = 1 - (d / (ISLAND.radius * 1.1)) ** 2;
    masses.push({ x, z, r, y: 0.1 + mound * 0.62 + r * 0.4, seed: 900 + i });
  }

  // The dome of deep wood under the masses, so whatever shows between two
  // of them is leaf and never sky. Coloured by the same ramp, low in it.
  {
    const M = 44;
    const K = 5;
    const spreads = [1.28, 1.08, 0.8, 0.52, 0.27, 0];
    const heights = [-0.14, 0.2, 0.42, 0.6, 0.74, 0.84];
    const dip = (theta, depth) => {
      let away = Math.abs(theta - GARDENER_THETA) % (Math.PI * 2);
      if (away > Math.PI) away = Math.PI * 2 - away;
      return depth * Math.exp(-(away * away) / (2 * 0.22 * 0.22));
    };
    const ringPoint = (j, k) => {
      const theta = (j / M) * Math.PI * 2;
      const jag = 1 + (dealt(j * 37 + k * 101) - 0.5) * 0.12;
      const r = rimRadius(theta) * spreads[k] * jag;
      const notch = k === 1 ? dip(theta, 0.3) : k === 0 ? dip(theta, 0.1) : 0;
      return { x: Math.cos(theta) * r, y: heights[k] - notch, z: Math.sin(theta) * r };
    };
    const pushDome = (a, b, c) => {
      // The dome sits inside the wood: held low in the ramp so it reads as
      // shade between crowns, its own grain still on it.
      for (const p of [a, b, c]) {
        positions.push(p.x, p.y, p.z);
        const col = leafColour(Math.min(p.y, 0.32), leafGrain(p.x, p.y, p.z) * 0.7);
        colors.push(col.r, col.g, col.b);
      }
    };
    for (let k = 0; k < K; k++) {
      for (let j = 0; j < M; j++) {
        const jn = (j + 1) % M;
        const a = ringPoint(j, k);
        const b = ringPoint(jn, k);
        const c = ringPoint(jn, k + 1);
        const d = ringPoint(j, k + 1);
        pushDome(a, b, c);
        pushDome(a, c, d);
      }
    }
  }

  // The masses themselves: addBlob, digit for digit. The lump is a product
  // of three sines of the direction, phased per mass, +-26% - a smooth
  // closed displacement, which is why the game's crowns have no cracks.
  const proto = new THREE.IcosahedronGeometry(1, 1);
  const protoPos = proto.getAttribute('position');
  const protoIndex = proto.getIndex();
  const vertex = new THREE.Vector3();
  for (const mass of masses) {
    const deal = mulberry32(mass.seed);
    const phase = [deal() * 6.28, deal() * 6.28, deal() * 6.28];
    const squash = 0.62 + deal() * 0.3;
    const placed = [];
    for (let v = 0; v < protoPos.count; v++) {
      vertex.fromBufferAttribute(protoPos, v).normalize();
      const lump = 1 + 0.26
        * Math.sin(vertex.x * 4.3 + phase[0])
        * Math.sin(vertex.y * 3.1 + phase[1])
        * Math.sin(vertex.z * 2.6 + phase[2]);
      placed.push([
        mass.x + vertex.x * mass.r * lump,
        mass.y + vertex.y * mass.r * squash * lump,
        mass.z + vertex.z * mass.r * lump,
      ]);
    }
    const faces = protoIndex ? protoIndex.count / 3 : protoPos.count / 3;
    const at = (f, k) => (protoIndex ? protoIndex.getX(f * 3 + k) : f * 3 + k);
    for (let f = 0; f < faces; f++) {
      for (let k = 0; k < 3; k++) {
        const p = placed[at(f, k)];
        pushVertex(p[0], p[1], p[2]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Double-sided: a hairline between two masses shows the dark back of the
  // wood behind it, never a clean line of sky.
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

// ---- The gardener ----

// A mockup of the suit at the scale the banner sees it: a handful of faceted
// primitives in the suit's own metals - treads, a copper boiler body, brass
// banding, the slate dome with its ear tufts, a chimney off the shoulder.
// Tiny by design: she is the measure of how big the island is.
function buildGardener() {
  const group = new THREE.Group();
  const make = (geometry, hex) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: colour(hex), flatShading: true })
    );
    group.add(mesh);
    return mesh;
  };

  const treads = make(new THREE.BoxGeometry(0.52, 0.14, 0.34), Palette.iron);
  treads.position.y = 0.07;
  const body = make(new THREE.CylinderGeometry(0.26, 0.31, 0.42, 9), Palette.copper);
  body.position.y = 0.36;
  const belt = make(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 9), Palette.brass);
  belt.position.y = 0.5;
  const collar = make(new THREE.CylinderGeometry(0.28, 0.33, 0.12, 9), Palette.hardwood);
  collar.position.y = 0.6;
  const dome = make(new THREE.SphereGeometry(0.23, 8, 6), Palette.iron);
  dome.position.y = 0.74;
  dome.scale.y = 0.82;
  const finial = make(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6), Palette.brassBright);
  finial.position.y = 0.95;
  for (const side of [-1, 1]) {
    const ear = make(new THREE.ConeGeometry(0.06, 0.16, 5), Palette.brass);
    ear.position.set(side * 0.21, 0.86, 0);
    ear.rotation.z = -side * 0.5;
    const arm = make(new THREE.BoxGeometry(0.1, 0.26, 0.1), Palette.ironLight);
    arm.position.set(side * 0.38, 0.4, 0);
  }
  const chimney = make(new THREE.CylinderGeometry(0.05, 0.065, 0.3, 6), Palette.copperDark);
  chimney.position.set(-0.24, 0.7, -0.12);
  chimney.rotation.z = 0.18;

  group.scale.setScalar(0.4);
  return group;
}

// Her routine: parked in the wood, then out along her corridor to the rim,
// a long look over the drop, and back into the trees. The banner is serene,
// so the loop idles far longer than it moves.
// She only peeks: parked she is deep enough in the wood to be hidden
// outright, and at her furthest she is just clear of the treeline, never
// out on the bare rim.
const ROUTINE = { kIn: 0.7, kOut: 1.14, period: 16, out: 7, outDone: 9, back: 13, backDone: 15 };

function gardenerPose(t) {
  const p = ((t % ROUTINE.period) + ROUTINE.period) % ROUTINE.period;
  const ease = (a, b) => smoothstep(0, 1, (p - a) / (b - a));
  let k = ROUTINE.kIn;
  let walking = false;
  let returning = false;
  if (p >= ROUTINE.out && p < ROUTINE.outDone) {
    k = ROUTINE.kIn + (ROUTINE.kOut - ROUTINE.kIn) * ease(ROUTINE.out, ROUTINE.outDone);
    walking = true;
  } else if (p >= ROUTINE.outDone && p < ROUTINE.back) {
    k = ROUTINE.kOut;
  } else if (p >= ROUTINE.back && p < ROUTINE.backDone) {
    k = ROUTINE.kOut - (ROUTINE.kOut - ROUTINE.kIn) * ease(ROUTINE.back, ROUTINE.backDone);
    walking = true;
    returning = true;
  }
  return { k, walking, returning };
}

// ---- The engine's stacks ----

// The Verdant Engine itself is down in the wood; what the banner shows is
// its two chimneys standing out of the canopy at the island's crown, one
// taller than the other, in the suit's own metals.
function buildStacks() {
  const group = new THREE.Group();
  const make = (geometry, hex) => {
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: colour(hex), flatShading: true })
    );
    group.add(mesh);
    return mesh;
  };
  const tops = [];
  const stacks = [
    { x: -0.16, z: 0.06, base: 0.4, height: 1.15, r: 0.075 },
    { x: 0.34, z: 0.16, base: 0.4, height: 0.95, r: 0.062 },
  ];
  for (const stack of stacks) {
    const body = make(new THREE.CylinderGeometry(stack.r * 0.82, stack.r, stack.height, 8), Palette.iron);
    body.position.set(stack.x, stack.base + stack.height / 2, stack.z);
    const collar = make(new THREE.CylinderGeometry(stack.r * 0.95, stack.r * 0.85, 0.07, 8), Palette.brass);
    collar.position.set(stack.x, stack.base + stack.height - 0.1, stack.z);
    const cap = make(new THREE.CylinderGeometry(stack.r * 1.25, stack.r * 0.8, 0.09, 8), Palette.copperDark);
    cap.position.set(stack.x, stack.base + stack.height + 0.02, stack.z);
    tops.push({ x: stack.x, y: stack.base + stack.height + 0.08, z: stack.z });
  }
  group.userData.tops = tops;
  return group;
}

// The smoke: a small pool of puffs per stack, each climbing from the cap,
// swelling, leaning off with the wind and fading to nothing - then dealt
// back to the cap to go again. Materials are per puff because opacity is
// the whole of the animation.
function buildSmoke(tops) {
  const group = new THREE.Group();
  const proto = new THREE.IcosahedronGeometry(1, 1);
  const puffs = [];
  tops.forEach((top, which) => {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshLambertMaterial({
        color: colour('#ddd6c6'),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(proto, material);
      group.add(mesh);
      puffs.push({ mesh, material, top, phase: i / count, period: 4.6 + which * 0.9, which });
    }
  });
  const update = (t) => {
    for (const puff of puffs) {
      const a = ((t / puff.period + puff.phase) % 1 + 1) % 1;
      const rise = 0.85 + puff.which * 0.1;
      const sway = 0.06 * Math.sin(t * 0.7 + puff.phase * 12.6);
      puff.mesh.position.set(
        puff.top.x + sway + a * 0.22,
        puff.top.y + a * rise,
        puff.top.z
      );
      const size = 0.055 + a * 0.17;
      puff.mesh.scale.set(size * 1.15, size * 0.9, size);
      puff.material.opacity = 0.7 * Math.min(1, a * 7) * (1 - a) * (1 - a * 0.25);
    }
  };
  return { group, update };
}

// ---- The clouds ----


// CloudBank's puff, at cluster level: each mass is squashed geodesic spheres
// packed in a flat ellipsoid, and the whole mass walks CloudDrift's slow
// orbit and breathes. Front masses cross the island; back masses stand off
// behind it; the farthest bank lies on the horizon and is mostly air.
const CLUSTERS = [
  // Behind the island.
  { x: -3.4, y: 1.11, z: -4.2, span: 2.3, puffs: 45, seed: 11 },
  { x: 3.5, y: 1.91, z: -5.0, span: 2.7, puffs: 51, seed: 23 },
  { x: 0.6, y: -0.24, z: -2.9, span: 2.0, puffs: 33, seed: 37 },
  { x: 0.2, y: 2.86, z: -5.5, span: 2.4, puffs: 36, seed: 71 },
  { x: -4.8, y: 1.96, z: -6.0, span: 2.2, puffs: 36, seed: 83 },
  { x: 1.5, y: 2.26, z: -3.4, span: 1.7, puffs: 27, seed: 109 },
  { x: 4.5, y: -0.34, z: -1.5, span: 1.9, puffs: 30, seed: 97 },
  // The right wing of the sky.
  { x: 6.6, y: 1.6, z: -4.2, span: 2.2, puffs: 36, seed: 131 },
  { x: 7.6, y: 0.35, z: -6.2, span: 2.6, puffs: 39, seed: 137 },
  { x: 5.9, y: -1.0, z: 1.1, span: 1.7, puffs: 27, seed: 139 },
  // The far bank on the horizon.
  { x: -0.8, y: HORIZON_Y - 0.15, z: -6.5, span: 9.0, puffs: 72, seed: 41, flat: true },
  // In front, lower, crossing the keel.
  { x: -1.8, y: -0.34, z: 1.7, span: 1.7, puffs: 27, seed: 53 },
  { x: 2.6, y: 0.01, z: 2.2, span: 1.5, puffs: 24, seed: 67 },
  { x: -3.7, y: -0.74, z: 0.9, span: 1.6, puffs: 24, seed: 103 },
];

// CloudDrift's ranges, scaled to scene units.
const DRIFT = { orbit: [0.18, 0.35], turn: [0.045, 0.095], breathRate: [0.05, 0.12], breathHeight: 0.06 };

function buildClouds() {
  const material = new THREE.MeshLambertMaterial({ color: colour(Palette.cloud) });
  material.emissive = colour(Palette.cloud).multiplyScalar(Palette.cloudEmissionDim);
  const proto = new THREE.IcosahedronGeometry(1, 1);

  const groups = [];
  for (const cluster of CLUSTERS) {
    const rand = mulberry32(cluster.seed);
    const group = new THREE.Group();
    group.position.set(cluster.x, cluster.y, cluster.z);
    for (let i = 0; i < cluster.puffs; i++) {
      const puff = new THREE.Mesh(proto, material);
      const r = (cluster.flat ? 0.14 : 0.18) + rand() * (cluster.flat ? 0.2 : 0.26);
      const px = (rand() - 0.5) * cluster.span;
      const py = (rand() - 0.5) * cluster.span * (cluster.flat ? 0.1 : 0.3);
      const pz = (rand() - 0.5) * cluster.span * 0.45;
      puff.position.set(px, py, pz);
      // The game's squash: a cloud seen from the side is wider than tall.
      puff.scale.set(1.35 * r, 0.62 * r, 1.0 * r);
      puff.rotation.y = rand() * Math.PI * 2;
      group.add(puff);
    }
    const drift = {
      orbit: DRIFT.orbit[0] + rand() * (DRIFT.orbit[1] - DRIFT.orbit[0]),
      turn: DRIFT.turn[0] + rand() * (DRIFT.turn[1] - DRIFT.turn[0]),
      heading: rand() * Math.PI * 2,
      breathRate: DRIFT.breathRate[0] + rand() * (DRIFT.breathRate[1] - DRIFT.breathRate[0]),
      home: new THREE.Vector3(cluster.x, cluster.y, cluster.z),
    };
    groups.push({ group, drift });
  }
  return groups;
}

// ---- The gulls ----

// BirdsBelow's gulls (GDD decision 183), ported: a bird is a handful of
// flat panels in a shallow chevron - what makes it a gull rather than a
// sparrow is the chords, not the span - and the beat is a burst of strokes
// between long glides.
//
// The game's rig looks down on its gulls. This camera is level, so a bird
// is built side on instead: body along its own heading, wings hinged on
// the body and beating up and down in the plane of the screen. Side on, a
// wing lies almost wholly into the depth, so what a gull shows the screen
// is the chord, the swept tip and how far the beat carries the tip up - and
// the slow roll every gull rides on, which parts the near wing from the far
// one and is what makes the chevron read at this range.
//
// The flock is a loose one: each bird keeps its own pace, height, depth and
// wander for the whole crossing, so the line frays as it goes.
const GULL = {
  count: 4,
  span: [0.34, 0.46],
  // The gull's plan, in shares of its own span, from the game: the wing is
  // in two panels, because side on that is the whole bird. The arm is short
  // and broad and stays near the flat; the hand is long, raked and pointed
  // and takes the swing, which is the line a gull draws and a sparrow does
  // not. `head` and `tail` are the root chord fore and aft of the body,
  // `wrist` how far out the elbow sits, and the two sweeps how far the
  // leading edge has raked back by each joint.
  head: 0.09,
  tail: 0.1,
  wrist: 0.42,
  wristSweep: 0.1,
  wristChord: 0.13,
  sweep: 0.32,
  tipChord: 0.02,
  // How much of the swing the arm takes; the hand takes all of it, so the
  // wing bends at the wrist the way a real one does.
  armShare: 0.4,
  // The body in the same shares: a spindle from bill to tail, thickest just
  // ahead of the wing roots.
  nose: 0.17,
  stern: 0.25,
  waist: 0.02,
  girth: 0.048,
  // The beat, from the game: radians of swing, strokes a second, each
  // bird's own rate off by up to this share, and the soar envelope. Seen
  // side on it is the swing that draws the wing, so the arc is the game's
  // opened out, and it swings about a held dihedral rather than the flat -
  // a gull on the glide still shows a V.
  beatAmplitude: 0.85,
  dihedral: 0.26,
  beatRate: 2.4,
  beatSpread: 0.18,
  // Every bird soars to its own clock, and the phases are dealt round the
  // flock rather than drawn: four birds left to chance beat in unison often
  // enough, and a flock beating in unison is the formation again.
  glideSeconds: 7.0,
  glideSpread: 0.25,
  beatGate: 0.15,
  beatGateBand: 0.45,
  // The roll: the standing lean a bird holds, dealt to alternate sides for
  // the same reason, how far it rocks either side of that, and how slowly.
  bankBias: [0.05, 0.2],
  bankAmp: [0.18, 0.38],
  bankRate: [0.28, 0.5],
  // The crossing: in front of the island, entering off the right edge,
  // flying left until the last bird has left the frame, then resting this
  // many seconds before the flock comes round again. `from` is where a bird
  // waits to enter, and has to sit outside the widest banner this camera
  // can frame - at the gulls' depth an ultrawide reaches about nine units
  // either side - or the flock appears out of nothing on a broad screen.
  y: 0.72,
  z: 4.6,
  speed: 0.52,
  speedSpread: 0.09,
  // How far back down the line the birds are strung, and how far they
  // scatter in height and depth.
  stagger: 1.6,
  spreadY: 0.6,
  spreadZ: 0.8,
  // Each bird's own wander: surging along the track, riding up and down,
  // and drifting across it. The drift stays small - it turns the bird a few
  // degrees off square, and past that a wing swings round in front of the
  // bill and the bird stops reading as one.
  surge: [0.3, 0.7],
  surgeRate: [0.16, 0.3],
  riseAmp: [0.06, 0.17],
  riseRate: [0.3, 0.55],
  driftAmp: [0.1, 0.26],
  driftRate: [0.22, 0.4],
  from: 9.5,
  rest: 3,
  // How far into the crossing the scene opens: the flock is already in the
  // air on the first frame - and on the only frame, under reduced motion -
  // rather than the banner starting on empty sky.
  start: 6,
};

function buildGulls() {
  const rand = mulberry32(0xb17d5);
  const pick = (range) => range[0] + rand() * (range[1] - range[0]);
  const birds = [];
  for (let i = 0; i < GULL.count; i++) {
    const order = GULL.count > 1 ? i / (GULL.count - 1) : 0;
    // Heights are dealt round the flock on the golden step rather than drawn:
    // four birds left to chance land at much the same height too often.
    const rung = (i * 0.618) % 1;
    birds.push({
      span: pick(GULL.span),
      // A ragged line, not a formation: every bird is offset back along the
      // flight by its own margin and holds its own pace.
      lead: (order + (rand() - 0.5) * 0.5) * GULL.stagger,
      speed: GULL.speed * (1 + (rand() - 0.5) * 2 * GULL.speedSpread),
      y: GULL.y + (rung - 0.5) * GULL.spreadY,
      z: GULL.z + (rand() - 0.5) * GULL.spreadZ,
      surge: pick(GULL.surge),
      surgeRate: pick(GULL.surgeRate),
      surgePhase: rand() * Math.PI * 2,
      riseAmp: pick(GULL.riseAmp),
      riseRate: pick(GULL.riseRate),
      risePhase: rand() * Math.PI * 2,
      driftAmp: pick(GULL.driftAmp),
      driftRate: pick(GULL.driftRate),
      driftPhase: rand() * Math.PI * 2,
      bankBias: (i % 2 ? 1 : -1) * pick(GULL.bankBias),
      bankAmp: pick(GULL.bankAmp),
      bankRate: pick(GULL.bankRate),
      bankPhase: rand() * Math.PI * 2,
      beatPhase: rand() * Math.PI * 2,
      beatRate: GULL.beatRate * (1 + (rand() - 0.5) * 2 * GULL.beatSpread),
      glideRate: (Math.PI * 2) / (GULL.glideSeconds * (1 + (rand() - 0.5) * 2 * GULL.glideSpread)),
      glidePhase: (i / GULL.count + rand() * 0.2) * Math.PI * 2,
    });
  }

  // Where a bird is, at scene time t and this far into the crossing, and
  // which way it is pointing. The two clocks are separate: the crossing
  // stops and restarts, the wander runs on regardless.
  const here = { x: 0, y: 0, z: 0, fx: 0, fz: 0 };
  const place = (bird, t, p) => {
    here.x = GULL.from + bird.lead - bird.speed * p
      + bird.surge * Math.sin(bird.surgeRate * t + bird.surgePhase);
    here.y = bird.y + bird.riseAmp * Math.sin(bird.riseRate * t + bird.risePhase);
    here.z = bird.z + bird.driftAmp * Math.sin(bird.driftRate * t + bird.driftPhase);
    // A bird points where it is actually going, drift and all.
    const vx = -bird.speed
      + bird.surge * bird.surgeRate * Math.cos(bird.surgeRate * t + bird.surgePhase);
    const vz = bird.driftAmp * bird.driftRate * Math.cos(bird.driftRate * t + bird.driftPhase);
    const run = Math.hypot(vx, vz) || 1;
    here.fx = vx / run;
    here.fz = vz / run;
  };

  // Five quads a bird, rebuilt each frame: the body, and an arm and a hand
  // each side. The wing turns about the body, so a raised wing shortens into
  // the depth while its tip rides up the screen.
  const positions = new Float32Array(GULL.count * 5 * 2 * 3 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // The flock crosses in front of everything, by construction: depth is
  // switched off and the mesh drawn last, the way the game pins its birds
  // with renderingOrder rather than leaving them to the sort. The birds are
  // placed in world space, so the mesh itself never moves.
  const material = new THREE.MeshBasicMaterial({
    color: colour('#e9e6d8'),
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 50;
  mesh.frustumCulled = false;

  const pose = (t, p) => {
    let at = 0;
    const put = (x, y, z) => { positions[at++] = x; positions[at++] = y; positions[at++] = z; };
    for (const bird of birds) {
      place(bird, t, p);
      const fx = here.fx;
      const fz = here.fz;
      const bank = bird.bankBias + bird.bankAmp * Math.sin(bird.bankRate * t + bird.bankPhase);

      // The bird's own axes: forward along the heading, right across it,
      // up rolled over by the bank.
      const rx = -fz;
      const rz = fx;
      const ux = -fz * Math.sin(bank);
      const uy = Math.cos(bank);
      const uz = fx * Math.sin(bank);

      const glide = Math.sin(t * bird.glideRate + bird.glidePhase);
      const envelope = smoothstep(GULL.beatGate - GULL.beatGateBand, GULL.beatGate + GULL.beatGateBand, glide);
      const beat = GULL.dihedral
        + GULL.beatAmplitude * Math.sin(t * bird.beatRate * Math.PI * 2 + bird.beatPhase) * envelope;

      const half = bird.span / 2;
      const head = GULL.head * bird.span;
      const tail = GULL.tail * bird.span;
      const wristSpan = GULL.wrist * half;
      const wristLead = head - GULL.wristSweep * bird.span;
      const wristTrail = wristLead - GULL.wristChord * bird.span;
      const tipLead = head - GULL.sweep * bird.span;
      const tipTrail = tipLead - GULL.tipChord * bird.span;

      // Leading, trailing, leading, trailing - two triangles wound so the
      // face survives either way (double-sided).
      const panel = (inX, inY, inZ, inLead, inTrail, outX, outY, outZ, outLead, outTrail) => {
        put(inX + fx * inLead, inY, inZ + fz * inLead);
        put(inX + fx * inTrail, inY, inZ + fz * inTrail);
        put(outX + fx * outLead, outY, outZ + fz * outLead);
        put(inX + fx * inTrail, inY, inZ + fz * inTrail);
        put(outX + fx * outTrail, outY, outZ + fz * outTrail);
        put(outX + fx * outLead, outY, outZ + fz * outLead);
      };

      // The body, a spindle in the bird's own upright plane.
      const nose = GULL.nose * bird.span;
      const stern = GULL.stern * bird.span;
      const waist = GULL.waist * bird.span;
      const girth = GULL.girth * bird.span;
      put(here.x + fx * nose, here.y, here.z + fz * nose);
      put(here.x + fx * waist + ux * girth, here.y + uy * girth, here.z + fz * waist + uz * girth);
      put(here.x - fx * stern, here.y, here.z - fz * stern);
      put(here.x + fx * nose, here.y, here.z + fz * nose);
      put(here.x - fx * stern, here.y, here.z - fz * stern);
      put(here.x + fx * waist - ux * girth, here.y - uy * girth, here.z + fz * waist - uz * girth);

      for (const side of [1, -1]) {
        // The bank lifts one wing as far as it drops the other, and the arm
        // takes only its share of the swing, so the wing bends at the wrist.
        const lift = beat - side * bank;
        const arm = lift * GULL.armShare;
        const wx = here.x + side * rx * Math.cos(arm) * wristSpan;
        const wy = here.y + Math.sin(arm) * wristSpan;
        const wz = here.z + side * rz * Math.cos(arm) * wristSpan;
        const hand = half - wristSpan;
        const tx = wx + side * rx * Math.cos(lift) * hand;
        const ty = wy + Math.sin(lift) * hand;
        const tz = wz + side * rz * Math.cos(lift) * hand;
        panel(here.x, here.y, here.z, head, -tail, wx, wy, wz, wristLead, wristTrail);
        panel(wx, wy, wz, wristLead, wristTrail, tx, ty, tz, tipLead, tipTrail);
      }
    }
    geometry.attributes.position.needsUpdate = true;
  };

  // Right to left, once across, then a rest off stage before the return.
  // The crossing lasts until the last and slowest bird is clear.
  const travel = birds.reduce(
    (worst, bird) => Math.max(worst, (2 * GULL.from + bird.lead + bird.surge) / bird.speed),
    0
  );
  const cycle = travel + GULL.rest;
  const update = (t) => {
    const p = (((t + GULL.start) % cycle) + cycle) % cycle;
    const flying = p < travel;
    mesh.visible = flying;
    if (flying) pose(t, p);
  };
  update(0);
  return { mesh, update };
}

// ---- Mount ----

export function mount(banner) {
  const canvas = banner.querySelector('.ve-scene');
  if (!canvas) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (error) {
    return; // The backdrop is a complete composition.
  }

  const scene = new THREE.Scene();
  // The air: far clouds and the ground melt toward the painted horizon.
  scene.fog = new THREE.Fog(0xdce4da, CAM_Z + 1.5, CAM_Z + 9);

  // The land a long way below, the game's own baked FarCountryPicture laid
  // flat and seen at this tilt, ocean and all - real perspective under the
  // island. Self-lit, as the game hangs it.
  //
  // Grazing-angle compression is the enemy: at five units down, the map's
  // own grain is legible to about seventy units and mush past it. So the
  // ground is three bands whose mark size grows with range - the game's
  // decision 144, applied in depth: near country at natural grain, middle
  // country nearly four times coarser, far country eleven times - and the
  // far band runs to eleven pixels under the horizon line, where the
  // mountains stand. The distant bands aim at the map's field quarter; the
  // near one is the natural map, sea at the bottom of the frame and all.
  {
    const GROUND_Y = -5;
    // Each band loads the picture itself: a texture cloned before its
    // image arrives renders blank, and the browser caches the file anyway.
    const url = new URL('../img/verdant-land.png', import.meta.url).href;
    const band = (zNear, zFar, width, span, offsetV) => {
      const texture = new THREE.TextureLoader().load(url, () => {
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (!running) step();
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.repeat.set(width / span, (zNear - zFar) / span);
      texture.offset.set(0, offsetV);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, zNear - zFar),
        new THREE.MeshBasicMaterial({ map: texture, fog: false })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, GROUND_Y, (zNear + zFar) / 2);
      scene.add(mesh);
    };
    band(20, -70, 180, 90, 0.11);
    band(-70, -160, 340, 330, 0.5);
    band(-160, -300, 640, 1000, 0.52);

    // The air: clear over the near country, closing gently toward the
    // mountains' base.
    const airCanvas = document.createElement('canvas');
    airCanvas.width = 2;
    airCanvas.height = 1024;
    const ctx = airCanvas.getContext('2d');
    const air = ctx.createLinearGradient(0, airCanvas.height, 0, 0);
    air.addColorStop(0, 'rgba(206, 214, 198, 0)');
    air.addColorStop(0.35, 'rgba(206, 214, 198, 0.08)');
    air.addColorStop(0.7, 'rgba(202, 210, 192, 0.2)');
    air.addColorStop(1, 'rgba(196, 204, 186, 0.35)');
    ctx.fillStyle = air;
    ctx.fillRect(0, 0, airCanvas.width, airCanvas.height);
    const airTexture = new THREE.CanvasTexture(airCanvas);
    const airSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(640, 322),
      new THREE.MeshBasicMaterial({
        map: airTexture,
        transparent: true,
        depthWrite: false,
        fog: false,
      })
    );
    airSheet.rotation.x = -Math.PI / 2;
    airSheet.position.set(0, GROUND_Y + 0.2, 20 - 322 / 2);
    scene.add(airSheet);
  }

  const fullFov = (2 * Math.atan((REF_HEIGHT * VIEW_STRETCH) / 2 / CAM_Z) * 180) / Math.PI;
  const camera = new THREE.PerspectiveCamera(fullFov, 1, 0.1, 4000);
  camera.position.set(0, 0, CAM_Z);

  const sun = new THREE.DirectionalLight(colour(Palette.sunlight), 2.3);
  sun.position.set(-3.5, 4.5, 2.5);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(colour(Palette.ambient), 1.55));
  // The garden's own green bounce, faintly, up into the undersides.
  const bounce = new THREE.HemisphereLight(colour(Palette.ambient), colour(Palette.bounce), 0.5);
  scene.add(bounce);

  const island = new THREE.Group();
  island.add(buildRock());
  island.add(buildCanopy());
  const gardener = buildGardener();
  island.add(gardener);
  const engineStacks = buildStacks();
  island.add(engineStacks);
  const smoke = buildSmoke(engineStacks.userData.tops);
  island.add(smoke.group);
  island.position.set(ISLAND.x, ISLAND.shoulderY, 0);
  // Tilted five degrees toward the viewer, so the camera reads a sliver of
  // the garden's top as well as its side.
  island.rotation.x = (5 * Math.PI) / 180;
  scene.add(island);

  const clouds = buildClouds();
  for (const { group } of clouds) scene.add(group);

  const gulls = buildGulls();
  scene.add(gulls.mesh);

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  // Started mid-routine, so the first frame - and the only frame, under
  // reduced motion - has the gardener out on the rim.
  let elapsed = 10;

  const spot = gardenerSpot();
  const outward = Math.atan2(spot.z, spot.x) + Math.PI * 0.15;

  const step = () => {
    elapsed += clock.getDelta();
    const t = elapsed;
    island.position.y = ISLAND.shoulderY + ISLAND.bobAmp * Math.sin(t * ISLAND.bobRate);
    island.rotation.y = 0.025 * Math.sin(t * 0.15);
    const pose = gardenerPose(t);
    // Out past the hedge she steps up onto the canopy's lip, so her walk
    // ends silhouetted against the sky rather than behind the leaves.
    const lift = smoothstep(0.95, 1.14, pose.k) * 0.09;
    gardener.position.set(spot.x * pose.k, lift, spot.z * pose.k);
    gardener.rotation.y = outward + (pose.returning ? Math.PI : 0);
    gardener.rotation.z = pose.walking ? 0.05 * Math.sin(t * 9) : 0;
    smoke.update(t);
    gulls.update(t);
    for (const { group, drift } of clouds) {
      const bearing = drift.heading + drift.turn * t;
      group.position.x = drift.home.x - drift.orbit * (Math.cos(bearing) - Math.cos(drift.heading));
      group.position.z = drift.home.z + drift.orbit * (Math.sin(bearing) - Math.sin(drift.heading));
      group.position.y = drift.home.y + DRIFT.breathHeight * Math.sin(drift.breathRate * t + drift.heading);
    }
    renderer.render(scene, camera);
  };

  let running = false;
  let frame = 0;
  const loop = () => {
    if (!running) return;
    step();
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || still) return;
    running = true;
    clock.getDelta();
    frame = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  const resize = () => {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / (h * VIEW_STRETCH);
    camera.setViewOffset(w, Math.round(h * VIEW_STRETCH), 0, 0, w, h);
    camera.updateProjectionMatrix();
    if (!running) step();
  };
  new ResizeObserver(resize).observe(banner);
  resize();

  // Draw only while the banner is on screen; the sky does not spin for a
  // visitor who has scrolled past it.
  new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) start();
    else stop();
  }).observe(banner);

  banner.setAttribute('data-ve-ready', '');
  step();
}
