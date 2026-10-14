// Fonction serveur « record » (Supabase Edge Function) — Idlus, multijoueur étape 3.
// Le jeu l'appelle quand un joueur connecté termine une stasis plus haute (ou plus vite).
// Elle relit la partie EN LIGNE du joueur, rejoue le donjon avec son équipe (3 tirages du hasard
// choisis par le serveur) et n'écrit le record que si l'équipe le termine vraiment.
// Le temps affiché dans les classements est le meilleur temps du serveur, pas celui annoncé par le jeu.
// Se montrer : avec { defi: palier }, elle rejoue le défi du jour (même hasard pour tous) et garde le meilleur score du jour.
// Kolizéum : avec { koli: { opps: 1, r } }, trois adversaires (le jeu calcule la chance) ; avec { koli: { fight: … } }, un combat classé.
// Guildes : avec { gboss: 1 }, un essai contre le boss de guilde de la semaine ; avec { perco: id }, une défense de Percepteur.
// 1.0.30 : avec { raid: { go | def | end: id } }, les attaques entre guildes (lancer, défendre, le Percepteur et ses gardes).
// Boss des mondes : avec { wboss: 1 }, un essai contre le boss de tout le serveur (js/wboss.js, supabase/wboss.sql).
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

  // deno-lint-ignore no-explicit-any
  let body: { did?: string; defi?: string; gboss?: number; perco?: number; koli?: any; wboss?: number; raid?: any } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
  if (body.defi) return defi(db, user.id, String(body.defi));
  if (body.gboss) return gboss(db, user.id);
  if (body.perco) return perco(db, user.id, Number(body.perco));
  if (body.koli) return koli(db, user.id, body.koli);
  if (body.raid) return raid(db, user.id, body.raid);
  if (body.wboss) return wboss(db, user.id);
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

