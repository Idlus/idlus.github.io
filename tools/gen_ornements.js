// 0.1.49 : génère les ornements de région et des paliers de succès (SVG) dans assets/ui/orn. Lancer : node tools/gen_ornements.js, style DOFUS 3 : médaillon de métal ciselé, gemme, motif, volutes latérales.
const fs = require("fs"), path = require("path");
const OUT = process.argv[2] || path.join(__dirname, "..", "assets", "ui", "orn"); fs.mkdirSync(OUT, { recursive: true });

const METAL = {
  or:     ["#fff3b8", "#f2c75a", "#b07a22", "#5a3a10"],
  argent: ["#ffffff", "#d7e2ee", "#8796ab", "#39445a"],
  bronze: ["#ffd9a8", "#d08a4a", "#8a4b1e", "#3e1f0a"],
  sombre: ["#e6d2ff", "#9a7bc4", "#4f3577", "#1d1030"],
  jade:   ["#e9ffe0", "#9fdc7a", "#4f8a34", "#1d3a12"],
};
// motifs centrés en 0,0 (taille ~ ±17), remplis en couleur claire
const M = {
  ame: `<path d="M0-17C9-8 12 0 7 9 4 15-4 15-7 9-12 1-5-4-3-9-2-4 2-2 2 2 5-3 3-10 0-17Z"/><circle cx="-3" cy="6" r="2.2" fill="#000" opacity=".35"/><circle cx="3" cy="6" r="2.2" fill="#000" opacity=".35"/>`,
  tour: `<path d="M-14 15V-4h4v-5h3v5h4v-12h6v12h4v-5h3v5h4v19H4V7a4 4 0 0 0-8 0v8Z"/>`,
  feuille: `<path d="M0 17V-2M0-17C6-13 10-9 8-5 13-4 12 2 8 3 11 7 7 11 2 9 1 12-1 12-2 9-7 11-11 7-8 3-12 2-13-4-8-5-10-9-6-13 0-17Z"/><path d="M0 17v-26" stroke="#000" stroke-opacity=".35" stroke-width="1.6" fill="none"/>`,
  ble: `<path d="M0 17V-15" stroke-width="2.2" stroke="currentColor" fill="none"/>${[-12, -6, 0, 6].map((y) => `<ellipse cx="-4" cy="${y}" rx="3.2" ry="5" transform="rotate(-30 -4 ${y})"/><ellipse cx="4" cy="${y}" rx="3.2" ry="5" transform="rotate(30 4 ${y})"/>`).join("")}<ellipse cx="0" cy="-16" rx="2.6" ry="4.4"/>`,
  wabbit: `<ellipse cx="-6" cy="-7" rx="4" ry="11" transform="rotate(-12 -6 -7)"/><ellipse cx="6" cy="-7" rx="4" ry="11" transform="rotate(12 6 -7)"/><circle cy="9" r="9"/><circle cx="-3" cy="8" r="1.6" fill="#000" opacity=".45"/><circle cx="3" cy="8" r="1.6" fill="#000" opacity=".45"/>`,
  crane: `<path d="M0-16C10-16 15-9 15-1c0 5-3 8-6 9v6H-9v-6c-3-1-6-4-6-9 0-8 5-15 15-15Z"/><circle cx="-5.5" cy="-1" r="4" fill="#000" opacity=".5"/><circle cx="5.5" cy="-1" r="4" fill="#000" opacity=".5"/><path d="M-4 10v4M0 10v4M4 10v4" stroke="#000" stroke-opacity=".5" stroke-width="1.5"/>`,
  patte: `<ellipse cy="7" rx="9" ry="8"/><ellipse cx="-11" cy="-4" rx="3.6" ry="5"/><ellipse cx="-4" cy="-11" rx="3.6" ry="5"/><ellipse cx="4" cy="-11" rx="3.6" ry="5"/><ellipse cx="11" cy="-4" rx="3.6" ry="5"/>`,
  sapin: `<path d="M0-18 9-6H4l8 10H5l9 10H-14l9-10h-7l8-10h-5Z"/><rect x="-2.5" y="14" width="5" height="4"/>`,
  arbre: `<path d="M-3 17c1-6 1-10 0-14-5 0-8-2-12-7 4 1 7 1 10-1-4-3-5-7-5-11 3 3 6 5 9 5 0-4 1-6 1-6s1 2 1 6c3 0 6-2 9-5 0 4-1 8-5 11 3 2 6 2 10 1-4 5-7 7-12 7-1 4-1 8 0 14Z"/><circle cx="-2.6" cy="-2" r="1.4" fill="#000" opacity=".5"/><circle cx="2.6" cy="-2" r="1.4" fill="#000" opacity=".5"/>`,
  lune: `<path d="M5-16A17 17 0 1 0 15 7 13 13 0 1 1 5-16Z"/><path d="M8-9l1.4 3 3 .4-2.2 2 .6 3-2.8-1.5L5.2-.6l.6-3-2.2-2 3-.4Z"/>`,
  oeuf: `<path d="M0-17C8-17 13-3 13 5c0 7-6 12-13 12S-13 12-13 5C-13-3-8-17 0-17Z"/><path d="M-13 2l5 3 4-4 4 4 4-4 4 4 5-3" stroke="#000" stroke-opacity=".4" stroke-width="1.8" fill="none"/><circle cx="-4" cy="-8" r="2.2" fill="#000" opacity=".25"/><circle cx="5" cy="10" r="2.6" fill="#000" opacity=".25"/>`,
  palmier: `<path d="M-1 17c1-8 1-16 3-22" stroke-width="3.2" stroke="currentColor" fill="none"/><path d="M2-6c-6-5-12-5-16-2 5-1 9 0 12 3Zm0 0c6-5 12-5 16-2-5-1-9 0-12 3Zm0 0c-3-6-8-10-13-10 4 2 7 6 9 11Zm0 0c3-6 8-10 13-10-4 2-7 6-9 11Zm0 0c0-6 0-9 2-12-1 4-1 8 0 12Z"/>`,
  cornes: `<path d="M-6 0C-14-1-17-8-15-16-12-9-8-7-3-7Zm12 0C14-1 17-8 15-16 12-9 8-7 3-7Z"/><path d="M-8-6h16c2 8-1 18-8 22-7-4-10-14-8-22Z"/><ellipse cx="-3" cy="9" rx="1.6" ry="2" fill="#000" opacity=".45"/><ellipse cx="3" cy="9" rx="1.6" ry="2" fill="#000" opacity=".45"/>`,
  bambou: `${[-7, 1, 9].map((x, i) => `<rect x="${x - 3}" y="${-15 + i * 3}" width="6" height="${32 - i * 3}" rx="2"/><path d="M${x - 3} ${-6 + i * 3}h6M${x - 3} ${4 + i * 3}h6" stroke="#000" stroke-opacity=".4" stroke-width="1.5"/>`).join("")}<path d="M4-10c4-5 9-6 13-5-4 1-8 3-11 7Z"/>`,
  flocon: `<g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none">${[0, 60, 120].map((a) => `<path d="M0-17V17M-5-13 0-8 5-13M-5 13 0 8 5 13" transform="rotate(${a})"/>`).join("")}</g><circle r="3"/>`,
  soleil: `<circle r="8"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0-10 2.6-17-2.6-17Z" transform="rotate(${i * 30})"/>`).join("")}`,
  plume: `<path d="M10-17C-6-12-11 2-10 15l3-1C-6 4-1-4 6-9-2-2-5 6-6 13 3 9 10 0 10-17Z"/><path d="M-10 15 4-6" stroke="#000" stroke-opacity=".35" stroke-width="1.4" fill="none"/>`,
  etoile: `<path d="M0-18 4-5 17-6 6 2 11 15 0 7-11 15-6 2-17-6-4-5Z"/><circle r="3.4" fill="#000" opacity=".25"/>`,
  masque: `<path d="M-15-11C-6-8 6-8 15-11 16 2 10 15 0 15S-16 2-15-11Z"/><path d="M-10-3c2-2 5-2 7 0-2 2-5 2-7 0Zm13 0c2-2 5-2 7 0-2 2-5 2-7 0Z" fill="#000" opacity=".55"/><path d="M-6 6c4 4 8 4 12 0" stroke="#000" stroke-opacity=".55" stroke-width="2" fill="none"/>`,
  epees: `<g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M-13-15 11 11M13-15-11 11"/></g><path d="M7 7l7 3-3 3-3-7Zm-14 0-7 3 3 3 3-7Z"/><circle cx="-14" cy="14" r="2.6"/><circle cx="14" cy="14" r="2.6"/>`,
  vague: `<path d="M-17 4c4-10 12-14 20-11 5 2 6 8 2 10-3 1-5-1-4-3-4 0-6 5-3 8 5 4 15 0 19-8-1 12-11 18-20 17-8-1-13-6-14-13Z"/>`,
  cristal: `<path d="M0-18 8-6 4 17h-8L-8-6Z"/><path d="M-12 0-6-8-3 15h-5Zm24 0L6-8 3 15h5Z" opacity=".8"/><path d="M0-18v35" stroke="#000" stroke-opacity=".25" stroke-width="1.4"/>`,
  marteau: `<rect x="-14" y="-15" width="28" height="11" rx="2"/><rect x="-2.6" y="-5" width="5.2" height="22" rx="1.5"/><path d="M-14-11h28" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>`,
  couronne: `<path d="M-15 10-17-9-8-1 0-14 8-1 17-9 15 10Z"/><rect x="-15" y="10" width="30" height="5" rx="1.5"/><circle cy="4" r="2.6" fill="#000" opacity=".3"/>`,
  oeil: `<path d="M-17 0C-10-11 10-11 17 0 10 11-10 11-17 0Z"/><circle r="6.4" fill="#000" opacity=".55"/><circle cx="2" cy="-2" r="2" /><path d="M0-16v-2M-9-13l-1-2M9-13l1-2" stroke="currentColor" stroke-width="2"/>`,
  sablier: `<path d="M-11-17h22v3c0 6-7 9-7 14s7 8 7 14v3h-22v-3c0-6 7-9 7-14s-7-8-7-14Z"/><path d="M-5 13h10L0 6Z M-6-12h12c-1 3-4 5-6 7-2-2-5-4-6-7Z" fill="#000" opacity=".35"/>`,
  trident: `<path d="M-1.6 17V-6h3.2v23Z"/><path d="M-11-17v8c0 5 4 8 11 8s11-3 11-8v-8l-3 4v4c0 3-3 4-6 4v-12l-2-4-2 4v12c-3 0-6-1-6-4v-4Z"/>`,
  fer: `<path d="M-13-12C-15 6-8 16 0 16S15 6 13-12H6C7 2 4 9 0 9S-7 2-6-12Z"/>${[[-10, -6], [-9, 4], [9, 4], [10, -6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#000" opacity=".45"/>`).join("")}`,
  encre: `<path d="M0-18C6-8 12-2 12 6A12 12 0 0 1-12 6C-12-2-6-8 0-18Z"/><path d="M-6 4c0 4 3 7 6 7" stroke="#fff" stroke-opacity=".5" stroke-width="2" fill="none"/>`,
  ecaille: `<path d="M-15-4C-15-14-6-18 0-18S15-14 15-4C15 8 7 16 0 18-7 16-15 8-15-4Z"/>${[[-5, -8], [5, -8], [0, 0], [-8, 0], [8, 0], [-4, 8], [4, 8]].map(([x, y]) => `<path d="M${x - 4} ${y}a4 4 0 0 0 8 0" stroke="#000" stroke-opacity=".4" stroke-width="1.6" fill="none"/>`).join("")}`,
  volcan: `<path d="M-17 17-6-2h3l3 3 3-3h3l11 19Z"/><path d="M-3-2c-2-5 0-9-4-14 4 1 6 4 6 7 0-5 3-8 7-9-3 4-3 10-2 16Z"/><path d="M-2 2c-1 4-5 7-4 12M2 2c1 5 5 7 3 12" stroke="#000" stroke-opacity=".4" stroke-width="1.8" fill="none"/>`, // 1.0.12.8 : Vulkania (l'archipel volcanique) n'avait pas d'emblème
  lanterne: `<path d="M-4-18h8v4h-8Z"/><path d="M-10-14h20c3 6 3 22 0 28h-20c-3-6-3-22 0-28Z"/><path d="M-11-6h22M-11 6h22" stroke="#000" stroke-opacity=".35" stroke-width="1.6"/><rect x="-5" y="14" width="10" height="4" rx="1"/>`,
};
// volutes latérales (côté gauche, en coordonnées viewBox 200x96, miroir pour la droite)
const FL = {
  feuilles: (c) => `<path d="M70 50C56 34 38 32 18 38c14 2 26 8 36 18-16-6-30-4-42 6 18-2 34 0 48 8Z" fill="url(#m)" stroke="${c[3]}" stroke-width="2"/><path d="M66 50C50 40 34 39 22 40" stroke="${c[3]}" stroke-opacity=".5" stroke-width="1.5" fill="none"/>`,
  ailes: (c) => `<path d="M70 44C56 22 30 14 6 18c10 4 18 8 22 14-10-2-18 0-24 4 12 0 20 2 26 8-8 0-14 3-18 8 16-4 34-2 50 6Z" fill="url(#m)" stroke="${c[3]}" stroke-width="2"/><path d="M64 44C48 30 30 24 14 24M62 50C46 42 32 40 20 42" stroke="${c[3]}" stroke-opacity=".45" stroke-width="1.5" fill="none"/>`,
  pics: (c) => `<path d="M70 46 30 26l14 16-34-6 30 14-28 8 34 0-14 12 38-14Z" fill="url(#m)" stroke="${c[3]}" stroke-width="2" stroke-linejoin="round"/>`,
  vagues: (c) => `<path d="M70 52C60 40 46 36 34 40c-8 3-10 12-4 15 4 2 9-1 8-5 6 0 10 6 6 11-6 6-22 4-34-6 6 16 24 26 42 22 10-2 16-10 18-25Z" fill="url(#m)" stroke="${c[3]}" stroke-width="2"/>`,
  flammes: (c) => `<path d="M70 52C56 52 44 46 40 34c-2 8 0 12 4 16-10-2-18-10-20-22-4 12 0 22 8 28-10 0-18-4-24-12 4 18 22 26 40 24 8-1 16-6 22-16Z" fill="url(#m)" stroke="${c[3]}" stroke-width="2"/>`,
  volutes: (c) => `<path d="M70 48C58 40 46 40 38 44c-10 5-10 18 0 20 8 2 12-6 6-10-4-2-8 2-5 5" fill="none" stroke="url(#m)" stroke-width="6" stroke-linecap="round"/><path d="M70 48C58 40 46 40 38 44c-10 5-10 18 0 20 8 2 12-6 6-10-4-2-8 2-5 5" fill="none" stroke="${c[3]}" stroke-width="1.6" stroke-linecap="round"/><path d="M40 44C30 36 18 36 8 42c8 0 14 2 18 6" fill="none" stroke="url(#m)" stroke-width="4" stroke-linecap="round"/>`,
};
const R = [
  ["incarnam", "Incarnam", "ame", "ailes", "argent", "#7fd8ff"],
  ["astrub", "Astrub", "tour", "volutes", "or", "#e8a33b"],
  ["amakna", "Amakna", "feuille", "feuilles", "or", "#5fbf3f"],
  ["cania", "Plaines de Cania", "ble", "feuilles", "or", "#e3c04a"],
  ["wabbit", "Île des Wabbits", "wabbit", "feuilles", "or", "#f08a3c"],
  ["sidimote", "Landes de Sidimote", "crane", "pics", "sombre", "#8c5ad6"],
  ["koalaks", "Montagne des Koalaks", "patte", "feuilles", "bronze", "#6aa84f"],
  ["albuera", "Albuera", "sapin", "ailes", "argent", "#9fd4ff"],
  ["abrak", "Forêt des Abraknydes", "arbre", "pics", "bronze", "#4e7a35"],
  ["moon", "Île de Moon", "lune", "vagues", "or", "#3fb8a8"],
  ["dragoeufs", "Terres des Dragoeufs", "oeuf", "flammes", "bronze", "#d9532e"],
  ["otomai", "Île d'Otomaï", "palmier", "feuilles", "jade", "#2fa37a"],
  ["minotoror", "Île du Minotoror", "cornes", "pics", "bronze", "#a3462b"],
  ["pandala", "Île de Pandala", "bambou", "feuilles", "jade", "#e05a5a"],
  ["frigost", "Île de Frigost", "flocon", "ailes", "argent", "#58b6ff"],
  ["saharach", "Saharach", "soleil", "flammes", "or", "#f0a020"],
  ["pwak", "Île de Pwâk", "plume", "ailes", "or", "#c9874a"],
  ["divines", "Dimensions divines", "etoile", "flammes", "or", "#b07cff"],
  ["asse", "Îlots de la mer d'Asse", "masque", "volutes", "or", "#d4446a"],
  ["bontabrak", "Bonta et Brâkmar", "epees", "volutes", "argent", "#c94b4b"],
  ["grobe", "Île de Grobe", "lanterne", "pics", "sombre", "#5e7fa3"],
  ["sakai", "Île de Sakaï", "cristal", "ailes", "argent", "#7ad0e8"],
  ["valonia", "Archipel de Valonia", "marteau", "pics", "bronze", "#c77d3a"],
  ["nimotopia", "Nimotopia", "couronne", "volutes", "or", "#d64fa0"],
  ["obscure", "Dimension Obscure", "oeil", "flammes", "sombre", "#a03fd6"],
  ["harebourg", "Frigost : Harebourg", "sablier", "ailes", "argent", "#4f8de0"],
  ["sufokia", "Baie de Sufokia", "trident", "vagues", "or", "#2f8fd6"],
  ["cavaliers", "Dimensions des Cavaliers", "fer", "pics", "sombre", "#c23a3a"],
  ["wukin", "Wukin et Wukang", "encre", "volutes", "argent", "#3a3a4a"],
  ["possedes", "Atoll des Possédés", "crane", "flammes", "sombre", "#d63a7a"],
  ["ecailles", "Archipel des Écailles", "ecaille", "vagues", "jade", "#3fa36a"],
  ["vulkania", "Archipel de Vulkania", "volcan", "flammes", "or", "#e0461f"],
  ["pal1", "Médaillon du Mérite", "etoile", "volutes", "argent", "#2f7fd6"],
  ["pal2", "Couronne d'étoiles", "couronne", "ailes", "or", "#8a3fe0"],
];
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`; };
function svg([id, name, mot, fl, met, gem]) {
  const c = METAL[met];
  const light = shade(gem, 0.75);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 96" width="200" height="96"><title>Ornement · ${name}</title>
<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".45" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>
<radialGradient id="g" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="${shade(gem, 0.35)}"/><stop offset=".6" stop-color="${gem}"/><stop offset="1" stop-color="${shade(gem, -0.55)}"/></radialGradient>
<radialGradient id="t" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${shade(gem, 0.2)}"/><stop offset="1" stop-color="${shade(gem, -0.5)}"/></radialGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#000" flood-opacity=".55"/></filter></defs>
<g filter="url(#s)">
<g>${FL[fl](c)}</g><g transform="translate(200 0) scale(-1 1)">${FL[fl](c)}</g>
<path d="M100 6 108 14H92Z" fill="url(#m)" stroke="${c[3]}" stroke-width="1.6"/>
<circle cx="100" cy="50" r="37" fill="url(#m)" stroke="${c[3]}" stroke-width="2.4"/>
<circle cx="100" cy="50" r="33" fill="none" stroke="${c[0]}" stroke-opacity=".7" stroke-width="1.2"/>
${Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return `<circle cx="${(100 + Math.cos(a) * 35).toFixed(1)}" cy="${(50 + Math.sin(a) * 35).toFixed(1)}" r="1.3" fill="${c[3]}" opacity=".55"/>`; }).join("")}
<circle cx="100" cy="50" r="28" fill="url(#g)" stroke="${c[3]}" stroke-width="2"/>
<path d="M78 40a28 28 0 0 1 44 0" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"/>
<g transform="translate(100 51) scale(1.18)" fill="${light}" color="${light}" stroke-linejoin="round">${M[mot]}</g>
<circle cx="100" cy="11" r="5.5" fill="url(#t)" stroke="${c[3]}" stroke-width="1.4"/>
<path d="M88 86h24l-4 6h-16Z" fill="url(#m)" stroke="${c[3]}" stroke-width="1.4"/>
</g></svg>`;
}
R.forEach((r) => fs.writeFileSync(path.join(OUT, `orn_${r[0]}.svg`), svg(r)));
console.log(R.length, "ornements");
