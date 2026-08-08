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
Underneath sits a tray of charged gems: teal for positive, pink for negative.
Drop a gem inside a loop and you change what that loop encloses, so its number moves.
Empty the tray with every loop reading zero, and the board goes quiet.
That quiet is a Void, and it is the only way to win.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   alt="a wide VoidFlux board mid-solve, overlapping loops carrying teal and pink flux values"
   need="A wide board mid-solve. Several overlapping loops spanning most of the lattice, with teal (positive) and pink (negative) flux on screen at the same time."
   caption="Loops overlap, so one gem can count for two of them at once." %}
{% include voidflux-shot.html
   alt="the same VoidFlux board solved, every loop reading zero and the gem tray empty"
   need="The same board solved. Every loop at zero, tray empty, both signs still visible in the gems that were placed."
   caption="A Void: every loop silent, every gem spent." %}
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
You are handed a set of fluxes and asked which charges could have produced them.
The game's own story has a name for this: the flux is given, the charge is sought.

The 204 levels did not come from placing gems by hand and hoping.
I wrote a generator, and then I wrote two metrics to argue with it.
The first enumerates a candidate level's entire solution space and scores how scarce the solutions are, in bits.
Three bits plays like a warm-up; ten bits means you will not stumble onto the answer with any probability worth counting on.
The second metric asks whether the overlaps are load-bearing or merely decorative, by checking whether the winning placements use the shared regions at all.
A level that misses either threshold gets redesigned, one at a time, by hand.
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
Dent the surface, stretch it, wrap it tight around one charge or loosely around all of them, and the flux still does not move.
A quantity that ignores almost everything about a configuration and reports one honest number about it is a rare thing, and it is what turns a board of loops into a puzzle rather than a simulation.

VoidFlux never computes a field, because it never needs one.
The number on a loop is the charge enclosed by that loop, in units where the permittivity is one, which is a physicist's habit anyway.
So every loop is one equation, the unknowns are the gems still in your tray, and loops that overlap share unknowns.
That is the real reason overlap is where the difficulty lives: a gem in a shared region appears in two equations at once.
Solving a board is solving that small system over the integers, with a finite tray for a budget.

The board is flat, so its Gaussian surfaces are closed curves rather than closed shells, and that costs less than it sounds.
The integral statement - what crosses the boundary is fixed by what is enclosed - holds in any number of dimensions.
What dimension changes is how a lone charge's field falls off with distance, an inverse square in three dimensions and an inverse first power in two.
The puzzle only ever uses the part that survives the change.

A loop reading zero is the subtlest thing on the board.
It does not mean the loop is empty.
It means the charges inside sum to zero, which is a different claim, and the field along that loop can be strong and structured everywhere while the books still balance.
Drop a positive gem and a negative gem inside one loop and it reads zero, exactly as a bare loop does, and from the outside the law cannot tell those two situations apart.
Some of the late boards are built out of that blind spot.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   alt="a VoidFlux loop reading zero with a teal and a pink gem inside it, overlapping a loop that still carries flux"
   need="A board where one loop reads zero while holding a teal and a pink gem, overlapping a neighbouring loop that still carries flux. Wide layout, both signs visible."
   caption="Zero flux is not an empty loop. It is a loop whose contents cancel." %}
</div>

Gauss' Law is one of Maxwell's four, and it is not the odd one out.
Written as integrals, all four have the same shape: something measured on a boundary is fixed by something accumulated inside it.
The magnetic version reads exactly like the electric one with zero on the right, which is the statement that nobody has ever found a magnetic charge to enclose.
Faraday's law trades the closed surface for a closed curve and says the electric field's circulation around it tracks how fast the magnetic flux through it changes.
Ampère's law, once Maxwell corrected it, says the matching thing for magnetic circulation.
Boundary and interior, four times over.

That family resemblance is not a coincidence, and it is where electromagnetism starts getting deep.
All four are one theorem of calculus in different clothes: what a region accumulates is determined by what happens on its edge.
Push it far enough and the four equations become two, and one of those two is an identity rather than a law, true because of how the field is built rather than because the world happened to come out that way.
Charge conservation stops being a separate assumption at that point and starts being a consequence, forced by the fact that a boundary has no boundary of its own.

None of this is painted on.
The win condition is the law itself, run backwards.
You are never shown a charge in VoidFlux; you are shown what its field does to a boundary and asked to say what must be inside.
That inversion is not a design conceit either, since measuring on a boundary to infer an interior is how a great deal of physics actually gets done, interiors being the part you usually cannot reach.
The game just never says so.
You drop a gem, the number moves, and your hands work it out.

If you want to know when it launches, [write to us](mailto:hello@owlsnestcreations.com).
