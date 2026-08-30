// The Verdant Engine's own colours, from VerdantEngine/Render/Palette.swift.
// Game values are copied exactly; the sky block at the bottom is the banner's
// own, because the game's atmosphere is a warm tan haze and the banner was
// asked for under a blue sky (Damian, 2026-08-28).

export const Palette = {
  // CloudBank
  cloud: '#e8dfcb',
  cloudEmissionDim: 0.48,

  // Atmosphere / lighting
  sunlight: '#fff1d6',
  ambient: '#8794a0',
  bounce: '#6e7f5a',

  // IslandRockNode strata
  bedrockPale: '#6b6455',
  bedrockMid: '#4a4539',
  bedrockDeep: '#241f19',
  soilDark: '#382b1e',

  // TreeStand leaf ramp
  leafSun: '#7b9b42',
  leafMid: '#4a6634',
  leafDeep: '#2e4227',
  leafShadow: '#1a2618',

  // TreeStand bark, for the trunks under the crowns that overhang the drop
  barkLight: '#5c4931',
  barkMid: '#33261a',
  barkDark: '#150f0a',

  // FarCountryPicture's air
  landHaze: '#4a4c3c',

  // The suit's metals, for the tiny gardener on the rim
  copper: '#a85f33',
  copperDark: '#6e3d22',
  brass: '#b08d3e',
  brassBright: '#e0bc63',
  iron: '#3b4048',
  ironLight: '#565d68',
  hardwood: '#3a2415',
  lampGlow: '#ffd98a',

  // Banner-only sky (not in the game)
  skyTop: '#4e7fb0',
  skyMid: '#7fa6c8',
  skyHorizon: '#e3e7dc',
  ridgeFar: '#a9bcc0',
  ridgeMid: '#93a8ab',
  ridgeNear: '#7e9297',
};

// Palette.dim(colour, f) from the game: the colour scaled toward black.
export function dim(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function mix(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (x, y) => Math.round(x + (y - x) * t);
  const r = ch((a >> 16) & 255, (b >> 16) & 255);
  const g = ch((a >> 8) & 255, (b >> 8) & 255);
  const bl = ch(a & 255, b & 255);
  return `rgb(${r},${g},${bl})`;
}
