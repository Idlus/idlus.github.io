/* Publie les notes de la version courante sur Discord via le webhook (variable d'environnement DISCORD_WEBHOOK).
   Usage : DISCORD_WEBHOOK=... node tools/post_discord.js [version] */
const fs = require("fs"); const https = require("https");
const DRY = process.argv.includes("--print");
const hook = process.env.DISCORD_WEBHOOK; if (!hook && !DRY) { console.log("DISCORD_WEBHOOK absent : rien à publier."); process.exit(0); }
const data = JSON.parse(fs.readFileSync(__dirname + "/../changelog.json", "utf8"));
const v = process.argv.slice(2).find((a) => !a.startsWith("--")) || data.version; const c = data.versions.find((x) => x.v === v);
if (!c) { console.log("Version introuvable :", v); process.exit(1); }
const URL_GAME = "https://idlus.github.io/";
/* 1.0.30 : Discord refuse une description de plus de 4 096 caractères (erreur 400 « embeds ») : une longue liste de
   nouveautés est répartie sur plusieurs encadrés qui se suivent (6 000 caractères au plus en tout, sinon la liste est coupée). */
const lines = c.items.map((x) => "• " + x), end = `\n\n🎮 **[Jouer à idlus](${URL_GAME})** — la mise à jour s'applique au prochain chargement du jeu.`;
const parts = [""]; let total = 0; const MAXD = 3900, MAXT = 5500;
for (const l of lines) { if (total + l.length > MAXT) { parts[parts.length - 1] += "\n• … et d'autres nouveautés dans le jeu."; break; } const cur = parts[parts.length - 1]; if (cur && cur.length + l.length + 1 > MAXD) parts.push(l); else parts[parts.length - 1] = cur ? cur + "\n" + l : l; total += l.length + 1; }
parts[parts.length - 1] += end;
const payload = {
  username: "idlus", avatar_url: URL_GAME + "icons/icon-192.png",
  embeds: parts.map((d, i) => Object.assign({ color: 0xf0c35a, description: d },
    i === 0 ? { title: `✨ Mise à jour ${c.v} « ${c.name} »`, url: URL_GAME, thumbnail: { url: URL_GAME + "icons/icon-192.png" } } : {},
    i === parts.length - 1 ? { footer: { text: "idlus · projet de fan non officiel" }, timestamp: new Date().toISOString() } : {})),
};
(async () => {
// mentionne le rôle « Notif mises à jour » si le robot (DISCORD_BOT_TOKEN) peut retrouver son identifiant
if (process.env.DISCORD_BOT_TOKEN && !DRY) try { const D = require("./discord_api.js"); const r = await D.roleId(await D.guildId(), "Notif mises à jour");
  if (r) Object.assign(payload, { content: `<@&${r}>`, allowed_mentions: { roles: [r] } }); } catch (e) { console.log("Rôle de notification introuvable :", e.message); }
const body = JSON.stringify(payload);
if (DRY) { process.stdout.write(body); process.exit(0); }
const u = new URL(hook);
const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
  (res) => { let d = ""; res.on("data", (x) => (d += x)); res.on("end", () => { console.log("Discord :", res.statusCode, d.slice(0, 200)); process.exit(res.statusCode < 300 ? 0 : 1); }); });
req.on("error", (e) => { console.error(e.message); process.exit(1); }); req.end(body);
})();
