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

The game gets its neon from a SceneKit bloom pass, which has no cheap WebGL
equivalent here. Two places compensate deliberately and will look wrong if
"corrected" back to the literal values: glow alpha falls off with how squarely a
facet faces the camera, and the gem hull gets a second additive pass on top of
its 10%-opaque shell.

## Review before shipping

Visual changes are reviewed by the captain on a running `bundle exec jekyll
serve` build before any push or PR - at every stage, including the last.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
