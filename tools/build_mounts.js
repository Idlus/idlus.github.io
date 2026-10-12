/* Construit la table des montures (bloc DATA de js/mounts.js) depuis l'import DofusDB et copie les icônes en webp.
   Usage : node tools/build_mounts.js */
const fs = require("fs"); const { execSync } = require("child_process");
const R = __dirname + "/../";
const RAW = require(R + "tools/probe/familiers/montures.json");
/* Couleurs à bonus, valeurs DOFUS au niveau 100 (maquette validée le 12/10). g : génération, p : parents (null = capture).
   * : stat remplacée (Portée, Poussée, Résistance aux critiques n'existent pas dans Idlus). */
const SPECIES = {
  dd: { name: "Dragodinde", prefix: "Dragodinde", f: 1, base: { vit: 300 }, cols: [
    ["Rousse", { so: 50 }, 1], ["Amande", { ini: 1500 }, 1], ["Dorée", { inv: 2 }, 1],
    ["Indigo", { cha: 100 }, 2, ["Rousse", "Dorée"]], ["Ébène", { age: 100 }, 2, ["Amande", "Dorée"]],
    ["Pourpre", { fo: 100 }, 3, ["Indigo", "Rousse"]], ["Orchidée", { ine: 100 }, 3, ["Ébène", "Amande"]],
    ["Ivoire", { pui: 70 }, 4, ["Pourpre", "Orchidée"]], ["Turquoise", { pp: 80 }, 4, ["Indigo", "Ébène"]],
    ["Émeraude", { cri: 12 }, 5, ["Ivoire", "Turquoise"]], ["Prune", { do: 20 }, 5, ["Pourpre", "Turquoise"]]] },
  mu: { name: "Muldo", prefix: "Muldo", f: 5, base: { pm: 1 }, cols: [
    ["Doré", { pui: 50 }, 1], ["Pourpre", { rt: 16 }, 1], ["Indigo", { re: 16 }, 1], ["Ébène", { ra: 16 }, 1], ["Orchidée", { rf: 16 }, 1],
    ["Roux", { tac: 40 }, 2, ["Pourpre", "Doré"]], ["Amande", { fui: 40 }, 2, ["Ébène", "Doré"]], ["Ivoire", { epa: 40 }, 2, ["Indigo", "Orchidée"]], ["Turquoise", { epm: 40 }, 2, ["Ébène", "Indigo"]],
    ["Prune", { cri: 10 }, 3, ["Roux", "Amande"]], ["Émeraude", { dcri: 30 }, 3, ["Ivoire", "Turquoise"]],
    ["Ambre", { dt: 30 }, 4, ["Pourpre", "Émeraude"]], ["Corail", { df: 30 }, 4, ["Orchidée", "Émeraude"]], ["Azur", { de: 30 }, 4, ["Indigo", "Émeraude"]], ["Aigue-marine", { da: 30 }, 4, ["Ébène", "Émeraude"]]] },
  vk: { name: "Volkorne", prefix: "Volkorne", f: 6, base: { pa: 1 }, cols: [
    ["Pourpre", { fo: 70 }, 1], ["Orchidée", { ine: 70 }, 1], ["Indigo", { cha: 70 }, 1], ["Ébène", { age: 70 }, 1],
    ["Doré", { vit: 150 }, 2, ["Pourpre", "Indigo"]], ["Jade", { rt: 12 }, 2, ["Pourpre", "Ébène"]], ["Rubis", { rf: 12 }, 2, ["Orchidée", "Pourpre"]], ["Saphir", { re: 12 }, 2, ["Indigo", "Orchidée"]], ["Améthyste", { ra: 12 }, 2, ["Ébène", "Indigo"]],
    ["Ivoire", { rpa: 30 }, 3, ["Jade", "Rubis"]], ["Turquoise", { rpm: 30 }, 3, ["Saphir", "Améthyste"]], ["Roux", { do: 15 }, 3, ["Doré", "Jade"]], ["Amande", { fui: 40 }, 3, ["Doré", "Saphir"]],
    ["Émeraude", { cri: 7 }, 4, ["Ivoire", "Turquoise"]], ["Prune", { dcri: 20 }, 4, ["Roux", "Amande"]]] },
};
const byName = {}; for (const e of RAW) if (e.type && e.icone) byName[e.nom] = e.icone;
const out = {}; const icons = [];
for (const sp in SPECIES) {
  const Sp = SPECIES[sp]; const cols = {}; const bico = {};
  for (const [c, s, g, p] of Sp.cols) {
    const ic = byName[`${Sp.prefix} ${c}`]; if (!ic) throw new Error("icône " + Sp.prefix + " " + c);
    cols[c] = { icon: ic, s, g }; if (p) cols[c].p = p; icons.push([ic, 64]);
  }
  const names = Object.keys(cols);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = names[i], b = names[j];
    const n1 = `${Sp.prefix} ${a} et ${b}`, n2 = `${Sp.prefix} ${b} et ${a}`;
    const ic = byName[n1] || byName[n2]; if (!ic) { console.log("bicolore sans icône", n1); continue; }
    bico[`${a}|${b}`] = [byName[n1] ? `${a} et ${b}` : `${b} et ${a}`, ic]; icons.push([ic, 56]);
  }
  out[sp] = { name: Sp.name, base: Sp.base, cols, bico };
}
const js = `  const MOUNTS = ${JSON.stringify(out)};`;
const f = R + "js/mounts.js"; let src = fs.readFileSync(f, "utf8");
src = src.replace(/\/\* DATA \*\/[\s\S]*?\/\* \/DATA \*\//, `/* DATA */\n${js}\n  /* /DATA */`);
fs.writeFileSync(f, src);
fs.mkdirSync(R + "assets/mt", { recursive: true });
let n = 0;
for (const [ic, size] of icons) { const dst = R + "assets/mt/" + ic + ".webp"; if (fs.existsSync(dst)) continue; n++;
  execSync(`python3 -c "from PIL import Image; im=Image.open('${R}tools/probe/familiers/icons/${ic}.png').convert('RGBA'); im.thumbnail((${size},${size})); im.save('${dst}','WEBP',quality=${size > 60 ? 88 : 82},method=6)"`); }
console.log("couleurs", Object.values(out).map((s) => Object.keys(s.cols).length).join("+"), "bicolores", Object.values(out).map((s) => Object.keys(s.bico).length).join("+"), "icônes copiées", n);
