import { palette, sunset } from './pp-palette.js';

// The text remains in the shared game-blurb; CSS alone paints its lettering.
// The seven applet stills are static for every motion preference.
for (const banner of document.querySelectorAll('[data-pp-banner]')) {
  for (const key of ['outer', 'band', 'bandDeep', 'rim', 'hot']) {
    const name = key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    banner.style.setProperty(`--pp-${name}`, palette[key]);
  }
  sunset.forEach(([, ink], i) => banner.style.setProperty(`--pp-sunset-${i + 1}`, ink));
  const middle = banner.querySelector('.pp-middle');
  const top = middle?.querySelector('.pp-row-top');
  const bottom = middle?.querySelector('.pp-row-bottom');
  if (!top || !bottom) continue;
  new ResizeObserver(() => {
    // Both edges share a 1.5 degree slope, so the existing gap width stays fixed.
    // Only the horizontal cut moves; the vertical divisions remain straight.
    const rise = middle.clientWidth * Math.tan(1.5 * Math.PI / 180);
    top.style.marginBottom = `${-rise / 2}px`;
    bottom.style.marginTop = `${-rise / 2}px`;
    top.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - ${rise}px))`;
    bottom.style.clipPath = `polygon(0 0, 100% ${rise}px, 100% 100%, 0 100%)`;
    banner.dataset.ppReady = '';
  }).observe(middle);
}
