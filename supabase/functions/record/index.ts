// Fonction serveur « record » (Supabase Edge Function) — Idlus, multijoueur étape 3.
// Le jeu l'appelle quand un joueur connecté termine une stasis plus haute (ou plus vite).
// Elle relit la partie EN LIGNE du joueur, rejoue le donjon avec son équipe (3 tirages du hasard
// choisis par le serveur) et n'écrit le record que si l'équipe le termine vraiment.
// Le temps affiché dans les classements est le meilleur temps du serveur, pas celui annoncé par le jeu.
// Se montrer : avec { defi: palier }, elle rejoue le défi du jour (même hasard pour tous) et garde le meilleur score du jour.
// game.js est assemblé par tools/build_server.js au déploiement.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { D, E, V } from "./game.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const TRIES = 3, WAIT_S = 10;
const lastTry = new Map<string, number>(); // anti-rafale (par instance)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, err: "méthode refusée" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json({ ok: false, err: "non connecté" }, 401);

  let body: { did?: string; defi?: string } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
  if (body.defi) return defi(db, user.id, String(body.defi));
  const did = String(body.did || "");
  const dg = D.DUNGEONS[did];
  if (!dg) return json({ ok: false, err: "donjon inconnu" }, 400);
  const now = Date.now();
  if (now - (lastTry.get(user.id) || 0) < WAIT_S * 1000) return json({ ok: false, err: "trop tôt", retry: WAIT_S }, 429);
  lastTry.set(user.id, now);

  const [{ data: save }, { data: lad }, { data: prof }] = await Promise.all([
    db.from("saves").select("data").eq("user_id", user.id).maybeSingle(),
    db.from("ladder").select("flagged").eq("user_id", user.id).maybeSingle(),
    db.from("profiles").select("pseudo").eq("id", user.id).maybeSingle(),
  ]);
  if (!save || !prof) return json({ ok: false, err: "aucune partie en ligne" }, 404);
  if (lad && lad.flagged) return json({ ok: false, err: "en vérification" });

  // stasis la plus haute terminée dans la partie en ligne
  let k = 0;
  try { const S = E.deserialize(save.data); k = ((S.stasis || {})[did] || {}).max || 0; } catch (_) { return json({ ok: false, err: "partie illisible" }); }
  if (k < 1) return json({ ok: false, err: "aucune stasis terminée dans ce donjon" });

  let best: number | null = null, why = "";
  for (let i = 0; i < TRIES; i++) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const r = V.replay(E, save.data, did, k, seed, now);
    if (r.ok && (best === null || r.t < best)) best = r.t; else if (!r.ok) why = r.err;
  }
  if (best === null) return json({ ok: false, k, err: why || "l'équipe ne termine pas cette stasis" });

  const better = (o: { k: number; t: number } | null) => !o || k > o.k || (k === o.k && best! < o.t);
  const out: Record<string, unknown> = { ok: true, did, dname: dg.name, k, t: best };

  const { data: old } = await db.from("records").select("k,t").eq("user_id", user.id).eq("did", did).maybeSingle();
  if (better(old)) { await db.from("records").upsert({ user_id: user.id, did, dname: dg.name, k, t: best, at: new Date(now).toISOString() }); out.improved = true; }
  const { count: ahead } = await db.from("lb_records").select("user_id", { count: "exact", head: true }).eq("did", did).or(`k.gt.${k},and(k.eq.${k},t.lt.${best})`);
  out.rank = (ahead || 0) + 1;
  // nouveau numéro 1 du donjon : annoncé dans le chat
  if (out.improved && out.rank === 1) {
    const { data: l } = await db.from("ladder").select("main,main_lvl,flagged").eq("user_id", user.id).maybeSingle();
    if (l && !l.flagged) await db.from("chat_msgs").insert({ ch: "g", user_id: user.id, pseudo: prof.pseudo, cls: l.main, lvl: l.main_lvl, kind: "ann", data: { t: "top1", did, dname: dg.name, k, sec: best } });
  }

  // donjon de la semaine
  const w = V.weekIdx(now);
  const wk = V.weeklyDungeons(D.DUNGEONS, w).find((x: { did: string }) => x.did === did);
  if (wk) {
    const { data: oldw } = await db.from("records_week").select("k,t").eq("user_id", user.id).eq("w", w).eq("did", did).maybeSingle();
    if (better(oldw)) { await db.from("records_week").upsert({ user_id: user.id, w, did, dname: dg.name, bracket: wk.bracket, k, t: best, at: new Date(now).toISOString() }); out.weekImproved = true; }
    const { count: aheadW } = await db.from("records_week").select("user_id", { count: "exact", head: true }).eq("w", w).eq("did", did).or(`k.gt.${k},and(k.eq.${k},t.lt.${best})`);
    out.week = true; out.weekRank = (aheadW || 0) + 1;
  }

  // les « Premiers » : stasis 10
  if (k === 10) {
    const { error } = await db.from("firsts").insert({ kind: "s10", key: did, label: `Premier en stasis 10 : ${dg.name}`, user_id: user.id, pseudo: prof.pseudo, at: new Date(now).toISOString() });
    if (!error) out.first = true;
  }
  return json(out);
});

