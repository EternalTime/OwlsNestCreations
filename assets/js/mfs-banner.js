// My Favorite Spacetimes home-page banner: the application's own ground, with
// a two-body system standing on it.
//
// The ground is not invented. It is the captain's grid off
// `damiansowinski.com/MFS` - a lattice of straight lines twenty pixels apart,
// each carrying a quarter-pixel travelling sine - and every number in it is
// either from the second inline script of `~/MyWebPage/_layouts/mfs.html` or
// from the application's port of it, `GridBackground.swift`. The light pools
// are `Luminance.swift`.
//
// What bends that ground is a star and a gas giant in a bound Newtonian orbit,
// and nothing else does: no element on the page is a source. Each body carries
// the application's own well, `GridBackground.Dimple`, and the wells add, so
// the pair digs one landscape between them rather than two that argue.
//
// The sheets of glass standing on it weigh nothing and dig nothing. What they
// do to the ground is refract it at their rims, `GridBackground.Lens`, which is
// a fact about what a pane is made of rather than about what it weighs. It has
// to be drawn into the canvas because Apple's material composites outside the
// drawing pass, so a pane that does not carry the ground round its own rim is a
// pane with no refraction at all.
//
// It is one 2D canvas. There is no WebGL half to wait for, so unlike the
// VoidFlux and Verdant banners this module is the whole picture.

import { Palette, rgba } from './mfs-palette.js';
import {
  MASS_REACH,
  displacement,
  makePair,
  orbitFrom,
  placeBodies,
} from './mfs-orbit.js';

// ---- the website's numbers ----

const BASE_AMPLITUDE = 0.25;
// The website advances its clock 0.055 radians a frame at sixty frames a
// second. Kept per second here so a slow frame does not slow the drift.
const BASE_SPEED = 0.055 * 60;
const WAVE_ALONG_LINE = 80;
const WAVE_ACROSS_LINES = 120;
const SPACING = 20;
const LINE_WIDTH = 2;
const LINE_OPACITY = 0.28;
// The website's own glow arithmetic at rest, with its flicker taken out: the
// resting opacity, lifted off the floor the flicker could drop to, over the
// whole range it could cover, times the eighteen pixels it blooms at full.
const BLOOM_RADIUS = ((0.28 - 0.1) / (0.28 + 1.2 - 0.1)) * 18;
// The bloom is a second, wider, fainter stroke rather than a canvas shadow.
// A shadow is an offscreen blur of the whole banner every frame, and the
// application measured that one call as costing more than all the rest of the
// ground put together.
const BLOOM_STRENGTH = 0.28;

// ---- the two bodies ----

// Where they are and how deeply each digs is `mfs-orbit.js`; this is only what
// they look like.

// The star: a white core in a teal halo, drawn additively, so it is the one
// thing in the banner that makes its own light.
const STAR_CORE = 8;
const STAR_HALO = 54;
// The gas giant: a lit disc, banded, about the size of the star's core and
// nowhere near its brightness.
const PLANET_RADIUS = 9;
// Where its bands begin and end, as a share of the disc from pole to pole. A
// wide belt either side of the equator and narrower ones away from it, which is
// what makes a banded planet read as one rather than as a striped ball.
const PLANET_BANDS = [
  [-0.86, -0.58],
  [-0.4, -0.12],
  [0.06, 0.46],
  [0.62, 0.82],
];

// ---- a sheet of glass ----

// A pane is thick at the rim and flat in the middle, so the ground is carried
// outward hardest half way through the rim's curve, not at all where the sheet
// has gone flat, and not at all at the very rim.
const BEVEL = 28;
const REFRACTION = 11;

// ---- how finely any of it is drawn ----

const REFRESH_INTERVAL = 1 / 30;
const SAMPLE_LENGTH = 4;
const COARSE_SAMPLE_LENGTH = SPACING;
const OVERHANG_LINES = 3;
const MAX_DPR = 2;

// The light in the room: a few broad pools drifting far more slowly than the
// grid, so the two never read as one moving thing. Their pairs of periods are
// deliberately in no small whole ratio, so the light never comes back to where
// it was and never reads as a loop.
const POOLS = [
  {
    tone: Palette.tealLight,
    strength: 0.2,
    reach: 0.62,
    home: [0.18, 0.24],
    wander: [0.16, 0.18],
    seconds: [73, 97],
  },
  {
    tone: Palette.cyan,
    strength: 0.14,
    reach: 0.55,
    home: [0.84, 0.7],
    wander: [0.18, 0.14],
    seconds: [89, 61],
  },
  {
    tone: Palette.pinkDark,
    strength: 0.11,
    reach: 0.42,
    home: [0.62, 0.12],
    wander: [0.22, 0.2],
    seconds: [113, 79],
  },
];

