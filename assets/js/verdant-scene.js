// The WebGL half of the Verdant Engine banner: the island in the sky, rock
// under it and treetops on it, with the cloud banks drifting past - over the
// backdrop verdant-banner.js has already painted.
//
// The clouds are the game's own, ported from the render code: a cloud is
// CloudBank's puff - a low-segment geodesic sphere squashed (1.35, 0.62,
// 1.0), lambert-lit in Palette.cloud with a dimmed emission so its underside
// stays cloud rather than going grey - and the drift is CloudDrift's
// arithmetic at cluster level, each mass walking a slow seeded orbit and
// breathing. The palette is the game's every hex.
//
// The rock and the treetops are the banner's own, by the captain's word of
// 2026-08-28, and the reason is the camera. The game looks DOWN on its
// scenes at fifty-six degrees; this camera is level with the island. Every
// horizontal surface on this rock is therefore seen within eleven degrees of
// edge on - the top beds within three - so the game's whole scheme, bright
// bedding ledges taking a high sun, draws a ledge thirteen pixels wide as
// less than one pixel of picture. What a side-on view does show is the
// outline and how a vertical face is turned to the sun, so the stone is cut
// for those instead.
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
  keelDrop: 2.0,
  keelHalf: 0.5,
  bobAmp: 0.07,
  bobRate: 0.5,
};

// The beds of stone, top to bottom. `depth` is how thick the bed is; `inset`
// is how far its floor has drawn in toward the keel, nought at the rim and
// one on the keel line; `ledge` is how much of that draw-in the bed takes as
// a shelf at its own ceiling rather than as a lean on its face; `tone` is how
// pale the bed is between the deep stone and the pale.
//
// **A bed whose floor is drawn in LESS than the bed above it overhangs**, and
// two of them do. Nothing overhung on the ported rock - every course was
// strictly narrower than the one above - and a mass that only ever narrows is
// a mass that was turned rather than one that broke off. From a level camera
// the overhang is read in the outline rather than in the shadow under it, so
// what matters is that the profile steps back out by twenty-odd pixels, not
// that a soffit is lit.
//
// The depths sum to one, and the keel drop scales them.
const BEDS = [
  { depth: 0.086, inset: 0.085, ledge: 0.80, tone: 0.74 },
  { depth: 0.100, inset: 0.040, ledge: 0.92, tone: 0.46 },
  { depth: 0.112, inset: 0.215, ledge: 0.76, tone: 0.82 },
  { depth: 0.126, inset: 0.170, ledge: 0.92, tone: 0.38 },
  { depth: 0.156, inset: 0.375, ledge: 0.68, tone: 0.62 },
  { depth: 0.210, inset: 0.620, ledge: 0.58, tone: 0.34 },
  { depth: 0.210, inset: 1.000, ledge: 0.35, tone: 0.50 },
];

// How far each plate hangs below where the profile alone would put it, at the
// keel and nowhere near the shoulder. Without it the bottom of the mass is a
// smooth cone: the plates and the beds both have to fade there for the solid
// to close, and what closes neatly reads as turned. A slab torn off the
// underside of a country ends ragged.
function plateHang(p) {
  return (dealt(p * 17 + 3) - 0.5) * 0.46;
}

// How far the bedding is off level, and which way it falls. Real bedded rock
// is almost never laid dead flat, and a stack of level bands on a round mass
// is a barrel with stripes on it. Nine degrees is enough to be read as a dip
// and not enough to look like a mistake; it also wedges the top beds, thin on
// one side and thick on the other, which is a shape no lathe makes.
//
// It is eased in below the shoulder, because the shoulder itself has to stay
// level - the ground and the whole wood stand on it.
const BED_DIP = 0.158;
const BED_DIP_BEARING = 2.5;

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

// A wander round the island that never jumps from one column to the next:
// `lobes` values dealt on a ring and eased between. Returns -1 to 1.
//
// Everything that shapes the stone goes through this rather than through a
// hash of the column, and that is the whole difference between rock and
// gravel. A value dealt afresh at every column is noise at the size of a
// facet - about six pixels here - and the eye reads noise at that size as
// grit on a smooth thing, not as relief in a rough one.
function lobed(theta, lobes, salt) {
  const walked = ((theta / (Math.PI * 2)) % 1 + 1) % 1 * lobes;
  const i = Math.floor(walked);
  const t = walked - i;
  const eased = t * t * (3 - 2 * t);
  const at = (k) => dealt((((k % lobes) + lobes) % lobes) * 71 + salt * 313) * 2 - 1;
  const a = at(i);
  return a + (at(i + 1) - a) * eased;
}

