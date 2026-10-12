// Rapport du serveur : lit deux relevés des métriques Supabase (format Prometheus, pris à quelques secondes d'écart)
// et écrit en JSON la mémoire, le processeur et le disque de la machine du serveur. Aucune donnée de joueur.
// Usage : node tools/rapport_metriques.js releve1.txt releve2.txt > metriques.json
const fs = require("fs");
const lire = f => fs.readFileSync(f, "utf8").split("\n").filter(l => l && l[0] !== "#").map(l => {
  const m = l.match(/^([a-zA-Z_:][\w:]*)(\{[^}]*\})?\s+(\S+)/);
  return m && { nom: m[1], lab: m[2] || "", val: Number(m[3]) };
}).filter(Boolean);
const [a, b] = [lire(process.argv[2]), lire(process.argv[3] || process.argv[2])];
const un = (r, nom, filtre) => { const x = r.find(e => e.nom === nom && (!filtre || filtre(e.lab))); return x ? x.val : null; };
const mo = v => v == null ? null : Math.round(v / 1048576);
const pct = (x, t) => x == null || !t ? null : Math.round(1000 * x / t) / 10;
const out = {};
// Mémoire
const tot = un(b, "node_memory_MemTotal_bytes"), dispo = un(b, "node_memory_MemAvailable_bytes");
out.memoire_totale_mo = mo(tot);
out.memoire_utilisee_mo = tot != null && dispo != null ? mo(tot - dispo) : null;
out.memoire_utilisee_pourcentage = tot != null && dispo != null ? pct(tot - dispo, tot) : null;
const swT = un(b, "node_memory_SwapTotal_bytes"), swF = un(b, "node_memory_SwapFree_bytes");
out.swap_total_mo = mo(swT);
out.swap_utilise_mo = swT != null && swF != null ? mo(swT - swF) : null;
// Processeur : part du temps non « idle » entre les deux relevés
const cpus = r => r.filter(e => e.nom === "node_cpu_seconds_total");
const somme = (r, f) => cpus(r).filter(e => f(e.lab)).reduce((s, e) => s + e.val, 0);
const idle = l => /mode="idle"/.test(l), tout = () => true;
const dT = somme(b, tout) - somme(a, tout), dI = somme(b, idle) - somme(a, idle);
out.processeurs = new Set(cpus(b).map(e => (e.lab.match(/cpu="([^"]*)"/) || [])[1])).size || null;
out.processeur_utilise_pourcentage = dT > 0 ? pct(dT - dI, dT) : null;
out.charge_1_min = un(b, "node_load1");
out.charge_15_min = un(b, "node_load15");
// Disque : la plus grande partition réelle (celle de la base)
const grand = b.filter(e => e.nom === "node_filesystem_size_bytes" && !/fstype="(tmpfs|devtmpfs|overlay|squashfs)"/.test(e.lab))
  .sort((x, y) => y.val - x.val)[0];
if (grand) {
  const libre = un(b, "node_filesystem_avail_bytes", l => l === grand.lab);
  out.disque_total_mo = mo(grand.val);
  out.disque_utilise_mo = libre != null ? mo(grand.val - libre) : null;
  out.disque_utilise_pourcentage = libre != null ? pct(grand.val - libre, grand.val) : null;
}
console.log(JSON.stringify(out));
