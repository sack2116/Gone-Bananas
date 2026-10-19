/* Gone Bananas!!! - the game: screens, physics, drawing and sound. */
(() => {
  'use strict';

  const LV = window.GBLevels;
  const { W, MAX_LEVEL, PHYS } = LV;
  const TAU = Math.PI * 2;
  const STEP = 1 / 120;           // physics runs at a fixed 120 steps per second
  const INTRO_TIME = 2.6;         // seconds the "Level N" card shows
  const MAX_LIVES = 9;
  const COINS_PER_LIFE = 20;
  const FONT = 'Fredoka, "Comic Sans MS", "Trebuchet MS", system-ui, sans-serif';
  const INK = '#3b2314';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const $ = sel => document.querySelector(sel);

  /* ---------------- Saved progress (this device only) ---------------- */
  const SAVE_KEY = 'gone-bananas-v1';
  const save = Object.assign(
    { unlocked: 1, stars: {}, best: 0, character: 'pompom', sound: true, music: true },
    readSave()
  );
  function readSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: progress just isn't kept */ }
  }

  /* ---------------- Sound: tiny synth, no audio files ---------------- */
  const Sound = (() => {
    let ac = null, master = null, musicBus = null, timer = null, step = 0, nextAt = 0, beat = 0.25;
    function ready() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ac = new AC();
        master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination);
        musicBus = ac.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
      }
      if (ac.state === 'suspended') ac.resume();
      return true;
    }
    function tone(freq, dur, o = {}) {
      const t = (o.at != null ? o.at : ac.currentTime) + (o.delay || 0);
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + o.slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol == null ? 0.2 : o.vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o.bus || master);
      osc.start(t); osc.stop(t + dur + 0.05);
    }
    const midi = m => 440 * Math.pow(2, (m - 69) / 12);
    const notes = (list, o) => list.forEach((f, i) => tone(f, o.dur, Object.assign({}, o, { delay: i * o.gap })));

    function sfx(name, v) {
      if (!save.sound || !ready()) return;
      switch (name) {
        case 'jump': tone(330, 0.18, { vol: 0.09, slide: 380 }); break;
        case 'land': tone(140, 0.09, { type: 'triangle', vol: 0.18, slide: -40 }); break;
        case 'coin':
          tone(988, 0.07, { vol: 0.08 });
          tone(v === 5 ? 1760 : v === 2 ? 1568 : 1319, 0.16, { vol: 0.08, delay: 0.06 }); break;
        case 'life': notes([523, 659, 784, 1047, 1319], { type: 'triangle', vol: 0.22, dur: 0.18, gap: 0.08 }); break;
        case 'perfect': notes([784, 988, 1175], { type: 'triangle', vol: 0.15, dur: 0.12, gap: 0.05 }); break;
        case 'creak': tone(240, 0.16, { type: 'sawtooth', vol: 0.05, slide: -90 }); break;
        case 'tip': tone(300, 0.25, { type: 'triangle', vol: 0.12, slide: -200 }); break;
        case 'fall': tone(700, 0.8, { type: 'triangle', vol: 0.2, slide: -600 }); break;
        case 'rescue': notes([392, 523, 659], { type: 'triangle', vol: 0.15, dur: 0.12, gap: 0.07 }); break;
        case 'go': tone(523, 0.12, { vol: 0.1 }); tone(784, 0.25, { vol: 0.1, delay: 0.12 }); break;
        case 'win': notes([523, 659, 784, 1047, 784, 1047], { vol: 0.1, dur: 0.16, gap: 0.11 }); break;
        case 'over': notes([392, 330, 262, 196], { type: 'triangle', vol: 0.18, dur: 0.3, gap: 0.2 }); break;
        case 'throw': tone(520, 0.18, { type: 'triangle', vol: 0.12, slide: -280 }); break;
        case 'bonk': tone(200, 0.12, { vol: 0.16, slide: -120 }); tone(90, 0.2, { type: 'triangle', vol: 0.25, delay: 0.03 }); break;
        case 'chomp': tone(rnd(200, 260), 0.06, { vol: 0.12, slide: -80 }); tone(150, 0.05, { type: 'triangle', vol: 0.15, delay: 0.08 }); break;
        case 'grr': tone(120, 0.45, { type: 'sawtooth', vol: 0.08, slide: -40 }); break;
        case 'click': tone(660, 0.06, { type: 'triangle', vol: 0.12 }); break;
      }
    }

    // A short, bouncy jungle tune (original). 0 = rest. One entry per eighth note.
    const MEL = [72, 0, 76, 79, 81, 79, 76, 0, 74, 76, 72, 0, 69, 72, 74, 0,
                 72, 0, 76, 79, 84, 81, 79, 76, 74, 72, 74, 76, 72, 0, 0, 0];
    const BASS = [48, 55, 48, 55, 45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50];
    let shift = 0, lead = 'square';
    function schedule() {
      while (nextAt < ac.currentTime + 0.15) {
        const m = MEL[step % MEL.length];
        if (m) tone(midi(m + shift), beat * 0.9, { type: lead, vol: lead === 'square' ? 0.5 : 0.8, at: nextAt, bus: musicBus });
        if (step % 2 === 0) tone(midi(BASS[(step / 2) % BASS.length] + shift), beat * 1.7, { type: 'triangle', vol: 0.9, at: nextAt, bus: musicBus });
        nextAt += beat; step++;
      }
    }
    function music(level) {
      stopMusic();
      if (!save.music || !ready()) return;
      const space = level > LV.WORLD_SIZE;   // space: higher key and a softer, spacey lead
      shift = space ? 5 : 0; lead = space ? 'triangle' : 'square';
      beat = 60 / (118 + ((level - 1) % LV.WORLD_SIZE + 1) * 5 + (space ? 10 : 0)) / 2;   // the tune speeds up with the level
      step = 0; nextAt = ac.currentTime + 0.05;
      timer = setInterval(schedule, 50);
    }
    function stopMusic() { if (timer) clearInterval(timer); timer = null; }
    return { sfx, music, stopMusic, unlock: ready };
  })();

  /* ---------------- Drawing helpers ---------------- */
  function ell(c, x, y, rx, ry, fill, rot = 0) {
    c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fillStyle = fill; c.fill();
  }
  const circ = (c, x, y, r, fill) => ell(c, x, y, r, r, fill);
  function ln(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function eyePair(c, dx, y, r, blink, lashes) {
    for (const sx of [-1, 1]) {
      const x = sx * dx;
      if (blink) { c.strokeStyle = '#2b1d14'; c.lineWidth = 1.6; ln(c, x - r, y, x + r, y); continue; }
      circ(c, x, y, r, '#fff');
      circ(c, x + 0.6, y + 0.3, r * 0.62, '#2b1d14');
      circ(c, x + r * 0.3 + 0.3, y - r * 0.3, r * 0.26, '#fff');
      if (lashes) { c.strokeStyle = '#2b1d14'; c.lineWidth = 1.1; ln(c, x + sx * r * 0.6, y - r * 0.8, x + sx * r * 1.25, y - r * 1.3); }
    }
  }
  function smile(c, x, y, r, color, width) {
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }

  /* ---------------- The three climbers ----------------
     Each is drawn with its feet at (0,0), about 50 units tall, facing right.
     a = { t: time, run: 0..1, air: bool, blink: bool } */
  function drawGorilla(c, a) {
    const sw = Math.sin(a.t * 14) * a.run;
    const FUR = '#3a3542', DARK = '#5a5262', SKIN = '#c9ad96';
    c.lineCap = 'round';
    c.strokeStyle = FUR; c.lineWidth = 9;
    ln(c, -6, -12, -7 - sw * 4, -3); ln(c, 6, -12, 7 + sw * 4, -3);
    ell(c, -8 - sw * 4, -2, 6, 3.5, DARK); ell(c, 8 + sw * 4, -2, 6, 3.5, DARK);
    ell(c, 0, -20, 16, 15, FUR);
    ell(c, 0, -18, 10, 10, '#8d8296');
    c.strokeStyle = FUR; c.lineWidth = 8;
    if (a.air) {
      ln(c, -13, -27, -21, -43); ln(c, 13, -27, 21, -43);
      circ(c, -21, -44, 4.5, DARK); circ(c, 21, -44, 4.5, DARK);
    } else {
      ln(c, -13, -27, -19, -13 + sw * 3); ln(c, 13, -27, 19, -13 - sw * 3);
      circ(c, -19, -12 + sw * 3, 4.5, DARK); circ(c, 19, -12 - sw * 3, 4.5, DARK);
    }
    circ(c, -12, -38, 4.5, FUR); circ(c, 12, -38, 4.5, FUR);
    circ(c, -12, -38, 2.2, SKIN); circ(c, 12, -38, 2.2, SKIN);
    circ(c, 0, -39, 13, FUR);
    ell(c, 0, -35, 10, 8, SKIN);
    ell(c, 0, -44.5, 9.5, 3.2, FUR);
    eyePair(c, 4, -40, 2.6, a.blink);
    circ(c, -2, -35, 1.2, FUR); circ(c, 2, -35, 1.2, FUR);
    smile(c, 0, -33, 3.5, FUR, 1.6);
  }

  function drawDog(c, a) {
    const sw = Math.sin(a.t * 14) * a.run;
    const wag = Math.sin(a.t * 18);
    const FUR = '#d9954f', CREAM = '#f6dcb4', EAR = '#8b5a2b';
    c.lineCap = 'round';
    c.strokeStyle = '#b87436'; c.lineWidth = 4;
    ln(c, -11, -16, -20 + wag * 2, -27 + wag * 3);
    c.strokeStyle = FUR; c.lineWidth = 7;
    ln(c, -6, -9, -7 - sw * 4, -3); ln(c, 6, -9, 7 + sw * 4, -3);
    ell(c, -7 - sw * 4, -2, 5, 3, CREAM); ell(c, 7 + sw * 4, -2, 5, 3, CREAM);
    ell(c, 0, -17, 14, 12.5, FUR);
    ell(c, 0, -15, 8, 8.5, CREAM);
    c.strokeStyle = FUR; c.lineWidth = 6;
    if (a.air) {
      ln(c, -11, -22, -18, -35); ln(c, 11, -22, 18, -35);
      circ(c, -18, -36, 3.5, CREAM); circ(c, 18, -36, 3.5, CREAM);
    } else {
      ln(c, -11, -22, -15, -11 + sw * 3); ln(c, 11, -22, 15, -11 - sw * 3);
      circ(c, -15, -10 + sw * 3, 3.5, CREAM); circ(c, 15, -10 - sw * 3, 3.5, CREAM);
    }
    c.fillStyle = '#e63946'; rr(c, -10, -29.5, 20, 4.5, 2); c.fill();
    circ(c, 0, -24.5, 2.6, '#ffd23f');
    const flap = a.air ? -0.9 : Math.sin(a.t * 6) * 0.08;   // ears fly up when jumping
    ell(c, -12, -36, 4.5, 10, EAR, 0.35 + flap);
    ell(c, 12, -36, 4.5, 10, EAR, -0.35 - flap);
    circ(c, 0, -38, 12.5, FUR);
    ell(c, 5, -42, 5, 4.5, EAR);
    ell(c, 0, -32, 7, 5.2, CREAM);
    ell(c, 0, -35, 3, 2.2, '#2b2b2b');
    eyePair(c, 4.5, -40, 2.7, a.blink);
    smile(c, 0, -33, 3, '#2b2b2b', 1.4);
    if (a.run > 0.2 || a.air) ell(c, 1, -28.5, 2.2, 3, '#ff6b8b');
  }

  // PomPom's curly hair: a ring of curls plus curls hanging to her shoulders.
  const CURLS = [];
  for (let i = 0; i < 14; i++) {
    const ang = Math.PI * (0.92 + (i / 13) * 1.16);
    CURLS.push([Math.cos(ang) * 12.5, -37 + Math.sin(ang) * 12.5, 5.3]);
  }
  CURLS.push([-14, -35, 5], [14, -35, 5], [-13.5, -29.5, 4.8], [13.5, -29.5, 4.8], [-12, -24.5, 4.2], [12, -24.5, 4.2]);

  function drawPomPom(c, a) {
    const sw = Math.sin(a.t * 14) * a.run;
    const bounce = a.air ? -2 : Math.abs(Math.sin(a.t * 7)) * a.run * 1.5;
    const SKIN = '#c98a5a', HAIR = '#3b2314', HAIR2 = '#5e3a22', DRESS = '#ff5fa2';
    c.lineCap = 'round';
    c.strokeStyle = SKIN; c.lineWidth = 4.5;
    ln(c, -4, -11, -5 - sw * 4, -3); ln(c, 4, -11, 5 + sw * 4, -3);
    ell(c, -5.5 - sw * 4, -2, 4.5, 2.6, '#7b2cbf'); ell(c, 5.5 + sw * 4, -2, 4.5, 2.6, '#7b2cbf');
    // hair at the back, behind the dress and face
    for (const [x, y, r] of CURLS) circ(c, x, y, r, HAIR);
    // dress with little banana dots
    c.beginPath(); c.moveTo(-6, -27); c.lineTo(6, -27); c.lineTo(13, -10);
    c.quadraticCurveTo(0, -7, -13, -10); c.closePath(); c.fillStyle = DRESS; c.fill();
    for (const [x, y] of [[-6, -15], [4, -19], [7, -12], [-2, -22], [0, -13]]) circ(c, x, y, 1.4, '#ffd23f');
    c.strokeStyle = SKIN; c.lineWidth = 4;
    if (a.air) {
      ln(c, -6, -25, -14, -39); ln(c, 6, -25, 14, -39);
      circ(c, -14, -40, 2.6, SKIN); circ(c, 14, -40, 2.6, SKIN);
    } else {
      ln(c, -6, -25, -11, -14 + sw * 3); ln(c, 6, -25, 11, -14 - sw * 3);
      circ(c, -11, -13 + sw * 3, 2.6, SKIN); circ(c, 11, -13 - sw * 3, 2.6, SKIN);
    }
    circ(c, 0, -36, 10, SKIN);
    // curly fringe and the two pom-poms she's named after
    for (const [x, y, r] of [[-7, -44, 4.6], [-2, -46.5, 4.8], [3.5, -46, 4.8], [8, -43.5, 4.4]]) circ(c, x, y, r, HAIR);
    circ(c, -10, -53 - bounce, 6.5, HAIR); circ(c, 10, -53 - bounce, 6.5, HAIR);
    c.strokeStyle = HAIR2; c.lineWidth = 1.2;
    for (const [x, y] of [[-10, -54 - bounce], [10, -54 - bounce], [-1, -47], [-13, -33], [13, -33]]) {
      c.beginPath(); c.arc(x, y, 2.4, 0.2, 4.2); c.stroke();
    }
    circ(c, -7.5, -48.5 - bounce * 0.5, 2, '#ffd23f'); circ(c, 7.5, -48.5 - bounce * 0.5, 2, '#ffd23f');
    eyePair(c, 3.8, -36, 2.9, a.blink, true);
    ell(c, -6.5, -32, 2.2, 1.4, 'rgba(255,105,140,0.6)'); ell(c, 6.5, -32, 2.2, 1.4, 'rgba(255,105,140,0.6)');
    smile(c, 0, -33, 3, '#7a2e2e', 1.4);
  }

  // Bruno the Bad Baboon: grumpy, colorful face, swings on a vine and throws coconuts.
  // a = { t, windup: 0..1 (arm raised), flee: bool }
  function drawBaboon(c, a) {
    const FUR = '#6f6a8f', FUR_D = '#4e4a6b', BELLY = '#a9a3c6';
    c.lineCap = 'round';
    // vine hand above the head
    c.strokeStyle = FUR; c.lineWidth = 7;
    ln(c, -10, -30, -6, -60); circ(c, -6, -61, 5, FUR_D);
    // throwing arm: down, or raised with a coconut
    if (a.windup > 0) {
      ln(c, 12, -28, 22, -52); drawCoconut(c, 24, -58, 10, a.t * 2);
    } else ln(c, 12, -26, 18, -8);
    ell(c, 0, -16, 15, 16, FUR);
    ell(c, 0, -13, 9, 10, BELLY);
    c.strokeStyle = FUR; c.lineWidth = 7;
    const kick = Math.sin(a.t * (a.flee ? 20 : 4)) * 3;
    ln(c, -6, -4, -9, 6 + kick); ln(c, 6, -4, 9, 6 - kick);
    circ(c, 0, -38, 14, FUR);
    circ(c, -14, -40, 4.5, FUR_D); circ(c, 14, -40, 4.5, FUR_D);
    for (let i = -2; i <= 2; i++) circ(c, i * 4, -51 + Math.abs(i) * 1.5, 3.5, FUR_D);   // messy hair
    ell(c, 0, -34, 9.5, 10.5, '#f2d5a3');
    ell(c, -6.5, -33, 3, 6, '#4d7cff'); ell(c, 6.5, -33, 3, 6, '#4d7cff');   // blue cheeks
    ell(c, 0, -32, 3.5, 7.5, '#e63946');                                       // red nose
    circ(c, -4.5, -42, 2.8, '#ffd23f'); circ(c, 4.5, -42, 2.8, '#ffd23f');     // yellow eyes
    circ(c, -4, -41.5, 1.3, '#1b1b1b'); circ(c, 5, -41.5, 1.3, '#1b1b1b');
    c.strokeStyle = '#1b1b1b'; c.lineWidth = 2;
    ln(c, -9, -47.5, -2, -44.5); ln(c, 9, -47.5, 2, -44.5);                  // angry eyebrows
    c.fillStyle = '#5a1020'; rr(c, -6, -26, 12, 5, 2.5); c.fill();             // grumpy mouth
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-4, -26); c.lineTo(-2.5, -23.5); c.lineTo(-1, -26); c.fill();
    c.beginPath(); c.moveTo(1, -26); c.lineTo(2.5, -23.5); c.lineTo(4, -26); c.fill();
  }
  function drawCoconut(c, x, y, r, rot) {
    c.save(); c.translate(x, y); c.rotate(rot);
    circ(c, 0, 0, r, '#6b4423');
    c.strokeStyle = '#4a2c14'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.strokeStyle = '#8a5a33'; c.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) { const a = i * 1.3; ln(c, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); }
    for (const [dx, dy] of [[-3, -3], [3, -3], [0, 2]]) circ(c, dx * r / 10, dy * r / 10, r * 0.15, '#2e1a0b');
    c.restore();
  }

  // Space version of a coconut: a little flaming meteor.
  function drawMeteor(c, x, y, r, rot) {
    for (let i = 4; i >= 1; i--) {
      c.globalAlpha = 0.18 * (5 - i);
      circ(c, x + Math.sin(rot * 3 + i) * 2, y - i * r * 0.75, r * (1 - i * 0.12), i > 2 ? '#ff6b35' : '#ffd23f');
    }
    c.globalAlpha = 1;
    c.save(); c.translate(x, y); c.rotate(rot);
    circ(c, 0, 0, r, '#8d6e63');
    c.strokeStyle = '#4e342e'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    for (const [dx, dy, cr] of [[-3, -3, 3], [4, 2, 2.4], [-2, 5, 1.8]]) circ(c, dx, dy, cr, '#5d4037');
    c.restore();
  }

  // The prize at the top: a whole bunch (racimo) of bananas, eaten one by one.
  const BUNCH = [
    [-14, -24, -0.8], [14, -24, 0.8],
    [-26, -48, -1.1], [0, -54, 0], [26, -48, 1.1],
    [-30, -75, -1.2], [-11, -80, -0.5], [11, -80, 0.5], [30, -75, 1.2],
    [-22, -100, -1.1], [-8, -105, -0.4], [8, -105, 0.4], [22, -100, 1.1],
  ];
  function drawBunch(c, x, y, eaten, gold) {
    const look = gold ? BANANA_LOOK.gold : BANANA_LOOK.normal;
    c.strokeStyle = '#6b4a1f'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y - 6); c.quadraticCurveTo(x + 6, y - 70, x - 2, y - 128); c.stroke();
    for (let i = BUNCH.length - 1; i >= eaten; i--) {
      const [dx, dy, rot] = BUNCH[i];
      c.save(); c.translate(x + dx, y + dy); c.rotate(rot - Math.PI / 2 * Math.sign(rot) * 0.15);
      drawBanana(c, 46, look, 0, false);
      c.restore();
    }
    ell(c, x - 2, y - 130, 7, 5, '#4f3412');
  }

  const CHARACTERS = [
    { id: 'gorilla', name: 'Gorilla', tag: 'Big, strong & silly', color: '#3a3542', cheer: 'Ooh-ooh-ah-ah!', draw: drawGorilla },
    { id: 'dog', name: 'Dog', tag: 'Waggy & happy', color: '#d9954f', cheer: 'Woof woof!', draw: drawDog },
    { id: 'pompom', name: 'PomPom', tag: 'Curly, brave & 8', color: '#ff5fa2', cheer: 'Yay! I did it!', draw: drawPomPom },
  ];
  const charById = id => CHARACTERS.find(ch => ch.id === id) || CHARACTERS[2];

  /* ---------------- Bananas and coins ---------------- */
  const BANANA_LOOK = {
    normal: { body: '#ffe14d', edge: '#c99a00' },
    rotten: { body: '#c9913e', edge: '#7a4f17' },
    rescue: { body: '#a6e35f', edge: '#4f8f22' },
    ghost: { body: '#c8f7ff', edge: '#2f9fc4' },
    gold: { body: '#ffd700', edge: '#b8860b' },
  };
  function mixColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  // Top surface sits at y = 0 (where the climber stands).
  function drawBanana(c, w, look, ripe, spots) {
    const body = ripe > 0 ? mixColor(look.body, '#a0612a', ripe) : look.body;
    c.beginPath();
    c.moveTo(-w / 2, -4);
    c.quadraticCurveTo(0, 6, w / 2, -4);
    c.quadraticCurveTo(w * 0.05, 30, -w / 2, -4);
    c.closePath();
    c.fillStyle = body; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = look.edge; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-w * 0.32, 2.5); c.quadraticCurveTo(0, 8.5, w * 0.32, 2.5); c.stroke();
    if (spots) for (const [sx, sy] of [[-0.25, 7], [0.05, 10], [0.28, 6], [-0.05, 5]]) ell(c, sx * w, sy, 2.6, 1.8, '#5b3a1a');
    ell(c, -w / 2, -4, 3.5, 3, '#5b3a1a');
    ell(c, w / 2 + 1, -5, 3.5, 2.6, '#3d6b1f');
  }

  const COIN_LOOK = {
    1: { face: '#f0a35e', edge: '#b5651d', text: '#6e3608', r: 12 },
    2: { face: '#e6edf3', edge: '#8b98a5', text: '#3f4a55', r: 13 },
    5: { face: '#ffe066', edge: '#d4a017', text: '#7a4f00', r: 15 },
  };
  function drawCoin(c, x, y, value, t, scale = 1) {
    const L = COIN_LOOK[value];
    const spin = 0.25 + 0.75 * Math.abs(Math.cos(t * 2.5));
    c.save(); c.translate(x, y); c.scale(spin * scale, scale);
    circ(c, 0, 0, L.r, L.edge); circ(c, 0, 0, L.r - 2.6, L.face);
    if (spin > 0.55) {
      c.font = `700 ${L.r * 1.15}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = L.text; c.fillText(String(value), 0, 1);
    }
    c.restore();
  }

  /* ---------------- Canvas and screen size ---------------- */
  const stage = $('#stage');
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  let H = 800, viewScale = 1, dpr = 1;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Width is always 480 game units; height stretches to fill tall phones.
    H = Math.round(clamp((W * vh) / vw, 720, 1040));
    viewScale = Math.min(vw / W, vh / H);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.floor(W * viewScale), ch = Math.floor(H * viewScale);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
    stage.style.fontSize = (16 * viewScale).toFixed(2) + 'px';   // menus scale with the game
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- Game state ---------------- */
  const game = {
    state: 'menu',   // menu | intro | playing | dying | complete | over
    paused: false,
    level: 1, settings: LV.levelSettings(1),
    lives: 3, coinBank: 0, score: 0,
    startLives: 3, startBank: 0, startScore: 0,
    levelCoins: 0, levelCoinTotal: 0, fell: false, stars: 0,
    bananas: [], coins: [], particles: [], popups: [], goal: null,
    coconuts: [], villain: null, eaten: 0,
    camY: 0, clock: 0, time: 0, introT: 0, goT: 9, deadT: 0, doneT: 0, shake: 0,
    started: false, scrollHold: 0, shownDone: false,
  };
  const player = {
    x: W / 2, y: 0, vx: 0, vy: 0, on: null, facing: 1, scale: 1,
    squash: 0, coyote: 0, invuln: 0, lastOn: null, slide: 0, stun: 0,
    get halfW() { return 13 * this.scale; },
  };
  let CHAR = charById(save.character);

  const input = { kLeft: false, kRight: false, tLeft: false, tRight: false, jumpBuffer: 0 };
  const queueJump = () => { input.jumpBuffer = 0.15; };

  function tipLimit(b) {
    switch (b.type) {
      case 'normal': case 'ghost': return game.settings.tipTime;
      case 'rotten': return game.settings.tipTime * 0.55;
      case 'rescue': return 3.5;
      default: return 0;   // ground and goal never drop
    }
  }

  function loadLevelData(n, seed) {
    const lvl = LV.buildLevel(n, seed);
    game.settings = lvl.settings;
    const plat = b => Object.assign({ baseX: b.x, amp: 0, phase: 0, speed: 0, stood: 0, state: 'ok', vy: 0, rot: 0, spin: 0, dx: 0, tilt: 0, creaked: false }, b);
    game.bananas = [plat({ x: W / 2, y: 0, w: W * 3, type: 'ground' })]
      .concat(lvl.bananas.map(plat), [plat(lvl.goal)]);
    game.goal = game.bananas[game.bananas.length - 1];
    game.coins = lvl.coins.map(cn => Object.assign({ taken: false, phase: Math.random() * TAU }, cn));
    game.levelCoinTotal = lvl.coins.reduce((s, cn) => s + cn.value, 0);
  }

  function startLevel(n, freshRun) {
    if (freshRun) { game.lives = 3; game.coinBank = 0; game.score = 0; }
    game.startLives = game.lives; game.startBank = game.coinBank; game.startScore = game.score;
    game.level = n;
    loadLevelData(n, (Math.random() * 1e9) | 0);
    Object.assign(game, {
      state: 'intro', paused: false, levelCoins: 0, fell: false, particles: [], popups: [],
      time: 0, introT: 0, goT: 9, deadT: 0, doneT: 0, shake: 0, started: false, scrollHold: 1.5, shownDone: false,
      coconuts: [], eaten: 0,
      villain: game.settings.villain ? { x: W * 0.75, y: 0, off: 0, throwT: 2.5, windup: 0 } : null,
    });
    Object.assign(player, {
      x: W / 2, y: 0, vx: 0, vy: 0, on: game.bananas[0], facing: 1,
      scale: game.settings.growth, squash: 0, coyote: 0, invuln: 0, lastOn: game.bananas[0], slide: 0, stun: 0,
    });
    input.jumpBuffer = 0;
    game.camY = -(H - 150);
    show(null);
    Sound.music(n);
  }

  function restartLevel() {
    game.lives = game.startLives; game.coinBank = game.startBank; game.score = game.startScore;
    startLevel(game.level, false);
  }

  /* ---------------- Effects ---------------- */
  function burst(x, y, n, colors, o = {}) {
    const sp = o.speed || 160;
    for (let i = 0; i < n; i++) {
      const life = rnd(0.45, 0.95) * (o.life || 1);
      game.particles.push({
        x, y, vx: rnd(-1, 1) * sp, vy: rnd(-1, 0.3) * sp - (o.up || 60), life, max: life,
        color: colors[i % colors.length], size: rnd(2, 5) * (o.size || 1), g: o.g == null ? 500 : o.g,
        kind: o.kind || 'dot', rot: rnd(0, TAU), vr: rnd(-8, 8),
      });
    }
  }
  function popup(x, y, text, color = '#fff', size = 22) {
    game.popups.push({ x, y, text, color, size, life: 1.2, max: 1.2 });
  }
  function confetti() {
    burst(rnd(20, W - 20), game.camY - 10, 6, ['#ff5fa2', '#ffd23f', '#7ed957', '#5cc8ff', '#b388ff'],
      { kind: 'confetti', speed: 90, up: -40, g: 120, life: 3.5, size: 1.4 });
  }

  /* ---------------- Physics and rules ---------------- */
  const EAT_EVERY = 0.22;
  const EAT_DONE = 0.5 + BUNCH.length * EAT_EVERY;
  const BRUNO_LINES = ['Grrr! My bananas!', 'Not fair!', 'I’ll get you next time!', 'Nooo! My racimo!'];
  const YUMS = ['¡Ñam!', 'Yum!', '¡Ñam ñam!', 'Mmm!', 'Chomp!'];

  function updatePlatforms(dt) {
    for (const b of game.bananas) {
      if (b.amp) {
        b.phase += (dt * b.speed) / b.amp;
        const nx = b.baseX + Math.sin(b.phase) * b.amp;
        b.dx = nx - b.x; b.x = nx;
      } else b.dx = 0;
      if (b !== player.on && b.tilt) b.tilt *= 1 - Math.min(1, dt * 3);   // levels out again when empty
      if (b.state === 'falling') { b.vy += PHYS.gravity * 0.6 * dt; b.y += b.vy * dt; b.rot += b.spin * dt; }
    }
    // forget bananas that fell far off screen
    if (game.bananas.length > 3) game.bananas = game.bananas.filter(b => b.state !== 'falling' || b.y - game.camY < H + 400);
  }

  function tipBanana(b) {
    b.state = 'falling'; b.vy = 60; b.spin = rnd(-3, 3) || 2;
    Sound.sfx('tip');
    burst(b.x, b.y + 6, 8, ['#ffe14d', '#c99a00', '#5b3a1a'], { speed: 120 });
  }

  function land(b) {
    const p = player;
    p.on = b; p.y = b.y; p.vy = 0; p.squash = 0.3; p.slide = 0;
    if (b.type === 'goal') { levelComplete(); return; }
    Sound.sfx('land');
    burst(p.x, p.y, 5, ['#fff6c8', '#e9d9a8'], { speed: 70, up: 20, g: 200, size: 0.8 });
    if (b !== p.lastOn && b.type !== 'ground' && b.stood === 0 && Math.abs(p.x - b.x) < 10) {
      game.score += 25;
      popup(b.x, b.y - 60 * p.scale, 'PERFECT!', '#ffd23f', 24);
      burst(b.x, b.y - 4, 14, ['#ffd23f', '#fff'], { speed: 200 });
      Sound.sfx('perfect');
    }
    p.lastOn = b;
  }

  function updatePlayer(dt) {
    const p = player;
    if (p.invuln > 0) p.invuln -= dt;
    p.squash += (0 - p.squash) * Math.min(1, dt * 12);

    // the banana under you wobbles, ripens, then drops
    if (p.on) {
      const b = p.on, limit = tipLimit(b);
      p.x += b.dx;
      if (limit) {
        b.stood += dt;
        if (!b.creaked && b.stood > limit * 0.6) { b.creaked = true; Sound.sfx('creak'); }
        if (b.stood >= limit) { tipBanana(b); p.on = null; p.coyote = 0.06; }
      }
      // a ghost banana fading out lets you fall through
      if (p.on && b.type === 'ghost' && !LV.ghostSolid(b, game.clock)) { p.on = null; p.coyote = 0.06; }
    }

    if (p.stun > 0) p.stun -= dt;
    const dir = p.stun > 0 ? 0 : (input.kRight || input.tRight ? 1 : 0) - (input.kLeft || input.tLeft ? 1 : 0);
    if (dir) p.facing = dir;
    p.vx += (dir * PHYS.runSpeed - p.vx) * Math.min(1, dt * (p.on ? 16 : 9));

    // Balancing: the banana tips toward the side you stand on and you slide that way.
    // Stand near the middle, or push the other way, to stay on.
    if (p.on && (p.on.type === 'normal' || p.on.type === 'ghost' || p.on.type === 'rotten' || p.on.type === 'rescue')) {
      const b = p.on, off = clamp((p.x - b.x) / (b.w / 2), -1, 1);
      const most = game.settings.maxTilt * (b.type === 'rescue' ? 0.5 : 1);
      b.tilt += (off * most - b.tilt) * Math.min(1, dt * 5);
      p.slide = clamp(p.slide + Math.sin(b.tilt) * 1100 * dt, -320, 320);
      if (dir && Math.sign(dir) !== Math.sign(p.slide)) p.slide -= Math.sign(p.slide) * Math.min(Math.abs(p.slide), 900 * dt);
      p.x += p.slide * dt;
    } else p.slide = 0;

    if (input.jumpBuffer > 0) input.jumpBuffer -= dt;
    if (p.on) p.coyote = 0.1; else p.coyote -= dt;
    if (input.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -game.settings.jumpV; p.on = null; p.coyote = 0; input.jumpBuffer = 0; p.squash = -0.25;
      game.started = true;
      Sound.sfx('jump');
    }

    const prevY = p.y;
    p.x = clamp(p.x + p.vx * dt, p.halfW, W - p.halfW);
    if (p.on) {
      if (Math.abs(p.x - p.on.x) > p.on.w / 2 + p.halfW * 0.4) { p.on = null; game.started = true; }   // walked or slid off the edge
      else p.y = p.on.y + (p.x - p.on.x) * Math.sin(p.on.tilt || 0);   // follow the tipped surface
    } else {
      p.vy = Math.min(p.vy + game.settings.gravity * dt, 1400);
      p.y += p.vy * dt;
      if (p.vy >= 0) {
        for (const b of game.bananas) {
          if (b.state !== 'ok' || (b.type === 'ghost' && !LV.ghostSolid(b, game.clock))) continue;
          if (prevY <= b.y + 1 && p.y >= b.y && Math.abs(p.x - b.x) <= b.w / 2 + p.halfW * 0.5) { land(b); break; }
        }
      }
    }
  }

  function collectCoins() {
    const p = player, cy = p.y - 24 * p.scale, reach = 14 + 16 * p.scale;
    for (const cn of game.coins) {
      if (cn.taken) continue;
      if (Math.hypot(cn.x - p.x, cn.y - cy) > reach) continue;
      cn.taken = true;
      game.coinBank += cn.value; game.levelCoins += cn.value; game.score += cn.value * 10;
      popup(cn.x, cn.y - 10, '+' + cn.value, COIN_LOOK[cn.value].face, 22);
      burst(cn.x, cn.y, 10, [COIN_LOOK[cn.value].face, '#fff'], { speed: 150 });
      Sound.sfx('coin', cn.value);
      while (game.coinBank >= COINS_PER_LIFE) {
        game.coinBank -= COINS_PER_LIFE;
        if (game.lives < MAX_LIVES) {
          game.lives++;
          popup(p.x, p.y - 80 * p.scale, '+1 LIFE!', '#ff5f7e', 30);
          Sound.sfx('life');
        } else {
          game.score += 200;
          popup(p.x, p.y - 80 * p.scale, '+200', '#ff5f7e', 28);
        }
      }
    }
  }

  function updateCamera(dt) {
    const target = player.y - H * 0.58;
    if (target < game.camY) game.camY += (target - game.camY) * Math.min(1, dt * 5);
    if (game.scrollHold > 0) game.scrollHold -= dt;
    else if ((game.started || game.settings.scrollAlways) && game.settings.scroll) game.camY -= game.settings.scroll * dt;
    game.camY = Math.max(game.camY, game.goal.y - 230);
  }

  /* Bruno the Bad Baboon swings along the top of the screen, follows you and throws coconuts. */
  function updateVillain(dt) {
    const v = game.villain;
    if (!v) return;
    v.y = game.camY + 160 + v.off;
    if (game.state === 'complete') { v.off -= 280 * dt; return; }   // runs away when you reach the top
    const sp = (40 + game.settings.level * 7) * dt;
    v.x += clamp(clamp(player.x, 40, W - 50) - v.x, -sp, sp);
    if (v.windup > 0) {
      v.windup -= dt;
      if (v.windup <= 0) throwCoconut(v);
    } else if (game.started && player.invuln <= 0) {
      v.throwT -= dt;
      if (v.throwT <= 0) { v.windup = 0.7; v.throwT = game.settings.throwEvery * rnd(0.8, 1.25); }
    }
  }
  function throwCoconut(v) {
    const n = game.settings.doubleThrow && Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? (i ? 70 : -70) : 0;
      game.coconuts.push({
        x: v.x + 22, y: v.y - 50, vx: clamp((player.x - v.x) * 0.6, -110, 110) + spread, vy: -60, rot: 0,
      });
    }
    Sound.sfx('throw');
  }
  function updateCoconuts(dt) {
    const p = player, cy = p.y - 24 * p.scale, reach = 10 + 13 * p.scale;
    for (const cn of game.coconuts) {
      cn.vy += 800 * dt; cn.x += cn.vx * dt; cn.y += cn.vy * dt; cn.rot += 7 * dt;
      if (!cn.gone && game.state === 'playing' && p.invuln <= 0 && Math.hypot(cn.x - p.x, cn.y - cy) < reach) {
        cn.gone = true;
        bonk(cn);
      }
    }
    game.coconuts = game.coconuts.filter(cn => !cn.gone && cn.y < game.camY + H + 60);
  }
  function bonk(cn) {
    const p = player;
    p.on = null; p.vy = 140; p.vx = (p.x < cn.x ? -1 : 1) * 200; p.slide = 0;
    p.stun = 0.5; p.invuln = 0.9; p.coyote = 0;
    game.shake = 0.2;
    popup(p.x, p.y - 70 * p.scale, 'BONK!', '#ff9f43', 30);
    burst(cn.x, cn.y, 12, ['#6b4423', '#fff', '#c58b5a'], { speed: 200 });
    Sound.sfx('bonk');
  }

  function die() {
    game.state = 'dying'; game.deadT = 0; game.fell = true; game.shake = 0.35;
    game.lives--;
    Sound.sfx('fall');
  }

  function respawn() {
    const y = Math.round(game.camY + H * 0.62);
    const r = { x: W / 2, baseX: W / 2, y, w: 140, type: 'rescue', amp: 0, phase: 0, speed: 0, stood: 0, state: 'ok', vy: 0, rot: 0, spin: 0, dx: 0, tilt: 0, creaked: false };
    game.bananas.push(r);
    Object.assign(player, { x: W / 2, y, vx: 0, vy: 0, on: r, lastOn: r, invuln: 1.5, squash: 0.3, slide: 0, stun: 0 });
    game.coconuts = [];
    input.jumpBuffer = 0;
    game.scrollHold = 1.2;
    game.state = 'playing';
    burst(W / 2, y - 20, 18, ['#a6e35f', '#fff', '#ffd23f'], { speed: 180 });
    popup(W / 2, y - 70, 'Try again!', '#a6e35f', 26);
    Sound.sfx('rescue');
  }

  function levelComplete() {
    const s = game.settings, n = s.level;
    game.state = 'complete'; game.doneT = 0; game.shownDone = false;
    const bonus = Math.max(0, Math.round((s.parTime - game.time) * 10));
    game.score += 100 * n + bonus;
    game.timeBonus = bonus;
    game.starList = [true, !game.fell, game.levelCoins >= Math.ceil(game.levelCoinTotal * 0.6)];
    game.stars = game.starList.filter(Boolean).length;
    save.stars[n] = Math.max(save.stars[n] || 0, game.stars);
    save.unlocked = Math.max(save.unlocked, Math.min(MAX_LEVEL, n + 1));
    save.best = Math.max(save.best, game.score);
    writeSave();
    Sound.stopMusic();
    Sound.sfx('win');
    game.coconuts = [];
    if (game.villain) {
      const v = game.villain;
      popup(v.x, v.y - 80, BRUNO_LINES[n % BRUNO_LINES.length], '#c9b8ff', 20);
      setTimeout(() => Sound.sfx('grr'), 500);
    }
    burst(player.x, player.y - 30, 40, ['#ff5fa2', '#ffd23f', '#7ed957', '#5cc8ff'], { speed: 320, kind: 'confetti', g: 300, life: 1.6 });
  }

  function gameOver() {
    game.state = 'over';
    save.best = Math.max(save.best, game.score);
    writeSave();
    Sound.stopMusic();
    Sound.sfx('over');
    $('#o-text').textContent = `You reached level ${game.level} with ${game.score} points.`;
    show('over');
  }

  function update(dt) {
    game.clock += dt;
    if (game.shake > 0) game.shake -= dt;
    updatePlatforms(dt);
    for (const pt of game.particles) {
      pt.life -= dt; pt.vy += pt.g * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.rot += pt.vr * dt;
    }
    game.particles = game.particles.filter(pt => pt.life > 0);
    for (const pu of game.popups) { pu.life -= dt; pu.y -= 40 * dt; }
    game.popups = game.popups.filter(pu => pu.life > 0);

    switch (game.state) {
      case 'menu':
        game.camY = -(H - 150) - (1 - Math.cos(game.clock * 0.18)) * 0.5 * Math.min(1400, -game.goal.y);
        break;
      case 'intro':
        game.introT += dt;
        if (game.introT >= INTRO_TIME) { game.state = 'playing'; game.goT = 0; Sound.sfx('go'); }
        break;
      case 'playing':
        game.time += dt; game.goT += dt;
        updatePlayer(dt);
        if (game.state !== 'playing') break;   // reached the top this step
        collectCoins();
        updateCamera(dt);
        updateVillain(dt);
        updateCoconuts(dt);
        if (player.y - game.camY > H + 40) die();
        break;
      case 'dying':
        game.deadT += dt;
        if (game.deadT > 1.2) { if (game.lives <= 0) gameOver(); else respawn(); }
        break;
      case 'complete': {
        // walk up to the banana bunch and eat it, one banana at a time
        game.doneT += dt;
        updateVillain(dt);
        updateCoconuts(dt);
        const p = player, g = game.goal;
        p.x += (g.x - 38 - p.x) * Math.min(1, dt * 6);
        p.facing = 1;
        const want = clamp(Math.floor((game.doneT - 0.5) / EAT_EVERY) + 1, 0, BUNCH.length);
        while (game.eaten < want) {
          game.eaten++;
          const side = game.eaten % 2 ? -1 : 1;
          popup(g.x + 25 + side * rnd(110, 150), g.y - rnd(40, 110), YUMS[game.eaten % YUMS.length], '#ffd23f', 26);
          burst(g.x + 20, g.y - 60, 6, ['#ffe14d', '#fff6c8'], { speed: 120 });
          Sound.sfx('chomp');
        }
        if (game.eaten >= BUNCH.length) {
          player.squash = -Math.abs(Math.sin(game.doneT * 8)) * 0.15;
          if (Math.random() < dt * 8) confetti();
        }
        if (game.doneT > EAT_DONE + 0.6 && !game.shownDone) { game.shownDone = true; showComplete(); }
        break;
      }
    }
  }

  /* ---------------- Rendering ---------------- */
  const THEMES = [
    { top: '#5cc8ff', bot: '#d3f6ff', hill: '#69c46a', hill2: '#3f9e4a', cloud: 'rgba(255,255,255,0.9)', night: false, sun: '#fff27a' },
    { top: '#ff8a5c', bot: '#ffe29a', hill: '#c98a45', hill2: '#9c6430', cloud: 'rgba(255,240,230,0.85)', night: false, sun: '#fff0b0' },
    { top: '#141a4a', bot: '#4b3c8f', hill: '#2c4a5e', hill2: '#1d3344', cloud: 'rgba(200,200,255,0.18)', night: true, sun: '#f5f3ce' },
  ];
  const themeFor = n => THEMES[n <= 5 ? 0 : n <= 10 ? 1 : 2];

  function label(text, x, y, size, fill = '#fff', stroke = INK, align = 'center') {
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (stroke) { ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function wrapText(text, x, y, maxW, size, color) {
    ctx.font = `600 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    const words = text.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.25));
    return lines.length;
  }
  function heart(x, y, s, fill) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 16, s / 16);
    ctx.beginPath(); ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-11, -1, -7, -11, 0, -4);
    ctx.bezierCurveTo(7, -11, 11, -1, 0, 7);
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }

  const inSpace = () => game.state !== 'menu' && game.settings.space;

  // World 2 sky: drifting nebulas, two layers of moving stars, planets and shooting stars.
  const PLANETS = [
    { x: 370, y: 140, r: 44, col: '#ff9f43', dark: '#c4691b', ring: true },
    { x: 85, y: 720, r: 28, col: '#4dd0e1', dark: '#2595a5', ring: false },
    { x: 330, y: 1250, r: 58, col: '#b388ff', dark: '#7c4dce', ring: false },
  ];
  function drawSpaceBackground(climb) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07041f'); g.addColorStop(0.6, '#1c0c45'); g.addColorStop(1, '#371563');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const neb = ['#ff5fa2', '#36d1dc', '#b388ff', '#ffd23f'];
    for (let i = 0; i < 4; i++) {
      const span = H + 700;
      const y = (((i * 420 + climb * 0.08 + game.clock * 4) % span) + span) % span - 350;
      ctx.globalAlpha = 0.14;
      circ(ctx, (i * 173) % W, y, 170, neb[i]);
      circ(ctx, (i * 173 + 90) % W, y + 60, 110, neb[(i + 1) % 4]);
    }
    // the galaxy keeps flowing past, even when you stand still
    for (const [n, par, size, drift] of [[70, 0.12, 1.1, 12], [40, 0.4, 1.9, 40]]) {
      for (let i = 0; i < n; i++) {
        const x = (i * 137.5 + size * 50) % W;
        const y = (((i * 211.3 + climb * par + game.clock * drift) % H) + H) % H;
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(game.clock * 2 + i));
        circ(ctx, x, y, size, i % 7 === 0 ? '#ffe9a8' : '#ffffff');
      }
    }
    ctx.globalAlpha = 1;
    for (const p of PLANETS) {
      const span = 1700;
      const y = (((p.y + climb * 0.22 + game.clock * 6) % span) + span) % span - 200;
      if (y < -120 || y > H + 120) continue;
      if (p.ring) { ctx.strokeStyle = 'rgba(255,230,180,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.8, p.r * 0.45, -0.35, Math.PI, TAU); ctx.stroke(); }
      circ(ctx, p.x, y, p.r, p.col);
      ctx.globalAlpha = 0.45; circ(ctx, p.x + p.r * 0.35, y + p.r * 0.2, p.r * 0.8, p.dark); ctx.globalAlpha = 1;
      circ(ctx, p.x - p.r * 0.35, y - p.r * 0.35, p.r * 0.18, 'rgba(255,255,255,0.5)');
      if (p.ring) { ctx.strokeStyle = 'rgba(255,230,180,0.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(p.x, y, p.r * 1.8, p.r * 0.45, -0.35, 0, Math.PI); ctx.stroke(); }
    }
    // a shooting star every few seconds
    const st = game.clock % 4.5;
    if (st < 0.8) {
      const k = Math.floor(game.clock / 4.5);
      const sx = ((k * 211) % W) + st * 420, sy = 60 + ((k * 97) % 300) + st * 160;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ln(ctx, sx, sy, sx - 60, sy - 23);
      circ(ctx, sx, sy, 2.5, '#fff');
    }
  }

  function drawBackground() {
    const climb = -game.camY - (H - 150);   // how far the camera has risen
    if (inSpace()) { drawSpaceBackground(climb); return; }
    const th = themeFor(game.state === 'menu' ? 1 : game.level);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (th.night) {
      for (let i = 0; i < 70; i++) {
        const sx = (i * 97.3) % W, sy = (((i * 173.7 + climb * 0.05) % H) + H) % H;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(game.clock * 1.5 + i));
        circ(ctx, sx, sy, i % 5 === 0 ? 1.8 : 1.1, '#fff');
      }
      ctx.globalAlpha = 1;
    }
    const sunY = 130 + climb * 0.03;
    circ(ctx, W - 85, sunY, 46, th.sun + '55');
    circ(ctx, W - 85, sunY, 32, th.sun);

    // clouds drift past slower than the bananas (parallax)
    for (let i = 0; i < 7; i++) {
      const span = H + 240;
      const cy = (((i * 260 + climb * 0.35) % span) + span) % span - 120;
      const cx = ((i * 151 + game.clock * (6 + i)) % (W + 200)) - 100;
      ctx.fillStyle = th.cloud;
      for (const [ox, oy, r] of [[0, 0, 24], [22, -10, 28], [46, 0, 22], [24, 8, 22]]) {
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, TAU); ctx.fill();
      }
    }

    // far hills sink away as you climb
    const hillY = H - 50 + climb * 0.3;
    if (hillY < H + 120) {
      for (const [col, amp, off, dy] of [[th.hill, 30, 0, 0], [th.hill2, 22, 2, 40]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hillY + dy - 60 - Math.sin(x / 70 + off) * amp);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
    }

    // jungle vines on both sides
    const vOff = ((climb * 0.7) % 150 + 150) % 150;
    ctx.strokeStyle = th.night ? '#1f5b3a' : '#2f8a4c'; ctx.lineWidth = 4;
    for (const side of [0, 1]) {
      const vx = side ? W - 10 : 10;
      ctx.beginPath(); ctx.moveTo(vx, 0);
      for (let y = 0; y <= H; y += 25) ctx.lineTo(vx + Math.sin((y + climb * 0.7) / 40) * 6 * (side ? -1 : 1), y);
      ctx.stroke();
      for (let y = -150 + vOff; y < H; y += 150) {
        ell(ctx, vx + (side ? -12 : 12), y, 13, 6, th.night ? '#256b45' : '#4cb35f', side ? 0.6 : -0.6);
        ell(ctx, vx + (side ? -10 : 10), y + 50, 11, 5, th.night ? '#1f5b3a' : '#3d9e52', side ? -0.5 : 0.5);
      }
    }
  }

  function drawWorld() {
    // the banana tree trunk you are climbing
    const top = game.goal ? game.goal.y : -2000;
    const t0 = Math.max(top, game.camY - 20), t1 = Math.min(0, game.camY + H + 20);
    const space = inSpace();
    if (t1 > t0 && !space) {
      ctx.fillStyle = 'rgba(139, 90, 43, 0.8)';
      ctx.fillRect(W / 2 - 34, t0, 68, t1 - t0);
      ctx.fillStyle = 'rgba(255, 220, 160, 0.18)';
      ctx.fillRect(W / 2 - 24, t0, 14, t1 - t0);
      ctx.strokeStyle = 'rgba(80, 50, 20, 0.5)'; ctx.lineWidth = 3;
      for (let y = Math.ceil(t0 / 70) * 70; y < t1; y += 70) {
        ctx.beginPath(); ctx.moveTo(W / 2 - 34, y); ctx.quadraticCurveTo(W / 2, y + 14, W / 2 + 34, y); ctx.stroke();
      }
    }
    // ground
    if (game.camY + H > -20 && space) {
      // moon surface with craters
      ctx.fillStyle = '#a7a9c4'; ctx.fillRect(0, 0, W, 400);
      ctx.fillStyle = '#c9cbe0'; ctx.fillRect(0, 0, W, 6);
      for (const [cx, cy, r] of [[60, 40, 22], [190, 70, 14], [300, 35, 28], [420, 80, 18], [130, 130, 30], [360, 150, 24]]) {
        ell(ctx, cx, cy, r, r * 0.45, '#8c8eab');
        ell(ctx, cx, cy - 2, r * 0.8, r * 0.3, '#7a7c99');
      }
    } else if (game.camY + H > -20) {
      ctx.fillStyle = '#5bb35a'; ctx.fillRect(0, 0, W, 400);
      ctx.fillStyle = '#4a9a49'; ctx.fillRect(0, 26, W, 400);
      ctx.fillStyle = '#7fd36f';
      for (let x = 6; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x + 5, -9); ctx.lineTo(x + 10, 2); ctx.fill(); }
    }
    // leafy crown and the top banana bunch
    if (game.goal) {
      const gy = game.goal.y, final = game.settings.final && game.state !== 'menu';
      if (space) {
        // Banana Space Station: antenna, metal deck with blinking lights, rocket flames underneath
        ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 5; ln(ctx, W / 2 - 80, gy, W / 2 - 80, gy - 95);
        circ(ctx, W / 2 - 80, gy - 98, 6, Math.sin(game.clock * 6) > 0 ? '#ff4d6d' : '#7ed957');
        ctx.fillStyle = '#e8eef2'; ctx.beginPath(); ctx.ellipse(W / 2 - 80, gy - 70, 22, 9, -0.5, 0, Math.PI); ctx.fill();
        for (const fx of [-60, 60]) {
          const f = 18 + Math.sin(game.clock * 30 + fx) * 5;
          ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(W / 2 + fx - 12, gy + 16); ctx.lineTo(W / 2 + fx, gy + 16 + f * 1.6); ctx.lineTo(W / 2 + fx + 12, gy + 16); ctx.fill();
          ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(W / 2 + fx - 6, gy + 16); ctx.lineTo(W / 2 + fx, gy + 16 + f); ctx.lineTo(W / 2 + fx + 6, gy + 16); ctx.fill();
        }
        ctx.fillStyle = '#b0bec5'; rr(ctx, W / 2 - 108, gy - 1, 216, 18, 6); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#546e7a'; ctx.stroke();
        for (let i = 0; i < 7; i++) circ(ctx, W / 2 - 90 + i * 30, gy + 8, 3.5, (i + Math.floor(game.clock * 4)) % 3 ? '#4dd0e1' : '#ffd23f');
      } else {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + (i / 6) * Math.PI;
          ell(ctx, W / 2 + Math.cos(a) * 95, gy - 20 + Math.sin(a) * 55, 70, 20, i % 2 ? '#3d9e52' : '#4cb35f', a);
        }
        // the branch you land on, and the banana bunch (racimo) waiting on it
        ctx.fillStyle = '#8b5a2b'; rr(ctx, W / 2 - 108, gy - 1, 216, 16, 8); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#5b3a1a'; ctx.stroke();
        ell(ctx, W / 2 - 112, gy + 4, 22, 9, '#4cb35f', -0.3); ell(ctx, W / 2 + 112, gy + 4, 22, 9, '#4cb35f', 0.3);
      }
      if (final) {
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(game.clock * 4);
        circ(ctx, W / 2 + 25, gy - 60, 85, '#fff6a0');
        ctx.globalAlpha = 1;
      }
      drawBunch(ctx, W / 2 + 25, gy, game.state === 'menu' ? 0 : game.eaten, final);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ln(ctx, W / 2 + 92, gy, W / 2 + 92, gy - 70);
      ctx.fillStyle = final ? '#ffd700' : '#ff5fa2';
      ctx.beginPath(); ctx.moveTo(W / 2 + 92, gy - 70); ctx.lineTo(W / 2 + 140, gy - 58 + Math.sin(game.clock * 5) * 3);
      ctx.lineTo(W / 2 + 92, gy - 46); ctx.closePath(); ctx.fill();
      label(final ? 'WIN!' : 'TOP!', W / 2 + 110, gy - 58, 13, '#fff', INK);
    }
    // bananas
    for (const b of game.bananas) {
      if (b.type === 'ground' || b.type === 'goal') continue;
      if (b.y < game.camY - 60 || b.y > game.camY + H + 60) continue;
      const limit = tipLimit(b);
      const f = limit ? clamp(b.stood / limit, 0, 1) : 0;
      const wob = b.state === 'ok' ? Math.sin(game.clock * (8 + 14 * f)) * 0.13 * f : 0;
      ctx.save();
      ctx.translate(b.x, b.y + (b.state === 'ok' && player.on === b ? 2 : 0));
      ctx.rotate(wob + b.rot + (b.tilt || 0));
      if (b.type === 'rescue') { ctx.globalAlpha = 0.35; circ(ctx, 0, 6, b.w * 0.45, '#ffffff'); ctx.globalAlpha = 1; }
      if (space) { ctx.globalAlpha = 0.28; ell(ctx, 0, 6, b.w * 0.62, 17, b.type === 'ghost' ? '#36d1dc' : '#b388ff'); ctx.globalAlpha = 1; }
      if (b.type === 'ghost') {
        // solid for 2 s, flickers as a warning, then see-through for 1 s
        const ph = (game.clock + b.blink) % LV.GHOST.period;
        ctx.globalAlpha = ph >= LV.GHOST.solid ? 0.2 : ph > LV.GHOST.solid - 0.5 ? 0.55 + 0.45 * Math.sin(game.clock * 40) : 1;
      }
      drawBanana(ctx, b.w, BANANA_LOOK[b.type] || BANANA_LOOK.normal, f * 0.85, b.type === 'rotten' || f > 0.5);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // coins
    for (const cn of game.coins) {
      if (cn.taken || cn.y < game.camY - 30 || cn.y > game.camY + H + 30) continue;
      drawCoin(ctx, cn.x, cn.y + Math.sin(game.clock * 3 + cn.phase) * 4, cn.value, game.clock + cn.phase);
    }
    // the climber
    if (game.state !== 'dying' && game.state !== 'over') drawPlayer();
    // Bruno and his coconuts
    for (const cn of game.coconuts) {
      if (space) drawMeteor(ctx, cn.x, cn.y, 12, cn.rot); else drawCoconut(ctx, cn.x, cn.y, 11, cn.rot);
    }
    const v = game.villain;
    if (v && game.state !== 'menu' && v.y > game.camY - 80) {
      if (!space) {
        ctx.strokeStyle = '#2f8a4c'; ctx.lineWidth = 4;
        ln(ctx, v.x - 7, game.camY - 10, v.x - 7, v.y - 70);
      }
      ctx.save(); ctx.translate(v.x, v.y + Math.sin(game.clock * 2) * 4);
      ctx.rotate(Math.sin(game.clock * 2) * 0.08);
      ctx.scale(1.5, 1.5);
      if (space) {   // Bruno's UFO: glass dome behind him, saucer in front
        ctx.globalAlpha = 0.3; circ(ctx, 0, -28, 30, '#bdf3ff'); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -28, 30, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }
      drawBaboon(ctx, { t: game.clock, windup: v.windup, flee: game.state === 'complete' });
      if (space) {
        ell(ctx, 0, -2, 40, 11, '#90a4ae'); ell(ctx, 0, -5, 40, 7, '#cfd8dc');
        for (let i = -2; i <= 2; i++) circ(ctx, i * 15, -1, 2.6, (i + Math.floor(game.clock * 6)) % 2 ? '#ffd23f' : '#ff5fa2');
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(game.clock * 8);
        ctx.fillStyle = '#7ef9ff'; ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(14, 8); ctx.lineTo(24, 40); ctx.lineTo(-24, 40); ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (v.windup > 0) label('!', v.x - 40, v.y - 40, 36 + Math.sin(game.clock * 20) * 4, '#ff4d4d');
    }
    // particles and floating text
    for (const pt of game.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      if (pt.kind === 'confetti') {
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot);
        ctx.fillStyle = pt.color; ctx.fillRect(-pt.size, -pt.size / 2, pt.size * 2, pt.size);
        ctx.restore();
      } else circ(ctx, pt.x, pt.y, pt.size, pt.color);
    }
    ctx.globalAlpha = 1;
    for (const pu of game.popups) {
      ctx.globalAlpha = clamp(pu.life / pu.max * 2, 0, 1);
      label(pu.text, pu.x, pu.y, pu.size, pu.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    let y = p.y;
    const party = game.state === 'complete' && game.eaten >= BUNCH.length;
    if (party) y -= Math.abs(Math.sin(game.doneT * 8)) * 18;
    else if (game.state === 'complete') y -= Math.abs(Math.sin(game.doneT * 14)) * 3;   // chewing
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale(p.scale * p.facing * (1 + p.squash * 0.6), p.scale * (1 - p.squash));
    CHAR.draw(ctx, {
      t: game.clock,
      run: p.on ? Math.min(1, Math.abs(p.vx) / PHYS.runSpeed) : 0,
      air: !p.on || party,
      blink: game.clock % 3.3 < 0.12,
    });
    if (inSpace()) {   // space helmet
      ctx.globalAlpha = 0.2; circ(ctx, 0, -38, 23, '#bdf3ff'); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -38, 23, 0, TAU); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -38, 17, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
      ctx.fillStyle = '#90a4ae'; rr(ctx, -12, -17, 24, 4, 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawHUD() {
    const s = game.settings;
    ctx.fillStyle = 'rgba(40, 25, 10, 0.4)'; rr(ctx, 6, 6, W - 62, 62, 14); ctx.fill();
    // lives
    if (game.lives <= 5) for (let i = 0; i < game.lives; i++) heart(24 + i * 25, 25, 21, '#ff4d6d');
    else { heart(24, 25, 21, '#ff4d6d'); label('x' + game.lives, 40, 26, 18, '#fff', INK, 'left'); }
    // coins toward the next extra life
    drawCoin(ctx, 22, 51, 1, 0, 0.75);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, 36, 45, 100, 12, 6); ctx.fill();
    ctx.fillStyle = '#ffd23f'; rr(ctx, 36, 45, Math.max(12, 100 * (game.coinBank / COINS_PER_LIFE)), 12, 6); ctx.fill();
    label(`${game.coinBank}/${COINS_PER_LIFE}`, 142, 51, 14, '#fff', INK, 'left');
    heart(200, 51, 13, '#ff8fa3');
    // level and speed
    label(`LEVEL ${s.level}`, 282, 25, 21, '#ffd23f');
    const sc = s.speed === 'Slow' ? '#7ed957' : s.speed === 'Medium' ? '#ffb347' : '#ff6b6b';
    label((s.space ? 'SPACE · ' : '') + s.speed.toUpperCase(), 282, 50, 14, sc);
    // time and score
    const secs = Math.floor(game.time);
    label(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 378, 25, 18, '#fff');
    label(String(game.score), 378, 50, 15, '#fff');

    // climb progress on the right edge
    if (game.goal) {
      const y1 = 92, y2 = H - 170, x = W - 14;
      const prog = clamp(-player.y / -game.goal.y, 0, 1);
      ctx.fillStyle = 'rgba(40,25,10,0.35)'; rr(ctx, x - 5, y1, 10, y2 - y1, 5); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rr(ctx, x - 5, y2 - (y2 - y1) * prog, 10, (y2 - y1) * prog, 5); ctx.fill();
      ctx.save(); ctx.translate(x, y1 - 8); ctx.scale(0.22, 0.22); drawBanana(ctx, 90, BANANA_LOOK.normal, 0, false); ctx.restore();
      circ(ctx, x, y2 - (y2 - y1) * prog, 8, CHAR.color);
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y2 - (y2 - y1) * prog, 8, 0, TAU); ctx.stroke();
    }
  }

  function drawOverlayText() {
    const s = game.settings;
    if (game.state === 'intro') {
      const t = game.introT, pop = Math.min(1, t * 5);
      const cy = H * 0.36;
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pop, pop); ctx.translate(-W / 2, -cy);
      ctx.fillStyle = '#fff8e1'; rr(ctx, 50, cy - 120, W - 100, 250, 26); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      label(`LEVEL ${s.level}`, W / 2, cy - 78, 48, '#ffd23f');
      const icon = s.speed === 'Slow' ? '🐢' : s.speed === 'Medium' ? '🐇' : '🚀';
      label(`${icon} ${s.space ? 'Banana Galaxy · ' : ''}${s.speed} speed`, W / 2, cy - 32, 22,
        s.space ? '#7c4dce' : s.speed === 'Slow' ? '#3f9e4a' : s.speed === 'Medium' ? '#e07b00' : '#e03131', null);
      const tip = s.tip || CHEERS[s.level % CHEERS.length];
      const lines = wrapText(tip, W / 2, cy + 6, W - 150, 18, INK);
      if (s.level > 1) label(`${CHAR.name} grew bigger!`, W / 2, cy + 22 + lines * 22, 17, '#ff5fa2', null);
      ctx.restore();
      if (t > 0.6) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8);
        label('Get ready...', W / 2, cy + 165, 24, '#fff');
        ctx.globalAlpha = 1;
      }
    }
    if (game.state === 'playing' && game.goT < 0.9) {
      ctx.globalAlpha = 1 - game.goT / 0.9;
      label('GO!', W / 2, H * 0.36, 80 + game.goT * 60, '#7ed957');
      ctx.globalAlpha = 1;
    }
    if (game.state === 'dying') {
      label('Oops!', W / 2, H * 0.38, 64, '#ff8fc2');
      const left = Math.max(0, game.lives);
      label(left ? `${left} ${left === 1 ? 'life' : 'lives'} left` : 'No lives left', W / 2, H * 0.38 + 56, 24, '#fff');
    }
    if (game.state === 'complete' && game.doneT < 1.4) {
      label('You made it!', W / 2, H * 0.5, 46 + Math.sin(game.doneT * 10) * 3, '#ffd23f');
    }
  }
  const CHEERS = [
    'You are doing bananas-tastic! Keep hopping!',
    'Higher and higher! Don’t forget the coins!',
    'Jump quickly: the bananas are getting wobbly!',
    'Gold coins are worth 5 points!',
    'Every level you grow a little bigger!',
  ];

  function render() {
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, 0, 0);
    drawBackground();
    ctx.save();
    if (game.shake > 0) ctx.translate(rnd(-6, 6) * game.shake * 2, rnd(-6, 6) * game.shake * 2);
    ctx.translate(0, -Math.round(game.camY));
    drawWorld();
    ctx.restore();
    if (game.state !== 'menu') { drawHUD(); drawOverlayText(); }
  }

  /* ---------------- Menu demo (title screen background) ---------------- */
  function setupDemo() {
    game.state = 'menu'; game.paused = false;
    loadLevelData(4, 2026);
    game.coins.forEach(cn => { cn.taken = false; });
    game.particles = []; game.popups = [];
    Object.assign(player, { x: W / 2, y: 0, vx: 0, vy: 0, on: game.bananas[0], facing: 1, scale: 1.3, squash: 0, invuln: 0 });
  }

  /* ---------------- Screens (HTML overlays) ---------------- */
  const screens = {};
  document.querySelectorAll('.screen').forEach(el => { screens[el.id.replace('scr-', '')] = el; });
  let current = null;
  function show(name) {
    for (const k in screens) screens[k].classList.toggle('hidden', k !== name);
    current = name;
    if (name === 'levels') buildLevelGrid();
    if (name === 'title') $('#best').textContent = save.best;
    const inGame = !name && game.state !== 'menu';
    $('#btn-pause').classList.toggle('hidden', !inGame);
    $('#touch').classList.toggle('hidden', !(inGame && touchMode));
  }

  function buildCharCards() {
    const grid = $('#char-grid');
    grid.innerHTML = '';
    for (const ch of CHARACTERS) {
      const b = document.createElement('button');
      b.className = 'char-card' + (ch.id === save.character ? ' selected' : '');
      b.dataset.id = ch.id;
      b.innerHTML = `<canvas width="240" height="260"></canvas><b>${ch.name}</b><small>${ch.tag}</small>`;
      b.addEventListener('click', () => {
        save.character = ch.id; CHAR = ch; writeSave();
        grid.querySelectorAll('.char-card').forEach(el => el.classList.toggle('selected', el.dataset.id === ch.id));
        Sound.sfx('click');
      });
      grid.appendChild(b);
    }
  }
  function drawCharCards() {
    document.querySelectorAll('.char-card').forEach((card, i) => {
      const cv = card.querySelector('canvas'), c = cv.getContext('2d'), ch = CHARACTERS[i];
      const sel = ch.id === save.character;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const hop = sel ? Math.abs(Math.sin(game.clock * 5)) * 22 : 0;
      ell(c, 120, 238, 60, 10, 'rgba(0,0,0,0.15)');
      c.translate(120, 232 - hop); c.scale(3.6, 3.6);
      ch.draw(c, { t: game.clock + i, run: sel ? 1 : 0, air: sel && hop > 12, blink: (game.clock + i) % 3.1 < 0.12 });
    });
  }

  function buildLevelGrid() {
    const grid = $('#level-grid');
    grid.innerHTML = '';
    for (let n = 1; n <= MAX_LEVEL; n++) {
      if ((n - 1) % LV.WORLD_SIZE === 0) {
        const w = LV.worldOf(n);
        const h = document.createElement('h3');
        h.className = 'world-title' + (w === 2 ? ' space' : '');
        h.textContent = w === 2 ? '🚀 World 2 · Banana Galaxy' : '🌴 World 1 · Jungle';
        grid.appendChild(h);
      }
      const locked = n > save.unlocked;
      const stars = save.stars[n] || 0;
      const k = (n - 1) % LV.WORLD_SIZE + 1;
      const b = document.createElement('button');
      b.className = `level-btn ${k <= 5 ? 'slow' : k <= 10 ? 'medium' : 'fast'}` + (n > LV.WORLD_SIZE ? ' space' : '') + (locked ? ' locked' : '');
      b.disabled = locked;
      b.innerHTML = locked ? '<span class="lock">🔒</span>' :
        `<b>${n}</b><span class="stars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></span>`;
      if (!locked) b.addEventListener('click', () => { Sound.unlock(); Sound.sfx('click'); startLevel(n, true); });
      grid.appendChild(b);
    }
  }

  function showComplete() {
    const n = game.level;
    if (n === MAX_LEVEL) {
      $('#w-text').textContent = `${CHAR.name} climbed the whole jungle AND the Banana Galaxy with ${game.score} points!`;
      show('win');
      return;
    }
    const worldDone = n === LV.WORLD_SIZE;
    $('#c-title').textContent = worldDone ? 'Jungle complete! 🎉' : `Level ${n} complete!`;
    $('#c-next').textContent = worldDone ? 'Blast off to space 🚀' : 'Next level ▶';
    $('#c-cheer').textContent = `${CHAR.name}: “${CHAR.cheer}”`;
    $('#c-stars').innerHTML = [0, 1, 2].map(i =>
      `<span class="star ${game.starList[i] ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('');
    const tick = ok => (ok ? '✅' : '⬜');
    $('#c-goals').innerHTML =
      `<li>${tick(game.starList[0])} Reach the top</li>` +
      `<li>${tick(game.starList[1])} No falls</li>` +
      `<li>${tick(game.starList[2])} Collect most coins (${game.levelCoins}/${game.levelCoinTotal})</li>`;
    const secs = Math.floor(game.time);
    $('#c-stats').textContent = `Time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` +
      (game.timeBonus ? ` (+${game.timeBonus} speed bonus)` : '') + ` · Score ${game.score}`;
    show('complete');
  }

  function pause() {
    if (game.paused || (game.state !== 'playing' && game.state !== 'intro' && game.state !== 'dying')) return;
    game.paused = true;
    Sound.stopMusic();
    syncToggles();
    show('pause');
  }
  function resume() {
    if (!game.paused) return;
    game.paused = false;
    show(null);
    Sound.music(game.level);
  }
  function goMenu() {
    Sound.stopMusic();
    setupDemo();
    show('title');
  }

  function syncToggles() {
    document.querySelectorAll('[data-toggle="sound"]').forEach(b => { b.textContent = save.sound ? '🔊 Sound on' : '🔈 Sound off'; });
    document.querySelectorAll('[data-toggle="music"]').forEach(b => { b.textContent = save.music ? '🎵 Music on' : '🎵 Music off'; });
  }

  // Buttons wired by data attributes in index.html
  document.addEventListener('click', e => {
    const el = e.target.closest('button');
    if (!el) return;
    el.blur();   // so Space/Enter in the game never "click" this button again
    Sound.unlock();
    if (el.dataset.go) { Sound.sfx('click'); show(el.dataset.go); }
    if (el.dataset.toggle) {
      save[el.dataset.toggle] = !save[el.dataset.toggle]; writeSave(); syncToggles();
      Sound.sfx('click');
    }
    switch (el.dataset.act) {
      case 'resume': Sound.sfx('click'); resume(); break;
      case 'restart': Sound.sfx('click'); restartLevel(); break;
      case 'menu': Sound.sfx('click'); goMenu(); break;
      case 'next': Sound.sfx('click'); startLevel(Math.min(MAX_LEVEL, game.level + 1), false); break;
      case 'retry': Sound.sfx('click'); startLevel(game.level, true); break;
      case 'again': Sound.sfx('click'); startLevel(1, true); break;
      case 'continue': Sound.sfx('click'); startLevel(save.unlocked, true); break;
    }
  });
  $('#btn-pause').addEventListener('click', pause);

  /* ---------------- Controls ---------------- */
  let touchMode = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const KEYS = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
  };
  window.addEventListener('keydown', e => {
    const k = KEYS[e.key];
    if (k || e.key === 'ArrowDown') e.preventDefault();
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { game.paused ? resume() : pause(); return; }
    if (e.key === 'Enter') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;   // the browser clicks it already
      const primary = current && screens[current].querySelector('.primary');
      if (primary) primary.click();
      return;
    }
    if (k === 'left') input.kLeft = true;
    if (k === 'right') input.kRight = true;
    if (k === 'jump' && !e.repeat) {
      queueJump();
      if (game.state === 'intro' && game.introT > 0.5) game.introT = INTRO_TIME;
    }
  });
  window.addEventListener('keyup', e => {
    const k = KEYS[e.key];
    if (k === 'left') input.kLeft = false;
    if (k === 'right') input.kRight = false;
  });

  function holdButton(el, down, up) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      touchMode = true;
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      el.classList.add('down'); down();
    });
    const release = () => { el.classList.remove('down'); if (up) up(); };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }
  holdButton($('#t-left'), () => { input.tLeft = true; }, () => { input.tLeft = false; });
  holdButton($('#t-right'), () => { input.tRight = true; }, () => { input.tRight = false; });
  holdButton($('#t-jump'), () => {
    queueJump();
    if (game.state === 'intro' && game.introT > 0.5) game.introT = INTRO_TIME;
  });
  canvas.addEventListener('pointerdown', () => {
    if (game.state === 'intro' && game.introT > 0.5) game.introT = INTRO_TIME;
  });

  // Pause when the tab or app goes to the background.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', () => { input.kLeft = input.kRight = input.tLeft = input.tRight = false; });

  /* ---------------- Main loop ---------------- */
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!game.paused) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
    }
    if (current === 'win' && Math.random() < 0.3) confetti();
    render();
    if (current === 'chars') drawCharCards();
    requestAnimationFrame(frame);
  }

  buildCharCards();
  syncToggles();
  setupDemo();
  show('title');
  requestAnimationFrame(frame);

  // Used by the automated test in tests/ (harmless in the browser).
  window.__GB = { game, player, input, startLevel, update, setupDemo, STEP };
})();
