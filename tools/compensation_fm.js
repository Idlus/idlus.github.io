/* 1.0.30.1 : compensation en kamas EN PLUS pour ceux qui avaient beaucoup forgemagé (demande de Mathis du 14/10/2026,
   « compensation en kamas pour ceux qui avait utilisé la forgemagie en grand nombre »). Le soft reset donne déjà, par objet,
   les runes ×1,5, un Cristal et 100 000 k : ceci s'y ajoute, envoyé par le serveur comme les ventes de l'HdV (hdv_op).
   C'EST UNE MODIFICATION DES PARTIES : lancé seulement avec les mots de Mathis (Actions › Serveur OVH › compensation-fm).
   1. Relevé des parties, en lecture seule (le workflow le fait) :
        bash tools/serveur/vps_sql.sh lecture "select s.user_id, public.pseudo_of(s.user_id) as pseudo, s.data from public.saves s" > parties.json
   2. node tools/compensation_fm.js parties.json compensation.sql [--appliquer]
      → affiche qui reçoit combien, et écrit le SQL des envois : un ESSAI (rollback) sans --appliquer.
   3. bash tools/serveur/vps_sql.sh fichier compensation.sql
   Chaque compte touché est prévenu (« préviens les joueurs touchés ») : message privé de Xener dans le chat (onglet Privé),
   ligne au journal de l'HdV, et une notification s'il est en jeu au moment de l'envoi.
   Par compte : le soft reset déjà passé (S.softReset : objets et runes rendues) ou, s'il n'a pas encore ouvert le jeu, ce que le
   soft reset lui fera (E.softResetPlan). Montant = runes rendues × PAR_RUNE + objets × PAR_OBJET, à partir de SEUIL objets. */
"use strict";
const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "../js/engine.js"));
require(path.join(__dirname, "../js/systems.js"));
require(path.join(__dirname, "../js/forge.js"));

const PAR_RUNE = 10000, PAR_OBJET = 0, SEUIL = 1; // choix de Mathis : voir le fil « Refonte des guildes »
const MARQUE = "Forgemagie : compensation en plus";
const MP = (e) => `Compensation forgemagie : ${f(e.k)} kamas en plus pour ${e.n > 1 ? `tes ${e.n} objets` : "ton objet"} remis à niveau (${f(PAR_RUNE)} kamas par rune rendue), ajoutés à ta partie connectée. Merci de ta patience !`;

const [file, out] = process.argv.slice(2).filter((a) => !a.startsWith("--")); const APPLY = process.argv.includes("--appliquer");
if (!file || !out) { console.error("Usage : node tools/compensation_fm.js parties.json compensation.sql [--appliquer]"); process.exit(2); }
const raw = fs.readFileSync(file, "utf8").trim();
let rows; try { const j = JSON.parse(raw); rows = Array.isArray(j) ? j : [j]; } catch (e) { rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
const txtOf = (r) => (typeof r.data === "string" ? r.data : JSON.stringify(r.data));
const f = (n) => Math.round(n).toLocaleString("fr-FR");
const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const envois = []; let lues = 0, illisibles = 0;
for (const r of rows) {
  if (!r || !/^[0-9a-f-]{36}$/i.test(String(r.user_id || ""))) continue; // comptes seulement : le serveur n'envoie rien aux parties sans compte
  let S; try { S = E.deserialize(txtOf(r)); } catch (e) { illisibles++; continue; }
  lues++;
  const done = S.softReset && S.softReset.n ? S.softReset : null;
  const P = done ? { n: done.n, runes: done.runes || 0, deja: true } : (() => { const p = E.softResetPlan(S); return { n: p.n, runes: p.runesN, deja: false }; })();
  if (!P.n || P.n < SEUIL) continue;
  const k = Math.round(P.runes * PAR_RUNE + P.n * PAR_OBJET); if (k <= 0) continue;
  envois.push({ id: r.user_id, pseudo: r.pseudo || "?", n: P.n, runes: P.runes, k, deja: P.deja });
}
envois.sort((a, b) => b.k - a.k);
console.log(`Compensation forgemagie en plus : ${f(PAR_RUNE)} k par rune rendue${PAR_OBJET ? ` + ${f(PAR_OBJET)} k par objet` : ""}${SEUIL > 1 ? `, à partir de ${SEUIL} objets` : ""}`);
console.log(`Parties lues : ${lues}${illisibles ? ` (${illisibles} illisibles)` : ""} · comptes qui reçoivent : ${envois.length} · total : ${f(envois.reduce((a, e) => a + e.k, 0))} kamas`);
const long = envois.filter((e) => [...MP(e)].length > 200); if (long.length) { console.error(`Message privé trop long (200 caractères au plus) : ${long.map((e) => e.pseudo).join(", ")}`); process.exit(1); }
envois.forEach((e) => console.log(`  ${e.pseudo} : ${e.n} objet${e.n > 1 ? "s" : ""}, ${f(e.runes)} runes rendues → ${f(e.k)} kamas${e.deja ? "" : " (soft reset pas encore passé)"}`));

const sql = [
  "\\set ON_ERROR_STOP 1",
  "begin;",
  `do $$ begin if exists (select 1 from public.hdv_ops where txt like ${sq(MARQUE + "%")}) then raise exception 'La compensation forgemagie a déjà été envoyée : rien n''est changé.'; end if; end $$;`,
  // jack : la ligne de l'HdV s'affiche aussi en notification (js/market.js) pour qui est en jeu au moment de l'envoi
  ...envois.map((e) => `select public.hdv_op(${sq(e.id)}::uuid, jsonb_build_object('k', ${e.k}, 'jack', true), ${sq(`${MARQUE} pour ${e.n > 1 ? `tes ${e.n} objets` : "ton objet"} remis à niveau : ${f(e.k)} kamas`)});`),
  // message privé de Xener (le compte admin de Mathis, comme tools/annonce_en_jeu.sql), comme chat_send l'écrirait
  "create temp table compensation_xener on commit drop as select x.u, public.pseudo_of(x.u) pseudo, l.main cls, coalesce(l.main_lvl, 1) lvl, l.title from (select a.user_id u from public.admins a left join public.profiles p on p.id = a.user_id order by (p.pseudo = 'Xener') desc nulls last limit 1) x left join public.ladder l on l.user_id = x.u;",
  "do $$ begin if not exists (select 1 from compensation_xener) then raise exception 'Compte admin introuvable : rien n''est envoyé.'; end if; end $$;",
  ...envois.map((e) => `insert into public.chat_msgs (ch, user_id, to_id, pseudo, cls, lvl, title, body) select 'p', u, ${sq(e.id)}::uuid, pseudo, cls, lvl, title, ${sq(MP(e))} from compensation_xener;`),
  `select count(*) as envois, coalesce(sum((payload->>'k')::bigint), 0) as kamas from public.hdv_ops where txt like ${sq(MARQUE + "%")};`,
  `select count(*) as messages_prives from public.chat_msgs where ch = 'p' and body like 'Compensation forgemagie :%' and created_at > now() - interval '1 hour';`,
  APPLY ? "commit;\n\\echo 'FAIT : compensation forgemagie envoyée.'" : "rollback;\n\\echo 'ESSAI seulement : rien n''a été envoyé (rollback).'",
].join("\n") + "\n";
fs.writeFileSync(out, sql);
