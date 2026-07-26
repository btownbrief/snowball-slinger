// SNOWBALL SLINGER — level data + shared physics/scoring constants.
// Pure data, no DOM: imported by the game AND by scripts/test-levels.mjs (Node).
//
// Coordinates: x → right (toward the forts), y → up, ground surface at y = 0.
// Every block is {m: material, x, y, w, h, d?} with x/y at the block's CENTER,
// so a block resting on the ground has y = h / 2. Squirrels sit at
// surfaceY + SQUIRREL.h / 2 + a hair of clearance.

// Fort materials. health is the damage a block soaks up before it breaks;
// damage on impact ≈ DAMAGE_K * mass * speed² (× the projectile's dmg factor).
export const MATERIALS = {
  snow: { density: 0.9,  friction: 0.7,  restitution: 0.0,  health: 40,  points: 250, label: 'snow' },
  ice:  { density: 2.0,  friction: 0.12, restitution: 0.05, health: 220, points: 400, label: 'ice' },
  wood: { density: 0.55, friction: 0.55, restitution: 0.25, health: 420, points: 500, label: 'wood' },
};

// Ammo. dmg multiplies impact damage; slush trades punch for a radial blast.
export const AMMO = {
  snow:  { r: 0.34, mass: 1.0, dmg: 1.0,  label: 'Snowball' },
  slush: { r: 0.46, mass: 1.3, dmg: 0.55, label: 'Slushball', blast: { radius: 2.7, impulse: 9, dmg: 60 } },
  ice:   { r: 0.30, mass: 2.4, dmg: 2.6,  label: 'Iceball' },
};

export const SCORE = { squirrel: 3000, ammoBonus: 1500 };

export const DAMAGE_K = 0.5;   // kinetic-energy → damage scale
export const MIN_DMG = 8;      // ignore feather taps (resting contacts)
export const BONK_SPEED = 3.2; // impact speed that dizzies a squirrel

export const SQUIRREL = { w: 0.5, h: 0.8, d: 0.5, mass: 0.6 };

export const SLING = { x: -10, y: 2.2, maxPull: 3.2, maxSpeed: 27 };

export const WORLD_BOUNDS = { minX: -14, maxX: 18, maxY: 9 };

