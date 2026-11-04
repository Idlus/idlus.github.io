/* Relais Discord du serveur OVH : transforme ce que le robot a publié (idees_ok.json, bugs_ok.json) en requêtes SQL.
   Seulement des numéros et des adresses discord.com fabriqués par le robot (rien du texte des joueurs). */
const fs = require("fs"); const W = process.argv[2] || ".";
const read = (f) => { try { return JSON.parse(fs.readFileSync(`${W}/${f}`, "utf8")); } catch (e) { return []; } };
const out = [];
read("idees_ok.json").forEach((x) => { const id = +x.id, url = String(x.url || "");
  if (Number.isInteger(id) && id > 0 && /^https:\/\/discord\.com\/channels\/[0-9]+\/[0-9]+$/.test(url)) out.push(`update public.ideas set relayed_at = now(), url = '${url}' where id = ${id} and relayed_at is null;`); });
read("bugs_ok.json").forEach((x) => { const id = +x.id, th = String(x.thread || "");
  if (Number.isInteger(id) && id > 0 && /^[0-9]{5,25}$/.test(th)) out.push(`update public.bugs set discord = '${th}' where id = ${id} and discord is null;`); });
process.stdout.write(out.join("\n") + (out.length ? "\n" : ""));
