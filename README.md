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
- `_games/*.md` - one file per game, and the only place a game's words live. Every game is shaped the same way and only `released:` tells one from another. Each file is front matter plus the one line that includes the game's page copy; every file in here draws a home-page banner, in the order its `order` sets, and `_layouts/home.html` names no game.
- Every game carries the same front-matter keys. `title`, `banner_title` (the name as the banner sets it, which may carry a `<br>`), `tagline` and `order` have no default, so every game states them. The rest default in `_config.yml`, which is where that shape is written down: `released`, `page_unlisted`, `banner`, `teaser`, `description`, `math`, `platforms` and `release_date`. Two keys follow the switch - `release_note` while the game is unreleased, `appstore_url` once it is out. A banner may read keys of its own on top of these: `title_font` for the face the game's name is set in, and for the card banner `icon`, `status` and its palette (`gradient_from`, `gradient_mid`, `gradient_to`, `cta_bg`, `cta_text`), so game colors never leak into studio tokens.
- `released:` is the one switch per game. Off, the banner links nowhere and the game's page is not written; on, the "More about" and App Store links appear and the page is published. A game is unreleased until its own file says otherwise.
- `page_unlisted:` publishes an unreleased game's page ahead of the game: the page is written and reachable by its URL, but the banner still links nowhere and `llms.txt`, `data/games.json` and the schema.org data do not name it. It comes out of the game's file when `released:` goes on. My Favorite Spacetimes is the game that has it on, with its page, copy, pictures and press kit committed.
- The site describes itself to machines from the same files, and none of it is visible. `llms.txt` is the index for language models (llmstxt.org), `data/games.json` lists every game, and `_includes/agent-meta.html` puts schema.org JSON-LD in the head: the studio on the home page, the game on a released game's page, read from its `platforms`, `release_date`, `icon` and `appstore_url`. An unreleased game appears in all of them with only what its banner already shows. The founder and his own llms.txt are `founder` in `_config.yml`.
- Rights are reserved in five places that say the same thing: the footer's copyright line, `_includes/use-of-material.md` (read into both `llms.txt` and `data/games.json`), the `copyright` and `tdm-reservation` meta tags, `.well-known/tdmrep.json` (W3C TDMRep, which is why `_config.yml` has to `include` that directory), and `robots.txt`, which lets every search engine and user-directed agent in and turns away the crawlers that gather training data. Crawler names change; check the list against a current directory such as github.com/ai-robots-txt/ai.robots.txt before adding to it.
- `_plugins/game_release.rb` is what stops an unreleased page being written, and its comment says why Jekyll's `published: false` cannot do the job alone.
- `banner:` names the game's pieces, and every game has the same set: `_includes/<banner>-block.html` (the home-page section), `_includes/<banner>-field.html` (whatever it draws in), `_includes/<banner>-runtime.html` (the module tag), `_includes/<banner>-page.html` (its own page), `_includes/<banner>-copy.md` (that page's prose), `_includes/<banner>-shot.html` (one in-game capture, taking a `name` stem that resolves to an AVIF/JPEG pair under `assets/img/`), and `<name>-press.md` at the root (the press kit). The default is `banner: card`, the icon-on-a-gradient block, which needs no code at all beyond the card's own four files.
- An unreleased game's page is never in this repository, only its banner, unless `page_unlisted:` publishes it. The last four pieces, and any pictures, are one block in `.gitignore` per unreleased game; the blocks all list the same pieces in the same order. Releasing a game deletes its whole block in the same commit that sets `released: true` and commits the files. Nothing moves and nothing is rewritten, because a game's page copy lives in `_includes/<banner>-copy.md` whether or not the game is out.
- `_plugins/include_optional.rb` is what lets a piece be genuinely absent. Jekyll renders a document's Liquid whether or not the document will be written, so the copy line in an unreleased game's file has to skip a copy file that is not there. Only that line uses it; a banner's block, field and runtime stay plain includes, so a typo in `banner:` is still a build error.
- `_includes/game-blurb.html` is the words beside every banner - name, tagline, teaser and links - so a banner owns its picture and nothing else. `_includes/game-links.html` inside it is the switch's own markup, so no banner decides for itself whether a game links anywhere.
- `assets/lib/katex/` - vendored KaTeX (stylesheet, fonts, `katex.min.js`, `contrib/auto-render.min.js`), pinned rather than CDN-loaded like three.js; update it by unzipping a new `katex.zip` release over the directory. A page opts in with `math: true` in its front matter, which is what makes `_layouts/default.html` load it; equations are then written as `$$ ... $$` in Markdown.
- `assets/js/lib/` - vendored three.js, pinned rather than CDN-loaded, so the site keeps its no-build-step, no-third-party-runtime setup. Update it by replacing the files; the bundle's own `REVISION` export is the version of record.
- `_includes/owl-glyph.svg` - the owl mark; colors follow CSS variables.
- `CNAME` - custom domain for GitHub Pages.
