/* Actions libres du robot idlus sur le serveur Discord (lecture, salons, rôles, messages, fils…), pour gérer le serveur depuis un fil Claude.
   node tools/discord_actions.js [actions.json]   (ou la liste JSON dans DISCORD_ACTIONS)
   La liste : [{ "methode": "POST", "chemin": "/channels/{{salon:annonces}}/messages", "corps": { "content": "…" } }, …] (API Discord v10).
   Dans « chemin » et « corps » : {{serveur}} = identifiant du serveur, {{salon:nom}}, {{role:nom}}, {{N.champ}} = champ du résultat de l'action N (à partir de 0).
   Chaque résultat est affiché dans le journal (tronqué à 4 000 caractères) ; --print affiche les appels sans les envoyer. */
const fs = require("fs"); const { api, norm, guildId } = require("./discord_api.js");
const DRY = process.argv.includes("--print"); const file = process.argv.slice(2).find((a) => !a.startsWith("--"));

async function main() {
  const raw = (process.env.DISCORD_ACTIONS || (file ? fs.readFileSync(file, "utf8") : "")).trim();
  if (!raw) { console.log("Liste d'actions attendue dans DISCORD_ACTIONS ou dans un fichier."); process.exit(1); }
  let list = JSON.parse(raw); if (!Array.isArray(list)) list = [list];
  const gid = DRY ? "SERVEUR" : await guildId(); let chans = null, roles = null; const res = [];
  const fill = async (s) => {
    let out = s;
    for (const m of [...s.matchAll(/\{\{([^}]+)\}\}/g)]) {
      const [k, ...rest] = m[1].split(":"), v = rest.join(":").trim(); let r;
      if (k === "serveur") r = gid;
      else if (k === "salon") { chans = chans || (DRY ? [] : await api("GET", `/guilds/${gid}/channels`)); r = (chans.find((c) => norm(c.name) === norm(v)) || {}).id || (DRY ? `<${v}>` : null); }
      else if (k === "role") { roles = roles || (DRY ? [] : await api("GET", `/guilds/${gid}/roles`)); r = (roles.find((x) => norm(x.name) === norm(v)) || {}).id || (DRY ? `<@${v}>` : null); }
      else { const [n, ...path] = m[1].split("."); r = path.reduce((o, p) => (o == null ? o : o[p]), res[+n]); if (DRY && r == null) r = `<${m[1]}>`; }
      if (r == null) throw new Error("Introuvable : " + m[0]);
      out = out.replace(m[0], String(r));
    }
    return out;
  };
  for (const [i, a] of list.entries()) {
    const method = (a.methode || a.method || "GET").toUpperCase(), path = await fill(a.chemin || a.path);
    const body = a.corps || a.body ? JSON.parse(await fill(JSON.stringify(a.corps || a.body))) : undefined;
    if (DRY) { console.log(`#${i} ${method} ${path}`, body ? JSON.stringify(body) : ""); res.push(null); continue; }
    const r = await api(method, path, body); res.push(r);
    console.log(`#${i} ${method} ${path} → ${JSON.stringify(r).slice(0, 4000)}`);
    if (list.length > 1) await new Promise((ok) => setTimeout(ok, 600));
  }
  console.log("Actions effectuées :", list.length);
}
if (!process.env.DISCORD_BOT_TOKEN && !DRY) { console.log("DISCORD_BOT_TOKEN absent : rien à faire."); process.exit(0); }
main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
