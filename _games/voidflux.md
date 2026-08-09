---
title: VoidFlux
published_on_site: true
order: 1
tagline: A puzzle in the depths of Electromagnetism.
teaser: Place charges. Bend fields. Balance the flux. Coming to iPhone.
status: In development for iPhone
icon: /assets/img/voidflux-icon.png
title_font: "'Paytone One', sans-serif"
banner: voidflux
description: VoidFlux is a puzzle game built on Gauss' Law, in development for iPhone by Owl's Nest Creations.
---

## The game

VoidFlux is an electrostatics puzzle dressed up as a neon crystal toy from the 80s.
Loops of light strung across a hex lattice, each carrying a number - its flux - that it wants gone, and a tray of charged gems below: teal for positive, pink for negative, one burning core per unit of charge.
Empty the tray with every loop at zero and the board goes quiet.
That quiet is a Void, and it is the only way to win.

Not one of those numbers is written anywhere.
Colour gives a loop its sign, height above the lattice gives its size, and a loop worked back to zero turns the colour of the background and vanishes.
You read the board like a contour map, and by the second round you have stopped noticing you are doing it.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="two-loops"
   alt="An early VoidFlux board at radius three: two hexagonal loops of the same size, one pink and one teal, overlapping across a black crystal, with two charged gems in the tray below."
   caption="Radius three, the smallest board in the game: one loop of each sign, equal and opposite, and two gems in the tray to spend on them." %}
{% include voidflux-shot.html
   name="full-board"
   alt="A VoidFlux board at radius four seen close to face-on: a large teal loop closing into a hexagon around the entire boundary, a pink loop zigzagging across the middle, two small teal loops above it, and five charged gems in the tray below."
   caption="Radius four, opened up until the outer teal ring closes into a full hexagon. That one loop encircles everything, and no face on this board sits outside some loop." %}
</div>

The first levels are nearly free, which is how the game teaches your hands a rule it never says out loud.
Then the loops overlap, and a gem dropped where two of them cross counts for both at once, so a late board with six loops is not six puzzles but one puzzle with six constraints.
The rulebook has not grown by a line; only the reading has.

There is no timer and no penalty for staring at a board for ten minutes, but a placement is a commitment - restart the level all you like, you cannot un-drop a gem - so the work all happens before your thumb comes down.
The crystal swallows a gem whole, and the only trace of your progress is the tray thinning and the loops sinking.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="mid-solve"
   alt="A seven-loop VoidFlux board at radius five, partway through a solve, with two gems left in the tray and one loop collapsed onto the crystal as a flat white outline."
   caption="The widest board in the game, four gems in. The loop driven to zero has gone the colour of the void, leaving only its footprint on the crystal." %}
</div>

Between rounds there is a story, one scene per round: Wittgenstein's *Tractatus* retold in 80s arcade slang, shipping in nine languages, Latin among them, because an 80s *Tractatus* without a Latin edition would be rude.
Synthwave soundtrack, every sound effect a synth, no ads, nothing to buy.

## The physics

Draw any closed surface you like, count how much electric field pokes out through it, and Gauss' Law says that number is the charge you enclosed, divided by a constant whose only job is to fix the units.

That is the whole law, and the fun of it is in everything it refuses to care about.
Slide the charges around inside, dent the surface, stretch it, wrap it tight around one charge or bag all of them loosely - it is imaginary, nobody is stopping you - and the flux does not budge.
One honest number, and everything else thrown away.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="nested-loops"
   alt="A VoidFlux board of concentric hexagonal loops, two pink ones enclosing two teal ones above a black crystal, with gems of several different charges in the tray below."
   caption="Loops nest as freely as Gaussian surfaces do. Two pink hexagons here enclose two teal ones: four different questions asked of the same board." %}
</div>

So VoidFlux never computes a field: every loop is one equation, the gems in your tray are the unknowns, and overlapping loops share unknowns.
Strip the neon off and you are solving a small system of equations over the integers, on a budget.

The best thing on the board is a loop reading zero.
It does not mean the loop is empty - it means whatever is inside sums to zero - and the field along it can be strong and busy the whole way round.
Put a positive gem and a negative gem inside and it reads exactly like a bare loop; the law cannot tell them apart.
Nothing can.
Some of the late boards live in that blind spot, and the game refuses to help: zero is drawn in the colour of the void whether it is empty or merely balanced.
Same silence either way.

Gauss worked the law out in 1835 and never published it; it surfaced in 1867, twelve years after he died.
Maxwell built it into twenty equations in twenty variables, and there it might have stayed, except that Oliver Heaviside - a telegraph operator who left school at sixteen and never held a university post - boiled them down to the four that go on a t-shirt today.
All four say a version of the same thing, that what happens on a boundary is fixed by what is inside it, which is either a coincidence or the best joke in physics.
It is not a coincidence.

None of this is painted on: the win condition is the law itself, run backwards.
You are never shown a charge, only what its field does to a boundary, and asked what must be inside, which is how a great deal of physics actually gets done.
The game never mentions any of this.
You drop a gem, the number moves, and your hands work it out.

If you want to know when it launches, [write to us](mailto:hello@owlsnestcreations.com).
