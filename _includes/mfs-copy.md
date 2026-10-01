{% comment %}
  First draft of the app and physics sections, for the captain to edit. The
  pictures are iPhone captures of the app's diagrams, cropped as AGENTS.md says.
{% endcomment %}

My Favorite Spacetimes is a living reference for general relativity.
It collects spacetimes, the solutions of Einstein's equations, each with its metric, its diagrams, its history, and its references.
It runs on iPhone, iPad, Mac, Apple TV, and Vision Pro.

## The app

Pick a spacetime from the list, or search for it by name or by tag (*vacuum*, *rotating*, *closed timelike curves*).
The History section gives a comprehensive background on who discovered the spacetime, when, and what happened since, each claim referenced in a bibliography with external links.
The Maths section lays out the different coordinate charts used for the spacetime, the line element and metric, Christoffel symbols, and various tensors common to GR calculations.
A Graphs section draws out the spacetime: its spacetime diagrams for the various charts, as well as conformal and embedding diagrams. Several of these are animated, and the three-dimensional ones turn under your finger.

Favorite the spacetimes you keep coming back to.
On larger screens you can compare two spacetimes side by side.
Ask Siri or search Spotlight for a spacetime by name and the app opens straight to it.
Since it is a living reference, expect updates.
If you're a researcher that wants their spacetime added to the list, contact me. 

The app ships with Minkowski space and fetches the rest of the collection, which keeps growing, from the website the first time you open each one; after that it stays on your device.
It is free, with no ads (but feel free to buy the author a coffee using the tip jar!).

<div class="mfs-shots" markdown="0">
{% include mfs-shot.html
   name="kerr-conformal"
   alt="The conformal diagram of the equatorial plane of Kerr spacetime: a tower of exterior, black hole and white hole regions, with the ring singularity r = 0 drawn as two jagged vertical edges."
   caption="The conformal diagram of the equatorial plane (θ = π/2) of the maximally extended Kerr spacetime (a = 0.9 GM/c²), the ring singularity the jagged timelike edge r = 0." %}
{% include mfs-shot.html
   name="mixmaster-embedding"
   alt="The embedding diagram of a Mixmaster universe: a surface of revolution with two round lobes joined at a narrow waist, labelled cτ = 2.83 m."
   caption="The great two sphere of a Mixmaster universe's three sphere (cτ = 2.83 m), two lobes joined at a narrow waist." %}
</div>

## The physics

General relativity is Einstein's magnum opus: it says that gravity is geometry: matter and energy curve spacetime, and particles and light move along its straightest paths.
Einstein wrote the whole theory as one tensor equation,

$$
G_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}
$$

ten coupled, nonlinear partial differential equations for the metric $$g_{\mu\nu}$$, the object that turns separations in coordinates into the times and distances clocks and rulers measure.
A spacetime is a solution: a metric, together with the coordinates it is written in.

Exact solutions are rare, and each one has a fascinating story behind it.
Karl Schwarzschild found the first within weeks of Einstein's paper, while serving with the German army on the Russian front, and it took until 1963 for Roy Kerr to find the field of a rotating mass.
The collection gathers many of them, from Minkowski's flat space to Gödel's rotating universe, Alcubierre's warp drive, and the chaotic collapse of the Mixmaster universe.

A metric is hard to visualize, even for a physicist, so the app draws each spacetime three ways.
A spacetime diagram plots light cones in the coordinates of the metric, showing where light can go from each event.
A conformal diagram, the kind Roger Penrose and Brandon Carter introduced in the 1960s, squeezes all of spacetime, infinity included, onto a finite page while keeping light rays at 45 degrees, so horizons, singularities, and the regions an observer can and cannot reach are visible at once.
An embedding diagram takes a slice of space and draws it as a surface in flat space, every distance along the surface the metric distance, and that is how the Ellis-Bronnikov wormhole's throat and the cosmic string's missing wedge appear below.

<div class="mfs-shots" markdown="0">
{% include mfs-shot.html
   name="ellis-bronnikov-embedding"
   alt="The embedding diagram of the Ellis-Bronnikov wormhole in My Favorite Spacetimes: two flared sheets joined through a throat marked r = 0, with circles marked 2ℓ and -2ℓ on either side."
   caption="The equatorial plane (θ = π/2) of the Ellis-Bronnikov wormhole at one moment of t, a catenoid with its throat at r = 0." %}
{% include mfs-shot.html
   name="cosmic-string-cone"
   alt="The embedding diagram of the Vilenkin-Gott cosmic string in My Favorite Spacetimes: a cone cut from its apex to its rim and unrolled almost flat, the two edges of the cut standing apart across an open wedge, labelled Δφ = 35°."
   caption="The cone of an ideal Vilenkin-Gott cosmic string (4Gμ/c² = 0.1, δ = 36°), cut along φ = 0 and unrolled to Δφ = 35°." %}
</div>

The collection is also online at [damiansowinski.com/MFS](https://damiansowinski.com/MFS/).
Questions? [Write to us](mailto:hello@owlsnestcreations.com).
Writing about My Favorite Spacetimes? Start with the [press kit](/games/my-favorite-spacetimes/press/).
