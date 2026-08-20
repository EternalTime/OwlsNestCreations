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
- `_games/*.md` - one file per public game. Each game carries its own palette in front matter (`gradient_from`, `gradient_mid`, `gradient_to`, `cta_bg`, `cta_text`, `title_font`); the layouts read those, so game colors never leak into studio tokens.
- Set `published_on_site: true` in a game's front matter to put it on the home page.
- `banner: voidflux` swaps that game's home-page block *and* its game page for the live VoidFlux scene (`assets/js/voidflux-*.js`); without it both fall back to the gradient, which is why VoidFlux itself carries no `gradient_*` or `cta_*` keys.
- `_includes/voidflux-field.html` (the canvas pair), `_includes/voidflux-runtime.html` (the module tag), and `_includes/voidflux-shot.html` (an in-game capture, taking a `name` stem that resolves to an AVIF/JPEG pair under `assets/img/`) are shared by both layouts.
- `assets/js/lib/` - vendored three.js, pinned rather than CDN-loaded, so the site keeps its no-build-step, no-third-party-runtime setup. Update it by replacing the files; the bundle's own `REVISION` export is the version of record.
- `_includes/owl-glyph.svg` - the owl mark; colors follow CSS variables.
- `CNAME` - custom domain for GitHub Pages.
