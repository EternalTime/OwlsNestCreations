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
// edge on, so the game's whole scheme - bright bedding ledges taking a high
// sun - draws a ledge thirteen pixels wide as less than one pixel of
// picture. What a side-on view does show is the outline and how a steep face
// is turned to the sun, so the stone is cut for those instead.
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

const bannerStone = colour(Palette.bannerStone);
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
// -z, so bearings between 0 and pi face it, with pi at screen left.
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

// A point on the rim at a bearing.
function rimPoint(theta) {
  const r = rimRadius(theta);
  return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
}

// The four trees that hang their leaves over the edge - see buildWillows.
// They are listed here because the turf has to know about them: where a
// willow hangs, the grass runs down to meet it.
//
// `drop` is how far below the rim the longest frond falls, in metres, and
// `span` how wide across the rim the tree reaches, in radians.
//
// **The bearings are chosen on where they land in the picture, not on where
// they are round the island.** The camera is level, so a bearing shows at a
// distance cos(bearing) out from the middle of the island - which crowds the
// bearings near 0 and near pi together and spreads the ones near a right
// angle apart. Four evenly dealt bearings would come out as two pairs stuck
// to the two edges. These four stand at 0.96, 0.64, -0.46 and -0.97 of the
// island's half-width, so the widest run of clean stone - 1.10 of that
// half-width, better than half the whole island - lies across the middle,
// where the eye is.
//
// No arm of any of them reaches into the two bare gaps the canopy keeps at
// 1.24 and 2.45, nor within 0.20 of a radian of the buttress at 1.72 where
// the gardener is seen.
const WILLOWS = [
  { at: 0.30, span: 0.16, drop: 0.40, seed: 311 },
  { at: 0.88, span: 0.20, drop: 1.05, seed: 733 },
  { at: 2.05, span: 0.26, drop: 0.65, seed: 1279 },
  { at: 2.88, span: 0.22, drop: 1.15, seed: 1811 },
];

// ---- The turf ----

// How far below the rim the grass reaches, in world height, at a bearing.
//
// The grass grows over the top of the island and then spills over the rim and
// runs a little way down the stone, the way turf overhangs a cut bank. This
// camera is level, so the top of the island is barely a sliver of picture and
// the flank is nearly all of it: the spill IS the grass, as far as the eye
// here is concerned, and everything about it has to be judged on the flank.
//
// **It must not be a band of one depth.** A green line at a constant height
// all the way round is the same horizontal banding the stone under it was
// just rebuilt to be rid of, and it would put the banding straight back one
// step higher up. So the reach wanders on two beats that do not divide into
// one another - six lobes for the long tongues, seventeen for the fret
// between them - and the two together carry it from about 0.41 of a metre
// below the rim where the turf hangs furthest to nothing at all where it
// hangs least, and there the stone comes up bare to the edge.
//
// **A fifth of a metre is as far as it should usually go, and the reason is
// what the eye compares it against.** The crust of earth beneath it is cut at
// 0.34 of a metre give or take 0.13, so a turf that typically reaches 0.18
// stops well inside the crust nearly everywhere and lets the earth show as a
// second, different-edged strip beneath it - grass, then earth, then stone,
// three tones down the flank whose two edges wander on beats of six and of
// five and so never fall together. Run the turf deeper than the crust
// everywhere and both edges are lost at once: the earth is buried and the
// green meets the stone on a single line, which is the one line this rock
// must not have.
//
// **Under a willow the turf runs down to meet it.** Grass spilling to a fifth
// of a metre and a curtain of leaf falling a whole metre from a bough just
// above it would otherwise be two separate fringes with a strip of bare stone
// between them, and the eye reads two edges rather than one broken one. So
// where a willow hangs the turf reaches down about a third as far as the
// willow does, and the two greens meet.
//
// **It is a tongue and not a skirt.** The bulge is held to about half the
// tree's own span and to a quarter of a metre at most, because a wide, gentle
// one does not tie a willow to the grass - it lowers the turf's edge all
// round and puts back the same level band a step further down.
function turfDepth(theta) {
  let deep = 0.18 + lobed(theta, 6, 17) * 0.15 + lobed(theta, 17, 53) * 0.08;
  for (const w of WILLOWS) {
    const away = bearingAway(theta, w.at);
    const wide = w.span * 0.5;
    deep += Math.min(w.drop * 0.32, 0.24) * Math.exp(-(away * away) / (2 * wide * wide));
  }
  return deep;
}

// ---- The stone under the island ----
//
// The underside is a mountain hanging point downward, cut the way the
// captain's reference is cut. **Every face on it is a triangle and no two of
// them are paired into a rectangle**, and nothing anywhere on it runs round
// the island at one height. The courses and beds this rock used to be built
// of are gone: a bed is a line at a constant height by definition, and while
// the rock had them it read as a stack of bricks however far their sizes and
// their tones were varied.
//
// What replaces them is radial. Spurs run from the rim down to the keel with
// gullies between them, and between one spur and the next the stone is ruled
// straight in bearing - so a spur is a genuine crease and the flank between
// two of them is one broad plane. Each spur reaches its own depth, so the
// keel is a crumpled crown rather than a point and the outline is jagged
// rather than a cone.
//
// The facets are cut from an irregular scatter of points, triangulated in the
// plan and then hung. Their sizes therefore run wide - broad planes where the
// stone is quiet, tight clusters along every crease and at the keel - which
// no grid of columns and rings can give, because there every face is bounded
// by the same lines as its neighbours.
//
// It is one stone throughout. All of the light and shade on it is which way a
// facet is turned to the sun, which is the whole of how the reference reads.