// A headland, a cove and a buttress: three places on the rim where the
// outline does something, rather than a wander that does the same everywhere.
// Placed on the half of the island the camera can see - the camera looks down
// -z, so bearings between 0 and pi face it, with pi at screen left. The cove
// is kept clear of the gardener, who stands at 0.15.
const RIM_EVENTS = [
  { at: 2.86, width: 0.40, reach: 0.30 },
  { at: 0.62, width: 0.22, reach: -0.27 },
  { at: 1.70, width: 0.30, reach: 0.17 },
  { at: 2.15, width: 0.17, reach: -0.15 },
];

function bearingAway(theta, at) {
  let away = Math.abs(theta - at) % (Math.PI * 2);
  if (away > Math.PI) away = Math.PI * 2 - away;
  return away;
}

// The island's outline in plan: a low-harmonic wander, and then the three
// events on top of it. The wander alone gave a rim with no promontory and no
// notch anywhere on it, which is what made the mass read as a turned thing.
function rimRadius(theta) {
  let r =
    ISLAND.radius *
    (1 +
      0.10 * Math.sin(3 * theta + 1.7) +
      0.055 * Math.sin(7 * theta + 4.1) +
      0.03 * Math.sin(11 * theta + 2.3));
  for (const e of RIM_EVENTS) {
    const away = bearingAway(theta, e.at);
    r += e.reach * Math.exp(-(away * away) / (2 * e.width * e.width));
  }
  return r;
}

// The plan of the rock: flat plates of stone standing at their own distances
// from the middle, with a crack down the full drop between each and the next.
//
// **This is what a rounded outline could never give.** A radial wobble on a
// circle turns the surface by fifteen degrees at most, and fifteen degrees of
// turn under this sun is a shading difference the eye does not see; the mass
// comes back smooth however deep the wobble is made. What reads from a camera
// level with the rock is a plane at one angle meeting a plane at another
// along a hard vertical edge - so the outline is a polygon of seventeen
// irregular plates rather than a circle, and where two plates disagree about
// how far out they stand, the wall between them is a crack face.
//
// The plates are plumb, so a crack runs the whole drop the way a joint in a
// cliff does, and they soften a little toward the keel where the mass has to
// close.
const PLATES = 17;
const PLATE_SOFTEN = 0.4;

function plateEdges() {
  const widths = [];
  for (let p = 0; p < PLATES; p++) widths.push(0.62 + dealt(p * 37 + 5) * 0.85);
  const total = widths.reduce((a, b) => a + b, 0);
  const edges = [];
  let walked = 0;
  for (let p = 0; p < PLATES; p++) {
    edges.push((walked / total) * Math.PI * 2);
    walked += widths[p];
  }
  edges.push(Math.PI * 2);
  return edges;
}

// How far a plate stands off the outline. Mostly sound rock a little proud,
// and a few plates cut deeply back: the power is what keeps the clefts few.
function plateOffset(p) {
  return 0.13 - Math.pow(dealt(p * 91 + 17), 1.8) * 0.5;
}

// Plates that have shattered. A big slab only reads as big with broken ground
// beside it, and this is the only thing on the flank that makes a face much
// SMALLER than the grid would allow. A shattered plate breaks both ways at
// once: its columns stand at their own reaches instead of on one chord, so no
// two facets across it lie in one plane, and its rings step in and out by
// their own amounts, so its wall is chopped down into a stack of small ledges
// instead of running clean from its ceiling to its floor.
//
// It is given one extra column and no more. Every column on the island ends
// on the keel and cuts one notch in the fan that closes it, so a plate walked
// in six would comb the keel's approved raggedness down into a saw.
const SHATTERED = [2, 4, 8, 13];
const SHATTER_REACH = 0.11;
const SHATTER_STEP = 0.085;

// Where a bed is swallowed by the one above it.
//
// **Seventeen plates each crossing every one of seven beds is a grid**, and a
// grid has no big faces in it however far the widths and the depths are
// wobbled: every face is bounded by the same two cracks and the same two
// bedding lines as its neighbours, so none of them can be more than about
// twice any other. Measured off the rendered picture before this, the
// ninety-six faces the camera sees ran 0.07 to 0.26 square units of stone
// with the middle at 0.16 - four fifths of them inside a single factor of
// four, and inside any one bed a factor of 2.4.
//
// A bed listed here does not run the whole way round. Against those plates no
// ledge is cut at its ceiling, it is the same stone as the bed above, and the
// wall runs straight through where the bedding line would have broken it - so
// the two beds are one face twice the height. Plate 7 loses two in a row and
// carries a face three beds tall.
//
// None of them is on plate 5, which is the plate square to the camera at the
// front of the island. A run there fills the middle of the picture with one
// blank plane and takes the bedding out of the only place it is read at full
// size; the tall faces are worth more standing beside beds than instead of
// them, so they are put to either side of it and low down.
const SWALLOWED = [
  { bed: 2, plates: [7, 8, 14] },
  { bed: 3, plates: [6, 7] },
  { bed: 4, plates: [1, 11] },
  { bed: 5, plates: [3, 4, 12] },
];

