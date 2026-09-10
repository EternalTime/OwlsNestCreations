// My Favorite Spacetimes home-page banner: the application's own ground, with
// the application's own furniture standing on it.
//
// Nothing here is invented. The ground is the captain's grid off
// `damiansowinski.com/MFS` - a lattice of straight lines twenty pixels apart,
// each carrying a quarter-pixel travelling sine, pinched by whatever stands
// over it - and every number is either from the second inline script of
// `~/MyWebPage/_layouts/mfs.html` or from the application's port of it,
// `GridBackground.swift`. The light pools are `Luminance.swift`, the heights
// are `Depth.swift`, and the refraction at each rim is `GridBackground.Lens`.
//
// The sheets of glass are real elements, and the grid reads their rectangles
// through `getBoundingClientRect` the way the website reads its title and its
// exit sign. So the ground is bent before the glass over it ever blurs it,
// which is the whole of how the application draws refraction: Apple's material
// composites outside the drawing pass, so the bending is drawn rather than
// asked for.
//
// It is one 2D canvas. There is no WebGL half to wait for, so unlike the
// VoidFlux and Verdant banners this module is the whole picture.

import { Palette, rgba } from './mfs-palette.js';

// ---- the website's numbers ----

const BASE_AMPLITUDE = 0.25;
// The website advances its clock 0.055 radians a frame at sixty frames a
// second. Kept per second here so a slow frame does not slow the drift.
const BASE_SPEED = 0.055 * 60;
const WAVE_ALONG_LINE = 80;
const WAVE_ACROSS_LINES = 120;
const SPACING = 20;
const LINE_WIDTH = 2;
const SIGMA_ACROSS = 10;
const SIGMA_DOWN = 20;
const RAMP_SECONDS = 1;
const STAGGER_SECONDS = 0.1;
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

// ---- the mass the pointer drags ----

const MASS_PULL = 26;
const MASS_REACH = 110;
const MASS_STIFFNESS = 90;
const MASS_DAMPING = 14;

// ---- a sheet as glass rather than as weight ----

const BEVEL = 28;
const REFRACTION = 11;

// ---- how finely any of it is drawn ----

const REFRESH_INTERVAL = 1 / 30;
const SAMPLE_LENGTH = 4;
const COARSE_SAMPLE_LENGTH = SPACING;
const OVERHANG_LINES = 3;
const MAX_DPR = 2;

// How far off the ground a sheet floats, in pixels, which is also how far it
// lifts the grid beneath it (`Depth.swift`).
const DEPTH = { panel: 12, floating: 28, forward: 48 };

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

// The vertical taper: a sheet's push strengthens down through it.
function lambda(down) {
  return 0.95 + 0.1 * down;
}

// A plateau of one across the sheet with a soft edge either side of it, in the
// sheet's own coordinates where zero is one edge and one is the other.
function plateau(t, sigma) {
  if (!(sigma > 0)) return 0;
  return (
    0.5 *
    (1 + Math.tanh((t + 2 * sigma) / sigma)) *
    0.5 *
    (1 - Math.tanh((t - (1 + 2 * sigma)) / sigma))
  );
}

// The website's ease, in and out, clamped to its ends.
function eased(fraction) {
  const p = Math.min(Math.max(fraction, 0), 1);
  return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
}

// One sheet turned into the bump it makes in the ground. The plateau is
// back-solved off the rectangle: the push lifts the grid by the amplitude, so
// the region it is worked out over is pushed down by that much first and the
// lifted plateau then lands exactly on the sheet.
function bumpFrom(rect, amplitude) {
  const y0 = rect.top + amplitude * lambda(0);
  const y1 = rect.bottom + amplitude * lambda(1);
  // The plateau reaches two sigma out and the tail is spent five sigma later.
  const across = 8 * SIGMA_ACROSS;
  const down = 8 * SIGMA_DOWN;
  return {
    x0: rect.left,
    x1: rect.right,
    y0,
    y1,
    amplitude,
    reachLeft: rect.left - across,
    reachRight: rect.right + across,
    reachTop: y0 - down,
    reachBottom: y1 + down,
  };
}

// One sheet seen as glass: the lens it makes of the ground beneath it. A pane
// is thick at the rim and flat in the middle, so the ground is carried outward
// hardest half way through the rim's curve, not at all where the sheet has gone
// flat, and not at all at the very rim.
function lensFrom(rect, cornerRadius) {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    midX: (rect.left + rect.right) / 2,
    midY: (rect.top + rect.bottom) / 2,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    cornerRadius,
  };
}