// ---------- guildes : boss de la semaine et défense des Percepteurs (js/gboss.js) ----------
// Le combat est rejoué ici avec la partie en ligne ; supabase/gboss.sql compte les essais et les récompenses.
// deno-lint-ignore no-explicit-any
async function guildSave(db: any, uid: string, key: string) {
  const now = Date.now();
  if (now - (lastTry.get(uid + key) || 0) < 5000) return { err: json({ ok: false, err: "trop tôt", retry: 5 }, 429) };
  lastTry.set(uid + key, now);
  const [{ data: save }, { data: lad }] = await Promise.all([
    db.from("saves").select("data").eq("user_id", uid).maybeSingle(),
    db.from("ladder").select("flagged").eq("user_id", uid).maybeSingle(),
  ]);
  if (!save) return { err: json({ ok: false, err: "aucune partie en ligne" }, 404) };
  if (lad && lad.flagged) return { err: json({ ok: false, err: "en vérification" }) };
  try { const S = E.deserialize(save.data); E.events.length = 0; return { S, now }; } catch (_) { return { err: json({ ok: false, err: "partie illisible" }) }; }
}
// deno-lint-ignore no-explicit-any
async function gboss(db: any, uid: string) {
  const g = await guildSave(db, uid, ":gboss"); if (g.err) return g.err;
  const w = E.gbossWeek(g.now);
  const { data: st, error } = await db.rpc("gb_start", { p_user: uid, p_w: w });
  if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
  const def = E.gboss(w);
  const r = E.gbossSim(g.S, def, st.n, g.now, st.phase || 1); // 1.0.30 : la phase en cours (de plus en plus dure)
  if (r.err) return json({ ok: false, err: r.err });
  const lvl = Math.max(1, ...E.team(g.S).map((c: { lvl: number; ren?: number }) => (c.ren ? 200 : c.lvl)));
  const { data: done, error: e2 } = await db.rpc("gb_done", { p_user: uid, p_w: w, p_n: st.n, p_points: r.points, p_raw: r.raw, p_lvl: lvl, p_rounds: r.rounds, p_alive: r.alive });
  if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
  return json({ ok: true, gboss: true, boss: def.name, points: r.points, rounds: r.rounds, alive: r.alive, pts: done.pts, goal: done.goal, left: done.left, phase: st.phase || 1, done: done.done, tok: done.tok, every: done.every });
}
// ---------- Boss des mondes : un essai contre le boss de tout le serveur ----------
// deno-lint-ignore no-explicit-any
async function wboss(db: any, uid: string) {
  const g = await guildSave(db, uid, ":wboss"); if (g.err) return g.err;
  const { data: st, error } = await db.rpc("wb_start", { p_user: uid });
  if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
  const def = E.wbDef(st.n); const seed = E.wbSeed(st.n, uid, st.k);
  const r = E.wbSim(g.S, def, st.phase, seed, g.now);
  if (r.err) return json({ ok: false, err: r.err });
  const lvl = Math.max(1, ...E.team(g.S).map((c: { lvl: number; ren?: number }) => (c.ren ? 200 : c.lvl)));
  const { data: done, error: e2 } = await db.rpc("wb_done", { p_user: uid, p_n: st.n, p_k: st.k, p_points: r.points, p_phase: st.phase, p_lvl: lvl, p_rounds: r.rounds, p_alive: r.alive });
  if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
  return json({ ok: true, wboss: true, n: st.n, k: st.k, seed, phase: st.phase, name: def.name, points: r.points, pv: r.pv, rounds: r.rounds, alive: r.alive, fights: r.fights, watchSeed: r.watchSeed,
    grade: done.grade, frag: done.frag, cons: done.cons, dmg: done.dmg, before: done.before, hp: done.hp, killed: done.killed, left: done.left, rank: done.rank });
}
// deno-lint-ignore no-explicit-any
async function perco(db: any, uid: string, id: number) {
  const g = await guildSave(db, uid, ":perco"); if (g.err) return g.err;
  const { data: st, error } = await db.rpc("pc_start", { p_user: uid, p_id: id });
  if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
  const r = E.percoSim(g.S, st.sid, st.n, E.percoSeed(st.aid, uid), g.now);
  if (r.err) return json({ ok: false, err: r.err });
  const { data: done, error: e2 } = await db.rpc("pc_done", { p_user: uid, p_id: id, p_aid: st.aid, p_win: !!r.win });
  if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
  return json({ ok: true, perco: true, win: !!r.win, rounds: r.rounds, alive: r.alive, foes: r.foes, gxp: done.gxp || 0 });
}

