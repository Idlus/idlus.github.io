/* ============================================================================
   EN LIGNE — Idlus (multijoueur, étape 2 : comptes et sauvegarde en ligne)
   Connexion (Discord ou lien par e-mail), pseudo, envoi et récupération de la partie
   sur le serveur (Supabase). Pas de DOM ici : l'interface est dans ui.js.
   L'adresse du projet et la clé « publishable » sont publiques par nature : elles servent
   seulement à joindre le serveur, dont les règles (supabase/schema.sql) ne laissent chaque
   joueur lire et écrire que sa propre partie.
   ========================================================================== */
(function (root) {
  "use strict";
  /* Un seul monde en ligne : le jeu public (décision de Mathis, 12/10). Il reprend le serveur que la
     version de test utilisait (comptes, guildes, Hôtel de vente, classements gardés). La version de
     test (/beta/) n'a plus de serveur, sinon ses parties se mélangeraient à celles du public.
     mail = connexion par e-mail proposée (coupée tant qu'il n'y a pas de vrai service d'envoi d'e-mails). */
  /* slots = parties 2 et 3 gardées en ligne (tools/emplacements.sql, à passer dans supabase/). Tant qu'il n'est pas appliqué sur
     le serveur (accord écrit de Mathis), les parties 2 et 3 restent sur l'appareil. */
  const SERVERS = {
    /* 14/10/2026 : déménagement sur le serveur OVH de Mathis (Supabase auto-hébergé, tools/serveur/). La clé « anon » est publique
       par nature (https://159-173-129-109.sslip.io/cle-publique). */
    public: { url: "https://159-173-129-109.sslip.io", key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkxOTM0NDE5LCJleHAiOjE5NDk2MTQ0MTl9.1iCHQ2UlFSeE2G9IkUjKk47KuG-469_M1wXINPv5Mbc", mail: false, slots: false, mono: true, s1: true, gr: true, mb: true }, // mb : builds du Monocompte (supabase/mono_builds.sql), installés le 04/11 (2.2.4.2)
    beta: { url: "", key: "", mail: false, slots: false, mono: false }
  };
  const ON = {};
  /* Session de l'ancien serveur gardée sur l'appareil : le joueur doit se reconnecter une fois sur le nouveau (message à l'écran de choix). */
  const OLD_TOKEN = "sb-bolbuxuxydfslwpfbfff-auth-token";
  const lib = root.__IDLUS_SB || (root.supabase && root.supabase.createClient ? root.supabase : null); // __IDLUS_SB : faux serveur des tests
  /* 1.0.8.2 : « partie de test » du jeu public (compte admin) : le jeu tourne sans serveur, comme la bêta, sur une
     sauvegarde séparée. Rien n'est envoyé en ligne et la vraie partie n'est pas touchée. */
  const TM = (() => { try { return root.localStorage.getItem("idlus-partie-test") === "1"; } catch (e) { return false; } })();
  ON.world = /\/beta\//.test(root.location ? root.location.pathname : "") || TM ? "beta" : "public";
  /* mono = espace Monocompte du serveur (supabase/monocompte.sql, amis.sql, mono_social.sql, mono_bureau.sql, mono_cles.sql et la
     fonction « mono », installés à la main) : actif depuis la bêta 2.1.35. L'accès à la partie 4 passe par le serveur (mono_acces :
     testeurs et clés bêta) ; mono: false remet la partie Monocompte sur l'appareil, sans aucun appel mono_. */
  const SRV = root.__IDLUS_SB && !TM ? { url: "test", key: "test", mail: true, slots: !root.__IDLUS_NOSLOTS, mono: !root.__IDLUS_NOMONO, mb: !root.__IDLUS_NOMONO, s1: !!root.__IDLUS_S1 } : SERVERS[ON.world];
  const URL_ = SRV.url, KEY_ = SRV.key;
  ON.enabled = !!lib && !!URL_ && !root.__IDLUS_OFFLINE; // __IDLUS_OFFLINE : test de démarrage sans serveur
  ON.mail = SRV.mail;
  let sb = null, KEY = "dofousxen-save", VER = "";
  ON.user = null; ON.profile = null;
  /* 1.0.11 : trois parties par appareil et par compte (écran « Choisis ta partie »). La partie 1 est celle du
     compte (table saves) : elle porte les classements, la course, l'Hôtel de vente, la guilde, le Kolizéum classé et
     le boss des mondes, que le serveur vérifie avec elle. Les parties 2 et 3 se jouent en solo. */
  let SLOT = 1;
  const MONO_N = 4;
  /* Saison 1, lot 0b (Mathis 03/11 : « Un espace de saison ») : partie 5 = Classique · Saison 1. Elle se joue comme la partie 1
     (classements, HdV, guilde, Bouclier), mais dans l'espace « s1 » du serveur (supabase/saison1.sql, js/saison1_srv.js) :
     même compte, tout repart de zéro. s1: false tant que l'espace n'est pas installé (accord écrit de Mathis). */
  const S1_N = 5;
  ON.S1_N = S1_N;
  ON.s1Srv = !!SRV.s1;
  ON.grSrv = !!SRV.gr; // Saison 1, lot 3 : chat_send accepte la couleur du pseudo (supabase/chat.sql)
  ON.s1Game = () => SLOT === S1_N;
  const S1_SET = new Set(root.S1_OBJ || []);
  ON.s1Obj = (name) => S1_SET.has(name);
  ON.slot = () => SLOT;
  ON.solo = () => SLOT !== 1 && SLOT !== S1_N;
  ON.slotsOk = !!SRV.slots;
  /* ---------- espace Monocompte (supabase/monocompte.sql : étape 4 et registre des Éclats du Temps, 6b) ----------
     ON.mono : réponse de mono_acces ({ ok, saison, date, jour, semaine, manche }) ; ON.monoCosm : droits cosmétiques partagés
     du compte (cosm_mine), au format des titres et apparences gardés d'une saison à l'autre ({ t, u }). Hors connexion, sans
     serveur Monocompte, ou pour un compte non autorisé : null, et tout reste sur l'appareil comme avant. */
  ON.monoSrv = !!SRV.mono;
  ON.mbSrv = !!(SRV.mono && SRV.mb); // 2.2.4.1 : page Builds du Monocompte (fonctions mono_builds_*, mono_build_*)
  ON.mono = null; ON.monoCosm = null;
  ON.monoOn = () => !!(ON.monoSrv && sb && ON.user && ON.mono && ON.mono.ok && ON.mono.saison && (ON.mono.saison.etat || "ouverte") === "ouverte");
  /* 6a : HdV de saison et échanges du Monocompte (fonctions mono_hdv_* et mono_trade_* du serveur), partie Monocompte en ligne seulement */
  ON.monoMarket = () => SLOT === MONO_N && ON.monoOn();
  ON.cosmLegacy = (rows) => ({ t: rows.filter((r) => /^titre:/.test(r.cle)).map((r) => r.cle.slice(6)), u: rows.filter((r) => !/^titre:/.test(r.cle)).map((r) => r.cle) });
  ON.monoCheck = async () => {
    ON.mono = null; ON.monoCosm = null;
    if (!ON.monoSrv || !sb || !ON.user) return null;
    try {
      const { data, error } = await withTimeout(R("mono_acces"), 8000); if (error || !data) return null;
      ON.mono = data; ON.monoAt = Date.now();
      if (data.ok) { const c = await withTimeout(R("cosm_mine"), 8000); if (!c.error && Array.isArray(c.data)) ON.monoCosm = ON.cosmLegacy(c.data); }
    } catch (e) { /* hors ligne : la partie Monocompte reste sur l'appareil */ }
    return ON.mono;
  };
  ON.cosmRefresh = async () => { if (!ON.monoOn()) return null; const r = await rpc("cosm_mine"); if (!r.err && Array.isArray(r.data)) ON.monoCosm = ON.cosmLegacy(r.data); return ON.monoCosm; };
  // registre des Éclats du Temps : le serveur tient le solde et le quota ; chaque réponse renvoie l'état du registre
  ON.tfEtat = () => rpc("mono_eclats_etat");
  // 6a : les Éclats d'activité ne s'envoient plus : le serveur crée les bons de butin d'après la partie validée par le Bouclier
  ON.tfDefi = (id, palier) => rpc("mono_eclats_defi", { p_defi: id, p_palier: palier });
  ON.tfAchat = (obj, saison) => rpc("mono_boutique_achat", saison != null ? { p_objet: obj, p_saison: saison } : { p_objet: obj });
  /* 4 : partie Monocompte, en ligne seulement pour un compte autorisé (testeur ou admin) quand une saison est ouverte ;
     101… : Éternel, sur l'appareil (le serveur le garde en lecture seule après la fin de saison) */
  ON.slotOnline = (n) => { n = n || SLOT; return n === 1 || (n < 4 && ON.slotsOk) || (n === MONO_N && ON.monoOn()) || (n === S1_N && ON.s1Srv); };
  ON.setSlot = (n, key) => { SLOT = n; KEY = key; };
  /* 2.1.37.x « Monocompte étanche » : partie Monocompte (4), de l'Éternel (101, 102…) ou partie affichée du Monocompte. Rien du
     serveur Classique n'y entre ni n'en sort (voir CLASSIC_RPC plus bas) */
  ON.monoPart = () => { if (SLOT === MONO_N || SLOT > 100) return true; try { const s = root.DX && root.DX.S; return !!(s && s.mono); } catch (e) { return false; } };
  const CLASSIC_ERR = "Réservé au serveur Classique : ta partie Monocompte n'y prend pas part.";
  ON.CLASSIC_ERR = CLASSIC_ERR;
  const SOLO_ERR = "Partie solo : les classements, le Kolizéum classé, l'Hôtel de vente, la guilde et les boss se jouent avec ta partie 1.";
  ON.SOLO_ERR = SOLO_ERR;

  /* ---------- état affiché dans la pastille ----------
     anon : pas connecté · ok : partie à jour en ligne · sync : envoi en cours
     offline : pas de réseau (le jeu continue) · conflict : deux versions à départager */
  ON.state = "anon"; ON.lastPush = 0;
  const subs = [];
  ON.onChange = (f) => subs.push(f);
  const setState = (s) => { if (ON.state === s) return; ON.state = s; subs.forEach((f) => { try { f(s); } catch (e) {} }); };
  ON.setState = setState;

  /* ---------- lien entre la partie de l'appareil et le compte ----------
     { uid, base, savedAt, skip } : base = date de la version en ligne connue, savedAt = moment de la
     partie (S.savedAt) au dernier envoi ou à la dernière récupération, skip = « jouer sans compte ». */
  const lkKey = () => KEY + "-online";
  ON.link = () => { try { return JSON.parse(root.localStorage.getItem(lkKey()) || "{}") || {}; } catch (e) { return {}; } };
  ON.setLink = (p) => { const l = Object.assign(ON.link(), p); try { root.localStorage.setItem(lkKey(), JSON.stringify(l)); } catch (e) {} return l; };
  ON.linkOf = (key) => { try { return JSON.parse(root.localStorage.getItem(key + "-online") || "{}") || {}; } catch (e) { return {}; } };
  ON.clearLink = () => { const skip = ON.link().skip; try { root.localStorage.setItem(lkKey(), JSON.stringify(skip ? { skip } : {})); } catch (e) {} };

  ON.device = () => /Mobi|Android|iPhone|iPad/i.test((root.navigator && root.navigator.userAgent) || "") ? "téléphone" : "ordinateur";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("délai dépassé")), ms || 9000))]);
  const offlineErr = (e) => !e || /fetch|network|délai|Failed|Load failed/i.test(String(e.message || e));

  ON.init = (o) => {
    KEY = o.key; VER = o.version;
    if (!ON.enabled || sb) return;
    sb = lib.createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    sb.auth.onAuthStateChange((ev, session) => {
      ON.user = session ? session.user : null; if (!ON.user) setState("anon");
      if (ev === "TOKEN_REFRESHED") renewed(session);
    });
  };
  /* 1.0.29.6 : garde-fou contre une connexion qui se renouvelle en boucle. Si l'heure de l'appareil est fausse (une heure d'avance
     ou plus), la bibliothèque croit le jeton toujours expiré et le renouvelle à chaque appel au serveur : le 14/10, une seule
     session le faisait 3 fois par seconde (12 000 renouvellements par heure, +11 Mo par heure dans la base). Au-delà de 20
     renouvellements en une minute (normalement un par heure), la connexion est fermée sur cet appareil et le joueur prévenu ;
     la partie reste sur l'appareil. ON.onLoop(texte) : message affiché par l'interface. */
  /* 2.2.4.6 (04/11, sessions en boucle du matin) : le garde-fou comptait avec l'horloge de l'appareil. Un logiciel qui accélère
     le temps du navigateur (Date, chronomètre et minuteries ensemble) étirait sa minute : 270 renouvellements par vraie minute
     n'en faisaient que quelques-uns par « minute » de l'appareil, et la session a tourné des heures (16 000 par heure). On compte
     maintenant avec l'heure du serveur portée par chaque jeton (expires_at - expires_in, à l'émission), que l'appareil ne peut
     pas accélérer : plus de 20 renouvellements en 60 s du serveur, ou plus de 40 en 30 min, coupent la session. */
  let renewals = [], looping = false;
  const srvSec = (session) => session && +session.expires_at > 0 && +session.expires_in > 0 ? +session.expires_at - +session.expires_in : Date.now() / 1000;
  const renewed = (session) => {
    const t = srvSec(session); renewals = renewals.filter((x) => t - x < 1800 && x - t < 1800); renewals.push(t);
    const minute = renewals.filter((x) => t - x < 60).length;
    if ((minute <= 20 && renewals.length <= 40) || looping) return;
    looping = true; renewals = [];
    // hors du rappel de la bibliothèque : y appeler signOut directement la bloquerait
    setTimeout(() => stopLoop(session).finally(() => { looping = false; }), 0);
  };
  const stopLoop = async (session) => {
    // avance de l'horloge de l'appareil = maintenant - heure d'émission du jeton par le serveur (expires_at - expires_in)
    const min = session && session.expires_at && session.expires_in ? Math.round((Date.now() / 1000 - (session.expires_at - session.expires_in)) / 60) : 0;
    const avance = min >= 120 ? `${Math.round(min / 60)} h` : `${min} min`;
    const txt = min >= 30 ? `Connexion en ligne coupée : l'heure de ton appareil a environ ${avance} d'avance, ce qui la faisait tourner en boucle. Règle l'heure en automatique puis reconnecte-toi. Ta partie est gardée.`
      : "Connexion en ligne coupée : elle se renouvelait en boucle. Reconnecte-toi, et vérifie l'heure de ton appareil si ça recommence. Ta partie est gardée.";
    try { await sb.auth.stopAutoRefresh(); } catch (e) {}
    try { await withTimeout(sb.auth.signOut({ scope: "local" }), 5000); } catch (e) {} // ferme cette session seulement (les autres appareils restent connectés)
    // 2.2.4.6 : si la déconnexion n'a pas abouti (serveur lent, minuteries faussées), la session est quand même retirée de
    // l'appareil : la bibliothèque la relit à chaque appel, elle ne peut donc plus se renouveler
    try { const ref = (/^https:\/\/([^.]+)\./.exec(URL_) || [])[1]; if (ref) root.localStorage.removeItem("sb-" + ref + "-auth-token"); } catch (e) {}
    ON.user = null; ON.profile = null; setState("anon");
    if (ON.onLoop) { try { ON.onLoop(txt); } catch (e) {} }
  };
  /* Erreur de connexion renvoyée dans l'adresse (lien e-mail expiré…). */
  ON.urlError = () => {
    const m = /[#&?]error_description=([^&]+)/.exec((root.location && (root.location.hash + root.location.search)) || "");
    if (!m) return null;
    try { root.history.replaceState(null, "", root.location.pathname); } catch (e) {}
    const t = decodeURIComponent(m[1].replace(/\+/g, " "));
    return /expired|invalid/i.test(t) ? "Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau." : t;
  };
  /* Session déjà ouverte sur cet appareil (lue sans réseau). */
  ON.ready = async () => {
    if (!sb) return null;
    try { const { data } = await withTimeout(sb.auth.getSession(), 6000); ON.user = data && data.session ? data.session.user : null; } catch (e) { ON.user = null; }
    /* 1.0.10.6 : session gardée sur l'appareil mais serveur muet (jeton à renouveler pendant une panne) : ce n'est pas une déconnexion */
    ON.stuck = false;
    try { if (ON.user) root.localStorage.removeItem(OLD_TOKEN); ON.moved = !ON.user && !!root.localStorage.getItem(OLD_TOKEN); } catch (e) { ON.moved = false; }
    if (!ON.user) { try { const ref = (/^https:\/\/([^.]+)\./.exec(URL_) || [])[1]; ON.stuck = !!(ref && root.localStorage.getItem("sb-" + ref + "-auth-token")); } catch (e) {} }
    return ON.user;
  };
  const back = () => root.location.origin + root.location.pathname;
  ON.signInDiscord = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: back() } });
    return error ? error.message : null;
  };
  ON.signInEmail = async (email) => {
    try {
      const { error } = await withTimeout(sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: true } }));
      if (!error) return null;
      if (/rate|seconds/i.test(error.message)) return "Trop de demandes d'un coup : attends une minute avant de redemander un lien.";
      return error.message;
    } catch (e) { return "Pas de connexion au serveur. Vérifie ton Internet."; }
  };
  /* 04/11/2026 (Mathis : « comment faire pour empêcher cette triche ? ») : heure du serveur. Le jeu comptait le temps avec
     l'heure de l'appareil : en l'avançant, le Sablier se remplissait et l'absence rapportait des jours de jeu. Le serveur
     répond avec son heure (en-tête Date, à la seconde) ; ON.horloge() renvoie l'écart serveur − appareil en millisecondes
     (null si le serveur ne répond pas), et le garde sur l'appareil pour le prochain lancement hors ligne. */
  const HORLOGE_KEY = "idlus-horloge";
  ON.horlogeGardee = () => { try { const v = JSON.parse(localStorage.getItem(HORLOGE_KEY) || "null"); return v && isFinite(v.off) ? +v.off : null; } catch (e) { return null; } };
  ON.horloge = async (ms) => {
    if (!/^https:/.test(URL_ || "") || typeof fetch !== "function") return null;
    try {
      const t0 = Date.now();
      const r = await withTimeout(fetch(URL_ + "/auth/v1/health", { headers: { apikey: KEY_ }, cache: "no-store" }), ms || 4000);
      const t1 = Date.now(), d = Date.parse(r.headers.get("date") || "");
      if (!isFinite(d) || t1 - t0 > 10000) return null;
      const off = Math.round(d + 500 - (t0 + t1) / 2); // l'en-tête est à la seconde près : + 0,5 s en moyenne
      try { localStorage.setItem(HORLOGE_KEY, JSON.stringify({ off, at: d })); } catch (e) {}
      return off;
    } catch (e) { return null; }
  };
  ON.signOut = async () => { try { await withTimeout(sb.auth.signOut(), 5000); } catch (e) {} ON.user = null; ON.profile = null; setState("anon"); };
  /* Nom affiché pour le compte (Discord ou e-mail). */
  ON.identities = () => {
    const u = ON.user || {}; const ids = u.identities || [];
    const dis = ids.find((i) => i.provider === "discord");
    const md = (dis && dis.identity_data) || {};
    return { discord: dis ? (md.global_name || md.full_name || md.name || md.user_name || "lié") : null, email: u.email || null };
  };
  ON.linkDiscord = async () => {
    const { error } = await sb.auth.linkIdentity({ provider: "discord", options: { redirectTo: back() } });
    return error ? (/manual linking/i.test(error.message) ? "L'ajout d'un deuxième moyen de connexion n'est pas encore activé sur le serveur." : error.message) : null;
  };
  ON.addEmail = async (email) => {
    try { const { error } = await withTimeout(sb.auth.updateUser({ email }, { emailRedirectTo: back() })); return error ? error.message : null; }
    catch (e) { return "Pas de connexion au serveur."; }
  };

  /* ---------- pseudo ---------- */
  const BAD = ["merde", "pute", "putain", "connard", "connasse", "salope", "encule", "enculé", "nazi", "hitler", "batard", "bâtard", "fdp", "ntm", "pd", "nique", "bite", "couille", "fuck", "shit", "bitch", "nigg", "negr", "admin", "moderat", "idlus", "ankama", "xener", "createur"];
  ON.pseudoProblem = (p) => {
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_-]{3,16}$/.test(p)) return "3 à 16 caractères : lettres, chiffres, - ou _ (pas d'espace).";
    const n = p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[0-9_-]/g, (c) => ({ 0: "o", 1: "i", 3: "e", 4: "a", 5: "s" }[c] || ""));
    if (BAD.some((w) => n.includes(w.normalize("NFD").replace(/[̀-ͯ]/g, ""))) || /^(modo|staff)/.test(n)) return "Ce pseudo n'est pas autorisé.";
    return null;
  };
  ON.fetchProfile = async () => {
    const { data, error } = await withTimeout(F("profiles").select("pseudo").eq("id", ON.user.id).maybeSingle());
    if (error) throw error;
    ON.profile = data || null; return ON.profile;
  };
  ON.pseudoFree = async (p) => {
    const { data, error } = await withTimeout(F("profiles").select("id").ilike("pseudo", p.replace(/[\\%_]/g, (c) => "\\" + c)).limit(1));
    if (error) throw error;
    return !data.length;
  };
  ON.createProfile = async (p) => {
    const { error } = await withTimeout(F("profiles").insert({ id: ON.user.id, pseudo: p }));
    if (error) return /duplicate|unique/i.test(error.message) ? "Ce pseudo vient d'être pris. Essaie-en un autre." : /autoris/.test(error.message) ? "Ce pseudo n'est pas autorisé." : error.message;
    ON.profile = { pseudo: p }; return null;
  };

  /* 0.1.50.1 : changer son pseudo soi-même (une fois tous les 30 jours ; l'ancien reste réservé 30 jours). */
  ON.pseudoInfo = async () => {
    try { const { data, error } = await withTimeout(R("pseudo_info")); return error ? null : data || null; } catch (e) { return null; }
  };
  ON.changePseudo = async (p) => {
    try {
      const { data, error } = await withTimeout(R("pseudo_change", { p_pseudo: p }));
      if (error) return /autoris/.test(error.message) ? "Ce pseudo n'est pas autorisé." : /duplicate|unique/i.test(error.message) ? "Ce pseudo est déjà pris." : /réserv/.test(error.message) ? error.message : "Le serveur n'a pas pu changer le pseudo. Réessaie plus tard.";
      if (data) return data;
      ON.profile = Object.assign({}, ON.profile, { pseudo: p }); return null;
    } catch (e) { return "Pas de connexion au serveur. Réessaie dans un instant."; }
  };

  /* ---------- espace de saison : la partie n (par défaut celle en cours) vise s1 pour les objets de la saison ---------- */
  /* 03/11 (Mathis : « réadapter mon panel pour mono et classique ») : le Panel Xener choisit l'espace visé par ses fonctions
     (adm_…, admin_…) au lieu de suivre la partie jouée : ON.admSp = "e" (Éternel, public) ou "s1" (Classique · Saison 1). Le serveur
     vérifie toujours le compte admin ; null = comme avant (l'espace de la partie en cours). */
  const ADM_FN = /^(adm|admin)_(?!rain)/; // pluie de kamas : les kamas viennent de la partie jouée (ses « ops »), elle suit donc la partie
  ON.admSp = null;
  ON.admFn = (name) => !!ON.admSp && ADM_FN.test(String(name || ""));
  const dbOf = (name, n) => (ON.admFn(name) ? (ON.admSp === "s1" && S1_SET.has(name) && sb.schema ? sb.schema("s1") : sb)
    : (n || SLOT) === S1_N && S1_SET.has(name) && sb.schema ? sb.schema("s1") : sb);
  const R = (name, args, n) => dbOf(name, n).rpc(name, args || {});
  const F = (table, n) => dbOf(table, n).from(table);
  ON.dbOf = dbOf;
  /* 04/11 (accueil du Panel Xener) : une fonction d'admin dans un espace donné ("e" public, "s1" Saison 1), sans changer l'espace
     choisi : rpc lit ON.admSp avant sa première attente, l'espace est remis tout de suite */
  ON.rpcSp = (sp, name, args) => { const o = ON.admSp; ON.admSp = sp; try { return ON.rpc(name, args); } finally { ON.admSp = o; } };
  const s1b = (b) => (SLOT === S1_N ? Object.assign({ saison: 1 }, b) : b); // fonction « record » (Bouclier, records, défi) : espace de la partie
  /* ---------- la partie en ligne ---------- */
  /* Renvoie null s'il n'y a pas encore de partie en ligne ; lève une erreur hors ligne. */
  ON.remoteInfo = async (n) => {
    n = n || SLOT;
    const { data, error } = await withTimeout(n === 1 || n === S1_N ? R("save_info", null, n) : n === MONO_N ? R("mono_info") : R("slot_info", { p_slot: n }));
    if (error) throw error;
    return (data && data[0]) || null;
  };
  ON.remoteData = async (n) => {
    n = n || SLOT;
    if (n === MONO_N) { const { data, error } = await withTimeout(R("mono_pull"), 20000); if (error) throw error; return data || null; } // tables Monocompte invisibles de l'API : seulement par fonction
    const q = n === 1 || n === S1_N ? F("saves", n).select("data").eq("user_id", ON.user.id) : F("save_slots").select("data").eq("user_id", ON.user.id).eq("slot", n);
    const { data, error } = await withTimeout(q.maybeSingle(), 20000);
    if (error) throw error;
    return data ? data.data : null;
  };
  /* 1.0.11 : effacer la partie 2 ou 3 du compte (la 1 ne s'efface qu'avec le compte). */
  ON.deleteSlot = async (n) => {
    if (!sb || !ON.user || n === 1 || n === S1_N || !ON.slotOnline(n)) return null;
    try { const { error } = await withTimeout(n === MONO_N ? R("mono_delete") : R("delete_slot", { p_slot: n })); return error ? error.message || "erreur" : null; } catch (e) { return "Pas de connexion au serveur."; }
  };
  /* Envoie la partie. Résultat : "ok", "conflict" (une autre version est en ligne) ou "offline". */
  let pushing = null, again = null, againP = null;
  /* 1.0.10.2 : faux conflits. Quand le serveur est lent, un envoi peut être enregistré en ligne sans que la réponse
     revienne (délai dépassé) : l'appareil gardait l'ancienne date et l'envoi suivant croyait qu'un autre appareil avait
     joué (« Deux versions de ta partie »). Chaque envoi porte maintenant un numéro (meta.pid) gardé sur l'appareil :
     si la version en ligne est l'un de nos propres envois, ce n'est pas un conflit. */
  ON.ownPush = (info, l) => { l = l || ON.link(); return !!(info && info.meta && info.meta.pid && ON.user && l.uid === ON.user.id && (l.pids || []).includes(info.meta.pid)); };
  /* 09/11/2026 (SegFault : « jusqu'à 32 Mbps d'upload » avec deux parties ouvertes) : la partie part compressée (gzip, environ
     4 fois plus légère : 700 Ko → 160 Ko) par la fonction serveur, qui l'écrit avec les mêmes règles (push_save, mono_push) et
     la vérifie dans le même appel. Navigateur sans CompressionStream, fonction pas encore à jour ou en panne : envoi direct comme
     avant (et plus d'essai compressé pendant 10 min). Jamais avec le faux serveur des tests (sauf __IDLUS_GZ). */
  let gzOff = 0;
  const gzOn = () => typeof CompressionStream === "function" && typeof Blob === "function" && typeof Response === "function" && (!root.__IDLUS_SB || !!root.__IDLUS_GZ) && Date.now() > gzOff;
  ON.gzip = async (txt) => { try { return await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream("gzip"))).blob(); } catch (e) { return null; } };
  ON.gzStat = { n: 0, raw: 0, z: 0 }; // tailles envoyées depuis l'ouverture (console : ONLINE.gzStat)
  const gzInvoke = async (fn, body, ms) => {
    if (!gzOn()) return null;
    const raw = JSON.stringify(body), z = await ON.gzip(raw);
    if (!z) { gzOff = Date.now() + 600000; return null; }
    try {
      const { data, error } = await withTimeout(sb.functions.invoke(fn, { body: z }), ms);
      if (!error && data) { ON.gzStat.n++; ON.gzStat.raw += raw.length; ON.gzStat.z += z.size; return data; }
      if (error && error.name === "FunctionsFetchError") return { net: error };
    } catch (e) { return { net: e }; } // réseau coupé ou délai dépassé : la partie a peut-être été écrite, pas de second envoi (1.0.10.2 s'en charge)
    gzOff = Date.now() + 600000; return null; // la fonction a répondu une erreur (fonction d'avant, en panne) : envoi direct
  };
  const setLinkOf = (key, p) => { const l = Object.assign(ON.linkOf(key), p); try { root.localStorage.setItem(key + "-online", JSON.stringify(l)); } catch (e) {} return l; };
  ON.push = (txt, meta, savedAt, force) => {
    if (!sb || !ON.user || !ON.slotOnline()) return Promise.resolve("offline");
    /* audit 19/10 (SYNC-04) : un envoi demandé pendant un autre n'est plus perdu : le dernier état demandé repart dès la fin
       du premier (un seul envoi de plus, quel que soit le nombre de demandes) et l'appelant attend celui-là */
    if (pushing && !force) {
      again = { txt, meta, savedAt };
      if (!againP) againP = pushing.then((r) => { const a = again; again = null; againP = null; return r === "ok" && a ? ON.push(a.txt, a.meta, a.savedAt) : r; });
      return againP;
    }
    setState("sync");
    /* audit 19/10 (SYNC-06) : partie et clé fixées au départ : un changement de partie pendant l'envoi ne mélange plus les liens */
    const slot = SLOT, key = KEY, link = () => ON.linkOf(key);
    const pid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    setLinkOf(key, { pids: [pid].concat(link().pids || []).slice(0, 10) });
    const m = Object.assign({}, meta || {}, { pid, sa: savedAt || 0 });
    const p = (async () => {
      try {
        let data = null, verified = false;
        for (let i = 0; i < 2; i++) {
          const l = link();
          const args = { p_data: txt, p_meta: m, p_version: VER, p_device: ON.device(), p_expected: l.uid === ON.user.id ? l.base || null : null, p_force: !!force };
          const r = slot === MONO_N ? await monoPush(args) : (slot === 1 || slot === S1_N) && gzOn() && (await zPush(args, slot)) || await withTimeout(slot === 1 || slot === S1_N ? R("push_save", args, slot) : R("push_slot", Object.assign({ p_slot: slot }, args)), 20000);
          if (r.verif) verified = true;
          if (r.error) throw r.error;
          data = r.data; if (data || i) break;
          const info = await ON.remoteInfo(slot); // envoi refusé : la version en ligne est-elle un de nos envois ?
          if (!ON.ownPush(info, link())) break;
          setLinkOf(key, { uid: ON.user.id, base: info.updated_at });
        }
        if (!data) { setState("conflict"); return "conflict"; }
        setLinkOf(key, { uid: ON.user.id, base: data, savedAt });
        ON.lastPush = Date.now(); setState("ok");
        if (slot === MONO_N && ON.onMonoPush) { try { ON.onMonoPush(ON.monoVerif); } catch (e) {} } // registre des Éclats et réponse du Bouclier Monocompte (js/mono_online.js)
        if ((slot === 1 || slot === S1_N) && !verified) await ON.verif(); // 2.1.4 « Bouclier du serveur » : le serveur vérifie la partie reçue (classements, hôtel de vente)
        return "ok";
      } catch (e) {
        // 2.1.35.2 : partie Monocompte d'avant la remise à zéro de la bêta, refusée par le serveur : le jeu la met de côté (js/ui.js)
        if (slot === MONO_N && /remise à zéro/i.test(String(e && e.message)) && ON.onMonoRemise) { try { ON.onMonoRemise(); } catch (x) {} }
        setState(/suspendu/i.test(String(e && e.message)) ? "suspended" : "offline"); return "offline"; }
      finally { if (pushing === p) pushing = null; }
    })();
    pushing = p; return p;
  };
  /* Bouclier Monocompte (étape 5) : la partie Monocompte part par la fonction serveur « mono », qui l'enregistre (même logique
     que mono_push) et la vérifie aussitôt (ON.monoVerif : { ok, held, registre… }). Fonction absente (serveur pas encore à jour) :
     envoi direct par mono_push, vérifié plus tard. */
  ON.monoVerif = null;
  const monoPush = async (args) => {
    try {
      const body = { push: { data: args.p_data, meta: args.p_meta, version: args.p_version, device: args.p_device, expected: args.p_expected, force: args.p_force } };
      const zd = await gzInvoke("mono", body, 30000); // 09/11 : compressé ; fonction d'avant (« demande inconnue ») : envoi normal
      if (zd && zd.net) throw zd.net; // injoignable : envoi direct, comme avant
      const { data, error } = zd ? { data: zd, error: null } : await withTimeout(sb.functions.invoke("mono", { body }), 30000);
      if (!error && data && data.ok) { ON.monoVerif = data.verif || null; return { data: data.at || null }; }
      if (!error && data && data.err) return { error: { message: data.err } };
    } catch (e) { /* fonction injoignable : envoi direct */ }
    ON.monoVerif = null;
    return withTimeout(R("mono_push", args), 20000);
  };
  /* 09/11/2026 : partie 1 et Classique · Saison 1 envoyées compressées par la fonction « record » (envoi + Bouclier en un appel).
     null : envoi direct (navigateur ou fonction pas prêts). Réponse { data, verif } comme un appel direct à push_save. */
  const zPush = async (args, slot) => {
    const d = await gzInvoke("record", Object.assign(slot === S1_N ? { saison: 1 } : {}, { push: { data: args.p_data, meta: args.p_meta, version: args.p_version, device: args.p_device, expected: args.p_expected, force: args.p_force } }), 30000);
    if (d && d.net) throw d.net;
    if (!d || !d.push) { if (d) gzOff = Date.now() + 600000; return null; } // fonction d'avant : pas de marque « push »
    if (d.err) return { error: { message: d.err } };
    return { data: d.at || null, verif: !!d.at };
  };
  /* 2.1.4 « Bouclier du serveur » : après chaque envoi, le serveur relit la partie, calcule lui-même le résumé des classements
     et la garde comme « dernière partie validée » si elle est possible (fonction « record », { verif: 1 }). Rien à montrer
     au joueur : une partie retenue reste sur sa dernière version validée et Mathis décide. */
  ON.verif = async () => {
    if (!sb || !ON.user) return null;
    try { const { data } = await withTimeout(sb.functions.invoke("record", { body: s1b({ verif: 1 }) }), 10000); return data || null; } catch (e) { return null; }
  };
  /* ---------- classements (étape 3) ---------- */
  // partie Classique · Saison 1 : les modules qui lisent par ON.db().from / .rpc visent aussi l'espace de saison
  let s1db = null;
  ON.db = () => { if (!sb || SLOT !== S1_N || typeof Proxy === "undefined") return sb; if (!s1db) s1db = new Proxy(sb, { get: (t, k) => (k === "from" ? F : k === "rpc" ? R : typeof t[k] === "function" ? t[k].bind(t) : t[k]) }); return s1db; };
  /* Demande au serveur de vérifier le record du donjon (il rejoue le combat avec la partie en ligne).
     Renvoie la réponse du serveur, ou { net: true } s'il faut réessayer plus tard. */
  ON.submitRecord = async (did) => {
    if (!sb || !ON.user) return { net: true };
    if (ON.monoPart()) return { ok: false, err: CLASSIC_ERR }; // 2.1.37.x : la fonction « record » agit sur la partie 1 (Classique)
    if (ON.solo()) return { ok: false, err: SOLO_ERR }; // le serveur rejoue avec la partie 1 : jamais pour une partie solo
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: s1b({ did }) }), 30000);
      if (error) { const st = error.context && error.context.status; return st === 400 || st === 404 ? { ok: false, err: "refusé" } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* 1.0.30 (choix 37A) : GIGA annonce d'un Dofus tombé sur un boss (js/giga.js). Le serveur vérifie la partie en ligne
     (fonction « record ») avant d'annoncer ; { net: true } s'il faut réessayer plus tard. Jamais pour une partie solo. */
  ON.dofusAnn = async (o) => {
    if (!sb || !ON.user) return { net: true };
    if (ON.monoPart()) return { ok: false, err: CLASSIC_ERR }; // 2.1.37.x : la fonction « record » agit sur la partie 1 (Classique)
    if (ON.solo()) return { ok: false, err: SOLO_ERR };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: s1b({ dofus: { uid: o.uid, did: o.did, k: o.k } }) }), 30000);
      if (error) { const st = error.context && error.context.status; return st === 400 || st === 404 ? { ok: false, err: "refusé" } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* ---------- chat et panel admin (0.1.19, supabase/chat.sql) ---------- */
  /* 1.0.11 : une partie solo ne touche jamais à ce que le serveur tient pour la partie 1 (ventes, échanges, guilde,
     Kolizéum, coefficient de brisage commun) : sinon des kamas ou des objets passeraient d'une partie à l'autre. */
  const SOLO_BLOCK = /^(hdv_(sync|buy|list|cancel|reprice|order_new|order_cancel|order_fill)|trade_|guild_(?!list$|me$|chat$|say$)|gboss_|perco_|koli_|brisage_|vente_sell$|foire_jackpot_buy$)/; // 1.0.30 : vente directe et Jackpot du Trool
  const MONO_RPC = /^(hdv_(sync|list|buy|cancel|reprice|market|offers|history|mine|bought|order_new|order_cancel|order_fill|orders_list|orders_mine)|trade_(start|state|offer|ok|cancel))$/;
  /* 2.1.37.x : fonctions du serveur Classique qui donnent ou prennent des kamas, objets ou ressources à la partie (registre hdv_ops,
     curseur S.hdv.op), ou qui l'inscrivent dans un système du Classique (guilde, alliance, Percepteurs, Kolizéum, vente directe,
     Foire, pluie de kamas, lots des classements de l'Ascension et du Songe, boss de guilde, codes cadeaux). Jamais depuis une partie
     Monocompte : leurs réponses (« ops ») portaient les opérations du Classique, appliquées à la partie Monocompte, et
     faisaient avancer son curseur. Toute autre fonction qui reçoit p_after (curseur des opérations) hors mono_ est refusée aussi. */
  const CLASSIC_RPC = /^(hdv_(sync|list|buy|cancel|reprice|mine|bought|order_new|order_cancel|order_fill|orders_mine)|trade_|guild_|gboss_|perco_|prism_|ally_|koli_|brisage_|vente_sell$|foire_jackpot|rain_|adm_rain_|songe_claim$|asc_claim$|defi_guild_prize$|gift_redeem$|gift_mine$|build_publish$)/;
  ON.classicRpc = (name, args) => !/^mono_/.test(name) && (CLASSIC_RPC.test(name) || !!(args && Object.prototype.hasOwnProperty.call(args, "p_after")));
  /* 22/10 (Mathis, 1A) : une partie Monocompte (emplacement 4 ou Éternel) n'appelle que les fonctions de la liste blanche
     E.MONO.RPC (js/mono.js) ; tout le reste, du Classique ou à venir, est refusé ici sans partir sur le réseau. */
  const MONO_ERR = "Pas en Monocompte : cette fonction appartient au serveur Classique.";
  ON.MONO_ERR = MONO_ERR;
  ON.monoGame = () => SLOT === MONO_N || SLOT > 100;
  const monoRpcOk = (name) => { const E = root.ENGINE; return !!(E && E.monoRpcOk && E.monoRpcOk(name)); };
  /* Monocompte, mode Ironman (js/mono.js) : ni vente, ni achat, ni offre d'achat, ni échange ; consulter et retirer restent permis */
  const IRON_RPC = /^(mono_)?(hdv_(list|buy|reprice|order_new|order_fill)|trade_(start|offer|ok))$/;
  ON.IRON_ERR = "Mode Ironman : pas d'HdV ni d'échange avec les autres joueurs.";
  const ironOn = () => { try { const E = root.ENGINE, s = root.DX && root.DX.S; return !!(E && E.monoIron && s && E.monoIron(s)); } catch (e) { return false; } };
  const rpc = async (name, args) => {
    if (ON.monoPart() && IRON_RPC.test(name) && ironOn()) return { err: ON.IRON_ERR };
    if (ON.admFn(name)) {} // Panel Xener : fonction d'admin, espace choisi dans le panel (pas de partie touchée), vérifiée par le serveur
    else if (ON.monoMarket() && MONO_RPC.test(name)) name = "mono_" + name; // partie Monocompte en ligne : HdV de saison et échanges du serveur Monocompte
    else if (ON.monoPart() && ON.classicRpc(name, args)) return { err: CLASSIC_ERR };
    else if (ON.monoGame() && !monoRpcOk(name)) return { err: MONO_ERR };
    else if (ON.solo() && SOLO_BLOCK.test(name)) return { err: SOLO_ERR };
    try { const { data, error } = await withTimeout(R(name, args), 12000); return error ? { err: error.message || "erreur" } : { data }; }
    catch (e) { return { err: "Pas de connexion au serveur." }; }
  };
  ON.rpc = rpc;
  ON.chatLoad = async (ch) => {
    if (!sb) return null;
    let q = F("chat_msgs").select("*").order("id", { ascending: false }).limit(ch === "p" ? 200 : 100);
    q = q.eq("ch", ["p", "c", "v", "m", "s", "sc", "sv", "mc", "mv"].includes(ch) ? ch : "g"); // 04/11 : Commerce et PvP de chaque serveur (sc/sv Saison 1, mc/mv Monocompte) // 0.1.48.2 : salons Commerce (c) et PvP (v) ; m : Général Monocompte (testeurs et admin, supabase/chat.sql)
    try { const { data, error } = await withTimeout(q, 12000); return error ? null : (data || []).reverse(); } catch (e) { return null; } // 1.0.9.1 : une erreur du serveur (délai dépassé côté base) compte comme « pas chargé », le chat réessaie
  };
  /* Temps réel : chaque nouveau message arrive par onMsg ; le nombre de joueurs connectés par onCount. */
  let chan = null, lost = false;
  ON.chatLive = (onMsg, onCount, onBack, onDel) => {
    if (!sb || chan) return;
    /* 1.0.12.3 : « enabled: true » obligatoire depuis le serveur OVH (Realtime récent) : sans lui, le serveur n'envoie pas la
       liste des joueurs présents et le compteur restait à « 1 en ligne » (le serveur Supabase d'avant l'activait pour tous). */
    chan = sb.channel("chat-general", { config: { presence: { key: (ON.user && ON.user.id) || "anon-" + Math.random().toString(36).slice(2), enabled: true } } });
    chan.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_msgs" }, (p) => { if (p && p.new) onMsg(p.new); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_msgs" }, (p) => { if (p && p.old && p.old.id && onDel) onDel(p.old.id); }) // 1.2.10.1 : message supprimé par Mathis, retiré chez tout le monde
      .on("presence", { event: "sync" }, () => { try { onCount(Object.keys(chan.presenceState()).filter((k) => !/^anon-/.test(k)).length); } catch (e) {} })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") { if (ON.user && ON.profile) { meSp = spOf(); chan.track({ p: ON.profile.pseudo, s: meSp }); } if (lost && onBack) onBack(); lost = false; } // 1.0.9.1 : retour après une coupure → messages manqués rechargés
        else lost = true; // CHANNEL_ERROR, TIMED_OUT, CLOSED : la bibliothèque se reconnecte seule
      });
  };
  /* 03/11 (Mathis : liste des joueurs connectés) : chaque joueur connecté dit aussi l'espace de sa partie : "e" Éternel (et parties
     solo), "s" Classique · Saison 1, "m" Monocompte ; renvoyé quand il change de partie (vérifié toutes les 20 s) */
  let meSp = null;
  const spOf = () => (ON.monoPart() ? "m" : SLOT === S1_N ? "s" : "e");
  { const t = typeof setInterval === "function" && setInterval(() => { try { if (chan && !lost && ON.user && ON.profile && meSp !== spOf()) { meSp = spOf(); chan.track({ p: ON.profile.pseudo, s: meSp }); } } catch (e) {} }, 20000); if (t && t.unref) t.unref(); } // unref : ne retient pas Node ; sans setInterval (bac à sable des tests) : rien
  /* [{ id, p, s }] : un par compte connecté (s null = ancienne version du jeu) */
  ON.onlineList = () => { try { if (!chan) return []; const st = chan.presenceState(); return Object.keys(st).filter((k) => !/^anon-/.test(k)).map((k) => { const x = (st[k] || []).slice(-1)[0] || {}; return { id: k, p: x.p || null, s: x.s || null }; }).filter((x) => x.p); } catch (e) { return []; } };
  ON.chatLost = () => !!chan && lost; // 1.0.10.1 : temps réel coupé (incident Supabase Realtime) : le chat se met à jour sans lui
  ON.onlinePseudos = () => { try { return chan ? Object.values(chan.presenceState()).flat().map((x) => x && x.p).filter(Boolean) : []; } catch (e) { return []; } }; // 0.1.53.7 : proposés quand on tape « @ »
  ON.chatStop = () => { if (chan) { try { sb.removeChannel(chan); } catch (e) {} chan = null; } };
  /* Saison 1, lot 4 : registre des Fragments du Temps et vitrine, gardés par le serveur dans l'espace s1 (supabase/saison1_vitrine.sql).
     Seulement une fois la saison installée (SRV.s1). fragPush envoie les gains en attente ; vitBuy achète ; vitMine lit les achats du
     compte (n = 5 force l'espace de saison, pour la partie Éternel qui relit ses cosmétiques de vitrine). */
  const s1call = async (name, args) => { if (!ON.s1Srv || !ON.user) return { err: "hors ligne" }; try { const { data, error } = await withTimeout(R(name, args, S1_N), 12000); return error ? { err: error.message || "erreur" } : { data }; } catch (e) { return { err: "hors ligne" }; } };
  ON.fragPush = (rows) => s1call("frag_post", { p_rows: rows });
  ON.vitBuy = async (id) => { const r = await s1call("vit_buy", { p_id: id }); return r.err ? r.err : r.data || null; };
  ON.vitMine = async () => { const r = await s1call("vit_mine", {}); return r.err ? null : r.data || []; };
  // Saison 1, quêtes : campagne de saison (supabase/histoire_s1.sql) : chapitre fini pendant sa semaine, nombres du serveur
  // 2.2.2.4 : la même campagne en Monocompte (supabase/mono_campagne.sql, fonctions mono_camp_done / mono_camp_count)
  ON.monoCampDone = async (ch) => { if (!ON.user) return null; const r = await ON.rpc("mono_camp_done", { p_ch: ch }); return r.err ? null : r.data; };
  ON.monoCampCount = async () => { const r = await ON.rpc("mono_camp_count", {}); return r.err ? null : r.data || {}; };
  ON.campDone = async (ch) => { const r = await s1call("camp_done", { p_ch: ch }); return r.err ? null : r.data; };
  ON.campCount = async () => { const r = await s1call("camp_count", {}); return r.err ? null : r.data || {}; };
  /* Saison 1, lot 3 : couleur du pseudo (js/garderobe.js), envoyée seulement quand le serveur la connaît (SRV.gr, posé à l'installation) */
  const pcOf = () => { const D = root.DX, S = D && D.S, E = D && D.E; return ON.grSrv && S && E && E.grPcol ? E.grPcol(S) : null; };
  ON.chatSend = async (body, to, item, ch) => { const pc = pcOf(); const r = await rpc("chat_send", Object.assign({ p_body: body, p_to: to || null, p_item: item || null }, ["c", "v", "m", "s", "sc", "sv", "mc", "mv"].includes(ch) ? { p_ch: ch } : {}, pc ? { p_pc: pc } : {})); return r.err ? r.err : r.data || null; }; // 04/11 : salon Saison 1 (s) et Commerce/PvP de chaque serveur ; avant, un message du salon Saison 1 partait dans le Général de l'Éternel
  ON.chatReport = async (id, reason) => { const r = await rpc("chat_report", { p_msg: id, p_reason: reason }); return r.err || r.data || null; };
  ON.chatMe = async () => (await rpc("chat_me")).data || {};
  // 2.1.35.3 : carte Monocompte d'un joueur (clic sur son pseudo dans le salon Monocompte du chat) ; serveur pas à jour : null
  ON.chatMonoProfil = async (u) => (ON.user && u ? (await rpc("chat_mono_profil", { p_user: u })).data || null : null);
  // 2.2.10 (idée de Panda, 4A) : fiche Monocompte d'un joueur (supabase/chat.sql, mono_fiche) ; serveur pas à jour : { err }
  ON.monoFiche = async (u) => { if (!ON.user || !u) return null; const r = await rpc("mono_fiche", { p_user: u }); return r.err ? { err: r.err } : r.data || null; };
  // 0.1.29.1 : l'équipe (créateur, modérateurs) pour le badge à côté du pseudo, lisible sans compte
  ON.staff = async () => (sb ? (await rpc("staff_list")).data || [] : []);
  ON.role = async () => (ON.user ? (await rpc("my_role")).data || null : null);
  ON.ignores = async () => { try { const { data } = await withTimeout(F("ignores").select("other").eq("user_id", ON.user.id)); return (data || []).map((r) => r.other); } catch (e) { return []; } };
  ON.setIgnore = async (other, on) => {
    try { const q = on ? F("ignores").insert({ user_id: ON.user.id, other }) : F("ignores").delete().eq("user_id", ON.user.id).eq("other", other); const { error } = await withTimeout(q); return error ? error.message : null; }
    catch (e) { return "Pas de connexion au serveur."; }
  };
  /* 0.1.50.2 : message épinglé du chat ; 2.1.36 : celui du salon Monocompte à part (pin_m_body, supabase/chat.sql). Base pas encore à
     jour (colonne absente) : on relit sans lui, et le salon Monocompte garde l'ancien message épinglé sur 'm'. */
  ON.chatPin = async () => { try {
    let r = await withTimeout(F("chat_settings").select("pin_body,pin_chs,pin_at,pin_m_body,pin_m_at").eq("id", 1).maybeSingle());
    if (r && r.error) r = await withTimeout(F("chat_settings").select("pin_body,pin_chs,pin_at").eq("id", 1).maybeSingle());
    return (r && r.data) || null; } catch (e) { return null; } };
  /* bandeaux d'annonce ; 2.1.36 : srv = serveur (null = Classique, 'm' = Monocompte), base pas encore à jour : tous Classique */
  ON.announces = async () => { try {
    const ask = (cols) => withTimeout(F("announces").select(cols).eq("banner", true).order("id", { ascending: false }).limit(6));
    let r = await ask("id,body,until,at,srv"); if (r && r.error) r = await ask("id,body,until,at");
    return (r && r.data) || []; } catch (e) { return []; } };
  ON.pseudos = async (ids) => { if (!ids.length) return {}; try { const { data } = await withTimeout(F("profiles").select("id,pseudo").in("id", ids)); const o = {}; (data || []).forEach((r) => { o[r.id] = r.pseudo; }); return o; } catch (e) { return {}; } };
  ON.findPseudo = async (p) => { try { const { data } = await withTimeout(F("profiles").select("id,pseudo").ilike("pseudo", p.replace(/[\\%_]/g, (c) => "\\" + c)).limit(1)); return (data && data[0]) || null; } catch (e) { return null; } };

  /* 0.1.19 : défi du jour, rejoué par la même fonction serveur avec la partie en ligne. */
  ON.submitDefi = async (tier) => {
    if (!sb || !ON.user) return { net: true };
    if (ON.monoPart()) return { ok: false, err: CLASSIC_ERR }; // 2.1.37.x : la fonction « record » agit sur la partie 1 (Classique)
    if (ON.solo()) return { ok: false, err: SOLO_ERR };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: s1b({ defi: tier }) }), 30000);
      if (error) { const st = error.context && error.context.status; return st === 400 || st === 404 ? { ok: false, err: "refusé" } : st === 429 ? { ok: false, err: "trop tôt" } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* 0.1.22 : boss de guilde ({ gboss: 1 }) et défense de Percepteur ({ perco: id }), rejoués par la même fonction serveur. */
  ON.submitGuild = async (body) => {
    if (!sb || !ON.user) return { net: true };
    if (ON.monoPart()) return { ok: false, err: CLASSIC_ERR }; // 2.1.37.x : la fonction « record » agit sur la partie 1 (Classique)
    if (ON.solo()) return { ok: false, err: SOLO_ERR };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: s1b(body) }), 30000);
      if (error) { let j = null; try { j = await error.context.json(); } catch (e) {} const st = error.context && error.context.status; return j && j.err ? j : st === 429 ? { ok: false, err: "Doucement : réessaie dans quelques secondes." } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* 02/11 : récompense de vote sur Dofus Fan Games (supabase/functions/vote) : la fonction vérifie le vote avec l'adresse IP. */
  /* 04/11 : cible = partie qui reçoit (« eternel », « s1 », « mono »), celle ouverte dans le jeu (js/vote.js) */
  /* 05/11 : site = "ji" pour Jeux Indé (récompense fixe, moitié de celle de Dofus Fan Games) */
  ON.vote = async (cible, site) => {
    if (!sb || !ON.user) return { ok: false, err: "Connecte-toi à ton compte pour récupérer la récompense de vote." };
    if (ON.monoPart() !== (cible === "mono")) return { ok: false, err: "Ouvre la partie qui doit recevoir la récompense, puis réessaie." };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("vote", { body: site === "ji" ? { claim: 1, cible, site } : { claim: 1, cible } }), 20000);
      if (error) { let j = null; try { j = await error.context.json(); } catch (e) {} return j && j.err ? j : { ok: false, err: "Pas de connexion au serveur. Réessaie dans un moment." }; }
      return data || { ok: false, err: "Pas de connexion au serveur. Réessaie dans un moment." };
    } catch (e) { return { ok: false, err: "Pas de connexion au serveur. Réessaie dans un moment." }; }
  };
  /* 0.1.44 : Kolizéum. { opps: 1, r } : 3 adversaires ; { fight: { id | slot }, r } : un combat classé (joué par le serveur). */
  ON.koli = (body) => ON.submitGuild({ koli: body });
  /* Saison 1, lot 8 : Tournoi des guildes (js/tournoi.js, supabase/tournoi.sql) */
  ON.tourView = (w) => ON.submitGuild({ tournoi: w ? { w } : { view: 1 } });
  ON.tourJoin = () => ON.submitGuild({ tournoi: { join: 1 } });
  ON.tourLeave = (uid) => rpc("tour_leave", uid ? { p_user: uid } : {});
  ON.koliMe = async (w) => { const r = await rpc("koli_me", { p_w: w }); return r.err ? null : r.data; };
  ON.koliFights = async () => {
    if (!sb || !ON.user) return [];
    try { const { data } = await withTimeout(F("koli_fights").select("id,at,att,def,ghost,att_name,def_name,att_team,def_team,seed,win,rounds,d_att,d_def").or(`att.eq.${ON.user.id},def.eq.${ON.user.id}`).order("id", { ascending: false }).limit(30)); return data || []; }
    catch (e) { return null; }
  };
  ON.koliLb = async (w) => {
    if (!sb) return null;
    try { const { data } = await withTimeout(F("lb_koli").select("user_id,pseudo,cote,n,heads,r").eq("w", w).order("r").limit(10)); return data || []; }
    catch (e) { return null; }
  };
  ON.deleteAccount = async () => {
    const { error } = await withTimeout(R("delete_my_account"));
    if (error) return error.message;
    await ON.signOut(); ON.clearLink(); return null;
  };

  root.ONLINE = ON;
})(typeof window !== "undefined" ? window : globalThis);
