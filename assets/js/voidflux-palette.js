// Exact hex values from the game's `Palette` enum (VoidFlux/Game/Rendering.swift),
// standard variant.
export const Palette = {
  pinkBright: '#ff49c9',
  pink: '#e1317b',
  pinkShadow: '#3a0a1f',
  tealBright: '#49ffe9',
  teal: '#35c2aa',
  tealShadow: '#0f4939',
  cyanBright: '#37dfff',
  cyan: '#29a3c3',
  cyanShadow: '#0e3748',
  voidBlack: '#04040e',
  whitePure: '#ffffff',
  steelLight: '#7f8c99',
};

// Flux colour convention: positive = teal, negative = pinkBright.
export const colorPositive = Palette.teal;
export const colorNegative = Palette.pinkBright;
