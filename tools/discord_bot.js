/* Messages automatiques du robot idlus sur Discord (jeton dans DISCORD_BOT_TOKEN).
   node tools/discord_bot.js beta <changelog.json de la branche beta>  → annonce dans #bêta-nouveautés la dernière entrée des nouveautés de la version de test, si elle n'y est pas déjà
   node tools/discord_bot.js semaine                                  → publie dans #annonces le mutateur de la semaine
   Ajouter --print pour afficher le message sans l'envoyer. */
const fs = require("fs"); const { api, guildId, channelId, roleId } = require("./discord_api.js");
const GAME = "https://mathiss29.github.io/idlus/", BETA = GAME + "beta/";
const DRY = process.argv.includes("--print"); const [cmd, file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function betaMessage(c) {
  return { title: `🧪 Version de test : ${c.v} « ${c.name} »`, url: BETA, color: 0x7bd389,
    description: c.items.map((x) => "• " + x).join("\n").slice(0, 3800) + `\n\n🔬 **[Tester la version de test](${BETA})** — tes retours sont les bienvenus dans #bêta-retours.`,
    footer: { text: "idlus · version de test" }, timestamp: new Date().toISOString() };
}
function weeklyMessage(t = Date.now()) {
  const E = require("../js/engine.js"); E.dungeonUnlocked = () => true; // le modificateur ne dépend que de la semaine (voir E.weekly)
  const w = E.weekly({ chars: [{ lvl: 1 }] }, t); const mod = E.STASIS_MODS[w.mod];
  const end = new Date(E.weekEnd(t) - 1).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return { title: `⚔️ Mutateur de la semaine : ${mod.name}`, url: GAME, color: 0xe0703a,
    description: `**${mod.desc}**\n\nCette semaine, un donjon proche du niveau de ton meilleur héros reçoit ce modificateur à toutes les stasis, en échange de **+${Math.round((E.WEEKLY_REW - 1) * 100)} % d'XP et de butin** et **+${Math.round((E.WEEKLY_DUST - 1) * 100)} % de poussière**. Va voir lequel dans le jeu !\n\nJusqu'au ${end} inclus. 🎮 **[Jouer à idlus](${GAME})**`,
    footer: { text: "idlus · défi de la semaine" }, timestamp: new Date().toISOString() };
}

async function main() {
  if (cmd === "beta") {
    const data = JSON.parse(fs.readFileSync(file, "utf8")); const c = data.versions[0]; const embed = betaMessage(c);
    if (DRY) return console.log(JSON.stringify(embed, null, 1));
    const gid = await guildId(); const ch = await channelId(gid, "bêta-nouveautés");
    const last = await api("GET", `/channels/${ch}/messages?limit=50`);
    if (last.some((m) => (m.embeds || []).some((e) => e.title === embed.title))) return console.log("Déjà annoncée :", embed.title);
    const role = await roleId(gid, "Testeur");
    await api("POST", `/channels/${ch}/messages`, { content: role ? `<@&${role}>` : "", embeds: [embed], allowed_mentions: { roles: role ? [role] : [] } });
    console.log("Annoncée :", embed.title);
  } else if (cmd === "semaine") {
    const embed = weeklyMessage(); if (DRY) return console.log(JSON.stringify(embed, null, 1));
    const gid = await guildId(); const ch = await channelId(gid, "annonces");
    const last = await api("GET", `/channels/${ch}/messages?limit=10`);
    if (last.some((m) => (m.embeds || []).some((e) => e.title === embed.title && Date.now() - Date.parse(m.timestamp) < 6 * 86400000))) return console.log("Déjà publié cette semaine.");
    await api("POST", `/channels/${ch}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } });
    console.log("Publié :", embed.title);
  } else { console.log("Commande attendue : beta <changelog.json> | semaine"); process.exit(1); }
}
if (!process.env.DISCORD_BOT_TOKEN && !DRY) { console.log("DISCORD_BOT_TOKEN absent : rien à publier."); process.exit(0); }
main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
