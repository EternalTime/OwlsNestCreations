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

More soon.
If you want to know when it launches, [write to us](mailto:hello@owlsnestcreations.com).
