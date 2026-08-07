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
- `banner: voidflux` swaps that game's home-page block for the live VoidFlux scene (`assets/js/voidflux-*.js`); without it the block falls back to the gradient. See `AGENTS.md` for what that scene is ported from.
- `_includes/owl-glyph.svg` - the owl mark; colors follow CSS variables.
- `CNAME` - custom domain for GitHub Pages.
