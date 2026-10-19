/* Gone Bananas!!! - level design.
   Plain math and data (no drawing), so the same file runs in the browser and in the Node level checker. */
(function (root) {
  'use strict';

  const W = 480;            // game world width (height adapts to the screen)
  const WORLD_SIZE = 15;                // levels per world
  const MAX_LEVEL = 30;                 // World 1: the Jungle (1-15), World 2: the Banana Galaxy (16-30)
  const WORLDS = ['Jungle', 'Banana Galaxy'];

  // Shared with the game so every generated level stays reachable.
  // Jungle jump height = jumpV^2 / (2 * gravity) = about 195 px. Space is floatier (about 220 px).
  const PHYS = { gravity: 1900, jumpV: 860, runSpeed: 260 };
  const SPACE = { gravity: 1900 * 0.7, jumpV: 860 * 0.9 };

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Shown on the "Level N" card. Levels without a tip get a random cheer.
  const TIPS = {
    1: 'Hop from banana to banana! Stay near the middle: bananas tip, and they drop if you stay too long.',
    2: 'Grab coins! Every 20 coin points gives you an extra life.',
    3: 'Uh-oh! Bruno the Bad Baboon guards the bananas. Dodge his coconuts!',
    4: 'New! Some bananas slide from side to side.',
    6: 'Medium speed! The screen climbs by itself now. Keep up!',
    9: 'New! Spotty brown bananas drop extra fast.',
    11: 'Fast speed! Only banana pros make it this far!',
    15: 'Last jungle level! Climb all the way to the Golden Bananas!',
    16: 'Welcome to the BANANA GALAXY! You float in space, and the screen never stops climbing!',
    17: 'Bruno got a UFO! Dodge his flaming space meteors!',
    21: 'New! Ghost bananas blink in and out. Only land on them while they glow!',
    26: 'Fast speed in space! Hold on to your helmet!',
    30: 'FINAL LEVEL! Reach the Banana Space Station!',
  };

  const worldOf = n => (n > WORLD_SIZE ? 2 : 1);

  function levelSettings(n) {
    n = clamp(Math.round(n) || 1, 1, MAX_LEVEL);
    return n > WORLD_SIZE ? spaceSettings(n) : jungleSettings(n);
  }

  // World 2: always scrolling, floaty jumps, sliding and ghost bananas everywhere.
  function spaceSettings(n) {
    const u = (n - WORLD_SIZE - 1) / (WORLD_SIZE - 1);   // 0 at level 16, 1 at level 30
    const k = n - WORLD_SIZE;                           // 1..15 inside this world
    const bananas = Math.round(lerp(22, 32, u));
    return {
      level: n, world: 2, space: true, final: n === MAX_LEVEL,
      speed: k <= 5 ? 'Slow' : k <= 10 ? 'Medium' : 'Fast',
      gravity: SPACE.gravity, jumpV: SPACE.jumpV,
      bananas,
      gapY: lerp(118, 148, u),
      gapX: lerp(140, 180, u),
      bananaW: Math.round(lerp(110, 84, u)),
      tipTime: +lerp(1.6, 0.8, u).toFixed(2),
      maxTilt: +lerp(0.2, 0.34, u).toFixed(3),
      villain: true,
      throwEvery: +lerp(3.2, 1.4, u).toFixed(2),
      doubleThrow: k >= 6,
      moving: lerp(0.4, 0.75, u),
      moveSpeed: lerp(70, 130, u),
      rotten: lerp(0.12, 0.25, u),
      ghost: k >= 6 ? lerp(0.15, 0.3, (k - 6) / 9) : 0,   // bananas that blink in and out
      scroll: Math.round(lerp(40, 75, u)),
      scrollAlways: true,                                  // moves even before your first jump
      coinChance: 0.55,
      growth: +(1.42 + 0.005 * k).toFixed(3),
      parTime: Math.round(bananas * 1.2),
      tip: TIPS[n] || null,
    };
  }

  function jungleSettings(n) {
    const t = (n - 1) / (WORLD_SIZE - 1);   // 0 at level 1, 1 at level 15
    const bananas = Math.round(lerp(16, 28, t));
    return {
      level: n, world: 1, space: false, final: n === WORLD_SIZE,
      gravity: PHYS.gravity, jumpV: PHYS.jumpV,
      ghost: 0, scrollAlways: false,
      speed: n <= 5 ? 'Slow' : n <= 10 ? 'Medium' : 'Fast',
      bananas,                                       // bananas between the ground and the top
      gapY: lerp(100, 132, t),                       // how far up the next banana is
      gapX: lerp(120, 175, t),                       // how far sideways it can be
      bananaW: Math.round(lerp(124, 88, t)),         // bananas get smaller
      tipTime: +lerp(2.1, 0.8, t).toFixed(2),        // seconds a banana holds you before it drops
      maxTilt: +lerp(0.12, 0.34, t).toFixed(3),      // how far a banana tips when you stand near its end (radians)
      villain: n >= 3,                               // Bruno the Bad Baboon throws coconuts
      throwEvery: n >= 3 ? +lerp(4.2, 1.6, (n - 3) / 12).toFixed(2) : 0,
      doubleThrow: n >= 12,                          // sometimes two coconuts at once
      moving: n >= 4 ? lerp(0.25, 0.65, (n - 4) / 11) : 0,  // share of sliding bananas
      moveSpeed: lerp(45, 110, t),
      rotten: n >= 9 ? lerp(0.12, 0.3, (n - 9) / 6) : 0,    // share of fast-dropping brown bananas
      scroll: n >= 6 ? Math.round(lerp(16, 55, (n - 6) / 9)) : 0, // screen climbs by itself (px/s)
      coinChance: 0.55,
      growth: +(1 + 0.03 * (n - 1)).toFixed(2),      // the climber grows a little every level
      parTime: Math.round(bananas * 1.25),           // finish faster than this for a time bonus
      tip: TIPS[n] || null,
    };
  }

  // Small seeded random generator, so a seed always builds the same level.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // World coordinates: the ground is at y = 0 and the tree grows upward (negative y).
  function buildLevel(n, seed) {
    const s = levelSettings(n);
    const rand = mulberry32(seed == null ? n * 7919 : seed);
    const bananas = [];
    const coins = [];
    const margin = s.bananaW / 2 + 10;
    let x = W / 2, y = 0;

    for (let i = 0; i < s.bananas; i++) {
      const ny = Math.round(y - s.gapY * (0.88 + rand() * 0.24));
      let dx = (rand() * 2 - 1) * s.gapX;
      if (Math.abs(dx) < 45) dx = (dx < 0 ? -1 : 1) * (45 + rand() * 35);
      let nx = x + dx;
      if (nx < margin || nx > W - margin) nx = x - dx;
      nx = Math.round(clamp(nx, margin, W - margin));

      let amp = 0;
      if (i >= 2 && rand() < s.moving) {
        amp = Math.min(25 + rand() * 30, nx - margin, W - margin - nx);
        if (amp < 15) amp = 0;
      }
      const r = rand();
      const type = i >= 3 && r < s.rotten ? 'rotten' : i >= 2 && r < s.rotten + s.ghost ? 'ghost' : 'normal';
      bananas.push({
        x: nx, y: ny, w: s.bananaW, type,
        amp: Math.round(amp), phase: rand() * Math.PI * 2, speed: amp ? s.moveSpeed : 0,
        blink: rand() * 3,   // where a ghost banana starts in its blink cycle
      });

      if (rand() < s.coinChance) {
        const r = rand();
        if (r < 0.1 && i > 0) {
          // Gold 5-coin: a little off the path, worth an extra jump.
          const side = rand() < 0.5 ? -1 : 1;
          coins.push({ x: Math.round(clamp(nx + side * (50 + rand() * 30), 24, W - 24)), y: ny - 85, value: 5 });
        } else {
          // Along the jump from the last banana to this one.
          coins.push({ x: Math.round((x + nx) / 2), y: Math.round((y + ny) / 2 - 40), value: r < 0.72 ? 1 : 2 });
        }
      }
      x = nx; y = ny;
    }

    const goal = { x: W / 2, y: Math.round(y - s.gapY), w: 210, type: 'goal' };
    return { settings: s, bananas, coins, goal, height: -goal.y };
  }

  // Ghost bananas: solid (and glowing) for 2 s, then see-through for 1 s.
  const GHOST = { period: 3, solid: 2 };
  const ghostSolid = (b, clock) => ((clock + b.blink) % GHOST.period) < GHOST.solid;

  const api = { W, WORLD_SIZE, MAX_LEVEL, WORLDS, PHYS, TIPS, GHOST, worldOf, ghostSolid, levelSettings, buildLevel, mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GBLevels = api;
})(this);
