/* Zones des Percepteurs (0.1.22) : écrit supabase/percos_data.sql (table perco_zones : nom, niveau et contenu
   d'une poche pleine de chaque sous-zone), à partir de E.percoCap (js/gboss.js) pour que le serveur et le jeu
   comptent pareil. À relancer si les zones, les monstres ou leurs butins changent.
   Lancer : node tools/build_percos.js */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/defi.js"); require("../js/gboss.js");
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const rows = Object.keys(E.SUBS).filter((sid) => E.SUBS[sid].monsters && E.SUBS[sid].monsters.length).map((sid) => {
  const sub = E.SUBS[sid]; const cap = E.percoCap(sid);
  return `(${q(sid)}, ${q(sub.name)}, ${Math.round((sub.lvl[0] + sub.lvl[1]) / 2)}, ${q(JSON.stringify(cap))}::jsonb)`;
});
const out = `-- Généré par tools/build_percos.js — ne pas modifier à la main.
-- Zones où un Percepteur peut se poser, et contenu d'une poche pleine (12 h).
create table if not exists public.perco_zones (sid text primary key, name text not null, lvl int not null, cap jsonb not null);
alter table public.perco_zones enable row level security;
insert into public.perco_zones (sid, name, lvl, cap) values
${rows.join(",\n")}
on conflict (sid) do update set name = excluded.name, lvl = excluded.lvl, cap = excluded.cap;
`;
fs.writeFileSync(path.join(__dirname, "../supabase/percos_data.sql"), out);
console.log(`supabase/percos_data.sql : ${rows.length} zones`);
