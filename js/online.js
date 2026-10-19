/* Gone Bananas!!! - online scoreboard shared by every device.
   Uses Firebase Firestore through its plain web (REST) API, so no extra libraries are needed.
   What players may write is limited by firestore.rules (scores can only go up, names are short, etc.). */
(function (root) {
  'use strict';

  // From the Firebase console: Project settings > General > Your apps > Web app.
  // These are not secret; firestore.rules decides what can be written.
  const FIREBASE = { projectId: 'gonebananas-c8808', apiKey: 'AIzaSyB8rgvtlOPE2gl8yNwxzyOMGqKrTJlugjw' };

  const ready = () => !!(FIREBASE.projectId && FIREBASE.apiKey);
  const docsUrl = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents`;
  const keyParam = () => `key=${encodeURIComponent(FIREBASE.apiKey)}`;

  // Names: letters, numbers and spaces, 2-12 characters. A short list keeps obvious bad words out.
  const BLOCKED = ['poop', 'stupid', 'idiot', 'dumb', 'kill', 'puta', 'mierda', 'pendej', 'estupid', 'fuck', 'shit', 'bitch'];
  function cleanName(raw) {
    return String(raw || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  }
  function checkName(name) {
    if (name.length < 2) return 'Type at least 2 letters.';
    const low = name.toLowerCase().replace(/ /g, '');
    if (BLOCKED.some(w => low.includes(w))) return 'Please pick a different name.';
    return null;
  }
  // The same name (any capitals) on any device is the same player.
  const idFor = name => name.toLowerCase().replace(/ /g, '_');

  const int = v => ({ integerValue: String(Math.max(0, Math.round(v || 0))) });
  function fromDoc(doc) {
    const f = doc.fields || {};
    return {
      name: f.name ? f.name.stringValue : '?',
      bestScore: f.bestScore ? +f.bestScore.integerValue : 0,
      bestLevel: f.bestLevel ? +f.bestLevel.integerValue : 0,
      character: f.character ? f.character.stringValue : 'pompom',
    };
  }

  async function getPlayer(name) {
    const res = await fetch(`${docsUrl()}/players/${encodeURIComponent(idFor(name))}?${keyParam()}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('scoreboard ' + res.status);
    return fromDoc(await res.json());
  }

  // Keeps the player's best ever score and highest level beaten (never lowers them).
  async function submit({ name, score, level, character }) {
    if (!ready() || !name) return null;
    const old = await getPlayer(name);
    const best = {
      name: old ? old.name : name,
      bestScore: Math.max(score || 0, old ? old.bestScore : 0),
      bestLevel: Math.max(level || 0, old ? old.bestLevel : 0),
      character,
    };
    if (old && best.bestScore === old.bestScore && best.bestLevel === old.bestLevel && old.character === character) return best;
    const res = await fetch(`${docsUrl()}/players/${encodeURIComponent(idFor(name))}?${keyParam()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          name: { stringValue: best.name }, bestScore: int(best.bestScore), bestLevel: int(best.bestLevel),
          character: { stringValue: character }, updated: { timestampValue: new Date().toISOString() },
        },
      }),
    });
    if (!res.ok) throw new Error('scoreboard ' + res.status);
    return best;
  }

  async function top(limit = 10) {
    const res = await fetch(`${docsUrl()}:runQuery?${keyParam()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'players' }],
          orderBy: [{ field: { fieldPath: 'bestScore' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
    });
    if (!res.ok) throw new Error('scoreboard ' + res.status);
    return (await res.json()).filter(r => r.document).map(r => fromDoc(r.document));
  }

  const configure = cfg => Object.assign(FIREBASE, cfg);   // used by the browser test
  root.GBOnline = { ready, cleanName, checkName, getPlayer, submit, top, configure };
})(this);