// ---- the panes standing on that ground ----

// Every pane of glass in the banner, in the banner's own pixels, with the corner
// the ground has to bend round read off the element rather than written here a
// second time. A sheet the narrow layout has taken away has no box, and nothing
// with no box is a pane.
function readPanes(banner) {
  const frame = banner.getBoundingClientRect();
  const panes = [];
  for (const el of banner.querySelectorAll('[data-mfs-pane]')) {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const left = box.left - frame.left;
    const top = box.top - frame.top;
    panes.push({
      left,
      top,
      right: box.right - frame.left,
      bottom: box.bottom - frame.top,
      midX: left + box.width / 2,
      midY: top + box.height / 2,
      width: box.width,
      height: box.height,
      cornerRadius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0,
    });
  }
  return panes;
}

// The ground as one pane bends it: carried straight out of the nearest rim,
// hardest half way through the rim's curve, and not at all once the sheet has
// gone flat. How far in from the rim a point is is worked out in the quadrant it
// stands in, which is what makes a corner round rather than square.
function lensBend(lens, x, y, out) {
  const halfWidth = lens.width / 2;
  const halfHeight = lens.height / 2;
  const radius = Math.min(lens.cornerRadius, Math.min(halfWidth, halfHeight));
  const acrossFromMiddle = x - lens.midX;
  const downFromMiddle = y - lens.midY;
  const cornerX = Math.abs(acrossFromMiddle) - (halfWidth - radius);
  const cornerY = Math.abs(downFromMiddle) - (halfHeight - radius);
  const inACorner = cornerX > 0 && cornerY > 0;
  const outOfCorner = inACorner
    ? Math.hypot(cornerX, cornerY)
    : Math.max(cornerX, cornerY);
  const depth = radius - outOfCorner;
  if (depth <= 0 || depth >= BEVEL) return false;

  let acrossOut;
  let downOut;
  if (inACorner && outOfCorner > 0) {
    acrossOut = cornerX / outOfCorner;
    downOut = cornerY / outOfCorner;
  } else if (cornerX > cornerY) {
    acrossOut = 1;
    downOut = 0;
  } else {
    acrossOut = 0;
    downOut = 1;
  }
  if (acrossFromMiddle < 0) acrossOut = -acrossOut;
  if (downFromMiddle < 0) downOut = -downOut;

  const carried = Math.min(
    REFRACTION * Math.sin((Math.PI * depth) / BEVEL),
    depth * 0.9
  );
  out.dx = acrossOut * carried;
  out.dy = downOut * carried;
  return true;
}

const lensScratch = { dx: 0, dy: 0 };
const lensCarried = { dx: 0, dy: 0 };

// How far the panes together carry the ground. The deepest rim wins rather than
// the bends adding up, which is the website's own rule for its panels, "max
// displacement from all panels (no superposition)". The wells add and these do
// not, and the difference is not an inconsistency: two masses make one
// landscape, two sheets of glass over one place are still two sheets.
function refraction(x, y, panes) {
  lensCarried.dx = 0;
  lensCarried.dy = 0;
  let deepest = 0;
  for (const lens of panes) {
    if (!lensBend(lens, x, y, lensScratch)) continue;
    const size = lensScratch.dx * lensScratch.dx + lensScratch.dy * lensScratch.dy;
    if (size > deepest) {
      deepest = size;
      lensCarried.dx = lensScratch.dx;
      lensCarried.dy = lensScratch.dy;
    }
  }
  return lensCarried;
}

// ---- the ground the bodies bend ----

// How far to the next piece of a line: finely across either well and across
// every pane's rim, and coarsely everywhere else.
//
// Only the middle of a well needs the fine sampling, where the pull turns over
// and changes direction. How far a straight piece falls short of the curve it
// is crossing scales with the depth of the well, and both wells are now deep
// enough to chord away visibly at the coarse length. Away from both, a line is
// a sine five hundred pixels long that a piece as long as the grid is wide
// falls short of by two thousandths of a pixel.
function stepAt(x, y, pair, panes) {
  const slack = COARSE_SAMPLE_LENGTH;
  const core = MASS_REACH + slack;
  const heavy = pair.heavy;
  if (Math.abs(x - heavy.x) <= core && Math.abs(y - heavy.y) <= core) return SAMPLE_LENGTH;
  const light = pair.light;
  if (Math.abs(x - light.x) <= core && Math.abs(y - light.y) <= core) return SAMPLE_LENGTH;
  // A rim turns over inside twenty-eight pixels, so a line crossing one has to
  // be sampled finely or the bend is chorded away. Each pane is widened by one
  // coarse piece, so a step never lands inside one without the step before it
  // having seen it coming.
  for (const lens of panes) {
    if (
      x >= lens.left - slack &&
      x <= lens.right + slack &&
      y >= lens.top - slack &&
      y <= lens.bottom + slack
    ) {
      return SAMPLE_LENGTH;
    }
  }
  return COARSE_SAMPLE_LENGTH;
}