// How far the stone hangs below the rim on the plain profile, as a fraction
// of the keel drop. Measured off the captain's reference, the mountain there
// is very nearly a straight cone - at a quarter of the way down from the peak
// it is already 45 hundredths of its base across, at halfway 70 and at three
// quarters 88 - so all of its character is in the ridges and none of it is in
// the profile. This is that cone, with the first tenth of the drop steepened
// to about seventy degrees for the cliff where the mass broke away from the
// country it belonged to.
function flankProfile(u) {
  return 0.55 * u + 0.45 * Math.pow(u, 0.35);
}

// The fan of spurs. `reach` is how much deeper - a ridge - or shallower - a
// gully - the stone hangs along that bearing, and the two alternate, so a
// ridge always has a gully beside it. `wave` and `phase` say where down its
// length a spur is strongest: some stand out high on the flank and have died
// before the keel, others gather only below halfway. Without that a fan of
// seventeen even spurs is a parasol.
//
// **The flutes have to be deep, and the reason is arithmetic.** The sun comes
// from up and to the left, at a bearing of 0.56 across the picture and 0.72
// up it. The underside of a cone whose rim is 1.6 across and whose keel hangs
// 2.0 below it meets the horizon at 51 degrees on average, so its plain flank
// turns a normal 0.62 downward - and 0.62 of the sun's 0.72 upward is more
// than the whole of its 0.56 sideways can answer. Every facet on such a flank
// is in shadow, and a mass in which no facet is lit is a black cut-out
// whatever is cut into it. A flute does not change the average - a ridge
// stands as far out as its gully cuts in - but it turns the stone either side
// of every crease through sixty degrees sideways, which is enough to bring
// one wall into the sun and leave the other out of it. That alternation is
// the whole of the reference's light.
const SPUR_AMP = 0.38;
const SPURS = (() => {
  const count = 17;
  const widths = [];
  for (let i = 0; i < count; i++) widths.push(0.55 + dealt(i * 29 + 3) * 0.95);
  const total = widths.reduce((a, b) => a + b, 0);
  const spurs = [];
  let walked = 0;
  for (let i = 0; i < count; i++) {
    // A spur's depth is set by the two flanks it stands between, so a wide
    // flank is cut as steeply as a narrow one. A fixed depth spread over a
    // wide flank is hardly any tilt at all, and it is the tilt the light
    // reads - without this the broad planes, which are the ones that cover
    // the picture, are the ones that go dark.
    const span = ((widths[(i + count - 1) % count] + widths[i]) / 2) * (count / total);
    spurs.push({
      at: (walked / total) * Math.PI * 2,
      reach: (i % 2 ? -1 : 1) * span * (0.74 + dealt(i * 53 + 11) * 0.56),
      wave: 2.1 + dealt(i * 97 + 5) * 4.2,
      phase: dealt(i * 131 + 19) * Math.PI * 2,
    });
    walked += widths[i];
  }
  return spurs;
})();

// Which two spurs a bearing lies between, and how far across.
function spurAt(theta) {
  const turn = Math.PI * 2;
  const t = ((theta % turn) + turn) % turn;
  let i = SPURS.length - 1;
  while (i > 0 && SPURS[i].at > t) i--;
  const a = SPURS[i].at;
  const b = i + 1 < SPURS.length ? SPURS[i + 1].at : turn;
  return { i, g: (t - a) / (b - a) };
}

function spurReach(i, u) {
  const s = SPURS[i % SPURS.length];
  // Where down its length a spur is at its strongest, on two beats rather
  // than one. **It is allowed to go negative**, and that is the point: a spur
  // that holds its sign from the rim to the keel is the rib of an umbrella,
  // and seventeen of those are an umbrella. Where this passes through nought
  // the crease dies out, and below that the ridge comes back as a gully and
  // the gully beside it as a ridge - so no fold anywhere on the mass runs the
  // whole drop.
  const along =
    -0.34 +
    1.34 *
      Math.pow(
        clamp01(
          0.5 + 0.36 * Math.sin(u * s.wave + s.phase) + 0.18 * Math.sin(u * s.wave * 2.3 + s.phase * 1.7),
        ),
        1.25,
      );
  // Nothing at the rim, so the crust is cut on a clean line, and falling away
  // with the radius below.
  //
  // **It has to fall away with the radius, or the flutes stand on end near
  // the keel.** A flank between two spurs is only as wide as the ring it is
  // cut on: a sixth of a metre of arc at the keel against three quarters at
  // the rim. The same depth of flute across the narrow one is four times the
  // tilt, so a flute held at full depth all the way down leaves the last of
  // the mass as a comb of eighty-degree slivers. Held instead in proportion
  // to the radius, the stone stands at about sixty-five degrees either side
  // of every crease from the rim to the keel, which is the tilt the light
  // reads best and the facets stay facets.
  return s.reach * along * Math.pow(u, 0.35) * (0.08 + 0.92 * (1 - u));
}

// The lumps in the mass: a shoulder swelling out, hollows scooped between
// spurs, a knuckle low down beside the keel. Each is a lens in the plan, so
// none of them is level and none of them runs round the island, and they are
// what stops the spurs reading as the ribs of an umbrella. `at` is the
// bearing and `rho` how far out along it, nought at the keel and one at the
// rim; `reach` is in keel drops, positive for stone standing proud.
const SWELLS = [
  { at: 2.70, rho: 0.62, span: 0.52, reach: 0.26 },
  { at: 2.10, rho: 0.34, span: 0.40, reach: -0.20 },
  { at: 1.55, rho: 0.70, span: 0.44, reach: -0.22 },
  { at: 1.05, rho: 0.45, span: 0.50, reach: 0.28 },
  { at: 0.45, rho: 0.66, span: 0.38, reach: 0.19 },
  { at: 3.55, rho: 0.50, span: 0.46, reach: -0.18 },
  { at: 4.80, rho: 0.55, span: 0.50, reach: 0.22 },
  // The keel's own two: one throws the lowest point of the mass off the
  // middle, the other stands a second knuckle beside it, so the stone ends
  // in a crumpled crown instead of on the axis it was turned about.
  { at: 2.35, rho: 0.13, span: 0.34, reach: 0.30 },
  { at: 5.60, rho: 0.20, span: 0.30, reach: -0.24 },
]
  // And a scatter of smaller knuckles all over the flanks, dealt rather than
  // placed. A spur that runs unbroken from the rim to the keel is a fold in a
  // curtain, and seventeen of them are a curtain: it takes something
  // happening ACROSS a spur, at its own place and its own size, to make the
  // stone read as stone.
  .concat(
    Array.from({ length: 40 }, (_, i) => ({
      at: dealt(i * 71 + 13) * Math.PI * 2,
      rho: 0.14 + dealt(i * 137 + 29) * 0.78,
      span: 0.12 + dealt(i * 191 + 7) * 0.23,
      reach: (dealt(i * 233 + 41) - 0.45) * 0.28,
    })),
  )
  .map((s) => {
    const r = rimRadius(s.at) * s.rho;
    return { ...s, x: Math.cos(s.at) * r, z: Math.sin(s.at) * r };
  });