function bumpPush(bump, scale, x, y, out) {
  const width = bump.x1 - bump.x0;
  const height = bump.y1 - bump.y0;
  if (width < 1 || height < 1) return false;
  if (x < bump.reachLeft || x > bump.reachRight) return false;
  if (y < bump.reachTop || y > bump.reachBottom) return false;
  const across = (x - bump.x0) / width;
  const down = (y - bump.y0) / height;
  const taper = lambda(Math.min(Math.max(down, 0), 1));
  const window =
    plateau(across, (taper * SIGMA_ACROSS) / width) *
    plateau(down, (taper * SIGMA_DOWN) / height);
  if (window < 0.0001) return false;
  out.dx = scale * bump.amplitude * window * (across - 0.5) * taper;
  out.dy = -scale * bump.amplitude * window * taper;
  return true;
}

function lensBend(lens, scale, x, y, out) {
  if (lens.width < 1 || lens.height < 1) return false;
  const halfWidth = lens.width / 2;
  const halfHeight = lens.height / 2;
  const radius = Math.min(lens.cornerRadius, Math.min(halfWidth, halfHeight));
  const acrossFromMiddle = x - lens.midX;
  const downFromMiddle = y - lens.midY;
  // How far in from the rim, worked out in the quadrant the point stands in,
  // which is what makes a corner round rather than square.
  const cornerX = Math.abs(acrossFromMiddle) - (halfWidth - radius);
  const cornerY = Math.abs(downFromMiddle) - (halfHeight - radius);
  const inACorner = cornerX > 0 && cornerY > 0;
  const outOfCorner = inACorner
    ? Math.hypot(cornerX, cornerY)
    : Math.max(cornerX, cornerY);
  const depth = radius - outOfCorner;
  if (depth <= 0 || depth >= BEVEL) return false;

  // Straight out of the nearest rim.
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
    scale * REFRACTION * Math.sin((Math.PI * depth) / BEVEL),
    depth * 0.9
  );
  out.dx = acrossOut * carried;
  out.dy = downOut * carried;
  return true;
}

// Peaks at exactly one reach out, where the root of e puts it at the full pull.
const ROOT_E = 1.6487212707001282;

function dimplePush(dimple, x, y, out) {
  if (!(dimple.pull > 0.0001)) return false;
  const dx = x - dimple.x;
  const dy = y - dimple.y;
  // Past four reaches the pull is a thirtieth of a pixel.
  const bound = 4 * MASS_REACH;
  if (Math.abs(dx) > bound || Math.abs(dy) > bound) return false;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) {
    out.dx = 0;
    out.dy = 0;
    return true;
  }
  const spread = distance / MASS_REACH;
  const strength = dimple.pull * spread * Math.exp((-spread * spread) / 2) * ROOT_E;
  out.dx = (-dx / distance) * strength;
  out.dy = (-dy / distance) * strength;
  return true;
}

const scratch = { dx: 0, dy: 0 };
const total = { dx: 0, dy: 0 };

// How far every source together moves the point under them.
//
// The largest push wins rather than the pushes adding up. That is the website's
// own choice, stated in its source as "max displacement from all panels (no
// superposition)", and it is what keeps two sources over the same place from
// tearing the ground between them. The bending is then added to the pushing:
// what a sheet weighs and what it is made of are two different things about the
// same sheet, and the rule against superposition is a rule about weights.
function displacement(x, y, sources, dimple) {
  let pushX = 0;
  let pushY = 0;
  let largest = 0;
  for (const source of sources) {
    if (source.scale <= 0.0001) continue;
    if (!bumpPush(source.bump, source.scale, x, y, scratch)) continue;
    const size = scratch.dx * scratch.dx + scratch.dy * scratch.dy;
    if (size > largest) {
      largest = size;
      pushX = scratch.dx;
      pushY = scratch.dy;
    }
  }
  if (dimple && dimplePush(dimple, x, y, scratch)) {
    const size = scratch.dx * scratch.dx + scratch.dy * scratch.dy;
    if (size > largest) {
      largest = size;
      pushX = scratch.dx;
      pushY = scratch.dy;
    }
  }

  let bendX = 0;
  let bendY = 0;
  let deepest = 0;
  for (const source of sources) {
    if (!source.lens || source.scale <= 0.0001) continue;
    if (!lensBend(source.lens, source.scale, x, y, scratch)) continue;
    const size = scratch.dx * scratch.dx + scratch.dy * scratch.dy;
    if (size > deepest) {
      deepest = size;
      bendX = scratch.dx;
      bendY = scratch.dy;
    }
  }

  total.dx = pushX + bendX;
  total.dy = pushY + bendY;
  return total;
}

