/* Construit la table des familiers et montiliers (js/pets.js) et copie les icônes en webp */
const fs = require("fs"); const { execSync } = require("child_process");
const R = "/home/claude/idlus/";
const D = require(R + "js/data.js"); const E = require(R + "js/engine.js"); require(R + "js/systems.js");
const P = require(process.argv[2] || (__dirname + "/pets.json")).filter((x) => x.nom !== "Kouin-Kouin amélioré");
const RAW = require(R + "tools/probe/familiers/familiers.json");
const subs = Object.values(E.SUBS).filter((s) => s.monsters && s.monsters.length && !s.hidden);
const zoneOf = (s) => D.ZONES.find((z) => z.subs.some((x) => x.id === s.id));
const slug = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const dgByName = {}; for (const k in D.DUNGEONS) dgByName[D.DUNGEONS[k].name] = k;
const food = (s) => { const c = {}; for (const m of s.monsters) for (const [r, pc] of (D.MONSTERS[m].drops || [])) { if (E.isKey(r)) continue; if (pc >= 8) c[r] = (c[r] || 0) + 1; } return (Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [])[0] || null; };
const out = {}; const used = new Set(); const icons = new Set();
for (const p of P) {
  const o = { name: p.nom, icon: p.icone, stats: {} };
  p.bonus.forEach((b) => (o.stats[b.k] = b.v));
  if (p.kind === "zone") {
    const s = subs.find((x) => x.name === p.sub && zoneOf(x) && zoneOf(x).name === p.zone); if (!s) throw new Error("sous-zone " + p.nom + " " + p.sub);
    used.add(s.id); Object.assign(o, { kind: "zone", sub: s.id, lvl: s.lvl[0], food: p.food || food(s) });
  } else { const did = dgByName[p.zone]; if (!did) throw new Error("donjon " + p.zone); Object.assign(o, { kind: "boss", dg: did, lvl: D.DUNGEONS[did].lvl, stasis: 7 }); }
  out[slug(p.nom)] = o; icons.add(p.icone);
}
/* 16 familiers tactiques (stats tactiques du lot 0.1.8), répartis dans les sous-zones encore libres */
const TACT = [["Blokus", ["tac", "rpm"]], ["Drakopin", ["tac", "rpa"]], ["Dragoune Rose", ["fui", "rpa"]], ["Kouin-Kouin Noir", ["fui", "rpa"]], ["Chachyène", ["pm", "inv"]], ["Phortiche", ["pm"]],
  ["Raknaille", ["epa"]], ["Meulourd", ["epm"]], ["Dragoune Dorée", ["epa"]], ["Minikrone", ["inv", "epm"]], ["Zarbichon", ["inv"]], ["Bworky", ["pod"]], ["Chauffe-souris", ["pod"]], ["Bulbouture", ["pod"]], ["Fosfo", ["pod"]], ["Tirubim", ["pod"]]];
