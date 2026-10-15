/* 1.1.1.4 : codes cadeaux : tout ce qui se gagne dans le jeu peut être offert (récompense « x ») */
const assert = require("assert");
const E = require("../js/engine.js");
["systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "archis", "chroma", "koli", "alliance", "legendaires", "champions", "songe", "expeditions", "suivi", "comptoirs", "ascension", "reliques"].forEach((f) => require(`../js/${f}.js`));

const S = E.newState("Test", "iop");
let n = 0;
for (const t in E.GIFT_X) {
  const T = E.GIFT_X[t]; const L = T.list();
  if (t === "tit") continue;
  if (t === "part") { assert.strictEqual(L.length, 0, "pas de musique sous Node"); continue; }
  assert.ok(L.length > 0, `liste vide : ${t}`);
  L.forEach(([id, label]) => { assert.ok(T.ok(id), `${t} ${id} refusé`); assert.ok(label && typeof label === "string", `${t} ${id} sans nom`); n++; });
}
assert.ok(n > 500, `seulement ${n} choix`);

/* une récompense de chaque type, donnée puis relue */
const pick = (t, i = 0) => E.GIFT_X[t].list()[i][0];
const d = { id: "srv:TOUT", x: [
  ["m", "kolizetons", 50], ["m", "bribes", 30], ["m", "eclats", 4], ["m", "essence", 100], ["m", "fragments", 7], ["m", "jetons", 12],
  ["dgh", "h", 3], ["pet", pick("pet")], ["mt", "dd/Rousse", 2], ["mtc", "mu/Doré", 1], ["idol", pick("idol")], ["leg", pick("leg"), 2],
  ["rune", "ga:pa", 3], ["furn", pick("furn")], ["tro", pick("tro")], ["elv", "baf/2", 1], ["tit", "Ami d'Idlus"], ["orn", "couronne"], ["fr", "dofus"],
  ["wing", "sombre"], ["pal", "temple"], ["aura", "aura"], ["zzz", "inconnu", 1], ["pet", "n_existe_pas"],
] };
const txt = E.giftText(d);
assert.ok(/50 Kolizetons/.test(txt) && /Ami d'Idlus/.test(txt) && /chromatique/.test(txt), txt);
assert.ok(!/inconnu|n_existe_pas/.test(txt), "les lignes inconnues sont ignorées");
assert.ok(!E.ornUnlocked(S, "couronne") && !E.sframeOk(S, "dofus"));
const r = E.giveGift(S, d);
assert.ok(r.ok);
assert.strictEqual(S.tokens.kolizetons, 50); assert.strictEqual(S.tokens.jetons, 12);
assert.strictEqual(S.songe.br, 30); assert.strictEqual(S.chroma.ec, 4); assert.strictEqual(S.elev.ess, 100); assert.strictEqual(S.asc.frag, 7);
assert.ok(Object.values(S.pets).some((P) => P.id === pick("pet")));
const ms = Object.values(S.mounts); assert.strictEqual(ms.length, 3); assert.ok(ms.some((M) => M.chr && M.sp === "mu"));
assert.ok(E.idolOwned(S, pick("idol")));
assert.strictEqual(Object.values(S.items).filter((it) => it.tpl === "leg_" + pick("leg")).length, 2);
assert.strictEqual(S.runes["ga:pa"], 3);
assert.ok(S.furniture.includes(pick("furn"))); assert.ok(S.trophies[pick("tro")]);
assert.ok(S.elev.inv.some((x) => x.k === "baf" && x.t === 2));
assert.ok(S.titlesExtra.includes("Ami d'Idlus"));
assert.ok(E.ornUnlocked(S, "couronne"), "ornement offert"); assert.ok(E.sframeOk(S, "dofus"), "cadre offert");
assert.ok(S.unlocks.wing_sombre && S.unlocks.teint_temple && S.chroma.shop.aura);
assert.ok(E.dgh(S).b <= E.DGH.max);
/* 1.2.5.4 : Volonté de L'Ascension, au-delà du maximum */
{ const S4 = E.newState("V", "iop"); const v0 = E.ascState(S4).vol; E.giveGift(S4, { id: "v", x: [["m", "volonte", 10]], c: [["fiole_volonte", 2]] });
  assert.strictEqual(E.ascState(S4).vol, Math.min(99, v0 + 10)); assert.strictEqual(S4.cons.fiole_volonte, 2);
  assert.ok(/10 Volonté/.test(E.giftText({ x: [["m", "volonte", 10]] }))); }
/* 1.2.5.4 : une relique entre au Reliquaire */
{ const S5 = E.newState("R", "iop"); const id = E.RELICS[0].id; E.giveGift(S5, { id: "r", x: [["rel", id]] }); assert.strictEqual(E.relCount(S5), 1); }
/* l'ancienne forme « o » marche aussi pour un ornement gagné autrement */
const S2 = E.newState("B", "cra"); E.giveGift(S2, { id: "x", o: "lauriers" }); assert.ok(E.ornUnlocked(S2, "lauriers"));
/* 1.1.2.1 : un Dofus par code, pas redonné s'il est déjà là */
const S3 = E.newState("C", "eca"); const df = E.DOFUS_ORDER[0];
E.giveGift(S3, { id: "d1", x: [["dofus", df]] }); E.giveGift(S3, { id: "d2", x: [["dofus", df]] });
assert.strictEqual(Object.values(S3.items).filter((it) => it.tpl === "dofus_" + df).length, 1);
assert.ok(new RegExp(E.DOFUS[df].name).test(E.giftText({ x: [["dofus", df]] })));
console.log(`codes cadeaux : OK (${n} choix offrables)`);
