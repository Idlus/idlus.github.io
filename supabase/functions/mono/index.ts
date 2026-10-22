// Fonction serveur « mono » (Supabase Edge Function) — Bouclier Monocompte (plan directeur, étape 5).
// Séparée de « record » : le Classique ne change pas. Déployée à la main avec supabase/monocompte.sql (jamais par le workflow).
// - { push: { data, meta, version, device, expected, force } } : envoi de la partie Monocompte (même logique que mono_push),
//   puis vérification tout de suite ; la réponse dit si la partie est devenue la « dernière partie validée ».
// - { verif: 1 } : vérifie la dernière partie envoyée.
// Vérification (js/verify_mono.js, V.mono.verifier) : impossible (un héros, Dofus, spécialités, plafonds de la date de saison,
// objets numérotés, copie du registre des Éclats, renfort d'un ami = copie rendue par le serveur), puis gains depuis la dernière partie validée (rythmes du Classique, partie
// reculée, défis). Acceptée : mono.parties_ok (résumé calculé ici), bons de butin, défis payés, mono.apres_validation.
// Refusée : notée pour le panel de Mathis (mono_adm_bouclier), la partie validée ne change pas.
// - { bureau: { combat: id } } : Bureau des Aventuriers, combat de groupe en direct (supabase/mono_bureau.sql, js/bureau_combat.js) :
//   photos des héros tirées de leurs parties validées (jamais envoyées par le jeu), graine de la base, combat joué ici,
//   résultat enregistré par la base (butin, clés, bons, défis). Un seul calcul par combat (verrou dans la base).
// La base ne laisse appeler les fonctions mono_srv_* qu'au rôle service_role (cette fonction).
// game.js est assemblé par tools/build_server.js (moteur du Classique + Monocompte + js/verify_mono.js).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { E, V } from "./game.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, err: "méthode refusée" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json({ ok: false, err: "non connecté" }, 401);
  // deno-lint-ignore no-explicit-any
  let body: { push?: any; verif?: number; bureau?: any } = {};
  try { body = await req.json(); } catch (_) { /* corps vide */ }
  if (body.push) {
    const p = body.push;
    if (typeof p.data !== "string") return json({ ok: false, err: "partie manquante" }, 400);
    const { data: at, error } = await db.rpc("mono_srv_push", { p_user: user.id, p_data: p.data, p_meta: p.meta || {}, p_version: String(p.version || ""), p_device: String(p.device || ""), p_expected: p.expected || null, p_force: !!p.force });
    if (error) return json({ ok: false, err: error.message || "erreur" });
    if (!at) return json({ ok: true, at: null }); // conflit entre deux appareils : rien d'écrit, rien à vérifier
    let verif: Record<string, unknown>;
    try { verif = await validate(db, user.id); } catch (_) { verif = { ok: false, err: "vérification impossible" }; }
    return json({ ok: true, at, verif });
  }
  if (body.verif) { try { return json(await validate(db, user.id)); } catch (_) { return json({ ok: false, err: "vérification impossible" }); } }
  if (body.bureau) { try { return json(await bureau(db, user.id, body.bureau)); } catch (_) { return json({ ok: false, err: "combat impossible" }); } }
  return json({ ok: false, err: "demande inconnue" }, 400);
});

// deno-lint-ignore no-explicit-any
async function validate(db: any, uid: string): Promise<Record<string, unknown>> {
  const { data: st, error } = await db.rpc("mono_srv_etat", { p_user: uid });
  if (error || !st) return { ok: false, err: "serveur indisponible" };
  if (st.err) return { ok: false, err: st.err };
  if (!st.partie) return { ok: false, err: "aucune partie en ligne" };
  if (st.susp) return { ok: false, err: "compte suspendu" };
  const ok = st.ok;
  if (ok && ok.src_at === st.partie.at) return { ok: true, same: true };
  const prev = ok ? { bilan: ok.bilan, res: ok.res, at: ok.src_ms } : null;
  const s = st.saison || {};
  const r = V.mono.verifier(E, st.partie.data, {
    prev, at: st.partie.ms, admin: !!st.admin, accept: !!(ok && ok.accept), ops: st.ops || [], reg: st.reg,
    ctx: { debut: s.debut, date: s.date, objets: st.objets || {}, sortis: st.sortis || [], renforts: st.renforts || [], opMax: st.op_max, opsK: st.ops_k }, // renforts : copies rendues par mono_renfort_prendre
  });
  E.setClock(null); // la vérification a réglé l'horloge du moteur sur la date de saison
  if (!r.ok) {
    await db.rpc("mono_srv_refus", { p_user: uid, p_why: r.why });
    return { ok: false, held: true };
  }
  if (r.note) await db.rpc("mono_srv_refus", { p_user: uid, p_why: "[observation] " + r.note }); // 22/10 : nouveaux plafonds, 48 h sans refuser
  const { data: v, error: e2 } = await db.rpc("mono_srv_valider", { p_user: uid, p_src_at: st.partie.at, p_resume: r.resume, p_bilan: r.bilan, p_res: r.res, p_acts: r.acts });
  if (e2 || !v) return { ok: false, err: "écriture impossible" };
  if (v.err) return { ok: false, err: v.err };
  return { ok: true, registre: v, bons: v.bons, payes: v.payes };
}

// Bureau des Aventuriers : joue le combat de groupe une seule fois (la base verrouille le combat ; les autres appels attendent)
// deno-lint-ignore no-explicit-any
async function bureau(db: any, uid: string, b: any): Promise<Record<string, unknown>> {
  const id = Number(b && b.combat);
  if (!(id > 0)) return { ok: false, err: "combat inconnu" };
  const { data: ph, error } = await db.rpc("mono_srv_bureau_photos", { p_user: uid, p_combat: id });
  if (error || !ph) return { ok: false, err: "serveur indisponible" };
  if (ph.err) return { ok: false, err: ph.err };
  if (ph.deja || ph.attente) return { ok: true, deja: !!ph.deja, attente: !!ph.attente, combat: id };
  const t0 = Date.now();
  // deno-lint-ignore no-explicit-any
  let r: any;
  try { r = E.BUREAU.combat(V.mono, ph.membres || [], String(ph.did), Number(ph.stasis), Number(ph.seed), Number(ph.at)); } catch (_) { r = { err: "combat impossible" }; }
  // deno-lint-ignore no-explicit-any
  if (r.err) r = { exclus: (ph.membres || []).map((m: any) => ({ user: m.user, why: r.err })) };
  const { data: v, error: e2 } = await db.rpc("mono_srv_bureau_resultat", {
    p_combat: id, p_snaps: r.snaps || null, p_result: r.R ? JSON.stringify(r.R) : null, p_duree_ms: r.duree == null ? null : r.duree, p_cle: r.cle || null, p_exclus: r.exclus || [],
  });
  if (e2 || !v) return { ok: false, err: "écriture impossible" };
  return Object.assign({ ms: Date.now() - t0 }, v);
}
