/* 1.0.30 « Forge » : comptage du soft reset des jets (choix 40A) AVANT de l'activer. Lecture seule : ne change aucune partie.
   Le soft reset lui-même se fait dans le jeu, au lancement, quand E.SOFT_RESET_ON passe à true dans js/forge.js (avec les mots de Mathis).
   1. Relevé des parties, en lecture seule :
        bash tools/serveur/vps_sql.sh lecture "select s.user_id, public.pseudo_of(s.user_id) as pseudo, s.data from public.saves s" > parties.json
      (ou Actions › Serveur OVH › soft-reset-comptage)
      (les parties 2 et 3 : « select user_id, slot, data from save_slots » dans un autre fichier)
   2. node tools/soft_reset_compte.js parties.json
   Le fichier peut aussi être une partie seule (export du jeu) ou une partie par ligne. */
"use strict";
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "../js/engine.js"));
require(path.join(__dirname, "../js/systems.js"));
require(path.join(__dirname, "../js/forge.js"));
const { ITEMS } = require(path.join(__dirname, "../js/data.js"));

const file = process.argv[2];
if (!file) { console.error("Usage : node tools/soft_reset_compte.js parties.json"); process.exit(2); }
const raw = fs.readFileSync(file, "utf8").trim();
let rows;
try { const j = JSON.parse(raw); rows = Array.isArray(j) ? j : [j]; } catch (e) { rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
const txtOf = (r) => (typeof r === "string" ? r : r && typeof r.data === "string" ? r.data : r && r.data ? JSON.stringify(r.data) : JSON.stringify(r));

const T = { parties: 0, illisibles: 0, deja: 0, touchees: 0, objets: 0, parfaits: 0, runes: 0, kamas: 0, cristaux: 0 };
const parJoueur = [], parModele = {};
for (const r of rows) {
  let S; try { S = E.deserialize(txtOf(r)); } catch (e) { T.illisibles++; continue; }
  T.parties++; if (S.softReset) { T.deja++; continue; }
  const P = E.softResetPlan(S); if (!P.n) continue;
  T.touchees++; T.objets += P.n; T.runes += P.runesN; T.kamas += P.kamas; T.cristaux += P.cristaux; T.parfaits += P.items.filter((x) => x.perfect).length;
  parJoueur.push([(r && r.pseudo) || `partie ${T.parties}`, P.n, P.runesN]); // jamais l'identifiant du compte (journaux publics des Actions)
  P.items.forEach((x) => { parModele[x.tpl] = (parModele[x.tpl] || 0) + 1; });
}
const f = (n) => Math.round(n).toLocaleString("fr-FR");
console.log(`Soft reset des jets (règle 1.0.30 : au-dessus de ${E.SOFT_AT * 100} % de la fourchette, runes ×${String(E.SOFT_RUNES).replace(".", ",")}, ${f(E.SOFT_KAMAS)} k et un Cristal par objet)`);
console.log(`Parties lues : ${T.parties}${T.illisibles ? ` (${T.illisibles} illisibles)` : ""}${T.deja ? `, ${T.deja} déjà passées` : ""}`);
console.log(`Parties touchées : ${T.touchees} · objets : ${f(T.objets)} (dont ${f(T.parfaits)} Parfaits)`);
console.log(`Compensation totale : ${f(T.runes)} runes, ${f(T.cristaux)} Cristaux de forgemagie, ${f(T.kamas)} kamas`);
parJoueur.sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([u, n, rn]) => console.log(`  ${u} : ${n} objet${n > 1 ? "s" : ""}, ${f(rn)} runes`));
const top = Object.entries(parModele).sort((a, b) => b[1] - a[1]).slice(0, 10);
if (top.length) console.log("Objets les plus touchés : " + top.map(([t, n]) => `${ITEMS[t] ? ITEMS[t].name : t} ×${n}`).join(", "));