// ---------- 1.0.30 : attaques entre guildes (Guerre des Percepteurs, js/gboss.js) ----------
// L'attaquant et les défenseurs se battent avec leur équipe d'arène (3 héros, celle du Kolizéum), copiée ici depuis la
// partie en ligne ; supabase/gboss.sql (rd_*) tient l'attaque, le butin, les boucliers et le classement.
// go : lancer l'attaque sur un Percepteur ; def : défendre (une fois par attaque) ; end : à la fin, le Percepteur et ses gardes.
// deno-lint-ignore no-explicit-any
async function raid(db: any, uid: string, q: any) {
  const id = Number((q && (q.go || q.def || q.end)) || 0);
  if (!(id > 0)) return json({ ok: false, err: "attaque inconnue" }, 400);
  // deno-lint-ignore no-explicit-any
  const team = (S: any) => { const A = E.koliSnap(S, E.koliState(S, Date.now()).team); return { A, heads: A.map((x: { cls: string; sex: string; head: number; lvl: number }) => ({ cls: x.cls, sex: x.sex, head: x.head, lvl: x.lvl })) }; };
  if (q.end) {
    const now = Date.now();
    if (now - (lastTry.get(uid + ":rdend") || 0) < 3000) return json({ ok: false, err: "trop tôt", retry: 3 }, 429);
    lastTry.set(uid + ":rdend", now);
    const { data: st, error } = await db.rpc("rd_end_start", { p_user: uid, p_raid: id });
    if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
    const seed = E.raidSeed(id, "perco"); const B = E.percoGuards(seed, st.lvl, st.rob);
    const r = E.koliSim(st.att, B, seed);
    const { data: done, error: e2 } = await db.rpc("rd_end_done", { p_raid: id, p_win: !!r.win, p_rounds: r.rounds });
    if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
    return json({ ok: true, raid: true, end: true, win: !!r.win, rounds: r.rounds, loot: done.loot || null });
  }
  const g = await guildSave(db, uid, ":raid"); if (g.err) return g.err;
  const T = team(g.S);
  if (!T.A.length) return json({ ok: false, err: "Choisis ton équipe d'arène (Kolizéum) : elle attaque et défend les Percepteurs." });
  if (q.go) {
    const { data: st, error } = await db.rpc("rd_open", { p_user: uid, p_perco: id, p_team: T.A, p_heads: T.heads, p_lvl: E.koliLvl(g.S) });
    if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
    return json({ ok: true, raid: true, id: st.id, ends: st.ends, zone: st.zone, g: st.g, left: st.left });
  }
  const { data: st, error } = await db.rpc("rd_def_start", { p_user: uid, p_raid: id });
  if (error || !st || st.err) return json({ ok: false, err: (st && st.err) || "serveur indisponible" });
  const seed = E.raidSeed(id, uid);
  const r = E.koliSim(T.A, st.att, seed);
  const { data: done, error: e2 } = await db.rpc("rd_def_done", { p_user: uid, p_raid: id, p_win: !!r.win, p_heads: T.heads, p_rounds: r.rounds });
  if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
  return json({ ok: true, raid: true, def: true, win: !!r.win, rounds: r.rounds, by: st.by });
}

