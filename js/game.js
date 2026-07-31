// SNOWBALL SLINGER — game controller. Owns one level attempt at a time:
// input → aim → fire → physics → scoring → win/lose. Talks to js/sim.js for
// rules, js/render.js for pictures, and reports results back to js/main.js.

import { LEVELS, AMMO, SCORE, SLING, MATERIALS } from './levels.js';
import { createSim } from './sim.js';
import { sound } from './audio.js';

const SETTLE_GRACE = 2.6; // max seconds to wait for the dust to settle
const CHAIN_MILESTONE = 3;

export function createGame(canvas, renderer, ui) {
  const game = {
    state: 'off', // off | intro | ready | aiming | flying | settling | done
    levelIndex: 0, level: null, sim: null,
    score: 0, ammoQueue: [], shotsUsed: 0,
    activeProj: null, loadedMesh: null,
    introT: 0, settleT: 0, aim: null, shotChain: null,
    runId: 0,
  };

  function hudAmmo() { ui.onAmmo(game.ammoQueue, game.level.ammo.length); }

  game.start = (levelIndex) => {
    game.runId++;
    game.levelIndex = levelIndex;
    game.level = LEVELS[levelIndex];
    game.sim = createSim(game.level);
    game.sim.presettle();
    game.score = 0;
    game.shotsUsed = 0;
    game.ammoQueue = [...game.level.ammo];
    game.activeProj = null;
    game.aim = null;
    game.shotChain = null;
    renderer.buildLevel(game.sim, game.level.locale);
    renderer.setTrajectory(null);
    renderer.setPouch(null);
    wireEvents();
    ui.onScore(0, null);
    hudAmmo();
    // brief look at the fort, then swing back to the slingshot
    game.state = 'intro';
    game.introT = 0;
    renderer.setCameraMode('fort');
  };

  function wireEvents() {
    const { sim } = game;
    const runId = game.runId;
    sim.on('blockBreak', ({ block }) => {
      const pts = MATERIALS[block.def.m].points;
      addScore(pts, block.body.position);
      const { m } = block.def;
      if (m === 'snow') { sound.crunch(); renderer.puff(block.body.position, 0xffffff, 6); }
      else if (m === 'ice') { sound.shatter(); renderer.burstDebris(block.body.position, 0xb9e2f7, 7); }
      else { sound.thunk(); renderer.burstDebris(block.body.position, 0xb0763d, 6); }
      renderer.removeBodyMesh(block.body);
    });
    sim.on('bonk', ({ squirrel }) => {
      addScore(SCORE.squirrel, squirrel.body.position);
      sound.bonk();
      setTimeout(() => {
        if (game.runId === runId) sound.sparkle();
      }, 220);
      renderer.sparkles(squirrel.body.position, 8);
      renderer.bonkSquirrel(squirrel.body);
    });
    sim.on('impact', ({ pos, strength, material }) => {
      if (strength < 4) return;
      if (material === 'wood') sound.thunk();
      if (game.activeProj && !game.activeProj.done) renderer.squash(game.activeProj.body);
    });
    sim.on('blast', ({ pos }) => {
      sound.splat();
      renderer.puff(pos, 0xd7ecdd, 9, 0.45);
      if (game.activeProj) renderer.removeBodyMesh(game.activeProj.body);
    });
  }

  function addScore(pts, worldPos) {
    game.score += pts;
    if (game.shotChain) {
      game.shotChain.hits++;
      game.shotChain.points += pts;
    }
    ui.onScore(game.score, pts, worldPos ? renderer.worldToScreen(worldPos.x, worldPos.y) : null);
  }

  function resolveShotChain() {
    const chain = game.shotChain;
    game.shotChain = null;
    if (!chain || chain.hits < CHAIN_MILESTONE) return;
    sound.chain(chain.hits);
    ui.onChain(chain.hits, chain.points);
  }

  // ------------------------------------------------------------- aiming
  function anchor() { return { x: SLING.x, y: SLING.y }; }

  function pointerDown(e) {
    if (game.state !== 'ready') return;
    const p = renderer.pointerToWorld(e.clientX, e.clientY);
    const a = anchor();
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d > 4.5) return; // grab near the slingshot to aim
    game.state = 'aiming';
    game.aim = { p };
    renderer.setCameraMode('aim');
    sound.unlock(); sound.stretch();
    updateAim(p);
  }

  function pointerMove(e) {
    if (game.state !== 'aiming') return;
    updateAim(renderer.pointerToWorld(e.clientX, e.clientY));
  }

  function currentPull(p) {
    const a = anchor();
    let dx = p.x - a.x, dy = p.y - a.y;
    const len = Math.hypot(dx, dy);
    const max = SLING.maxPull;
    if (len > max) { dx *= max / len; dy *= max / len; }
    return { dx, dy, len: Math.min(len, max) };
  }

  function updateAim(p) {
    const { dx, dy, len } = currentPull(p);
    const a = anchor();
    const pouch = { x: a.x + dx, y: Math.max(a.y + dy, 0.35) };
    renderer.setPouch(pouch, game.loadedMesh);
    if (game.level.hint) {
      const v = launchVelocity(dx, dy, len);
      const pts = [];
      for (let t = 0.06; t < 1.6 && pts.length < 24; t += 0.07) {
        const x = pouch.x + v.x * t, y = pouch.y + v.y * t - 10 * t * t; // gravity 20 → ½g=10
        if (y < 0) break;
        pts.push({ x, y });
      }
      renderer.setTrajectory(pts);
    }
    game.aim = { p, dx, dy, len };
  }

  function launchVelocity(dx, dy, len) {
    const speed = (len / SLING.maxPull) * SLING.maxSpeed;
    const inv = len > 0.001 ? 1 / len : 0;
    return { x: -dx * inv * speed, y: -dy * inv * speed };
  }

  function pointerUp() {
    if (game.state !== 'aiming') return;
    renderer.setTrajectory(null);
    const { dx, dy, len } = game.aim;
    if (len < 0.5) { // tiny pull: put the ball back
      game.state = 'ready';
      renderer.setPouch(null, game.loadedMesh);
      renderer.setCameraMode('idle');
      return;
    }
    const v = launchVelocity(dx, dy, len);
    const type = game.ammoQueue.shift();
    game.shotsUsed++;
    hudAmmo();
    // the loaded pouch mesh becomes the flying ball
    if (game.loadedMesh) { renderer.releaseMesh(game.loadedMesh); game.loadedMesh = null; }
    const proj = game.sim.fire(type, v);
    proj.body.position.set(SLING.x + dx, Math.max(SLING.y + dy, 0.4), 0);
    game.activeProj = proj;
    game.shotChain = { hits: 0, points: 0 };
    renderer.attachProjectile(proj);
    renderer.beginShotTrail(proj.body);
    renderer.setPouch(null);
    renderer.setCameraMode('follow', proj.body);
    sound.fling(len / SLING.maxPull);
    game.state = 'flying';
  }

  canvas.addEventListener('pointerdown', pointerDown);
  addEventListener('pointermove', pointerMove);
  addEventListener('pointerup', pointerUp);
  addEventListener('pointercancel', pointerUp);

  // --------------------------------------------------------- level flow
  function loadNext() {
    const type = game.ammoQueue[0];
    game.loadedMesh = renderer.projectileMesh(type);
    renderer.setPouch(null, game.loadedMesh);
    ui.onLoaded(type);
    game.state = 'ready';
    renderer.setCameraMode('idle');
  }

  function finish(won) {
    game.state = 'done';
    renderer.setCameraMode('fort');
    if (won) {
      const bonus = game.ammoQueue.length * SCORE.ammoBonus;
      if (bonus) addScore(bonus, null);
      const stars = game.level.stars.reduce((n, th) => (game.score >= th ? n + 1 : n), 0);
      sound.fanfare(Math.max(stars, 1));
      ui.onWin({ levelIndex: game.levelIndex, score: game.score, stars: Math.max(stars, 1), bonus, shots: game.shotsUsed });
    } else {
      sound.lose();
      ui.onLose({ levelIndex: game.levelIndex, score: game.score });
    }
  }

  game.tick = (dt) => {
    if (game.state === 'off') return;
    if (game.state === 'intro') {
      game.introT += dt;
      if (game.introT > 1.4) loadNext();
      return; // world is asleep; skip stepping until play begins
    }
    game.sim.step(dt);
    renderer.syncBodies(game.sim);

    if (game.state === 'flying') {
      if (game.sim.cleared() || game.sim.projectileSpent(game.activeProj)) {
        renderer.finishShotTrail();
        if (!game.activeProj.exploded) renderer.removeBodyMesh(game.activeProj.body);
        game.sim.retireProjectile(game.activeProj);
        game.activeProj = null;
        game.settleT = 0;
        game.state = 'settling';
        renderer.setCameraMode('fort');
      }
    } else if (game.state === 'settling') {
      game.settleT += dt;
      if (game.sim.settled() || game.settleT > SETTLE_GRACE) {
        resolveShotChain();
        if (game.sim.cleared()) finish(true);
        else if (game.ammoQueue.length === 0) finish(false);
        else loadNext();
      }
    }
  };

  game.stop = () => {
    game.runId++;
    game.state = 'off';
    game.shotChain = null;
    if (game.loadedMesh) { renderer.releaseMesh(game.loadedMesh); game.loadedMesh = null; }
    if (game.activeProj) { renderer.removeBodyMesh(game.activeProj.body); game.activeProj = null; }
    renderer.setTrajectory(null);
    renderer.setPouch(null);
    renderer.cancelShotTrail();
  };

  return game;
}
