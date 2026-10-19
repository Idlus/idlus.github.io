/* Enquête Dofus sur un compte (demande de Mathis 19/10 : « regarde la sauvegarde de Crogne pour les Dofus »), lecture seule.
   Lit le même relevé que tools/enquete_joueur.js et n'affiche que des chiffres : Dofus possédés, victoires de boss par donjon,
   stasis choisie, Dofus attendus d'une copie à la suivante (chances du jeu) et lignes « Dofus » du journal.
   Lancer : node tools/enquete_dofus.js releve.json */
"use strict";
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
const FILES = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "gboss", "verify", "koli", "legendaires", "dofusp", "collections", "champions", "wboss", "songe", "alliance", "expeditions"];
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };
quiet(() => { for (const f of FILES) { const p = path.join(__dirname, "../js", f + ".js"); if (fs.existsSync(p)) require(p); } });
const E = globalThis.ENGINE, DG = globalThis.DATA.DUNGEONS;

let R = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); if (Array.isArray(R)) R = R[0];
if (!R) { console.log("Aucun compte avec ce pseudo."); process.exit(0); }
const fm = (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString("fr-FR");

const read = (label, txt, at) => {
  let S; try { S = JSON.parse(txt); } catch (e) { return null; }
  const team = (S.chars || []).filter((c) => c.inTeam && !c.job).slice(0, 8).length;
  const dof = {}; Object.values(S.items || {}).forEach((it) => { if (it && /^dofus_/.test(it.tpl)) dof[it.tpl.slice(6)] = (dof[it.tpl.slice(6)] || 0) + 1; });
  return { label, at: new Date(at).getTime(), S, team, dof, kills: (S.progress && S.progress.bossKills) || {}, st: S.stasis || {} };
};
const L = [];
(R.jours || []).forEach((j) => { const x = read(`Copie du ${j.day}`, j.data, j.at); if (x) L.push(x); });
if (R.ok_data) { const x = read("Partie validée", R.ok_data, R.ok && R.ok.src_at); if (x) L.push(x); }
if (R.save) { const x = read("Partie en ligne", R.save, R.save_at); if (x) L.push(x); }
L.sort((a, b) => a.at - b.at);

/* chances d'au moins un Dofus par victoire de boss, avec l'équipe et la stasis choisie */
const pWin = (did, k, team) => { let q = 1; E.DOFUS_ORDER.forEach((id) => { const o = E.dofusDropOdds(id, did, k); if (o) q *= Math.pow(1 - 1 / o, team); }); return 1 - q; };
const kOf = (x, did) => { const SI = x.st[did] || {}; return Math.max(1, Math.min(SI.sel || SI.max || 1, SI.max || 1)); };

L.forEach((x) => {
  const n = Object.values(x.dof).reduce((a, b) => a + b, 0);
  console.log(`\n== ${x.label} (${new Date(x.at).toISOString().slice(0, 16)}) · équipe ${x.team} héros · Dofus ${Object.keys(x.dof).length} différents, ${n} exemplaires · dofusAll ${(x.S.cnt && x.S.cnt.dofusAll) || 0} · victoires de boss ${Object.values(x.kills).reduce((a, b) => a + b, 0)}`);
  const H = x.S.dgh; if (H) console.log(`  heures de donjon : réserve ${fm((H.b || 0) / 3600)} h, cible ${H.did || "auto"} s${H.k || "?"}, dernier rattrapage ${JSON.stringify(H.last || null)}`);
});

console.log("\n== D'une copie à la suivante : victoires de boss par donjon (stasis choisie) et Dofus attendus selon les chances du jeu");
for (let i = 1; i < L.length; i++) {
  const a = L[i - 1], b = L[i]; let exp = 0; const rows = [];
  Object.keys(b.kills).forEach((did) => { const d = (b.kills[did] || 0) - (a.kills[did] || 0); if (d <= 0 || !DG[did]) return;
    const k = kOf(b, did); const p = pWin(did, k, b.team); exp += d * p;
    rows.push([d, `${did} (niv ${DG[did].lvl}, s${k}, Dofus ${E.dofusOfDungeon(did) || "aucun"}) +${d} victoires, 1 Dofus sur ${p ? Math.round(1 / p) : "∞"} victoires`]); });
  const got = Object.values(b.dof).reduce((s, v) => s + v, 0) - Object.values(a.dof).reduce((s, v) => s + v, 0);
  const newIds = Object.keys(b.dof).filter((id) => (b.dof[id] || 0) > (a.dof[id] || 0));
  console.log(`\n  ${a.label} → ${b.label} : ${fm((b.at - a.at) / 3600000)} h réelles, ${rows.reduce((s, r) => s + r[0], 0)} victoires de boss, Dofus attendus ${fm(exp)}, obtenus ${got} ${newIds.length ? "(" + newIds.join(", ") + ")" : ""}`);
  rows.sort((p, q) => q[0] - p[0]).slice(0, 8).forEach((r) => console.log("    " + r[1]));
}

const last = L[L.length - 1];
if (last) {
  console.log("\n== Journal (lignes Dofus, partie la plus récente)");
  (last.S.journal || []).filter((j) => /Dofus/.test(j.txt || "")).slice(0, 15).forEach((j) => console.log(`  ${new Date(j.t).toISOString().slice(0, 16)}  ${String(j.txt).slice(0, 90)}`));
  console.log("\n== Donjons les plus joués (total) et chance par victoire");
  Object.keys(last.kills).filter((d) => DG[d]).sort((p, q) => last.kills[q] - last.kills[p]).slice(0, 10).forEach((did) => { const k = kOf(last, did); const p = pWin(did, k, last.team);
    console.log(`  ${did} niv ${DG[did].lvl} · ${last.kills[did]} victoires · s${k} (max ${(last.st[did] || {}).max || 0}) · Dofus ${E.dofusOfDungeon(did) || "aucun"} · 1 sur ${p ? Math.round(1 / p) : "∞"}`); });
}