// How far the stone hangs below the rim at a point on the plan.
function stoneHang(x, z) {
  const theta = Math.atan2(z, x);
  const rho = Math.min(Math.hypot(x, z) / rimRadius(theta), 1);
  const u = 1 - rho;
  const { i, g } = spurAt(theta);
  const near = spurReach(i, u);
  const far = spurReach(i + 1, u);
  let hang = flankProfile(u) + SPUR_AMP * (near + (far - near) * g);
  // The lumps are eased in below the rim, so the line the crust is cut on is
  // the rim itself and the garden's floor is not lifted or dropped anywhere.
  const settled = smoothstep(0.02, 0.26, u);
  for (const s of SWELLS) {
    const dx = x - s.x;
    const dz = z - s.z;
    hang += s.reach * Math.exp(-(dx * dx + dz * dz) / (s.span * s.span)) * settled;
  }
  return hang * ISLAND.keelDrop;
}

// How far out from the middle the stone's face lies, on a bearing, at a given
// depth below the rim. The stone is cut from flutes and swells rather than
// from a formula, so this is a bisection on stoneHang itself, which is the
// only thing that knows where the face actually is. It is what lets a
// willow's fronds hang against the cut instead of in the air beside it.
function faceRadius(theta, depth) {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  let near = 0.02;
  let far = rimRadius(theta);
  for (let i = 0; i < 22; i++) {
    const mid = (near + far) / 2;
    if (stoneHang(cos * mid, sin * mid) > depth) near = mid;
    else far = mid;
  }
  return (near + far) / 2;
}

// Sectors whose stone has shattered. A broad plane only reads as broad with
// broken ground beside it, so a third of the flanks are cut into small facets
// and the rest are left as one face.
const SECTOR_CALM = SPURS.map((_, i) =>
  dealt(i * 211 + 13) < 0.35 ? 0.42 : 0.74 + dealt(i * 17 + 41) * 0.41,
);

// How much room a facet is given here. Tight along every crease, where the
// stone comes apart into a cluster; tight at the keel, where the spurs crowd
// together; tighter again along the rim, where the crust is cut; and broad in
// the middle of a quiet flank, where one plane can run for a third of a metre.
function facetSpacing(x, z) {
  const theta = Math.atan2(z, x);
  const rho = Math.hypot(x, z) / rimRadius(theta);
  const { i, g } = spurAt(theta);
  // **How fast this may change matters more than what it ranges over.** Where
  // a fine patch of stone abuts a coarse one, the facets that bridge the two
  // are drawn between one near point and two far ones and come out as
  // needles, which draw as loose threads down the rock rather than as facets.
  // So the three things that make a facet small - standing on a crease,
  // standing near the keel, standing on a flank whose stone has shattered -
  // are multiplied together, and none of them may take away more than about
  // half. That holds the whole range to nine to one and every step along it
  // small.
  const crease = 0.55 + 0.45 * Math.pow(2 * Math.min(g, 1 - g), 1.2);
  const room =
    0.55 + 0.45 * smoothstep(0.02, 0.26, rho) * (1 - 0.45 * smoothstep(0.80, 0.99, rho));
  return 0.34 * SECTOR_CALM[i] * crease * room;
}

// How much a step laid out flat in the plan is stretched when the stone is
// hung on it. On the sixty-degree band just inside the rim it is stretched
// two and a half times, so a scatter that is even in the plan comes out there
// as a comb of slivers two and a half times taller than they are wide. The
// scatter is squeezed radially by this instead, which is what gives that band
// facets rather than fringe.
function planStretch(rho) {
  const u = clamp01(1 - rho);
  const a = Math.max(0, u - 0.004);
  const b = Math.min(1, u + 0.004);
  const slope = ((flankProfile(b) - flankProfile(a)) / (b - a)) * (ISLAND.keelDrop / ISLAND.radius);
  return Math.min(3.0, Math.sqrt(1 + slope * slope));
}

