/* Boss des mondes · Saison 1 : bilan du lundi sur Discord (Mathis 03/11). Lu par le workflow « Bilan du boss de la semaine ».
   node tools/wboss_recap.js recap.json [--print]  → un message dans #annonces-idlus : chute ou fuite du boss de la semaine passée,
   podium du meilleur essai, paliers du serveur et d'essais, puis le nouveau boss et sa mécanique. recap.json = sortie de s1.wb_recap(). */
"use strict";
const fs = require("fs");
const { execFileSync } = require("child_process");
const E = require("../js/engine.js"); require("../js/systems.js"); require("../js/wboss.js");
const DRY = process.argv.includes("--print");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
let rows = []; try { rows = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { rows = []; }
// la sortie de vps_sql.sh json est [{ "r": [...] }]
if (Array.isArray(rows) && rows.length && rows[0] && rows[0].r !== undefined) rows = rows.flatMap((x) => (typeof x.r === "string" ? JSON.parse(x.r) : x.r) || []);
if (!Array.isArray(rows) || !rows.length) { console.log("Pas de bilan à poster."); process.exit(0); }
const nf = (n) => Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ");
const dur = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d} j ${h} h` : h ? `${h} h ${String(m).padStart(2, "0")}` : `${Math.max(1, m)} min`; };
function text(k) {
  const top = (typeof k.top === "string" ? JSON.parse(k.top) : k.top || []).slice(0, 3).map((x, i) => `${["🥇", "🥈", "🥉"][i]} ${x.p} (${nf((x.best || 0) * E.WB_PV)} PV)`).join(" · ");
  const T = k.tiers || {}; const tiers = [["or", "Or"], ["argent", "Argent"], ["bronze", "Bronze"]].filter(([id]) => T[id]).map(([id, n]) => `${T[id]} ${n}`).join(", ");
  const D = E.wbS1Def(k.next_n); const M = E.BOSS_MECHS[D.sig] || {};
  const head = k.fled
    ? `🌫️ **Bilan du boss des mondes : ${k.name} s'est enfui** avec ${100 - (k.pct || 0)} % de vie.`
    : `⚔️ **Bilan du boss des mondes : ${k.name} est tombé**${k.dur ? ` en ${dur(k.dur)}` : ""} !${k.by ? ` Dernier coup : **${k.by}**.` : ""}`;
  return [head,
    `${k.players} joueur${k.players > 1 ? "s l'ont" : " l'a"} frappé · paliers du serveur : ${k.pal ? `${k.pal} %` : "aucun"}${tiers ? ` · paliers d'essais : ${tiers}` : ""}.`,
    top ? `Podium du meilleur essai (titre « Fléau des mondes ») : ${top}.` : "",
    `Cette semaine : **${D.name}**${D.pass > 1 ? ", qui revient plus fort" : ""}. Mécanique : ${D.sigName || M.name || "?"}${D.more && E.BOSS_MECHS[D.more] ? ` + ${E.BOSS_MECHS[D.more].name}` : ""}. Faible ${E.wbElName(D.weak)}, résiste ${E.wbElName(D.res)}.`,
    `Rendez-vous le dernier soir de 20 h à 22 h : s'il est sous 25 %, tout le monde a un essai en plus. https://idlus.github.io/`].filter(Boolean).join("\n");
}
for (const k of rows) {
  const t = text(k);
  if (DRY) { console.log(t + "\n"); continue; }
  execFileSync("node", ["tools/discord_bot.js", "annonce"], { stdio: "inherit", env: Object.assign({}, process.env, { DISCORD_TEXTE: t, DISCORD_ROLE: "aucun", DISCORD_SALON: "annonces-idlus" }) });
}
