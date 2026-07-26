#!/usr/bin/env node
// SNOWBALL SLINGER — level checker. Plain Node, no test framework.
//   node scripts/test-levels.mjs
//
// Static checks on every level (bounds, support, stars, ammo), then a real
// physics settle test: build each fort in cannon-es, run 6 simulated seconds,
// and fail if any block drifts or the stack never falls asleep. That is the
// "no jittering forts" guarantee, proven headless.

import {
  LEVELS, MATERIALS, AMMO, SCORE, SQUIRREL, WORLD_BOUNDS, maxPossibleScore,
} from '../js/levels.js';
import { createSim } from '../js/sim.js';

let failures = 0;
const fail = (level, msg) => { failures++; console.error(`  ✗ [${level}] ${msg}`); };

console.log(`Checking ${LEVELS.length} levels…\n`);
if (LEVELS.length !== 12) fail('meta', `expected 12 levels, found ${LEVELS.length}`);

LEVELS.forEach((level, i) => {
  const id = `L${i + 1} ${level.name}`;

  // --- static checks -------------------------------------------------------
  if (!level.blocks.length) fail(id, 'no blocks');
  if (!level.squirrels.length) fail(id, 'no squirrels — level would auto-clear');
  if (!['battery', 'waterfront', 'oakledge', 'church'].includes(level.locale)) {
    fail(id, `unknown locale "${level.locale}"`);
  }

  for (const b of level.blocks) {
    if (!MATERIALS[b.m]) fail(id, `unknown material "${b.m}"`);
    const bottom = b.y - b.h / 2;
    if (bottom < -0.001) fail(id, `block at x=${b.x} sunk below ground (bottom=${bottom.toFixed(2)})`);
    if (b.x - b.w / 2 < WORLD_BOUNDS.minX || b.x + b.w / 2 > WORLD_BOUNDS.maxX) {
      fail(id, `block at x=${b.x} out of horizontal bounds`);
    }
    if (b.y + b.h / 2 > WORLD_BOUNDS.maxY) fail(id, `block at x=${b.x} too tall (top=${b.y + b.h / 2})`);
    // every block must rest on ground or on another block (no floaters)
    if (bottom > 0.02) {
      const supported = level.blocks.some((o) => o !== b
        && Math.abs((o.y + o.h / 2) - bottom) < 0.03
        && Math.abs(o.x - b.x) < (o.w + b.w) / 2 - 0.02);
      if (!supported) fail(id, `block at (${b.x}, ${b.y}) floats with nothing under it`);
    }
  }

  for (const s of level.squirrels) {
    if (s.x < WORLD_BOUNDS.minX || s.x > WORLD_BOUNDS.maxX) fail(id, `squirrel at x=${s.x} out of bounds`);
    const bottom = s.y - SQUIRREL.h / 2;
    if (bottom < -0.001) fail(id, `squirrel at x=${s.x} sunk below ground`);
    if (bottom > 0.02) {
      const supported = level.blocks.some((o) =>
        Math.abs((o.y + o.h / 2) - bottom) < 0.05
        && Math.abs(o.x - s.x) < (o.w + SQUIRREL.w) / 2 - 0.02);
      if (!supported) fail(id, `squirrel at (${s.x}, ${s.y}) floats with nothing under it`);
    }
  }

  // stars: exactly three, ascending, reachable, and any clear earns at least 1★
  if (level.stars.length !== 3) fail(id, 'need exactly 3 star thresholds');
  if (!(level.stars[0] < level.stars[1] && level.stars[1] < level.stars[2])) {
    fail(id, `star thresholds not ascending: ${level.stars}`);
  }
  const clearFloor = level.squirrels.length * SCORE.squirrel;
  if (level.stars[0] > clearFloor) {
    fail(id, `1★ (${level.stars[0]}) above guaranteed clear score (${clearFloor}) — a clear could earn 0 stars`);
  }
  const max = maxPossibleScore(level);
  if (level.stars[2] > max) fail(id, `3★ (${level.stars[2]}) exceeds max possible score (${max})`);

  // ammo: known types, and enough shots to plausibly reach every squirrel
  for (const a of level.ammo) if (!AMMO[a]) fail(id, `unknown ammo "${a}"`);
  const clusters = new Set(level.squirrels.map((s) => Math.round(s.x / 3))).size;
  if (level.ammo.length < Math.max(2, clusters)) {
    fail(id, `${level.ammo.length} shots for ${clusters} squirrel clusters — not plausibly clearable`);
  }
  // new ammo types only appear at/after their unlock level
  if (i < 4 && level.ammo.includes('slush')) fail(id, 'slushball before its level-5 unlock');
  if (i < 7 && level.ammo.includes('ice')) fail(id, 'iceball before its level-8 unlock');

  // --- physics settle test -------------------------------------------------
  const sim = createSim(level);
  sim.presettle();
  const start = sim.world.bodies
    .filter((b) => b.mass > 0)
    .map((b) => ({ b, p: b.position.clone() }));
  for (let f = 0; f < 360; f++) sim.step(1 / 60); // 6 simulated seconds, untouched
  let maxDrift = 0;
  for (const { b, p } of start) maxDrift = Math.max(maxDrift, b.position.distanceTo(p));
  if (maxDrift > 0.25) fail(id, `fort is not stable at rest: a body drifted ${maxDrift.toFixed(2)}m`);
  const awake = sim.world.bodies.filter((b) => b.mass > 0 && b.sleepState !== 2).length;
  if (awake > 0) fail(id, `${awake} bodies still awake after 6s — jitter risk`);
  if (sim.cleared()) fail(id, 'level cleared itself with no shots fired');

  if (!failures) {
    console.log(`  ✓ ${id} — ${level.blocks.length} blocks, ${level.squirrels.length} squirrels, `
      + `${level.ammo.length} shots, drift ${maxDrift.toFixed(3)}m, stars ${level.stars.join('/')}`);
  }
});

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll levels pass.');
process.exit(failures ? 1 : 0);
