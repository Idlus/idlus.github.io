/* ============================================================================
   SAUVEGARDE — Idlus
   Tout ce qui lit ou écrit la partie passe par ici : la partie, les copies de secours,
   la copie « avant mise à jour » et la reprise depuis l'ancienne adresse du jeu.
   Le stockage est un « support » interchangeable : aujourd'hui le navigateur (localStorage),
   plus tard le serveur (sauvegarde en ligne) avec les mêmes trois fonctions get / set / del.
   Pas de DOM ici : seulement du texte (la partie sérialisée par le moteur).
   ========================================================================== */
(function (root) {
  "use strict";
  const SV = {};

  /* Support du navigateur. Chaque fonction avale les erreurs (navigation privée, quota plein…) ;
     set renvoie false si l'écriture a échoué. */
  SV.local = {
    get: (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: (k) => { try { root.localStorage.removeItem(k); } catch (e) {} },
  };
  let store = SV.local;
  SV.useStore = (s) => { store = s || SV.local; };
  SV.store = () => store;

  /* Réglages fixés au lancement par l'interface : clé de la partie, version du jeu, moteur. */
  let KEY = "dofousxen-save", VER = "", E = null, now = () => Date.now();
  SV.init = (o) => { KEY = o.key; VER = o.version; E = o.engine; if (E && E.now) now = () => E.now(); };
  SV.key = () => KEY;

  /* ---------- la partie ---------- */
  SV.read = () => store.get(KEY);
  /* Écrit la partie (texte déjà sérialisé). Une copie automatique toutes les 10 min de jeu. */
  SV.write = (txt, st) => {
    if (!store.set(KEY, txt)) return false;
    if (now() - SV.lastCopy() > COPY_EVERY) SV.pushCopy(txt, "auto", st);
    return true;
  };
  SV.remove = () => store.del(KEY);

  /* ---------- copies de secours ----------
     3 copies tournantes (une toutes les 10 min de jeu), une avant chaque mise à jour du jeu
     et une avant chaque restauration. Si la sauvegarde est illisible, la plus récente prend le relais. */
  const COPY_EVERY = 10 * 60 * 1000, COPY_MAX = { auto: 3, maj: 1, avant: 1 };
  const copyKey = () => KEY + "-copies", verKey = () => KEY + "-version";
  SV.copies = () => { try { const a = JSON.parse(store.get(copyKey()) || "[]"); return Array.isArray(a) ? a.filter((c) => c && typeof c.txt === "string") : []; } catch (e) { return []; } };
  const writeCopies = (a) => {
    a.sort((x, y) => y.t - x.t);
    while (a.length) { if (store.set(copyKey(), JSON.stringify(a))) return; a.pop(); } // place insuffisante : on lâche la plus ancienne
    store.del(copyKey());
  };
  SV.pushCopy = (txt, why, st, v) => {
    if (!txt) return;
    const meta = st && st.chars ? { lvl: Math.max(...st.chars.map((c) => c.lvl || 1)), n: st.chars.length } : {};
    const a = SV.copies(), same = a.filter((c) => c.why === why).sort((x, y) => y.t - x.t).slice(0, COPY_MAX[why] - 1);
    writeCopies([Object.assign({ t: now(), why, v: v || VER, txt }, meta), ...same, ...a.filter((c) => c.why !== why)]);
  };
  SV.lastCopy = () => Math.max(0, ...SV.copies().filter((c) => c.why === "auto").map((c) => c.t));

  /* ---------- chargement ----------
     Renvoie { state, restored, transferred } : restored = la copie utilisée si la partie était illisible,
     transferred = vrai si la partie vient d'arriver de l'ancienne adresse du jeu. */
  SV.load = (transferTxt) => {
    let transferred = false;
    if (transferTxt && !store.get(KEY)) { try { E.deserialize(transferTxt); transferred = store.set(KEY, transferTxt); } catch (e) {} }
    const raw = store.get(KEY);
    if (!raw) return { state: null, restored: null, transferred };
    try { return { state: E.deserialize(raw), restored: null, transferred }; } catch (e) {}
    for (const c of SV.copies()) { try { return { state: E.deserialize(c.txt), restored: c, transferred }; } catch (e) {} } // sauvegarde illisible : copie la plus récente
    return { state: null, restored: null, transferred };
  };
  /* Avant de lancer une nouvelle version du jeu, on garde la partie telle qu'elle était. */
  SV.beforeUpdate = (st, restored) => {
    const prev = store.get(verKey());
    if (prev === VER) return;
    const raw = store.get(KEY); if (raw && !restored) SV.pushCopy(raw, "maj", st, prev || "précédente");
    store.set(verKey(), VER);
  };

  root.SAVE = SV;
  if (typeof module !== "undefined" && module.exports) module.exports = SV;
})(typeof window !== "undefined" ? window : globalThis);
