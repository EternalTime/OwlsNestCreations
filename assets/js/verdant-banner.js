// The Verdant Engine home-page banner: a side-perspective sneak peek of the
// island in the sky. This module paints the backdrop - blue sky, far ridges,
// and the land a very long way below across the bottom of the frame - on a 2D
// canvas, so the banner is a complete picture even where WebGL is unavailable.
// The floating island and the drifting cloud banks are the WebGL half
// (verdant-scene.js), fetched only when the banner nears the viewport, exactly
// as the VoidFlux banner does it.
//
// The land picture is assets/img/verdant-land.png, baked from the game's own
// FarCountryPicture by tools/land-look/look.sh - the same picture a parting in
// the game's cloud shows. The sky is the banner's own: the game's atmosphere
// is a warm tan haze, and this sky is blue by instruction.

import { Palette, mix } from './verdant-palette.js';

// Where the sky meets the land, as a fraction of the banner's height. The land
// below is the bottom third; the ridges sit on this line and the scene module
// hangs the island above it.
export const HORIZON = 0.6;

const MAX_DPR = 2;

// The ridge lines are seeded rather than random so the banner is the same
// mountain range on every visit, in the way one world seed is one garden.
const RIDGE_SEED = 0x5eed;

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

// One ridge: a wandering polyline from x=0 to x=w, filled down to the horizon.
// Peaks are bunched irregularly so the range reads as country, not as a wave.
function ridgePath(rand, w, baseY, amp) {
  const path = new Path2D();
  const steps = 42;
  path.moveTo(0, baseY);
  let y = baseY - rand() * amp;
  path.lineTo(0, y);
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * w;
    const lift = Math.sin(i * 1.7 + rand() * 0.6) * 0.5 + 0.5;
    y = baseY - amp * (0.62 + 0.38 * lift * rand());
    path.lineTo(x, y);
  }
  path.lineTo(w, baseY);
  path.closePath();
  return path;
}

const landImage = new Image();
let landLoaded = false;
landImage.onload = () => {
  landLoaded = true;
  document.querySelectorAll('[data-ve-banner]').forEach((banner) => {
    if (banner.veRedraw) banner.veRedraw(true);
  });
};
landImage.src = new URL('../img/verdant-land.png', import.meta.url).href;

function drawBackdrop(canvas, { w, h, dpr }) {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const horizon = h * HORIZON;

  // Sky, deepest overhead and paling toward the horizon so the ivory clouds
  // stay the warmest thing in the frame.
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, Palette.skyTop);
  sky.addColorStop(0.62, Palette.skyMid);
  sky.addColorStop(1, Palette.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);

  // The land far below, filling the frame from the horizon down. The WebGL
  // scene's ground plane draws the country in perspective, so wherever that
  // scene is coming this half is plain haze - the flat map would clash where
  // the frame is wider than the plane. The flat map is the picture only once
  // the scene has been tried and has not come, which is the whole of what
  // `data-ve-flat` says. Painting it before then and taking it away again is
  // the land picture flashing on load.
  if (!canvas.parentElement || !canvas.parentElement.hasAttribute('data-ve-flat')) {
    // Painted as distant country, not as pale air: the ground plane's far
    // edge cannot geometrically reach eye level, so this band is the land
    // carrying on to the mountains' feet in the same hazed green.
    const veil = ctx.createLinearGradient(0, horizon, 0, h);
    veil.addColorStop(0, 'rgb(196, 204, 186)');
    veil.addColorStop(0.4, 'rgb(178, 187, 166)');
    veil.addColorStop(1, 'rgb(150, 160, 138)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, horizon, w, h - horizon);
  } else if (landLoaded) {
    const strip = h - horizon;
    const scale = Math.max(w / landImage.width, strip / landImage.height);
    const dw = landImage.width * scale;
    const dh = landImage.height * scale;
    ctx.drawImage(landImage, (w - dw) / 2, horizon, dw, dh);
  } else {
    ctx.fillStyle = Palette.landHaze;
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  // The air between here and the ground: the land melts toward the horizon
  // colour where it is furthest away, which is what makes the strip read as
  // country thirty metres down rather than as wallpaper.
  const haze = ctx.createLinearGradient(0, horizon, 0, h);
  haze.addColorStop(0, 'rgba(227, 231, 220, 0.75)');
  haze.addColorStop(0.3, 'rgba(210, 216, 202, 0.22)');
  haze.addColorStop(0.6, 'rgba(202, 209, 196, 0.05)');
  haze.addColorStop(1, 'rgba(74, 76, 60, 0.0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon, w, h - horizon);

  // Far ridges on the horizon, three ranges deep, each nearer one darker and
  // taller. They are haze-coloured, not rock-coloured: mountains at this
  // distance are air, so each is mostly the horizon's own colour.
  // Their feet are planted a tenth of the banner BELOW the horizon line, so
  // the scene's ground plane - whose far edge can only approach the horizon,
  // never reach it - overlaps them: every pixel between the peaks and the
  // country is mountain or land, and no strip of painted air can show.
  const rand = mulberry32(RIDGE_SEED);
  const foot = horizon + h * 0.1;
  const ranges = [
    { colour: mix('#a9bcc0', Palette.skyHorizon, 0.55), amp: 0.12 },
    { colour: mix('#93a8ab', Palette.skyHorizon, 0.3), amp: 0.15 },
    { colour: mix('#7e9182', Palette.skyHorizon, 0.1), amp: 0.18 },
  ];
  for (const range of ranges) {
    ctx.fillStyle = range.colour;
    ctx.fill(ridgePath(rand, w, foot, h * range.amp));
  }
}

// Measured off the banner element rather than the canvas: the canvas is
// inset to fill it, and the banner's box is the one CSS settles first.
function metrics(banner) {
  return {
    w: banner.clientWidth,
    h: banner.clientHeight,
    dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
  };
}

function init(banner) {
  const backCanvas = banner.querySelector('.ve-back');
  if (!backCanvas || !backCanvas.getContext) return;

  let frame = 0;
  let drawn = null;
  const redraw = (force) => {
    frame = 0;
    const m = metrics(banner);
    if (m.w === 0 || m.h === 0) return;
    if (!force && drawn && drawn.w === m.w && drawn.h === m.h && drawn.dpr === m.dpr) return;
    drawBackdrop(backCanvas, m);
    drawn = m;
  };
  banner.veRedraw = redraw;

  new ResizeObserver(() => {
    if (frame === 0) frame = requestAnimationFrame(() => redraw(false));
  }).observe(banner);

  // The island and the clouds arrive only when the banner is near the
  // viewport; the backdrop above has already painted, so a visitor who never
  // scrolls here pays nothing and still loses nothing.
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      // If the scene came, mount has set data-ve-ready and the backdrop it
      // was already painting is the right one. Anything short of that - no
      // WebGL, or the module never arriving - means the flat land map is the
      // picture after all: sky, ridges and land are a complete composition
      // on their own.
      const settle = () => {
        if (banner.hasAttribute('data-ve-ready')) return;
        banner.setAttribute('data-ve-flat', '');
        redraw(true);
      };
      import('./verdant-scene.js')
        .then((m) => { m.mount(banner); settle(); })
        .catch(settle);
    },
    { rootMargin: '400px' }
  ).observe(banner);
}

document.querySelectorAll('[data-ve-banner]').forEach(init);
