# Snowball Slinger — agent instructions

Shared brain for any AI agent working in this repo (Codex, Claude Code, etc.).
Read `README.md` first for the game and architecture — this file adds the rules
an agent needs. Stephen is non-technical — explain consequential changes in plain
language.

## What this is

Btown's 3D physics slingshot game: snowballs vs. squirrel snow forts. Plain
static site, **no build step, no npm**: `index.html` + `style.css` + ES modules
in `js/`, three.js and cannon-es vendored as single files in `vendor/`.
Deployed by GitHub Pages via `.github/workflows/deploy.yml` on push.

## The moving parts

- `js/levels.js` — every level is plain data here, plus the shared
  physics/scoring constants. **Tune levels and balance here, not in code.**
- `js/sim.js` — cannon-es world: materials, impact damage, slush blasts,
  sleeping. Deliberately DOM-free so Node can run it headless.
- `js/render.js` — three.js only. Never put game rules in here.
- `js/game.js` — input, aiming, camera choreography, shot/level lifecycle.
- `js/main.js` — screens, progress (localStorage), leaderboard wiring.
- `js/leaderboard.js` — shared Btown monthly board, slug `snowball-slinger`.
  Same file across the fleet; the backend is game-agnostic and slugs
  self-register on first score. Don't fork its behavior.

## Rules

- Keep simulation (`sim.js`) and rendering (`render.js`) separate — that
  split is what makes levels testable headless.
- Performance is a hard requirement on mid-range phones: pixel ratio stays
  capped at 2, geometry stays low-poly, and anything that costs frame rate
  gets cut. `render.js` already auto-drops quality when FPS sags; don't
  remove that.
- No new dependencies, no build step, no analytics, no accounts. The
  leaderboard is the only server feature.
- All names, characters, and art are original to Btown — keep it that way.

## Before you finish

Run `node scripts/test-levels.mjs` — it validates all 12 levels and physics
stability (forts must rest perfectly still). If you touched sim, aiming, or
levels, also play a few levels in a browser at a phone-sized viewport and
say what you verified.
