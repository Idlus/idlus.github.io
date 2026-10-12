/* Petit client de l'API Discord pour le robot idlus (jeton dans DISCORD_BOT_TOKEN). Utilisé par discord_setup.js, discord_bot.js et post_discord.js. */
const API = process.env.DISCORD_API || "https://discord.com/api/v10";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path, body) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(API + path, { method, headers: { Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN, "Content-Type": "application/json", "User-Agent": "idlus-bot (github.com/Mathiss29/idlus, 1)" }, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) { const j = await res.json(); await sleep((j.retry_after || 1) * 1000 + 100); continue; }
    const txt = await res.text(); const data = txt ? JSON.parse(txt) : null;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${txt.slice(0, 300)}`);
    return data;
  }
  throw new Error(`${method} ${path} : trop de limitations de débit`);
}
const norm = (s) => s.toLowerCase().normalize("NFC");
async function guildId() {
  if (process.env.DISCORD_GUILD_ID) return process.env.DISCORD_GUILD_ID;
  const gs = await api("GET", "/users/@me/guilds"); if (gs.length !== 1) throw new Error(`Le robot est sur ${gs.length} serveurs : précise DISCORD_GUILD_ID.`);
  return gs[0].id;
}
const channelId = async (gid, name) => { const c = (await api("GET", `/guilds/${gid}/channels`)).find((x) => norm(x.name) === norm(name)); if (!c) throw new Error("Salon introuvable : " + name); return c.id; };
const roleId = async (gid, name) => ((await api("GET", `/guilds/${gid}/roles`)).find((r) => r.name === name) || {}).id;
module.exports = { api, norm, guildId, channelId, roleId };
