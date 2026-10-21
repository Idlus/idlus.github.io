/* ============================================================================
   Bureau des Aventuriers — combat de groupe en direct (serveur Monocompte), le code commun au serveur et au jeu.
   - Serveur (fonction « mono », route { bureau: { combat } }) : BC.combat construit la PHOTO de chaque héros depuis sa
     dernière partie validée par le Bouclier (mono.parties_ok), jamais depuis le navigateur, applique les règles du départ
     (1B : pas de donjon solo en cours ; 4A : donjon débloqué par tous, un joueur a réussi la stasis précédente), puis joue
     tout le combat d'un coup avec la graine tirée par la base (E.monoGroupRun, js/mono.js).
   - Jeu : BC.voir rejoue le même combat (même photos, même graine, même version du jeu) pour le regarder ensemble en
     direct (2A), seconde par seconde depuis l'heure de départ donnée par le serveur ; BC.butin donne le butin individuel.
   Pendant un combat de groupe, ni modificateurs de la semaine ni donjon éclair (le même combat chez tous, à toute heure).
   ========================================================================== */
(function (root) {
  "use strict";
  const E = root.ENGINE || require("./engine.js");
  const D = root.DATA || require("./data.js");
  const BC = (E.BUREAU = E.BUREAU || {});
  const hero = (S) => ((S && S.chars) || []).find((c) => !c.merc) || null;
  BC.cle = (did) => (D.DUNGEONS[did] || {}).key || null;
  BC.nom = (did) => (D.DUNGEONS[did] || {}).name || did;

  /* joue le combat sans aucune dépendance à l'heure (mêmes photos + même graine + même heure de lancement = même combat partout) :
     l'horloge du moteur est arrêtée sur l'heure du lancement (at, ms, donnée par la base : Almanax, événements, saison…),
     ni modificateurs de la semaine ni donjon éclair */
  BC.run = (snaps, did, stasis, seed, onTick, at) => {
    const w0 = E.weekly, f0 = E.flashOf, c0 = E.getClock(); E.weekly = () => null; E.flashOf = () => null;
    if (at > 0) { const t = Math.floor(at / 1000) * 1000; E.setClock(() => t); }
    try { return E.monoGroupRun(JSON.parse(JSON.stringify(snaps)), did, stasis, seed >>> 0, onTick); }
    finally { E.weekly = w0; E.flashOf = f0; E.setClock(c0); }
  };

  /* Côté serveur. membres : [{ user, pseudo, data (texte de la partie validée) }]. VM : js/verify_mono.js (lecture d'une partie).
     at : heure du lancement (ms, donnée par la base). Renvoie { exclus: [{ user, why }] } (lancement annulé), { err } ou { snaps (texte), R, duree, cle }. */
  BC.combat = (VM, membres, did, stasis, seed, at) => {
    if (!D.DUNGEONS[did]) return { err: "donjon inconnu" };
    if (!(stasis >= 1 && stasis <= E.STASIS_MAX)) return { err: "stasis impossible" };
    if (!Array.isArray(membres) || membres.length < 2 || membres.length > ((E.MONO && E.MONO.groupMax) || 4)) return { err: "2 à 4 joueurs" };
    const exclus = [], snaps = []; let top = 0;
    for (const m of membres) {
      let S = null; try { S = m.data ? VM.load(E, m.data) : null; } catch (e) { S = null; }
      const c = hero(S);
      if (!S || !S.mono || S.mono.eternel || !c) { exclus.push({ user: m.user, why: "pas de héros validé cette saison" }); continue; }
      if (S.dungeon) { exclus.push({ user: m.user, why: "donjon solo en cours" }); continue; } // 1B
      if (!E.dungeonUnlocked(S, did)) { exclus.push({ user: m.user, why: "donjon pas encore débloqué" }); continue; } // 4A
      top = Math.max(top, (E.stasisInfo(S, did).max) || 0);
      const sn = E.monoSnap(S, c); sn.merc = 0; snaps.push(sn);
    }
    if (exclus.length) return { exclus };
    if (stasis > 1 && top < stasis - 1) return { exclus: membres.map((m) => ({ user: m.user, why: `personne n'a réussi la stasis ${stasis - 1}` })) }; // 4A
    const txt = JSON.stringify(snaps);
    const R = BC.run(JSON.parse(txt), did, stasis, seed, null, at);
    if (R.err) return { err: R.err };
    return { snaps: txt, R: BC.resume(R), duree: R.t, cle: BC.cle(did) };
  };
  /* ce que le serveur garde du combat (le butin se calcule dessus) */
  BC.resume = (R) => ({ did: R.did, stasis: R.stasis, rooms: R.rooms, done: !!R.done, players: R.players, t: R.t });

  /* Côté jeu : le combat image par image (une par seconde de jeu) pour l'écran regardé ensemble */
  BC.voir = (snaps, did, stasis, seed, at) => {
    const frames = [];
    const R = BC.run(typeof snaps === "string" ? JSON.parse(snaps) : snaps, did, stasis, seed, (S2, t) => {
      const F = S2.fight, Dg = S2.dungeon;
      frames.push({ t, salle: (S2.monoRun.rooms || []).length, boss: !!(Dg && F && F.ents.some((e) => e.side === "m" && e.boss)),
        ents: F ? F.ents.filter((e) => !e.summon).map((e) => ({ s: e.side, n: e.name, c: e.cls || null, k: e.key || null, hp: Math.max(0, Math.round(e.hp)), mx: Math.max(1, Math.round(e.hpMax)) })) : [] });
    }, at);
    return { R, frames };
  };
  /* l'image du combat à un instant (ms depuis le départ) */
  BC.image = (V, ms) => { const f = V && V.frames; if (!f || !f.length) return null; const i = Math.max(0, Math.min(f.length - 1, Math.floor(ms / 1000))); return f[i]; };

  /* Butin individuel (récupéré une seule fois par le serveur) : comme si le joueur avait fait le donjon seul, dans sa partie */
  BC.butin = (S, b) => {
    if (!S || !S.mono || !b || !b.result) return null;
    const R = typeof b.result === "string" ? JSON.parse(b.result) : b.result;
    S.mono.gpris = S.mono.gpris || {};
    if (S.mono.gpris[b.combat]) return null; // déjà appliqué dans cette partie (deux onglets, retour après une coupure)
    S.mono.gpris[b.combat] = Date.now();
    const ks = Object.keys(S.mono.gpris); if (ks.length > 60) ks.sort((a, c) => S.mono.gpris[a] - S.mono.gpris[c]).slice(0, ks.length - 60).forEach((k) => delete S.mono.gpris[k]);
    return E.monoGroupLoot(S, Object.assign({}, R, { did: b.did, stasis: b.stasis, ids: (b.ids || []).map(String) }));
  };

  /* Défi 12 « Rendez-vous du temps » : la règle, lue par le serveur (mono.bureau_d12) — joueurs DIFFÉRENTS avec qui le compte a
     fini (victoire) un donjon de groupe en direct pendant la manche IV. Côté jeu, l'affichage suit l'événement « dungeon » (ids). */
  BC.D12 = { manche: 4, victoire: true, compte: "joueurs différents", source: "mono.bureau_d12" };

  BC.hero = hero;
  if (typeof module !== "undefined" && module.exports) module.exports = BC;
})(typeof window !== "undefined" ? window : globalThis);