// How far to the next piece of a line: finely where a source is bending the
// ground, and coarsely everywhere else. Each region is widened by one coarse
// piece, so a step never lands inside one without the step before it having
// seen it coming.
function stepAt(x, y, sources, dimple) {
  const slack = COARSE_SAMPLE_LENGTH;
  for (const source of sources) {
    if (source.scale <= 0.0001) continue;
    const bump = source.bump;
    if (
      x >= bump.reachLeft - slack &&
      x <= bump.reachRight + slack &&
      y >= bump.reachTop - slack &&
      y <= bump.reachBottom + slack
    ) {
      return SAMPLE_LENGTH;
    }
  }
  // A rim turns over inside twenty-eight pixels, so a line crossing one has to
  // be sampled finely or the bend is chorded away. Every sheet that makes a
  // lens also makes a bump, whose reach is far wider, so this changes nothing
  // today; it is here so a change to a sheet's push cannot quietly flatten its
  // refraction.
  for (const source of sources) {
    if (!source.lens || source.scale <= 0.0001) continue;
    const lens = source.lens;
    if (
      x >= lens.left - slack &&
      x <= lens.right + slack &&
      y >= lens.top - slack &&
      y <= lens.bottom + slack
    ) {
      return SAMPLE_LENGTH;
    }
  }
  // Only the middle of the well needs fine sampling, where the pull turns over
  // and changes direction; the rest of it is five times coarser than the
  // lattice itself.
  if (
    dimple &&
    dimple.pull > 0.0001 &&
    Math.abs(x - dimple.x) <= MASS_REACH + slack &&
    Math.abs(y - dimple.y) <= MASS_REACH + slack
  ) {
    return SAMPLE_LENGTH;
  }
  return COARSE_SAMPLE_LENGTH;
}

