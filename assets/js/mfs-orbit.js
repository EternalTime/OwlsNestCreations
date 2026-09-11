// The two-body system the My Favorite Spacetimes banner's ground is pinched by:
// where the bodies are, and how deeply each one digs.
//
// It draws nothing and knows nothing about canvases, so it can be imported and
// sampled on its own, which is how all of it is checked: the barycentre holding
// still, the ten-to-one radii, the momenta cancelling, the period repeating and
// the ten-to-one wells are read off these functions rather than off a picture.
//
// The captain asked for a Newtonian orbit, so it is solved as one: Kepler's
// equation for the separation, in the frame where the barycentre stands still
// and the total momentum is zero.

// The star is ten of the gas giant. One number says all three of the things
// that follow from it: the star orbits a tenth as far out, it sits exactly
// opposite, and its well is ten times as deep.
export const MASS_RATIO = 10;
export const HEAVY_SHARE = 1 / (1 + MASS_RATIO);
export const LIGHT_SHARE = MASS_RATIO / (1 + MASS_RATIO);

// Bound and closed, so it repeats for ever. The eccentricity is modest on
// purpose: a circle would hide the speeding up near closest approach, which is
// the one thing about a Kepler orbit that can be seen without measuring it.
export const ECCENTRICITY = 0.38;
export const PERIOD_SECONDS = 26;

// Where the pair stands when the clock starts, as a mean anomaly. A quarter
// turn past closest approach: both bodies well apart and neither at rest, so
// the first frame - which is also the frame a reader who asked for less
// movement is left with - already reads as two.
export const START_ANOMALY = Math.PI / 2;

// Kepler's equation, solved rather than faked. Newton from the usual first
// guess is inside a float of the answer in three turns at this eccentricity,
// and it is solved once a frame, not once a sample.
export function eccentricAnomaly(mean, eccentricity) {
  let anomaly = mean + eccentricity * Math.sin(mean);
  for (let turn = 0; turn < 4; turn += 1) {
    const slope = 1 - eccentricity * Math.cos(anomaly);
    anomaly -= (anomaly - eccentricity * Math.sin(anomaly) - mean) / slope;
  }
  return anomaly;
}

// The ellipse the pair turns on, laid out in the banner's own pixels.
//
// Where the system stands and how wide it swings are facts about the layout, so
// the stylesheet holds them next to the width it changes that layout at, and
// they are read back off the element rather than written here a second time.
export function orbitFrom(banner, width, height) {
  const style = getComputedStyle(banner);
  const share = (name, of_) => (parseFloat(style.getPropertyValue(name)) / 100) * of_;
  const tilt = (parseFloat(style.getPropertyValue('--mfs-orbit-tilt')) * Math.PI) / 180;
  // The stylesheet's swing is how far the gas giant gets from the barycentre at
  // its furthest, and it carries that share of the separation, so the pair's
  // own semi-major axis follows from it.
  const semiMajor = share('--mfs-orbit-swing', height) / (LIGHT_SHARE * (1 + ECCENTRICITY));
  return {
    x: share('--mfs-orbit-x', width),
    y: share('--mfs-orbit-y', height),
    semiMajor,
    semiMinor: semiMajor * Math.sqrt(1 - ECCENTRICITY * ECCENTRICITY),
    cosTilt: Math.cos(tilt),
    sinTilt: Math.sin(tilt),
  };
}

// Where the two bodies are, seconds after the clock started, written into the
// pair given rather than into anything new: this is called every frame.
//
// One Kepler ellipse is solved, for the vector from the star to the gas giant,
// and each body is put on its own scaled copy of it either side of the
// barycentre: the star a tenth as far out as the giant, and on the other side.
// So the pair is always exactly opposite about a point that never moves, and
// the momenta cancel at every instant rather than over a turn.
export function placeBodies(orbit, seconds, pair) {
  const mean = START_ANOMALY + (2 * Math.PI * seconds) / PERIOD_SECONDS;
  const anomaly = eccentricAnomaly(mean, ECCENTRICITY);
  const alongMajor = orbit.semiMajor * (Math.cos(anomaly) - ECCENTRICITY);
  const alongMinor = orbit.semiMinor * Math.sin(anomaly);
  // The orbit's long axis is laid along whichever way the layout is clear.
  const across = alongMajor * orbit.cosTilt - alongMinor * orbit.sinTilt;
  const down = alongMajor * orbit.sinTilt + alongMinor * orbit.cosTilt;

  pair.heavy.x = orbit.x - across * HEAVY_SHARE;
  pair.heavy.y = orbit.y - down * HEAVY_SHARE;
  pair.light.x = orbit.x + across * LIGHT_SHARE;
  pair.light.y = orbit.y + down * LIGHT_SHARE;
  return pair;
}

// ---- what each body does to the ground ----

// The application's own well, whole, for the star: `GridBackground.Dimple`.
// A mass on a rubber sheet leaves the point under it where it was and draws
// everything around it inward, hardest a reach out and fading smoothly to
// nothing after that. There is no edge to it anywhere.
//
// In that well the mass is the depth and the reach is the shape, so the gas
// giant digs a well of the same width and a tenth of the depth. That is the
// only place the mass ratio enters the ground, and it is the same ratio that
// puts the star a tenth as far from the barycentre.
export const MASS_PULL = 26;
export const MASS_REACH = 110;

// Peaks at exactly one reach out, where the root of e puts it at the full pull.
const ROOT_E = 1.6487212707001282;

export function makePair() {
  return {
    heavy: { x: 0, y: 0, pull: MASS_PULL },
    light: { x: 0, y: 0, pull: MASS_PULL / MASS_RATIO },
  };
}

const scratch = { dx: 0, dy: 0 };
const total = { dx: 0, dy: 0 };

export function wellPush(body, x, y, out) {
  const dx = x - body.x;
  const dy = y - body.y;
  // Past four reaches the pull is a thirtieth of a pixel.
  const bound = 4 * MASS_REACH;
  if (Math.abs(dx) > bound || Math.abs(dy) > bound) return false;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.0001) {
    out.dx = 0;
    out.dy = 0;
    return true;
  }
  const spread = distance / MASS_REACH;
  const strength = body.pull * spread * Math.exp((-spread * spread) / 2) * ROOT_E;
  out.dx = (-dx / distance) * strength;
  out.dy = (-dy / distance) * strength;
  return true;
}

// How far the pair together moves the point under them.
//
// The wells add. The website's own rule for its panels is the largest push
// rather than the sum, which is what keeps two sheets over the same place from
// tearing the ground between them, but a gravitational well is not a sheet:
// two masses make one landscape, and taking the larger of them would leave a
// crease along the line half way between the bodies where the winner changes.
export function displacement(x, y, pair) {
  total.dx = 0;
  total.dy = 0;
  if (wellPush(pair.heavy, x, y, scratch)) {
    total.dx += scratch.dx;
    total.dy += scratch.dy;
  }
  if (wellPush(pair.light, x, y, scratch)) {
    total.dx += scratch.dx;
    total.dy += scratch.dy;
  }
  return total;
}
