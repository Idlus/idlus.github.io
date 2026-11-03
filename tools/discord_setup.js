/* Met en place le serveur Discord d'Ombrelune Studio (le studio de Mathis : idlus et ses futurs jeux) avec un robot : catégories, salons, rôles, permissions, textes d'accueil, communauté et accueil des nouveaux.
   On peut le relancer sans risque : il ne crée que ce qui manque, retrouve les salons par leur nom et met à jour ses propres messages épinglés et n'écrit pas dans un salon où quelqu'un d'autre a écrit.
   Usage : DISCORD_BOT_TOKEN=... [DISCORD_GUILD_ID=...] node tools/discord_setup.js   (sans jeton : affiche seulement le plan) */
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GAME = "https://idlus.github.io/", BETA = GAME + "beta/", INVITE = "https://discord.gg/9ApPgWjPUM";
const P = { VIEW: 1n << 10n, SEND: 1n << 11n, PUB_THREADS: 1n << 35n, PRIV_THREADS: 1n << 36n };
const SERVER = "Ombrelune Studio";
const TEXT = 0, VOICE = 2, CAT = 4, FORUM = 15;

const WELCOME = `# Bienvenue chez Ombrelune Studio !
🌙 **Ombrelune Studio**, c'est le petit studio de Mathis (Xener), qui crée des jeux de fan. Ce serveur réunit tous ses jeux : **idlus** aujourd'hui, et bientôt un nouveau jeu en préparation (suis-le dans <#NEXT>).

⚔️ **idlus** est un idle game de fan inspiré de DOFUS : monte une équipe de héros parmi les 19 classes, équipe-les et affronte donjons et boss jusqu'à la stasis 15. Tes héros se battent tout seuls, même quand tu n'es pas là.

🎮 **Jouer** : ${GAME}
Connecte-toi avec Discord (facultatif) pour garder ta partie sur tous tes appareils, discuter dans le chat, vendre à l'Hôtel des ventes, rejoindre une guilde, défier les autres au Kolizéum et entrer dans les classements. Le jeu s'installe aussi sur téléphone et sur PC.

📜 Lis les règles dans <#RULES>, puis viens discuter dans <#CHAT>. Les grosses nouvelles du studio arrivent dans <#NEWS> ; pour idlus, les nouvelles dans <#NEWSIDLUS> et les notes de chaque mise à jour dans <#UPDATES>. Pour parler d'autre chose : <#OFFTOPIC>.
🐞 Un bug ? Le bouton « Signaler un bug » du jeu (Options) t'amène dans <#BUGS>. 💡 Une idée ? Propose-la dans <#IDEAS>, les autres votent avec 👍.
🗳️ Donne ton avis sur la suite dans <#POLLS> et montre tes héros dans <#SHOTS>.
🗺️ Ce qui est prêt et ce qui arrive : <#ROADMAP>.

🎭 **Tes rôles** : clique sur **Salons et rôles** tout en haut de la liste des salons pour être prévenu des mises à jour d'idlus, suivre le nouveau jeu, afficher ta classe préférée et ton serveur. Tu peux changer d'avis quand tu veux.

*Les jeux d'Ombrelune Studio sont des projets de fan non officiels : idlus n'a aucun lien avec Ankama.*`;
const RULES = `# Règles du serveur
**1.** Respecte tout le monde : pas d'insultes, de harcèlement ni de propos discriminatoires.
**2.** Pas de spam, de flood ni de mentions en masse.
**3.** Pas de publicité ni de liens vers d'autres serveurs sans accord.
**4.** Reste dans le bon salon : chaque jeu a sa catégorie ; pour idlus, bugs dans <#BUGS> et idées dans <#IDEAS>. Discussion libre dans <#CHAT>.
**5.** Pas de triche partagée publiquement ni de fichiers douteux.
**6.** Écris de préférence en français.

En cas de souci, mentionne un @Modérateur. Bon jeu ! ⚔️`;
const ROADMAP = `# Feuille de route d'idlus
Sans dates : chaque partie sort quand elle est prête.

**✅ Déjà dans le jeu**
• Niveaux 1 à 200, les 19 classes, stasis 1 à 15 avec les boss ultimes, qui préviennent avant leurs grosses attaques
• Dofus et leurs quêtes, Maîtrise, Ascension, Songe, défi du jour, Almanax
• Familiers, montures et élevage, forgemagie, métiers et récolte, Havre-Sac
• En ligne : chat, Hôtel des ventes, guildes et boss de guilde, alliances, alignements, Kolizéum, classements
• Deux serveurs : le Classique et le Monocompte (un seul héros, en bêta fermée)

**🔨 En préparation**
• La Saison 1, sur le Classique et le Monocompte, avec un écran pour choisir son serveur
• Vos idées les plus votées dans <#IDEAS> et les sondages de <#POLLS>`;
const NEXT_TXT = `# Un nouveau jeu en préparation
Ombrelune Studio prépare son prochain jeu : une aventure sombre où l'on part de rien pour devenir le plus fort.
Il n'a pas encore de nom ni de date. Les premières images et les nouvelles arriveront ici en premier. Pour en parler, rendez-vous dans <#CHAT>.`;
const BETA_TXT = `# Version de test
La version de test séparée est fermée depuis le 14/10 : les nouveautés arrivent maintenant directement dans le jeu (${GAME}), annoncées dans <#UPDATES>.
Ces salons restent ouverts pour l'historique. Tes retours sur les nouveautés sont toujours les bienvenus dans <#BETAFB>, <#BUGS> ou <#IDEAS>.`;

