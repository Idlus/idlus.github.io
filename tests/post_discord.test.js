/* 2.1.30.4 : annonce Discord manuelle (tools/post_discord.js --strict), avec un faux Discord local : rien ne sort de la machine.
   Essai sans envoi, version obligatoire, doublon refusé, renvoi demandé, vérification impossible = refus. Lancer : node tests/post_discord.test.js */
"use strict";
const assert = require("assert"), http = require("http"), path = require("path"), fs = require("fs"), os = require("os"), { spawnSync } = require("child_process");
const SCRIPT = path.join(__dirname, "..", "tools", "post_discord.js");
const V = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "changelog.json"), "utf8")).version;
// remplace https.request (envoi au webhook) par un enregistrement dans un fichier
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "idlus-discord-")), LOG = path.join(tmp, "posts.log"), HOOK = path.join(tmp, "hook.js");
fs.writeFileSync(HOOK, `const https = require("https"), fs = require("fs"), { EventEmitter } = require("events");
https.request = (o, cb) => { const r = new EventEmitter(); r.end = (b) => { fs.appendFileSync(${JSON.stringify(LOG)}, b + "\\n");
  const res = new EventEmitter(); res.statusCode = 204; cb(res); res.emit("end"); }; return r; };`);
let messages = [], down = false;
const srv = http.createServer((req, res) => {
  if (down) { res.writeHead(500); return res.end("panne"); }
  const out = (x) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(x)); };
  if (req.url === "/users/@me/guilds") return out([{ id: "g1", name: "Idlus" }]);
  if (req.url === "/guilds/g1/channels") return out([{ id: "c1", name: "note-de-mise-a-jour" }]);
  if (req.url === "/guilds/g1/roles") return out([{ id: "r1", name: "Notif mises à jour" }]);
  if (req.url.startsWith("/channels/c1/messages")) return out(messages);
  res.writeHead(404); res.end("{}");
});
srv.listen(0, "127.0.0.1", () => {
  const api = `http://127.0.0.1:${srv.address().port}`;
  const run = (args, env) => new Promise((ok) => { fs.writeFileSync(LOG, "");
    const child = require("child_process").spawn(process.execPath, ["-r", HOOK, SCRIPT, ...args], { env: Object.assign({ PATH: process.env.PATH, DISCORD_API: api }, env) });
    let o = ""; child.stdout.on("data", (d) => (o += d)); child.on("close", (code) => ok({ code, out: o, posts: fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).length })); });
  const SEND = { DISCORD_WEBHOOK: "https://discord.invalid/api/webhooks/1/x", DISCORD_BOT_TOKEN: "faux" };
  (async () => {
    let r = await run([V, "--strict", "--print"], {}); // essai : ni secret ni réseau
    assert.strictEqual(r.code, 0); assert.strictEqual(r.posts, 0, "essai : aucun envoi"); assert.ok(r.out.includes(`Mise à jour ${V}`), "essai : le message est affiché");
    r = await run([V, "--strict", "--print"], SEND); assert.strictEqual(r.posts, 0, "essai avec secrets : aucun envoi");
    r = await run(["--strict"], SEND); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "version obligatoire");
    r = await run(["9.9.9", "--strict"], SEND); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "version inconnue");
    messages = [{ timestamp: "2026-10-19T17:03:20Z", embeds: [{ title: `✨ Mise à jour ${V} « x »` }] }];
    r = await run([V, "--strict"], SEND); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "doublon refusé"); assert.ok(r.out.includes("déjà annoncée"));
    r = await run([V, "--strict"], Object.assign({ RENVOYER: "true" }, SEND)); assert.strictEqual(r.code, 0); assert.strictEqual(r.posts, 1, "renvoi demandé : un envoi");
    messages = [{ embeds: [{ title: `✨ Mise à jour ${V}.1 « autre »` }] }];
    r = await run([V, "--strict"], SEND); assert.strictEqual(r.code, 0); assert.strictEqual(r.posts, 1, "version pas encore annoncée : un envoi");
    down = true; r = await run([V, "--strict"], SEND); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "vérification en panne : refus"); down = false;
    r = await run([V, "--strict"], { DISCORD_WEBHOOK: SEND.DISCORD_WEBHOOK }); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "sans robot : refus");
    r = await run([V, "--strict"], { DISCORD_BOT_TOKEN: "faux" }); assert.strictEqual(r.code, 1); assert.strictEqual(r.posts, 0, "sans webhook : erreur");
    // le workflow ne part plus au push, l'essai est coché par défaut et l'étape d'essai ne reçoit aucun secret
    const wf = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "discord.yml"), "utf8");
    assert.ok(!/^\s*push:/m.test(wf), "plus de déclenchement au push");
    assert.ok(/essai:[\s\S]*?default: true/.test(wf) && /renvoyer:[\s\S]*?default: false/.test(wf) && /version:[\s\S]*?required: true/.test(wf), "champs");
    const essai = wf.slice(wf.indexOf("Essai (aucun envoi)"), wf.indexOf("Envoi sur Discord")); assert.ok(!/secrets\./.test(essai), "essai sans secret");
    console.log("post_discord.test : OK");
  })().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
});
