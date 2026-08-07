// VoidFlux home-page banner: the game's void-black field, its perspective
// grid, its glowing flux loops and its real gem mesh.
//
// The grid is a 2D-canvas port of `PerspectiveGrid` / `TitleBackdrop`
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
  // Wider than the game's 60: the dark band around the horizon is a large part
  // of why the game's frame reads as black.
  strip: 95,
  lineWidth: 1,
  baseGlow: 2,
};

// The shape is scaled about the horizon rather than the frame centre, so the
// cells come out as fine as the game's while the vanishing point stays put.
const GRID_SCALE = 0.62;
// The grid is depth, not decoration. It sits close to the black instead of
// shouting over the geometry in front of it.
const GRID_ALPHA = 0.4;
// Above the horizon the game is essentially dark, so the mirrored half falls
// away to nothing over this many pixels.
const GRID_CEILING_FADE = 150;

const MAX_DPR = 2;

function horizonY(h) {
  return h / 2 - (105 - Math.tan(GRID.theta)) * GRID_SCALE;
}

function gridPath(w, h) {
  const { theta, H, delta, M, C, strip } = GRID;
  const midX = w / 2;
  const vy = 105 - Math.tan(theta);
  const loY = vy - strip;
  const hiY = vy + strip;
  const g = H / (delta * Math.cos(theta));
  const xExtent = (w * 2) / GRID_SCALE;
  const yExtent = (h * 2) / GRID_SCALE;
  const hy = horizonY(h);

  const path = new Path2D();
  // Shape space is y-up, scaled about the vanishing point.
  const moveTo = (x, y) => path.moveTo(midX + x * GRID_SCALE, hy - (y - vy) * GRID_SCALE);
  const lineTo = (x, y) => path.lineTo(midX + x * GRID_SCALE, hy - (y - vy) * GRID_SCALE);

  // Horizontal depth rows: y_k = vy - g*C/k, bunching toward the horizon.
  for (let k = -M; k <= M; k++) {
    if (k === 0) continue;
    const yk = vy - (g * C) / k;
    if (yk >= loY && yk <= hiY) continue;
    moveTo(-xExtent, yk);
    lineTo(xExtent, yk);
  }

  // Centre line at x = 0, clipped to the strip in y.
  moveTo(0, -yExtent);
  lineTo(0, loY);
  moveTo(0, hiY);
  lineTo(0, yExtent);

  // Fan lines: straight, through the vanishing point, both halves.
  for (let j = -M; j <= M; j++) {
    if (j === 0) continue;
    const slope = g / j;
    const y = (x) => vy + slope * x;
    const xEdge = Math.abs(strip / slope);
    moveTo(-xExtent, y(-xExtent));
    lineTo(-xEdge, y(-xEdge));
    moveTo(xEdge, y(xEdge));
    lineTo(xExtent, y(xExtent));
  }

  return path;
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

  const path = gridPath(w, h);
  const stroke = ctx.createLinearGradient(0, 0, 0, h);
  stroke.addColorStop(0, Palette.pinkBright);
  stroke.addColorStop(1, Palette.cyanBright);

  ctx.lineWidth = GRID.lineWidth;
  ctx.lineCap = 'round';
  ctx.globalAlpha = GRID_ALPHA;

  // A tight glow pair, mirroring TitleBackdrop's layered shadows (wide faint
  // pink behind, tighter cyan in front) but at a fraction of their strength -
  // at full strength they haze the whole canvas instead of hugging the lines.
  // Canvas shadowBlur is a diameter where SwiftUI's shadow radius is a radius.
  const glow = (color, alpha, radius) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = GRID_ALPHA * alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 2;
    ctx.strokeStyle = color;
    ctx.stroke(path);
    ctx.restore();
  };
  glow(Palette.pinkBright, 0.1, GRID.baseGlow * 1.8);
  glow(Palette.cyanBright, 0.18, GRID.baseGlow);

  ctx.strokeStyle = stroke;
  ctx.stroke(path);
  ctx.globalAlpha = 1;

  // Erase upward from the horizon so the mirrored ceiling falls away to black.
  const hy = horizonY(h);
  const fade = ctx.createLinearGradient(0, Math.max(0, hy - GRID_CEILING_FADE), 0, hy);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, hy);
  ctx.restore();
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