function swallowed(bed, plate) {
  return SWALLOWED.some((s) => s.bed === bed && s.plates.includes(plate));
}

// The bed whose stone and whose bedding line a column actually takes: the top
// of the run it has been swallowed into.
const BED_HOST = BEDS.map((_, bed) =>
  Array.from({ length: PLATES }, (_, plate) => {
    let b = bed;
    while (b > 0 && swallowed(b, plate)) b--;
    return b;
  }),
);

// The rings that fall inside a run, and where each of them belongs on the
// straight line between the run's ceiling and its floor. The inset alone will
// not put them there: a column's place is not a straight function of its
// inset - the hang below the shoulder goes as f squared times one minus f -
// so rings laid at even insets come out on a curve, and a curve is three
// walls at three leans, which is what the run was meant to stop being.
const PLATE_STRAIGHTEN = Array.from({ length: PLATES }, () => []);

// How far each ring of the flank has drawn in toward the keel, worked out for
// one plate: the shoulder, then a shelf and a floor for every bed. Beds that
// this plate swallows are worked as one bed - one ledge at the top of the run
// and one straight wall from there to the floor of the last of them - so the
// rings that would have divided them land ON that wall instead of breaking
// it, and the strips between them come out flat and empty.
const PLATE_INSET = Array.from({ length: PLATES }, (_, plate) => {
  const runs = [];
  for (let bed = 0; bed < BEDS.length; bed++) {
    if (bed > 0 && swallowed(bed, plate)) runs[runs.length - 1].push(bed);
    else runs.push([bed]);
  }
  const insets = [0];
  let at = 0;
  for (const run of runs) {
    const first = BEDS[run[0]];
    const floor = BEDS[run[run.length - 1]].inset;
    // The ledge at the top of a run is the one the first bed would have had
    // on its own; all the extra draw-in goes into the lean of the wall. Cut it
    // for the whole run instead and the ledge is several times too deep, which
    // takes a bite out of the outline the shape work never asked for.
    const shelf = at + first.ledge * (first.inset - at);
    const depth = run.reduce((s, b) => s + BEDS[b].depth, 0);
    const top = insets.length;
    let walked = 0;
    for (const bed of run) {
      insets.push(shelf + (floor - shelf) * (walked / depth));
      walked += BEDS[bed].depth;
      insets.push(shelf + (floor - shelf) * (walked / depth));
    }
    const foot = insets.length - 1;
    walked = 0;
    for (let i = 0; i < run.length; i++) {
      if (i > 0) PLATE_STRAIGHTEN[plate].push({ index: top + i * 2, top, foot, at: walked / depth });
      walked += BEDS[run[i]].depth;
      if (i < run.length - 1) {
        PLATE_STRAIGHTEN[plate].push({ index: top + i * 2 + 1, top, foot, at: walked / depth });
      }
    }
    at = floor;
  }
  // A shattered plate's rings each stand at their own reach as well, which is
  // what chops its wall into small ledges rather than one clean face. It dies
  // away toward the keel, where every plate has to close onto the medial line
  // whatever it has been doing above.
  if (SHATTERED.includes(plate)) {
    for (let i = 1; i < insets.length - 1; i++) {
      const f = insets[i];
      insets[i] = clamp01(f + (dealt(plate * 71 + i * 41 + 7) - 0.5) * SHATTER_STEP * (1 - f));
    }
  }
  return insets;
});

// Where a rim column lands when it has drawn all the way in: on the keel, a
// short medial ridge rather than a point.
function keelPoint(theta) {
  const c = Math.cos(theta);
  const x = Math.sign(c) * Math.min(Math.abs(c) * ISLAND.radius, ISLAND.keelHalf);
  return { x, z: 0 };
}

// A point on the rim at a bearing, pushed out or cut back by `offset`.
function rimPoint(theta, offset) {
  const r = rimRadius(theta) + offset;
  return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}

