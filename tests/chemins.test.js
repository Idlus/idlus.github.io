/* 1.0.6.4 : les chemins de menu cités dans les textes du jeu (« Artisanat › Havre-Sac ») existent vraiment.
   Règle : « Groupe › Page » avec un groupe du menu (NAV dans js/ui.js) et une page de ce groupe ; une page citée
   seule devant « › » doit être précédée de son groupe ; plus de flèche « → » entre deux noms de menu.
   Lancer : node tests/chemins.test.js */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "js");

// le menu, lu dans js/ui.js
const ui = fs.readFileSync(path.join(dir, "ui.js"), "utf8");
const navSrc = ui.slice(ui.indexOf("const NAV = ["), ui.indexOf("];", ui.indexOf("const NAV = [")));
const GROUPS = {};
for (const m of navSrc.matchAll(/n: "([^"]+)", pages: ([^\n]+)/g)) GROUPS[m[1]] = [...m[2].matchAll(/\["[a-z]+", "([^"]+)"/g)].map((x) => x[1]);
assert.deepStrictEqual(Object.keys(GROUPS), ["Jouer", "Héros", "Artisanat", "Suivi", "Communauté"], "les 5 groupes du menu sont lus");
GROUPS.Jouer.push("Combat"); // bouton Combat à part (navName)
// les onglets de la fiche d'un héros s'écrivent « Héros › Sorts » : la barre du bas du téléphone a un bouton Héros
GROUPS["Héros"].push("Équipement", "Caractéristiques", "Sorts", "Familier", "Ornement", "Apparence");
const PAGES = new Map(); for (const g in GROUPS) for (const p of GROUPS[g]) if (!GROUPS[p]) PAGES.set(p, g);
const ALL = [...Object.keys(GROUPS), ...PAGES.keys(), "Accueil", "Quêtes", "Métiers", "Forgemagie", "Inventaire"];

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && f !== "admin.js"); // admin.js : panneau de test de la béta
const bad = [];
for (const f of files) {
  let src = fs.readFileSync(path.join(dir, f), "utf8");
  if (f === "ui.js") src = src.slice(0, src.indexOf("const CHANGELOG = [")) + src.slice(src.indexOf("\n];", src.indexOf("const CHANGELOG = ["))); // les notes de version gardent les noms d'époque
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1"); // commentaires
  const lines = src.split("\n");
  lines.forEach((L) => {
    for (const m of L.matchAll(/›/g)) {
      const before = L.slice(0, m.index).trimEnd(); const after = L.slice(m.index + 1).trimStart();
      const g = Object.keys(GROUPS).find((x) => before.endsWith(x));
      if (g) {
        if (!GROUPS[g].some((p) => after.startsWith(p)) && !/^\$\{/.test(after)) bad.push(`${f} : « ${g} › ${after.slice(0, 30)} » n'est pas une page du groupe ${g}`);
        continue;
      }
      const p = [...PAGES.keys(), "Quêtes", "Métiers", "Forgemagie", "Inventaire", "Guilde"].find((x) => before.endsWith(x));
      if (p && !/› ?$/.test(before.slice(0, -p.length).trimEnd())) bad.push(`${f} : « ${p} › ${after.slice(0, 30)} » sans son groupe (ex. « ${PAGES.get(p) || "Groupe"} › ${p} »)`);
    }
    for (const m of L.matchAll(/→/g)) {
      const before = L.slice(0, m.index).trimEnd(); const after = L.slice(m.index + 1).trimStart();
      if (ALL.some((x) => before.endsWith(x)) && ALL.some((x) => after.startsWith(x))) bad.push(`${f} : flèche « → » dans un chemin de menu : ${before.slice(-25)} → ${after.slice(0, 25)}`);
    }
  });
}
assert.deepStrictEqual(bad, [], "chemins de menu à corriger :\n" + bad.join("\n"));
console.log("ok - chemins de menu : chaque « Groupe › Page » des textes existe dans le menu (" + files.length + " fichiers)");
