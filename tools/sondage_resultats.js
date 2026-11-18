/* Lit les résultats d'un sondage Discord publié par le robot (lecture seule). Usage : node tools/sondage_resultats.js "<début de la question>" [salon] */
const { api, norm, guildId } = require("./discord_api.js");
(async () => {
  const q = process.argv[2] || "", salon = process.argv[3] || "sondages";
  const gid = await guildId(); const chans = await api("GET", `/guilds/${gid}/channels`);
  console.log("Salons proches :", chans.filter((c) => /sondage/i.test(norm(c.name))).map((c) => c.name + " (" + c.type + ")").join(", "));
  const ch = chans.find((c) => norm(c.name) === norm(salon) && c.type === 0) || chans.find((c) => /sondage/i.test(norm(c.name)) && c.type === 0);
  let msgs = [], before = "";
  for (let i = 0; i < 5; i++) { const page = await api("GET", `/channels/${ch.id}/messages?limit=100${before}`); if (!page.length) break; msgs = msgs.concat(page); before = "&before=" + page[page.length - 1].id; }
  console.log(`#${ch.name} : ${msgs.length} messages lus, sondages : ${msgs.filter((x) => x.poll).map((x) => x.poll.question.text).slice(0, 5).join(" | ")}`);
  const m = msgs.find((x) => x.poll && x.poll.question && x.poll.question.text.startsWith(q));
  if (!m) { console.log("Sondage introuvable"); return; }
  const counts = {}; ((m.poll.results && m.poll.results.answer_counts) || []).forEach((a) => (counts[a.id] = a.count));
  console.log(`Question : ${m.poll.question.text} (fin ${m.poll.expiry}, finalisé ${!!(m.poll.results && m.poll.results.is_finalized)})`);
  let tot = 0; m.poll.answers.forEach((a) => (tot += counts[a.answer_id] || 0));
  m.poll.answers.forEach((a) => console.log(`  ${(a.poll_media.emoji || {}).name || ""} ${a.poll_media.text} : ${counts[a.answer_id] || 0}`));
  console.log(`Total : ${tot} votes`);
  const after = msgs.filter((x) => BigInt(x.id) > BigInt(m.id) && !x.author.bot && x.content);
  console.log(`\nMessages après le sondage dans #${ch.name} : ${after.length}`);
  after.reverse().forEach((x) => console.log(`- ${x.author.global_name || x.author.username} : ${x.content.replace(/\n/g, " ").slice(0, 300)}`));
  if (m.thread) { const th = await api("GET", `/channels/${m.thread.id}/messages?limit=100`); th.reverse().forEach((x) => !x.author.bot && console.log(`- (fil) ${x.author.global_name || x.author.username} : ${x.content.replace(/\n/g, " ").slice(0, 300)}`)); }
  const rep = msgs.filter((x) => x.message_reference && x.message_reference.message_id && msgs.some((p) => p.id === x.message_reference.message_id && (p.poll || (p.content || "").startsWith("📣 **Sondage : des grades"))));
  if (rep.length) console.log(`(dont ${rep.length} réponses directes)`);
})().catch((e) => { console.error(e); process.exit(1); });
