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
  const SERVERS = {
    public: { url: "https://bolbuxuxydfslwpfbfff.supabase.co", key: "sb_publishable__Kojf1wLJLnbi3eqquQ_8g_AR6lVP9H", mail: false },
    beta: { url: "", key: "", mail: false }
  };
  const ON = {};
  const lib = root.__IDLUS_SB || (root.supabase && root.supabase.createClient ? root.supabase : null); // __IDLUS_SB : faux serveur des tests
  /* 1.0.8.2 : « partie de test » du jeu public (compte admin) : le jeu tourne sans serveur, comme la bêta, sur une
     sauvegarde séparée. Rien n'est envoyé en ligne et la vraie partie n'est pas touchée. */
  const TM = (() => { try { return root.localStorage.getItem("idlus-partie-test") === "1"; } catch (e) { return false; } })();
  ON.world = /\/beta\//.test(root.location ? root.location.pathname : "") || TM ? "beta" : "public";
  const SRV = root.__IDLUS_SB && !TM ? { url: "test", key: "test", mail: true } : SERVERS[ON.world];
  const URL_ = SRV.url, KEY_ = SRV.key;
  ON.enabled = !!lib && !!URL_ && !root.__IDLUS_OFFLINE; // __IDLUS_OFFLINE : test de démarrage sans serveur
  ON.mail = SRV.mail;
  let sb = null, KEY = "dofousxen-save", VER = "";
  ON.user = null; ON.profile = null;

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
  ON.clearLink = () => { const skip = ON.link().skip; try { root.localStorage.setItem(lkKey(), JSON.stringify(skip ? { skip } : {})); } catch (e) {} };

  ON.device = () => /Mobi|Android|iPhone|iPad/i.test((root.navigator && root.navigator.userAgent) || "") ? "téléphone" : "ordinateur";
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("délai dépassé")), ms || 9000))]);
  const offlineErr = (e) => !e || /fetch|network|délai|Failed|Load failed/i.test(String(e.message || e));

  ON.init = (o) => {
    KEY = o.key; VER = o.version;
    if (!ON.enabled || sb) return;
    sb = lib.createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
    sb.auth.onAuthStateChange((ev, session) => { ON.user = session ? session.user : null; if (!ON.user) setState("anon"); });
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
    const { data, error } = await withTimeout(sb.from("profiles").select("pseudo").eq("id", ON.user.id).maybeSingle());
    if (error) throw error;
    ON.profile = data || null; return ON.profile;
  };
  ON.pseudoFree = async (p) => {
    const { data, error } = await withTimeout(sb.from("profiles").select("id").ilike("pseudo", p.replace(/[\\%_]/g, (c) => "\\" + c)).limit(1));
    if (error) throw error;
    return !data.length;
  };
  ON.createProfile = async (p) => {
    const { error } = await withTimeout(sb.from("profiles").insert({ id: ON.user.id, pseudo: p }));
    if (error) return /duplicate|unique/i.test(error.message) ? "Ce pseudo vient d'être pris. Essaie-en un autre." : /autoris/.test(error.message) ? "Ce pseudo n'est pas autorisé." : error.message;
    ON.profile = { pseudo: p }; return null;
  };

  /* 0.1.50.1 : changer son pseudo soi-même (une fois tous les 30 jours ; l'ancien reste réservé 30 jours). */
  ON.pseudoInfo = async () => {
    try { const { data, error } = await withTimeout(sb.rpc("pseudo_info")); return error ? null : data || null; } catch (e) { return null; }
  };
  ON.changePseudo = async (p) => {
    try {
      const { data, error } = await withTimeout(sb.rpc("pseudo_change", { p_pseudo: p }));
      if (error) return /autoris/.test(error.message) ? "Ce pseudo n'est pas autorisé." : /duplicate|unique/i.test(error.message) ? "Ce pseudo est déjà pris." : /réserv/.test(error.message) ? error.message : "Le serveur n'a pas pu changer le pseudo. Réessaie plus tard.";
      if (data) return data;
      ON.profile = Object.assign({}, ON.profile, { pseudo: p }); return null;
    } catch (e) { return "Pas de connexion au serveur. Réessaie dans un instant."; }
  };

  /* ---------- la partie en ligne ---------- */
  /* Renvoie null s'il n'y a pas encore de partie en ligne ; lève une erreur hors ligne. */
  ON.remoteInfo = async () => {
    const { data, error } = await withTimeout(sb.rpc("save_info"));
    if (error) throw error;
    return (data && data[0]) || null;
  };
  ON.remoteData = async () => {
    const { data, error } = await withTimeout(sb.from("saves").select("data").eq("user_id", ON.user.id).maybeSingle(), 20000);
    if (error) throw error;
    return data ? data.data : null;
  };
  /* Envoie la partie. Résultat : "ok", "conflict" (une autre version est en ligne) ou "offline". */
  let pushing = null;
  ON.push = (txt, meta, savedAt, force) => {
    if (!sb || !ON.user) return Promise.resolve("offline");
    if (pushing && !force) return pushing;
    const l = ON.link();
    setState("sync");
    const p = (async () => {
      try {
        const { data, error } = await withTimeout(sb.rpc("push_save", { p_data: txt, p_meta: meta || {}, p_version: VER, p_device: ON.device(), p_expected: l.uid === ON.user.id ? l.base || null : null, p_force: !!force }), 20000);
        if (error) throw error;
        if (!data) { setState("conflict"); return "conflict"; }
        ON.setLink({ uid: ON.user.id, base: data, savedAt });
        ON.lastPush = Date.now(); setState("ok"); return "ok";
      } catch (e) { setState(/suspendu/i.test(String(e && e.message)) ? "suspended" : "offline"); return "offline"; }
      finally { pushing = null; }
    })();
    pushing = p; return p;
  };
  /* ---------- classements (étape 3) ---------- */
  ON.db = () => sb;
  /* Demande au serveur de vérifier le record du donjon (il rejoue le combat avec la partie en ligne).
     Renvoie la réponse du serveur, ou { net: true } s'il faut réessayer plus tard. */
  ON.submitRecord = async (did) => {
    if (!sb || !ON.user) return { net: true };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: { did } }), 30000);
      if (error) { const st = error.context && error.context.status; return st === 400 || st === 404 ? { ok: false, err: "refusé" } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* ---------- chat et panel admin (0.1.19, supabase/chat.sql) ---------- */
  const rpc = async (name, args) => {
    try { const { data, error } = await withTimeout(sb.rpc(name, args || {}), 12000); return error ? { err: error.message || "erreur" } : { data }; }
    catch (e) { return { err: "Pas de connexion au serveur." }; }
  };
  ON.rpc = rpc;
  ON.chatLoad = async (ch) => {
    if (!sb) return null;
    let q = sb.from("chat_msgs").select("*").order("id", { ascending: false }).limit(ch === "p" ? 200 : 100);
    q = q.eq("ch", ["p", "c", "v"].includes(ch) ? ch : "g"); // 0.1.48.2 : salons Commerce (c) et PvP (v)
    try { const { data, error } = await withTimeout(q, 12000); return error ? null : (data || []).reverse(); } catch (e) { return null; } // 1.0.9.1 : une erreur du serveur (délai dépassé côté base) compte comme « pas chargé », le chat réessaie
  };
  /* Temps réel : chaque nouveau message arrive par onMsg ; le nombre de joueurs connectés par onCount. */
  let chan = null, lost = false;
  ON.chatLive = (onMsg, onCount, onBack) => {
    if (!sb || chan) return;
    chan = sb.channel("chat-general", { config: { presence: { key: (ON.user && ON.user.id) || "anon-" + Math.random().toString(36).slice(2) } } });
    chan.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_msgs" }, (p) => { if (p && p.new) onMsg(p.new); })
      .on("presence", { event: "sync" }, () => { try { onCount(Object.keys(chan.presenceState()).filter((k) => !/^anon-/.test(k)).length); } catch (e) {} })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") { if (ON.user && ON.profile) chan.track({ p: ON.profile.pseudo }); if (lost && onBack) onBack(); lost = false; } // 1.0.9.1 : retour après une coupure → messages manqués rechargés
        else lost = true; // CHANNEL_ERROR, TIMED_OUT, CLOSED : la bibliothèque se reconnecte seule
      });
  };
  ON.chatLost = () => !!chan && lost; // 1.0.10.1 : temps réel coupé (incident Supabase Realtime) : le chat se met à jour sans lui
  ON.onlinePseudos = () => { try { return chan ? Object.values(chan.presenceState()).flat().map((x) => x && x.p).filter(Boolean) : []; } catch (e) { return []; } }; // 0.1.53.7 : proposés quand on tape « @ »
  ON.chatStop = () => { if (chan) { try { sb.removeChannel(chan); } catch (e) {} chan = null; } };
  ON.chatSend = async (body, to, item, ch) => { const r = await rpc("chat_send", Object.assign({ p_body: body, p_to: to || null, p_item: item || null }, ch === "c" || ch === "v" ? { p_ch: ch } : {})); return r.err ? r.err : r.data || null; };
  ON.chatReport = async (id, reason) => { const r = await rpc("chat_report", { p_msg: id, p_reason: reason }); return r.err || r.data || null; };
  ON.chatMe = async () => (await rpc("chat_me")).data || {};
  // 0.1.29.1 : l'équipe (créateur, modérateurs) pour le badge à côté du pseudo, lisible sans compte
  ON.staff = async () => (sb ? (await rpc("staff_list")).data || [] : []);
  ON.role = async () => (ON.user ? (await rpc("my_role")).data || null : null);
  ON.ignores = async () => { try { const { data } = await withTimeout(sb.from("ignores").select("other").eq("user_id", ON.user.id)); return (data || []).map((r) => r.other); } catch (e) { return []; } };
  ON.setIgnore = async (other, on) => {
    try { const q = on ? sb.from("ignores").insert({ user_id: ON.user.id, other }) : sb.from("ignores").delete().eq("user_id", ON.user.id).eq("other", other); const { error } = await withTimeout(q); return error ? error.message : null; }
    catch (e) { return "Pas de connexion au serveur."; }
  };
  ON.chatPin = async () => { try { const { data } = await withTimeout(sb.from("chat_settings").select("pin_body,pin_chs,pin_at").eq("id", 1).maybeSingle()); return data || null; } catch (e) { return null; } }; // 0.1.50.2 : message épinglé du chat
  ON.announces = async () => { try { const { data } = await withTimeout(sb.from("announces").select("id,body,until,at").eq("banner", true).order("id", { ascending: false }).limit(3)); return data || []; } catch (e) { return []; } };
  ON.pseudos = async (ids) => { if (!ids.length) return {}; try { const { data } = await withTimeout(sb.from("profiles").select("id,pseudo").in("id", ids)); const o = {}; (data || []).forEach((r) => { o[r.id] = r.pseudo; }); return o; } catch (e) { return {}; } };
  ON.findPseudo = async (p) => { try { const { data } = await withTimeout(sb.from("profiles").select("id,pseudo").ilike("pseudo", p.replace(/[\\%_]/g, (c) => "\\" + c)).limit(1)); return (data && data[0]) || null; } catch (e) { return null; } };

  /* 0.1.19 : défi du jour, rejoué par la même fonction serveur avec la partie en ligne. */
  ON.submitDefi = async (tier) => {
    if (!sb || !ON.user) return { net: true };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body: { defi: tier } }), 30000);
      if (error) { const st = error.context && error.context.status; return st === 400 || st === 404 ? { ok: false, err: "refusé" } : st === 429 ? { ok: false, err: "trop tôt" } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* 0.1.22 : boss de guilde ({ gboss: 1 }) et défense de Percepteur ({ perco: id }), rejoués par la même fonction serveur. */
  ON.submitGuild = async (body) => {
    if (!sb || !ON.user) return { net: true };
    try {
      const { data, error } = await withTimeout(sb.functions.invoke("record", { body }), 30000);
      if (error) { let j = null; try { j = await error.context.json(); } catch (e) {} const st = error.context && error.context.status; return j && j.err ? j : st === 429 ? { ok: false, err: "Doucement : réessaie dans quelques secondes." } : { net: true }; }
      return data || { net: true };
    } catch (e) { return { net: true }; }
  };
  /* 0.1.44 : Kolizéum. { opps: 1, r } : 3 adversaires ; { fight: { id | slot }, r } : un combat classé (joué par le serveur). */
  ON.koli = (body) => ON.submitGuild({ koli: body });
  ON.koliMe = async (w) => { const r = await rpc("koli_me", { p_w: w }); return r.err ? null : r.data; };
  ON.koliFights = async () => {
    if (!sb || !ON.user) return [];
    try { const { data } = await withTimeout(sb.from("koli_fights").select("id,at,att,def,ghost,att_name,def_name,att_team,def_team,seed,win,rounds,d_att,d_def").or(`att.eq.${ON.user.id},def.eq.${ON.user.id}`).order("id", { ascending: false }).limit(30)); return data || []; }
    catch (e) { return null; }
  };
  ON.koliLb = async (w) => {
    if (!sb) return null;
    try { const { data } = await withTimeout(sb.from("lb_koli").select("user_id,pseudo,cote,n,heads,r").eq("w", w).order("r").limit(10)); return data || []; }
    catch (e) { return null; }
  };
  ON.deleteAccount = async () => {
    const { error } = await withTimeout(sb.rpc("delete_my_account"));
    if (error) return error.message;
    await ON.signOut(); ON.clearLink(); return null;
  };

  root.ONLINE = ON;
})(typeof window !== "undefined" ? window : globalThis);