const tierOf = (l) => (l <= 20 ? 1 : l <= 50 ? 2 : l <= 90 ? 3 : l <= 130 ? 4 : 5);
const TV = { tac: [10, 15, 20, 25, 30], fui: [10, 15, 20, 25, 30], rpa: [10, 15, 20, 25, 30], rpm: [10, 15, 20, 25, 30], epa: [10, 15, 20, 25, 30], epm: [10, 15, 20, 25, 30], pod: [100, 150, 200, 250, 300], pm: [1, 1, 1, 1, 1], inv: [1, 1, 1, 1, 1] };
const free = subs.filter((s) => !used.has(s.id) && s.lvl[0] >= 10).sort((a, b) => a.lvl[0] - b.lvl[0]);
TACT.forEach(([n, ks], i) => {
  const raw = RAW.find((x) => x.nom === n && x.type === "Familier"); if (!raw) throw new Error("familier " + n);
  // PM et Invocation (plus forts) : seulement en zone de niveau 60 et plus
  const strong = ks.includes("pm") || ks.includes("inv");
  const pool = free.filter((s) => !used.has(s.id) && (strong ? s.lvl[0] >= 60 : true));
  const s = pool[Math.floor(((i * 7) % TACT.length + 0.5) * pool.length / TACT.length)] || pool[0]; used.add(s.id);
  const t = tierOf(s.lvl[0]); const st = {}; ks.forEach((k, j) => (st[k] = j && TV[k][t - 1] > 1 ? Math.round(TV[k][t - 1] / 2) : TV[k][t - 1]));
  out[slug(n)] = { name: n, icon: raw.icone, stats: st, kind: "zone", sub: s.id, lvl: s.lvl[0], food: food(s) }; icons.add(raw.icone);
});
/* 25 montiliers (maquette validée le 12/10) */
const M = [
  ["e", "Siroko", 121005, { age: 120 }, "Dojo du Vent"], ["e", "Dehluge", 121006, { cha: 120 }, "Vallée de la Dame des eaux"], ["e", "Kompost", 121007, { fo: 120 }, "Clairière du Chêne Mou"], ["e", "Brûlih", 121008, { ine: 120 }, "Fabrique de foux d'artifice"],
  ["e", "Koliphant Mamukil", 121134, { fo: 90, cri: 5 }, "Cavernes du Kolosso"], ["e", "Koliphant de Lexandre", 121133, { ine: 90, cri: 5 }, "Hypogée de l'Obsidiantre"], ["e", "Koliphant de Tarkaj", 121131, { age: 90, cri: 5 }, "Pyramide d'Ombre"], ["e", "Koliphant Zenusha", 121132, { cha: 90, cri: 5 }, "Aquadôme de Merkator"],
  ["t", "Tortikoli", 121069, { tac: 40, xn: 6 }, "Galerie du Phossile"], ["t", "Zarfuyar", 121137, { fui: 40, rpm: 30 }, "Plateau de Ush"], ["t", "Kobrapid", 121136, { epm: 40, ini: 400 }, "Cave du Toxoliath"], ["t", "Teh'Niak", 121070, { inv: 1, dt: 8, df: 8, de: 8, da: 8 }, "Demeure des Esprits"], ["t", "Gowelan", 121135, { pod: 300 }, "Clos des Blops"],
  ["c", "Dragouf", 121000, { pui: 40, inv: 1 }, "Antre du Dragon Cochon"], ["c", "Hurledent", 121001, { pp: 60 }, "Tanière du Meulou"], ["c", "Kramkram", 121002, { pui: 40, rt: 4, rf: 4, re: 4, ra: 4, rn: 4 }, "Domaine Ancestral"], ["c", "Balafreux", 121004, { pm: 1, do: 10 }, "Ring du Capitaine Ekarlatte"],
  ["c", "Phorror", 121010, { cri: 5, pm: 1 }, "Repaire de Sphincter Cell"], ["c", "Kougnard Albâtre", 121019, { pui: 40, dcri: 10 }, "Tanière Givrefoux"], ["c", "Bouftor", 121021, { xt: 8, xf: 8, xe: 8, xa: 8, xn: 8 }, "Pitons Rocheux des Craqueleurs"], ["c", "Bouflux", 121022, { dcri: 10, do: 10 }, "Chapiteau des Magik Riktus"],
  ["l", "Sakochère", 121003, { pa: 1, dcri: 10 }, "Bastion des Marteaux-Aigris"], ["l", "Kwaltess", 121009, { pa: 1, pui: 30 }, "Trône de la Cour Sombre"], ["l", "Kougnard", 121014, { pa: 1, ini: 300 }, "Forgefroide de Missiz Frizz"], ["l", "Monture du Vénérable", 121164, { pa: 1, inv: 1 }, "Chambre de Tal Kasha"]];
for (const [fam, n, ic, st, dgn] of M) { const did = dgByName[dgn]; if (!did) throw new Error("donjon " + dgn); out[slug(n)] = { name: n, icon: ic, stats: st, kind: "monti", fam, dg: did, lvl: 60, stasis: fam === "l" ? 8 : 6 }; icons.add(ic); }
// un seul familier rare / montilier par donjon
const perDg = {}; for (const k in out) if (out[k].dg) { if (perDg[out[k].dg]) console.log("ATTENTION double", out[k].dg, k, perDg[out[k].dg]); perDg[out[k].dg] = k; }
const n = { zone: 0, boss: 0, monti: 0 }; for (const k in out) n[out[k].kind]++; console.log(n, Object.keys(out).length);
fs.writeFileSync(__dirname + "/pets_table.json", JSON.stringify(out));
for (const ic of icons) { const dst = R + "assets/p/" + ic + ".webp"; if (!fs.existsSync(dst)) execSync(`python3 -c "from PIL import Image; im=Image.open('${R}tools/probe/familiers/icons/${ic}.png').convert('RGBA'); im.thumbnail((64,64)); im.save('${dst}','WEBP',quality=88,method=6)"`); }
console.log("icônes", icons.size);