// ---------- défi du jour (lot « Se montrer ») ----------
// Le défi est tiré de la date (heure de Paris) : le serveur le rejoue avec la partie en ligne du joueur.
// Le score officiel est celui du serveur : moins de tours, puis plus de PV.
// deno-lint-ignore no-explicit-any
async function defi(db: any, uid: string, tier: string) {
  const now = Date.now();
  if (!E.defiTier(tier)) return json({ ok: false, err: "palier inconnu" }, 400);
  if (now - (lastTry.get(uid + ":defi") || 0) < WAIT_S * 1000) return json({ ok: false, err: "trop tôt", retry: WAIT_S }, 429);
  lastTry.set(uid + ":defi", now);
  const [{ data: save }, { data: lad }] = await Promise.all([
    db.from("saves").select("data").eq("user_id", uid).maybeSingle(),
    db.from("ladder").select("flagged").eq("user_id", uid).maybeSingle(),
  ]);
  if (!save) return json({ ok: false, err: "aucune partie en ligne" }, 404);
  if (lad && lad.flagged) return json({ ok: false, err: "en vérification" });
  let S;
  try { S = E.deserialize(save.data); } catch (_) { return json({ ok: false, err: "partie illisible" }); }
  E.events.length = 0;
  if (!E.defiTierOk(S, tier)) return json({ ok: false, err: "palier interdit pour cette équipe" });
  const day = E.defiDay(now), def = E.defi(tier, day);
  const r = E.defiSim(S, def, now);
  if (!r.win) return json({ ok: false, tier, day, err: "l'équipe ne termine pas le défi" });
  const team = E.team(S).map((c: { cls: string }) => c.cls);
  const { data: old } = await db.from("defi").select("turns,hp").eq("user_id", uid).eq("day", day).eq("tier", tier).maybeSingle();
  const out: Record<string, unknown> = { ok: true, defi: true, tier, day, did: def.did, dname: D.DUNGEONS[def.did].name, turns: r.turns, hp: r.hp };
  if (!old || r.turns < old.turns || (r.turns === old.turns && r.hp > old.hp)) {
    await db.from("defi").upsert({ user_id: uid, day, tier, did: def.did, turns: r.turns, hp: r.hp, team, at: new Date(now).toISOString() });
    out.improved = true;
  }
  const { count: ahead } = await db.from("lb_defi").select("user_id", { count: "exact", head: true }).eq("day", day).eq("tier", tier).or(`turns.lt.${r.turns},and(turns.eq.${r.turns},hp.gt.${r.hp})`);
  out.rank = (ahead || 0) + 1;
  return json(out);
}
