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
    keys: () => { try { const L = []; for (let i = 0; i < root.localStorage.length; i++) L.push(root.localStorage.key(i)); return L; } catch (e) { return []; } },
  };
  let store = SV.local;
  SV.useStore = (s) => { store = s || SV.local; };
  SV.store = () => store;

  /* Réglages fixés au lancement par l'interface : clé de la partie, version du jeu, moteur. */
  let KEY = "dofousxen-save", VER = "", E = null, now = () => Date.now();
  SV.init = (o) => { KEY = o.key; VER = o.version; E = o.engine; if (E && E.now) now = () => E.now(); };
  SV.key = () => KEY;
  /* 1.0.11 : écran « Choisis ta partie » : lit une partie sans la lancer (clé de la partie 1, 2 ou 3).
     Si elle est illisible, la copie de secours la plus récente la remplace, comme au chargement. */
  SV.peek = (k) => {
    const raw = store.get(k);
    if (!raw) return { state: null, restored: false };
    try { return { state: E.deserialize(raw), restored: false }; } catch (e) {}
    let a = []; try { a = JSON.parse(store.get(k + "-copies") || "[]"); } catch (e) {}
    for (const c of Array.isArray(a) ? a : []) { try { if (c && typeof c.txt === "string") return { state: E.deserialize(c.txt), restored: true }; } catch (e) {} }
    return { state: null, restored: false };
  };

  /* ---------- la partie ---------- */
  /* 1.0.33.1 : dans le navigateur, les objets sont rangés en compact (E.packSave) ; la lecture rend le format normal
     (c'est lui qui part en ligne). */
  const pack = (txt) => (store === SV.local && E && E.packSave ? E.packSave(txt) : txt);
  const unpack = (txt) => { if (!txt || !E || !E.unpackSave) return txt; try { return E.unpackSave(txt); } catch (e) { return txt; } };
  SV.read = () => unpack(store.get(KEY));
  /* Écrit la partie (texte déjà sérialisé). Une copie automatique toutes les 10 min de jeu. */
  SV.write = (txt, st) => {
    const full = txt; txt = pack(txt);
    if (!store.set(KEY, txt) && !SV.makeRoom(() => store.set(KEY, txt))) return false;
    if (now() - SV.lastCopy() > COPY_EVERY) SV.pushCopy(full, "auto", st);
    return true;
  };
  SV.remove = () => store.del(KEY);
  /* 1.0.32.8 « Sauvegarde sans retour en arrière » : stockage du navigateur plein. Avant, l'écriture échouait sans
     rien dire : la partie restait figée au dernier enregistrement réussi (et c'est elle qui partait en ligne), et au
     redémarrage on retrouvait une partie de plusieurs heures en arrière. On libère maintenant de la place, du moins
     utile au plus utile, en réessayant après chaque étape : copies de secours de cette partie (on garde la plus récente),
     puis toutes, puis celles des autres parties, puis les parties de test du panel (la plus ancienne d'abord).
     retry() réécrit la partie et renvoie vrai si c'est passé. SV.freed dit ce qui a été libéré (message au joueur). */
  SV.freed = null;
  SV.makeRoom = (retry) => {
    const ck = copyKey(); const tries = [];
    tries.push(() => { const a = SV.copies().sort((x, y) => y.t - x.t); if (a.length <= 1) return false; store.del(ck); return store.set(ck, JSON.stringify(a.slice(0, 1))) || true; });
    tries.push(() => { if (store.get(ck) === null) return false; store.del(ck); return true; });
    const keys = store.keys ? store.keys() : [];
    keys.filter((k) => k && k !== ck && /^dofousxen-save.*-copies$/.test(k)).forEach((k) => tries.push(() => { store.del(k); return true; }));
    keys.filter((k) => k && /^dofousxen-save.*-tests$/.test(k)).forEach((k) => tries.push(() => {
      let a = []; try { a = JSON.parse(store.get(k) || "[]"); } catch (e) {}
      if (!Array.isArray(a) || !a.length) { store.del(k); return true; }
      for (let n = a.length - 1; n >= 0; n--) { store.del(k); if (n && store.set(k, JSON.stringify(a.slice(0, n))) && retry()) return "ok"; if (!n && retry()) return "ok"; }
      return true;
    }));
    let i = 0;
    for (const t of tries) { i++; const r = t(); if (r === "ok") { SV.freed = i; return true; } if (r && retry()) { SV.freed = i; return true; } }
    return false;
  };

  /* 1.0.33.1 : place prise dans le navigateur (en caractères) : la partie, ses copies, et tout le site. */
  SV.usage = () => {
    const keys = store.keys ? store.keys() : []; let total = 0;
    keys.forEach((k) => { const v = store.get(k); total += (k ? k.length : 0) + (v ? v.length : 0); });
    const len = (k) => { const v = store.get(k); return v ? v.length : 0; };
    return { game: len(KEY), copies: len(copyKey()), total, max: 5000000 };
  };

  /* ---------- copies de secours ----------
     3 copies tournantes (une toutes les 10 min de jeu), une avant chaque mise à jour du jeu
     et une avant chaque restauration. Si la sauvegarde est illisible, la plus récente prend le relais. */
  const COPY_EVERY = 10 * 60 * 1000, COPY_MAX = { auto: 3, maj: 1, avant: 1, enligne: 1 }; // 1.0.11 : enligne = version en ligne remplacée par celle de l'appareil
  const copyKey = () => KEY + "-copies", verKey = () => KEY + "-version";
  SV.copies = () => { try { const a = JSON.parse(store.get(copyKey()) || "[]"); return Array.isArray(a) ? a.filter((c) => c && typeof c.txt === "string") : []; } catch (e) { return []; } };
  /* 1.0.32.8 : les copies ensemble ne dépassent pas COPY_BUDGET caractères (le navigateur donne environ 5 millions de
     caractères par site). Une grosse partie (600 Ko) gardait 6 copies, presque tout le stockage : la partie
     elle-même risquait de ne plus pouvoir s'écrire. La plus récente est toujours gardée. */
  const COPY_BUDGET = 3000000;
  const writeCopies = (a) => {
    a.sort((x, y) => y.t - x.t);
    let tot = 0; a = a.filter((c, i) => { tot += c.txt.length; return i === 0 || tot <= COPY_BUDGET; });
    while (a.length) { if (store.set(copyKey(), JSON.stringify(a))) return; a.pop(); } // place insuffisante : on lâche la plus ancienne
    store.del(copyKey());
  };
  SV.pushCopy = (txt, why, st, v) => {
    if (!txt) return;
    txt = pack(txt);
    const meta = st && st.chars ? { lvl: Math.max(...st.chars.map((c) => c.lvl || 1)), n: st.chars.length } : {};
    const a = SV.copies(), same = a.filter((c) => c.why === why).sort((x, y) => y.t - x.t).slice(0, COPY_MAX[why] - 1);
    writeCopies([Object.assign({ t: now(), why, v: v || VER, txt }, meta), ...same, ...a.filter((c) => c.why !== why)]);
  };
  /* 1.0.32.8 : une copie datée dans le futur (horloge de l'appareil en avance, puis remise à l'heure) ne compte pas :
     avant, elle bloquait toutes les copies automatiques jusqu'à ce que l'heure la rattrape. */
  SV.lastCopy = () => { const n = now(); return Math.max(0, ...SV.copies().filter((c) => c.why === "auto" && c.t <= n + 60000).map((c) => c.t)); };

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
