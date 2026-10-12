/* Hôtel de vente : liste des choses qu'on ne peut ni vendre ni échanger (Dofus et trophées,
   meubles, idoles et autres fabrications uniques), écrite dans supabase/hdv_data.sql.
   À relancer quand les données du jeu changent : node tools/build_hdv.js */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
globalThis.window = globalThis;
for (const f of ["gamedata", "data", "engine", "systems", "pets", "mounts", "idols", "renaissance", "archis"]) require(path.join(ROOT, "js", f + ".js"));
const D = globalThis.DATA;
const keys = [
  ...Object.keys(D.ITEMS).filter((k) => D.ITEMS[k].slot === "dofus"),
  ...Object.entries(D.SPECIAL_CRAFTS).filter(([, r]) => r.unique || r.furn || r.idol).map(([n]) => n),
];
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const out = [
  "-- Généré par tools/build_hdv.js — ne pas modifier à la main.",
  "-- Objets et ressources impossibles à vendre ou à échanger (Dofus, trophées, meubles, idoles).",
  "create table if not exists public.hdv_block (key text primary key);",
  "alter table public.hdv_block enable row level security;",
  "drop policy if exists \"liste lisible\" on public.hdv_block;",
  "create policy \"liste lisible\" on public.hdv_block for select using (true);",
  "delete from public.hdv_block;",
  `insert into public.hdv_block (key) values\n${keys.map((k) => `(${q(k)})`).join(",\n")};`,
  "",
];
fs.writeFileSync(path.join(ROOT, "supabase", "hdv_data.sql"), out.join("\n"));
console.log(`supabase/hdv_data.sql : ${keys.length} entrées`);