// The points the stone is cut on: the rim first, then a chain straight down
// every spur so the crease is cut ALONG it rather than across it, then a
// scatter filling what is left at whatever spacing that place asks for.
function stonePoints() {
  const points = [];
  const rim = [];
  const clear = (x, z, r, stretch) => {
    const len = Math.hypot(x, z) || 1;
    const ux = x / len;
    const uz = z / len;
    for (const p of points) {
      const dx = p.x - x;
      const dz = p.z - z;
      // A floor under all of it, whatever the squeeze asks for. Two points
      // three centimetres apart in the plan make a facet a pixel and a half
      // wide on screen, which draws as a stray thread down the stone rather
      // than as a facet.
      if (dx * dx + dz * dz < 0.03 * 0.03) return false;
      const out = (dx * ux + dz * uz) * stretch;
      const along = dx * uz - dz * ux;
      if (out * out + along * along < r * r) return false;
    }
    return true;
  };

  // The rim is walked at the spacing the stone just inside it asks for. Laid
  // at one fine step instead, it hands every coarse flank below it a fan of
  // long thin slivers - a fringe of icicles hanging off the crust, which is
  // what a dense line meeting a coarse one always makes.
  for (let theta = 0; theta < Math.PI * 2; ) {
    const p = rimPoint(theta);
    const point = { x: p.x, z: p.z, y: 0, rim: true };
    rim.push(point);
    points.push(point);
    theta += facetSpacing(p.x * 0.97, p.z * 0.97) / rimRadius(theta);
  }
  // The last step lands short of the first point as often as not, so the two
  // are merged when they would otherwise sit on top of one another.
  if (Math.hypot(rim[0].x - rim[rim.length - 1].x, rim[0].z - rim[rim.length - 1].z) < 0.03) {
    points.splice(points.indexOf(rim.pop()), 1);
  }

  for (let i = 0; i < SPURS.length; i++) {
    const at = SPURS[i].at;
    const R = rimRadius(at);
    let rho = 0.975;
    let n = 0;
    // The chains stop short of the keel. Carried all the way in they would
    // meet there, and seventeen chains meeting at a point can only be closed
    // by seventeen long radial slivers - the fan of a paper parasol, which is
    // the shape the whole of this is trying not to be. The keel is left to
    // the scatter, which crumples it.
    while (rho > 0.23) {
      const x = Math.cos(at) * R * rho;
      const z = Math.sin(at) * R * rho;
      // The crease is cut at the spacing its own flanks are cut at. Given a
      // step of its own it disagrees with them, and the disagreement is paid
      // for in needles down either side of every spur.
      const gap = facetSpacing(x, z) * 0.86;
      // A spine point that lands on top of a rim point makes a facet with no
      // width, and a facet with no width has no normal: it draws as a stray
      // dark thread down the stone. Where the rim already stands close enough
      // the rim point serves as the top of the crease.
      if (clear(x, z, gap * 0.5, planStretch(rho))) points.push({ x, z, gap });
      rho -= (gap * (0.78 + dealt(i * 43 + n * 19 + 7) * 0.55)) / (R * planStretch(rho));
      n++;
    }
  }

  const rand = mulberry32(0x51ee0);
  for (let attempt = 0; attempt < 26000; attempt++) {
    const theta = rand() * Math.PI * 2;
    // A third of the darts are thrown at the keel alone. Scattered evenly over
    // the plan they land where the plan is wide, and the keel - which is where
    // the facets are smallest and most of them are wanted - takes a twentieth
    // of the darts and comes out bare.
    const rho = attempt % 3 === 0 ? rand() * 0.30 : Math.sqrt(rand()) * 0.985;
    const R = rimRadius(theta);
    const x = Math.cos(theta) * R * rho;
    const z = Math.sin(theta) * R * rho;
    const gap = facetSpacing(x, z);
    if (!clear(x, z, gap * 0.68, planStretch(rho))) continue;
    points.push({ x, z, gap });
  }

  // The grain: the stone is rough where its facets are small and smooth where
  // they are broad, so a quiet flank stays one plane and a crease comes apart
  // into a cluster of facets each catching the light its own way. Tied to the
  // spacing, because a wobble smaller than a facet is grit rather than relief.
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.rim) continue;
    const rho = Math.hypot(p.x, p.z) / rimRadius(Math.atan2(p.z, p.x));
    const rough = 0.32 * p.gap * planStretch(rho) * (1 - smoothstep(0.13, 0.34, p.gap));
    p.y = -(stoneHang(p.x, p.z) + (dealt(i * 29 + 7) - 0.5) * 2 * rough);
  }

  return { points, rim };
}

// Bowyer-Watson, in the plan. Returns triples of indices into `points`.
function triangulate(points) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    lo = Math.min(lo, p.x, p.z);
    hi = Math.max(hi, p.x, p.z);
  }
  const wide = (hi - lo) * 12;
  const mid = (lo + hi) / 2;
  const work = points.concat([
    { x: mid - wide, z: mid - wide },
    { x: mid + wide, z: mid - wide },
    { x: mid, z: mid + wide },
  ]);
  const n = points.length;

  const held = (a, b, c) => {
    const ax = work[a].x, ay = work[a].z;
    const bx = work[b].x, by = work[b].z;
    const cx = work[c].x, cy = work[c].z;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-14) return { a, b, c, ux: 0, uy: 0, r2: -1 };
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { a, b, c, ux, uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };

  let tris = [held(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const px = work[i].x;
    const pz = work[i].z;
    const kept = [];
    const edges = [];
    for (const t of tris) {
      if ((px - t.ux) ** 2 + (pz - t.uy) ** 2 < t.r2) {
        edges.push([t.a, t.b], [t.b, t.c], [t.c, t.a]);
      } else kept.push(t);
    }
    tris = kept;
    for (let e = 0; e < edges.length; e++) {
      const [u, v] = edges[e];
      let shared = false;
      for (let f = 0; f < edges.length && !shared; f++) {
        if (f !== e && edges[f][0] === v && edges[f][1] === u) shared = true;
      }
      if (!shared) tris.push(held(u, v, i));
    }
  }

  const out = [];
  for (const t of tris) {
    if (t.a >= n || t.b >= n || t.c >= n) continue;
    out.push([t.a, t.b, t.c]);
  }
  return out;
}

