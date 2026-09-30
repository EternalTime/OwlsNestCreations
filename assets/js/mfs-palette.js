// The palette of My Favorite Spacetimes, which is the application's own.
//
// Taken from `Palette.swift` in the application
// (~/OwlsNest/MyFavoriteSpacetimes/Packages/Spacetimes/Sources/SpacetimesLook):
// the two cyans the captain moved it to from teal on 30 September 2026, its
// pink, and its dark blue ground. This is the only place in the banner where a
// colour is a number.

export const Palette = {
  cyanDark: [0x29, 0xa3, 0xc3],
  cyanBright: [0x37, 0xdf, 0xff],
  pinkLight: [0xff, 0x6d, 0xa2],
  pinkDark: [0xf9, 0x26, 0x72],

  ground: [0x0f, 0x1a, 0x22],

  bright: [0xee, 0xf2, 0xf5],
  mid: [0xb8, 0xc8, 0xd4],
  dim: [0xa8, 0xc0, 0xd0],
};

export function rgba([red, green, blue], alpha) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
