// Physics+ Applets/PhysicsPlus/colours.css is the colour authority.
export const palette = Object.freeze({
  ink: '#160125',
  inkFoot: '#0d0018',
  hot: '#f66298',
  coral: '#fe7d78',
  rose: '#ff6a83',
  magenta: '#cf318e',
  purple: '#cc38ae',
  plum: '#a225a2',
  gold: '#ea9760',
  terra: '#b96751',
  steel: '#4a73ad',
  light: '#cfc2b8',
  outer: '#1a0032',
  band: '#5a0370',
  bandDeep: '#890088',
  rim: '#fbfffc',
  palm: '#ffffff2e',
});

// Look.sunset and Look.sunsetStops, from the top of the title to its foot.
export const sunset = Object.freeze([
  [0, '#375ec3'], [0.12, '#3a43c0'], [0.20, '#6b3ebe'],
  [0.30, '#b43fc7'], [0.40, '#d830a8'], [0.50, '#e9429e'],
  [0.60, '#ff80a1'], [0.70, '#ff706f'], [0.75, '#fb7a63'],
  [0.85, '#ff9360'], [0.90, '#fd963e'], [1, '#ffa342'],
].map(Object.freeze));
