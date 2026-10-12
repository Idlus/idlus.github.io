/* Publie les notes de la version courante sur Discord via le webhook (variable d'environnement DISCORD_WEBHOOK).
   Usage : DISCORD_WEBHOOK=... node tools/post_discord.js [version] */
const fs = require("fs"); const https = require("https");
const DRY = process.argv.includes("--print");
const hook = process.env.DISCORD_WEBHOOK; if (!hook && !DRY) { console.log("DISCORD_WEBHOOK absent : rien à publier."); process.exit(0); }
const data = JSON.parse(fs.readFileSync(__dirname + "/../changelog.json", "utf8"));
const v = process.argv.slice(2).find((a) => !a.startsWith("--")) || data.version; const c = data.versions.find((x) => x.v === v);
if (!c) { console.log("Version introuvable :", v); process.exit(1); }
const URL_GAME = "https://idlus.github.io/";
const body = JSON.stringify({
  username: "idlus", avatar_url: URL_GAME + "icons/icon-192.png",
  embeds: [{
    title: `✨ Mise à jour ${c.v} « ${c.name} »`, url: URL_GAME, color: 0xf0c35a,
    description: c.items.map((x) => "• " + x).join("\n") + `\n\n🎮 **[Jouer à idlus](${URL_GAME})** — la mise à jour s'applique au prochain chargement du jeu.`,
    thumbnail: { url: URL_GAME + "icons/icon-192.png" },
    footer: { text: "idlus · projet de fan non officiel" }, timestamp: new Date().toISOString(),
  }],
});
if (DRY) { process.stdout.write(body); process.exit(0); }
const u = new URL(hook);
const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
  (res) => { let d = ""; res.on("data", (x) => (d += x)); res.on("end", () => { console.log("Discord :", res.statusCode, d.slice(0, 200)); process.exit(res.statusCode < 300 ? 0 : 1); }); });
req.on("error", (e) => { console.error(e.message); process.exit(1); }); req.end(body);
