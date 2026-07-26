# SNOWBALL SLINGER 🐿️❄️

Burlington's gray squirrels raided the winter **maple-candy stash** and built
snow forts all over town to hoard it. Slingshot snowballs, topple the forts,
bonk the squirrels (they dizzy-spiral away unharmed), and win the candy back.
A real-3D physics slingshot game for [Btown Games](https://play.btownbrief.com/),
the browser arcade of the [BTown Brief](https://www.btownbrief.com).

**Play it live:** https://play.btownbrief.com/snowball-slinger/

## The game

12 handcrafted levels across four Burlington backdrops — Battery Park, the
Waterfront, Oakledge, and Church Street under the marquee lights — all at
golden hour, with drifting snow and soft shadows.

- **Materials:** snow blocks crumble, ice is heavy and slick but shatters,
  wooden planks are light, sturdy, and bouncy.
- **Ammo:** the standard **snowball**; the **slushball** (unlocks level 5 —
  splats wide and shoves structures); the **iceball** (unlocks level 8 —
  dense, smashes through).
- **Scoring:** damage + squirrel bonks + 1,500 per unused snowball, rated
  1–3 maple stars per level. Clear a level by getting every squirrel.
- Your **total score across all levels** goes to the shared Btown monthly
  leaderboard.

## How it works

Plain static site — no build step, no npm. `index.html` + `style.css` + ES
modules in `js/`:

| file | what it does |
| --- | --- |
| `js/levels.js` | all 12 levels as plain data + physics/scoring constants |
| `js/sim.js` | rigid-body simulation (cannon-es): materials, damage, blasts, sleeping — DOM-free |
| `js/render.js` | three.js view: low-poly Burlington locales, parallax, snow, camera, juice |
| `js/game.js` | one level attempt: drag-to-aim, trajectory hint, shots, win/lose |
| `js/main.js` | screens, level map, star progress, leaderboard wiring |
| `js/audio.js` | procedural WebAudio sfx, no audio files |
| `js/leaderboard.js` | shared monthly Supabase leaderboard (game slug `snowball-slinger`) |
| `vendor/` | three.js + cannon-es, vendored as single ES-module files |

Every push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Checking the levels

```bash
node scripts/test-levels.mjs
```

No framework. Validates every level statically (bounds, support, ascending
star thresholds, ammo sanity) and then **runs the real physics headless**:
each fort must sit perfectly still for 6 simulated seconds with every body
asleep. If a level would jitter or collapse on its own, this fails.

## Regenerating the social/app images

```bash
python3 -m http.server 8000  # from the repo root
# og image is a live screenshot of the real 3D scene (level 12, no UI) — needs WebGL,
# so use the new headless mode and give it a moment to render:
chrome --headless=new --screenshot=og-image.png --window-size=1200,630 --virtual-time-budget=6000 "http://localhost:8000/tools/og.html"
chrome --headless --screenshot=icon-180.png --window-size=180,180 "http://localhost:8000/tools/og.html?icon"
```

## Vendored libraries

- [three.js](https://threejs.org) r160 (`vendor/three.module.min.js`) — MIT license
  (notice in the file's own header)
- [cannon-es](https://github.com/pmndrs/cannon-es) 0.20.0 (`vendor/cannon-es.js`) — MIT license
  (full text in `vendor/cannon-es.LICENSE.txt`)

Both are checked in as single files on purpose: the site has no package
manager and no build step.
