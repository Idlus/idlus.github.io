/* Met en place le serveur Discord d'idlus avec un robot : catégories, salons, rôles, permissions, textes d'accueil, communauté et accueil des nouveaux.
   On peut le relancer sans risque : il ne crée que ce qui manque, retrouve les salons par leur nom et n'écrit que dans les salons vides.
   Usage : DISCORD_BOT_TOKEN=... [DISCORD_GUILD_ID=...] node tools/discord_setup.js   (sans jeton : affiche seulement le plan) */
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GAME = "https://idlus.github.io/", BETA = GAME + "beta/", INVITE = "https://discord.gg/9ApPgWjPUM";
const P = { VIEW: 1n << 10n, SEND: 1n << 11n, PUB_THREADS: 1n << 35n, PRIV_THREADS: 1n << 36n };
const TEXT = 0, VOICE = 2, CAT = 4, FORUM = 15;

const WELCOME = `# Bienvenue sur le Discord d'idlus !
**idlus** est un idle game de fan inspiré de DOFUS : monte une équipe de héros parmi les 19 classes, équipe-les et affronte les donjons jusqu'à la stasis 10. Tes héros se battent tout seuls, même quand tu n'es pas là.

🎮 **Jouer** : ${GAME}
Le jeu est en ligne : connecte-toi avec Discord (facultatif) pour garder ta partie sur tous tes appareils, discuter dans le chat, vendre à l'Hôtel de vente, rejoindre une guilde et entrer dans les classements.
🧪 **Version de test** : ${BETA}
Les nouveautés y arrivent en premier, à tester hors ligne avant leur sortie.

📜 Lis les règles dans <#RULES>, puis viens discuter dans <#CHAT>.
🐞 Un bug ? Le bouton « Signaler un bug » du jeu (Options) t'amène dans <#BUGS>. 💡 Une idée ? Propose-la dans <#IDEAS>, les autres votent avec 👍.
🗺️ Ce qui est prêt et ce qui arrive : <#ROADMAP>.

*idlus est un projet de fan non officiel, sans lien avec Ankama.*`;
const RULES = `# Règles du serveur
**1.** Respecte tout le monde : pas d'insultes, de harcèlement ni de propos discriminatoires.
**2.** Pas de spam, de flood ni de mentions en masse.
**3.** Pas de publicité ni de liens vers d'autres serveurs sans accord.
**4.** Reste dans le bon salon : bugs dans <#BUGS>, idées dans <#IDEAS>, discussion libre dans <#CHAT>.
**5.** Pas de triche partagée publiquement ni de fichiers douteux.
**6.** Écris de préférence en français.

En cas de souci, mentionne un @Modérateur. Bon jeu ! ⚔️`;
const ROADMAP = `# Feuille de route
Sans dates : chaque partie sort quand elle est prête.

**✅ Déjà dans le jeu**
• Niveau 200 : 839 monstres, 51 nouveaux donjons, Frigost, Saharach, Sakaï, l'Île des Wabbits…
• Familiers, dragodindes, muldos et volkornes, avec l'élevage
• Idoles, archimonstres et Dofus, Renaissance
• L'Expédition sans fin, journal de quêtes, défi du jour, artisans et temples, chasse au trésor
• En ligne : compte Discord facultatif, chat, Hôtel de vente et échanges, guildes, boss de guilde, Percepteurs, classements

**🔨 En préparation**
• Kolizéum : des combats contre l'équipe d'autres joueurs
• Mode marchand : ta propre boutique, visible par tous les joueurs

**🚀 Version 1.0**
• Tout le monde repart de zéro (les parties sont encore calculées sur ton appareil)
• Les testeurs qui ont le rôle Pionnier retrouvent le titre « Pionnier d'Idlus » et l'ornement « Pousse du Pionnier »`;
const BETA_TXT = `# Version de test
${BETA}
Les nouveautés arrivent ici avant le jeu public. La version de test n'a pas de serveur : en l'ouvrant, choisis « Tester hors ligne » (ta partie de test reste sur ton appareil) ou « Jouer en ligne » pour revenir au jeu public.
• Chaque partie de test reçoit le titre « Pionnier d'Idlus » ; les testeurs actifs reçoivent le rôle Pionnier, qui le leur rendra à la 1.0.
Les nouveautés de chaque mise à jour sont annoncées ici. Raconte ce que tu as testé dans <#BETAFB>.`;

