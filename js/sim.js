// SNOWBALL SLINGER — physics simulation (cannon-es), completely DOM-free.
// The renderer mirrors this world every frame; scripts/test-levels.mjs steps
// it headless in Node to prove every fort stands still until it's hit.

import * as CANNON from '../vendor/cannon-es.js';
import {
  MATERIALS, AMMO, SQUIRREL, DAMAGE_K, MIN_DMG, BONK_SPEED,
} from './levels.js';

const FIXED_DT = 1 / 120;
const MAX_SUBSTEPS = 5;

export function createSim(level) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 10;
  world.defaultContactMaterial.contactEquationRelaxation = 4;

  // one cannon material per fort material + ground + each ammo type,
  // with explicit pairwise contact behavior (geometric-mean friction)
  const cMats = { ground: new CANNON.Material('ground') };
  for (const key of Object.keys(MATERIALS)) cMats[key] = new CANNON.Material(key);
  for (const key of Object.keys(AMMO)) cMats['ammo-' + key] = new CANNON.Material('ammo-' + key);
  cMats.squirrel = new CANNON.Material('squirrel');

  const surface = (key) => {
    if (MATERIALS[key]) return MATERIALS[key];
    if (key === 'ground') return { friction: 0.6, restitution: 0.1 };
    if (key === 'squirrel') return { friction: 0.7, restitution: 0.1 };
    const ammo = AMMO[key.replace('ammo-', '')];
    return { friction: 0.5, restitution: ammo && ammo.blast ? 0 : 0.15 };
  };
  const keys = Object.keys(cMats);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i; j < keys.length; j++) {
      const a = surface(keys[i]), b = surface(keys[j]);
      world.addContactMaterial(new CANNON.ContactMaterial(cMats[keys[i]], cMats[keys[j]], {
        friction: Math.sqrt(a.friction * b.friction),
        restitution: Math.min(a.restitution, b.restitution),
      }));
    }
  }

  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, material: cMats.ground });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(ground);

  const sim = {
    world, ground,
    blocks: [],      // { body, def, mat, health, broken }
    squirrels: [],   // { body, def, bonked }
    projectiles: [], // { body, type, spec, launchedAt, done, exploded }
    armed: false,    // damage only counts once the first shot flies
    time: 0,
    listeners: { blockBreak: [], bonk: [], impact: [], blast: [] },
    on(evt, cb) { this.listeners[evt].push(cb); },
    emit(evt, arg) { for (const cb of this.listeners[evt]) cb(arg); },
  };

  const applySleep = (body) => {
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.5;
    body.sleepTimeLimit = 0.4;
  };

  for (const def of level.blocks) {
    const mat = MATERIALS[def.m];
    const d = def.d ?? 1.1;
    const body = new CANNON.Body({
      mass: mat.density * def.w * def.h * d,
      material: cMats[def.m],
      position: new CANNON.Vec3(def.x, def.y, 0),
      linearDamping: 0.05,
      angularDamping: 0.25,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(def.w / 2, def.h / 2, d / 2)));
    applySleep(body);
    world.addBody(body);
    const block = { body, def, mat, health: mat.health, broken: false };
    body.addEventListener('collide', (e) => hitBlock(block, e));
    sim.blocks.push(block);
  }

  for (const def of level.squirrels) {
    const body = new CANNON.Body({
      mass: SQUIRREL.mass,
      material: cMats.squirrel,
      position: new CANNON.Vec3(def.x, def.y, 0),
      linearDamping: 0.05,
      angularDamping: 0.4,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(SQUIRREL.w / 2, SQUIRREL.h / 2, SQUIRREL.d / 2)));
    applySleep(body);
    world.addBody(body);
    const sq = { body, def, bonked: false };
    body.addEventListener('collide', (e) => hitSquirrel(sq, e));
    sim.squirrels.push(sq);
  }

  function projectileOf(body) {
    return sim.projectiles.find((p) => p.body === body && !p.done);
  }

  // Removing a body while cannon-es is mid-step (i.e. from a collide event)
  // corrupts its internal arrays — queue removals and flush between steps.
  const removalQueue = [];
  function removeLater(body) {
    body.collisionResponse = false;
    body.velocity.setZero();
    removalQueue.push(body);
  }
  function flushRemovals() {
    while (removalQueue.length) world.removeBody(removalQueue.pop());
  }

  function hitBlock(block, e) {
    if (!sim.armed || block.broken) return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const other = e.body;
    const proj = projectileOf(other);
    const mass = other.mass > 0 ? other.mass : block.body.mass; // static ground: use own inertia
    let dmg = DAMAGE_K * mass * v * v * (proj ? proj.spec.dmg : 1);
    if (dmg < MIN_DMG) return;
    block.health -= dmg;
    sim.emit('impact', { pos: block.body.position, strength: v, material: block.def.m });
    if (block.health <= 0) breakBlock(block, v);
    if (proj && proj.spec.blast && !proj.exploded) explode(proj);
  }

  function breakBlock(block, speed) {
    if (block.broken) return;
    block.broken = true;
    removeLater(block.body);
    sim.emit('blockBreak', { block, speed });
  }

  function hitSquirrel(sq, e) {
    if (!sim.armed || sq.bonked) return;
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    const proj = projectileOf(e.body);
    if (v >= BONK_SPEED || (proj && v >= 1.5)) bonk(sq, v);
    if (proj && proj.spec.blast && !proj.exploded) explode(proj);
  }

  function bonk(sq, speed) {
    if (sq.bonked) return;
    sq.bonked = true;
    removeLater(sq.body);
    sim.emit('bonk', { squirrel: sq, speed: speed ?? 0 });
  }

  function explode(proj) {
    proj.exploded = true;
    proj.done = true;
    const at = proj.body.position.clone();
    removeLater(proj.body);
    const { radius, impulse, dmg } = proj.spec.blast;
    const push = (body, extraDmgTarget) => {
      const delta = body.position.vsub(at);
      const dist = delta.length();
      if (dist > radius) return 0;
      const falloff = 1 - dist / radius;
      const dir = dist > 0.01 ? delta.scale(1 / dist) : new CANNON.Vec3(0, 1, 0);
      dir.y += 0.35; dir.normalize();
      body.wakeUp();
      body.applyImpulse(dir.scale(impulse * falloff * Math.min(body.mass, 3)), body.position);
      return falloff;
    };
    for (const block of sim.blocks) {
      if (block.broken) continue;
      const falloff = push(block.body);
      if (falloff > 0) {
        block.health -= dmg * falloff;
        if (block.health <= 0) breakBlock(block, 6);
      }
    }
    for (const sq of sim.squirrels) {
      if (sq.bonked) continue;
      const falloff = push(sq.body);
      if (falloff > 0.35) bonk(sq, 6);
    }
    sim.emit('blast', { pos: at, radius });
  }

  sim.fire = (type, velocity) => {
    const spec = AMMO[type];
    const body = new CANNON.Body({
      mass: spec.mass,
      material: cMats['ammo-' + type],
      position: new CANNON.Vec3(-9.6, 2.2, 0),
      linearDamping: 0.02,
      angularDamping: 0.35,
    });
    body.addShape(new CANNON.Sphere(spec.r));
    body.velocity.set(velocity.x, velocity.y, 0);
    body.angularVelocity.set(0, 0, -velocity.x * 1.5);
    applySleep(body);
    world.addBody(body);
    const proj = { body, type, spec, launchedAt: sim.time, done: false, exploded: false };
    sim.projectiles.push(proj);
    sim.armed = true;
    return proj;
  };

  sim.retireProjectile = (proj) => {
    if (proj.done) return;
    proj.done = true;
    removeLater(proj.body);
    flushRemovals();
  };

  // A shot is over when its ball stopped, left the world, or ran out its clock.
  sim.projectileSpent = (proj) => {
    if (proj.done) return true;
    const p = proj.body.position;
    const age = sim.time - proj.launchedAt;
    return proj.body.sleepState === CANNON.Body.SLEEPING
      || p.x < -14 || p.x > 24 || p.y < -2
      || (age > 1.5 && proj.body.velocity.length() < 0.7) // just rolling to a stop
      || age > 6;
  };

  sim.settled = () => {
    for (const body of world.bodies) {
      if (body.type === CANNON.Body.STATIC) continue;
      if (body.sleepState !== CANNON.Body.SLEEPING && body.velocity.length() > 0.18) return false;
    }
    return true;
  };

  let acc = 0;
  sim.step = (dt) => {
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= FIXED_DT && n < MAX_SUBSTEPS) {
      world.step(FIXED_DT);
      flushRemovals();
      sim.time += FIXED_DT;
      acc -= FIXED_DT; n++;
    }
    if (acc >= FIXED_DT) acc = 0; // running slow: drop time instead of spiraling
    // squirrels that get knocked clean off the world still count as bonked
    for (const sq of sim.squirrels) {
      if (!sq.bonked && (sq.body.position.y < -0.5 || Math.abs(sq.body.position.x) > 22)) bonk(sq, 4);
    }
  };

  // Let the fort find its exact resting pose, then freeze it. Blocks wake
  // back up the moment something slams into them.
  sim.presettle = () => {
    for (let i = 0; i < 150; i++) { world.step(FIXED_DT); flushRemovals(); }
    for (const body of world.bodies) {
      if (body.type !== CANNON.Body.STATIC) body.sleep();
    }
  };

  sim.cleared = () => sim.squirrels.every((s) => s.bonked);

  return sim;
}
