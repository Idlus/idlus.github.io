/* Régions des prismes (alliances, 1.1) : écrit supabase/alliances_data.sql (tables prism_regions : une ligne par
   région de la carte du Monde, et prism_sids : la région de chaque zone et de chaque donjon où un Percepteur peut se
   poser), pour que le serveur compte la domination des régions comme le jeu (E.allyRegion, js/alliance.js).
   À relancer si les régions, les zones ou les donjons changent.
   Lancer : node tools/build_alliances.js */
"use strict";
const fs = require("fs"), path = require("path");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/alliance.js");
const D = require("../js/data.js");
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const regs = D.ZONES.map((z) => { const lo = Math.min(...z.subs.map((s) => s.lvl[0])), hi = Math.max(...z.subs.map((s) => s.lvl[1])); return `(${q(z.id)}, ${q(z.name)}, ${lo}, ${Math.min(200, hi)})`; });
const sids = Object.keys(E.SUBS).concat(Object.keys(D.DUNGEONS).filter((d) => !E.SUBS[d])).sort()
  .map((sid) => [sid, E.allyRegion(sid)]).filter(([, z]) => z).map(([sid, z]) => `(${q(sid)}, ${q(z)})`);
const out = `-- Généré par tools/build_alliances.js — ne pas modifier à la main.
-- Régions de la carte (un prisme par région) et région de chaque zone ou donjon (domination des régions).
create table if not exists public.prism_regions (zone text primary key, name text not null, lo int not null, hi int not null);
alter table public.prism_regions enable row level security;
create table if not exists public.prism_sids (sid text primary key, zone text not null);
alter table public.prism_sids enable row level security;
insert into public.prism_regions (zone, name, lo, hi) values
${regs.join(",\n")}
on conflict (zone) do update set name = excluded.name, lo = excluded.lo, hi = excluded.hi;
insert into public.prism_sids (sid, zone) values
${sids.join(",\n")}
on conflict (sid) do update set zone = excluded.zone;
`;
fs.writeFileSync(path.join(__dirname, "../supabase/alliances_data.sql"), out);
console.log(`supabase/alliances_data.sql : ${regs.length} régions, ${sids.length} zones et donjons`);
