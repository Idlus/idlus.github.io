/* Annonces automatiques des Hauts faits (ladder_ann de supabase/chat.sql) dans un vrai Postgres jetable (jamais la base en ligne).
   Tickets #158, #159 : « Grougaloragran, Crâ de Bozoman, atteint le niveau 200 ! » en boucle.
   - deux héros de même classe et même nom (noms par défaut tirés d'une liste de 16), l'un niveau 200 : une seule annonce, pas une par envoi ;
   - deux appareils qui envoient tour à tour une partie récente et une ancienne : niveau 200, Renaissance et Dofus annoncés une fois ;
   - toujours annoncé : le niveau 200, le second héros du même nom au niveau 200, une Renaissance, le niveau 200 « (encore) », un Dofus ;
   - chat.sql réappliqué : les annonces répétées déjà dans le chat sont effacées (la première reste), les messages des joueurs non.
   Lancer : IDLUS_PG="postgresql://postgres@/postgres?host=/chemin/du/socket&port=55432" node tests/hauts_faits_sql.test.js
   Sans IDLUS_PG, le test est sauté. La base « idlus_hauts_faits » est recréée puis effacée. */
"use strict";
const { execFileSync } = require("child_process");
const path = require("path"); const assert = require("assert");
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.IDLUS_PG;
if (!URL0) { console.log("ok - IDLUS_PG absent : test SQL des Hauts faits sauté"); process.exit(0); }

