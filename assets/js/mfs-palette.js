// The palette of My Favorite Spacetimes, which is the captain's own.
//
// Taken unchanged from `Palette.swift` in the application
// (~/OwlsNest/MyFavoriteSpacetimes/Packages/Spacetimes/Sources/SpacetimesLook),
// which took them from `assets/css/palette.css` on his own website. This is the
// only place in the banner where a colour is a number.

export const Palette = {
  tealDark: [0x23, 0xbb, 0xad],
  tealLight: [0x25, 0xd9, 0xc8],
  cyan: [0x2a, 0xbe, 0xd9],
  pinkLight: [0xff, 0x6d, 0xa2],
  pinkDark: [0xf9, 0x26, 0x72],

  void: [0x04, 0x04, 0x0e],
  deep: [0x0f, 0x1a, 0x22],
  panel: [0x16, 0x21, 0x2a],

  bright: [0xee, 0xf2, 0xf5],
  mid: [0xb8, 0xc8, 0xd4],
  dim: [0xa8, 0xc0, 0xd0],
};

export function rgba([red, green, blue], alpha) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
