// VoidFlux home-page banner: the game's void-black field, its perspective
// grid, its glowing flux loops and its real gem mesh.
//
// The grid is a 2D-canvas port of `PerspectiveGrid` / `TitleBackdrop`
// (VoidFlux/App/TitleView.swift). It renders on its own, so the banner is
// never a blank black box even when WebGL is unavailable.

import { Palette } from './voidflux-palette.js';

// PerspectiveGrid's parameters, unchanged. Lengths are in CSS pixels, which
// stand in for the SwiftUI points the shape was tuned in.
const GRID = {
  H: 50,
  theta: Math.PI / 2.5,
  delta: 40,
  M: 25,
  C: 300,
  strip: 60,
  lineWidth: 2,
  baseGlow: 4,
};

const MAX_DPR = 2;

function gridPath(w, h) {
  const { theta, H, delta, M, C, strip } = GRID;
  const midX = w / 2;
  const midY = h / 2;
  const vy = 105 - Math.tan(theta);
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

  // Two glow passes then the crisp stroke, mirroring TitleBackdrop's layered
  // shadows (wide faint pink behind, tighter cyan in front). Canvas shadowBlur
  // is a diameter where SwiftUI's shadow radius is a radius, hence the x2.
  const glow = (color, alpha, radius) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = radius * 2;
    ctx.strokeStyle = color;
    ctx.stroke(path);
    ctx.restore();
  };
  glow(Palette.pinkBright, 0.3, GRID.baseGlow * 1.8);
  glow(Palette.cyanBright, 0.5, GRID.baseGlow);

  ctx.strokeStyle = stroke;
  ctx.stroke(path);
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
