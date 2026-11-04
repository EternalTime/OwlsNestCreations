import { palette, sunset } from './pp-palette.js';

// The text remains in the shared game-blurb; CSS alone paints its lettering.
// The six applet stills are static for every motion preference.
for (const banner of document.querySelectorAll('[data-pp-banner]')) {
  for (const key of ['outer', 'band', 'bandDeep', 'rim', 'hot']) {
    const name = key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    banner.style.setProperty(`--pp-${name}`, palette[key]);
  }
  sunset.forEach(([, ink], i) => banner.style.setProperty(`--pp-sunset-${i + 1}`, ink));
  banner.dataset.ppReady = '';
}