// The whole field: every line is its straight line with the travelling sine
// added to it and whatever stands over it pushing it out of the way, and
// nothing anywhere is drawn in front of a flat grid.
//
// It runs three lattice spacings past every edge, so a line near an edge has
// neighbours out there to be stretched against and the pointer's pull does not
// go wrong in the corners. Nothing moves inward for it: the visible grid still
// meets all four edges exactly.
function field(w, h, phase, sources, dimple) {
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
      const push = displacement(across, down, sources, dimple);
      const wave =
        BASE_AMPLITUDE *
        Math.sin(across / WAVE_ALONG_LINE + down / WAVE_ACROSS_LINES + phase);
      const x = across + push.dx;
      const y = down + wave + push.dy;
      if (started) path.lineTo(x, y);
      else {
        path.moveTo(x, y);
        started = true;
      }
      if (across >= right) break;
      across = Math.min(across + stepAt(across, down, sources, dimple), right);
    }
  }

  for (let side = left; side < right + SPACING; side += SPACING) {
    let along = top;
    let started = false;
    for (;;) {
      const push = displacement(side, along, sources, dimple);
      const wave =
        BASE_AMPLITUDE *
        Math.sin(along / WAVE_ALONG_LINE + side / WAVE_ACROSS_LINES + phase);
      const x = side + wave + push.dx;
      const y = along + push.dy;
      if (started) path.lineTo(x, y);
      else {
        path.moveTo(x, y);
        started = true;
      }
      if (along >= bottom) break;
      along = Math.min(along + stepAt(side, along, sources, dimple), bottom);
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

function drawGround(ctx, w, h, seconds, phase, sources, dimple) {
  ctx.clearRect(0, 0, w, h);
  drawLuminance(ctx, w, h, seconds);

  const lines = field(w, h, phase, sources, dimple);
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
}

// The heavy thing the pointer drags across the ground.
//
// This is not where the pointer is. It is where a mass on a spring behind the
// pointer has got to, which lags it, overshoots it and settles. Deliberately
// under-damped and deliberately slow: a mass that arrived where the pointer is
// would read as a cursor highlight rather than as a heavy thing bending the
// fabric.
function createMass() {
  let pointer = null;
  let placeX = 0;
  let placeY = 0;
  let standing = false;
  let velocityX = 0;
  let velocityY = 0;
  let weight = 0;

  return {
    aimsAt(point) {
      pointer = point;
      if (!standing && point) {
        placeX = point.x;
        placeY = point.y;
        standing = true;
        velocityX = 0;
        velocityY = 0;
      }
    },
    // One turn of the spring, and of the weight arriving or leaving with it.
    // The step is clamped: a banner scrolled away from for a minute comes back
    // to a minute of elapsed time, and a spring integrated over that in one go
    // flings the mass off the frame.
    dimple(elapsed) {
      const step = Math.min(Math.max(elapsed, 0), 0.05);
      weight += ((pointer ? 1 : -1) * step) / RAMP_SECONDS;
      weight = Math.min(Math.max(weight, 0), 1);
      if (weight <= 0 && !pointer) {
        standing = false;
        velocityX = 0;
        velocityY = 0;
        return null;
      }
      if (pointer && standing) {
        velocityX +=
          ((pointer.x - placeX) * MASS_STIFFNESS - velocityX * MASS_DAMPING) * step;
        velocityY +=
          ((pointer.y - placeY) * MASS_STIFFNESS - velocityY * MASS_DAMPING) * step;
        placeX += velocityX * step;
        placeY += velocityY * step;
      }
      if (!standing || weight <= 0.0001) return null;
      return { x: placeX, y: placeY, pull: MASS_PULL * weight };
    },
  };
}

function init(banner) {
  const canvas = banner.querySelector('.mfs-grid');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasPointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // Every anchor the ground bends around, in the order it starts pushing.
  // The title first, then the sheets down the stack, a tenth of a second
  // apart, so the ground opens under them one after another as the website's
  // own panels do rather than all at once.
  const anchors = [];
  const title = banner.querySelector('[data-mfs-title]');
  // Words have weight and no lens: the website's grid is anchored to its title
  // and its exit sign, and neither is a pane.
  if (title) anchors.push({ el: title, amplitude: DEPTH.forward, refracts: false });
  for (const sheet of banner.querySelectorAll('[data-mfs-sheet]')) {
    anchors.push({
      el: sheet,
      amplitude: DEPTH[sheet.dataset.mfsSheet] ?? DEPTH.panel,
      refracts: true,
    });
  }

  const sources = anchors.map((anchor, place) => ({
    anchor,
    delay: place * STAGGER_SECONDS,
    scale: 0,
    bump: null,
    lens: null,
  }));

  const mass = createMass();
  let pixels = { w: 0, h: 0, dpr: 0 };
  let frame = 0;
  let visible = false;
  let began = 0;
  let stepped = 0;
  let painted = 0;

  function measure() {
    const frameRect = banner.getBoundingClientRect();
    for (const source of sources) {
      const box = source.anchor.el.getBoundingClientRect();
      const rect = {
        left: box.left - frameRect.left,
        right: box.right - frameRect.left,
        top: box.top - frameRect.top,
        bottom: box.bottom - frameRect.top,
      };
      source.bump = bumpFrom(rect, source.anchor.amplitude);
      // The corner the ground bends round is the sheet's own, so it is read off
      // the sheet rather than written here twice.
      source.lens = source.anchor.refracts
        ? lensFrom(rect, parseFloat(getComputedStyle(source.anchor.el).borderTopLeftRadius) || 0)
        : null;
    }
  }

  function resize() {
    const w = banner.clientWidth;
    const h = banner.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (w === 0 || h === 0) return false;
    if (w === pixels.w && h === pixels.h && dpr === pixels.dpr) {
      measure();
      return true;
    }
    pixels = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure();
    return true;
  }

  // Reduced motion: the ground at rest, with everything standing on it already
  // pushing. Nothing in this banner pulses, strobes or flashes even while it is
  // moving - the website's flicker is deliberately not ported - so at rest it is
  // simply the same picture holding still.
  function drawStill() {
    if (pixels.w === 0) return;
    for (const source of sources) source.scale = 1;
    drawGround(ctx, pixels.w, pixels.h, 0, 0, sources, null);
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    const seconds = now / 1000;
    if (began === 0) began = seconds;
    if (stepped === 0) stepped = seconds;
    const elapsed = seconds - stepped;
    stepped = seconds;
    const dimple = hasPointer.matches ? mass.dimple(elapsed) : null;
    if (seconds - painted < REFRESH_INTERVAL) return;
    painted = seconds;
    if (pixels.w === 0) return;
    for (const source of sources) {
      source.scale = eased((seconds - began - source.delay) / RAMP_SECONDS);
    }
    drawGround(
      ctx,
      pixels.w,
      pixels.h,
      seconds,
      seconds * BASE_SPEED,
      sources,
      dimple
    );
  }

  // The ramp is the furniture arriving, so it runs once. Scrolling the banner
  // away and back is a pause, not a second arrival.
  function sync() {
    if (visible && !still.matches) {
      if (frame === 0) {
        stepped = 0;
        frame = requestAnimationFrame(tick);
      }
      return;
    }
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    if (still.matches) drawStill();
  }

  banner.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const frameRect = banner.getBoundingClientRect();
    mass.aimsAt({ x: event.clientX - frameRect.left, y: event.clientY - frameRect.top });
  });
  banner.addEventListener('pointerleave', () => mass.aimsAt(null));

  // The observer delivers an initial observation of its own, which is where the
  // canvas first gets its pixels and every anchor first gets measured.
  new ResizeObserver(() => {
    if (resize() && frame === 0 && still.matches) drawStill();
  }).observe(banner);
  // The title is an anchor and its box depends on its face.
  if (document.fonts) document.fonts.ready.then(measure);

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