const DB = "idlus_hauts_faits";
const dbUrl = URL0.replace(/\/postgres(\?|$)/, "/" + DB + "$1");
const run = (sql, url) => execFileSync("psql", [url || dbUrl, "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const q = (s) => run(s);
const file = (f) => execFileSync("psql", [dbUrl, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", path.join(ROOT, "supabase", f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const U = (i) => `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
const hero = (cls, name, lvl, ren) => ({ cls, name, lvl, ren: ren || 0 });
const push = (i, heroes, dofus) => q(`update ladder set heroes = $j$${JSON.stringify(heroes)}$j$::jsonb, dofus = $j$${JSON.stringify(dofus || [])}$j$::jsonb where user_id = '${U(i)}'`);
const anns = (i, t) => +q(`select count(*) from chat_msgs where kind = 'ann' and user_id = '${U(i)}'${t ? ` and data->>'t' = '${t}'` : ""}`);

run(`drop database if exists ${DB}`, URL0); run(`create database ${DB}`, URL0);
try {
  q(`do $$ declare r text; begin foreach r in array array['anon', 'authenticated', 'service_role'] loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I', r); end if; end loop; end $$;
     create schema auth; grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key);
     create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
     grant usage on schema public to anon, authenticated; create publication supabase_realtime;`);
  file("schema.sql"); file("classements.sql"); file("chat.sql");
  q(`insert into auth.users select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
     insert into profiles (id, pseudo) select id, 'Joueur' || right(id::text, 2) from auth.users on conflict do nothing;
     insert into ladder (user_id, main) select id, 'cra' from auth.users;`);

  // ---------- 1. deux Crâ « Grougaloragran », l'un niveau 200 (ticket #159) ----------
  push(1, [hero("cra", "Grougaloragran", 199), hero("cra", "Grougaloragran", 150)]);
  push(1, [hero("cra", "Grougaloragran", 200), hero("cra", "Grougaloragran", 150)]);
  assert.strictEqual(anns(1, "lvl200"), 1, "niveau 200 annoncé");
  for (let k = 0; k < 5; k++) push(1, [hero("cra", "Grougaloragran", 200), hero("cra", "Grougaloragran", 151 + k)]);
  assert.strictEqual(anns(1, "lvl200"), 1, "envois suivants : plus d'annonce (avant : une par envoi)");
  push(1, [hero("cra", "Grougaloragran", 200), hero("cra", "Grougaloragran", 200)]);
  assert.strictEqual(anns(1, "lvl200"), 2, "le second Crâ du même nom au niveau 200 est annoncé");
  push(1, [hero("cra", "Grougaloragran", 200), hero("cra", "Grougaloragran", 200)]);
  assert.strictEqual(anns(1, "lvl200"), 2, "puis plus rien");
  console.log("ok - deux héros de même classe et même nom : niveau 200 annoncé une fois par héros, pas à chaque envoi");

  // ---------- 2. deux appareils : partie récente et partie ancienne envoyées tour à tour ----------
  const oldS = [hero("iop", "Tristepin", 190)], newS = [hero("iop", "Tristepin", 200)];
  push(2, oldS);
  for (let k = 0; k < 4; k++) { push(2, newS, ["ocre"]); push(2, oldS, []); }
  assert.strictEqual(anns(2, "lvl200"), 1, "niveau 200 annoncé une fois malgré l'alternance");
  assert.strictEqual(anns(2, "dofus"), 1, "Dofus annoncé une fois malgré l'alternance");
  push(2, [hero("iop", "Tristepin", 1, 1)]);
  assert.strictEqual(anns(2, "ren"), 1, "Renaissance annoncée");
  for (let k = 0; k < 3; k++) { push(2, newS); push(2, [hero("iop", "Tristepin", 1, 1)]); }
  assert.strictEqual(anns(2, "ren"), 1, "Renaissance annoncée une fois malgré l'alternance");
  push(2, [hero("iop", "Tristepin", 200, 1)]);
  assert.strictEqual(q(`select count(*) from chat_msgs where user_id = '${U(2)}' and data->>'t' = 'lvl200' and (data->>'ren')::int = 1`), "1", "niveau 200 après une Renaissance : « (encore) » annoncé");
  push(2, [hero("iop", "Tristepin", 200, 1)], ["ocre", "turquoise"]);
  assert.strictEqual(anns(2, "dofus"), 2, "un autre Dofus est annoncé");
  console.log("ok - deux appareils en alternance : niveau 200, Renaissance et Dofus annoncés une seule fois ; « (encore) » et nouveau Dofus toujours annoncés");

  // ---------- 3. premier envoi, héros renommé, classement en vérification : rien, comme avant ----------
  q(`update ladder set heroes = '[]'::jsonb where user_id = '${U(3)}'`);
  push(3, [hero("sram", "Lou", 200)]);
  push(3, [hero("sram", "Ruel", 200)]);
  q(`update ladder set flagged = true where user_id = '${U(4)}'`); push(4, [hero("feca", "Yugo", 199)]); push(4, [hero("feca", "Yugo", 200)]);
  assert.strictEqual(anns(3) + anns(4), 0, "héros nouveau ou renommé, compte en vérification : pas d'annonce");
  console.log("ok - héros apparu ou renommé et compte en vérification : pas d'annonce");

  // ---------- 4. chat.sql réappliqué sur un chat déjà spammé ----------
  q(`insert into chat_msgs (ch, user_id, pseudo, kind, data) select 'g', '${U(5)}', 'Joueur05', 'ann', '{"t":"lvl200","cls":"cra","name":"Grougaloragran","ren":0}'::jsonb from generate_series(1, 50);
     insert into chat_msgs (ch, user_id, pseudo, kind, body) select 'g', '${U(5)}', 'Joueur05', 'msg', 'coucou' from generate_series(1, 3);
     update ladder set heroes = '[{"cls":"cra","name":"Grougaloragran","lvl":199,"ren":0}]'::jsonb where user_id = '${U(5)}';`);
  const firstId = q(`select min(id) from chat_msgs where user_id = '${U(5)}' and kind = 'ann'`);
  q(`delete from ann_marks where user_id = '${U(5)}'`); // comme en ligne avant la correction : rien de noté
  file("chat.sql"); file("chat.sql");
  assert.strictEqual(anns(5), 1, "répétitions effacées, une annonce reste");
  assert.strictEqual(q(`select min(id) from chat_msgs where user_id = '${U(5)}' and kind = 'ann'`), firstId, "la première est gardée");
  assert.strictEqual(q(`select count(*) from chat_msgs where user_id = '${U(5)}' and kind = 'msg'`), "3", "messages des joueurs non touchés");
  push(5, [hero("cra", "Grougaloragran", 200)]); // l'appareil à jour renvoie sa partie après l'ancienne
  assert.strictEqual(anns(5), 1, "déjà annoncé avant la correction : pas annoncé de nouveau");
  console.log("ok - chat.sql réappliqué : annonces répétées effacées (la première reste), déjà-annoncé noté");
} finally {
  run(`drop database if exists ${DB}`, URL0);
}