// Which cracks do not run the whole drop.
//
// A crack that runs from the shoulder to the keel divides two plates all the
// way down, so neither can ever be wider than one plate. Where a crack is
// shut the two plates it separates stand at one reach and the eye sees a
// single slab twice the width; `from` and `to` are where along the drop it is
// open, nought at the shoulder and one at the keel, so a crack from -0.1 to
// 0.38 dies a third of the way down and one from 0.55 to 1.1 does not open
// until past halfway. Crack `c` is the joint between plate `c` and the next
// round, and no plate is listed twice, so a shut crack never has to be
// reconciled with another.
const CRACKS = [
  { crack: 3, from: -0.1, to: 0.38 },
  { crack: 7, from: 0.55, to: 1.1 },
];

function plateOffsetAt(p, f) {
  const own = plateOffset(p);
  for (const c of CRACKS) {
    const twin = c.crack;
    const next = (c.crack + 1) % PLATES;
    if (p !== twin && p !== next) continue;
    const open =
      smoothstep(c.from - 0.06, c.from + 0.06, f) * (1 - smoothstep(c.to - 0.06, c.to + 0.06, f));
    const shared = (plateOffset(twin) + plateOffset(next)) / 2;
    return shared + (own - shared) * open;
  }
  return own;
}

// Which plate's stone a plate is cut from at each ring. The wash in `stone`
// is dealt per plate, so where a crack has shut both sides must be told to
// take the one stone - otherwise the slab that has just closed up comes back
// in two shades and the eye still reads the crack the geometry has removed.
const PLATE_STONE = Array.from({ length: PLATES }, (_, plate) =>
  PLATE_INSET[plate].map((f) => {
    for (const c of CRACKS) {
      const next = (c.crack + 1) % PLATES;
      if (plate !== c.crack && plate !== next) continue;
      return f > c.from && f < c.to ? plate : c.crack;
    }
    return plate;
  }),
);

// Where a column stands when its plate reaches out by `offset`. A plate is
// walked along its own chord rather than along the arc, which is what makes
// it one flat face; at each join two columns are laid on the same bearing,
// one on each plate, and the wall between them is the crack. A shattered
// plate has no chord - every column takes the arc at its own reach.
function columnAt(col, offset) {
  if (col.shatter !== 0) return rimPoint(col.theta, offset + col.shatter);
  const a = rimPoint(col.t0, offset);
  const b = rimPoint(col.t1, offset);
  return { x: a.x + (b.x - a.x) * col.k, z: a.z + (b.z - a.z) * col.k };
}

// The shoulder outline walked once: every column carries the bearing it
// stands on, the chord of the plate it belongs to, and where the plain rim
// would have put it, so a ring can be taken between the two as the plates
// soften downward.
function rockPlan() {
  const edges = plateEdges();
  const plan = [];
  for (let p = 0; p < PLATES; p++) {
    const t0 = edges[p];
    const t1 = edges[p + 1];
    const broken = SHATTERED.includes(p);
    const span = (t1 - t0) / (Math.PI * 2);
    const steps = Math.max(broken ? 3 : 2, Math.round(span * 34));
    for (let s = 0; s < steps; s++) {
      const k = s / (steps - 1);
      const theta = t0 + (t1 - t0) * k;
      plan.push({
        theta,
        t0,
        t1,
        k,
        shatter: broken ? (dealt(p * 53 + s * 29 + 11) - 0.5) * SHATTER_REACH : 0,
        rim: rimPoint(theta, 0),
        plate: p,
      });
    }
  }
  return plan;
}

