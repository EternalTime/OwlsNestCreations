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
A board is a hex lattice with loops of light strung across it, and the loops overlap, nest, and braid.
Each loop carries a single number, its flux, and each one would like that number gone.
Underneath sits a tray of charged gems: teal for positive, pink for negative, with as many cores burning inside a gem as it carries units of charge.
Drop a gem inside a loop and you change what that loop encloses, so its number moves.
Empty the tray with every loop reading zero, and the board goes quiet.
That quiet is a Void, and it is the only way to win.

Not one of those numbers is written anywhere on the board.
A loop declares its sign the way the gems do, by colour, and declares how much it carries by how high it floats above the crystal.
A loop deep in the negative rides up out of the lattice; work it back toward zero and it sinks, and when it arrives it takes on the colour of the background and disappears into it.
You end up reading the board the way you read a contour map, and by the second round you have stopped noticing that you are doing it.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="two-signs"
   alt="A VoidFlux board: a black hexagonal crystal on a neon perspective grid, pink loops of light floating over its left half and teal loops over its right, with charged gems waiting in a tray below."
   caption="Pink to the left, teal to the right. Colour gives a loop its sign, and altitude gives its size." %}
{% include voidflux-shot.html
   name="seven-loops"
   alt="The densest VoidFlux board: seven overlapping loops, five teal and two pink, strung above a black hexagonal crystal, with six gems in the tray below."
   caption="The widest board in the game, carrying seven loops. Where two of them cross, one gem counts for both." %}
</div>

The opening levels are nearly free, and they are meant to be.
One loop, one number, one gem that plainly belongs inside it: the game is teaching your hands a rule it never says out loud.
Depth arrives with the overlaps.
Where two loops share a region, a gem dropped in that region counts for both of them at once, and the two numbers stop being separate problems.
A late board with six loops layered over one another is not six puzzles.
It is one puzzle with six constraints, and the few gems left in your tray have to satisfy all of them together.
The rulebook has not grown by a line; the reading has.

Nothing here rewards speed.
There is no timer, no dexterity check, and no penalty for sitting still and staring at a board for ten minutes.
What the game asks is that you read the board before you touch it, because a placement is a commitment - you can restart a level, but you cannot un-drop a gem - and all of the interesting work happens before your thumb comes down.
A dropped gem is swallowed by the crystal and leaves no mark on the face that took it, so the only record of what you have done is the tray thinning out and the loops settling toward the lattice.
You are handed a set of fluxes and asked which charges could have produced them.
The game's own story has a name for this: the flux is given, the charge is sought.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="mid-solve"
   alt="The same seven-loop VoidFlux board partway through a solve, with two gems left in the tray and one loop collapsed onto the crystal as a flat white outline."
   caption="Four gems in. The loop that has been driven to zero has gone the colour of the void, leaving only its footprint on the crystal." %}
</div>

The 204 levels did not come from placing gems by hand and hoping.
I wrote a generator, and then I wrote two metrics to argue with it.
The first enumerates a candidate level's entire solution space and scores how scarce the solutions are, in bits.
Three bits plays like a warm-up; ten bits means you will not stumble onto the answer with any probability worth counting on.
The second metric asks whether the overlaps are load-bearing or merely decorative, by checking whether the winning placements use the shared regions at all.
A level that misses either threshold gets redesigned by hand, one at a time (there is no clever way to do this part, and I went looking).
What shipped is 204 survivors across 37 rounds, and the climb from three bits to ten is the shape of the campaign.

Between rounds there is a story, one scene per round, and it is Wittgenstein's *Tractatus* retold in 80s arcade slang.
It ends where the game ends: whereof one cannot speak, thereof one must be silent.
The whole telling ships in nine languages, Latin among them, because an 80s *Tractatus* without a Latin edition would be rude.
Synthwave carries the soundtrack and every sound effect is a synth.
There are no ads and there is nothing to buy.

## The physics

Draw any closed surface you like.
Count how much electric field pokes out through it, adding what leaves and subtracting what enters, and you have the flux through that surface.
Gauss' Law says that number equals the charge enclosed, divided by the permittivity of free space.
That is the whole law.
It says nothing about where inside the surface the charge sits, and nothing about what shape you drew.

