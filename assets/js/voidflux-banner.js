// VoidFlux home-page banner: the game's void-black field, its perspective
// grid, its glowing flux loops and its real gem mesh.
//
// The grid is a 2D-canvas port of `TitleBackdrop` / `PerspectiveGrid`
// (VoidFlux/App/TitleView.swift). It renders on its own, so the banner is
// never a blank black box even when WebGL is unavailable.

import { Palette } from './voidflux-palette.js';

// PerspectiveGrid's shape parameters, unchanged from the game. Lengths are in
// CSS pixels, which stand in for the SwiftUI points the shape was tuned in.
const GRID = {
  H: 50,
  theta: Math.PI / 2.5,
  delta: 40,
  M: 25,
  C: 300,
};

const VANISHING_Y = 105 - Math.tan(GRID.theta);

// TitleBackdrop draws two grids. The far one is thinner, dimmer, runs its
// gradient the other way up and offsets its fan by half a step so its lines
// interleave with the near one's instead of hiding behind them.
const FAR_LAYER = {
  strip: 132,
  fanOffset: 0.5,
  lineWidth: 1,
  top: Palette.cyanBright,
  bottom: Palette.pinkBright,
  opacity: 0.45,
  glows: [{ color: Palette.pinkBright, alpha: 0.2, radius: 4 }],
};

const NEAR_LAYER = {
  strip: 60,
  fanOffset: 0,
  lineWidth: 2,
  top: Palette.pinkBright,
  bottom: Palette.cyanBright,
  opacity: 1,
  glows: [
    { color: Palette.pinkBright, alpha: 0.3, radius: 4 * 1.8 },
    { color: Palette.cyanBright, alpha: 0.5, radius: 4 },
  ],
};

// Both layers are masked so the grid dies away to almost nothing as it
// approaches the vanishing point and returns to full strength near the viewer.
// Without this the grid is densest and brightest exactly where it converges,
// which reads as a wall of neon rather than as depth.
const FADE_MIN_OPACITY = 0.05;
const FADE_RAMP_LENGTH = 300;

const MAX_DPR = 2;

function horizonY(h) {
  return h / 2 - VANISHING_Y;
}

function gridPath(w, h, strip, fanOffset) {
  const { theta, H, delta, M, C } = GRID;
  const midX = w / 2;
  const midY = h / 2;
  const vy = VANISHING_Y;
  const loY = vy - strip;
  const hiY = vy + strip;
  const g = H / (delta * Math.cos(theta));
  const xExtent = w * 2;
  const yExtent = h * 2;

  const path = new Path2D();
  // Shape space is y-up centred on the rect, matching `toScreen`.
  const moveTo = (x, y) => path.moveTo(midX + x, midY - y);
  const lineTo = (x, y) => path.lineTo(midX + x, midY - y);

  // Horizontal depth rows: y_k = vy - g*C/k, bunching toward the horizon.
  for (let k = -M; k <= M; k++) {
    if (k === 0) continue;
    const yk = vy - (g * C) / k;
    if (yk >= loY && yk <= hiY) continue;
    moveTo(-xExtent, yk);
    lineTo(xExtent, yk);
  }

  // Centre line at x = 0, clipped to the strip in y. The offset layer has no
  // line at x = 0, which is what staggers the two fans.
  if (fanOffset === 0) {
    moveTo(0, -yExtent);
    lineTo(0, loY);
    moveTo(0, hiY);
    lineTo(0, yExtent);
  }

  // Fan lines: straight, through the vanishing point, both halves.
  for (let j = -M; j <= M; j++) {
    const denom = j + fanOffset;
    if (denom === 0) continue;
    const slope = g / denom;
    const y = (x) => vy + slope * x;
    const xEdge = Math.abs(strip / slope);
    moveTo(-xExtent, y(-xExtent));
    lineTo(-xEdge, y(-xEdge));
    moveTo(xEdge, y(xEdge));
    lineTo(xExtent, y(xExtent));
  }

  return path;
}

function fadeGradient(ctx, h, strip) {
  const horizon = horizonY(h);
  const at = (px) => Math.min(1, Math.max(0, px / h));
  const solid = 'rgba(255,255,255,1)';
  const faded = `rgba(255,255,255,${FADE_MIN_OPACITY})`;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, solid);
  gradient.addColorStop(at(horizon - strip - FADE_RAMP_LENGTH), solid);
  gradient.addColorStop(at(horizon - strip), faded);
  gradient.addColorStop(at(horizon + strip), faded);
  gradient.addColorStop(at(horizon + strip + FADE_RAMP_LENGTH), solid);
  gradient.addColorStop(1, solid);
  return gradient;
}

// One grid layer, stroked with its glows and then masked, mirroring the
// SwiftUI order: stroke, shadows, mask.
function drawLayer(w, h, dpr, layer) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const path = gridPath(w, h, layer.strip, layer.fanOffset);
  ctx.lineWidth = layer.lineWidth;
  ctx.lineCap = 'round';

  // Canvas shadowBlur is a diameter where SwiftUI's shadow radius is a radius.
  for (const glow of layer.glows) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow.alpha;
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.radius * 2;
    ctx.strokeStyle = glow.color;
    ctx.stroke(path);
    ctx.restore();
  }

  const stroke = ctx.createLinearGradient(0, 0, 0, h);
  stroke.addColorStop(0, layer.top);
  stroke.addColorStop(1, layer.bottom);
  ctx.strokeStyle = stroke;
  ctx.stroke(path);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = fadeGradient(ctx, h, layer.strip);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  return canvas;
}

function drawGrid(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  for (const layer of [FAR_LAYER, NEAR_LAYER]) {
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(drawLayer(w, h, dpr, layer), 0, 0, w, h);
  }
  ctx.globalAlpha = 1;
}

function init(banner) {
  const gridCanvas = banner.querySelector('.vf-grid');
  if (!gridCanvas || !gridCanvas.getContext) return;

  const redraw = () => drawGrid(gridCanvas);
  redraw();
  new ResizeObserver(redraw).observe(banner);

  import('./voidflux-scene.js')
    .then((m) => m.mount(banner))
    .catch(() => {
      // Grid-only is a complete composition; nothing further to do.
    });
}

document.querySelectorAll('[data-vf-banner]').forEach(init);