function buildRock() {
  const drop = ISLAND.keelDrop;
  const plan = rockPlan();
  const N = plan.length;

  // One ring of the flank: the outline drawn in toward the keel by `f`, with
  // the rib on it, at height `y` lifted by the bedding line's own rise.
  //
  // The rise is lobed round the island for the reason the game gives in
  // IslandRock.rise: a bedding line dealt afresh at every column moves by its
  // own amplitude between neighbours, and that stands the bed on end. Here it
  // was worse than that - the wander was two and three quarter pixels against
  // a bed six pixels deep, dealt per column, which is most of why the ported
  // rock came back as grit.
  const dipX = Math.cos(BED_DIP_BEARING) * BED_DIP;
  const dipZ = Math.sin(BED_DIP_BEARING) * BED_DIP;
  const ringAt = (index, y, bed) => {
    const ring = [];
    // The dip comes in over the first two beds and the rise with it, so the
    // shoulder stays the level line the wood stands on.
    const settled = bed < 0 ? 0 : clamp01((bed + 1) / 3);
    for (let j = 0; j < N; j++) {
      const col = plan[j];
      // Every plate walks its own profile, so a plate that has swallowed a
      // bed is drawn in less far here than its neighbours are.
      const f = index < 0 ? 0 : PLATE_INSET[col.plate][index];
      const host = bed < 0 ? -1 : BED_HOST[bed][col.plate];
      const theta = col.theta;
      const keel = keelPoint(theta);
      const soften = f * PLATE_SOFTEN;
      // The reach is asked for at this depth, so a crack that dies partway
      // down has already closed by the time the lower rings are laid.
      const stood = columnAt(col, plateOffsetAt(col.plate, f));
      const px = stood.x + (col.rim.x - stood.x) * soften;
      const pz = stood.z + (col.rim.z - stood.z) * soften;
      const x = (1 - f) * px + f * keel.x;
      const z = (1 - f) * pz + f * keel.z;
      // The bedding line takes the run's own wander, not each swallowed bed's,
      // or the wall the run has just joined up would kink at every line it was
      // meant to run past.
      const rise = host < 0 ? 0 : lobed(theta, 7, host * 5 + 2) * 0.10 * (1 - f * 0.5);
      ring.push({
        x,
        // The hang is nothing at the shoulder, most of it two thirds of the
        // way down, and nothing again on the keel itself - where every column
        // has already closed onto the medial line, so a column left hanging
        // there would draw a spike rather than a ledge.
        y:
          y +
          (rise + x * dipX + z * dipZ) * settled +
          plateHang(col.plate) * f * f * (1 - f) * 3.4,
        z,
        theta,
        plate: col.plate,
        cut: index < 0 ? col.plate : PLATE_STONE[col.plate][index],
        f,
        host,
      });
    }
    return ring;
  };

  // The profile: the shoulder, then for every bed a shelf at its ceiling and
  // a floor below it. Consecutive rings are a strip - a shelf where they
  // share a height, a face where they do not.
  const rings = [{ ring: ringAt(-1, 0, -1), bed: 0, shelf: false }];
  {
    let y = 0;
    let index = 0;
    for (let bed = 0; bed < BEDS.length; bed++) {
      rings.push({ ring: ringAt(++index, y, bed), bed, shelf: true });
      y -= BEDS[bed].depth * drop;
      rings.push({ ring: ringAt(++index, y, bed), bed, shelf: false });
    }
  }

  // Pull the rings inside a run onto the line between its ceiling and its
  // floor, so a swallowed pair is one plane and not two nearly-one planes.
  for (let j = 0; j < N; j++) {
    for (const s of PLATE_STRAIGHTEN[plan[j].plate]) {
      const a = rings[s.top].ring[j];
      const b = rings[s.foot].ring[j];
      const p = rings[s.index].ring[j];
      p.x = a.x + (b.x - a.x) * s.at;
      p.y = a.y + (b.y - a.y) * s.at;
      p.z = a.z + (b.z - a.z) * s.at;
    }
  }

  const positions = [];
  const colors = [];
  const pushTri = (a, b, c, col) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) colors.push(col.r, col.g, col.b);
  };

  // How pale a facet of stone is.
  //
  // The bed carries the tone and the bearing wanders it slowly; the facet
  // itself gets a fleck a tenth as large. The ported rock had this the other
  // way round - the tone came off a hash of the facet's own index, so the
  // mottle ran across the beds instead of with them and no seam of stone
  // held together for more than one triangle.
  const stone = (bed, theta, plate, midY, down) => {
    // The bed carries the tone; the plate washes it the same way in every bed,
    // the way one weathered face of a cliff is paler top to bottom; and only
    // the last and smallest term knows which of the two it is standing in. Let
    // that last term grow and the flank comes back a chequerboard of stone.
    const tone = clamp01(
      BEDS[bed].tone +
        (dealt(plate * 61 + 9) - 0.5) * 0.20 +
        lobed(theta, 6, bed * 3 + 7) * 0.09 +
        (dealt(plate * 313 + bed * 17) - 0.5) * 0.06
    );
    const col = bedrockDeep.clone().lerp(bedrockMid, clamp01(tone * 1.9));
    col.lerp(bedrockPale, clamp01((tone - 0.34) * 1.55));
    // Falling away from the light toward the keel: the read the game's rock
    // shader is after, land hanging in the air rather than a thick edge.
    col.lerp(bedrockDeep, 0.34 * smoothstep(0.34, 1.1, -midY / drop));
    // The top bed is the crust of earth the garden is growing in, not stone:
    // what the gardener stands on has to be seen to be a crust.
    if (bed === 0) col.copy(soilDark).lerp(bedrockMid, 0.18 + tone * 0.22);
    // A surface turned under is a surface the sun never reaches.
    if (down) col.multiplyScalar(0.72);
    return col;
  };

  for (let i = 1; i < rings.length; i++) {
    const upper = rings[i - 1];
    const lower = rings[i];
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N;
      const a = upper.ring[j], b = upper.ring[k], c = lower.ring[k], d = lower.ring[j];
      // A shelf that draws in faces up; one that steps back out is the ceiling
      // of an overhang and faces down. Which it is now depends on the plate,
      // so it is asked of the column and not of the whole ring.
      const down = lower.shelf && d.f < a.f;
      const midY = (a.y + c.y) / 2;
      const col = stone(d.host, a.theta, d.cut, midY, down);
      pushTri(a, b, c, col);
      pushTri(a, c, d, col);
    }
  }

  // Close the keel: the last ring fans onto the medial line, under the lowest
  // of it so the fan cannot turn back up through the mass.
  const last = rings[rings.length - 1].ring;
  const keelY = Math.min(...last.map((p) => p.y)) - 0.06;
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    const mid = { x: ((last[j].x + last[k].x) / 2) * 0.4, y: keelY, z: 0 };
    pushTri(last[j], last[k], mid, stone(BEDS.length - 1, last[j].theta, last[j].plate, keelY, true));
  }

  // A lid just under the canopy, so no camera angle sees down into the shell.
  const shoulder = rings[0].ring;
  const lid = { x: 0, y: 0.02, z: 0 };
  for (let j = 0; j < N; j++) {
    const k = (j + 1) % N;
    const col = soilDark.clone().lerp(leafShadow, 0.5);
    pushTri({ ...shoulder[k], y: 0.02 }, { ...shoulder[j], y: 0.02 }, lid, col);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Double sided, so the overhangs cannot go missing whichever way a strip
  // happens to be wound - and three.js turns the normal to face the camera on
  // a double-sided surface, so a soffit is still lit as the soffit it is.
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
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

// The leaf ramp and its clump grain are TreeStand's, digit for digit. What is
// the banner's own is where the ramp is measured from, what shapes a mass, and
// how the wood meets the drop.
//
// **The ramp is measured on the crown and not on the wood.** The game runs
// shadow-deep-mid-sun over each crown's own body - `(y - crownBase) / (2 *
// crownDepth)` in TreeStand.addBlob - so every tree in it shows a shaded
// underside and a lit top. The port measured it up the whole canopy instead,
// from world -0.2 to 1.15, and that is most of why the wood came back as one
// green lump: two masses at the same height took the same colour whatever
// their shape, a low mass was uniformly dark and a high one uniformly bright,
// and no mass anywhere had a top and an underside of its own.
//
// **The grain is per mass and not per world.** The game gives each blob its
// own offset round the crown; the port sampled a field in world coordinates,
// so two masses touching shared their mottle and were glued into one surface.
//
// **There are two kinds of tree.** Every mass was one shape in one size class
// before, so the wood's silhouette varied only by scale.

const CROWN_SPAN = 2.0;

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

// fract(sin(dot(cell, k)) * m), the shader's own cell hash.
function cellHash(cx, cy, kx, ky, m) {
  const v = Math.sin(cx * kx + cy * ky) * m;
  return v - Math.floor(v);
}

// The leaf modifier's grain: two rotated lattices of clumps and a fine
// dust, round the mass and up it, in the mass's own metres. `turn` is the
// mass's own offset round the crown, so no two masses carry the same mottle.
function leafGrain(x, y, z, turn) {
  const m0 = x + 0.6 * z + (turn || 0);
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
// top, the brighter clumps stepping up a tone as well as brightening. `rise`
// is how far up its own crown the leaf sits, nought at the underside and one
// at the top.
function leafColour(rise, grain) {
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

  // The lay of the wood: broad masses over a mound, a second planting packed
  // over the summit, spires standing out of both, a few crowns leaning right
  // out over the drop, and the gardener's corridor kept clear.
  const masses = [];
  const spot = gardenerSpot();
  const mound = (d) => 1 - (d / (ISLAND.radius * 1.1)) ** 2;
  // One tree in four is a spire: a tall narrow crown tapering to a point,
  // which is the only thing here that changes the wood's own outline rather
  // than the size of the lumps along it.
  const kindOf = () => (rand() < 0.30 ? 'spire' : 'broad');

  for (let i = 0; i < 900 && masses.length < 78; i++) {
    const t = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * ISLAND.radius * 0.98;
    const x = Math.cos(t) * d;
    const z = Math.sin(t) * d;
    const kind = kindOf();
    // The wood thins as it goes out, so it tapers to its edge instead of
    // ending in a ring of full-sized crowns laid round a flat top.
    const near = 0.68 + mound(d) * 0.42;
    const r = (kind === 'spire' ? 0.19 + rand() * 0.12 : 0.30 + rand() * 0.24) * near;
    if (distanceToWalk(x, z, spot) < 0.3 + r * 1.35) continue;
    if (masses.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (0.28 * (c.r + r)) ** 2)) continue;
    masses.push({ x, z, r, kind, y: -0.06 + mound(d) * 0.78 + r * 0.4, seed: 7 + i });
  }
  for (let i = 0; i < 400 && masses.length < 106; i++) {
    const t = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * ISLAND.radius * 0.6;
    const x = Math.cos(t) * d;
    const z = Math.sin(t) * d;
    const kind = kindOf();
    const r = kind === 'spire' ? 0.17 + rand() * 0.11 : 0.24 + rand() * 0.19;
    if (masses.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (0.2 * (c.r + r)) ** 2)) continue;
    masses.push({ x, z, r, kind, y: 0.12 + mound(d) * 0.78 + r * 0.4, seed: 900 + i });
  }

  // The trees that lean out over the drop, and the trunks that show under
  // them. An unbroken fringe all the way round is the surest sign that a
  // canopy was laid on rather than grown: what is wanted is a few crowns
  // hanging past the rock with daylight under them, and a gap or two where
  // the rock comes through.
  const overhang = [];
  const RIM_GAPS = [1.24, 2.45];
  for (let i = 0; i < 400 && overhang.length < 8; i++) {
    const t = rand() * Math.PI;
    if (Math.abs(t - GARDENER_THETA) < 0.55) continue;
    if (RIM_GAPS.some((g) => bearingAway(t, g) < 0.24)) continue;
    const rim = rimRadius(t);
    // Just past the rim and no further. A crown set out beyond its own
    // neighbours stops being a tree at the edge of a wood and becomes a bush
    // floating in the air on a stick.
    const d = rim * (0.97 + rand() * 0.13);
    const x = Math.cos(t) * d;
    const z = Math.sin(t) * d;
    const r = 0.22 + rand() * 0.15;
    if (overhang.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < (1.3 * (c.r + r)) ** 2)) continue;
    const mass = { x, z, r, kind: 'broad', y: 0.2 + rand() * 0.16 + r * 0.3, seed: 4400 + i };
    masses.push(mass);
    overhang.push({ ...mass, root: Math.min(d, rim * 0.94) });
  }

  // The dome of deep wood under the masses, so whatever shows between two
  // of them is leaf and never sky.
  //
  // Its outermost ring used to stand at 1.28 of the rim - wider than the
  // island and wider than any crown on it - so it hung past the whole wood as
  // a smooth green flap with no leaf shape anywhere on it. It is drawn back
  // inside the crowns now, which is the only place it can do its job from.
  {
    const M = 44;
    const K = 5;
    const spreads = [0.99, 0.93, 0.78, 0.52, 0.27, 0];
    const heights = [-0.05, 0.24, 0.45, 0.62, 0.75, 0.85];
    const dip = (theta, depth) => {
      let away = bearingAway(theta, GARDENER_THETA);
      return depth * Math.exp(-(away * away) / (2 * 0.22 * 0.22));
    };
    const ringPoint = (j, k) => {
      const theta = (j / M) * Math.PI * 2;
      const jag = 1 + (dealt(j * 37 + k * 101) - 0.5) * 0.12;
      // Where the rim is meant to show bare rock the dome pulls back with it.
      let gap = 1;
      for (const g of RIM_GAPS) {
        const away = bearingAway(theta, g);
        gap -= 0.34 * Math.exp(-(away * away) / (2 * 0.2 * 0.2));
      }
      const r = rimRadius(theta) * spreads[k] * jag * (k < 2 ? gap : 1);
      const notch = k === 1 ? dip(theta, 0.3) : k === 0 ? dip(theta, 0.1) : 0;
      return { x: Math.cos(theta) * r, y: heights[k] - notch, z: Math.sin(theta) * r };
    };
    const pushDome = (a, b, c) => {
      // The dome is the shade between crowns, so it is held low in the ramp.
      for (const p of [a, b, c]) {
        positions.push(p.x, p.y, p.z);
        const col = leafColour(0.17, leafGrain(p.x, p.y, p.z, 0) * 0.7);
        colors.push(col.r, col.g, col.b);
      }
    };
    for (let k = 0; k < K; k++) {
      for (let j = 0; j < M; j++) {
        const jn = (j + 1) % M;
        pushDome(ringPoint(j, k), ringPoint(jn, k), ringPoint(jn, k + 1));
        pushDome(ringPoint(j, k), ringPoint(jn, k + 1), ringPoint(j, k + 1));
      }
    }
  }

  // The masses themselves. The lump is TreeStand.addBlob's: a product of three
  // sines of the direction, phased per mass, plus or minus twenty-six per
  // cent - a smooth closed displacement, which is why a crown has no cracks.
  const proto = new THREE.IcosahedronGeometry(1, 1);
  const protoPos = proto.getAttribute('position');
  const protoIndex = proto.getIndex();
  const vertex = new THREE.Vector3();
  for (const mass of masses) {
    const deal = mulberry32(mass.seed);
    const phase = [deal() * 6.28, deal() * 6.28, deal() * 6.28];
    const squash = 0.55 + deal() * 0.55;
    const turn = deal() * 20;
    // A spire is the same solid drawn out and drawn to a point: the crown
    // narrows as a power of how far up it the leaf sits.
    const tall = mass.kind === 'spire' ? 2.5 + deal() * 1.1 : 0;
    const placed = [];
    for (let v = 0; v < protoPos.count; v++) {
      vertex.fromBufferAttribute(protoPos, v).normalize();
      // TreeStand's own lump, and a second one at twice the frequency over
      // it. One smooth product of three sines makes an egg; the second term
      // knuckles it, which is what tells a crown of leaves from a boulder.
      // Both are smooth functions of the direction, so the surface still
      // closes and a crown still cannot tear open.
      const lump = 1
        + 0.26
          * Math.sin(vertex.x * 4.3 + phase[0])
          * Math.sin(vertex.y * 3.1 + phase[1])
          * Math.sin(vertex.z * 2.6 + phase[2])
        + 0.17
          * Math.sin(vertex.x * 8.7 + phase[1])
          * Math.sin(vertex.y * 7.1 + phase[2])
          * Math.sin(vertex.z * 9.3 + phase[0]);
      if (tall) {
        const up = (vertex.y + 1) / 2;
        const taper = Math.pow(1 - up, 0.62);
        const flat = Math.hypot(vertex.x, vertex.z) || 1;
        placed.push([
          mass.x + (vertex.x / flat) * mass.r * taper * lump,
          mass.y + (up - 0.4) * mass.r * tall * lump,
          mass.z + (vertex.z / flat) * mass.r * taper * lump,
        ]);
      } else {
        placed.push([
          mass.x + vertex.x * mass.r * lump,
          mass.y + vertex.y * mass.r * squash * lump,
          mass.z + vertex.z * mass.r * lump,
        ]);
      }
    }
    // How far up its own crown a leaf sits, which is what the ramp is read on.
    const half = tall ? mass.r * tall * 0.5 : mass.r * squash;
    const base = mass.y - half * (tall ? 0.8 : 1);
    const span = Math.max(half * CROWN_SPAN, 0.2);
    const faces = protoIndex ? protoIndex.count / 3 : protoPos.count / 3;
    const at = (f, k) => (protoIndex ? protoIndex.getX(f * 3 + k) : f * 3 + k);
    for (let f = 0; f < faces; f++) {
      for (let k = 0; k < 3; k++) {
        const p = placed[at(f, k)];
        positions.push(p[0], p[1], p[2]);
        const col = leafColour((p[1] - base) / span, leafGrain(p[0], p[1], p[2], turn));
        colors.push(col.r, col.g, col.b);
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
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material));
  group.add(buildTrunks(overhang));
  return group;
}

