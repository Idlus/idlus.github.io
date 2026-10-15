#!/usr/bin/env node
/* Annonce en jeu (bandeau en haut du jeu + message dans le Général), comme le bouton « Publier » du panel admin.
   La publication passe par le workflow « Annonce en jeu » (.github/workflows/annonce-en-jeu.yml), seul à pouvoir
   joindre le serveur OVH. Ce script vérifie le texte et lance le workflow.
   Usage :
     node tools/annonce_en_jeu.js "<texte>" [--duree 1h|24h|7j|permanent] [--sans-chat] [--essai]
       → vérifie le texte puis lance le workflow avec gh (gh workflow run), --essai = tout est annulé à la fin
     node tools/annonce_en_jeu.js --verifier "<texte>"   → vérifie seulement (utilisé aussi par le workflow)
   Règles (Mathis) : texte brut, une ligne, 200 caractères au plus. */
const { execFileSync } = require("child_process");
const MAX = 200;
const DUREES = { "1h": 1, "24h": 24, "7j": 168, permanent: 0, "1h si libre": 1, "chat seul": 1 }; // « 1h si libre » : bandeau seulement si aucun autre n'est affiché

function verifier(t) {
  const err = [];
  const s = String(t || "").trim();
  if (!s) err.push("le texte est vide");
  const n = [...s].length; // caractères (accents et emojis comptent pour 1)
  if (n > MAX) err.push(`${n} caractères, ${MAX} au plus (${n - MAX} de trop)`);
  if (/[\r\n]/.test(s)) err.push("le texte doit tenir sur une seule ligne");
  if (/\*\*|__|\]\(|^#|`/.test(s)) err.push("texte brut seulement (pas de Markdown : ** __ ` # [lien](…))");
  return { s, n, err };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const flag = (f) => { const i = a.indexOf(f); if (i < 0) return false; a.splice(i, 1); return true; };
  const opt = (f, d) => { const i = a.indexOf(f); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const seulVerif = flag("--verifier"), essai = flag("--essai"), sansChat = flag("--sans-chat");
  const duree = opt("--duree", "24h");
  const texte = a.length ? a.join(" ") : process.env.ANNONCE_TEXTE || "";
  const v = verifier(texte);
  if (!(duree in DUREES)) v.err.push(`durée inconnue « ${duree} » (1h, 24h, 7j ou permanent)`);
  if (v.err.length) { console.error("Annonce refusée : " + v.err.join(" ; ") + "."); process.exit(1); }
  console.log(`Annonce OK (${v.n}/${MAX} caractères) : ${v.s}`);
  if (seulVerif) process.exit(0);
  execFileSync("gh", ["workflow", "run", "annonce-en-jeu.yml", "-R", "idlus/idlus.github.io",
    "-f", `texte=${v.s}`, "-f", `duree=${duree}`, "-f", `chat=${!sansChat}`, "-f", `essai=${essai}`], { stdio: "inherit" });
  console.log("Workflow « Annonce en jeu » lancé (onglet Actions du dépôt pour suivre).");
}
module.exports = { verifier, MAX, DUREES };
