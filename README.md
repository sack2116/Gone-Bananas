# 🍌 Gone Bananas!!!

A jumping game for kids: hop up the banana tree from banana to banana before they wobble and drop!
Plays in any browser on **phones, tablets and computers**, and can be installed to the home screen like an app.

- 🎮 **Play (always online):** https://sack2116.github.io/Gone-Bananas/

---

## 🚀 Features

- **🐒🐶👧 3 climbers** – Gorilla, Dog, or **PomPom** (an 8-year-old girl with curly hair and two pom-poms).
- **🌴 15 levels** – each one is a climb of about 30 seconds to the top of the banana tree.
  - 🐢 **Levels 1–5 · Slow** – learn to hop. Sliding bananas start at level 4.
  - 🐇 **Levels 6–10 · Medium** – the screen climbs by itself, so you have to keep up. Spotty brown bananas that drop extra fast start at level 9.
  - 🚀 **Levels 11–15 · Fast** – smaller, quicker bananas. Level 15 ends at the **Golden Banana**.
- **🍌 Wobbly bananas** – the banana you stand on wobbles, turns brown and drops. Jump in time or you fall!
- **❤️ 3 lives** – if you fall, you lose a life and a green rescue banana catches you so you can keep going.
- **🪙 Coins worth 1, 2 or 5** – every **20 coin points** gives an extra life.
- **📏 Your climber grows** a little bigger every level.
- **⭐ Up to 3 stars per level** – reach the top, don't fall, and grab most of the coins. **PERFECT!** bonus for landing in the middle of a banana, and a speed bonus for finishing fast.
- **🔓 Progress is saved** on the device: unlocked levels, stars and best score.
- **🎵 Music and sound effects** made in code, with no audio files. Each can be turned on or off.
- **📱 Works offline** once it has been opened, and can be added to the home screen.

## 🕹️ Controls

| | Computer | Phone / tablet |
|---|---|---|
| Move | ← → arrow keys (or A / D) | ◀ ▶ buttons |
| Jump | ↑ arrow or Space (or W) | **JUMP** button |
| Pause | P or Esc | ❚❚ button |

**Add it to the home screen:** on iPhone/iPad, open the link in Safari → Share → *Add to Home Screen*. On Android, open the link in Chrome → ⋮ → *Add to Home screen* (or *Install app*).

---

## 📁 Project Structure

| Path | What it is |
|---|---|
| `index.html` | The page: game canvas, menus and touch buttons. |
| `style.css` | Menus, buttons and touch controls. |
| `js/levels.js` | Level design: how each level's speed, banana size, gaps, sliding/brown bananas and coins change from level 1 to 15. |
| `js/game.js` | The game: physics, the three characters (drawn in code), screens, saving, music and sounds. |
| `tests/play-test.js` | A robot that plays every level 20 times to check each level can be beaten. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline play. |
| `.github/workflows/pages.yml` | Runs the robot test, then publishes the game to GitHub Pages on every push to `main`. |

## 🛠️ Running and Changing It

- **Play locally:** double-click `index.html`. No install needed.
- **Test all levels:** `node tests/play-test.js`
- **Publish:** push to `main`. The game goes live in about a minute.
- **Make it easier or harder:** change the numbers in `levelSettings()` in `js/levels.js` (for example `tipTime` = how long a banana holds you).

## 🔮 Ideas for Later

- More characters, and unlocking hats or outfits with coins.
- Power-ups (banana magnet, double jump, shield).
- Online leaderboard (would need a small server, e.g. on Render).
- Publish to the App Store / Google Play by wrapping the game in an app shell such as Capacitor.

---

© 2026 Isaac D. · Made for PomPom