const ROLES = [
  { key: "creator", name: "Créateur", color: 0xf0c35a, hoist: true },
  { key: "mod", name: "Modérateur", color: 0x5ab4f0, hoist: true, mentionable: true },
  { key: "tester", name: "Testeur", color: 0x7bd389 },
  // donné à la main aux testeurs actifs : au lancement du multijoueur, il débloque le titre « Pionnier d'Idlus » et l'ornement « Pousse du Pionnier »
  { key: "pioneer", name: "Pionnier", color: 0x9bd84a, hoist: true },
  { key: "notif", name: "Notif mises à jour", color: 0, mentionable: true },
];
// lock : lecture seule pour @everyone ; only : visible seulement par ces rôles
const PLAN = [
  { cat: "📌 Bienvenue", lock: true, chans: [
    { key: "WELCOME", name: "bienvenue", topic: "Présentation du jeu et liens utiles", text: WELCOME },
    { key: "RULES", name: "règles", topic: "À lire avant de participer", text: RULES } ] },
  { cat: "📢 Infos", lock: true, chans: [
    { key: "NEWS", name: "annonces", topic: "Les grosses nouvelles d'idlus" },
    { key: "UPDATES", name: "note-de-mise-a-jour", topic: "Notes de chaque mise à jour, publiées automatiquement" },
    { key: "ROADMAP", name: "feuille-de-route", topic: "Ce qui est déjà dans le jeu et ce qui arrive", text: ROADMAP },
    { key: "ALMANAX", name: "almanax", topic: "Le bonus et l'offrande du jour, publiés chaque matin" } ] },
  { cat: "💬 Communauté", chans: [
    { key: "CHAT", name: "général", topic: "Discussion libre autour d'idlus" },
    { key: "HELP", name: "entraide", topic: "Questions et conseils entre joueurs" },
    { key: "BUILDS", name: "builds-et-équipes", topic: "Partage tes compositions (bouton « Partager le build » dans le jeu)" },
    { key: "SHOTS", name: "captures", topic: "Montre tes héros, trophées et ton Havre-Sac" },
    { key: "VOICE", name: "Général", type: VOICE } ] },
  { cat: "🛠️ Retours", chans: [
    { key: "BUGS", name: "bugs", type: FORUM, topic: "Un fil par bug : ce que tu faisais, ce qui s'est passé, une capture si possible.",
      tags: [["Ouvert", "🔴"], ["En cours", "🟡"], ["Corrigé", "🟢"], ["Pas un bug", "⚪"]] },
    { key: "IDEAS", name: "idées", type: FORUM, topic: "Une idée par fil. Votez avec 👍 pour les idées que vous voulez voir dans le jeu.",
      tags: [["Combat", "⚔️"], ["Équipement", "🛡️"], ["Interface", "🖥️"], ["Contenu", "🗺️"], ["Retenue", "✅"]] } ] },
  { cat: "🧪 Bêta", only: ["tester", "mod", "creator"], chans: [
    { key: "BETANEWS", name: "bêta-nouveautés", lock: true, topic: "Ce qui vient d'arriver sur la version de test", text: BETA_TXT },
    { key: "BETAFB", name: "bêta-retours", topic: "Tes retours sur la version de test" } ] },
  { cat: "🔐 Équipe", only: ["mod", "creator"], chans: [
    { key: "MODS", name: "modération", topic: "Salon privé de l'équipe" },
    { key: "NOTES", name: "notes", topic: "Notes privées" } ] },
];

