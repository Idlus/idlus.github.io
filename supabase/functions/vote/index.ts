// Fonction serveur « vote » (Supabase Edge Function) — récompense de vote sur Dofus Fan Games (02/11/2026).
// Le jeu l'appelle quand le joueur clique « Récupérer ma récompense » ({ claim: 1 }).
// 1. Le joueur doit être connecté (jeton du compte).
// 2. Son adresse IP est lue dans X-Forwarded-For : Caddy (tools/serveur/Caddyfile) la pose, puis la passerelle ajoute la sienne.
//    On garde la DERNIÈRE adresse publique de la liste : une adresse inventée par le joueur en tête de liste est ignorée.
// 3. On demande à https://dofusfangames.com/api/v1/servers/<clé>/votes/<ip> si elle a voté (200 = oui, 404 = non).
//    La clé reste sur le serveur (table vote_cfg, supabase/vote.sql) : jamais envoyée au jeu.
// 4. vote_srv_claim (supabase/vote.sql) décide : un vote = une récompense, une par compte toutes les 55 minutes,
//    puis envoie kamas et Sablier par l'hôtel de vente (hdv_ops). On ne garde qu'une empreinte salée de l'adresse.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const API = "https://dofusfangames.com/api/v1/servers/";
const WAIT_S = 15;
const lastTry = new Map<string, number>(); // anti-rafale (par instance) : le site accepte 120 appels par minute avec notre clé

// Adresse privée, locale ou de réseau interne (Docker…) : ce n'est pas celle du joueur.
export function privee(ip: string): boolean {
  const a = ip.toLowerCase();
  if (a.includes(":")) return a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80") || a === "::" || a.startsWith("::ffff:10.") || a.startsWith("::ffff:127.") || a.startsWith("::ffff:192.168.") || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(a);
  const p = a.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return true; // illisible : on n'en veut pas
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
}
// Dernière adresse publique de X-Forwarded-For (puis X-Real-IP en secours).
export function ipJoueur(xff: string | null, real: string | null): string | null {
  const L = String(xff || "").split(",").map((s) => s.trim().replace(/^\[|\](:\d+)?$/g, "").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1")).filter(Boolean);
  for (let i = L.length - 1; i >= 0; i--) if (!privee(L[i])) return L[i].replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");
  const r = String(real || "").trim();
  return r && !privee(r) ? r : null;
}
async function empreinte(sel: string, ip: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sel + "|" + ip));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, err: "méthode refusée" }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who } = await db.auth.getUser(jwt);
  const user = who && who.user;
  if (!user) return json({ ok: false, err: "Connecte-toi à ton compte pour récupérer la récompense de vote." }, 401);

  const now = Date.now();
  if (now - (lastTry.get(user.id) || 0) < WAIT_S * 1000) return json({ ok: false, err: "Doucement : réessaie dans quelques secondes." });
  lastTry.set(user.id, now);

  const { data: cfg, error: e0 } = await db.rpc("vote_srv_cfg");
  if (e0 || !cfg || !cfg.cle || !cfg.actif) return json({ ok: false, err: "La récompense de vote n'est pas encore ouverte." });
  const ip = ipJoueur(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip"));
  if (!ip) return json({ ok: false, err: "Impossible de lire ton adresse pour le moment." });

  let st = 0, body: { success?: boolean; data?: { voted_at?: number; next_vote_seconds?: number } } = {};
  try {
    const r = await fetch(API + encodeURIComponent(cfg.cle) + "/votes/" + encodeURIComponent(ip), { signal: AbortSignal.timeout(6000) });
    st = r.status; try { body = await r.json(); } catch (_) { /* réponse vide */ }
  } catch (_) { return json({ ok: false, err: "Dofus Fan Games ne répond pas : réessaie dans un moment." }); }
  if (st === 404) return json({ ok: false, novote: true, err: "Aucun vote trouvé depuis ta connexion. Vote d'abord, depuis le même appareil et le même réseau (Wi-Fi ou 4G) que le jeu." });
  if (st === 429) return json({ ok: false, err: "Beaucoup de joueurs votent en même temps : réessaie dans une minute." });
  if (st !== 200 || !body.success || !body.data || !(Number(body.data.voted_at) > 0)) return json({ ok: false, err: "Vérification du vote impossible pour le moment." });

  const { data: v, error: e1 } = await db.rpc("vote_srv_claim", { p_user: user.id, p_ip: await empreinte(String(cfg.sel), ip), p_voted_at: Math.floor(Number(body.data.voted_at)) });
  if (e1 || !v) return json({ ok: false, err: "Écriture impossible : réessaie dans un moment." });
  const next = Math.max(0, Math.floor(Number(body.data.next_vote_seconds) || 0));
  if (v.err) return json({ ok: false, err: v.err });
  if (v.deja) return json({ ok: false, deja: true, next, err: "Ce vote a déjà été récompensé. Tu pourras revoter dans " + Math.max(1, Math.ceil(next / 60)) + " min." });
  if (v.attente) return json({ ok: false, attente: v.attente, err: "Une récompense par heure : la prochaine dans " + Math.max(1, Math.ceil(Number(v.attente) / 60)) + " min." });
  return json({ ok: true, k: v.k, sab: v.sab, next });
});