// The whole field: every line is its straight line with the travelling sine
// added to it, the two wells drawing it in and the rims it passes under
// carrying it out, and nothing anywhere is drawn in front of a flat grid.
//
// It runs three lattice spacings past every edge, so a line near an edge has
// neighbours out there to be stretched against and a body passing close to one
// does not go wrong in the corners. Nothing moves inward for it: the visible
// grid still meets all four edges exactly.
function field(w, h, phase, pair, panes) {
  const path = new Path2D();
  const overhang = OVERHANG_LINES * SPACING;
  const left = -overhang;
  const top = -overhang;
  const right = w + overhang;
  const bottom = h + overhang;

  for (let down = top; down < bottom + SPACING; down += SPACING) {
    let across = left;
    let started = false;
    for (;;) {
      const push = displacement(across, down, pair);
      const bend = refraction(across, down, panes);
      const wave =
        BASE_AMPLITUDE *
        Math.sin(across / WAVE_ALONG_LINE + down / WAVE_ACROSS_LINES + phase);
      const x = across + push.dx + bend.dx;
      const y = down + wave + push.dy + bend.dy;
      if (started) path.lineTo(x, y);
      else {
        path.moveTo(x, y);
        started = true;
      }
      if (across >= right) break;
      across = Math.min(across + stepAt(across, down, pair, panes), right);
    }
  }

  for (let side = left; side < right + SPACING; side += SPACING) {
    let along = top;
    let started = false;
    for (;;) {
      const push = displacement(side, along, pair);
      const bend = refraction(side, along, panes);
      const wave =
        BASE_AMPLITUDE *
        Math.sin(along / WAVE_ALONG_LINE + side / WAVE_ACROSS_LINES + phase);
      const x = side + wave + push.dx + bend.dx;
      const y = along + push.dy + bend.dy;
      if (started) path.lineTo(x, y);
      else {
        path.moveTo(x, y);
        started = true;
      }
      if (along >= bottom) break;
      along = Math.min(along + stepAt(side, along, pair, panes), bottom);
    }
  }

  return path;
}

// Light adds to light, so the pools are drawn on top of one another rather than
// over one another. Two overlapping pools make a brighter place, which is what
// a room with two lamps in it does.
function drawLuminance(ctx, w, h, seconds) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const longer = Math.max(w, h);
  for (const pool of POOLS) {
    const across = Math.sin((2 * Math.PI * seconds) / pool.seconds[0]);
    const down = Math.cos((2 * Math.PI * seconds) / pool.seconds[1]);
    const x = (pool.home[0] + pool.wander[0] * across) * w;
    const y = (pool.home[1] + pool.wander[1] * down) * h;
    const radius = pool.reach * longer;
    const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, rgba(pool.tone, pool.strength));
    light.addColorStop(1, rgba(pool.tone, 0));
    ctx.fillStyle = light;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

// The star, which is the only thing here that is lit from inside: a white core
// through the palette's own teal and out to nothing, added to what is under it
// so the grid reads through its outskirts.
function drawStar(ctx, body) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const light = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, STAR_HALO);
  light.addColorStop(0, rgba(Palette.bright, 1));
  light.addColorStop((STAR_CORE * 0.6) / STAR_HALO, rgba(Palette.bright, 0.85));
  light.addColorStop(STAR_CORE / STAR_HALO, rgba(Palette.tealLight, 0.55));
  light.addColorStop(0.34, rgba(Palette.tealLight, 0.16));
  light.addColorStop(1, rgba(Palette.cyan, 0));
  ctx.fillStyle = light;
  ctx.fillRect(
    body.x - STAR_HALO,
    body.y - STAR_HALO,
    STAR_HALO * 2,
    STAR_HALO * 2
  );
  ctx.restore();
}