// 12 levels. hint: dotted trajectory preview (teaching levels only).
// stars are ascending score thresholds for 1★ / 2★ / 3★.
export const LEVELS = [
  {
    name: 'Welcome to Battery Park',
    locale: 'battery',
    blurb: 'The squirrels grabbed the maple candy. Pull back, let fly.',
    hint: true,
    ammo: ['snow', 'snow', 'snow', 'snow'],
    blocks: [
      { m: 'snow', x: 6.0, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 6.0, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 8.6, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 8.6, y: 1.4, w: 0.8, h: 0.8 },
    ],
    squirrels: [{ x: 6.0, y: 2.42 }],
    stars: [3000, 4800, 6800],
  },
  {
    name: 'Fort Snowpile',
    locale: 'battery',
    blurb: 'Two lookouts. One perch is sturdier than it looks.',
    hint: true,
    ammo: ['snow', 'snow', 'snow', 'snow'],
    blocks: [
      { m: 'snow', x: 5.0, y: 0.75, w: 0.6, h: 1.5 },
      { m: 'snow', x: 7.0, y: 0.75, w: 0.6, h: 1.5 },
      { m: 'wood', x: 6.0, y: 1.65, w: 2.8, h: 0.3 },
      { m: 'snow', x: 9.2, y: 0.5, w: 1.0, h: 1.0 },
    ],
    squirrels: [{ x: 6.0, y: 2.22 }, { x: 8.3, y: 0.42 }],
    stars: [6000, 8000, 10000],
  },
  {
    name: "Cannon's Echo",
    locale: 'battery',
    blurb: 'Ice blocks shrug off snowballs — but they still topple.',
    hint: true,
    ammo: ['snow', 'snow', 'snow', 'snow', 'snow'],
    blocks: [
      { m: 'ice',  x: 6.0, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 6.0, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 6.0, y: 2.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 9.0, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 9.0, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 11.0, y: 0.5, w: 1.0, h: 1.0 },
    ],
    squirrels: [{ x: 6.0, y: 3.42 }, { x: 9.0, y: 2.42 }],
    stars: [6000, 8500, 11000],
  },
  {
    name: 'Waterfront Watch',
    locale: 'waterfront',
    blurb: 'A stilt fort by the boathouse. Knock the legs out.',
    ammo: ['snow', 'snow', 'snow', 'snow'],
    blocks: [
      { m: 'wood', x: 4.8, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 7.2, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 6.0, y: 1.75, w: 3.0,  h: 0.3 },
      { m: 'snow', x: 5.2, y: 2.4,  w: 1.0,  h: 1.0 },
      { m: 'snow', x: 6.8, y: 2.4,  w: 1.0,  h: 1.0 },
      { m: 'wood', x: 6.0, y: 3.05, w: 3.0,  h: 0.3 },
    ],
    squirrels: [{ x: 6.0, y: 3.62 }, { x: 9.2, y: 0.42 }],
    stars: [6000, 8500, 10800],
  },
  {
    name: 'Slush Hour',
    locale: 'waterfront',
    blurb: 'New ammo: the SLUSHBALL. It splats wide and shoves hard.',
    ammo: ['slush', 'snow', 'snow', 'snow', 'slush'],
    blocks: [
      { m: 'snow', x: 5.0, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 5.0, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 5.0, y: 2.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 6.0, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 6.0, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 9.5, y: 0.5, w: 1.0, h: 1.0 },
    ],
    squirrels: [{ x: 7.5, y: 0.42 }, { x: 8.4, y: 0.42 }, { x: 9.5, y: 1.42 }],
    stars: [9000, 12000, 14500],
  },
  {
    name: 'Boathouse Blockade',
    locale: 'waterfront',
    blurb: 'An ice roof keeps the snow off. Nothing keeps the slush off.',
    ammo: ['snow', 'snow', 'snow', 'slush', 'slush'],
    blocks: [
      { m: 'wood', x: 4.6,  y: 0.8, w: 0.35, h: 1.6 },
      { m: 'wood', x: 6.6,  y: 0.8, w: 0.35, h: 1.6 },
      { m: 'ice',  x: 5.6,  y: 1.8, w: 2.6,  h: 0.4 },
      { m: 'snow', x: 5.6,  y: 2.5, w: 1.0,  h: 1.0 },
      { m: 'snow', x: 9.5,  y: 0.5, w: 1.0,  h: 1.0 },
      { m: 'snow', x: 10.5, y: 0.5, w: 1.0,  h: 1.0 },
      { m: 'snow', x: 10.0, y: 1.5, w: 1.0,  h: 1.0 },
    ],
    squirrels: [{ x: 5.6, y: 3.42 }, { x: 10.0, y: 2.42 }, { x: 12.0, y: 0.42 }],
    stars: [9000, 12500, 15500],
  },
  {
    name: 'Oakledge Outpost',
    locale: 'oakledge',
    blurb: 'A proper treefort among the pines. Aim for the joints.',
    ammo: ['snow', 'snow', 'snow', 'slush'],
    blocks: [
      { m: 'ice',  x: 6.0,  y: 0.5,  w: 1.0,  h: 1.0 },
      { m: 'ice',  x: 7.0,  y: 0.5,  w: 1.0,  h: 1.0 },
      { m: 'wood', x: 6.5,  y: 1.15, w: 2.6,  h: 0.3 },
      { m: 'snow', x: 6.0,  y: 1.8,  w: 1.0,  h: 1.0 },
      { m: 'snow', x: 7.0,  y: 1.8,  w: 1.0,  h: 1.0 },
      { m: 'wood', x: 6.5,  y: 2.45, w: 2.6,  h: 0.3 },
      { m: 'wood', x: 9.4,  y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 10.6, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 10.0, y: 1.75, w: 2.2,  h: 0.3 },
      { m: 'snow', x: 11.8, y: 0.5,  w: 1.0,  h: 1.0 },
    ],
    squirrels: [{ x: 6.5, y: 3.02 }, { x: 10.0, y: 2.32 }, { x: 12.6, y: 0.42 }],
    stars: [9000, 12500, 15000],
  },
  {
    name: 'Cold Snap',
    locale: 'oakledge',
    blurb: 'New ammo: the ICEBALL. Dense. Rude. Goes through things.',
    ammo: ['ice', 'snow', 'snow', 'slush', 'ice'],
    blocks: [
      { m: 'ice',  x: 5.5, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 5.5, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.5, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.5, y: 1.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.0, y: 2.2, w: 2.4, h: 0.4 },
      { m: 'snow', x: 8.5, y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 9.5, y: 0.5, w: 1.0, h: 1.0 },
    ],
    squirrels: [{ x: 6.0, y: 2.82 }, { x: 8.5, y: 1.42 }, { x: 9.5, y: 1.42 }],
    stars: [9000, 12500, 15200],
  },
  {
    name: 'The Ledge',
    locale: 'oakledge',
    blurb: 'Two forts, one sunset. Spend your snowballs wisely.',
    ammo: ['snow', 'snow', 'slush', 'slush', 'ice', 'ice'],
    blocks: [
      { m: 'snow', x: 4.5,  y: 0.75, w: 0.6, h: 1.5 },
      { m: 'snow', x: 5.5,  y: 0.75, w: 0.6, h: 1.5 },
      { m: 'wood', x: 5.0,  y: 1.65, w: 2.4, h: 0.3 },
      { m: 'snow', x: 5.0,  y: 2.3,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 9.5,  y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 10.5, y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 10.0, y: 1.5,  w: 1.0, h: 1.0 },
    ],
    squirrels: [
      { x: 5.0, y: 3.22 }, { x: 6.6, y: 0.42 },
      { x: 10.0, y: 2.42 }, { x: 12.0, y: 0.42 },
    ],
    stars: [12000, 16000, 19000],
  },
  {
    name: 'Marquee Lights',
    locale: 'church',
    blurb: 'They built a fort under the Church Street lights. Bold.',
    ammo: ['snow', 'snow', 'snow', 'slush', 'ice', 'ice'],
    blocks: [
      { m: 'wood', x: 4.5, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 6.0, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 7.5, y: 0.8,  w: 0.35, h: 1.6 },
      { m: 'wood', x: 6.0, y: 1.75, w: 3.4,  h: 0.3 },
      { m: 'snow', x: 5.0, y: 2.4,  w: 1.0,  h: 1.0 },
      { m: 'snow', x: 7.0, y: 2.4,  w: 1.0,  h: 1.0 },
      { m: 'ice',  x: 6.0, y: 3.1,  w: 2.8,  h: 0.4 },
      { m: 'snow', x: 8.8, y: 0.5,  w: 1.0,  h: 1.0 },
    ],
    squirrels: [
      { x: 5.2, y: 3.72 }, { x: 6.8, y: 3.72 },
      { x: 6.0, y: 0.42 }, { x: 9.8, y: 0.42 },
    ],
    stars: [12000, 16500, 20000],
  },
  {
    name: 'The Candy Vault',
    locale: 'church',
    blurb: 'The stash itself, walled in ice. Crack the vault.',
    ammo: ['snow', 'snow', 'slush', 'slush', 'ice', 'ice'],
    blocks: [
      { m: 'ice',  x: 5.0,  y: 0.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 5.0,  y: 1.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 7.0,  y: 0.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 7.0,  y: 1.5, w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.0,  y: 2.2, w: 3.0, h: 0.4 },
      { m: 'snow', x: 9.5,  y: 0.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 9.5,  y: 1.5, w: 1.0, h: 1.0 },
      { m: 'snow', x: 11.5, y: 0.5, w: 1.0, h: 1.0 },
    ],
    squirrels: [
      { x: 6.0, y: 0.42 }, { x: 6.0, y: 2.82 },
      { x: 9.5, y: 2.42 }, { x: 11.5, y: 1.42 },
    ],
    stars: [12000, 16500, 19800],
  },
  {
    name: 'The Last Stash',
    locale: 'church',
    blurb: 'Every squirrel in town. Every block they could carry. Go.',
    ammo: ['snow', 'snow', 'snow', 'slush', 'slush', 'ice', 'ice', 'ice'],
    blocks: [
      { m: 'snow', x: 3.5,  y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'snow', x: 3.5,  y: 1.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.0,  y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 7.0,  y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.0,  y: 1.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 7.0,  y: 1.5,  w: 1.0, h: 1.0 },
      { m: 'ice',  x: 6.5,  y: 2.2,  w: 2.4, h: 0.4 },
      { m: 'snow', x: 6.0,  y: 2.9,  w: 1.0, h: 1.0 },
      { m: 'snow', x: 7.0,  y: 2.9,  w: 1.0, h: 1.0 },
      { m: 'wood', x: 6.5,  y: 3.55, w: 2.4, h: 0.3 },
      { m: 'snow', x: 10.0, y: 0.5,  w: 1.0, h: 1.0 },
      { m: 'snow', x: 10.0, y: 1.5,  w: 1.0, h: 1.0 },
      { m: 'snow', x: 10.0, y: 2.5,  w: 1.0, h: 1.0 },
    ],
    squirrels: [
      { x: 6.5, y: 4.12 }, { x: 3.5, y: 2.42 }, { x: 10.0, y: 3.42 },
      { x: 8.6, y: 0.42 }, { x: 12.2, y: 0.42 },
    ],
    stars: [15000, 20000, 25000],
  },
];

// Highest score a level can theoretically pay out (used by the level checker
// to prove star thresholds are reachable).
export function maxPossibleScore(level) {
  const blockPts = level.blocks.reduce((s, b) => s + MATERIALS[b.m].points, 0);
  const bonus = Math.max(0, level.ammo.length - 1) * SCORE.ammoBonus;
  return blockPts + level.squirrels.length * SCORE.squirrel + bonus;
}