The second half of that is the part worth sitting with.
Slide the charges around inside, and as long as none of them crosses out, the flux does not move.
Dent the surface, stretch it, wrap it tight around one charge or loosely around all of them (the surface is imaginary, so nothing is stopping you), and the flux still does not move.
A quantity that ignores almost everything about a configuration and still reports one honest number about it is a remarkable thing, and it is what turns a board of loops into a puzzle rather than a simulation.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="nested-loops"
   alt="A VoidFlux board of concentric hexagonal loops, two pink ones enclosing two teal ones above a black crystal, with gems of several different charges in the tray below."
   caption="Loops nest as freely as Gaussian surfaces do. Two pink hexagons here enclose two teal ones: four different questions asked of the same board." %}
</div>

VoidFlux never computes a field, because it never needs one.
The number on a loop is the charge enclosed by that loop, in units where the permittivity is one, which is a physicist's habit anyway.
So every loop is one equation, the unknowns are the gems still in your tray, and loops that overlap share unknowns.
That is the real reason overlap is where the difficulty lives: a gem in a shared region appears in two equations at once.
Stripped of the neon, solving a board is solving that small system over the integers, with a finite tray for a budget.

The board is flat, so its Gaussian surfaces are closed curves rather than closed shells, and that costs less than it sounds.
The integral statement - what crosses the boundary is fixed by what is enclosed - holds in any number of dimensions.
What dimension changes is how a lone charge's field falls off with distance, an inverse square in three dimensions and an inverse first power in two.
The puzzle only ever uses the part that survives the change.

A loop reading zero is the subtlest thing on the board.
It does not mean the loop is empty.
It means the charges inside sum to zero, which is a different claim, and the field along that loop can be strong and structured everywhere while the books still balance.
Drop a positive gem and a negative gem inside one loop and it reads zero, exactly as a bare loop does, and from the outside the law cannot tell those two situations apart.
Some of the late boards are built out of that blind spot.
The game commits to the ambiguity rather than hedging it: a loop at zero is drawn in the colour of the void whether it is empty or merely balanced, and it is the same silence either way.

Carl Friedrich Gauss worked the law out in 1835 and never published it; it surfaced in 1867, twelve years after he was dead.
By then James Clerk Maxwell had folded it into a set of twenty equations in twenty variables, and it fell to Oliver Heaviside, a self-taught telegraph operator who never held a university post, to boil those down in 1884 to the four we teach today.
Gauss' Law is one of them, and it is not the odd one out: written as integrals, all four have the same shape, something measured on a boundary fixed by something accumulated inside it.
Indeed, the magnetic version reads exactly like the electric one with zero on the right, which is the statement that nobody has ever found a magnetic charge to enclose.
Faraday's law trades the closed surface for a closed curve and says the electric field's circulation around it tracks how fast the magnetic flux through it changes.
Ampère's law, once Maxwell corrected it, says the matching thing for magnetic circulation.
Boundary and interior, four times over.

Why should four laws about different things keep saying the same thing?

The resemblance is not a coincidence, and it is where electromagnetism starts getting deep.
All four are one theorem of calculus in different clothes: what a region accumulates is determined by what happens on its edge.
Push it far enough and the whole edifice folds down to two equations, one of which is an identity rather than a law, true because of how the field is built rather than because the world happened to come out that way.
Charge conservation stops being a separate assumption at that point and starts being a consequence, forced by the fact that a boundary has no boundary of its own.

None of this is painted on.
The win condition is the law itself, run backwards.
You are never shown a charge in VoidFlux; you are shown what its field does to a boundary and asked to say what must be inside.
That inversion is not a design conceit either, since measuring on a boundary to infer an interior is how a great deal of physics actually gets done, interiors being the part we usually cannot reach.
The game just never says so.
You drop a gem, the number moves, and your hands work it out.

If you want to know when it launches, [write to us](mailto:hello@owlsnestcreations.com).
