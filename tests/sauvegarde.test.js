/* 1.0.32.8 « Sauvegarde sans retour en arrière » : stockage du navigateur plein (js/save.js). */
const assert = require("assert");
const SV = require("../js/save.js");
function quotaStore(max) {
  const m = new Map(); const size = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return { m, get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => { const old = m.get(k); m.delete(k); if (size() + k.length + v.length > max) { if (old !== undefined) m.set(k, old); return false; } m.set(k, v); return true; }, del: (k) => m.delete(k), keys: () => [...m.keys()] };
}
let t = 1e12; const E = { now: () => t, deserialize: (x) => JSON.parse(x) };
const big = (n, lvl) => JSON.stringify({ chars: [{ lvl }], pad: "x".repeat(n) });
// 1. copies pleines + partie qui grossit : la partie s'écrit quand même, les copies cèdent la place
{
  const st = quotaStore(3000000); SV.useStore(st); SV.init({ key: "dofousxen-save", version: "t", engine: E });
  for (let i = 0; i < 6; i++) { t += 11 * 60000; assert.ok(SV.write(big(400000, 100 + i)), "écriture " + i); }
  const tot = SV.copies().reduce((n, c) => n + c.txt.length, 0); assert.ok(tot <= 3000000 || SV.copies().length === 1, "budget des copies");
  st.set("dofousxen-save-2-copies", JSON.stringify([{ t: 1, why: "auto", txt: big(600000, 50) }]));
  t += 60000; assert.ok(SV.write(big(1500000, 200)), "grosse partie écrite malgré le stockage plein");
  assert.strictEqual(JSON.parse(SV.read()).chars[0].lvl, 200);
  assert.ok(SV.freed, "le joueur est prévenu");
}
// 2. vraiment plus de place : write renvoie false (pas d'écriture silencieuse d'une vieille partie)
{
  const st = quotaStore(1000); SV.useStore(st); SV.init({ key: "dofousxen-save", version: "t", engine: E });
  assert.strictEqual(SV.write(big(5000, 1)), false);
}
// 3. horloge de l'appareil en avance puis remise à l'heure : les copies automatiques reprennent
{
  const st = quotaStore(1e8); SV.useStore(st); SV.init({ key: "dofousxen-save", version: "t", engine: E });
  const t0 = t; t += 21 * 3600000; SV.write(big(10, 200)); t = t0 + 60000; SV.write(big(10, 201));
  assert.ok(SV.copies().some((c) => JSON.parse(c.txt).chars[0].lvl === 201), "copie automatique malgré une copie datée dans le futur");
}
console.log("sauvegarde.test.js : OK");
