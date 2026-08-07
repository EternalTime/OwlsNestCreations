# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## The VoidFlux home-page banner

`assets/js/voidflux-*.js` is a port of the VoidFlux game's own rendering, not
freehand web art. The game source lives outside this repo at
`~/firstmate/projects/VoidFlux` and is **read-only**: read it for the authority
on any value, never write to it, never build it, never launch the Simulator.

What is ported from where, so a change here can be checked against the original:

- `Game/Rendering.swift` - the `Palette` hex values (mirrored in
  `assets/js/voidflux-palette.js`) and the additive-glow material recipe.
- `App/TitleView.swift` - `PerspectiveGrid`, ported closed-form into the 2D grid
  canvas. Its lengths are SwiftUI points used directly as CSS pixels, so the
  horizon sits at a fixed pixel offset rather than a fraction of the banner.
- `Game/SceneBuilder.swift` - the gem material, `makeChargeNodes`, and
  `makeGemIdleFloatAction`.
- `assets/data/voidflux-gem.json` is generated from the game's
  `Resources/gem_{vertices,indices,normals}.txt`. Those indices are 1-based.
  Regenerate it rather than editing it by hand.

Two real screen captures in the game repo are the ground truth, and they are
not interchangeable. Sample them rather than eyeballing.

- `design/swipe_tutorial_capture.jpg` judges the *scene*: the gem body there is
  median luminance 5, as dark as the background, with only its top tenth of
  pixels lit, and the loop lines peak near white rather than at flat palette
  colour. Do not judge the grid against it - it is gameplay, where
  `flashState.backdropBase` dims the backdrop to 0.1 and keeps dimming it level
  by level.
- `apple_gameplay/title_screen.png` judges the *grid*, because the title screen
  is the only place `backdropBase` rests at 1.0, which is what the banner is.

The grid geometry is verifiable rather than a matter of taste. Depth row k sits
`g*C/k` px below the horizon and fan line j crosses `d*j/g` px off centre at
depth `d`, with `g = H/(delta*cos(theta))`. Measure a rendered scanline against
those before changing any grid constant.

Four things about this renderer are deliberate and will look wrong if
"simplified":

- The gem is black because of Fresnel, not because it is unlit. A near-black
  albedo is also a metal's normal-incidence reflectance, so facets facing the
  camera reflect almost nothing and only grazing ones light up.
- Which cubemap face lands on those rims depends on where the camera is. The
  lookup is rotated into the game's camera frame, at (4,4,0), or every rim on
  screen comes out pink.
- The shaders write their own colour-space conversion and derive alpha from
  their own output. A flat alpha makes the scene canvas opaque and hides the
  grid canvas behind it.
- The gem shell is deeper than the game's literal 0.1 opacity, and glow falloff
  is baked into the material rather than coming from a bloom pass. Both
  compensate for a lit grid backdrop and the absence of SceneKit bloom.

Depth in the WebGL half is render order alone - every material has depth test
and depth write off, because the additive glows need them off. three.js sorts
on a group's `renderOrder` first and takes it from the *nearest enclosing*
group, so a nested group with its own `renderOrder` silently resets the sort
key for every mesh under it. Keep all groups at zero and order the meshes
(`ORDER` in `voidflux-scene.js`).

## Review before shipping

Visual changes are reviewed by the captain on a running `bundle exec jekyll
serve` build before any push or PR - at every stage, including the last.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