const { api, norm } = require("./discord_api.js");
const fill = (s, ids) => s.replace(/<#([A-Z]+)>/g, (m, k) => (ids[k] ? `<#${ids[k]}>` : "#" + k.toLowerCase()));

function overwrites(g, roles, sect, ch) {
  const ow = []; const lock = ch.lock ?? sect.lock; const deny = (lock ? P.SEND | P.PUB_THREADS | P.PRIV_THREADS : 0n) | (sect.only ? P.VIEW : 0n);
  if (deny) ow.push({ id: g, type: 0, allow: "0", deny: String(deny) });
  for (const k of sect.only || []) ow.push({ id: roles[k], type: 0, allow: String(k !== "tester" && lock ? P.VIEW | P.SEND : P.VIEW), deny: "0" });
  return ow;
}

async function main() {
  if (!TOKEN) {
    console.log("DISCORD_BOT_TOKEN absent : plan seulement, rien n'est envoyé.\n");
    console.log("Rôles :", ROLES.map((r) => r.name).join(", "));
    for (const s of PLAN) console.log(`\n${s.cat}${s.lock ? " (lecture seule)" : ""}${s.only ? " (privé : " + s.only.join(", ") + ")" : ""}\n` + s.chans.map((c) => `  ${c.type === VOICE ? "🔊" : c.type === FORUM ? "🗂️" : "#"} ${c.name}${c.lock ? " (lecture seule)" : ""}`).join("\n"));
    return;
  }
  let gid = process.env.DISCORD_GUILD_ID;
  if (!gid) { const gs = await api("GET", "/users/@me/guilds"); if (gs.length !== 1) throw new Error(`Le robot est sur ${gs.length} serveurs : précise DISCORD_GUILD_ID.`); gid = gs[0].id; }
  const guild = await api("GET", `/guilds/${gid}`); console.log("Serveur :", guild.name);
  if (!guild.icon) { await api("PATCH", `/guilds/${gid}`, { icon: "data:image/png;base64," + require("fs").readFileSync(__dirname + "/../icons/discord.png").toString("base64") }); console.log("Icône du serveur mise en place."); }

  const roles = {}; const have = await api("GET", `/guilds/${gid}/roles`);
  for (const r of ROLES) {
    const ex = have.find((x) => x.name === r.name);
    roles[r.key] = ex ? ex.id : (await api("POST", `/guilds/${gid}/roles`, { name: r.name, color: r.color, hoist: !!r.hoist, mentionable: !!r.mentionable, permissions: "0" })).id;
    console.log(ex ? "  rôle déjà là :" : "  rôle créé :", r.name);
  }
  try { await api("PUT", `/guilds/${gid}/members/${guild.owner_id}/roles/${roles.creator}`); } catch (e) { console.log("  (rôle Créateur non attribué :", e.message, ")"); }

  let chans = await api("GET", `/guilds/${gid}/channels`); const ids = {}; const fresh = new Set();
  const find = (name, type, parent) => chans.find((c) => norm(c.name) === norm(name) && c.type === type && (parent === undefined || c.parent_id === parent))
    || chans.find((c) => norm(c.name) === norm(name) && c.type === type);
  const community = (guild.features || []).includes("COMMUNITY");
  const pass = async (forums) => {
    let pos = 0;
    for (const s of PLAN) {
      let cat = find(s.cat, CAT);
      if (!cat) { cat = await api("POST", `/guilds/${gid}/channels`, { name: s.cat, type: CAT, permission_overwrites: overwrites(gid, roles, s, {}) }); chans.push(cat); console.log("  catégorie créée :", s.cat); }
      await api("PATCH", `/channels/${cat.id}`, { position: pos++, permission_overwrites: overwrites(gid, roles, s, {}) });
      let cpos = 0;
      for (const c of s.chans) {
        const type = c.type ?? TEXT; if ((type === FORUM) !== forums) { cpos++; continue; }
        const body = { parent_id: cat.id, position: cpos++, permission_overwrites: overwrites(gid, roles, s, c) };
        if (c.topic && type !== VOICE) body.topic = c.topic;
        if (c.tags) body.available_tags = c.tags.map(([name, emoji_name]) => ({ name, emoji_name }));
        let ch = find(c.name, type, cat.id);
        if (ch) { const keep = ch.available_tags?.length ? { ...body, available_tags: undefined } : body; await api("PATCH", `/channels/${ch.id}`, keep); console.log("  salon rangé :", c.name); }
        else { ch = await api("POST", `/guilds/${gid}/channels`, { name: c.name, type, ...body }); chans.push(ch); fresh.add(c.key); console.log("  salon créé :", c.name); }
        ids[c.key] = ch.id;
      }
    }
  };
  await pass(false);

  if (!community) {
    await api("PATCH", `/guilds/${gid}`, { features: [...(guild.features || []), "COMMUNITY"], verification_level: 2, explicit_content_filter: 2,
      default_message_notifications: 1, rules_channel_id: ids.RULES, public_updates_channel_id: ids.MODS, preferred_locale: "fr" });
    console.log("Communauté activée.");
  } else await api("PATCH", `/guilds/${gid}`, { rules_channel_id: ids.RULES, verification_level: Math.max(2, guild.verification_level), default_message_notifications: 1 });
  chans = await api("GET", `/guilds/${gid}/channels`);
  await pass(true);

  const me = (await api("GET", "/users/@me")).id;
  for (const s of PLAN) for (const c of s.chans) if (c.text) {
    const want = fill(c.text, ids);
    const mine = (await api("GET", `/channels/${ids[c.key]}/pins`)).find((m) => m.author && m.author.id === me); // texte épinglé par le robot : on le met à jour
    if (mine) {
      if (mine.content === want) console.log("  texte à jour :", c.name);
      else { await api("PATCH", `/channels/${ids[c.key]}/messages/${mine.id}`, { content: want, allowed_mentions: { parse: [] } }); console.log("  texte mis à jour :", c.name); }
      continue;
    }
    const last = await api("GET", `/channels/${ids[c.key]}/messages?limit=1`);
    if (last.length) { console.log("  texte déjà présent (pas du robot) :", c.name); continue; }
    const m = await api("POST", `/channels/${ids[c.key]}/messages`, { content: want, allowed_mentions: { parse: [] } });
    try { await api("PUT", `/channels/${ids[c.key]}/pins/${m.id}`); } catch (e) {}
    console.log("  texte publié :", c.name);
  }

  try {
    const visible = PLAN.filter((s) => !s.only).flatMap((s) => s.chans).filter((c) => c.type !== VOICE).map((c) => ids[c.key]);
    let seq = 0n; const sid = () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + seq++); // Discord exige un identifiant pour chaque question et réponse
    await api("PUT", `/guilds/${gid}/onboarding`, { enabled: true, mode: 0, default_channel_ids: visible, prompts: [{
      id: sid(), type: 0, title: "Qu'est-ce qui t'intéresse ?", single_select: false, required: false, in_onboarding: true, options: [
        { id: sid(), title: "Tester les nouveautés en avant-première", description: "Accès aux salons de la version de test", emoji: { name: "🧪" }, role_ids: [roles.tester], channel_ids: [] },
        { id: sid(), title: "Être prévenu à chaque mise à jour", description: "Une mention à chaque nouvelle version", emoji: { name: "🔔" }, role_ids: [roles.notif], channel_ids: [] } ] }] });
    console.log("Accueil des nouveaux configuré (choix des rôles à l'arrivée).");
  } catch (e) { console.log("Accueil des nouveaux non configuré, à faire à la main :", e.message); }

  try { // filtre automatique : invitations vers d'autres serveurs et mentions en masse
    const rules = await api("GET", `/guilds/${gid}/auto-moderation/rules`); const block = [{ type: 1, metadata: {} }];
    if (!rules.some((r) => r.trigger_type === 5)) await api("POST", `/guilds/${gid}/auto-moderation/rules`, { name: "Mentions en masse", event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 6 }, actions: block, enabled: true });
    if (!rules.some((r) => r.name === "Invitations Discord")) await api("POST", `/guilds/${gid}/auto-moderation/rules`, { name: "Invitations Discord", event_type: 1, trigger_type: 1, trigger_metadata: { regex_patterns: ["discord(?:\\.gg|(?:app)?\\.com/invite)/\\S+"], allow_list: ["discord.gg/9ApPgWjPUM"] }, actions: block, enabled: true, exempt_roles: [roles.creator, roles.mod] });
    console.log("Filtre automatique (AutoMod) en place.");
  } catch (e) { console.log("AutoMod non configuré :", e.message); }

  try { // règles à accepter avant de pouvoir écrire (filtrage des nouveaux membres)
    await api("PATCH", `/guilds/${gid}/member-verification`, { enabled: true, description: "Bienvenue sur le Discord d'idlus ! Lis et accepte les règles pour pouvoir écrire.",
      form_fields: [{ field_type: "TERMS", label: "J'ai lu et j'accepte les règles du serveur", required: true,
        values: RULES.split("\n").filter((l) => /^\*\*\d/.test(l)).map((l) => fill(l.replace(/^\*\*\d+\.\*\* /, ""), ids).replace(/<#\d+>/g, (m) => "#" + (chans.find((c) => `<#${c.id}>` === m) || {}).name)) }] });
    console.log("Règles à accepter avant d'écrire : activé.");
  } catch (e) { console.log("Règles à accepter non activées, à faire à la main (Paramètres du serveur → Accès) :", e.message); }

  try { // invitation permanente qui ouvre directement le forum des bugs (bouton « Signaler un bug » du jeu)
    const inv = await api("POST", `/channels/${ids.BUGS}/invites`, { max_age: 0, max_uses: 0, unique: false });
    console.log(`Lien du forum des bugs : https://discord.gg/${inv.code}`);
  } catch (e) { console.log("Invitation du forum des bugs non créée :", e.message); }

  console.log(`\nTerminé. Invitation : ${INVITE}`);
}
main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