// The gas giant, which makes no light of its own. It is a banded disc with a
// terminator across it, and the terminator is worked out from where the star
// actually is, so the lit side turns with the orbit.
function drawPlanet(ctx, body, star) {
  const towardsX = star.x - body.x;
  const towardsY = star.y - body.y;
  const away = Math.hypot(towardsX, towardsY) || 1;
  const litX = towardsX / away;
  const litY = towardsY / away;

  ctx.save();
  ctx.beginPath();
  ctx.arc(body.x, body.y, PLANET_RADIUS, 0, 2 * Math.PI);
  ctx.clip();

  // A dark ball first, so every band is a lightening of it and the gaps between
  // the bands are the ball itself showing through.
  ctx.fillStyle = rgba(Palette.panel, 0.96);
  ctx.fill();

  ctx.fillStyle = rgba(Palette.dim, 0.72);
  for (const [from, to] of PLANET_BANDS) {
    ctx.fillRect(
      body.x - PLANET_RADIUS,
      body.y + from * PLANET_RADIUS,
      PLANET_RADIUS * 2,
      (to - from) * PLANET_RADIUS
    );
  }

  // Daylight, which falls on the bands and on the ball between them alike and
  // so keeps the banding a shading rather than a set of stripes.
  const day = ctx.createLinearGradient(
    body.x + litX * PLANET_RADIUS,
    body.y + litY * PLANET_RADIUS,
    body.x - litX * PLANET_RADIUS,
    body.y - litY * PLANET_RADIUS
  );
  day.addColorStop(0, rgba(Palette.mid, 0.5));
  day.addColorStop(0.6, rgba(Palette.mid, 0.06));
  day.addColorStop(1, rgba(Palette.mid, 0));
  ctx.fillStyle = day;
  ctx.fill();

  // Day into night, along the line to the star.
  const shade = ctx.createLinearGradient(
    body.x + litX * PLANET_RADIUS,
    body.y + litY * PLANET_RADIUS,
    body.x - litX * PLANET_RADIUS,
    body.y - litY * PLANET_RADIUS
  );
  shade.addColorStop(0, rgba(Palette.void, 0));
  shade.addColorStop(0.45, rgba(Palette.void, 0.35));
  shade.addColorStop(1, rgba(Palette.void, 0.92));
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.restore();
}

function drawGround(ctx, w, h, seconds, phase, pair, panes) {
  ctx.clearRect(0, 0, w, h);
  drawLuminance(ctx, w, h, seconds);

  const lines = field(w, h, phase, pair, panes);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = rgba(Palette.tealDark, LINE_OPACITY * BLOOM_STRENGTH);
  ctx.lineWidth = LINE_WIDTH + BLOOM_RADIUS;
  ctx.stroke(lines);

  // The website's own gradient across the whole frame: the quiet teal at the
  // top left running to the pink at the bottom right.
  const run = ctx.createLinearGradient(0, 0, w, h);
  run.addColorStop(0, rgba(Palette.tealDark, LINE_OPACITY));
  run.addColorStop(1, rgba(Palette.pinkDark, LINE_OPACITY));
  ctx.strokeStyle = run;
  ctx.lineWidth = LINE_WIDTH;
  ctx.stroke(lines);

  // The bodies stand on the ground they are bending, so they are drawn last.
  drawPlanet(ctx, pair.light, pair.heavy);
  drawStar(ctx, pair.heavy);
}

function init(banner) {
  const canvas = banner.querySelector('.mfs-grid');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');

  const pair = makePair();
  let orbit = null;
  let panes = [];
  let pixels = { w: 0, h: 0, dpr: 0 };
  let frame = 0;
  let visible = false;
  let began = 0;
  let painted = 0;

  function resize() {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (w === 0 || h === 0) return false;
    orbit = orbitFrom(banner, w, h);
    panes = readPanes(banner);
    if (w === pixels.w && h === pixels.h && dpr === pixels.dpr) return true;
    pixels = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  // Reduced motion: the ground at rest, with the pair parked where the clock
  // starts. Nothing in this banner pulses, strobes or flashes even while it is
  // moving - the website's flicker is deliberately not ported - so at rest it is
  // simply the same picture holding still.
  function drawStill() {
    if (pixels.w === 0 || !orbit) return;
    drawGround(ctx, pixels.w, pixels.h, 0, 0, placeBodies(orbit, 0, pair), panes);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const seconds = now / 1000;
    if (began === 0) began = seconds;
    if (seconds - painted < REFRESH_INTERVAL) return;
    painted = seconds;
    if (pixels.w === 0 || !orbit) return;
    drawGround(
      ctx,
      pixels.w,
      pixels.h,
      seconds,
      seconds * BASE_SPEED,
      placeBodies(orbit, seconds - began, pair),
      panes
    );
  }

  function sync() {
    if (visible && !still.matches) {
      if (frame === 0) frame = requestAnimationFrame(tick);
      return;
    }
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    if (still.matches) drawStill();
  }

  // The observer delivers an initial observation of its own, which is where the
  // canvas first gets its pixels and the orbit is first laid out.
  new ResizeObserver(() => {
    if (resize() && frame === 0 && still.matches) drawStill();
  }).observe(banner);

  // The ground is redrawn thirty times a second, so it runs only while the
  // banner is on screen. Until then the field is the application's own
  // near-black ground and nothing else, which is what the application shows
  // behind everything anyway.
  new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      sync();
    },
    { rootMargin: '400px' }
  ).observe(banner);

  still.addEventListener('change', sync);
}

document.querySelectorAll('[data-mfs-banner]').forEach(init);
