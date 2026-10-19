# 🍌 Gone Bananas!!!

A jumping game for kids: hop up the banana tree from banana to banana before they wobble and drop!
Plays in any browser on **phones, tablets and computers**, and can be installed to the home screen like an app.

- 🎮 **Play (always online):** https://sack2116.github.io/Gone-Bananas/

---

## 🚀 Features

- **🐒🐶👧 3 climbers** – Gorilla, Dog, or **PomPom** (an 8-year-old girl with curly hair and two pom-poms).
- **🌍 30 levels in 2 worlds** – each one is a climb of about 30 seconds.
  - **🌴 World 1 · Jungle (levels 1–15)** – climb the banana tree.
    - 🐢 **1–5 · Slow** – learn to hop. Sliding bananas start at level 4.
    - 🐇 **6–10 · Medium** – the screen climbs by itself, so you have to keep up. Spotty brown bananas that drop extra fast start at level 9.
    - 🏎️ **11–15 · Fast** – smaller, quicker bananas. Level 15 ends at the **Golden Bananas**.
  - **🚀 World 2 · Banana Galaxy (levels 16–30)** – unlocked after the jungle. Your climber wears a space helmet and floats in low gravity. The screen **never stops moving up**, past stars, planets and shooting stars. Bananas are smaller, slide more and tip further. From level 21, **ghost bananas** blink in and out, so you can only land on them while they glow. Bruno flies a **UFO** and drops flaming meteors. Each level ends at the **Banana Space Station**, and level 30 has the golden bunch.
- **🍌 Balancing bananas** – a banana tips toward the side you stand on, and you slide toward the edge. Stand in the middle or push the other way. Bananas tip further in later levels.
- **⏳ Ripening bananas** – the banana you stand on wobbles, turns brown and drops. Jump in time or you fall!
- **🐒 Bruno the Bad Baboon** – from level 3, the villain swings along the top of the screen, follows you and throws coconuts. A red **!** shows he's about to throw. A hit knocks you off your banana (BONK!). He throws faster in later levels, and sometimes two at once from level 12.
- **🍌🍌🍌 A whole banana bunch at the top** – reach the top and your climber eats the racimo one banana at a time (¡Ñam!) while Bruno runs off grumbling.
- **❤️ 3 lives** – if you fall, you lose a life and a green rescue banana catches you so you can keep going.
- **🪙 Coins worth 1, 2 or 5** – every **20 coin points** gives an extra life.
- **📏 Your climber grows** a little bigger every level.
- **⭐ Up to 3 stars per level** – reach the top, don't fall, and grab most of the coins. **PERFECT!** bonus for landing in the middle of a banana, and a speed bonus for finishing fast.
- **🏆 Online scoreboard (all devices)** – each player signs up once with a name, whichever climber they pick. The top 10 shows each player's best score and highest level beaten (🌴 Jungle / 🚀 Galaxy). Using the same name on a phone, tablet or computer counts as the same player. Scores are sent after every level and when the game ends. Without internet, the score is kept and sent next time.
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
| `js/levels.js` | Level design for both worlds: speed, gravity, banana size, gaps, sliding/brown/ghost bananas, Bruno and coins for levels 1–30. |
| `js/game.js` | The game: physics, the three characters (drawn in code), screens, saving, music and sounds. |
| `js/online.js` | The online scoreboard. Talks to the Firebase project **gonebananas-c8808** (Firestore database). |
| `firestore.rules` | Scoreboard security: anyone can read; entries can only be created or raised (never lowered or deleted); names 2–12 characters, scores up to 200,000, levels up to 30. Deploy with `npx firebase-tools deploy --only firestore:rules --project gonebananas-c8808`. |
| `tests/play-test.js` | A robot that plays every level 20 times to check each level can be beaten. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline play. |
| `tools/make_icons.py` | Draws the app icon (crazy monkey hugging a banana). Run `python tools/make_icons.py` after changing it. |
| `.github/workflows/pages.yml` | Runs the robot test, then publishes the game to GitHub Pages on every push to `main`. |

## 🛠️ Running and Changing It

- **Play locally:** double-click `index.html`. No install needed.
- **Test all levels:** `node tests/play-test.js`
- **Publish:** push to `main`. The game goes live in about a minute.
- **Make it easier or harder:** change the numbers in `levelSettings()` in `js/levels.js` (for example `tipTime` = how long a banana holds you).

## 🔮 Ideas for Later

- More characters, and unlocking hats or outfits with coins.
- Power-ups (banana magnet, double jump, shield).
- Sync unlocked levels and stars by player name, so the tablet picks up where the phone left off.
- A way to remove a player from the scoreboard (today only possible from the Firebase console).
- Publish to the App Store / Google Play by wrapping the game in an app shell such as Capacitor.

---

© 2026 Isaac D. · Made for PomPom