function buildRock() {
  const { points, rim } = stonePoints();
  const faces = triangulate(points);

  const positions = [];
  const colors = [];
  const pushTri = (a, b, c, col) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) colors.push(col.r, col.g, col.b);
  };

  // One stone, and the crust of earth above it. The captain's reference is a
  // single colour lit by facet angle, and a previous measure of this rock
  // found its hue barely varied anyway - so nothing here separates one part
  // of the mass from another by colour.
  //
  // **It is paler than any stone the game has, and it has to be.** An
  // underside takes no direct sun over most of itself; what reaches it is the
  // ambient and the garden's bounce, about an eighth of full daylight. Under
  // that, the light on this mass runs from the 88th level of grey in the
  // gullies to the 209th on the walls that face the sun - two and a half
  // times, plenty to model a facet by. But the light is multiplied by the
  // stone, and on the game's deep bedrock that whole range lands between the
  // 27th level and the 55th, where there is no room left to see it and the
  // mass reads as a black cut-out however it is cut. On this stone the same
  // angles open out to between the 55th and the 115th.
  const stone = bannerStone.clone();
  const crust = soilDark.clone().lerp(bannerStone, 0.50);
  // The grass is the game's own leaf ramp and nothing else: what is lit at
  // the top of a crown lights the top of the turf, and what is in shade under
  // a crown shades the turf where it hangs down the stone. So the treetops,
  // the grass and the game are all saying the same green.
  //
  // The ramp is taken a step brighter than a crown's, because of where the
  // turf sits. Every facet the grass lands on is part of the cliff just under
  // the rim, turned about seventy degrees from level, so it takes barely a
  // third of the sun a level surface would - and the game's leaf colours,
  // which are mixed for a crown lit from above, come out under that as a
  // green so dark it joins the wood's own underside and the island loses its
  // top edge. Reading the same ramp from leafSun down instead puts the lit
  // turf back where a bank of grass belongs, a clear step above the shade
  // beneath the crowns standing on it.
  const turfLit = leafSun.clone();
  const turfShade = leafMid.clone().lerp(leafDeep, 0.35);

  for (const [ia, ib, ic] of faces) {
    const a = points[ia];
    const b = points[ib];
    const c = points[ic];
    const cx = (a.x + b.x + c.x) / 3;
    const cz = (a.z + b.z + c.z) / 3;
    const theta = Math.atan2(cz, cx);
    // Delaunay fills the hull; the island's rim is not convex, so the slivers
    // laid across the cove are dropped.
    if (Math.hypot(cx, cz) > rimRadius(theta)) continue;
    const hang = -(a.y + b.y + c.y) / 3;
    // The crust the garden grows in, eaten away unevenly underneath rather
    // than cut off level. It has to be deeper than the first row of facets
    // below the rim, or its edge is that row's own zigzag and the island wears
    // a saw round its middle.
    const crustDeep = 0.34 + lobed(theta, 5, 3) * 0.13;
    // The turf's own edge, torn facet by facet - but only just.
    //
    // **The deal has to stay small, and the reason is the shape of the facets
    // it is dealt over.** The stone in this band is the seventy-degree cliff,
    // where the plan is squeezed radially and a facet comes out two and a half
    // times taller than it is wide. A facet is painted whole, by where its
    // middle falls, so a deal big enough to move the edge past a whole facet
    // flips green and stone alternately down a row of slivers and draws the
    // turf as a comb of green needles hanging off the rim. At a twentieth of a
    // metre the deal only ever moves the edge by part of a facet, which puts
    // the tear at the facets' own scale and leaves the raggedness proper to
    // the wander, where it can be as wide as it is deep.
    const grassDeep = turfDepth(theta) + (dealt(ia * 53 + 29) - 0.5) * 0.05;
    let col;
    if (hang < grassDeep) {
      // Bright where the turf lies over the top, darkening as it hangs, and
      // dealt a step of the ramp per facet the way the leaf grain steps a
      // crown's colour - so the turf is not one flat green wash.
      col = turfLit.clone().lerp(turfShade, smoothstep(0, 0.42, hang));
      col.lerp(leafDeep, 0.22 * dealt(ia * 17 + 91));
    } else if (hang < crustDeep) {
      col = crust;
    } else {
      col = stone.clone().lerp(bedrockDeep, 0.18 * smoothstep(0.35, 2.0, hang));
    }
    pushTri(a, b, c, col);
  }

  // A lid just under the canopy, so no camera angle sees down into the shell.
  // It is the garden's floor where a gap between two crowns lets it show, so
  // it is grass in the wood's own shade rather than bare earth: the leaf
  // ramp's bottom two tones, which is what the undersides of the crowns just
  // above it are painted in.
  const lid = { x: 0, y: 0.02, z: 0 };
  for (let j = 0; j < rim.length; j++) {
    const k = (j + 1) % rim.length;
    const col = leafShadow.clone().lerp(leafDeep, 0.55);
    pushTri({ ...rim[k], y: 0.02 }, { ...rim[j], y: 0.02 }, lid, col);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  // Double sided, so a facet cannot go missing whichever way its triangle
  // happens to be wound - and three.js turns the normal to face the camera on
  // a double-sided surface, so every facet is lit as the facet it is.
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

// The bearing the gardener walks out along.
//
// **The bearing is chosen to suit the wood; the wood is not cleared to suit
// the bearing.** She used to have a corridor culled through the canopy along
// bearing 0.15, which is why she was never hidden: a lane was held open
// through the trees with her standing in it. With that lane filled in, the
// wood is a closed canopy - the crowns are dealt out to 0.98 of the island's
// radius and carry another 0.2 to 0.7 of a metre of leaf past that, so at
// every bearing the wood reaches over the rim and there is nowhere on the
// island a figure 0.41 of a metre tall can stand and be seen through it.
//
// Nowhere but a few chance gaps between one crown and the next, and those
// cannot be found on paper: a crown is a lump displaced up to 43 hundredths
// of its own radius, so a ball drawn round it is wrong by more than the gaps
// are wide. They were found by measurement instead - the banner rendered with
// her and again without her, and the pixels that differ counted, at twelve
// bearings round the side the camera sees. At bearing 0.20, where she used to
// stand, not one pixel of her survives the wood. The best window by a wide
// margin is the buttress at 1.72: there she keeps about seven tenths of the
// 35 by 48 pixels she covers, and it holds through the whole of the island's
// slow turn and bob.
//
// Two things make the buttress the window. The rim reaches 0.17 of a metre
// further out there than either side of it, and the crowns are dealt on the
// radius rather than on the rim, so they do not follow it out. And it is the
// closest ground on the island to the camera, which draws her a quarter
// larger than anywhere else - and at her size that decides whether she is a
// figure or a speck.
//
// **If the wood is ever dealt differently, this has to be measured again.**
const GARDENER_THETA = 1.72;
function gardenerSpot() {
  const r = rimRadius(GARDENER_THETA);
  return { x: Math.cos(GARDENER_THETA) * r, z: Math.sin(GARDENER_THETA) * r };
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
  // over the summit, spires standing out of both, and a few crowns leaning
  // right out over the drop.
  const masses = [];
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

  // The willows, whose leaf falls past the rim and down the stone. Their
  // heads join the wood here and their fronds go into the same mesh; only
  // their trunks and boughs are a mesh of their own, being bark.
  //
  // **This is done after the wood is dealt and not before it.** The lay of
  // the crowns is what hides the gardener, and it was measured; drawing so
  // much as one number from `rand` earlier than this deals the whole wood
  // differently and she is lost.
  const willowBark = buildWillows(masses, positions, colors);

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
      return { x: Math.cos(theta) * r, y: heights[k], z: Math.sin(theta) * r };
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
  group.add(willowBark);
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

// ---- The willows over the rim ----
//
// The wood ended and the stone began at very nearly one height the whole way
// round, and a boundary like that reads as a lid laid on a plinth however
// ragged either side of it is made. Measured on the render, half of the rim
// sat within a twentieth of a metre of a single height and three quarters of
// it within a fifth of a metre. Leaning a crown further out does not help,
// because a crown that leans still ends where the rim does; what breaks the
// line is green at SEVERAL DIFFERENT heights against the rock, and that is
// what these four trees are for.
//
// Four things decide whether such a tree reads as a willow or as a bush
// thrown over the edge.
//
// **The hanging mass tapers and thins downward.** A frond is a chain of leaf
// clumps that shrink from about a tenth of a metre where it leaves the bough
// to a thirtieth at its tip. Heaviest at the top and lightest at the bottom
// is what a willow is; a sphere pushed below the rim is not one. The curtain
// thins as well as tapering, because the fronds are dealt lengths from four
// tenths to a whole one of the tree's drop - so a few reach the bottom and
// most of them stop well short, and the hem is ragged rather than cut.
//
// **It is attached.** Each willow stands on a trunk in the garden, carries a
// head of leaf in the wood's own ramp, and throws three boughs out over the
// lip; the fronds hang from the outer third of those boughs and from their
// tips. Without a bough in sight a drooping crown is exactly the bush
// floating in the air on a stick that the note on the overhanging crowns
// above warns against.
//
// **It hangs against the stone.** Over the first third of a metre of its fall
// a frond swings in from the bough tip to the face and then follows the face
// down, the radius solved off stoneHang, so it reads as overhanging the cut
// rather than levitating beside it.
//
// **They are few and uneven.** Four of them, falling 0.40, 0.65, 1.05 and
// 1.15 of a metre - four different heights, none of them the rim's - with
// long stretches of clean rock between (see WILLOWS). The two bare gaps the
// canopy keeps in its fringe stay gaps: no willow reaches into either.
function buildWillows(masses, positions, colors) {
  const barkPositions = [];
  const barkColors = [];
  const light = colour(Palette.barkLight);
  const mid = colour(Palette.barkMid);
  const dark = colour(Palette.barkDark);

  const pol = (t, r, y) => [Math.cos(t) * r, y, Math.sin(t) * r];
  const bez = (a, b, c, s) => {
    const k = 1 - s;
    return [0, 1, 2].map((i) => k * k * a[i] + 2 * k * s * b[i] + s * s * c[i]);
  };
  const pushBark = (a, b, c, col) => {
    barkPositions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) barkColors.push(col.r, col.g, col.b);
  };
  // A limb swept along a path. The ring has to be square to the limb rather
  // than level: a bough here is nearly horizontal, and a level ring round a
  // horizontal limb collapses to a line.
  const sweep = (path, wide) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      for (let k = 0; k < 3; k++) d[k] /= dl;
      const up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const n1 = [d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0]];
      const n1l = Math.hypot(n1[0], n1[1], n1[2]) || 1;
      for (let k = 0; k < 3; k++) n1[k] /= n1l;
      const n2 = [d[1] * n1[2] - d[2] * n1[1], d[2] * n1[0] - d[0] * n1[2], d[0] * n1[1] - d[1] * n1[0]];
      const ring = (ang, at, w) => [0, 1, 2].map((k) => at[k] + (Math.cos(ang) * n1[k] + Math.sin(ang) * n2[k]) * w);
      const sides = 5;
      for (let s = 0; s < sides; s++) {
        const p = (s / sides) * Math.PI * 2;
        const q = ((s + 1) / sides) * Math.PI * 2;
        // Turned to the light like the trunks and the rock are.
        const face = mid.clone().lerp(Math.cos(p + 0.6) > 0 ? light : dark, 0.4);
        pushBark(ring(p, a, wide[i]), ring(q, a, wide[i]), ring(q, b, wide[i + 1]), face);
        pushBark(ring(p, a, wide[i]), ring(q, b, wide[i + 1]), ring(p, b, wide[i + 1]), face);
      }
    }
  };

  const bead = new THREE.IcosahedronGeometry(1, 0);
  const beadPos = bead.getAttribute('position');
  const vertex = new THREE.Vector3();

  // Where along a bough the fronds hang, and how the boughs are thrown. `off`
  // is across the tree's span, `out` how far past the rim the tip reaches,
  // `tip` the height it ends at and `reach` how much of the tree's full drop
  // the longest frond on it takes.
  // The boughs have to come out past the wood's own edge, or they are never
  // seen: the crowns already carry from a fifth to seven tenths of a metre of
  // leaf beyond the rim, and a bough that stops short of that is buried in
  // them and the fronds appear to hang off nothing.
  const ARMS = [
    { off: -0.46, out: 0.13, tip: 0.06, reach: 0.66 },
    { off: 0.09, out: 0.22, tip: -0.03, reach: 1.0 },
    { off: 0.52, out: 0.11, tip: 0.02, reach: 0.80 },
  ];
  // Where along a bough the fronds hang: on its outer part only, past the
  // lip, so a frond falls down the open face of the stone rather than through
  // the garden it stands in.
  const STATIONS = [0.64, 0.82, 1.0];

  for (const tree of WILLOWS) {
    const rim = rimRadius(tree.at);
    const foot = pol(tree.at, rim * 0.84, -0.03);
    const crotch = pol(tree.at, rim * 0.90, 0.30);
    sweep([foot, crotch], [0.08, 0.052]);
    // The head of leaf, in the canopy's own mesh and its own ramp, so a willow
    // is a tree in this wood rather than a thing added beside it.
    //
    // It stands up in the wood rather than out over the lip. A head set low
    // at the edge is one more crown leaning over the drop, which the wood
    // already has eight of; what is wanted here is a tree of the wood whose
    // boughs go out over it. Where the wood's edge falls is not affected
    // either way - measured, moving this head in and up changed 3575 pixels
    // of the picture and not one column of the boundary.
    const head = pol(tree.at, rim * 0.87, 0.56);
    masses.push({
      x: head[0],
      z: head[2],
      r: 0.22 + dealt(tree.seed) * 0.05,
      kind: 'broad',
      y: head[1],
      seed: tree.seed,
    });

    for (let a = 0; a < ARMS.length; a++) {
      const arm = ARMS[a];
      const armAt = tree.at + arm.off * tree.span;
      const p1 = pol(tree.at + arm.off * tree.span * 0.5, rimRadius(tree.at + arm.off * tree.span * 0.5) * 0.97, 0.34);
      const p2 = pol(armAt, rimRadius(armAt) * (1 + arm.out), arm.tip);
      const path = [];
      const wide = [];
      for (let i = 0; i <= 5; i++) {
        path.push(bez(crotch, p1, p2, i / 5));
        wide.push(0.048 - 0.030 * (i / 5));
      }
      sweep(path, wide);

      for (let f = 0; f < STATIONS.length; f++) {
        const s = STATIONS[f];
        const hang = bez(crotch, p1, p2, s);
        const at = Math.atan2(hang[2], hang[0]);
        const outAt = Math.hypot(hang[0], hang[2]);
        const salt = tree.seed + a * 97 + f * 31;
        // How far this one falls. The spread is wide on purpose: fronds all
        // of a length give the curtain a hem, which is another level line.
        const fall = tree.drop * arm.reach * (0.40 + 0.60 * s) * (0.70 + 0.55 * dealt(salt));
        const turn = dealt(salt + 7) * 20;
        // The step down the frond is the size of the clump it just placed, so
        // the strand stays closed the whole way down and thins by its clumps
        // getting finer rather than by breaking into separate beads. A chain
        // of beads at a fixed step is a string of peas, not a willow.
        for (let i = 0, fallen = 0; fallen < fall; i++) {
          const v = clamp01(fallen / fall);
          const y = hang[1] - fallen;
          const deep = Math.max(-y, 0);
          // In against the face over the first third of a metre of the fall,
          // and down the face after that.
          const swing = clamp01(deep / 0.35);
          const r = outAt + (faceRadius(at, deep) - outAt) * swing;
          const size = (0.095 - 0.066 * Math.pow(v, 0.75)) * (0.8 + 0.4 * dealt(salt + i * 29 + 5));
          // The clumps close up as they go down, so the strand does not end in
          // a bead on its own with daylight above it.
          fallen += size * (1.25 - 0.35 * v);
          // A slow sway across the face as it falls, and a shake per clump.
          const drift = at + (dealt(salt + 3) - 0.5) * 0.12 * v + (dealt(salt + i * 13) - 0.5) * 0.05;
          const cx = Math.cos(drift) * r;
          const cz = Math.sin(drift) * r;
          // Each clump is a flattened lozenge lying against the stone -
          // half again as wide across the face as it is deep into it, and
          // drawn out downward. A round clump makes the strand a rope of
          // beads; leaf hanging against a cut lies flat on it.
          const tallness = 1.25;
          // Each clump is turned its own way about the strand. Without this
          // every clump is the same solid at the same angle and a frond comes
          // out as a stack of cones in register - a fir cone, not a willow.
          const spin = dealt(salt + i * 41 + 17) * Math.PI * 2;
          const cs = Math.cos(spin);
          const sn = Math.sin(spin);
          const across = [-Math.sin(drift), 0, Math.cos(drift)];
          const into = [Math.cos(drift), 0, Math.sin(drift)];
          const base = y - size * tallness;
          const span = Math.max(size * tallness * 2, 0.05);
          for (let t = 0; t < beadPos.count; t++) {
            vertex.fromBufferAttribute(beadPos, t).normalize();
            const wide = (vertex.x * cs - vertex.z * sn) * size * 1.5;
            const deepIn = (vertex.x * sn + vertex.z * cs) * size * 0.75;
            const px = cx + across[0] * wide + into[0] * deepIn;
            const py = y + vertex.y * size * tallness;
            const pz = cz + across[2] * wide + into[2] * deepIn;
            positions.push(px, py, pz);
            // The ramp is read on the bead's own body, as a crown's is, and
            // then carried up it: the curtain is in the head's shade where it
            // leaves the bough and in open light at its tips.
            const rise = 0.55 * clamp01((py - base) / span) + 0.45 * (0.28 + 0.55 * v);
            const col = leafColour(rise, leafGrain(px, py, pz, turn));
            colors.push(col.r, col.g, col.b);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(barkPositions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(barkColors, 3));
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
  // The porthole she looks out of, at the game's own proportions of the head:
  // the glass is 0.393 of the head's radius across and 0.083 of it thick, and
  // stands 0.028 of it proud of the face (radius 0.057, thickness 0.012, at
  // bellRadius + 0.004 on a head of 0.145, Render/GardenerNode.swift). It
  // carries the same lamp behind it, which burns whether she is working or
  // not - and that glow is most of what registers, because the whole circle
  // is ten pixels across on a 1600-wide banner.
  //
  // **Its height is the banner's, not the game's.** The game hangs it 0.172 of
  // the head's radius BELOW the middle, to keep it under the overhang of the
  // helmet's cap, because that camera looks down at fifty-six degrees. This
  // camera looks UP at her by about eleven degrees, where the danger is the
  // collar and not the cap: at the game's height a fifth of the circle is
  // swallowed by the collar's near rim and she reads as having half a lamp.
  // The disc's lower edge is therefore set on that rim, at 0.090 above the
  // collar's top, and the whole circle is on the face of the head.
  const porthole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.090, 0.090, 0.019, 10),
    new THREE.MeshLambertMaterial({
      color: colour(Palette.portholeGlass),
      emissive: colour(Palette.portholeLamp),
      flatShading: true,
    })
  );
  porthole.position.set(0, 0.760, 0.236);
  porthole.rotation.x = Math.PI / 2;
  group.add(porthole);

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

// Her routine: a long wait in among the trees, then out to the rim, a look
// over the drop, and back into the wood.
//
// **Both ends of the walk are on the island, and that is the whole of the
// point.** She used to be sent out to 1.14 of the rim - fourteen hundredths
// of the island's own radius past its edge - and lifted another 0.09 on top
// of that, to silhouette her against the sky rather than lose her behind the
// leaves. It bought a silhouette and it cost the ground under her feet: she
// stood in mid air with cloud behind her ankles. She now walks from 0.45 of
// the rim to 0.92 of it, and 0.92 of the rim on the buttress leaves 0.15 of a
// metre of turf beyond her against 0.12 to the worst corner of her tracks, so
// no part of her passes the edge at any moment of the loop.
//
// **Hidden is the normal state and coming out is the event.** The old loop
// had her out or walking for nine seconds in every sixteen, which is most of
// the time, and she was never hidden even for the other seven because of the
// lane cut through the wood. The loop is thirty seconds now and she is in
// among the trees for twenty-one and a half of them - a little over seven
// tenths - so a visitor watching the banner sees the wood, and then after a
// while sees the gardener come out of it. At the near end of the walk she is
// measured invisible: not one pixel of her differs from the same frame
// rendered without her.
const ROUTINE = { kIn: 0.45, kOut: 0.92, period: 30, out: 20, outDone: 22.5, back: 26, backDone: 28.5 };

function gardenerPose(t) {
  const p = ((t % ROUTINE.period) + ROUTINE.period) % ROUTINE.period;
  const ease = (a, b) => smoothstep(0, 1, (p - a) / (b - a));
  let k = ROUTINE.kIn;
  let walking = false;
  if (p >= ROUTINE.out && p < ROUTINE.outDone) {
    k = ROUTINE.kIn + (ROUTINE.kOut - ROUTINE.kIn) * ease(ROUTINE.out, ROUTINE.outDone);
    walking = true;
  } else if (p >= ROUTINE.outDone && p < ROUTINE.back) {
    k = ROUTINE.kOut;
  } else if (p >= ROUTINE.back && p < ROUTINE.backDone) {
    k = ROUTINE.kOut - (ROUTINE.kOut - ROUTINE.kIn) * ease(ROUTINE.back, ROUTINE.backDone);
    walking = true;
  }
  return { k, walking };
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
  // Started in the middle of her look over the drop, so the first frame -
  // and the only frame, for a visitor who has asked for no motion - has the
  // gardener standing still on the turf at the rim, which is the one moment
  // of the loop that makes a picture on its own. Every other still of her is
  // either a walk stopped halfway or a wood with nobody in it.
  let elapsed = 24;

  const spot = gardenerSpot();
  // **She faces the viewer, and keeps facing him the whole way out and the
  // whole way back** (Damian, 2026-08-30). She used to face out along her own
  // walk and turn right around to come home, which showed the camera her back
  // for the return.
  //
  // The angle is worked out rather than dialled in. The camera stands at
  // (0, 0, 8.24) and she walks between (0.73, 0.78) and (0.60, 1.58), so the
  // line from her to the camera lies 5.1 to 5.6 degrees to the left of
  // straight out of the picture; the island's own tilt shortens that on her
  // turntable to between 4.8 and 5.2 degrees. One angle covers the whole walk
  // to within four tenths of a degree, so she is given the middle of it:
  // 0.09 of a radian, 5.2 degrees, turned toward the middle of the picture.
  // Her porthole then looks straight down the lens wherever she is standing.
  const facing = -0.09;

  const step = () => {
    elapsed += clock.getDelta();
    const t = elapsed;
    island.position.y = ISLAND.shoulderY + ISLAND.bobAmp * Math.sin(t * ISLAND.bobRate);
    island.rotation.y = 0.025 * Math.sin(t * 0.15);
    const pose = gardenerPose(t);
    // The garden's floor is flat, so she keeps the one height throughout.
    gardener.position.set(spot.x * pose.k, 0, spot.z * pose.k);
    gardener.rotation.y = facing;
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
