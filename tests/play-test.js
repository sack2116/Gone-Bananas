// Robot play-test: runs the real game code in Node (with a fake browser) and lets a
// simple bot climb every level. Checks that nothing crashes and that every level can be beaten.
// Run:  node tests/play-test.js
'use strict';
const path = require('path');
const fs = require('fs');

// A fake object that accepts any property or call, so drawing code runs without a screen.
const fake = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'style' ? {} : k === 'classList'
    ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === 'dataset' ? {} : fake()),
  set: () => true,
  apply: () => fake(),
});
const ctx = fake();
const el = () => { const e = fake(); return new Proxy(e, { get: (t, k) => (k === 'getContext' ? () => ctx : Reflect.get(fake(), k)) }); };
global.window = global;
global.document = {
  querySelector: el, getElementById: el, createElement: el,
  querySelectorAll: () => [], addEventListener() {}, hidden: false,
};
global.matchMedia = () => ({ matches: false });
global.addEventListener = () => {};
global.innerWidth = 480; global.innerHeight = 800; global.devicePixelRatio = 1;
global.requestAnimationFrame = () => 0;
Object.defineProperty(global, 'localStorage', { value: { getItem: () => null, setItem() {} }, configurable: true });

const run = f => new Function(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).call(global);
run('levels.js');
run('game.js');
const { game, player, input, startLevel, update, STEP } = global.__GB;

// Bot: aim at the nearest banana above, jump whenever standing on something.
function bot() {
  let target = null;
  // Pick the next banana up while standing, and keep aiming at it for the whole jump.
  if (player.on || !botTarget || botTarget.state !== 'ok') {
    for (const b of game.bananas) {
      if (b.state !== 'ok' || b.y >= (player.on ? player.on.y : player.y) - 10) continue;
      if (!target || b.y > target.y) target = b;
    }
    botTarget = target;
  }
  target = botTarget;
  input.kLeft = input.kRight = false;
  if (!target) return;
  if (target.x < player.x - 6) input.kLeft = true;
  if (target.x > player.x + 6) input.kRight = true;
  if (player.on) { botWait += STEP; if (botWait > 0.05) { input.jumpBuffer = 0.15; botWait = 0; } } else botWait = 0;
}
let botWait = 0, botTarget = null;

// TRACE=3 node tests/play-test.js  -> print what the bot is doing on level 3
if (process.env.TRACE) {
  startLevel(+process.env.TRACE, true); game.lives = 99;
  for (let t = 0; t < 60 && game.state !== 'complete'; t += STEP) {
    if (game.state === 'playing') bot();
    update(STEP);
    if (t % 1 < STEP) console.log(t.toFixed(0), game.state, 'player', Math.round(player.x), Math.round(player.y),
      'on', player.on ? `${player.on.type}@${Math.round(player.on.x)},${player.on.y}` : '-', 'cam', Math.round(game.camY), 'goal', game.goal.y);
  }
  process.exit(0);
}

let failures = 0;
for (let n = 1; n <= 15; n++) {
  const runs = 20;
  let wins = 0, falls = 0, totalTime = 0;
  for (let r = 0; r < runs; r++) {
    startLevel(n, true);
    game.lives = 99;
    let t = 0;
    while (t < 120 && game.state !== 'complete' && game.state !== 'over') {
      if (game.state === 'playing') bot();
      if (game.state === 'dying' && game.deadT === 0) falls++;
      update(STEP); t += STEP;
    }
    if (game.state === 'complete') { wins++; totalTime += game.time; }
  }
  const s = game.settings;
  const line = `Level ${String(n).padStart(2)} (${s.speed.padEnd(6)}): bot won ${wins}/${runs}, ` +
    `falls/run ${(falls / runs).toFixed(1)}, avg climb ${(totalTime / Math.max(1, wins)).toFixed(1)}s, size x${s.growth}`;
  console.log(line);
  if (wins < runs * 0.8) failures++;
}

// Extra lives from coins.
startLevel(1, true);
const before = game.lives;
game.coinBank = 19;
game.coins.push({ x: player.x, y: player.y - 24, value: 2, taken: false, phase: 0 });
game.state = 'playing';
update(STEP);
console.log(`Coin to 21 points: lives ${before} -> ${game.lives}, bank ${game.coinBank}`);
if (game.lives !== before + 1 || game.coinBank !== 1) failures++;

// Running out of lives ends the game.
startLevel(2, true);
game.state = 'playing'; game.lives = 1;
player.on = null; player.y = game.camY + 2000;
for (let i = 0; i < 400; i++) update(STEP);
console.log(`Fall with 1 life: state = ${game.state}`);
if (game.state !== 'over') failures++;

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
