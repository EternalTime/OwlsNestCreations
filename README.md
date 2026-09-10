# OwlsNestCreations.com

Studio site for Owl's Nest Creations.
Custom Jekyll build, deployed to GitHub Pages via the Actions workflow in `.github/workflows/pages.yml`.

## Local preview

```
bundle install
bundle exec jekyll serve
```

## Structure

- `_sass/tokens.scss` - studio design tokens (paper, ink, forest green accent).
- `_games/*.md` - one file per game, and the only place a game's words live. Every file in here draws a home-page banner, in the order its `order` sets; `_layouts/home.html` names no game.
- `released:` is the one switch per game. Off, the banner links nowhere and the game's page is not written; on, the "More about" and App Store links appear and the page is published. A game is unreleased until its own file says otherwise (`_config.yml` defaults).
- `_plugins/game_release.rb` is what stops an unreleased page being written, and its comment says why Jekyll's `published: false` cannot do the job alone.
- An unreleased game's page is never in this repository, only its banner. `_games/<name>.md` holds nothing but the banner words the home page already shows in public; everything that would become the page - `_includes/<banner>-page.html`, `_includes/<banner>-copy.md`, `_includes/<banner>-shot.html`, `<name>-press.md` and any pictures - is one block in `.gitignore` per unreleased game. Releasing a game deletes that whole block in the same commit that sets `released: true`, moves the copy into the body of `_games/<name>.md`, and commits the page.
- `banner:` names the game's three pieces: `_includes/<banner>-block.html` (the home-page section), `_includes/<banner>-field.html` (whatever it draws in), and `_includes/<banner>-runtime.html` (the module tag). A released game also needs `_includes/<banner>-page.html` for its own page. The default is `banner: card`, the icon-on-a-gradient block, which needs no code at all: a game that uses it carries its palette in front matter (`gradient_from`, `gradient_mid`, `gradient_to`, `cta_bg`, `cta_text`, `title_font`), so game colors never leak into studio tokens.
- `_includes/game-links.html` is the switch's own markup, shared by every banner, so no banner decides for itself whether a game links anywhere.
- `_includes/voidflux-shot.html` is an in-game capture, taking a `name` stem that resolves to an AVIF/JPEG pair under `assets/img/`.
- `assets/lib/katex/` - vendored KaTeX (stylesheet, fonts, `katex.min.js`, `contrib/auto-render.min.js`), pinned rather than CDN-loaded like three.js; update it by unzipping a new `katex.zip` release over the directory. A page opts in with `math: true` in its front matter, which is what makes `_layouts/default.html` load it; equations are then written as `$$ ... $$` in Markdown.
- `assets/js/lib/` - vendored three.js, pinned rather than CDN-loaded, so the site keeps its no-build-step, no-third-party-runtime setup. Update it by replacing the files; the bundle's own `REVISION` export is the version of record.
- `_includes/owl-glyph.svg` - the owl mark; colors follow CSS variables.
- `CNAME` - custom domain for GitHub Pages.
