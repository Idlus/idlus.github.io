/* Zones des Percepteurs (0.1.22) : écrit supabase/percos_data.sql (table perco_zones : nom, niveau et contenu
   d'une poche pleine de chaque sous-zone), à partir de E.percoCap (js/gboss.js) pour que le serveur et le jeu
   comptent pareil. À relancer si les zones, les monstres ou leurs butins changent.
   1.0.30 : aussi les donjons (kind = 'dj', poche +50 %, ressources des salles) et les équipements de la Prospection.
   Lancer : node tools/build_percos.js */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/defi.js"); require("../js/gboss.js");
const D = require("../js/data.js");
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const row = (sid, name, lvl, kind) => { const cap = E.percoCap(sid); return cap ? `(${q(sid)}, ${q(name)}, ${lvl}, ${q(JSON.stringify(cap))}::jsonb, ${q(kind)})` : null; };
const zones = Object.keys(E.SUBS).filter((sid) => E.SUBS[sid].monsters && E.SUBS[sid].monsters.length)
  .map((sid) => { const sub = E.SUBS[sid]; return row(sid, sub.name, Math.round((sub.lvl[0] + sub.lvl[1]) / 2), "zone"); }).filter(Boolean);
const djs = Object.keys(D.DUNGEONS).filter((did) => !E.SUBS[did]).sort().map((did) => row(did, D.DUNGEONS[did].name, D.DUNGEONS[did].lvl, "dj")).filter(Boolean);
const rows = zones.concat(djs);
const out = `-- Généré par tools/build_percos.js — ne pas modifier à la main.
-- Zones et donjons où un Percepteur peut se poser, et contenu d'une poche pleine (12 h).
create table if not exists public.perco_zones (sid text primary key, name text not null, lvl int not null, cap jsonb not null);
alter table public.perco_zones add column if not exists kind text not null default 'zone'; -- 1.0.30 : 'zone' ou 'dj' (donjon)
alter table public.perco_zones enable row level security;
insert into public.perco_zones (sid, name, lvl, cap, kind) values
${rows.join(",\n")}
on conflict (sid) do update set name = excluded.name, lvl = excluded.lvl, cap = excluded.cap, kind = excluded.kind;
`;
fs.writeFileSync(path.join(__dirname, "../supabase/percos_data.sql"), out);
console.log(`supabase/percos_data.sql : ${zones.length} zones, ${djs.length} donjons`);
