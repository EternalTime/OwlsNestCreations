---
title: VoidFlux
published_on_site: true
order: 1
tagline: A puzzle in the depths of Electromagnetism.
teaser: Place charges. Bend fields. Balance the flux. Out now on iPhone.
status: Out now on the App Store
icon: /assets/img/voidflux-icon.png
title_font: "'Paytone One', sans-serif"
banner: voidflux
appstore_url: https://apps.apple.com/us/app/voidflux/id6778287432
description: VoidFlux is a puzzle game built on Gauss' Law, out now for iPhone from Owl's Nest Creations.
---

Rad! 
You made it, and just in the knick of time.
There's, like, bright stuff everywhere.
The Void has been disturbed, flux loops have appeared all around, and the dark matter is being drowned.
I've trapped the charges you need in our remaining dark crystals; use them to cancel these fluxes.
It's up to you to bring back the Void!

## The game

VoidFlux is an electrostatics puzzle dressed up as a neon crystal toy from the 80s.
Loops of light strung across a crystal hexagon of dark matter, each carrying a number, its flux, that the dark matter needs gone, and charged crystal gems below: teal for positive, pink for negative, one burning core per quantum of charge.
Use each crystal, bring each loop to zero flux, and the board goes quiet.
That silence is a Void, and it is the only way to win.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="two-loops"
   alt="An early VoidFlux board at radius three: two hexagonal loops of the same size, one pink and one teal, overlapping across a black crystal, with two charged gems in the tray below."
   caption="Radius three, the smallest board in the game. Where would you put the charge to cancel the flux?" %}
{% include voidflux-shot.html
   name="full-board"
   alt="A VoidFlux board at radius four seen close to face-on: a large teal loop closing into a hexagon around the entire boundary, a pink loop zigzagging across the middle, two small teal loops above it, and five charged gems in the tray below."
   caption="Sometimes I feel like the flux is taunting at me. How do I deal with this maniacal mess?" %}
</div>

There is no timer and no penalty for staring at a board for minutes, but placement is commitment: you cannot un-drop a gem, so the work all happens before your thumb comes down.
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

That's the whole law, and the fun of it is in everything it doesn't care about.
Slide the charges around inside, dent the surface, stretch it, wrap it tight around one charge or bag all of them loosely (it is imaginary, nobody is stopping you), and the flux does not budge.

<div class="vf-shots" markdown="0">
{% include voidflux-shot.html
   name="nested-loops"
   alt="A VoidFlux board of concentric hexagonal loops, two pink ones enclosing two teal ones above a black crystal, with gems of several different charges in the tray below."
   caption="Loops nest as freely as Gaussian surfaces do. Two pink hexagons here enclose two teal ones: four different questions asked of the same board." %}
</div>

VoidFlux never computes a field: every loop is one equation, the gems in your tray are the unknowns, and overlapping loops share unknowns.
Strip the neon off and you are solving a small system of equations over the integers, on a budget.

The best thing on the board is a loop reading zero.
It does not mean the loop is empty. It means whatever is inside sums to zero, and the field along it can be strong and busy the whole way round.
Put a positive gem and a negative gem inside and it reads exactly like a bare loop; the law cannot tell them apart.
Nothing can.
Some of the late boards live in that blind spot, and the game refuses to help: zero is drawn in the colour of the void whether it is empty or merely balanced.
Same silence either way.

Gauss worked the law out in 1835 and never published it; it surfaced in 1867, twelve years after he died.
Maxwell built it into twenty equations in twenty variables, and there it might have stayed, except that Oliver Heaviside, a telegraph operator who left school at sixteen and never held a university post, boiled them down to the four that go on a t-shirt today.
All four say a version of the same thing, that what happens on a boundary is fixed by what is inside it, which is either a coincidence or the best joke in physics.
It is not a coincidence.

VoidFlux is out now: <a href="https://apps.apple.com/us/app/voidflux/id6778287432" target="_blank" rel="noopener">get it on the App Store</a>.
Questions? [Write to us](mailto:hello@owlsnestcreations.com).
Writing about VoidFlux? The [press kit](/games/voidflux/press/) has everything.
