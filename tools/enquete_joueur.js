/* Enquête sur un compte (demande de Mathis, lecture seule) : « Est-ce qu'il triche ? »
   Lit le relevé fait par le workflow « Serveur OVH » (étape enquete-joueur) et n'affiche que des chiffres de jeu :
   jamais la partie elle-même. Pour la partie en ligne, la dernière partie validée et les copies du jour (7 jours) :
   temps de jeu, niveaux, kamas, ressources, Maîtrise par héros, Dofus, contrôle « impossible » du Bouclier (VERIFY.impossible)
   et, d'une copie à la suivante, le contrôle des gains (VERIFY.check) comparé au temps réel écoulé.
   Lancer : node tools/enquete_joueur.js releve.json */
"use strict";
const fs = require("fs");
const path = require("path");
globalThis.window = globalThis;
const FILES = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "gboss", "verify", "koli", "legendaires", "dofusp", "collections", "champions", "wboss", "songe", "alliance"];
for (const f of FILES) { const p = path.join(__dirname, "../js", f + ".js"); if (fs.existsSync(p)) require(p); }
const E = globalThis.ENGINE, V = globalThis.VERIFY;
const quiet = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };

const file = process.argv[2];
if (!file) { console.error("Usage : node tools/enquete_joueur.js releve.json"); process.exit(2); }
let R = JSON.parse(fs.readFileSync(file, "utf8")); if (Array.isArray(R)) R = R[0];
if (!R) { console.log("Aucun compte avec ce pseudo."); process.exit(0); }
const fm = (n) => Math.round(+n || 0).toLocaleString("fr-FR");
const h1 = (n) => (Math.round((+n || 0) * 10) / 10).toLocaleString("fr-FR");

console.log(`== Compte : ${R.pseudo} (créé le ${String(R.cree || "?").slice(0, 16)})`);
console.log("== Classement :", JSON.stringify(R.ladder || null));
console.log("== Partie validée (saves_ok) :", JSON.stringify(R.ok || null));
console.log("== Kolizéum :", JSON.stringify(R.koli || null));
console.log(`== Bouclier : ${(R.bouclier || []).length} refus enregistrés`);
(R.bouclier || []).slice(0, 30).forEach((b) => console.log(`  ${String(b.at).slice(0, 16)}  ${b.why}`));
console.log(`== Codes cadeaux utilisés : ${(R.codes || []).map((c) => `${c.code} (${String(c.at).slice(5, 16)})`).join(", ") || "aucun"}`);

/* une partie → résumé chiffré */
const sum = (label, txt, at) => {
  let raw, S;
  try { raw = JSON.parse(txt); } catch (e) { console.log(`\n== ${label} : illisible`); return null; }
  try { S = quiet(() => E.deserialize(txt)); E.events.length = 0; } catch (e) { S = null; }
  const B = S ? V.bilan(E, S) : V.bilan(E, raw);
  const imp = quiet(() => V.impossible(E, raw, 0));
  const pt = (raw.stats && raw.stats.playtime) || 0;
  console.log(`\n== ${label} (${String(at).slice(0, 16)}) · version de la partie v${raw.v} · temps de jeu ${h1(pt / 3600)} h · ${(raw.chars || []).length} héros`);
  console.log(`  kamas ${fm(B.k)} · ressources ${fm(B.r)} · niveaux ${fm(B.lv)} · Maîtrise ${fm(B.mt)} (+ ${fm(B.bn)} des vies) · Dofus ${B.dof} · panel de test ${raw.panelUsed ? "OUI" : "non"}`);
  console.log(`  contrôle « impossible » du Bouclier : ${imp || "rien"}`);
  (raw.chars || []).forEach((c) => {
    const M = c.mt || {}; const ids = (M.t && M.t[M.lo || 0]) || [];
    console.log(`  - ${String(c.name).slice(0, 20)} (${c.cls}) niv ${c.lvl} · Maîtrise ${M.lvl || 0} + ${M.bn || 0} · ${ids.length} étoiles · conversion ${JSON.stringify(c.renMt || null)} · ren ${c.ren || 0} · points ${JSON.stringify(c.alloc || {})} (+${c.pts || 0} libres) · parchemins ${JSON.stringify(c.scrolls || {})}`);
  });
  return { at: new Date(at).getTime(), B, top: Math.max(1, ...(raw.chars || []).map((c) => c.lvl || 1)), pt };
};

const L = [];
(R.jours || []).slice().sort((a, b) => String(a.day).localeCompare(String(b.day))).forEach((j) => { const s = sum(`Copie du ${j.day}`, j.data, j.at); if (s) L.push(s); });
const ok = R.ok_data ? sum("Dernière partie validée", R.ok_data, R.ok && R.ok.src_at) : null; if (ok) L.push(ok);
const cur = R.save ? sum("Partie en ligne (la plus récente)", R.save, R.save_at) : null; if (cur) L.push(cur);

console.log("\n== D'une copie à la suivante (temps réel, temps de jeu, gains, contrôle des gains sans les cadeaux)");
L.sort((a, b) => a.at - b.at);
for (let i = 1; i < L.length; i++) {
  const a = L[i - 1], b = L[i]; const hours = Math.max(0, (b.at - a.at) / 3600000);
  if (hours < 0.01) continue;
  const c = V.check(E, a.B, b.B, hours, {}, V.RES_MAX, b.top);
  console.log(`  ${new Date(a.at).toISOString().slice(5, 16)} → ${new Date(b.at).toISOString().slice(5, 16)} : ${h1(hours)} h réelles, ${h1((b.pt - a.pt) / 3600)} h de jeu ; kamas ${fm(b.B.k - a.B.k)}, ressources ${fm(b.B.r - a.B.r)}, niveaux ${fm(b.B.lv - a.B.lv)}, Maîtrise ${fm(b.B.mt - a.B.mt)}, Dofus ${b.B.dof - a.B.dof} → ${c.ok ? "possible" : "TROP : " + c.why}`);
}
