/* Messages automatiques du robot idlus sur Discord (jeton dans DISCORD_BOT_TOKEN).
   node tools/discord_bot.js beta <changelog.json de la branche beta>  → annonce dans #bêta-nouveautés la dernière entrée des nouveautés de la version de test, si elle n'y est pas déjà
   node tools/discord_bot.js semaine                                  → publie dans #annonces le mutateur de la semaine
   node tools/discord_bot.js almanax                                  → publie dans #almanax le bonus et l'offrande du jour
   node tools/discord_bot.js idees                                    → envoie dans #notes le top 5 des idées du forum (votes 👍)
   node tools/discord_bot.js resume <révision>                        → envoie en message privé au créateur du serveur un résumé des changements de la branche beta jusqu'à cette révision
   node tools/discord_bot.js icone [image.png]                        → remplace l'icône du serveur (par défaut icons/discord.png)
   node tools/discord_bot.js tweet <adresse du tweet>                 → relaie un tweet d'annonce dans #annonces et invite les testeurs à le partager
   node tools/discord_bot.js podium                                   → publie dans #annonces le podium des donjons de la semaine passée (classements de la version de test)
   node tools/discord_bot.js captures <dossier>                       → publie les images du dossier (png, jpg, webp, gif ; 10 par message) dans le salon DISCORD_SALON (#captures par défaut), avec le texte DISCORD_TEXTE au-dessus
   node tools/discord_bot.js suggestions <idees.json>                 → publie dans le forum #idées les idées envoyées depuis le jeu (un fil par idée, avec son tag) ; écrit dans DISCORD_SORTIE la liste [{ id, url }] des idées publiées
   node tools/discord_bot.js annonce [texte.md]                       → publie dans #annonces un message libre (texte dans DISCORD_TEXTE ou dans le fichier), en mentionnant le rôle DISCORD_ROLE (Testeur par défaut, « aucun » pour ne mentionner personne)
   node tools/discord_bot.js notes <fichier.md>                       → publie dans le salon DISCORD_SALON (#note-de-mise-a-jour par défaut) un long patch note découpé en messages
                                                                        (séparateurs « ════════ Message N/M … ════════ », 2 000 caractères au plus chacun), dans l'ordre, sans mention ; un message déjà présent n'est pas renvoyé
   Ajouter --print pour afficher le message sans l'envoyer. */
const fs = require("fs"); const { api, norm, guildId, channelId, roleId } = require("./discord_api.js");
const GAME = "https://idlus.github.io/", BETA = GAME + "beta/";
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

function almanaxMessage(t = Date.now()) {
  const E = require("../js/engine.js"); require("../js/systems.js");
  // 0.1.39 : un Méryde et un type de bonus par jour (calendrier de DOFUS) ; la cible et l'offrande dépendent du niveau du meilleur héros
  const at = (lvl, tt = t) => E.almanax({ chars: [{ lvl }] }, tt); const A = at(1);
  const date = new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const rows = [[1, "Débutant"], [60, "Niveau 60"], [130, "Niveau 130"], [200, "Niveau 200"]].map(([l, n]) => { const x = at(l); return `• ${n} : ${x.target ? x.bonus.txt + " · " : ""}offrande ${x.qty} × ${x.res}`; });
  const B = at(60, t + 864e5);
  return { title: `📅 Almanax du ${date} · ${A.mer}`, url: GAME, color: 0xc9a227,
    description: `**${A.mer}**, ${A.of}${A.fete ? ` : **${A.fete}** !` : ""}\n\n**Bonus du jour : ${A.bonus.name}.** ${at(60).bonus.txt.replace(/^./, (c) => c.toUpperCase())}${A.target ? " (exemple au niveau 60)" : ""}, jusqu'à minuit, en échange d'une offrande.${["xp", "drop", "kamas", "dg", "fete"].includes(A.kind) ? " Il s'ajoute par-dessus tes autres bonus." : ""}\n\nSelon le niveau de ton meilleur héros :\n${rows.join("\n")}\n\nDemain : **${B.mer}**, ${B.bonus.name.toLowerCase()}.\n\n🎮 **[Jouer à idlus](${GAME})**`,
    footer: { text: "idlus · Almanax" }, timestamp: new Date().toISOString() };
}

/* Podium des donjons de la semaine (multijoueur, classements) : lecture publique de la base (serveur OVH depuis le 14/10/2026).
   L'adresse et la clé « publishable » sont publiques par nature (les mêmes que dans le jeu). */
