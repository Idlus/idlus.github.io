/* Boss des mondes (0.1.49) : texte Discord de chaque mort de boss lue par le workflow « Boss des mondes sur Discord ».
   node tools/wboss_discord.js kills.json [--print]  → un message dans #annonces par mort (sans mention de rôle). */
"use strict";
const fs = require("fs");
const { execFileSync } = require("child_process");
const DRY = process.argv.includes("--print");
const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
let rows = []; try { rows = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { rows = []; }
if (!Array.isArray(rows) || !rows.length) { console.log("Aucune mort de boss à annoncer."); process.exit(0); }
const dur = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d} j ${h} h` : h ? `${h} h ${String(m).padStart(2, "0")}` : `${Math.max(1, m)} min`; };
for (const k of rows.sort((a, b) => a.n - b.n)) {
  const top = (typeof k.top === "string" ? JSON.parse(k.top) : k.top || []).slice(0, 3).map((x, i) => `${["🥇", "🥈", "🥉"][i]} ${x.p}`).join(" · ");
  const text = `⚔️ **Boss des mondes : ${k.name} est tombé** en ${dur(+k.dur || 0)} !\n`
    + `Dernier coup : **${k.by || "?"}**.${top ? ` Podium : ${top}.` : ""}\n`
    + `${k.players} joueur${k.players > 1 ? "s reçoivent" : " reçoit"} un Coffre en or${k.n === 1 ? " et le titre « Briseur de Titan »" : ""}, et tout le monde gagne +10 % d'XP pendant 1 h.\n`
    + `**${k.next}** arrive : https://idlus.github.io/`;
  if (DRY) { console.log(text + "\n"); continue; }
  execFileSync("node", ["tools/discord_bot.js", "annonce"], { stdio: "inherit", env: Object.assign({}, process.env, { DISCORD_TEXTE: text, DISCORD_ROLE: "aucun" }) });
}