// ---------- Kolizéum (js/koli.js) : 3 contre 3 contre l'équipe d'arène d'un autre joueur, jouée par l'IA ----------
// Le serveur copie l'équipe d'arène de la partie en ligne (elle défendra), propose 3 adversaires (Fantômes pour compléter),
// joue le combat avec un hasard qu'il choisit et tient les cotes (supabase/koli.sql).
const ghostSeed = (uid: string, w: number, n: number, r: number, slot: number) => {
  let x = 2166136261; const s = `${uid}:${w}:${n}:${r}:${slot}`;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
};
// deno-lint-ignore no-explicit-any
async function koli(db: any, uid: string, k: any) {
  const opps = !!(k && k.opps);
  const key = opps ? ":kopps" : ":kfight", wait = opps ? 2000 : 3000, now = Date.now();
  if (now - (lastTry.get(uid + key) || 0) < wait) return json({ ok: false, err: "Doucement : réessaie dans quelques secondes." }, 429);
  lastTry.set(uid + key, now);
  const [{ data: save }, { data: lad }, { data: prof }] = await Promise.all([
    db.from("saves").select("data").eq("user_id", uid).maybeSingle(),
    db.from("ladder").select("flagged").eq("user_id", uid).maybeSingle(),
    db.from("profiles").select("pseudo").eq("id", uid).maybeSingle(),
  ]);
  if (!save || !prof) return json({ ok: false, err: "aucune partie en ligne" }, 404);
  if (lad && lad.flagged) return json({ ok: false, err: "en vérification" });
  // deno-lint-ignore no-explicit-any
  let S: any;
  try { S = E.deserialize(save.data); E.events.length = 0; } catch (_) { return json({ ok: false, err: "partie illisible" }); }
  const w = E.koliWeek(now), K = E.KOLI;
  const Q = E.koliState(S, now);
  const A = E.koliSnap(S, Q.team);
  if (!A.length) return json({ ok: false, err: "Choisis ton équipe d'arène." });
  const lvl = E.koliLvl(S);
  const heads = A.map((x: { cls: string; sex: string; head: number; lvl: number }) => ({ cls: x.cls, sex: x.sex, head: x.head, lvl: x.lvl }));
  const { data: me, error } = await db.rpc("koli_team", { p_user: uid, p_w: w, p_team: A, p_lvl: lvl, p_heads: heads });
  if (error || !me) return json({ ok: false, err: "serveur indisponible" });
  const r = Math.max(0, Math.min(20, Math.round(Number(k.r) || 0)));

  if (opps) {
    const { data: list } = await db.rpc("koli_opps", { p_user: uid, p_w: w, p_cote: me.cote });
    // deno-lint-ignore no-explicit-any
    const out: any[] = (list || []).map((o: any) => ({ id: o.id, name: o.name, cote: o.cote, lvl: o.lvl, heads: o.heads, team: o.team }));
    for (let slot = out.length; slot < 3; slot++) {
      const g = E.koliGhostOpp(ghostSeed(uid, w, me.n, r, slot), E.KOLI_GHOST_D[slot], me.cote, lvl, A.length);
      out.push({ ghost: true, slot, name: g.name, cote: g.cote, lvl: g.lvl, heads: g.team.map((x: { cls: string; sex: string; head: number; lvl: number }) => ({ cls: x.cls, sex: x.sex, head: x.head, lvl: x.lvl })), team: g.team });
    }
    out.sort((a, b) => b.cote - a.cote);
    return json({ ok: true, koli: true, w, me: { cote: me.cote, n: me.n }, opps: out.map((o) => {
      const st = E.koliStakes(me.cote, o.cote, !!o.ghost);
      return { id: o.id || null, ghost: !!o.ghost, slot: o.slot, name: o.name, cote: o.cote, lvl: o.lvl, heads: o.heads, team: o.team, win: st.win, lose: st.lose }; // la chance est calculée par le jeu (20 combats d'essai)
    }) });
  }

  const f = (k && k.fight) || {};
  // deno-lint-ignore no-explicit-any
  let B: any, defId: string | null = null, defName = "", defCote = 1000, ghost: number | null = null;
  if (f.id) {
    const { data: dk } = await db.from("koli").select("user_id,team,cote,w").eq("user_id", String(f.id)).maybeSingle();
    if (!dk || !dk.team || dk.user_id === uid) return json({ ok: false, err: "Cet adversaire n'est plus là : demande-en d'autres." });
    const { data: dp } = await db.from("profiles").select("pseudo").eq("id", dk.user_id).maybeSingle();
    B = dk.team; defId = dk.user_id; defName = (dp && dp.pseudo) || "?"; defCote = dk.w < w ? E.koliSoft(dk.cote) : dk.cote;
  } else {
    const slot = Number(f.slot);
    if (!(slot >= 0 && slot < 3)) return json({ ok: false, err: "adversaire inconnu" }, 400);
    const g = E.koliGhostOpp(ghostSeed(uid, w, me.n, r, slot), E.KOLI_GHOST_D[slot], me.cote, lvl, A.length);
    B = g.team; defName = g.name; defCote = g.cote; ghost = g.seed;
  }
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  const res = E.koliSim(A, B, seed);
  const st = E.koliStakes(me.cote, defCote, ghost !== null);
  const dAtt = res.win ? st.win : -st.lose;
  const dDef = defId ? (res.win ? -Math.round(st.win * K.defLoss) : Math.round(st.lose * K.defWin)) : 0;
  const { data: done, error: e2 } = await db.rpc("koli_done", { p_user: uid, p_w: w, p_def: defId, p_ghost: ghost, p_att_name: prof.pseudo, p_def_name: defName,
    p_att_team: A, p_def_team: B, p_seed: seed, p_win: res.win, p_rounds: res.rounds, p_d_att: dAtt, p_d_def: dDef, p_def_cote: defCote });
  if (e2 || !done || done.err) return json({ ok: false, err: (done && done.err) || "serveur indisponible" });
  return json({ ok: true, koli: true, id: done.id, win: res.win, seed, A, B, rounds: res.rounds, hpA: res.hpA, hpB: res.hpB, delta: dAtt, cote: done.cote, rank: done.rank,
    opp: { name: defName, cote: defCote, ghost: ghost !== null, seed: ghost, id: defId } });
}