const SB_URL = "https://159-173-129-109.sslip.io", SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkxOTM0NDE5LCJleHAiOjE5NDk2MTQ0MTl9.1iCHQ2UlFSeE2G9IkUjKk47KuG-469_M1wXINPv5Mbc";
const weekIdx = (t) => Math.floor((t / 86400000 + 3) / 7); // comme le jeu : semaines commençant le lundi (UTC)
const recTime = (t) => { const m = Math.floor(t / 60), s = t % 60; return m ? `${m} min ${String(s).padStart(2, "0")} s` : `${s} s`; };
async function podiumMessage(t = Date.now()) {
  const w = weekIdx(t) - 1;
  const res = await fetch(`${SB_URL}/rest/v1/lb_week?select=pseudo,dname,did,bracket,k,t,r&w=eq.${w}&r=lte.3&order=bracket.asc,r.asc`, { headers: { apikey: SB_KEY } });
  if (!res.ok) throw new Error(`classements indisponibles (HTTP ${res.status})`);
  const rows = await res.json(); if (!rows.length) return null;
  const TR = ["niv. 1-40", "niv. 41-80", "niv. 81-120", "niv. 121-160", "niv. 161-200"], MED = ["🥇", "🥈", "🥉"];
  const by = {}; rows.forEach((r) => (by[r.did] = by[r.did] || []).push(r));
  const blocks = Object.values(by).sort((a, b) => a[0].bracket - b[0].bracket)
    .map((rs) => `**${rs[0].dname}** (${TR[rs[0].bracket] || ""})\n` + rs.map((r) => `${MED[r.r - 1] || "•"} ${r.pseudo} : stasis ${r.k} en ${recTime(r.t)}`).join("\n"));
  return { title: "🏆 Podium des donjons de la semaine", url: BETA, color: 0xc9a227,
    description: blocks.join("\n\n").slice(0, 3600) + `\n\nLes 3 premiers de chaque donjon portent le titre **Maître de la semaine** jusqu'à dimanche. Nouveaux donjons cette semaine : **[à toi de jouer](${BETA})** !`,
    footer: { text: "idlus · classements (version de test)" }, timestamp: new Date().toISOString() };
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
  } else if (cmd === "almanax") {
    const embed = almanaxMessage(); if (DRY) return console.log(JSON.stringify(embed, null, 1));
    const gid = await guildId(); const ch = await channelId(gid, "almanax");
    const last = await api("GET", `/channels/${ch}/messages?limit=5`);
    if (last.some((m) => (m.embeds || []).some((e) => e.title === embed.title))) return console.log("Déjà publié aujourd'hui.");
    await api("POST", `/channels/${ch}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } });
    console.log("Publié :", embed.title);
  } else if (cmd === "idees") {
    const gid = await guildId(); const forum = await channelId(gid, "idées");
    const active = (await api("GET", `/guilds/${gid}/threads/active`)).threads.filter((t) => t.parent_id === forum);
    const archived = (await api("GET", `/channels/${forum}/threads/archived/public?limit=100`)).threads;
    const ideas = [];
    for (const t of [...active, ...archived]) {
      let votes = 0; try { const m = await api("GET", `/channels/${t.id}/messages/${t.id}`); votes = ((m.reactions || []).find((r) => r.emoji.name === "👍") || {}).count || 0; } catch (e) {}
      ideas.push({ name: t.name, url: `https://discord.com/channels/${gid}/${t.id}`, votes, msgs: t.message_count || 0 });
    }
    ideas.sort((a, b) => b.votes - a.votes || b.msgs - a.msgs);
    const top = ideas.slice(0, 5);
    const embed = { title: "💡 Top des idées de la semaine", color: 0x7bd389, timestamp: new Date().toISOString(), footer: { text: `${ideas.length} idée${ideas.length > 1 ? "s" : ""} dans le forum` },
      description: top.length ? top.map((x, i) => `**${i + 1}.** [${x.name}](${x.url}) — ${x.votes} 👍 · ${x.msgs} message${x.msgs > 1 ? "s" : ""}`).join("\n") : "Aucune idée proposée pour l'instant." };
    if (DRY) return console.log(JSON.stringify(embed, null, 1));
    await api("POST", `/channels/${await channelId(gid, "notes")}/messages`, { embeds: [embed], allowed_mentions: { parse: [] } });
    console.log("Top des idées envoyé :", top.length);
  } else if (cmd === "resume") {
    const git = (a) => require("child_process").execFileSync("git", a, { encoding: "utf8" }).trim();
    const head = git(["rev-parse", file || "HEAD"]); const short = head.slice(0, 7);
    const gid = DRY ? null : await guildId(); const owner = DRY ? null : (await api("GET", `/guilds/${gid}`)).owner_id;
    const ch = DRY ? null : (await api("POST", "/users/@me/channels", { recipient_id: owner })).id; // conversation privée avec Mathis
    const last = DRY ? [] : await api("GET", `/channels/${ch}/messages?limit=20`);
    const prev = last.map((m) => ((m.embeds || [])[0] || {}).footer).map((f) => f && /révision ([0-9a-f]{7,40})/.exec(f.text)).find(Boolean);
    if (prev && head.startsWith(prev[1])) return console.log("Déjà résumé :", short);
    let range = [head, "-1"]; try { if (prev) { git(["cat-file", "-e", prev[1] + "^{commit}"]); range = [`${prev[1]}..${head}`]; } } catch (e) {}
    const commits = git(["log", "--no-merges", "--format=%s", ...range]).split("\n").filter(Boolean).filter((x) => !/^Version de test :/.test(x));
    if (!commits.length) return console.log("Rien de nouveau à résumer.");
    const cut = (x) => (x.length > 350 ? x.slice(0, 347) + "…" : x);
    const lines = commits.slice(0, 10).map((x) => "• " + cut(x)); if (commits.length > 10) lines.push(`• … et ${commits.length - 10} autre${commits.length > 11 ? "s" : ""} changement${commits.length > 11 ? "s" : ""}`);
    const embed = { title: `🧪 Bêta mise à jour : ${commits.length} changement${commits.length > 1 ? "s" : ""}`, url: BETA, color: 0x7bd389,
      description: lines.join("\n").slice(0, 3900) + `\n\n🔬 **[Ouvrir la version de test](${BETA})**`, footer: { text: `révision ${short}` }, timestamp: new Date().toISOString() };
    if (DRY) return console.log(JSON.stringify(embed, null, 1));
    await api("POST", `/channels/${ch}/messages`, { embeds: [embed] });
    console.log("Résumé envoyé :", commits.length, "changement(s)");
  } else if (cmd === "tweet") {
    if (!/^https:\/\/(x|twitter)\.com\/\S+\/status\/\d+/.test(file || "")) { console.log("Adresse de tweet attendue : https://x.com/<compte>/status/<numéro>"); process.exit(1); }
    const url = file.split("?")[0];
    const text = `📣 **Idlus est annoncé sur X !**\nUn like, une réponse ou un partage, c'est ce qui aide le plus le jeu à se faire voir. Merci à vous !\n${url}`;
    if (DRY) return console.log(text);
    const gid = await guildId(); const ch = await channelId(gid, "annonces");
    const last = await api("GET", `/channels/${ch}/messages?limit=20`);
    if (last.some((m) => (m.content || "").includes(url))) return console.log("Déjà relayé :", url);
    const role = await roleId(gid, "Testeur");
    await api("POST", `/channels/${ch}/messages`, { content: (role ? `<@&${role}> ` : "") + text, allowed_mentions: { roles: role ? [role] : [] } });
    console.log("Relayé :", url);
  } else if (cmd === "podium") {
    const embed = await podiumMessage(); if (!embed) return console.log("Aucun record la semaine passée : rien à publier.");
    if (DRY) return console.log(JSON.stringify(embed, null, 1));
    const gid = await guildId(); const ch = await channelId(gid, "annonces");
    const last = await api("GET", `/channels/${ch}/messages?limit=10`);
    if (last.some((m) => (m.embeds || []).some((e) => e.title === embed.title && Date.now() - Date.parse(m.timestamp) < 6 * 86400000))) return console.log("Déjà publié cette semaine.");
    const role = await roleId(gid, "Testeur");
    await api("POST", `/channels/${ch}/messages`, { content: role ? `<@&${role}>` : "", embeds: [embed], allowed_mentions: { roles: role ? [role] : [] } });
    console.log("Podium publié.");
  } else if (cmd === "annonce") {
    const text = (process.env.DISCORD_TEXTE || (file ? fs.readFileSync(file, "utf8") : "")).trim();
    if (!text) { console.log("Texte attendu dans DISCORD_TEXTE ou dans un fichier."); process.exit(1); }
    if (text.length > 1900) { console.log("Texte trop long :", text.length, "caractères (1 900 au plus, mention comprise)."); process.exit(1); }
    const roleName = (process.env.DISCORD_ROLE || "Testeur").trim();
    if (DRY) return console.log(`[@${roleName}]\n${text}`);
    const gid = await guildId(); const ch = await channelId(gid, "annonces");
    const last = await api("GET", `/channels/${ch}/messages?limit=20`);
    if (last.some((m) => (m.content || "").includes(text.slice(0, 80)))) return console.log("Déjà publié.");
    const role = roleName === "aucun" ? null : await roleId(gid, roleName);
    await api("POST", `/channels/${ch}/messages`, { content: (role ? `<@&${role}> ` : "") + text, allowed_mentions: { roles: role ? [role] : [] } });
    console.log("Annonce publiée :", text.length, "caractères");
  } else if (cmd === "notes") {
    const parts = fs.readFileSync(file, "utf8").split(/^════════ Message \d+\/\d+[^\n]*\n/m).slice(1).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) { console.log("Aucun message trouvé (séparateurs « ════════ Message N/M … ════════ » attendus)."); process.exit(1); }
    const long = parts.findIndex((x) => x.length > 2000); if (long >= 0) { console.log(`Message ${long + 1} trop long : ${parts[long].length} caractères (2 000 au plus).`); process.exit(1); }
    const salon = (process.env.DISCORD_SALON || "note-de-mise-a-jour").trim();
    if (DRY) return parts.forEach((x, i) => console.log(`[#${salon} · ${i + 1}/${parts.length} · ${x.length} caractères]\n${x}\n`));
    const gid = await guildId(); const ch = await channelId(gid, salon);
    if (!ch) { console.log("Salon introuvable :", salon); process.exit(1); }
    const last = await api("GET", `/channels/${ch}/messages?limit=50`); let n = 0;
    for (const x of parts) {
      if (last.some((m) => (m.content || "").startsWith(x.slice(0, 80)))) { console.log("Déjà publié :", x.slice(0, 60)); continue; }
      await api("POST", `/channels/${ch}/messages`, { content: x, allowed_mentions: { parse: [] } }); n++; await new Promise((r) => setTimeout(r, 1200));
    }
    console.log(`Patch note publié dans #${salon} : ${n} message(s) sur ${parts.length}`);
  } else if (cmd === "sondage") {
    // Publie une série de sondages Discord (vrais sondages, votes intégrés) décrits dans un fichier JSON : { salon, categorie, sujet, duree_heures, intro, sondages: [{ question, reponses: [{ emoji, text }] }] }.
    const data = JSON.parse(fs.readFileSync(file || __dirname + "/sondages/expedition.json", "utf8"));
    const salon = (process.env.DISCORD_SALON || data.salon || "sondages").trim(); const hours = Math.min(768, Math.max(1, +data.duree_heures || 168));
    const polls = data.sondages.map((p) => ({ question: { text: p.question.slice(0, 300) }, duration: hours, allow_multiselect: false, layout_type: 1,
      answers: p.reponses.slice(0, 10).map((r) => ({ poll_media: { text: r.text.slice(0, 55), emoji: r.emoji ? { name: r.emoji } : undefined } })) }));
    if (DRY) { console.log(`[#${salon}, ${hours} h]\n${data.intro || ""}\n`); polls.forEach((p, i) => console.log(`${i + 1}. ${p.question.text}\n` + p.answers.map((a) => `   ${a.poll_media.emoji ? a.poll_media.emoji.name + " " : ""}${a.poll_media.text}`).join("\n"))); return; }
    const gid = await guildId(); let chans = await api("GET", `/guilds/${gid}/channels`);
    let ch = chans.find((c) => norm(c.name) === norm(salon) && c.type === 0);
    if (!ch) { // le salon n'existe pas encore : on le crée dans la catégorie demandée (ou sans catégorie)
      const cat = chans.find((c) => c.type === 4 && norm(c.name) === norm(data.categorie || ""));
      ch = await api("POST", `/guilds/${gid}/channels`, { name: salon, type: 0, parent_id: cat ? cat.id : undefined, topic: data.sujet || undefined });
      console.log("Salon créé :", "#" + ch.name);
    }
    const last = await api("GET", `/channels/${ch.id}/messages?limit=100`);
    const seen = new Set(last.map((m) => m.poll && m.poll.question && m.poll.question.text).filter(Boolean));
    let n = 0;
    if (data.intro && !polls.every((p) => seen.has(p.question.text)) && !last.some((m) => (m.content || "").startsWith(data.intro.slice(0, 60)))) await api("POST", `/channels/${ch.id}/messages`, { content: data.intro, allowed_mentions: { parse: [] } });
    for (const poll of polls) {
      if (seen.has(poll.question.text)) { console.log("Déjà publié :", poll.question.text); continue; }
      await api("POST", `/channels/${ch.id}/messages`, { poll, allowed_mentions: { parse: [] } }); n++; await new Promise((r) => setTimeout(r, 1200));
    }
    console.log(`Sondages publiés : ${n} (sur ${polls.length}) dans #${ch.name}`);
  } else if (cmd === "captures") {
    const dir = file || "."; const imgs = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).sort();
    if (!imgs.length) { console.log("Aucune image dans", dir); process.exit(1); }
    const text = (process.env.DISCORD_TEXTE || "").trim(); if (text.length > 1900) { console.log("Texte trop long :", text.length, "caractères (1 900 au plus)."); process.exit(1); }
    const salon = (process.env.DISCORD_SALON || "captures").trim();
    if (DRY) return console.log(`#${salon}\n${text}\n${imgs.join("\n")}`);
    const gid = await guildId(); const ch = await channelId(gid, salon);
    const last = await api("GET", `/channels/${ch}/messages?limit=20`);
    if (text && last.some((m) => (m.content || "").includes(text.slice(0, 80)))) return console.log("Déjà publié.");
    for (let i = 0; i < imgs.length; i += 10) { // Discord : 10 pièces jointes par message au plus
      const fd = new FormData(); const part = imgs.slice(i, i + 10);
      fd.append("payload_json", JSON.stringify({ content: i ? "" : text, allowed_mentions: { parse: [] } }));
      part.forEach((f, j) => fd.append(`files[${j}]`, new Blob([fs.readFileSync(`${dir}/${f}`)]), f));
      const res = await fetch(`${process.env.DISCORD_API || "https://discord.com/api/v10"}/channels/${ch}/messages`, { method: "POST", headers: { Authorization: "Bot " + process.env.DISCORD_BOT_TOKEN, "User-Agent": "idlus-bot (github.com/idlus/idlus.github.io, 1)" }, body: fd });
      if (!res.ok) throw new Error(`envoi des images → ${res.status} ${(await res.text()).slice(0, 300)}`);
    }
    console.log("Images publiées dans #" + salon + " :", imgs.length);
  } else if (cmd === "suggestions") {
    // 0.1.36 : idées envoyées depuis le jeu (table ideas, lue par le workflow « Suggestions vers Discord »)
    const list = JSON.parse(fs.readFileSync(file, "utf8")); const out = process.env.DISCORD_SORTIE; const done = [];
    const post = (x) => ({ name: x.title.slice(0, 100), applied: x.tag,
      content: `${x.body}\n\n— proposé dans le jeu par **${String(x.pseudo || "Joueur").replace(/[*_`~|>]/g, "")}**${x.guest ? " (sans compte)" : ""}${x.info ? ` · ${x.info}` : ""}\nVotez avec 👍 si vous voulez la voir dans le jeu !` });
    if (DRY) { list.forEach((x) => { const p = post(x); console.log(`[${p.applied}] ${p.name}\n${p.content}\n`); }); return; }
    if (!list.length) return console.log("Aucune idée en attente.");
    const gid = await guildId(); const forum = await channelId(gid, "idées");
    const tags = (await api("GET", `/channels/${forum}`)).available_tags || [];
    try {
      for (const x of list) {
        const p = post(x); const tag = tags.find((t) => norm(t.name) === norm(p.applied));
        const th = await api("POST", `/channels/${forum}/threads`, { name: p.name, applied_tags: tag ? [tag.id] : [], message: { content: p.content.slice(0, 2000), allowed_mentions: { parse: [] } } });
        done.push({ id: x.id, url: `https://discord.com/channels/${gid}/${th.id}` }); await new Promise((r) => setTimeout(r, 1200));
      }
    } finally { if (out) fs.writeFileSync(out, JSON.stringify(done)); }
    console.log("Idées publiées dans #idées :", done.length);
  } else if (cmd === "icone") {
    const img = fs.readFileSync(file || __dirname + "/../icons/discord.png"); if (DRY) return console.log("Image :", img.length, "octets");
    await api("PATCH", `/guilds/${await guildId()}`, { icon: "data:image/png;base64," + img.toString("base64") });
    console.log("Icône du serveur remplacée.");
  } else { console.log("Commande attendue : beta <changelog.json> | semaine | almanax | idees | resume <révision> | icone [image.png] | tweet <adresse> | podium | captures <dossier> | annonce [texte.md] | sondage [sondages.json] | suggestions <idees.json>"); process.exit(1); }
}
if (!process.env.DISCORD_BOT_TOKEN && !DRY) { console.log("DISCORD_BOT_TOKEN absent : rien à publier."); process.exit(0); }
main().catch((e) => { console.error("Échec :", e.message); process.exit(1); });
