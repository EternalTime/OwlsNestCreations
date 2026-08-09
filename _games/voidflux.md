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
A board is a hex lattice with loops of light strung across it, overlapping and nesting and braiding through one another.
Every loop carries a number - its flux - and every loop wants that number gone.
Underneath sits a tray of charged gems, teal for positive and pink for negative, with as many cores burning inside a gem as it carries units of charge.
Drop a gem inside a loop and you change what that loop encloses, so its number moves.
Empty the tray with every loop reading zero and the board goes quiet.
That quiet is a Void, and it is the only way to win.

Not one of those numbers is written anywhere.
A loop tells you its sign by colour and its size by how high it floats, so a loop deep in the negative rides up out of the lattice, and as you work it back toward zero it sinks.
When it lands it turns the colour of the background and vanishes into it.
You end up reading the board like a contour map, and by the second round you have stopped noticing you are doing it.

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

The first levels are nearly free, and they are meant to be: one loop, one number, one gem that obviously belongs inside it.
The game is teaching your hands a rule it never says out loud.
Then the loops start to overlap, and a gem dropped where two of them cross counts for both at once.
A late board with six loops layered over each other is not six puzzles.
It is one puzzle with six constraints and a handful of gems left to satisfy all of them, and the rulebook has not grown by a line.
Only the reading has.

Nothing here rewards speed.
There is no timer, no dexterity check, no penalty for staring at a board for ten minutes.
What the game wants is that you read before you touch, because a placement is a commitment - restart the level all you like, but you cannot un-drop a gem - and all the interesting work happens before your thumb comes down.
The crystal swallows a gem whole and leaves no mark where it went, so the only trace of your progress is the tray thinning out and the loops sinking.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="mid-solve"
   alt="A seven-loop VoidFlux board at radius five, partway through a solve, with two gems left in the tray and one loop collapsed onto the crystal as a flat white outline."
   caption="The widest board in the game, four gems in. The loop driven to zero has gone the colour of the void, leaving only its footprint on the crystal." %}
</div>

The 204 levels did not come from placing gems by hand and hoping.
I wrote a generator, and then I wrote two metrics to argue with it.
The first enumerates a candidate level's whole solution space and scores how scarce the solutions are, in bits: three bits plays like a warm-up, ten bits means you will not stumble onto the answer by luck.
The second asks whether the overlaps are load-bearing or merely decorative, by checking whether the winning placements use the shared regions at all.
Anything that misses either threshold goes back to be redesigned by hand, one at a time, because there is no clever way to do that part and I went looking.
What shipped is 204 survivors across 37 rounds, and the climb from three bits to ten is the shape of the campaign.

Between rounds there is a story, one scene per round, and it is Wittgenstein's *Tractatus* retold in 80s arcade slang.
It ends where the game ends: whereof one cannot speak, thereof one must be silent.
The whole thing ships in nine languages, Latin among them, because an 80s *Tractatus* without a Latin edition would be rude.
Synthwave carries the soundtrack and every sound effect is a synth.
No ads, nothing to buy.

## The physics

Draw any closed surface you like.
Count how much electric field pokes out through it, adding what leaves and subtracting what comes back in, and you have the flux through that surface.
Gauss' Law says that number is the charge you enclosed, divided by a constant whose only job is to fix the units.

That is the whole law, and the fun of it is in everything it refuses to care about.
Slide the charges around inside; as long as none of them crosses out, the flux does not budge.
Dent the surface, stretch it, wrap it tight around one charge or bag all of them loosely - the surface is imaginary, nobody is stopping you - and the flux still does not budge.
It does not care where the charge sits.
It does not care what shape you drew.
It throws away everything except one honest number, which is exactly what makes a board of loops a puzzle instead of a simulation.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="nested-loops"
   alt="A VoidFlux board of concentric hexagonal loops, two pink ones enclosing two teal ones above a black crystal, with gems of several different charges in the tray below."
   caption="Loops nest as freely as Gaussian surfaces do. Two pink hexagons here enclose two teal ones: four different questions asked of the same board." %}
</div>

So VoidFlux never computes a field, because it never needs one.
Every loop is one equation, the gems in your tray are the unknowns, and loops that overlap share unknowns, which is the real reason overlap is where the difficulty lives.
Strip the neon off and you are solving a small system of equations over the integers, on a budget.

The best thing on the board is a loop reading zero.
It does not mean the loop is empty.
It means whatever is inside sums to zero, which is a different claim entirely, and the field along that loop can be strong and busy everywhere while the books still balance.
Put a positive gem and a negative gem inside one loop and it reads zero, exactly as a bare loop does, and from outside the law cannot tell those two situations apart.
Nothing can.
Some of the late boards are built out of that blind spot, and the game refuses to help you: a loop at zero is drawn in the colour of the void whether it is empty or merely balanced.
Same silence either way.

The law is older than the way we write it.
Gauss worked it out in 1835 and never published it; it turned up in 1867, twelve years after he died.
Maxwell built it into a set of twenty equations in twenty variables, and there it might have stayed, except that Oliver Heaviside - a telegraph operator who left school at sixteen and never held a university post - sat down and boiled those twenty into the four that go on a t-shirt today.
All four say a version of the same thing, that what happens on a boundary is fixed by what is inside it, which is either a coincidence or the best joke in physics.
It is not a coincidence.

None of this is painted on.
The win condition is the law itself, run backwards: you are never shown a charge in VoidFlux, you are shown what its field does to a boundary and asked what must be inside.
That is not a design conceit either, since measuring on a boundary to work out an interior is how a great deal of physics actually gets done, interiors being the part we usually cannot reach.
The game never mentions any of this.
You drop a gem, the number moves, and your hands work it out.

If you want to know when it launches, [write to us](mailto:hello@owlsnestcreations.com).