// The trunks under the crowns that lean out over the drop. They are the whole
// point of letting a crown overhang: a mass of leaf hanging past the rock with
// nothing under it is a cloud, and a mass with a trunk running back in under
// the canopy is a tree standing at the edge of a wood.
function buildTrunks(overhang) {
  const positions = [];
  const colors = [];
  const light = colour(Palette.barkLight);
  const mid = colour(Palette.barkMid);
  const dark = colour(Palette.barkDark);
  const push = (a, b, c, col) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) colors.push(col.r, col.g, col.b);
  };
  for (const tree of overhang) {
    const t = Math.atan2(tree.z, tree.x);
    const foot = [Math.cos(t) * tree.root, -0.03, Math.sin(t) * tree.root];
    const head = [tree.x, tree.y - tree.r * 0.5, tree.z];
    const wide = 0.035 + tree.r * 0.05;
    const sides = 5;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const b = ((s + 1) / sides) * Math.PI * 2;
      // Turned to the light like the rock is: one flank of the trunk catches
      // the sun and the other does not.
      const face = mid.clone().lerp(Math.cos(a + 0.6) > 0 ? light : dark, 0.4);
      const ring = (ang, at, w) => [at[0] + Math.cos(ang) * w, at[1], at[2] + Math.sin(ang) * w];
      const p0 = ring(a, foot, wide * 1.35);
      const p1 = ring(b, foot, wide * 1.35);
      const p2 = ring(b, head, wide);
      const p3 = ring(a, head, wide);
      push(p0, p1, p2, face);
      push(p0, p2, p3, face);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })
  );
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
