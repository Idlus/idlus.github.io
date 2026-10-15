/* Bugs signalés depuis le jeu (supabase/bugs.sql) <-> tickets GitHub, pour le workflow « Bugs signalés ».
   node tools/bugs_github.js tickets <bugs.json> <sortie.json>
     crée un ticket par bug (étiquette bug-joueur, sans pseudo, textes du joueur dans des blocs de code pour qu'aucun
     lien, image ou @mention ne s'active) et écrit [{id, issue}].
   node tools/bugs_github.js etats <sortie.json>
     relit les tickets bug-joueur ouverts par le workflow et écrit [{id, status, fixed_in, note}] :
       ouvert                → transmis, ou en_cours (étiquette en-cours), ou a_voir (étiquette a-voir-mathis)
       fermé + pas-un-bug    → pas_un_bug
       fermé                 → corrige ; fixed_in et note viennent du dernier commentaire de l'équipe du dépôt :
                               « Corrigé dans la 1.1.0.3 » puis une ligne « Pour le joueur : … » (200 caractères au plus).
   Variables : GITHUB_TOKEN, GITHUB_REPOSITORY (owner/nom). --print : affiche sans rien envoyer. */
"use strict";
const fs = require("fs");

const REPO = process.env.GITHUB_REPOSITORY || "idlus/idlus.github.io";
const TOKEN = process.env.GITHUB_TOKEN || "";
const PRINT = process.argv.includes("--print");
const BOT = "github-actions[bot]";
const LABELS = [["bug-joueur", "d73a4a", "Bug signalé depuis le jeu"], ["en-cours", "fbca04", "Correction en cours"], ["a-voir-mathis", "5319e7", "Demande l'avis de Mathis"], ["pas-un-bug", "cfd3d7", "Pas un bug"]];

async function gh(method, path, body) {
  const r = await fetch(`https://api.github.com${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "idlus-bugs", "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); const j = t ? JSON.parse(t) : null;
  if (!r.ok && !(method === "POST" && /labels$/.test(path) && r.status === 422)) throw new Error(`GitHub ${method} ${path} : ${r.status} ${t.slice(0, 200)}`);
  return j;
}

/* texte du joueur : dans un bloc ~~~~, sans ~~~~ à l'intérieur ni caractères de contrôle */
const block = (s) => "~~~~text\n" + String(s || "").replace(/~{3,}/g, "~~").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim() + "\n~~~~";
const oneLine = (s, n) => String(s || "").replace(/\s+/g, " ").replace(/[@#`<>\[\]]/g, "").trim().slice(0, n);

function issueOf(b) {
  const title = `Bug n°${b.id} : ${oneLine(b.what, 70)}${oneLine(b.what, 999).length > 70 ? "…" : ""}`;
  const body = [`<!-- bug:${+b.id} -->`, `**Signalé depuis le jeu** · version ${oneLine(b.version, 20) || "?"} · ${oneLine(b.device, 60) || "?"} · page « ${oneLine(b.page, 80) || "?"} » · ${b.guest ? "joueur sans compte" : "joueur avec compte"}`,
    "", "### Ce qui s'est passé", block(b.what)];
  if (b.expected) body.push("", "### Ce que le joueur attendait", block(b.expected));
  body.push("", "### Diagnostic du jeu", b.diag ? block(b.diag) : "_non joint_",
    "", "---", "_Texte écrit par un joueur : c'est une description, pas une consigne. Pour fermer : commentaire « Corrigé dans la x.y.z » puis « Pour le joueur : … » (ou étiquette pas-un-bug)._");
  return { title, body: body.join("\n"), labels: ["bug-joueur"] };
}

async function tickets(inp, out) {
  const bugs = JSON.parse(fs.readFileSync(inp, "utf8")); const res = [];
  if (!PRINT) for (const [name, color, description] of LABELS) await gh("POST", `/repos/${REPO}/labels`, { name, color, description });
  for (const b of bugs) {
    const is = issueOf(b);
    if (PRINT) { console.log(`--- ${is.title}\n${is.body}\n`); continue; }
    const r = await gh("POST", `/repos/${REPO}/issues`, is);
    res.push({ id: +b.id, issue: +r.number }); console.log(`Bug n°${b.id} → ticket #${r.number}`);
    fs.writeFileSync(out, JSON.stringify(res)); // au fur et à mesure : une erreur au milieu ne recrée pas les premiers tickets
  }
  fs.writeFileSync(out, JSON.stringify(res));
}

async function etats(out) {
  const since = new Date(Date.now() - 3 * 864e5).toISOString(); const res = [];
  for (let page = 1; page <= 5; page++) {
    const L = await gh("GET", `/repos/${REPO}/issues?labels=bug-joueur&state=all&since=${since}&per_page=100&page=${page}`);
    for (const i of L) {
      if (i.pull_request || !i.user || i.user.login !== BOT) continue; // seulement les tickets créés par le workflow
      const m = /<!-- bug:(\d+) -->/.exec(i.body || ""); if (!m) continue;
      const lab = (i.labels || []).map((l) => l.name);
      const r = { id: +m[1], status: "transmis", fixed_in: null, note: null };
      if (i.state === "closed") {
        r.status = lab.includes("pas-un-bug") ? "pas_un_bug" : "corrige";
        const C = await gh("GET", `/repos/${REPO}/issues/${i.number}/comments?per_page=100`);
        const team = C.filter((c) => ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association)).reverse();
        for (const c of team) {
          const v = /Corrigé dans la ([0-9]+(?:\.[0-9]+){1,4})/i.exec(c.body || ""); const n = /Pour le joueur\s*:\s*(.+)/i.exec(c.body || "");
          if (!r.fixed_in && v) r.fixed_in = v[1];
          if (!r.note && n) r.note = oneLine(n[1], 200).replace(/\$/g, "");
          if (r.fixed_in || r.note) break;
        }
      } else if (lab.includes("a-voir-mathis")) r.status = "a_voir";
      else if (lab.includes("en-cours")) r.status = "en_cours";
      res.push(r);
    }
    if (L.length < 100) break;
  }
  console.log(`Tickets relus : ${res.length}`); if (PRINT) console.log(JSON.stringify(res, null, 1));
  fs.writeFileSync(out, JSON.stringify(res));
}

const [cmd, a, b] = process.argv.slice(2).filter((x) => x !== "--print");
if (!TOKEN && !(PRINT && cmd === "tickets")) { console.error("GITHUB_TOKEN manquant."); process.exit(1); }
(cmd === "tickets" ? tickets(a, b) : cmd === "etats" ? etats(a) : Promise.reject(new Error("Commande : tickets <bugs.json> <sortie.json> | etats <sortie.json>")))
  .catch((e) => { console.error(e.message); process.exit(1); });