// rôles « pour s'amuser » : la classe préférée de chacun (couleur du pseudo), choisie à l'arrivée
const CLASS_ROLES = [["Féca", 0xd9b24c], ["Osamodas", 0x6fae4f], ["Enutrof", 0xb08d57], ["Sram", 0x8a7fa8], ["Xélor", 0x5b8fd1], ["Ecaflip", 0xe07b9a],
  ["Eniripsa", 0xf09ac4], ["Iop", 0xd9534f], ["Crâ", 0x7cb35a], ["Sadida", 0x4f9a5c], ["Sacrieur", 0xb8323a], ["Pandawa", 0x7fc4c9], ["Roublard", 0x9b7a5a],
  ["Zobal", 0xa36fc2], ["Steamer", 0x4fa3a8], ["Eliotrope", 0x56c1e0], ["Huppermage", 0xc46fd9], ["Ouginak", 0xc98f4f], ["Forgelance", 0x9aa6b5]];
const ROLES = [
  { key: "creator", name: "Créateur", color: 0xf0c35a, hoist: true },
  { key: "mod", name: "Modérateur", color: 0x5ab4f0, hoist: true, mentionable: true },
  { key: "tester", name: "Testeur", color: 0x7bd389 },
  // donné à la main aux testeurs actifs : au lancement du multijoueur, il débloque le titre « Pionnier d'Idlus » et l'ornement « Pousse du Pionnier »
  { key: "pioneer", name: "Pionnier", color: 0x9bd84a, hoist: true },
  { key: "notif", name: "Notif idlus", old: ["Notif mises à jour"], color: 0, mentionable: true },
  { key: "notifstudio", name: "Notif studio", color: 0, mentionable: true },
  { key: "notifnext", name: "Suivre le nouveau jeu", color: 0, mentionable: true },
  { key: "srvclassic", name: "Joueur Classique", color: 0x8fb3c9 },
  { key: "srvmono", name: "Joueur Monocompte", color: 0xc9a46b },
  ...CLASS_ROLES.map(([n, color]) => ({ key: "cl_" + n, name: n, color })),
];
// lock : lecture seule pour @everyone ; only : visible seulement par ces rôles
const PLAN = [ // old : anciens noms de la catégorie (elle est renommée au lieu d'en créer une nouvelle)
  { cat: "🌙 Ombrelune Studio", old: ["📌 Bienvenue"], lock: true, chans: [
    { key: "WELCOME", name: "bienvenue", topic: "Présentation du studio, de ses jeux et liens utiles", text: WELCOME },
    { key: "RULES", name: "règles", topic: "À lire avant de participer", text: RULES },
    { key: "NEWS", name: "annonces", topic: "Les grosses nouvelles d'Ombrelune Studio et de ses jeux" } ] },
  { cat: "💬 Communauté", chans: [
    { key: "CHAT", name: "général", topic: "Discussion libre entre joueurs de tous les jeux du studio" },
    { key: "OFFTOPIC", name: "hors-sujet", topic: "Tout ce qui n'a rien à voir avec les jeux : films, mangas, autres jeux, la vie…" },
    { key: "VOICE", name: "Général", type: VOICE } ] },
  { cat: "⚔️ idlus", old: ["📢 Infos"], chans: [
    { key: "NEWSIDLUS", name: "annonces-idlus", lock: true, topic: "Les nouvelles d'idlus : podium de la semaine, boss des mondes, tweets…" },
    { key: "UPDATES", name: "note-de-mise-a-jour", lock: true, topic: "Notes de chaque mise à jour d'idlus, publiées automatiquement" },
    { key: "ROADMAP", name: "feuille-de-route", lock: true, topic: "Ce qui est déjà dans idlus et ce qui arrive", text: ROADMAP },
    { key: "ALMANAX", name: "almanax", lock: true, topic: "Le bonus et l'offrande du jour d'idlus, publiés chaque matin" },
    { key: "HELP", name: "entraide", topic: "Questions et conseils entre joueurs d'idlus" },
    { key: "BUILDS", name: "builds-et-équipes", topic: "Partage tes compositions (bouton « Partager le build » dans le jeu)" },
    { key: "SHOTS", name: "captures", topic: "Montre tes héros, trophées et ton Havre-Sac. Les aperçus des prochaines nouveautés arrivent aussi ici" },
    { key: "POLLS", name: "sondages", topic: "Les sondages d'idlus : votez pour orienter les prochaines mises à jour" } ] },
  { cat: "🛠️ Retours idlus", old: ["🛠️ Retours"], chans: [
    { key: "BUGS", name: "bugs", type: FORUM, topic: "Un fil par bug : ce que tu faisais, ce qui s'est passé, une capture si possible.",
      tags: [["Ouvert", "🔴"], ["En cours", "🟡"], ["Corrigé", "🟢"], ["Pas un bug", "⚪"]] },
    { key: "IDEAS", name: "idées", type: FORUM, topic: "Une idée par fil. Votez avec 👍 pour les idées que vous voulez voir dans le jeu.",
      tags: [["Combat", "⚔️"], ["Équipement", "🛡️"], ["Interface", "🖥️"], ["Contenu", "🗺️"], ["Retenue", "✅"]] } ] },
  { cat: "🧪 Bêta idlus", old: ["🧪 Bêta"], only: ["mod", "creator"], chans: [ // version de test fermée le 14/10 : gardée pour l'historique, visible par l'équipe
    { key: "BETANEWS", name: "bêta-nouveautés", lock: true, topic: "Ce qui vient d'arriver sur la version de test", text: BETA_TXT },
    { key: "BETAFB", name: "bêta-retours", topic: "Tes retours sur la version de test" } ] },
  { cat: "🌑 Nouveau jeu", lock: true, chans: [
    { key: "NEXT", name: "en-préparation", topic: "Le prochain jeu d'Ombrelune Studio : les nouvelles arrivent ici", text: NEXT_TXT } ] },
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
  if (guild.name !== SERVER) { await api("PATCH", `/guilds/${gid}`, { name: SERVER }); console.log("Serveur renommé :", SERVER); }
  if (!guild.icon) { await api("PATCH", `/guilds/${gid}`, { icon: "data:image/png;base64," + require("fs").readFileSync(__dirname + "/../icons/discord.png").toString("base64") }); console.log("Icône du serveur mise en place."); }

  const roles = {}; const have = await api("GET", `/guilds/${gid}/roles`);
  for (const r of ROLES) {
    let ex = have.find((x) => x.name === r.name);
    const was = !ex && (r.old || []).map((n) => have.find((x) => x.name === n)).find(Boolean);
    if (was) { ex = was; await api("PATCH", `/guilds/${gid}/roles/${ex.id}`, { name: r.name }); console.log("  rôle renommé :", r.name); }
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
      const was = !cat && (s.old || []).map((n) => find(n, CAT)).find(Boolean);
      if (was) { cat = was; await api("PATCH", `/channels/${cat.id}`, { name: s.cat }); cat.name = s.cat; console.log("  catégorie renommée :", s.cat); }
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
    const recent = await api("GET", `/channels/${ids[c.key]}/messages?limit=20`);
    const mine = (await api("GET", `/channels/${ids[c.key]}/pins`)).find((m) => m.author && m.author.id === me) // texte épinglé par le robot : on le met à jour
      || recent.find((m) => m.type === 0 && m.author && m.author.id === me && m.content.startsWith("# ")); // (ou son texte qui n'est plus épinglé)
    if (mine) {
      if (!mine.pinned) try { await api("PUT", `/channels/${ids[c.key]}/pins/${mine.id}`); } catch (e) {}
      if (mine.content === want) console.log("  texte à jour :", c.name);
      else { await api("PATCH", `/channels/${ids[c.key]}/messages/${mine.id}`, { content: want, allowed_mentions: { parse: [] } }); console.log("  texte mis à jour :", c.name); }
      continue;
    }
    const last = recent.filter((m) => m.type === 0); // les avis « message épinglé » ne comptent pas
    if (last.length) { console.log("  texte déjà présent (pas du robot) :", c.name); continue; }
    const m = await api("POST", `/channels/${ids[c.key]}/messages`, { content: want, allowed_mentions: { parse: [] } });
    try { await api("PUT", `/channels/${ids[c.key]}/pins/${m.id}`); } catch (e) {}
    console.log("  texte publié :", c.name);
  }

  try {
    const visible = PLAN.filter((s) => !s.only).flatMap((s) => s.chans).filter((c) => c.type !== VOICE).map((c) => ids[c.key]);
    let seq = 0n; const sid = () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + seq++); // Discord exige un identifiant pour chaque question et réponse
    const opt = (title, description, emoji, role) => ({ id: sid(), title, description, emoji: emoji ? { name: emoji } : undefined, role_ids: [roles[role]], channel_ids: [] });
    await api("PUT", `/guilds/${gid}/onboarding`, { enabled: true, mode: 0, default_channel_ids: visible, prompts: [
      { id: sid(), type: 0, title: "Tes notifications (modifiables à tout moment dans Salons et rôles)", single_select: false, required: false, in_onboarding: true, options: [
        opt("Être prévenu à chaque mise à jour d'idlus", "Une mention à chaque nouvelle version", "🔔", "notif"),
        opt("Suivre le nouveau jeu", "Une mention à chaque nouvelle du prochain jeu du studio", "🌑", "notifnext"),
        opt("Les grosses annonces du studio", "Une mention pour les nouvelles importantes", "🌙", "notifstudio") ] },
      ...[CLASS_ROLES.slice(0, 10), CLASS_ROLES.slice(10)].map((part) => ({ // Discord : 12 choix au plus par question
        id: sid(), type: 0, title: `Ta classe préférée (${part[0][0]} à ${part[part.length - 1][0]})`, single_select: true, required: false, in_onboarding: true,
        options: part.map(([n]) => opt(n, "La couleur de ton pseudo", null, "cl_" + n)) })),
      { id: sid(), type: 0, title: "Ton serveur dans idlus", single_select: false, required: false, in_onboarding: true, options: [
        opt("Classique", "Une équipe de héros", "⚔️", "srvclassic"),
        opt("Monocompte", "Un seul héros, en saison", "🛡️", "srvmono") ] } ] });
    console.log("Accueil des nouveaux configuré (choix des rôles à l'arrivée).");
  } catch (e) { console.log("Accueil des nouveaux non configuré, à faire à la main :", e.message); }

  try { // filtre automatique : invitations vers d'autres serveurs et mentions en masse
    const rules = await api("GET", `/guilds/${gid}/auto-moderation/rules`); const block = [{ type: 1, metadata: {} }];
    if (!rules.some((r) => r.trigger_type === 5)) await api("POST", `/guilds/${gid}/auto-moderation/rules`, { name: "Mentions en masse", event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 6 }, actions: block, enabled: true });
    if (!rules.some((r) => r.name === "Invitations Discord")) await api("POST", `/guilds/${gid}/auto-moderation/rules`, { name: "Invitations Discord", event_type: 1, trigger_type: 1, trigger_metadata: { regex_patterns: ["discord(?:\\.gg|(?:app)?\\.com/invite)/\\S+"], allow_list: ["discord.gg/9ApPgWjPUM"] }, actions: block, enabled: true, exempt_roles: [roles.creator, roles.mod] });
    console.log("Filtre automatique (AutoMod) en place.");
  } catch (e) { console.log("AutoMod non configuré :", e.message); }

  try { // règles à accepter avant de pouvoir écrire (filtrage des nouveaux membres)
    await api("PATCH", `/guilds/${gid}/member-verification`, { enabled: true, description: "Bienvenue chez Ombrelune Studio ! Lis et accepte les règles pour pouvoir écrire.",
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
