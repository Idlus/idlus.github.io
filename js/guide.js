/* ============================================================================
   GUIDE (Idlus 1.2.x « Le Guide ») : demande de Mathis, « un véritable guide en jeu qui donne le détail de toutes
   les fonctionnalités ».
   Page Journal › Guide : un chapitre par fonctionnalité, rangés par famille, avec où le trouver, comment ça se débloque,
   comment ça marche et les chiffres clés. Les chiffres sont lus dans le code du jeu au moment de l'affichage
   (constantes d'ENGINE et de DATA), donc ils suivent l'équilibrage sans qu'on réécrive le guide.
   Bouton « ? » en haut de l'écran : ouvre le chapitre de la page affichée.
   Tous les textes sont dans ce fichier (rien dans ui.js à part l'entrée du menu et le bouton) pour que la future
   réorganisation des menus n'ait qu'une ligne à déplacer.
   La page se dessine au clic et à la saisie (DX.morph), jamais dans la boucle de 3 s.
   ========================================================================== */
(function () {
  "use strict";
  const E = window.ENGINE, D = window.DATA;
  if (!E || !window.DX) return;
  const X = () => window.DX.social;
  const UI = () => window.DX.ui;
  const S = () => window.DX.S;
  const h = (s) => X().h(String(s));
  const fr = (n) => (typeof n === "number" ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(n));
  const pc = (x) => fr(Math.round(x * 1000) / 10) + " %";
  /* une valeur lue dans le code : si elle manque (fonction renommée), le guide l'écrit « ? » au lieu de planter */
  const V = (f, d) => { try { const v = f(); return v === undefined || v === null || (typeof v === "number" && !isFinite(v)) ? (d === undefined ? "?" : d) : v; } catch (e) { return d === undefined ? "?" : d; } };
  const N = (f, d) => { const v = V(f, d); return typeof v === "number" ? fr(v) : v; };

  /* ---------- contenu ----------
     Un chapitre : { id, f: famille, n: nom, ic: icône (assets/ui), page: clé du menu (ou null), où, dé: déblocage,
     b: () => [blocs] }. Un bloc : ["p", texte] · ["ul", [lignes]] · ["h", sous-titre] · ["kv", [[nom, valeur], …]] · ["tip", texte].
     Le texte accepte **gras**. */
  const FAM = ["Bien débuter", "Stratégie", "Aventure", "Défis", "Héros", "Classes", "Économie", "Communauté", "Journal", "Options"];
  const CH = [];
  const add = (c) => CH.push(c);

  /* ======================= Bien débuter ======================= */
  add({ id: "debut", f: "Bien débuter", n: "Le principe du jeu", ic: "logo", page: null, k: "idle accueil premiers pas",
    ou: "partout : le Havre-Sac est l'accueil", de: "dès le début",
    voir: ["absence", "equipe", "combat", "sablier"],
    b: () => [
      ["p", "Idlus est un jeu idle : ton équipe de héros combat **toute seule** dans la zone ou le donjon que tu choisis. Ton rôle est de faire les bons choix : où chasser, quels héros recruter, quel équipement porter, quels sorts mettre sur la barre, quand tenter un donjon plus dur."],
      ["h", "La boucle de jeu"],
      ["ol", [
        "Choisis une zone dans **Aventure › Monde** : l'équipe y enchaîne les combats, gagne de l'XP, des kamas, des ressources et des objets.",
        "Équipe tes héros (**Héros › Équipe et héros**, bouton « Équiper au mieux »), répartis leurs caractéristiques et règle leurs sorts.",
        "Recrute de nouveaux héros pour remplir l'équipe : chaque classe différente renforce tout le groupe.",
        "Récupère des clés et attaque les **donjons**, puis monte leur stasis pour de meilleurs butins.",
        "Débloque peu à peu le reste : métiers, forgemagie, quêtes, Dofus, Songe infini, L'Ascension, Kolizéum, guilde…",
      ]],
      ["p", "Même jeu fermé, l'équipe continue à progresser (voir « Absence et hors-ligne »)."],
      ["kv", [["Niveau maximum d'un héros", N(() => E.MAX_LVL)], ["Héros au plus", N(() => E.HERO_MAX)], ["Héros qui combattent", N(() => E.TEAM_MAX)], ["Classes", N(() => D.CLASS_ORDER.length)]]],
      ["tip", "Le bouton **?** dans le bandeau en haut de chaque page ouvre le chapitre du guide de cette page ; « Guide » est aussi en bas du menu. La loupe (Ctrl + K sur PC) cherche n'importe quoi dans le jeu."],
    ] });

  add({ id: "absence", f: "Bien débuter", n: "Absence et hors-ligne", ic: "phenix", page: null, k: "hors ligne offline absence retour consignes",
    ou: "le bilan s'ouvre quand tu reviens · Options › Jeu › Consignes d'absence", de: "dès le début",
    voir: ["sablier", "home"],
    b: () => [
      ["p", "Quand le jeu est fermé (ou l'onglet caché), le temps passé dehors est simulé à ton retour, à partir de tes derniers combats : même taux de victoire, même durée de combat. Un bilan montre ce que l'équipe a gagné."],
      ["kv", [
        ["Efficacité de base", pc(V(() => E.OFFLINE_RATE, 0))],
        ["Durée comptée de base", N(() => E.OFFLINE_MAX_S / 3600) + " h"],
        ["Ton efficacité actuelle", V(() => pc(E.offRate(S())))],
        ["Ta durée actuelle", V(() => fr(E.OFFLINE_MAX_S / 3600 + E.bonus(S(), "offtime")) + " h")],
        ["Bonus d'efficacité au plus", "+" + N(() => E.BONUS_CAP.offrate) + " %"],
        ["Bonus de durée au plus", "+" + N(() => E.BONUS_CAP.offtime) + " h"],
      ]],
      ["ul", [
        "Le bilan ne se fait qu'après plus d'une minute d'absence.",
        "Continuent : la chasse, la récolte, l'atelier, la forgemagie automatique (au même rythme réduit), les familiers et l'élevage (en temps réel), les expéditions.",
        "Un donjon en cours s'arrête : l'équipe chasse dans sa zone à la place.",
        "Le Sablier de Xélor n'accélère jamais le temps d'absence.",
      ]],
      ["h", "Consignes d'absence"],
      ["p", "Dans Options › Jeu, tu dis à l'équipe quoi faire pendant que tu n'es pas là :"],
      ["ul", [
        `**Chasse vagabonde** : l'équipe change de zone toute seule, avec une baisse de ${pc(V(() => E.ROAM_MALUS, 0))} des gains.`,
        "**Revenir à ma zone** quand tu reviens.",
        `**Limite par ressource** : au-delà, le surplus gagné en ton absence est vendu (marchand de secours à ${N(() => E.MERCHANT * (E.MERCHANT < 1 ? 100 : 1))} % de sa valeur, ou vente directe en ligne). Favoris, clés, ressources d'Almanax et de commandes ne sont jamais vendus.`,
        "**Offrande de l'Almanax** faite à ton retour.",
        "**Commandes d'artisans** livrées si elles sont prêtes.",
      ]],
      ["tip", "Les meubles et améliorations du Havre-Sac (Lit douillet, Majordome…) allongent la durée et l'efficacité hors-ligne."],
    ] });

  add({ id: "sablier", f: "Bien débuter", n: "Sablier de Xélor", ic: "cristal", page: null, k: "vitesse x2 x3 x4 accélérer maîtrise du temps maitre",
    ou: "la pastille ⏳ dans la barre du haut (un clic ouvre sa fiche : niveau de Maîtrise du temps, paliers, Horloger)", de: "après « La Crypte de Kardorim », à la fin d'Incarnam (étape " + N(() => E.SAB_UNLOCK_STEP) + " de la quête principale)",
    voir: ["absence", "aide"],
    b: () => [
      ["p", "Le Sablier est une réserve de temps rapide : il fait tourner le jeu ×2 ou ×3 (×4 au niveau 50 de la Maîtrise du temps) tant qu'il reste du sable. Il se remplit en temps réel, jeu ouvert ou fermé, et commence plein."],
      ["kv", [
        ["Remplissage", N(() => E.SAB_RATE * 86400 / 3600) + " h par jour (jusqu'à 5,5 h avec l'Horloge de Xélor et la Maîtrise du temps)"],
        ["Réserve maximum", N(() => E.SAB_MAX / 3600) + " h, +1 h tous les 2 niveaux de Maîtrise du temps (" + N(() => E.SAB_MAX / 3600 + 25) + " h au niveau 50)"],
        ["Avec des heures achetées ou offertes", "12 h de plus que la réserve"],
        ["Coût en ×2", "1 s de réserve par seconde"],
        ["Coût en ×3", "2 s de réserve par seconde"],
        ["Coût en ×4", "3 s de réserve par seconde (niveau 50)"],
        ["Butin en ×2", "−" + N(() => Math.round((1 - E.sabLootAt(2, 1)) * 100)) + " % (−" + N(() => Math.round((1 - E.sabLootAt(2, 40)) * 100)) + " % au niveau 40)"],
        ["Butin en ×3", "−" + N(() => Math.round((1 - E.sabLootAt(3, 1)) * 100)) + " % (−" + N(() => Math.round((1 - E.sabLootAt(3, 40)) * 100)) + " % au niveau 40)"],
        ["Butin en ×4", "−" + N(() => Math.round((1 - E.sabLootAt(4, 50)) * 100)) + " %"],
      ]],
      ["h", "Maîtrise du temps"],
      ["p", "Chaque minute de réserve utilisée donne 1 XP au Sablier (un seul par compte). Il a 50 niveaux : passer du niveau n au suivant demande 30 × n minutes, soit environ 600 h de Sablier pour le niveau 50 (environ 100 jours à 6 h par jour)."],
      ["ul", [
        "Tous les 2 niveaux : +1 h de réserve. Les autres niveaux donnent un Grain de Xélor (+15 min).",
        "Niveaux 10, 20, 30 et 40 : butin moins réduit (×2 −9, −8, −7 puis −6 % ; ×3 −18, −16, −14 puis −12 %).",
        "Niveaux 15 et 35 : +30 min de recharge par jour.",
        "Niveau 15 : le ×2 devient illimité (plus de réserve ni d'XP en ×2 : la Maîtrise avance en ×3 et ×4). La pastille affiche alors « ∞ ».",
        "Niveau 25 : 1 Fiole de temps offerte chaque semaine (2 dès le niveau 45).",
        "Niveau 50 : vitesse ×4 (3 minutes de réserve par minute, butin −25 %) et titre « Maître du temps ».",
      ]],
      ["ul", [
        "Il ne s'use que si quelque chose avance : combat, chasse, donjon, expédition, récolte, atelier, forgemagie. Équipe au repos, il est en pause.",
        "Contrepartie : moins de butin (ressources, équipements, clés et kamas) tant que le temps file plus vite. L'XP et les Dofus ne changent pas. Par heure réelle, ×2 rapporte encore environ 1,8 fois plus de butin et ×3 environ 2,4 fois plus (au niveau 50 : 1,9, 2,7 et 3 fois en ×4).",
        "Réserve vide : retour à la vitesse normale.",
        "Plus d'heures : Horloge de Xélor dans la Chambre du Havre-Sac (+30 min de recharge par jour et par niveau), +1 h au Défi du jour gagné, +30 min avec l'offrande de l'Almanax, +30 min par essai au boss des mondes (3 par jour) et au boss de guilde (2 par jour).",
        "L'Horloger de Xélor (fiche du Sablier) vend une Fiole de temps (+1 h) par achat, 3 par jour, à partir de 5 millions de kamas (le prix double à chaque achat du jour). Les boss de donjon dès la stasis 6 lâchent très rarement un Grain de Xélor (+15 min). Fioles et Grains se vendent à l'hôtel de vente.",
        "Le temps d'absence n'est jamais accéléré.",
      ]],
    ] });

  add({ id: "recherche", f: "Bien débuter", n: "Recherche et raccourcis", ic: "carte", page: null, k: "ctrl k loupe clavier raccourcis",
    ou: "la loupe en haut de l'écran", de: "dès le début",
    b: () => [
      ["p", "La loupe cherche dans tout le jeu : pages, donjons, zones, objets, panoplies, ressources, monstres, Dofus, idoles, familiers, montures, consommables et succès. Les accents, majuscules et une faute de frappe sont tolérés."],
      ["ul", [
        "Sur PC : **Ctrl + K** ou **/** ouvre la recherche.",
        "Sur PC, une lettre ouvre une page (H Havre-Sac, M Monde, D Donjons, C Combat, E Équipe, I Inventaire, Q Quêtes…) ; les flèches gauche et droite passent d'une page à l'autre ; **?** affiche la liste des raccourcis ; **O** ouvre les options.",
        "Options › Aide : le Carnet des découvertes relit toutes les bulles d'aide déjà vues.",
      ]],
    ] });
  /* ======================= Héros et combat ======================= */
  add({ id: "equipe", f: "Héros", n: "Équipe, recrutement et placement", ic: "combat", page: "team", k: "recruter congedier synergie ligne arriere reserve copier coller setup",
    ou: "Héros › Équipe et héros", de: "dès le début (1 héros, les autres se recrutent avec des kamas)",
    voir: ["classes", "caracs", "equipement", "combat"],
    b: () => {
      const cost = [];
      for (let n = 2; n <= (V(() => E.HERO_MAX, 19)); n++) cost.push(V(() => E.recruitCost(n), 0));
      return [
        ["p", "Tu commences avec un héros. Les suivants se recrutent avec des kamas, dans la classe de ton choix, et arrivent niveau 1. Ceux qui ne combattent pas (au-delà de la limite de l'équipe, en récolte ou en formation) restent en réserve."],
        ["kv", [["Héros au plus", N(() => E.HERO_MAX)], ["Héros dans l'équipe de combat", N(() => E.TEAM_MAX)], ["2e héros", fr(cost[0]) + " kamas"], ["5e héros", fr(cost[3]) + " kamas"], ["10e héros", fr(cost[8]) + " kamas"], ["Dernier héros", fr(cost[cost.length - 1]) + " kamas"]]],
        ["ul", [
          "**Congédier** un héros rend la moitié du prix du dernier recrutement ; son équipement revient dans le sac.",
          "**Copier le setup** (menu ⋯ Plus de la fiche) puis **Coller** sur un autre héros : caractéristiques, sorts et stratégies, arbre de Maîtrise (même classe) et équipement. Les objets sont pris dans le sac s'il y en a une copie libre, jamais dupliqués ni retirés à un autre héros.",
          "**Synergie** : +2 % de dommages et d'XP par classe différente dans l'équipe (à partir de 2 héros).",
          `**Collection des classes** : chaque classe montée niveau ${N(() => E.MAX_LVL)} donne +${N(() => E.CLASS_BONUS)} % d'XP et de kamas à tout le compte (même si le héros est supprimé ensuite).`,
          "**Petite équipe** : jouer à 1 à 4 héros donne des points de vie en plus et réduit les dommages subis (plus fort en chasse qu'en donjon).",
        ]],
        ["h", "Placement : première ligne et arrière"],
        ["p", `Chaque héros est en première ligne ou à l'arrière. Tant que la première ligne tient, les attaques à une cible des monstres la visent ${pc(V(() => E.FRONT_P, 0.75))} du temps. La première ligne compte au plus la moitié de l'équipe (arrondie au-dessus).`],
        ["ul", [
          "Le placement automatique met devant les héros les plus solides (points de vie × résistances, bonus pour Sacrieur, Féca, Pandawa, Zobal et Forgelance).",
          "Pour changer la ligne d'un héros : la flèche ↑ ou ↓ à côté de son nom dans la liste de l'équipe, le bouton « Passer devant » ou « Passer derrière » sur sa fiche, ou le plateau de « Réorganiser ». Le placement passe alors en manuel ; il faut toujours au moins un héros devant.",
          "Les monstres **Rôdeurs** visent l'arrière, les **Bondisseurs** ignorent les lignes. Le Tacle ramène les coups devant, la Fuite aide l'arrière à esquiver.",
        ]],
      ];
    } });

  add({ id: "classes", f: "Héros", n: "Les classes", ic: "couronne", page: "team", k: "classe passif element feca iop cra sram piege invisibilite honneur",
    ou: "Héros › Équipe et héros › Recruter", de: "toutes les classes dès le début",
    voir: ["equipe", "sorts"],
    b: () => [
      ["p", `${N(() => D.CLASS_ORDER.length)} classes, chacune avec ses sorts, une caractéristique principale, un élément conseillé et un passif propre :`],
      ["ul", V(() => D.CLASS_ORDER.map((k) => { const C = D.CLASSES[k]; return `**${C.name}** · ${C.passive ? C.passive.name + " : " + C.passive.desc : ""}`; }), [])],
      ["p", "Au Kolizéum, le Féca, le Sadida, l'Enutrof, le Sacrieur, l'Eniripsa et le Zobal gardent leurs anciens passifs (sans sève, butin de guerre, Transposition ni soin en trop) : l'arène est équilibrée à part."],
      ["h", "Les pièges du Sram"],
      ["ul", [
        `Un sort de piège ne frappe pas tout de suite : il **pose le piège** (${N(() => E.SR_TRAP_MAX)} au plus par Sram, jamais deux fois le même). La jauge sous le Sram compte ses pièges posés.`,
        `Au début du tour du prochain ennemi (un héros adverse au Kolizéum), le plus ancien piège **explose** sous lui et ses voisins : dégâts du sort ×${N(() => String(E.SR_TRAP).replace(".", ","))}.`,
        `**Réaction en chaîne** : chaque piège qui explose dans le même tour de jeu fait +${N(() => Math.round(E.SR_CHAIN * 100))} % de plus que le précédent (+${N(() => Math.round(E.SR_CHAIN * 300))} % au plus).`,
        `**Invisibilité** et **Brume** : ${N(() => E.SR_INVIS)} tours dans l'ombre, −${N(() => Math.round(E.SR_HIDE * 100))} % de dégâts reçus, et +${N(() => Math.round(E.SR_AMBUSH * 100))} % au premier coup en sortant.`,
      ]],
      ["h", "La classe à l'honneur"],
      ["p", V(() => `Chaque semaine (le lundi), une classe peu jouée est à l'honneur : ses héros gagnent +${E.HONOR_PCT} % d'XP (et de Maîtrise au niveau ${E.MAX_LVL}) et une équipe qui en a au moins un a +${E.HONOR_PCT} % de butin. Cette semaine : **${D.CLASSES[E.honorCls()].name}**.`, "")],
    ] });

  add({ id: "niveaux", f: "Héros", n: "Niveaux et expérience", ic: "trophee", page: "team", k: "xp experience niveau sagesse malus",
    ou: "Héros › Équipe et héros", de: "dès le début",
    voir: ["maitrise", "caracs"],
    b: () => [
      ["p", "Chaque victoire donne de l'XP, partagée entre les héros de l'équipe. Plus l'équipe est grande, plus la part de chacun est petite, mais le total grandit."],
      ["kv", [
        ["Niveau maximum", N(() => E.MAX_LVL)],
        ["XP du niveau 10 au 11", N(() => E.xpNeed(10))],
        ["XP du niveau 50 au 51", N(() => E.xpNeed(50))],
        ["XP du niveau 100 au 101", N(() => E.xpNeed(100))],
        ["XP du niveau 199 au 200", N(() => E.xpNeed(199))],
        ["Part par héros, seul", pc(V(() => E.xpShare(1), 0))],
        ["Part par héros, à 8", pc(V(() => E.xpShare(8), 0))],
      ]],
      ["ul", [
        "La **Sagesse** augmente l'XP : +1 % par point.",
        "Chaque monstre en plus dans le groupe donne +10 % d'XP.",
        `Un héros plus de ${N(() => E.XP_PEN.free, 6)} niveaux au-dessus des monstres perd de l'XP (−5 % par niveau, jusqu'à 30 % gardés).`,
        "Boss ×6, archimonstre ×5, Champion ×3 d'XP.",
        "Chaque niveau donne 5 points de caractéristiques.",
        "Au niveau 200, l'XP remplit la Maîtrise (voir Maîtrise).",
      ]],
    ] });

  add({ id: "caracs", f: "Héros", n: "Caractéristiques", ic: "parchemin_or", page: "team", pages: ["hstats"], k: "vitalite sagesse force intelligence chance agilite points parchemin auto",
    ou: "Héros › Équipe et héros › fiche du héros › Caractéristiques", de: "dès le début",
    voir: ["niveaux", "combat"],
    b: () => [
      ["p", "Chaque niveau donne 5 points à répartir entre Vitalité, Sagesse, Force, Intelligence, Chance et Agilité. Le mode automatique (actif par défaut) suit un plan selon la classe ; tu peux le modifier ou passer en manuel. Remettre les points à zéro est gratuit."],
      ["kv", [["Vitalité", "1 point = 1"], ["Sagesse", "3 points = 1"], ["Élément jusqu'à 100", "1 point = 1"], ["Élément de 100 à 200", "2 points = 1"], ["Élément de 200 à 300", "3 points = 1"], ["Élément au-delà de 300", "4 points = 1"], ["Étapes du plan automatique", N(() => E.PLAN_MAX)], ["Parchemins par caractéristique", N(() => E.SCROLL_MAX)]]],
      ["h", "À quoi servent-elles"],
      ["ul", [
        "**Vitalité** : points de vie (50 + 5 par niveau + Vitalité).",
        "**Sagesse** : +1 % d'XP par point.",
        "**Force** (terre), **Intelligence** (feu), **Chance** (eau), **Agilité** (air) : +1 % de dommages de l'élément par point, et de l'Initiative.",
        "Les PA partent de 6 (+1 au niveau 100, + équipement, 12 au plus).",
      ]],
      ["h", "Parchemins"],
      ["p", `Les petits parchemins donnent +1, les grands +3, pour toujours, jusqu'à ${N(() => E.SCROLL_MAX)} par caractéristique et par héros. Ils ne comptent pas dans les paliers de coût. Les petits se fabriquent avec de la Poussière de stasis et des kamas (le prix monte à chaque fabrication).`],
    ] });

  add({ id: "sorts", f: "Héros", n: "Sorts et stratégies", ic: "idee", page: "team", pages: ["spells"], k: "sort variante barre condition cible preset strategie identite mecanique poutch apercu ordre mon ordre sequence auto attaques",
    ou: "Héros › Équipe et héros › fiche du héros › Sorts & stratégies", de: "les sorts arrivent avec les niveaux",
    voir: ["combat", "maitrise"],
    b: () => [
      ["p", "Chaque classe a 22 paires de sorts : un sort de base et sa variante. Une seule des deux peut être sur la barre. Les sorts de base arrivent jusqu'au niveau 90 environ, les variantes ensuite jusqu'au niveau 200 ; un sort gagne en puissance avec ses grades."],
      ["kv", [["Cases sur la barre", "6, +1 au niveau 50, +1 au niveau 100"], ["Lancers d'un même sort par tour", "3 au plus"], ["Stratégies enregistrées", N(() => E.MAX_PRESETS)], ["Conditions possibles", N(() => Object.keys(D.CONDITIONS).length)], ["Cibles possibles", N(() => Object.keys(D.TARGETS).length)]]],
      ["ul", [
        "Tant que tu n'as pas touché la barre, elle se remplit seule : au moins 3 attaques, puis une invocation, un soin et une protection.",
        "Chaque sort peut avoir une **condition** (par exemple « si un allié a moins de 50 % de vie ») et une **cible** préférée.",
        "Les sorts de **Soutien** (invocations, soins, boucliers, bonus) partent d'abord, dans l'ordre de la barre, si leur condition est remplie.",
        "Les **Attaques** sont en **Auto** par défaut : avec les PA qui restent, le héros prend la combinaison qui fait le plus de dégâts, en tenant compte de son passif de classe (l'Huppermage alterne ses éléments) et des effets de ses sorts.",
        "Avec **« Mon ordre »**, les attaques sont numérotées et partent une fois chacune, de gauche à droite, puis ça recommence ; s'il manque de PA, le héros passe à la suivante. « Ce que fera ton héros » compare alors ton ordre à l'Auto et propose d'y revenir s'il fait moins de dégâts.",
        "Une **stratégie** est une barre enregistrée, avec son réglage Auto ou « Mon ordre » ; elle peut être liée à une zone.",
        "L'arme équipée ajoute un **coup d'arme** sur la barre (voir Équipement).",
        "Chaque sort a sa propre **mécanique** (cumul, retardement, piège, glyphe, bombe, portail…), expliquée dans le bloc « Identité du sort » de sa fiche. En combat, les noms des sorts ne s'affichent pas : on reconnaît un sort à son animation.",
        `Le bloc **« Ce que fera ton héros »** le fait taper un **Poutch de ${N(() => E.POUTCH_HP)} PV** qui ne riposte pas, pendant ${N(() => E.POUTCH_TOURS)} tours, seul ou avec l'équipe : chaque tour, ses sorts, leurs dégâts, leurs mécaniques et ses PA. C'est le moyen de vérifier ses instructions. Une seule cible : les sorts de zone y partent moins qu'en vrai combat.`,
      ]],
    ] });

  add({ id: "equipement", f: "Héros", n: "Équipement, panoplies et armes", ic: "sac", page: "team", k: "equiper au mieux verrouiller cadenas panoplie arme coup d'arme tenue exo legendaire",
    ou: "Héros › Équipe et héros › fiche du héros › Équipement", de: "dès le début",
    voir: ["inventaire", "forgemagie", "dofus"],
    b: () => [
      ["p", "Un héros porte une coiffe, une cape, une amulette, deux anneaux, une ceinture, des bottes, une arme, un bouclier et jusqu'à 6 Dofus ou trophées, plus un familier et une monture."],
      ["ul", [
        "Un objet doit être d'un niveau inférieur ou égal à celui du héros.",
        "Pas deux fois le même anneau, ni le même Dofus ou trophée.",
        "Un seul exo PA, un seul exo PM et un seul exo PO par héros ; un seul objet légendaire.",
        "Sur la fiche, un objet exo porte une pastille violette avec l'icône de sa caractéristique, et un objet Parfait (toutes ses caractéristiques au jet maximum) un contour doré avec une étoile.",
        "**Équiper au mieux** choisit les meilleures pièces selon la vraie répartition de caractéristiques du héros, en testant les panoplies entières ; « Privilégier » fait compter une caractéristique beaucoup plus.",
        "**Rechercher** : quand on clique un emplacement, le champ en haut de la liste filtre les objets par nom, par panoplie ou par caractéristique (« PA », « Vitalité »…). Un clic sur l'étiquette « Pano. … » montre les pièces de la panoplie (portées, dans le sac ou pas encore obtenues) et ses bonus, sans passer par l'encyclopédie ; même chose dans la fiche d'un objet de l'inventaire.",
        "**Verrouiller** (bouton du cadenas quand on clique un emplacement) : l'objet porté reste en place, « Équiper au mieux » et « Tout équiper au mieux » n'y touchent plus.",
        `**Tenues** : ${N(() => E.MAX_GEAR)} équipements complets enregistrés par héros (un de plus avec la Collection de panoplies).`,
      ]],
      ["h", "Panoplies"],
      ["p", `${N(() => Object.keys(D.SETS).length)} panoplies. Leur bonus dépend du nombre de pièces portées : c'est le palier le plus haut atteint qui compte (les paliers ne s'additionnent pas).`],
      ["h", "Armes et coup d'arme"],
      ["p", `L'arme ajoute un sort « coup d'arme » qui frappe avec les vrais dégâts de l'arme ×${N(() => E.WEAPON.mult)}. Chaque classe a 2 types d'armes favoris (+${N(() => E.WEAPON.fav * 100)} %). Chaque type a son effet :`],
      ["ul", V(() => Object.keys(E.WTYPES).map((k) => { const W = E.WTYPES[k]; return `**${W.name}**${W.desc ? " : " + W.desc : W.fxName ? " : " + W.fxName : ""}`; }), [])],
    ] });

  add({ id: "combat", f: "Bien débuter", n: "Le combat", ic: "combat", page: "combat", go: true, k: "initiative pa critique resistance defaite manuel tour",
    ou: "Combat (ou le combat en cours depuis le Havre-Sac)", de: "dès le début",
    voir: ["sorts", "equipe", "donjons"],
    b: () => [
      ["p", "Les combats se jouent seuls, tour par tour. À chaque tour, l'ordre de jeu suit l'**Initiative**. Un héros dépense ses PA dans les sorts de sa barre, de gauche à droite, quand leur condition est remplie."],
      ["ul", [
        "Initiative d'un héros : 100 + 5 par niveau + Force + Intelligence + Chance + Agilité + Initiative de l'équipement. Les boss jouent deux fois par tour.",
        "Les PM ne servent pas à se déplacer : ils donnent de l'esquive en première ligne et de la poussée.",
        `Coup critique : 5 % + %Critique (60 % au plus), dégâts ×1,25 + dommages critiques.`,
        "Résistances en % : 50 % au plus. Les boucliers absorbent les dégâts d'abord.",
        `Le combat est perdu si tous les héros tombent, ou au-delà de 60 tours (retraite). Dès la stasis 9, les donjons ont une limite de tours (${N(() => E.STASIS_TL.room)} par salle, ${N(() => E.STASIS_TL.boss)} pour le boss).`,
      ]],
      ["h", "Défaite"],
      ["ul", [
        "En chasse, une défaite n'enlève rien : ni XP ni objet, l'équipe se relève et recommence.",
        "« Pourquoi j'ai perdu » garde les 6 dernières défaites expliquées.",
        "Avec la progression automatique, l'équipe redescend d'une zone après 3 défaites sur les 6 derniers combats, et remonte après 12 victoires d'affilée.",
        "En donjon, une défaite fait perdre la clé (sauf Fiole de résurrection, une fois par donjon).",
      ]],
      ["h", "Challenges"],
      ["ul", [
        "Chaque combat tire un challenge (deux en donjon) : réussi, il donne un bonus d'XP et de butin.",
        "Avec « Respecter les challenges » (page Combat), l'IA évite ce qui les ferait échouer. Le bouton à côté (11/11) choisit les challenges que l'équipe suit : les autres sont ignorés.",
        `Si le combat tourne mal, les héros oublient les challenges pour gagner : Élitiste et Ordonné sous ${N(() => Math.round(E.CHAL_GIVEUP_TGT * 100))} % des PV de l'équipe, les autres sous ${N(() => Math.round(E.CHAL_GIVEUP * 100))} %, et tous dès qu'un héros tombe. Pas dans le Défi du jour, où les règles comptent dans le score.`,
      ]],
      ["h", "Mode manuel"],
      ["p", `Sur la page Combat, le mode manuel te laisse choisir chaque sort. Sans réponse au bout de ${N(() => E.MANUAL_TIMEOUT)} s, le héros joue tout seul.`],
    ] });
  add({ id: "chasse", f: "Héros", n: "Champions, Sceaux et Éclats", ic: "trophee", page: "chasse", k: "champion sceau eclat eveil comptoir appat legendaire pouvoir cri conclave fusion piste",
    ou: "Héros › Chasse", de: "le premier Champion vaincu débloque son Sceau",
    voir: ["world", "combat"],
    b: () => [
      ["p", `En chasse, environ 1 groupe sur ${N(() => Math.round(1 / E.CHAMP_CHANCE))} cache un **Champion** : un monstre avec un pouvoir (Enragé, Blindé, Vampirique, Véloce, Meneur ou Traqueur), deux fois plus de vie et 20 % de dégâts en plus. Il rapporte XP ×3, butin ×2 et sa ressource la plus rare.`],
      ["h", "Sceaux"],
      ["p", "Chaque Champion vaincu compte pour le Sceau de son pouvoir. Un héros porte un Sceau ; son effet grandit avec le rang."],
      ["kv", V(() => E.SEAL_RANKS.map((x, i) => [`Rang ${i + 1}`, `${fr(x)} Champion${x > 1 ? "s" : ""}`]), [])],
      ["ul", V(() => (E.SEAL_ORDER || Object.keys(E.SEALS)).map((k) => { const s = E.SEALS[k]; return `**${s.name}** au rang max : ${s.txt(s.max)}`; }), [])],
      ["ul", [
        `**Fusion** : deux Sceaux au rang max donnent un Sceau double avec les deux pouvoirs à ${pc(V(() => E.SEAL_FUSE_PCT, 0))}.`,
        `**Cri du Champion** : une fois par combat, sous ${pc(V(() => E.SEAL_CRI_HP, 0))} de vie, les pouvoirs du Sceau doublent pendant ${N(() => E.SEAL_CRI_TURNS)} tours (rang max ou Sceau fusionné).`,
        `**Conclave** : 4 héros portant 4 pouvoirs différents donnent +${N(() => E.SEAL_RESO * (E.SEAL_RESO < 1 ? 100 : 1))} % de dégâts et de vie.`,
        "Les Sceaux sont coupés au Kolizéum.",
      ]],
      ["h", "Trophée de zone, pistes et légendaire"],
      ["ul", [
        `Battre les 6 pouvoirs dans une même sous-zone : +${N(() => E.CHAMP_ZONE_BONUS * (E.CHAMP_ZONE_BONUS < 1 ? 100 : 1))} % d'XP, de kamas et de butin pour toujours dans cette sous-zone.`,
        `Chaque Champion laisse une piste. À ${N(() => E.CHAMP_TRAILS)} pistes, « Appeler le légendaire » le fait venir au combat suivant : tous les pouvoirs, vie ×${N(() => E.CHAMP_LEG_HP)}, dégâts ×${N(() => E.CHAMP_LEG_DMG)}.`,
        `Le vaincre donne un titre et ${N(() => E.CHAMP_LEG_SHARDS)} **Éclats de champion** ; perdu, les pistes restent.`,
        `**Appel automatique** (bouton sous la traque, en combat ou dans le menu Chasse) : le légendaire est appelé tout seul dès ${N(() => E.CHAMP_TRAILS)} pistes dans la zone chassée. Après une défaite contre lui, pause de ${N(() => E.CHAMP_AUTO_PAUSE / 60000)} min dans cette zone.`,
        "Un Éclat = +1 Champion compté sur le Sceau de ton choix.",
      ]],
      ["h", "Éveil des Sceaux"],
      ["ul", [
        `Un Sceau au rang max s'éveille avec des Éclats : ${N(() => E.SEAL_EV_MAX)} niveaux, +${pc(V(() => E.SEAL_EV_STEP, 0))} de son effet par niveau (Véloce : +${N(() => E.SEAL_EV_VELOCE)} % de dégâts au 1er tour par niveau).`,
        `Coût par niveau : ${V(() => E.SEAL_EV_COST.map(fr).join(", "), "")} Éclats. Un Sceau fusionné garde l'Éveil le plus bas de ses deux pouvoirs.`,
        "Les 6 Sceaux éveillés au maximum donnent le titre « Champion éveillé ».",
      ]],
      ["h", "Comptoir des Éclats"],
      ["ul", [
        `**Appât** (${N(() => E.SHARD_SHOP.appat.cost)} Éclats) : le prochain Champion de la chasse a le pouvoir choisi.`,
        `**Piste fraîche** (${N(() => E.SHARD_SHOP.piste.cost)}) : +1 piste vers le légendaire. **Coffre en argent** (${N(() => E.SHARD_SHOP.coffre.cost)}) : environ 15 minutes de chasse.`,
        `Ornement « Éclat doré » (${N(() => E.SHARD_SHOP.orn.cost)}) et titre « Collectionneur d'éclats » (${N(() => E.SHARD_SHOP.titre.cost)}), une fois chacun.`,
        `Revente : ${N(() => E.SHARD_SELL_N)} Éclats contre ${N(() => E.SHARD_SELL * E.SHARD_SELL_N)} kamas.`,
        "Les Champions tués avant la 1.1 ne comptent pas.",
      ]],
    ] });

  add({ id: "familiers", f: "Héros", n: "Familiers et montiliers", ic: "../p/18003", page: "pets", pages: ["pet"], k: "familier montilier ame friandise eveil etoile essence album menagerie",
    ou: "Héros › Familiers et montures (et l'onglet Familier de la fiche du héros)", de: `familier dès le niveau ${N(() => E.PET_LVL)} du héros, montilier dès le niveau ${N(() => E.MONTI_LVL)}`,
    voir: ["montures", "elevage"],
    b: () => [
      ["p", "Un familier donne des caractéristiques à son héros et grandit en combattant. Un montilier prend à la fois la place du familier et de la monture."],
      ["h", "Les obtenir"],
      ["kv", [
        ["Familier de zone, par victoire", "1 / " + N(() => Math.round(1 / E.PET_ZONE_RATE))],
        [`Après ${N(() => E.PET_TRACE_N)} traces`, "1 / " + N(() => Math.round(1 / E.PET_TRACE_RATE))],
        ["Familier de boss (stasis 7+)", "1 / " + N(() => Math.round(1 / E.PET_BOSS_RATE))],
        ["Montilier (stasis 6+)", "1 / " + N(() => Math.round(1 / E.MONTI_RATE))],
        ["Montilier garanti au", N(() => E.MONTI_PITY) + "e essai"],
        ["Montilier légendaire (stasis 8+)", "1 / " + N(() => Math.round(1 / E.MONTI_LEG_RATE))],
        ["Doublon d'un familier", N(() => E.PET_DUP_ESS) + " Essence"],
        ["Doublon d'un montilier", N(() => E.MONTI_DUP_ESS) + " Essence"],
      ]],
      ["h", "Les faire grandir"],
      ["ul", [
        `Chaque monstre vaincu donne 1 âme au familier porté (${N(() => E.PET_PREY)} pour ses proies favorites). ${N(() => E.PET_SOUL_LVL)} âmes = 1 niveau, jusqu'au niveau 100.`,
        `Friandise : ${N(() => E.PET_TREAT_N)} de sa nourriture préférée = +1 niveau, ${N(() => E.PET_TREAT_DAY)} fois par jour au plus.`,
        `Un montilier grandit avec ${N(() => E.MONTI_SHARE * (E.MONTI_SHARE < 1 ? 100 : 1))} % de l'XP de son héros.`,
        "Les caractéristiques vont de 20 % à 100 % du maximum selon le niveau ; PA, PM et Invocation ne comptent qu'au niveau 100.",
        "Au niveau 100, le familier gagne l'aptitude de sa famille (Soin, Flair, Écaille, Esquive, Souffle, Griffe, Racines).",
        `**Éveil** (niveau 100) : jusqu'à 5 étoiles, +${N(() => E.PET_STAR_PCT * (E.PET_STAR_PCT < 1 ? 100 : 1))} % chacune, payées en Essence et kamas. À 5 étoiles, aura de +${N(() => E.PET_AURA)} % de dégâts pour l'équipe (${N(() => E.PET_AURA_MAX)} % au plus).`,
      ]],
      ["h", "Album de la ménagerie"],
      ["ul", V(() => E.PET_TIERS.map((t) => `**${fr(t.n || t[0])}** familiers : ${t.desc || t.name || t[1] || ""}`), [])],
    ] });

  add({ id: "montures", f: "Héros", n: "Montures", ic: "../mt/97021", page: "pets", k: "monture dragodinde muldo volkorne filet capture couleur",
    ou: "Héros › Familiers et montures › Montures · Héros › Élevage › Capture", de: `héros niveau ${N(() => E.MOUNT_LVL)}, puis selon l'espèce`,
    voir: ["elevage", "familiers"],
    b: () => [
      ["p", "Une monture donne des caractéristiques à son héros et grandit avec une part de son XP. On la capture dans sa zone sauvage avec un filet, puis on peut l'élever."],
      ["kv", V(() => Object.keys(E.MOUNT_SP).map((k) => { const M = E.MOUNT_SP[k]; const nm = (E.MOUNTS && E.MOUNTS[k] && E.MOUNTS[k].name) || { dd: "Dragodinde", mu: "Muldo", vk: "Volkorne" }[k] || k; const z = E.SUBS && E.SUBS[M.sub]; return [`${nm} (héros niv. ${fr(M.req)}${z ? ", " + z.name : ""})`, "1 / " + fr(Math.round(1 / M.rate)) + " par victoire"]; }), [])],
      ["ul", [
        `Il faut un filet dans le sac (${N(() => E.NET_COST)} kamas) ; il n'est utilisé que si la capture réussit.`,
        "La chance est par victoire, pas par héros, et les bonus de butin ne la changent pas. Chaque couleur sauvage a la même chance.",
        `Part de l'XP du héros réglable (${V(() => E.MOUNT_SHARES.join(", "), "")} %), ${N(() => E.MOUNT_SHARE_DEF)} % par défaut.`,
        `Niveau maximum ${N(() => E.MOUNT_MAX)} ; PA, PM et Invocation ne comptent qu'au niveau maximum.`,
      ]],
    ] });

  add({ id: "elevage", f: "Héros", n: "Élevage", ic: "../mt/97021", page: "elev", k: "enclos ecurie accouplement naissance couleur etoile capacite essence balade",
    ou: "Héros › Élevage, aussi en onglet de Familiers et montures (Enclos, Écurie, Carnet, Capture)", de: `construire l'enclos (${N(() => E.ENCLOS_COST)} kamas)`,
    voir: ["montures"],
    b: () => [
      ["p", "L'élevage fait naître de nouvelles montures : nouvelles couleurs, plus d'étoiles, capacités. Deux montures d'une même espèce forment un couple dans l'enclos."],
      ["kv", [
        ["Écuries", "une par espèce (Dragodindes, Muldos, Volkornes)"], ["Places de base par écurie", N(() => E.STABLE)], ["Avec l'enclos", "+" + N(() => E.STABLE_SP_ENCLOS) + " par écurie"], ["Carnet de l'espèce complet", "+" + N(() => E.STABLE_CARNET) + " à son écurie"],
        ["Agrandissement acheté", "+" + N(() => E.STABLE_BUY) + " à une écurie, prix doublé à chaque fois"], ["Places au plus", N(() => E.STABLE_SP_MAX) + " par écurie"],
        ["Couples en même temps", N(() => E.PAIRS_BASE) + " (+1 possible)"], ["Niveau pour se reproduire", N(() => E.BREED_LVL)], ["Petits par monture", N(() => E.KIDS)],
        ["Durée d'une naissance", N(() => E.BIRTH_MS / 3600000) + " h"], ["Chance de capacité", pc(V(() => E.CAP_PCT > 1 ? E.CAP_PCT / 100 : E.CAP_PCT, 0))], ["Naissance chromatique", "1 / " + N(() => E.CHR_ODDS)],
      ]],
      ["ul", [
        "Avec une recette connue, la chance d'une nouvelle couleur part de 20 % et monte avec la pureté des parents (une monture capturée compte comme pure), jusqu'à 60 %.",
        `Un petit reçoit la moyenne des étoiles de ses parents, avec ${pc(V(() => E.ST_UP > 1 ? E.ST_UP / 100 : E.ST_UP, 0))} de chance d'une de plus et ${pc(V(() => E.ST_DOWN > 1 ? E.ST_DOWN / 100 : E.ST_DOWN, 0))} d'une de moins (${N(() => E.ST_BASE)} étoiles au plus, +1 avec le carnet complet, +1 si chromatique).`,
        `**Essence** : relâcher une monture en donne (niveau × étoiles). ${N(() => E.ESS_LVL)} Essence = +1 niveau ; ${N(() => E.ESS_STAR)} Essence = +1 étoile (une fois par jour et par monture), avec le bouton « +1 étoile » de la fiche de la monture (Héros › Élevage › Écurie › Fiche). C'est le seul moyen de monter les étoiles d'une monture déjà née, chromatique comprise.`,
        `**Objets d'élevage** (Baffeur, Caresseur, Foudroyeur, Dragofesse) : 5 niveaux, chacun dure ${N(() => E.ITEM_USES)} naissances.`,
        `**Balades** de 4 h ou 8 h : Essence et ressources (${N(() => E.BAL_MAX)} en même temps, monture niveau ${N(() => E.BAL_LVL)}+).`,
        `**Commandes d'éleveur** : ${N(() => E.ORD_N)} par jour.`,
        "Les jours d'Almanax « enclos » : objets moins chers, balades ×2, plus de chance d'étoile.",
      ]],
    ] });

  add({ id: "dofus", f: "Héros", n: "Dofus", ic: "dofus", page: "dofus", pages: ["dofusq", "dpot"], k: "dofus quete butin boss potentiel eclat sublime primordial",
    ou: "Héros › Dofus (Collection, Quêtes et butin, Potentiel, Par héros)", de: "par les quêtes de Dofus et les boss",
    voir: ["donjons", "archis"],
    b: () => {
      const O = V(() => E.DOFUS_ODDS, []);
      return [
        ["p", `${N(() => E.DOFUS_ORDER.length)} Dofus, chacun avec ses caractéristiques et un passif unique. Un héros en porte jusqu'à 6 (le même Dofus ne compte qu'une fois).`],
        ["h", "Les obtenir"],
        ["ul", [
          "**Quête** : chaque Dofus a une quête, une fois par compte, qui le donne à la dernière étape.",
          "**Butin du boss** : chaque héros de l'équipe a sa propre chance quand le boss du Dofus est vaincu. Plus la stasis est haute, meilleure est la chance, jusqu'à la stasis 10 (au-delà, même chance).",
          "**Aucun bonus** (butin, prospection, idoles…) ne change ces chances.",
          "Le Dofus Ocre vient de l'Album des archimonstres.",
          "« Y aller » sur une ressource de quête lance la chasse ; la pastille « ← Retour aux Dofus » ramène ensuite au même endroit pour choisir la suivante.",
        ]],
        ["kv", Array.isArray(O) ? [1, 4, 7, 10].map((k) => [`Stasis ${k}`, O[k - 1] ? "1 / " + fr(O[k - 1]) : "?"]) : []],
        ["h", "Potentiel"],
        ["ul", [
          `Rangs 0 à ${N(() => E.DPOT_MAX)}, +${N(() => E.DPOT_PCT * (E.DPOT_PCT < 1 ? 100 : 1))} % aux caractéristiques et au passif par rang (PA, PM, PO et Invocation ne montent pas).`,
          `Éclats : ${N(() => E.DPOT_ECL)} × la stasis par donjon terminé, pour chaque Dofus porté dans l'équipe.`,
          `Rang 1 : ${N(() => E.dpotNeed(1))} éclats ; rang 10 : ${N(() => E.dpotNeed(10))} éclats, plus des kamas (rang² × ${N(() => E.DPOT_KAMAS)}).`,
          "Un exemplaire en double du même Dofus vaut un rang d'éclats.",
          "Rang X = **Sublimé** : +50 %, aura dorée et annonce sur le serveur.",
          `Porter les 6 Dofus primordiaux réveille l'**Éveil des Dragons** : +${N(() => E.DOFP_RESO * (E.DOFP_RESO < 1 ? 100 : 1))} %.`,
          `Au Kolizéum, les passifs comptent ×${N(() => E.DOFP_PVP)}.`,
          "La **Lueur d'Ilyzaelle** (Dofus Argenté Scintillant) ne sauve qu'un allié par équipe et par combat, même avec plusieurs porteurs.",
        ]],
      ];
    } });

  add({ id: "inventaire", f: "Héros", n: "Inventaire et sac", ic: "sac", page: "inv", pages: ["invres", "invcons"], k: "sac trop plein place ressources consommables runes briser doublons coffre tout ouvrir automatique",
    ou: "Héros › Inventaire", de: "dès le début",
    voir: ["equipement", "forgemagie", "home"],
    b: () => [
      ["p", "Le sac garde les équipements. Ressources, consommables et runes ont leurs onglets et ne sont pas limités."],
      ["kv", [["Places du sac de base", N(() => E.ITEM_CAP)], ["Ta taille de sac", V(() => fr(E.itemCap(S())))], ["Trop-plein de base", N(() => E.OVER_CAP)], ["Ton trop-plein", V(() => fr(E.overCap(S())))]]],
      ["ul", [
        "Sac plein : les nouveaux objets vont dans le **trop-plein**. Quand lui aussi est plein, l'objet le plus ancien est brisé en runes.",
        "Les Dofus ne quittent jamais le sac.",
        "Le Grenier du Havre-Sac et certains meubles agrandissent le sac et le trop-plein.",
        "Les **règles automatiques** peuvent vendre ou briser ce qui ne t'intéresse pas ; « Briser les doublons » fait de la place d'un coup. « Sous le niveau » brise les objets lâchés plus bas que le niveau choisi, quel que soit le niveau de tes héros (panoplies, Rayonnants et exo gardés). Si tu règles à la fois le jet et un niveau, l'objet doit remplir toutes les conditions pour être brisé ; choisis « une seule suffit » pour briser selon le niveau quel que soit le jet.",
        "**Coffres** : « Tout ouvrir » (onglet Consommables ou tuile de l'accueil) les ouvre tous d'un coup, les plus précieux d'abord. Mode **Auto** : chaque coffre gagné s'ouvre tout seul et le butin est noté dans le journal. Les kamas dépendent du niveau de ton meilleur héros au moment de l'ouverture.",
      ]],
    ] });

  add({ id: "maitrise", f: "Héros", n: "La Maîtrise", ic: "cristal", page: "maitrise", k: "maitrise arbre constellation cle de voute joyau nebuleuse bestiaire famille renaissance eveil brouillon objectif image branche porte",
    ou: "Héros › Maîtrise", de: `un héros niveau ${N(() => E.MAX_LVL)}`,
    voir: ["niveaux", "sorts", "metiers"],
    b: () => [
      ["p", `Au niveau ${N(() => E.MAX_LVL)}, l'XP d'un héros remplit des **niveaux de Maîtrise**, sans fin. Chaque niveau donne 1 point et coûte de plus en plus cher : le point n coûte (20 + n/5) fois l'XP du niveau ${N(() => E.MAX_LVL - 1)} → ${N(() => E.MAX_LVL)}. Le x2 des événements ne compte pas pour la Maîtrise. Les points se placent dans le ciel de sa classe. Les points sont propres à chaque héros et n'agissent qu'au niveau ${N(() => E.MAX_LVL)}.`],
      ["kv", [["XP du 1er point de Maîtrise", N(() => E.mtNeed(0))], ["XP du 100e point", N(() => E.mtNeed(99))], ["XP du 400e point", N(() => E.mtNeed(399))], ["Rendre des étoiles gratuit jusqu'à", N(() => E.MT_FREE) + " points placés"], ["Ensuite, par point rendu", N(() => E.MT_RESPEC) + " kamas"], ["Nébuleuse cachée", N(() => E.MT_OPEN) + " points"], ["Part de la monture au niveau 200", "0 à 50 %"]]],
      ["ul", [
        "Un **ciel par classe** d'environ 1 500 étoiles : le cœur renforce le passif de la classe (son symbole s'allume quand les 26 étoiles du cœur sont prises), 6 domaines (les deux éléments forts de la classe en haut) et des **clés de voûte** qui changent le style de jeu avec une contrepartie.",
        "**Voir l'effet d'une étoile** : survole-la sur PC, ou touche-la une fois sur téléphone (une seconde fois pour la prendre). La bulle montre son effet, ce que tout le chemin ajoute et son coût ; le total de l'arbre est dans « Total des bonus ».",
        "**Notables** : chaque grande étoile au bout d'une branche a son nom et son bonus à elle (126 par ciel, aucune en double), dont des effets rares : dégâts critiques, dégâts au premier tour, dégâts sous la moitié des PV, bouclier de départ.",
        "**Branches lointaines** : 5 Portes des étoiles entre les domaines, chacune ouvre une branche combat et une branche farm (vol de vie, dégâts aux boss, butin, kamas, XP…). Une Porte s'ouvre pour tout le compte en terminant le donjon de son boss : Kabahal (stasis 12), Roi Imagami (13), L'Éternel Conflit (13), Belladone (14), Déchireuse (15).",
        "**Fiche du héros** : le bloc Maîtrise montre son niveau, ses points, la barre d'XP du prochain niveau, ses clés de voûte et le total de ses bonus.",
        "3 arbres enregistrés par héros, comparaison avant de changer, annulation des 10 derniers points, recherche (« Y aller » mène à l'étoile trouvée la plus proche), chemin vers une étoile lointaine, code de partage et **image de l'arbre** (bouton « Image »).",
        "**Brouillon** (bouton ✎ sur l'arbre) : pose des étoiles en pointillés, vois le coût et les bonus, puis « Valider ». Les profils Dégâts, Tank, Farm et Boss remplissent le brouillon avec des règles simples ; un arbre fait main reste meilleur. Le bouton « Placer les N points » pose d'un coup tous les points libres sur les meilleurs bonus, sans jamais prendre de clé de voûte (« Annuler » les rend).",
        "**Objectif** : sur une clé de voûte, « En faire mon objectif » trace le chemin ; les points libres et ceux des prochains niveaux s'y posent tout seuls.",
        "**Rendre une étoile** prise rend aussi celles qui en dépendent (entourées en rouge, prix affiché avant). Un clic sur une étoile prise la rend.",
        "**Branche complète** : prendre toutes les étoiles d'une branche lointaine donne son aura en combat et un titre (Buveur d'étoiles, Pilleur d'astres…). Chaque notable de branche a un emplacement de joyau ◆ à côté.",
        "**Classement** : « Voir l'arbre » ouvre le ciel d'un joueur en lecture seule, avec « Copier cet arbre ». La bulle d'une clé de voûte dit quelle part des joueurs de la classe l'a prise.",
        "Le menu Maîtrise affiche le nombre de points à placer, et l'icône ✦ sur un héros en combat montre ses clés de voûte au survol.",
        "**Joyaux** : ils tombent sur les boss en stasis 10 et plus et se sertissent dans les emplacements ◆.",
        "**Maîtrise du compte** : +1 % d'XP pour tout le compte par tranche de 100 points, tous héros confondus.",
        "**Maîtrise du Bestiaire** : 20 paliers par famille de monstres, +0,5 % de dégâts contre la famille par palier ; ornement au palier 5, +2 % de butin au 10, titre « Fléau » au 15, aura au 20. La famille du jour compte double.",
      ]],
      ["h", "Et la Renaissance ?"],
      ["p", `Depuis la 2.0, on ne renaît plus. Les vies passées sont devenues de la Maîtrise : ${N(() => E.REN_TO_MT * 100)} % de leur XP en niveaux de Maîtrise, 2 points par Éveil et 2 par sort appris ; un héros en cours de vie est revenu au niveau ${N(() => E.MAX_LVL)}. Les vies, leurs titres, leur aura et leur ornement ne s'affichent plus ; les comptes qui avaient renu gardent le titre « ${E.REN_TITLE} ».`],
      ["h", "Renaissance des métiers"],
      ["p", `Un métier niveau 200 peut renaître ${N(() => E.JOB_REN_MAX)} fois (${N(() => E.JOB_REN_COST)} kamas × le numéro de la renaissance) : +${N(() => E.JOB_REN_XP * (E.JOB_REN_XP < 1 ? 100 : 1))} % d'XP du métier à chaque fois, des jets d'artisanat plus hauts (jets parfaits à la X), et pour les forgemages plus de succès critiques et moins d'échecs.`],
    ] });

  /* ======================= Artisanat ======================= */
  add({ id: "metiers", f: "Économie", n: "Métiers : récolte et artisanat", ic: "metiers", page: "metiers", pages: ["recolte", "craft"], k: "recolte artisanat paysan bucheron mineur alchimiste pecheur tailleur bijoutier cordonnier forgeron sculpteur faconneur bricoleur filon outil recette",
    ou: "Économie › Métiers (Récolte, Artisanat)", de: "dès le début",
    voir: ["forgemagie", "maitrise", "quetes"],
    b: () => [
      ["p", "5 métiers de récolte (Paysan, Bûcheron, Mineur, Alchimiste, Pêcheur) et 7 d'artisanat (Tailleur, Bijoutier, Cordonnier, Forgeron, Sculpteur, Façonneur, Bricoleur), niveaux 1 à 200, partagés par tout le compte."],
      ["h", "Récolte"],
      ["ul", [
        "Un héros envoyé à la récolte ne combat plus : il récolte en continu, même hors-ligne.",
        "**Plusieurs héros d'un coup** : dans « Envoyer récolter », touche les héros voulus (ou « Les N libres » sur la carte du métier), choisis la ressource, puis « Envoyer ». Ils peuvent tous récolter la même ressource.",
        `Un coup de récolte dure ${N(() => E.HIT_S.lo)} s.`,
        `Trouvailles : ${pc(V(() => E.FIND_CHANCE, 0))} de chance par coup.`,
        `**Filons** : environ toutes les ${N(() => E.FILON_EVERY_S / 3600)} h, un filon rend ×2 pendant ${N(() => E.FILON_DUR_S / 60)} min.`,
        `**Outils** : jusqu'au niveau ${N(() => E.TOOL_MAX)}, chaque niveau accélère la récolte.`,
      ]],
      ["h", "Artisanat"],
      ["ul", [
        "Le niveau de métier demandé est le niveau de l'objet.",
        `L'XP est pleine pour les recettes jusqu'à ${N(() => E.CRAFT_FALL.full)} niveaux sous ta meilleure recette, puis baisse jusqu'à ${N(() => E.CRAFT_FALL.end)} niveaux en dessous.`,
        `Il faut environ ${N(() => E.CRAFT_STEP)} fabrications par niveau (${N(() => E.CRAFT_STEP_BRICO)} pour le Bricoleur).`,
        "La fiche d'une recette affiche combien tu en possèdes déjà (sac et trop-plein).",
        "La liste de courses suit les ressources qui manquent et prévient quand tout est réuni.",
        "Sac plein : l'objet fabriqué va dans le trop-plein.",
      ]],
    ] });

  add({ id: "forgemagie", f: "Économie", n: "Forgemagie et brisage", ic: "forge", page: "forge", k: "forgemagie rune puits reliquat exo ga brisage coefficient transcendance plan fusion transmutation",
    ou: "Économie › Forgemagie (Établi, Brisage, Runes, Plans)", de: "dès le début",
    voir: ["inventaire", "metiers"],
    b: () => [
      ["p", "La forgemagie améliore les caractéristiques d'un objet avec des runes. Chaque rune a trois issues :"],
      ["ul", [
        "**Succès critique** : la rune passe, rien ne baisse.",
        "**Succès neutre** : la rune passe, une autre caractéristique perd le même poids, sauf si le **puits** (reliquat) paie.",
        "**Échec critique** : la rune ne passe pas et une caractéristique baisse.",
      ]],
      ["kv", [
        ["Succès critique de base", pc(V(() => E.FM_ODDS.sc, 0))],
        ["Échec critique de base", pc(V(() => E.FM_ODDS.ec, 0))],
        ["Zone difficile à partir de", pc(V(() => E.FM_HARD.at, 0)) + " du jet"],
        ["Succès critique dans la zone", "×" + N(() => E.FM_HARD.sc)],
        ["Plans de forgemagie automatiques", N(() => E.FM_PLAN_MAX)],
        ["Runes pour une fusion", N(() => E.RUNE_FUSE_N) + " → 1 du palier au-dessus"],
      ]],
      ["ul", [
        "Plus l'objet est chargé, moins le succès critique est fréquent. Au-delà de 80 % de la plage d'un jet, c'est beaucoup plus dur.",
        "Le niveau de forgemage ne change pas les chances ; le niveau 200 permet de signer les objets. La Renaissance des métiers, elle, améliore les chances.",
        `**Exotique** : les runes Ga ajoutent PA, PM, PO ou Invocation (rares, butin des boss niveau ${N(() => E.EXO_LVL)}+ en stasis 7+, archimonstres, atelier).`,
        "**Transcendance** : garantie, mais l'objet ne peut plus être forgemagé ensuite.",
        `**Plans** : la forgemagie automatique tente une rune régulièrement, même hors-ligne.`,
      ]],
      ["h", "Brisage"],
      ["ul", [
        "Briser un objet donne des runes selon ses caractéristiques et son niveau. Viser une caractéristique en donne plus de celle-là (les autres comptent moitié).",
        `Chaque brisage du même objet baisse son coefficient de 3 % (minimum ${N(() => E.COEF_MIN)} %). Il remonte de 1 % toutes les ${N(() => E.COEF_REGEN_MIN)} min jusqu'à 100 %, puis lentement jusqu'à ${N(() => E.COEF_MAX)} %.`,
        `Un objet exotique brisé donne ×${N(() => E.EXO_BREAK_MULT)}.`,
      ]],
      ["tip", "Le bouton d'aide de l'Établi détaille toutes les chances avec les chiffres actuels."],
    ] });
  /* ======================= Jouer ======================= */
  add({ id: "home", f: "Bien débuter", n: "Havre-Sac", ic: "havre", page: "home", pages: ["havre"], k: "havre sac maison ameliorations meubles salles bonus autel formation atelier",
    ou: "Havre-Sac", de: "dès le début",
    voir: ["absence", "inventaire", "expeditions"],
    b: () => [
      ["p", "Le Havre-Sac est ta maison et l'accueil du jeu : la chasse en cours, le journal, et surtout des améliorations permanentes payées en kamas."],
      ["h", "Améliorations"],
      ["kv", V(() => E.HAVRE.map((x) => [x.name || x.id, `${x.per || x.v || ""}${x.unit || ""} par niveau · ${fr(x.max)} niveaux`.replace(/^ par niveau · /, "") ]), [])],
      ["p", "Le prix monte à chaque niveau. Les bonus additionnés ont un plafond :"],
      ["kv", [["XP", "+" + N(() => E.BONUS_CAP.xp) + " %"], ["Butin", "+" + N(() => E.BONUS_CAP.drop) + " %"], ["Kamas", "+" + N(() => E.BONUS_CAP.kamas) + " %"], ["Durée hors-ligne", "+" + N(() => E.BONUS_CAP.offtime) + " h"], ["Efficacité hors-ligne", "+" + N(() => E.BONUS_CAP.offrate) + " %"]]],
      ["ul", [
        `**Autel des Douze** : ${N(() => E.ALTAR.max)} niveaux, chacun relève les plafonds de ${N(() => E.ALTAR.per)} %.`,
        `**Salles et meubles** : chaque salle a des places pour des meubles ; seuls les meubles posés comptent. Les meubles tombent en chasse (1 / ${N(() => Math.round(1 / E.FURN_DROP))} par victoire), s'achètent ou se gagnent. Les trophées de boss arrivent en finissant un donjon en stasis ${N(() => E.TROPHY_STASIS)}.`,
        `**Formation** : un héros hors équipe reçoit ${pc(V(() => E.TRAIN_SHARE, 0))} de l'XP de l'équipe.`,
        `**Atelier** (${N(() => E.ATELIER_COST)} kamas) : fabrique seul une recette toutes les ${N(() => E.ATELIER_PERIOD_S / 60)} min.`,
        "« Mes bonus » détaille d'où vient chaque bonus.",
      ]],
    ] });

  add({ id: "world", f: "Aventure", n: "Monde et zones de chasse", ic: "monde", page: "world", k: "carte zone sous-zone chasse etoiles vagabonde trophee de zone archimonstre chromatique cle",
    ou: "Aventure › Monde", de: "les zones s'ouvrent en battant pour la première fois certains boss de donjon",
    voir: ["donjons", "chasse", "archis", "chroma"],
    b: () => [
      ["p", `${N(() => D.ZONES.length)} zones et leurs sous-zones, chacune avec une plage de niveaux. Choisis une sous-zone : l'équipe y enchaîne les combats. Il n'y a pas de niveau minimum, mais des monstres trop forts font perdre ; trop faibles, ils rapportent moins d'XP.`],
      ["p", "La page s'ouvre sur la carte du Monde des Douze : touche une région pour voir ses sous-zones à côté. Zoome avec la molette, deux doigts ou les boutons + / −, et glisse pour te déplacer ; les niveaux s'affichent en zoomant. Le bouton « Liste » remet l'ancienne liste. Incarnam et les autres mondes sont sous la carte."],
      ["h", "Ouvrir de nouvelles zones"],
      ["ul", V(() => D.ZONES.filter((z) => z.requires && z.requires.boss).map((z) => { const b = z.requires.boss; const dg = D.DUNGEONS[b] || Object.values(D.DUNGEONS).find((x) => x.boss === b); return `**${z.name}** : battre ${dg ? dg.name : b}`; }), [])],
      ["h", "Étoiles de zone"],
      ["p", `Une zone où personne ne chasse gagne une étoile toutes les ${N(() => E.STAR_GROW_S / 3600)} h (jusqu'à ${N(() => E.STAR_MAX)}). Chaque étoile donne +${N(() => E.STAR_PCT)} % d'XP et de butin ; elles fondent pendant la chasse (−1 toutes les ${N(() => E.STAR_MELT_S / 60)} min).`],
      ["h", "Trophées de zone"],
      ["p", `Quand chaque monstre d'une sous-zone atteint le palier Traqueur (${N(() => D.HUNT_TIERS[1].n)} tués), tu gagnes son trophée : +${pc(V(() => E.TROPHY_REGION, 0))} d'XP, de butin et de kamas en chassant dans sa région (par trophée). La vitrine donne aussi la Vitalité et la Sagesse des ${N(() => E.VITRINE_N)} meilleurs trophées à tous les héros.`],
      ["h", "Ce qu'on trouve en chasse"],
      ["kv", [
        ["Clé de donjon (par monstre)", pc(V(() => 0.01 * E.KEY_DROP_SCALE, 0))],
        ["Champion (par combat)", "1 / " + N(() => Math.round(1 / E.CHAMP_CHANCE))],
        ["Archimonstre (par monstre)", "1 / " + N(() => Math.round(1 / E.ARCHI_CHANCE))],
        ["Ta chance d'archimonstre", V(() => "1 / " + fr(Math.round(1 / E.archiOdds(S()))))],
        ["Chromatique (par monstre)", "1 / " + N(() => Math.round(1 / E.CHROMA_CHANCE))],
        ["Meuble (par victoire)", "1 / " + N(() => Math.round(1 / E.FURN_DROP))],
      ]],
      ["tip", "La **chasse vagabonde** fait changer de zone toute seule ; la **progression automatique** monte ou descend de zone selon tes victoires."],
    ] });

  add({ id: "donjons", f: "Aventure", n: "Donjons, clés et stasis", ic: "coffre", page: "dungeons", k: "donjon cle stasis coffre boss mutateur flash poussiere premier passage",
    ou: "Aventure › Donjons", de: "en débloquant la sous-zone du donjon",
    voir: ["world", "dofus", "combat"],
    b: () => [
      ["p", `${N(() => Object.keys(D.DUNGEONS).length)} donjons. Une clé = une tentative : les salles, puis le boss. Perdre ou quitter fait perdre la clé (une Fiole de résurrection relance une fois).`],
      ["h", "Les clés"],
      ["ul", ["En chasse dans la sous-zone d'accès du donjon (sous la recette de la clé, le nom de la zone est un bouton qui y mène).", "Fabriquées par le Bricoleur.", "À l'Hôtel de vente, dans les Comptoirs (Trousseau de clés), à la Foire, en expédition."]],
      ["h", "La stasis"],
      ["p", `Chaque donjon a sa difficulté de 1 à ${N(() => E.STASIS_MAX)}. Réussir une stasis ouvre la suivante pour ce donjon. Plus elle est haute, plus les monstres sont forts et les récompenses grandes.`],
      ["kv", [1, 5, 10, 15].map((k) => [`Stasis ${k}`, V(() => { const m = E.stasisMult(k); return `vie ×${fr(Math.round(m.hp * 100) / 100)} · dégâts ×${fr(Math.round(m.dmg * 100) / 100)} · gains ×${fr(Math.round(m.rew * 100) / 100)}`; })])],
      ["p", V(() => { const all = Object.keys(E.DG_DIFF || {}).filter((k) => D.DUNGEONS[k] && E.DG_DIFF[k] !== 1); const top = all.filter((k) => D.DUNGEONS[k].lvl >= E.MAX_LVL), L = all.filter((k) => D.DUNGEONS[k].lvl < E.MAX_LVL); const tv = top.map((k) => E.DG_DIFF[k]);
        return all.length ? `Quelques donjons ont leur propre réglage (vie et dégâts des monstres), pour que la stasis 7 demande partout un bon équipement${L.length ? ` : ${L.map((k) => `${D.DUNGEONS[k].name} ×${fr(E.DG_DIFF[k])}`).join(", ")}` : ""}.${top.length ? ` Les ${top.length} donjons de niveau ${E.MAX_LVL} sont tous plus durs (×${fr(Math.min(...tv))} à ×${fr(Math.max(...tv))}).` : ""}` : ""; }, "")],
      ["ul", V(() => (Array.isArray(E.STASIS_STEPS) ? E.STASIS_STEPS : Object.values(E.STASIS_STEPS)).map((x, i) => (typeof x === "string" ? x : x.t || x.txt || x.desc ? `**Stasis ${x.k || i + 1}** : ${x.t || x.txt || x.desc}` : "")).filter(Boolean), [])],
      ["h", "Sorts des monstres et des boss"],
      ["ul", [
        "Chaque sort de monstre a sa **mécanique** (saignement, venin, gel, zone, charge, carapace…), affichée sur les cartes de monstres des zones.",
        "Un tour sur trois, le boss **prépare sa signature** (⚠ au-dessus de lui) puis la lâche sur toute l'équipe : un bouclier ou des soins prêts à ce moment-là font la différence.",
        "Chaque boss a aussi un **sort unique** (✦) qu'aucun autre ne possède. Il se découvre au premier combat et s'explique ensuite dans « Sorts du boss », sur la fiche du donjon.",
      ]],
      ["h", "Récompenses"],
      ["ul", [
        "À la fin : butin des salles et du boss, Poussière de stasis, un objet garanti du boss.",
        "**Premier passage** de chaque stasis : un coffre (bois, argent, or puis obsidienne selon la stasis) et des Pierres d'âme ; la première stasis 10 donne un Grand parchemin par héros.",
        `En stasis ${N(() => E.TROPHY_STASIS)}, le trophée du boss pour le Havre-Sac.`,
        "La chance d'objet du boss monte avec la stasis jusqu'à 10.",
        "Dofus : voir le chapitre Dofus.",
      ]],
      ["h", "Trouver un donjon"],
      ["p", `Recherche par nom, boss ou zone, et filtres : niveau, accessibles, stasis atteinte, clé en stock, Dofus à gagner, favoris. **Masquer stasis ${N(() => E.STASIS_MAX)}** cache les donjons déjà finis tout en haut (le choix est gardé, le nombre masqué est indiqué).`],
      ["h", "Donjon de l'heure et donjon éclair"],
      ["p", `Chaque heure, un donjon est mis en avant (gains ×${N(() => E.WEEKLY_REW)}, poussière ×${N(() => E.WEEKLY_DUST)}). Des donjons éclair de ${N(() => E.FLASH_MS / 60000)} min donnent ×${N(() => E.FLASH_REW)}.`],
      ["tip", "En ligne, la fiche du donjon montre le top 5 des meilleurs temps, vérifié par le serveur."],
    ] });

  add({ id: "songe", f: "Aventure", n: "Songe infini", ic: "carte", page: "exp", k: "songe reve paradoxe cauchemar bribes vagues fontaine relique marche onirique",
    ou: "Aventure › Songe infini", de: `un héros niveau ${N(() => E.EXP_MIN_LVL)} dans l'équipe`,
    voir: ["comptoirs", "dofus"],
    b: () => [
      ["p", `Chaque semaine, une carte de ${N(() => E.SG_ROOMS)} salles (la même pour tout le monde). À chaque salle tu choisis un couloir : combat, combat difficile, archimonstre, faveur, fontaine, Gobledore… Tu ramasses des reliques, puis tu tiens des vagues à la « Fin du rêve ».`],
      ["kv", V(() => E.SG_INT.map((x) => [x.name, `butin +${fr(x.loot || 0)} % · ${fr(x.waves || 1)} vague${(x.waves || 1) > 1 ? "s" : ""} pour valider`]), [])],
      ["ul", [
        "Valider une intensité ouvre la suivante.",
        "Les **Bribes de rêve** paient le Marché onirique (Comptoirs) ; la moitié est gagnée vague par vague, même en cas de défaite.",
        "La validation donne un coffre : kamas, XP, poussière, objets, rune de transcendance dès Paradoxe 2, chance de légendaire et du Dofus Onirique.",
        "Une défaite réveille l'équipe (le butin des combats est gardé), sauf avec un Sable de Draconiros.",
        "En ligne : classement de la semaine (meilleure intensité, puis vagues).",
      ]],
    ] });

  add({ id: "asc", f: "Défis", n: "L'Ascension", ic: "ailes", page: "asc", k: "ascension tour etage volonte fiole fragments ecus au-dela roguelike relique reliquaire",
    ou: "Défis › L'Ascension", de: "dès le début ; l'Au-delà après l'étage 100 en Normal",
    voir: ["sorts"],
    b: () => [
      ["p", `Un mode à part : un nouveau héros niveau 1 grimpe la tour du mois (${N(() => E.ASC.floors)} étages). Tire 3 classes, garde des sorts, recrute en chemin. Rien de ce qu'on y gagne ne rend plus fort dans le jeu principal.`],
      ["kv", [
        ["Étages", N(() => E.ASC.floors)], ["Niveau des monstres", "2 × étage − 1"], ["Volonté au plus", N(() => E.ASC.volMax)], ["+1 Volonté toutes les", N(() => E.ASC.volMs / 60000) + " min"],
        ["Fiole de Volonté", "+" + N(() => E.ASC.fiole)], ["Coffres aux étages", V(() => E.ASC_CHEST.join(", "))],
      ]],
      ["ul", [
        "Une tentative coûte 1 Volonté seulement sur un étage pas encore réussi ce mois-ci.",
        "Un boss tous les 10 étages, un tirage tous les 5, un événement, une boutique ou un autel par dizaine ; une règle sur les autres combats.",
        "Mode **manuel** : tu lances chaque étage et choisis les sorts ; mode auto : moins de Fragments.",
        "Sur PC, **raccourcis** : 1 à 9 lancent tes sorts ou prennent un choix, Entrée finit le tour ou lance l'étage, Échap passe, ← → changent de cible.",
        `**Reliques** : tous les ${N(() => E.ASC.relEvery)} étages, après le sort du palier, ${N(() => E.ASC.relMax)} emplacements (Arme, Coiffe, Cape, Anneau, Amulette, Bottes), 3 proposées, 1 gardée. Caractéristiques + effet unique, perdues en fin de montée ; le marchand en vend 2. L'onglet **Reliquaire** garde celles trouvées (titres, cadre, ornement). L'Au-delà démarre avec ${N(() => E.ASC.relStart)} reliques.`,
        "**Fragments** et **Écus** paient les améliorations de la tour (classes, sorts de départ…).",
        "La tour repart le 1er du mois ; l'Au-delà chaque lundi. En ligne, le top 10 reçoit un titre, des Fioles et des kamas.",
      ]],
      ["tip", "L'onglet « Règles » de la page détaille tout."],
    ] });

  add({ id: "defi", f: "Défis", n: "Défi du jour", ic: "cle", page: "defi", k: "defi jour medaille bourse serie grand defi dimanche regle",
    ou: "Défis › Défi du jour", de: "dès le début",
    voir: ["donjons", "classement"],
    b: () => [
      ["p", "Chaque jour à minuit (heure de Paris), un donjon, une stasis, des modificateurs et des règles par palier, les mêmes pour tout le monde. Le combat est simulé à l'identique : essaie autant de fois que tu veux pour faire le meilleur score. Le dimanche, c'est le Grand défi (bourse ×3)."],
      ["kv", V(() => E.DEFI_TIERS.map((t) => [t.name, ((a, b) => (a === b ? `niv. ${fr(a)}` : `niv. ${fr(a)}–${fr(b)}`))(t.lo || t.min || (t.lvl && t.lvl[0]) || 0, t.hi || t.max || (t.lvl && t.lvl[1]) || 200)]), [])],
      ["kv", [["Victoire", N(() => E.DEFI_PTS.win) + " pts"], ["Règle respectée", N(() => E.DEFI_PTS.rule) + " pts"], ["Règle héroïque", N(() => E.DEFI_PTS.hero) + " pts"], ["Médaille d'argent", N(() => E.DEFI_MEDALS[1].pts) + " pts"], ["Médaille d'or", N(() => E.DEFI_MEDALS[2].pts) + " pts"]]],
      ["ul", [
        "Bronze : bourse de kamas et poussière ; argent : + coffre en bois ; or : + kamas et coffre en argent.",
        "Série de jours : coffre en or au 7e jour, ornement et Coffre des Douze au 30e, cadre au 100e. Un joker par semaine.",
        "**Vote du Grand défi** : du lundi au samedi, vote pour l'une des 3 règles proposées de la semaine. Le dimanche, la règle gagnante s'ajoute aux règles du Grand défi (égalité ou aucun vote : la première proposée), aussi quand tu le lances depuis l'accueil.",
        "En ligne : classement du jour, de la saison et des guildes.",
      ]],
      ["tip", "« Comment ça marche » sur la page reprend le barème complet."],
    ] });

  add({ id: "koli", f: "Défis", n: "Kolizéum", ic: "combat", page: "koli", k: "kolizeum pvp arene cote elo grade kolizetons erosion fantome",
    ou: "Défis › Kolizéum", de: "dès le début",
    voir: ["comptoirs", "classement"],
    b: () => [
      ["p", `Arène classée en ${N(() => E.KOLI.size)} contre ${N(() => E.KOLI.size)} : ton équipe affronte celle d'un autre joueur (en ligne) ou un Fantôme. Une cote type Elo monte ou baisse à chaque combat.`],
      ["kv", [["Combats classés par jour", N(() => E.KOLI.daily)], ["Cote de départ", N(() => E.KOLI.start)], ["Kolizetons par victoire", N(() => E.KOLI.kzWin)], ["Kolizetons par défaite", N(() => E.KOLI.kzLoss)], ["Érosion dès le tour", N(() => E.KOLI.ero)], ["Tours au plus", N(() => E.KOLI.maxRound)]]],
      ["kv", V(() => E.KOLI_GRADES.map((g) => [g.name, (g.top ? "top " + g.top + " de la semaine" : g.min ? "cote " + fr(g.min) : "départ") + ` · ${fr(g.kz)} kolizetons par semaine`]), [])],
      ["ul", [
        `Érosion : à partir du tour ${N(() => E.KOLI.ero)}, soins et vie max baissent de ${N(() => E.KOLI.eroStep)} % par tour (${N(() => E.KOLI.eroMax)} % au plus).`,
        "Les Sceaux sont coupés, les passifs de Dofus comptent moitié.",
        "Chaque fin de semaine : récompense de grade, puis la cote se rapproche de moitié de la cote de départ.",
        "Les Kolizetons paient la boutique du Kolizéum (Comptoirs).",
      ]],
      ["tip", "Le bouton « Règles » de la page détaille les mises et l'érosion."],
    ] });

  add({ id: "foire", f: "Économie", n: "Foire du Trool", ic: "bonbon", page: "foire", k: "foire trool caisse jackpot hasard",
    ou: "Économie › Foire du Trool", de: "dès le début",
    b: () => [
      ["p", "Trois caisses payées en kamas, avec les chances affichées, et un Jackpot sur le serveur. On n'y gagne jamais de Dofus, de légendaire ni d'objet du Boss des mondes."],
      ["kv", [
        ...V(() => E.FOIRE.CAISSES.map((c) => [c.name || c.id, fr(c.cost || c.k) + " kamas"]), []),
        ["Ouvertures par jour", N(() => E.FOIRE.DAY)],
        ["Retour moyen", pc(V(() => E.foireRtp(), 0))],
      ]],
      ["kv", V(() => E.FOIRE.RAR.map((r) => [r.name || r.id, pc(r.p / 100)]), [])],
      ["p", "**Jackpot** (en ligne) : 10 000 kamas le ticket, tirage toutes les heures ; 9 000 vont dans la cagnotte."],
    ] });

  add({ id: "wb", f: "Défis", n: "Boss des mondes", ic: "couronne", page: "wb", k: "boss des mondes serveur grade fragments anomalie",
    ou: "Défis › Boss des mondes", de: "en ligne avec un compte (sinon, essai d'entraînement)",
    voir: ["comptoirs"],
    b: () => [
      ["p", `Tout le serveur tape la même barre de vie. ${N(() => E.WB_TRIES)} tentatives par jour ; une tentative = ${N(() => E.WB_FIGHTS)} combats de ${N(() => E.WB_ROUNDS)} tours, et leurs points s'additionnent. Les boss tournent (${N(() => E.WB_ROT.length)} au total).`],
      ["kv", V(() => E.WB_GRADES.map((g) => [`Grade ${g.g || g.name || g.id}`, `${fr(g.pts !== undefined ? g.pts : g.min)} pts · ${fr(g.frag || g.f || 0)} fragment${(g.frag || g.f || 0) > 1 ? "s" : ""}`]), [])],
      ["ul", [
        "Phase 2 (sous 2/3 de vie) : le boss frappe plus fort ; phase 3 (sous 1/3) : il subit plus de dégâts. Un élément lui fait +50 %, un autre −50 %.",
        "Boss vaincu : coffre en or et fragments pour tous, récompenses et titres pour le top 3, +10 % d'XP pour tout le serveur pendant 1 h.",
        "Les Fragments d'anomalie paient la boutique du Boss des mondes.",
      ]],
    ] });

  add({ id: "comptoirs", f: "Économie", n: "Comptoirs", ic: "havre", page: "comptoirs", k: "boutique comptoir jetons insignes doplons kolizetons bribes fragments offre semaine",
    ou: "Économie › Comptoirs", de: "dès le début",
    voir: ["quetes", "koli", "songe", "wb"],
    b: () => [
      ["p", `Les ${N(() => E.CPT.length)} boutiques du jeu au même endroit, chacune avec sa monnaie. Un point sur le menu quand tu peux acheter quelque chose de neuf.`],
      ["ul", V(() => E.CPT.map((B) => `**${B.name()}** : ${B.cur()}${B.desc ? " · " + B.desc : ""}`), [])],
      ["p", `Chaque semaine, une **offre** par boutique : −${N(() => E.CPT_OFF.pct)} %, ${N(() => E.CPT_OFF.n)} fois.`],
    ] });

  add({ id: "expeditions", f: "Bien débuter", n: "Expéditions et heures de donjon", ic: "carte", page: "home", k: "expedition mission patrouille escorte fouille heures de donjon",
    ou: "Havre-Sac › Expéditions · encadré « Heures de donjon » dans Donjons", de: "dès le début",
    voir: ["absence", "donjons"],
    b: () => [
      ["h", "Heures de donjon"],
      ["p", `Tu gagnes ${N(() => E.DGH.gain / 3600)} h par jour (jusqu'à ${N(() => E.DGH.max / 3600)} h). Pendant ton absence, l'équipe les dépense à refaire un donjon dont la stasis est déjà réussie, au rythme hors-ligne, avec les mêmes chances de Dofus qu'en direct.`],
      ["h", "Missions"],
      ["p", `Les héros hors de l'équipe partent en mission : ${N(() => E.MIS.slots)} places (une de plus avec la Salle des cartes), ${N(() => E.MIS.board)} missions proposées par jour.`],
      ["kv", V(() => Object.keys(E.MIS_TYPES).map((k) => { const T = E.MIS_TYPES[k]; return [T.name || k, fr((T.h || T.ms / 3600000 || 0)) + " h"]; }), [])],
      ["p", "La chance de réussite dépend du niveau des héros et des conditions remplies. Une mission rapporte kamas, ressources et XP ; jamais de Dofus."],
    ] });

  add({ id: "idoles", f: "Aventure", n: "Idoles", ic: "trophee", page: null, k: "idole score difficulte bonus",
    ou: "bouton « Idoles » sur les écrans de combat, de chasse, de donjon et d'équipe", de: "chaque idole se fabrique une fois chez le Bricoleur",
    voir: ["metiers", "donjons"],
    b: () => [
      ["p", "Les idoles rendent les combats plus durs en échange de plus d'XP et de butin."],
      ["kv", [["Idoles actives au plus", N(() => E.IDOL_MAX)], ["Bonus par point de score", "+" + N(() => E.IDOL_PCT) + " % XP et butin"], ["Score compté en donjon au plus", N(() => E.IDOL_DG_CAP)], ["Idoles en tout", N(() => Object.keys(E.IDOLS).length)]]],
      ["ul", ["Une seule idole par famille.", "Une idole qui fait la même chose qu'un modificateur de stasis ne compte pas.", "3 réglages enregistrables."]],
    ] });
  /* ======================= Journal ======================= */
  add({ id: "quetes", f: "Journal", n: "Quêtes du jour et de la semaine", ic: "quetes", page: "quests", pages: ["hebdo", "commandes", "temples", "almanax"], k: "quete aujourd'hui semaine hebdo commandes artisans temples dopeuls doplons almanax offrande",
    ou: "Journal › Quêtes › Aujourd'hui", de: "dès le début",
    voir: ["aventures", "avis", "comptoirs"],
    b: () => [
      ["p", "Le Tableau du jour réunit l'étape en cours de la quête principale, ce qu'il reste à faire aujourd'hui et le Défi du jour. Almanax, Commandes et Temples se renouvellent à minuit (heure de ton appareil)."],
      ["h", "Semaine"],
      ["p", "Chaque lundi (heure de Paris), 3 quêtes à ton niveau : une chasse, un donjon (ou avis, trésor), et un artisanat (ou récolte, commande, Almanax). Chacune paie kamas et XP ; les trois finies donnent un Coffre en or et 3 parchemins de chasse au trésor."],
      ["h", "Almanax"],
      ["p", `Chaque jour, une offrande de ressources pour un bonus jusqu'à minuit (récolte, fête, forgemagie…) plus des kamas et de l'XP. Série de jours : ${V(() => E.ALM_TIERS.join(", "))} jours pour des récompenses (lot, coffre, meuble « Calendrier de l'Almanax », titre). Un jour manqué fait redescendre d'un palier. « Où la trouver » sous l'offrande montre le métier ou les monstres qui lâchent la ressource (zone, chance) et « Y aller » lance la chasse.`],
      ["h", "Commandes d'artisans"],
      ["kv", [["Commandes ouvertes", N(() => E.CMD_SLOTS)], ["Commandes par jour", N(() => E.CMD_DAY_MAX)], ["Rangs d'artisan", V(() => E.CMD_RANKS.join(", ") + " livraisons")]]],
      ["ul", ["Livrer des ressources rapporte kamas et XP de métier ; les livraisons partielles comptent.", "Les commandes urgentes paient ×1,5.", "3 livraisons : un coffre ; 10 : un Coffre en or.", "Changer une commande : gratuit la première fois du jour."]],
      ["h", "Temples et Dopeuls"],
      ["p", `Un Dopeul par classe que tu possèdes, une fois par jour : il vient affronter l'équipe au prochain combat de chasse. Chaque victoire donne des Doplons (1 + 1 tous les 40 niveaux, +3 tous les 7 jours de série) pour le Comptoir des temples. Battre ${N(() => E.TEMPLE_TITLE_N)} Dopeuls différents donne un titre.`],
    ] });

  add({ id: "aventures", f: "Journal", n: "Quête principale et quêtes de région", ic: "quetes", page: "quests", pages: ["region", "main"], k: "quete principale chapitre region histoire personnage",
    ou: "Journal › Quêtes › Aventures", de: "dès le début ; une région s'ouvre quand ton meilleur héros approche de son niveau",
    voir: ["quetes", "dofus", "alignement"],
    b: () => [
      ["p", `La **quête principale** guide pas à pas à travers le jeu, en ${N(() => E.QUEST_CHAPTERS.length)} chapitres. Chaque étape paie des kamas et de l'XP.`],
      ["p", `Les **quêtes de région** racontent une histoire par région (${N(() => E.REGIONS.length)} régions), avec un personnage de DOFUS : chasse, ressources à remettre, boss, boss en stasis. Une région s'ouvre quand son niveau est au plus 5 au-dessus de ton meilleur héros. La fin donne des kamas, un Coffre en argent, le titre « l'Ami de… » et l'emblème de la région.`],
      ["p", "Les **quêtes de Dofus** et l'**Alignement** sont aussi rangés dans Aventures (voir leurs chapitres)."],
    ] });

  add({ id: "avis", f: "Journal", n: "Avis de recherche et chasse au trésor", ic: "carte", page: "quests", pages: ["bounty", "tresor"], k: "avis recherche prime jetons elite tresor parchemin indice gardien",
    ou: "Journal › Quêtes › Chasses", de: "dès le début",
    voir: ["comptoirs", "quetes"],
    b: () => [
      ["h", "Avis de recherche"],
      ["p", `Le tableau propose ${N(() => E.BOUNTY_SLOTS)} avis de monstres et ${N(() => E.BOSS_SLOTS)} avis de boss. Un avis rempli est remplacé aussitôt. Chacun paie des kamas, des jetons (1, 2 pour un boss) et parfois un coffre.`],
      ["ul", [
        "Changer un avis coûte 30 kamas par niveau de ton meilleur héros (gratuit avec un Parchemin d'Avis).",
        `Rang de chasseur : ${V(() => E.HUNT_RANKS.slice(1).map((r) => `${r[0]} à ${fr(r[1])}`).join(", "))} avis remplis ; +10 % de kamas par rang.`,
        `**Avis d'élite** : un boss de ton niveau en stasis ${N(() => E.ELITE_STASIS)} chaque lundi, avec gros kamas, 5 jetons et un Coffre en or.`,
        "Les jetons paient le Bureau des primes (Comptoirs).",
      ]],
      ["h", "Chasse au trésor"],
      ["p", "Un parchemin donne une suite d'indices : chaque indice se révèle en gagnant des combats dans la bonne sous-zone, et le dernier mène à un gardien qui garde un coffre (kamas, poussière, ressources, clé)."],
      ["kv", [["Parchemin court gratuit", "1 par jour"], ["Parchemin normal (par victoire)", "1 / " + N(() => Math.round(1 / E.TRESOR_DROP))], ["Parchemin légendaire", "1 par semaine dès le niveau 50"], ["Parchemins en réserve", N(() => E.TRESOR_STOCK)], ["Victoires pour révéler un indice", N(() => E.TRESOR_NEED)]]],
    ] });

  add({ id: "alignement", f: "Journal", n: "Alignement", ic: "ailes", page: "quests", pages: ["align"], k: "alignement bonta brakmar ordre rang ailes insignes guerre regions honneur agression arsenal talents mission",
    ou: "Journal › Quêtes › Aventures › Alignement", de: `un héros niveau ${N(() => E.ALIGN_MIN_LVL)}`,
    voir: ["comptoirs"],
    b: () => [
      ["p", "Choisis Bonta ou Brâkmar, puis un des 3 ordres de ta cité. Les agressions, missions, quêtes de cité et régions défendues rapportent des points d'honneur : ils font ton rang, de 1 à 20, et se dépensent à l'Arsenal de ta cité sans jamais faire baisser ton rang."],
      ["h", "Honneur et rangs"],
      ["ul", [
        `Rang 1 : ${N(() => E.honStep(1))} points d'honneur, puis +15 % par rang ; rang 20 à ${N(() => E.honCum(20))} points.`,
        `Agression gagnée : +${N(() => E.ALIGN_HON.agrMin)} à +${N(() => E.ALIGN_HON.agrMax)} ; agression lancée et perdue : −${N(() => E.ALIGN_HON.agrLoss)}, sans jamais perdre de rang. Être agressé ne coûte rien (défense gagnée : +${N(() => E.ALIGN_HON.def)}).`,
        `Région tenue par ton camp où tu marques des points : +${N(() => E.ALIGN_HON.regDay)} une fois par jour.`,
        "Bonus de camp (Bonta +1 % de vie, Brâkmar +1 % de dégâts par rang) et d'ordre (Cœur dégâts, Esprit XP, Œil butin), au complet au rang 10.",
        "Talents d'ordre, un par rang de 1 à 5 : bonus de l'ordre (+4 %), +6 % de dégâts en agression, +5 % d'honneur, −8 % de dégâts reçus en défense, puis le Serment de Menalt (Bonta) ou de Djaul (Brâkmar) : +10 % de points de guerre dans les régions tenues par ton camp, et d'honneur gagné en y chassant (hors agressions et défenses).",
        `Arsenal de la cité : coiffe, cape, anneau, amulette et bottes niveau 200, une par rang de 6 à 10 (${V(() => E.HON_GEAR_COST.map((c) => c.toLocaleString("fr-FR")).join(", "))} honneur), liées au compte. Chaque pièce donne +2 % de dégâts en agression ou −2 % de dégâts reçus en défense (la coiffe : +3 % d'honneur). Panoplie complète : +10 % d'honneur.`,
        "Titres : « Commandeur » au rang 16, « Grand Maître » au rang 18, « Héros de Bonta » ou « Héros de Brâkmar » au rang 20.",
      ]],
      ["h", "Guerre des régions"],
      ["ul", [
        "Les régions de la carte appartiennent à Bonta, à Brâkmar ou à personne ; les cités ne se conquièrent pas.",
        `Missions, quêtes, donjons, avis et agressions donnent des points à la région où chassent tes héros, sinon à ton front (au plus ${N(() => E.ALIGN_WAR.cap)} par semaine).`,
        `Une région change de camp quand un camp fait ${N(() => E.ALIGN_REG_FLIP)} % de ses points de la semaine. Le camp qui la tient y gagne +${N(() => E.ALIGN_REG_BONUS)} % d'XP et de butin.`,
        `Agressions : ${N(() => E.ALIGN_HON.agrDay)} par jour contre des équipes fantômes du camp adverse, avec ton équipe d'arène.`,
      ]],
      ["h", "Quêtes et camp"],
      ["ul", [
        `Quêtes de cité : 5 chapitres de 5 étapes, aux niveaux ${V(() => E.ALIGN_CH_LVL.join(", "))}.`,
        `Changer de camp : ${N(() => E.ALIGN_SWITCH_MS / 86400000)} jours d'attente, puis retour au rang 2 au plus et bourse d'honneur vidée.`,
        "Les ailes d'alignement grandissent tous les 4 rangs. Dans le chat, elles entourent le portrait des joueurs de Bonta et de Brâkmar dès le rang 1, et deviennent dorées au rang 16.",
      ]],
    ] });

  add({ id: "succes", f: "Journal", n: "Succès, titres et ornements", ic: "trophee", page: "succes", pages: ["ach"], k: "succes points titre ornement cadre secret",
    ou: "Journal › Succès", de: "dès le début",
    b: () => [
      ["p", `${N(() => E.ACH.length)} succès, chacun payé en kamas et en points (5, 10, 20 ou 40 selon sa difficulté). Certains sont secrets, avec un indice.`],
      ["kv", V(() => E.ACH_PALIERS.map((p) => [`${fr(p.pts || p.n || p[0])} points`, p.name || p.desc || p.txt || p[1] || ""]), [])],
      ["ul", [
        "**Titres** : affichés sur la carte du héros (fiche du héros › …).",
        "**Ornements** et **cadres** : décorent la carte ; chacun dit comment l'obtenir.",
        "La **garde-robe** garde chaque coiffe et cape obtenue pour changer l'apparence gratuitement.",
      ]],
    ] });

  add({ id: "enc", f: "Journal", n: "Encyclopédie et collections", ic: "cristal", page: "enc", pages: ["chroma", "sets", "archis"], k: "encyclopedie bestiaire familles boss equipements panoplies trophees chromatiques archimonstres album collection",
    ou: "Journal › Encyclopédie", de: "se remplit en jouant",
    voir: ["archis", "chroma", "world"],
    b: () => [
      ["p", "L'Encyclopédie garde tout ce que tu as rencontré : Bestiaire (lieux, résistances, butins avec les vraies chances), Familles, Boss de donjon, Équipements, Panoplies, Trophées et Chromatiques. Chaque onglet a sa recherche, et « Y aller » emmène au bon endroit."],
      ["h", "Collection de panoplies"],
      ["p", `Une panoplie compte quand chacune de ses pièces a été obtenue au moins une fois (même vendue ensuite). ${N(() => E.collTotal())} panoplies.`],
      ["ul", V(() => E.COLL_TIERS.map((t) => `**${fr(t.n)} panoplies** : ${t.txt || t.name || ""}`), [])],
      ["p", `Une région complète donne +${N(() => E.COLL_REGION * (E.COLL_REGION < 1 ? 100 : 1))} % de butin et de kamas en y chassant.`],
    ] });

  add({ id: "archis", f: "Journal", n: "Archimonstres", ic: "dofus", page: null, k: "archimonstre ame pierre d'ame album ocre moisson",
    ou: "Album des archimonstres (Encyclopédie, quêtes de Dofus)", de: "dès le début",
    voir: ["world", "dofus"],
    b: () => [
      ["p", `Un monstre peut apparaître en archimonstre (1 / ${N(() => Math.round(1 / E.ARCHI_CHANCE))} par monstre). Si tu as une Pierre d'âme, son âme est capturée automatiquement et rejoint l'album (${N(() => E.ARCHI_TOTAL)} archimonstres).`],
      ["ul", [
        "Plus de chances : Ecaflip dans l'équipe ×1,5, Parfum de pistage ×2, Pierre d'âme dorée ×3, Autel des âmes ×1,4.",
        "Pierres d'âme : premier passage des stasis, Bricoleur, Bureau des primes.",
        "L'« Éternelle moisson » récompense les régions complétées, jusqu'au Dofus Ocre (+1 PA).",
        "☆ Épingler (en haut de l'album) le met dans tes épinglés du menu ; ouvert, il se met à jour tout seul après chaque combat.",
      ]],
      ["kv", [["Ta chance actuelle", V(() => "1 / " + fr(Math.round(1 / E.archiOdds(S()))))]]],
    ] });

  add({ id: "chroma", f: "Journal", n: "Chromatiques", ic: "cristal", page: "enc", pages: ["chroma"], k: "chromatique prismatique album charme eclats atelier du prisme",
    ou: "Journal › Encyclopédie › Chromatiques", de: "dès le début",
    voir: ["world", "enc"],
    b: () => [
      ["p", `Un monstre a 1 chance sur ${N(() => Math.round(1 / E.CHROMA_CHANCE))} d'être **chromatique** (couleurs rares). Il rapporte ×${N(() => E.CHROMA_MULT)} de butin et d'XP et des Éclats chromatiques. 1 chromatique sur ${N(() => Math.round(1 / E.PRISM_CHANCE))} est prismatique.`],
      ["kv", [["Espèces de l'album", N(() => E.CHROMA_TOTAL)], ["Chaîne au même endroit", `jusqu'à ×${N(() => E.CHROMA_CHAIN_MAX)} après ${N(() => E.CHROMA_CHAIN_N)} victoires`], ["Charme", "×" + N(() => E.CHROMA_CHARM)], ["Espèce recherchée", "×" + N(() => E.CHROMA_WANT)], ["Sous-zone complète", "+" + N(() => E.CHROMA_TROPHY * (E.CHROMA_TROPHY < 1 ? 100 : 1)) + " % butin et XP"], ["Vitrine", N(() => E.CHROMA_VIT) + " places"]]],
      ["p", "Les paliers de l'album (5, 10, 25, 50, 100) donnent titres, ornement, teinture, le Charme et un cadre. Les Éclats paient l'Atelier du prisme."],
    ] });

  add({ id: "carnet", f: "Journal", n: "Carnet de bord", ic: "parchemin_or", page: "carnet", k: "carnet courbes kamas statistiques moments",
    ou: "Journal › Carnet", de: "dès le début",
    b: () => [
      ["p", "XP, kamas, combats et niveaux heure par heure sur 7 jours et jour par jour sur 30 jours ; le bilan des kamas (gagnés et dépensés, par catégorie : Chasse, Donjons, Songe infini, Kolizéum, vente directe et marchand, Hôtel de vente, coffres, Ascension, missions, guilde…), tes meilleures zones et les grands moments de ta partie."],
    ] });

  /* ======================= Communauté ======================= */
  add({ id: "hdv", f: "Économie", n: "Hôtel de vente et Cours des ressources", ic: "bourse", page: "hdv", pages: ["cours"], k: "hotel de vente hdv taxe offre achat echange cours vente directe coefficient vendre plusieurs selection monture familier bete achetee",
    ou: "Économie › Hôtel de vente · Économie › Cours des ressources", de: "en ligne, avec un compte (partie 1)",
    voir: ["guilde"],
    b: () => [
      ["h", "Hôtel de vente"],
      ["ul", [
        "20 objets ou lots en vente au plus ; une taxe de 2 % est payée à la mise en vente (perdue si tu retires l'offre). Une vente dure 14 jours.",
        "Ressources vendues par lots de 1, 10 ou 100.",
        "**Offres d'achat** : 10 au plus, 3, 7 ou 14 jours ; la taxe de 2 % ne porte que sur ce que tu reçois.",
        "**Échange direct** entre joueurs, sans taxe.",
        "Les Dofus ne se vendent ni ne s'échangent.",
        "**Montures et familiers** (catégories Montures et Familiers, ou « Vendre à l'HdV » sur leur fiche) : la bête garde niveau, étoiles, capacité et petits ; son surnom est effacé. Une bête achetée ne compte ni au carnet de l'éleveur, ni au classement d'élevage, ni à l'album (ses petits comptent). Pas en vente : montures montées, à l'enclos ou en balade, familiers portés, Chacha Doré.",
      ]],
      ["h", "Cours des ressources (vente directe)"],
      ["p", `Vends tes ressources directement au jeu. Le prix = prix de base × un coefficient commun à tout le serveur, entre ×${N(() => E.VENTE.MIN)} et ×${N(() => E.VENTE.MAX)}. Vendre fait baisser le coefficient (${N(() => E.VENTE.VOL)} unités vendues = −1), et il remonte en se rapprochant de ×${N(() => E.VENTE.MAX)} (écart divisé par deux toutes les ${N(() => E.VENTE.HALF_H)} h).`],
      ["p", "**Vendre plusieurs ressources d'un coup** : Héros › Inventaire › Ressources › « Vendre plusieurs », touche les ressources (ou « Tout ce filtre », sans les favorites ★), règle la quantité de chacune si tu veux en garder, puis « Vendre la sélection ». Le résultat s'affiche ressource par ressource."],
      ["p", `Sans compte, le marchand de secours paie ${N(() => E.MERCHANT * (E.MERCHANT < 1 ? 100 : 1))} % de la valeur.`],
    ] });

  add({ id: "guilde", f: "Communauté", n: "Guilde, boss et percepteurs", ic: "couronne", page: "guild", k: "guilde fonder places rangs ameliorations boss de guilde percepteurs raid nuit des percepteurs",
    ou: "Communauté › Guilde", de: "en ligne ; fonder demande un héros niveau " + N(() => E.GUILD_FOUND_LVL),
    voir: ["alliance"],
    b: () => [
      ["kv", [["Fonder une guilde", N(() => E.GUILD_FOUND_K) + " kamas"], ["Places de départ", N(() => E.GUILD_SEATS)], ["Places au plus", N(() => E.GUILD_SEATS_MAX)], ["Part de vente directe au coffre", "0 à " + N(() => E.GUILD_SALE_MAX) + " %"]]],
      ["ul", [
        "Chaque membre donne 0 à 90 % de son XP à la guilde. Le niveau de guilde (100 au plus) donne +1 % d'XP tous les 5 niveaux et +1 % de butin et kamas tous les 10.",
        "Améliorations payées avec le coffre : rangs (Poche, Prospection, Sagesse, Robustesse) et améliorations uniques.",
      ]],
      ["h", "Boss de guilde"],
      ["p", `Un boss par semaine (lundi, heure de Paris). Une tentative toutes les ${N(() => E.GBOSS_EVERY)} min (${N(() => E.GBOSS_RESERVE)} en réserve), ${N(() => E.GBOSS_ROUNDS)} tours chacune. Sa vie dépend du nombre de membres actifs. Chaque phase passée remplit le coffre ; il faut ${N(() => E.GBOSS_MIN_TRIES)} tentatives dans la semaine pour recevoir les coffres de membre.`],
      ["h", "Percepteurs"],
      ["ul", [
        `Un percepteur (${N(() => E.PERCO_PRICE)} kamas) se remplit sur ${N(() => E.PERCO_FILL_H)} h dans sa zone.`,
        `Les autres guildes peuvent l'attaquer (${N(() => E.RAID.day || 3)} raids par jour) ; tu as ${N(() => E.PERCO_ATK_H)} h pour le défendre.`,
        "**Nuit des Percepteurs** : le samedi soir, butin ×1,5.",
      ]],
    ] });

  add({ id: "alliance", f: "Communauté", n: "Alliances et prismes", ic: "couronne", page: "guild", k: "alliance prisme region bataille samedi",
    ou: "Communauté › Guilde › Alliance", de: `guilde niveau ${N(() => E.ALLY.foundLvl)} (fonder : ${N(() => E.ALLY.foundK)} kamas du coffre)`,
    voir: ["guilde"],
    b: () => [
      ["p", `Jusqu'à ${N(() => E.ALLY.max)} guildes forment une alliance. Elle pose des prismes pour tenir des régions (bonus de +${N(() => E.ALLY.bonus)} % dans la région), et défend ou attaque pendant la bataille du samedi de ${N(() => E.ALLY.from)} h à ${N(() => E.ALLY.to)} h.`],
      ["ul", ["Il faut au moins 5 points pour prendre une région ; une égalité la libère.", "Les améliorations de prisme (Rempart, Sagesse, Prospection, Ralliement) se paient avec le coffre."]],
    ] });

  add({ id: "classement", f: "Communauté", n: "Classements, Builds et chat", ic: "trophee", page: "ladder", pages: ["builds"], k: "classement ladder builds code partager chat canal",
    ou: "Communauté › Classements · Communauté › Builds", de: "en ligne",
    b: () => [
      ["p", "**Classements** : course, niveau (la somme des 8 meilleurs héros, chaque point de Maîtrise compte un niveau ; par classe, « niv. 200 · Maîtrise 150 » du meilleur héros), Défi du jour, donjons, album, chromatiques, succès, métiers, élevage et « premiers » (les premiers joueurs à réussir un exploit)."],
      ["p", "**Builds** : partage les sorts et caractéristiques d'un héros avec un code « IDLUS1-… ». Appliquer un build copie seulement les sorts et les points. Publier demande une connexion Discord."],
      ["p", "**Chat** : canaux Général, Commerce, PvP, Guilde, Alliance, Privé et Hauts faits. Messages de 200 caractères au plus."],
      ["h", "Vérification des parties"],
      ["p", "Le serveur contrôle chaque partie envoyée : niveaux, Maîtrise, kamas, ressources, Dofus et temps de jeu. Les classements, l'hôtel de vente et les Premiers partent de la dernière partie validée. Une progression impossible pour le temps joué (une partie modifiée à la main, par exemple) n'est pas acceptée et le compte est signalé à Xener, qui seul décide d'une sanction."],
      ["p", "Un compte **suspendu** (quelques jours ou définitivement) sort des classements et sa partie n'est plus envoyée en ligne (pastille « Compte suspendu ») ; elle reste jouable sur l'appareil. Une suspension temporaire se lève toute seule à la fin et le compte revient dans les classements."],
    ] });

  add({ id: "aide", f: "Communauté", n: "Suggestions, bugs et codes cadeaux", ic: "idee", page: "sugg", k: "suggestion idee bug signaler code cadeau discord pluie de kamas cagnotte",
    ou: "Communauté › Suggestions · « Signaler un bug » en bas du menu · Options › Jeu › Code cadeau", de: "dès le début",
    b: () => [
      ["ul", [
        "**Suggestions** : propose une idée (titre et texte courts) ; sans serveur, elle est copiée et le Discord s'ouvre.",
        "**Signaler un bug** (en bas du menu) : décris ce qui s'est passé ; le diagnostic (version, appareil, page, dernières erreurs) peut être joint. Le rapport part directement pour être corrigé.",
        "**Codes cadeaux** : dans Options › Jeu, un code par partie. Ils sont annoncés en jeu et sur le Discord. Les codes à nombre limité demandent d'être connecté à un compte.",
        "**Pluie de kamas** : de temps en temps, Xener donne des kamas de son propre compte pendant quelques minutes (annoncé dans le bandeau et le chat). Clique « Je participe » sur l'accueil : à la fin, la pluie est partagée à parts égales entre tous les participants. Il faut un compte.",
      ]],
    ] });

  /* ======================= Options ======================= */
  add({ id: "options", f: "Options", n: "Options, sauvegarde et compte", ic: "parchemin_or", page: null, k: "options theme sauvegarde compte export import parties musique sons animations texte batterie economie",
    ou: "Options, en bas du menu", de: "dès le début",
    voir: ["absence"],
    b: () => [
      ["ul", [
        "**Économie de batterie** (Affichage, tout en haut) : coupe les animations, le fond animé, les effets de combat et les chiffres de dégâts qui volent, et met l'écran à jour moins souvent. Le jeu avance exactement pareil ; à garder sur téléphone ou portable débranché. En combat, l'appareil travaille environ 5 fois moins (mesuré sur PC et téléphone).",
        "**Affichage** : thème (Émeraude, Nuit violette, Givre, Ambre, Braise, Écume ; Halouine du 24 octobre au 3 novembre), ambiance animée, taille du texte, contraste, animations de combat, mouvements réduits.",
        "**Sons** : table de mixage (volume général, musique, fanfares et récompenses, interface, combat, ambiances), timbre selon le thème, juke-box des partitions trouvées (l'air d'un endroit se trouve après 5 s passées là-bas, même sans musique ; celui de la Renaissance du Phénix est sur la page Maîtrise).",
        "**Jeu** : consignes d'absence, raccourcis clavier, notifications, code cadeau.",
        "**Sauvegarde** : la partie est enregistrée dans le navigateur toutes les 15 s et des copies de secours sont gardées. « Changer d'appareil » exporte et importe la partie.",
        "**Compte en ligne** : la partie 1 se synchronise avec le serveur (Hôtel de vente, guilde, classements…). Les parties 2 et 3 restent sur l'appareil.",
        "**Aide** : Carnet des découvertes, recherche, notes de mise à jour, Discord.",
      ]],
    ] });

  /* ======================= Par où commencer (idée 2A) et glossaire (idée 4A) ======================= */
  const sv = () => S() || { chars: [], cnt: {}, progress: {}, stasis: {} };
  const best = () => V(() => Math.max(1, ...sv().chars.map((c) => c.lvl || 1)), 1);
  const bossDone = () => V(() => Object.values(sv().progress.bossKills || {}).filter((n) => n > 0).length, 0);
  const stasisTop = () => V(() => Math.max(0, ...Object.values(sv().stasis || {}).map((x) => x.max || 0)), 0);
  const cnt = (o) => (o ? Object.keys(o).length : 0);
  /* les étapes conseillées, calculées sur la partie : { t: texte, ok, ic, nav: page, ch: chapitre } */
  function steps() {
    const s = sv(); const n = s.chars.length, tm = V(() => E.TEAM_MAX, 8), lv = best(); const L = [];
    const cost = V(() => E.recruitCost(n + 1), 0);
    L.push(n >= tm ? { t: `Équipe complète : ${n} héros.`, ok: 1 } : { t: `Recrute ton ${n + 1}e héros pour ${fr(cost)} kamas${s.kamas >= cost ? " : tu as de quoi le payer" : ""}. Chaque classe différente renforce l'équipe.`, ic: "combat", nav: "team", ch: "equipe" });
    const pts = s.chars.filter((c) => (c.pts || 0) > 0 && c.autoStat === false);
    L.push(pts.length ? { t: `${pts.map((c) => c.name).join(", ")} : des points de caractéristiques à répartir.`, ic: "parchemin_or", nav: "team", ch: "caracs" } : { t: "Points de caractéristiques répartis.", ok: 1 });
    L.push(V(() => E.sabUnlocked(s), false) ? { t: "Sablier de Xélor débloqué.", ok: 1 } : { t: `Avance la quête principale jusqu'à l'étape ${N(() => E.SAB_UNLOCK_STEP)} (fin d'Incarnam) pour débloquer le Sablier de Xélor.`, ic: "cristal", nav: "quests", ch: "sablier" });
    L.push(bossDone() ? { t: `${fr(bossDone())} donjon${bossDone() > 1 ? "s" : ""} terminé${bossDone() > 1 ? "s" : ""}.`, ok: 1 } : { t: "Termine ton premier donjon : la clé se trouve en chassant dans la sous-zone du donjon.", ic: "coffre", nav: "dungeons", ch: "donjons" });
    const sk = stasisTop();
    L.push(sk >= 4 ? { t: `Meilleure stasis réussie : ${sk}.`, ok: 1 } : { t: `Monte un donjon jusqu'à la stasis 4 (meilleure pour l'instant : ${sk}).`, ic: "coffre", nav: "dungeons", ch: "donjons#la-stasis" });
    const lvlStep = (req, has, okT, t, ic, nav, ch) => L.push(has ? { t: okT, ok: 1 } : lv < req ? { t: `Niveau ${req} : ${t}`, ic: "cle", ch } : { t: t.charAt(0).toUpperCase() + t.slice(1), ic, nav, ch });
    lvlStep(V(() => E.EXP_MIN_LVL, 10), (s.cnt.exp || 0) > 0 || cnt(s.atelier) > 0, "Expéditions découvertes.", "envoie un héros en expédition depuis le Havre-Sac.", "carte", "home", "expeditions");
    lvlStep(V(() => E.PET_LVL, 10), cnt(s.pets) > 0, "Premier familier obtenu.", "trouve ou achète un premier familier.", "../p/18003", "pets", "familiers");
    lvlStep(V(() => E.ALIGN_MIN_LVL, 30), !!s.align, "Alignement choisi.", "choisis ton camp, Bonta ou Brâkmar.", "ailes", "quests", "alignement");
    lvlStep(V(() => E.MOUNT_LVL, 60), cnt(s.mounts) > 0, "Première monture.", "capture ta première monture.", "../mt/97021", "pets", "montures");
    const dq = V(() => Object.values(s.dofusQ || {}).filter((q) => q.done).length, 0);
    L.push(dq ? { t: `${dq} quête${dq > 1 ? "s" : ""} de Dofus terminée${dq > 1 ? "s" : ""}.`, ok: 1 } : { t: "Avance une quête de Dofus : elle donne le Dofus à la dernière étape.", ic: "dofus", nav: "dofus", ch: "dofus" });
    const mx = V(() => E.MAX_LVL, 200);
    L.push(lv >= mx ? { t: `Un héros niveau ${mx}.`, ok: 1 } : { t: `Monte un héros niveau ${mx} (meilleur : niveau ${lv}).`, ic: "trophee", nav: "team", ch: "niveaux" });
    const rn = s.chars.some((c) => c.mt && c.mt.t && c.mt.t.some((x) => x && x.length)); // 2.0 : la Maîtrise remplace la Renaissance
    L.push(rn ? { t: "Premiers points de Maîtrise placés.", ok: 1 } : lv < mx ? { t: `Niveau ${mx} : la Maîtrise.`, ic: "cle", ch: "maitrise" } : { t: "Place les points de Maîtrise d'un héros niveau 200 dans le ciel de sa classe.", ic: "cristal", nav: "maitrise", ch: "maitrise" });
    L.push(sk >= 10 ? { t: "Stasis 10 réussie.", ok: 1 } : { t: "Vise la stasis 10 : la meilleure chance de Dofus.", ic: "coffre", ch: "strat-stasis" });
    return L;
  }
  CH.unshift({ id: "parcours", f: "Bien débuter", n: "Par où commencer ?", ic: "quetes", page: null, k: "conseil quoi faire objectif debutant suite etapes",
    voir: ["debut", "strat-equipe"],
    b: () => { const L = steps(); const todo = L.filter((x) => !x.ok), done = L.filter((x) => x.ok);
      return [
        ["p", "Ces étapes sont calculées sur ta partie : ce qui reste à faire d'abord, puis ce qui est déjà fait. Les boutons mènent à la page ou au chapitre qui explique comment faire."],
        todo.length ? ["go", todo] : ["p", "Tout est fait : direction les chapitres de **Stratégie** pour aller plus loin."],
        done.length ? ["more", `Déjà fait (${done.length})`, ["go", done]] : null,
      ]; } });
  add({ id: "glossaire", f: "Bien débuter", n: "Glossaire", ic: "parchemin_or", page: null, k: "mot definition vocabulaire lexique",
    voir: ["parcours"],
    b: () => [
      ["p", "Les mots du jeu. Dans les autres chapitres, ils sont soulignés en pointillé : survole-les ou touche-les pour la définition."],
      ["kv", GLOSS.slice().sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([t, d]) => [`**${t}**`, d, GICON[t]])],
    ] });

  /* ======================= Stratégie (idée 8A) ======================= */
  const teamPassives = () => V(() => D.CLASS_ORDER.filter((k) => /équipe/i.test((D.CLASSES[k].passive || {}).desc || "")).map((k) => `**${D.CLASSES[k].name}** : ${D.CLASSES[k].passive.desc.split(/(?<=\.)\s/).filter((x) => /équipe/i.test(x)).join(" ")}`), []);
  add({ id: "strat-equipe", f: "Stratégie", n: "Monter une équipe équilibrée", ic: "combat", page: "team", k: "composition equipe tank soin soutien synergie premiere ligne conseils",
    voir: ["equipe", "classes", "sorts"],
    b: () => [
      ["p", `Une équipe solide mélange des héros qui encaissent devant, des héros qui frappent fort derrière et au moins un soutien. Vise ${N(() => E.TEAM_MAX)} héros de classes toutes différentes.`],
      ["ul", [
        "**Première ligne** : 2 à 4 héros solides. Le placement automatique favorise Sacrieur, Féca, Pandawa, Zobal et Forgelance. Donne-leur de la Vitalité et des résistances.",
        "**Arrière** : les héros qui font le plus de dégâts, montés dans leur élément conseillé (voir la fiche de chaque classe).",
        "**Soutien** : au moins un héros avec un soin ou une protection sur sa barre. À partir des donjons, ça change tout.",
        "**Synergie** : chaque classe différente ajoute +2 % de dégâts et d'XP à toute l'équipe ; huit fois la même classe n'en donne aucune.",
        "**Un seul élément par héros** : les points d'un élément montent plus vite que deux éléments à moitié.",
      ]],
      ["h", "Passifs qui profitent à toute l'équipe"],
      ["ul", teamPassives()],
      ["tip", "Après un gros butin, « Équiper au mieux » sur la page Équipe et héros. Laisse les caractéristiques en automatique tant que tu découvres une classe."],
    ] });
  add({ id: "strat-stasis", f: "Stratégie", n: "Bien jouer la stasis 10 et plus", ic: "coffre", page: "dungeons", k: "stasis haute difficile bloque perdre fin de jeu endgame dofus conseils",
    voir: ["donjons", "dofus", "chasse"],
    b: () => [
      ["p", "Repères d'équilibrage : sans équipement, une équipe passe jusqu'à la stasis 4 ; bien équipée, la stasis 6 à 7 ; la stasis 10 demande une équipe optimisée (8 héros, objets forgemagés, Dofus)."],
      ["ul", [
        "Dès la stasis 4, les monstres suivent le niveau de ton équipe : monter de niveau ne suffit plus, c'est l'équipement qui compte.",
        `Dès la stasis 9, les donjons ont une limite de tours (${N(() => E.STASIS_TL.room)} par salle, ${N(() => E.STASIS_TL.boss)} pour le boss) : il faut des dégâts, pas seulement de la survie.`,
        "La chance de Dofus ne monte plus après la stasis 10. Les stasis 11 à 15 servent aux gains, aux coffres de premier passage et au classement des temps.",
        "Les leviers de fin de jeu : forgemagie près du jet parfait, Potentiel des Dofus, Sceaux des Champions, arbre de Maîtrise.",
        "Retire les idoles quand tu bloques : elles augmentent la difficulté.",
        "Après une défaite, « Pourquoi j'ai perdu » dit ce qui a manqué (dégâts, survie, tours).",
        "Une Fiole de résurrection relance une fois le donjon perdu sans perdre la clé.",
      ]],
      ["kv", [10, 12, 15].map((k) => [`Stasis ${k}`, V(() => { const m = E.stasisMult(k); return `vie ×${fr(Math.round(m.hp * 100) / 100)} · dégâts ×${fr(Math.round(m.dmg * 100) / 100)} · gains ×${fr(Math.round(m.rew * 100) / 100)}`; })])],
    ] });
  add({ id: "strat-kamas", f: "Stratégie", n: "Gagner des kamas", ic: "bourse", page: "hdv", k: "argent kamas riche vendre gagner economie conseils",
    voir: ["hdv", "quetes", "metiers"],
    b: () => [
      ["ul", [
        "**Chasse là où tu gagnes vite** : une zone un peu sous ton niveau donne souvent plus par heure qu'une zone où l'équipe peine.",
        "**Donjon de l'heure** : gains ×1,25 ; les donjons éclair ×1,12.",
        "**Vente directe** (Cours des ressources) : vends quand le coefficient est haut ; il baisse quand tout le monde vend la même chose et remonte avec le temps.",
        "**Hôtel de vente** : les objets rares et Rayonnants s'y vendent bien mieux qu'au marchand ; la taxe est de 2 %.",
        "**Quêtes du jour et de la semaine, commandes d'artisans, avis de recherche** : des kamas garantis chaque jour.",
        "**Succès** : chacun donne des kamas ; regarde ceux qui sont presque finis.",
        "**Collection des classes** : chaque classe montée niveau 200 donne +1 % de kamas à tout le compte.",
        "Ne revends pas tout : briser un objet donne des runes qui valent souvent plus que sa revente.",
      ]],
      ["p", "Passifs qui augmentent le butin ou les kamas : " + V(() => D.CLASS_ORDER.filter((k) => /kamas|butin/i.test((D.CLASSES[k].passive || {}).desc || "")).map((k) => `**${D.CLASSES[k].name}**`).join(", "), "?") + " (détails dans leur fiche, famille Classes)."],
    ] });
  add({ id: "strat-ren", f: "Stratégie", n: "Placer sa Maîtrise", ic: "cristal", page: "maitrise", k: "maitrise arbre conseil cle de voute placer points",
    voir: ["maitrise", "niveaux"],
    b: () => { const s = sv(); const c200 = s.chars.filter((c) => c.lvl >= V(() => E.MAX_LVL, 200));
      return [
        ["p", `La Maîtrise s'ouvre au niveau ${N(() => E.MAX_LVL)} : chaque niveau de Maîtrise donne 1 point à placer dans le ciel de la classe du héros.`],
        ["ul", [
          "**Le cœur d'abord** pour un héros qui vit de son passif (Iop, Sram, Xélor…) : les 26 étoiles allument le symbole de la classe.",
          "**Un domaine qui suit l'élément** de l'équipement : les deux éléments forts de la classe sont en haut du ciel.",
          "**Une clé de voûte à la fois** : chacune a une contrepartie ; compare avant de changer d'arbre enregistré.",
          `Rendre des étoiles (une à une, en changeant d'arbre enregistré, avec un code ou avec **Tout rendre**) est gratuit jusqu'à ${N(() => E.MT_FREE)} points placés, puis coûte ${N(() => E.MT_RESPEC)} kamas par point rendu. **Annuler** reprend gratuitement les derniers points placés.`,
        ]],
        ["p", c200.length ? `Héros qui ont une Maîtrise : ${c200.map((c) => `**${c.name}** (${fr(V(() => E.mtPts(c), 0))} points)`).join(", ")}.` : `Aucun héros niveau ${N(() => E.MAX_LVL)} pour l'instant (meilleur : niveau ${best()}).`],
      ]; } });

  /* ======================= Fiches de classe (idée 10A) ======================= */
  const ELN = { t: "Terre", f: "Feu", e: "Eau", a: "Air", n: "Neutre" };
  V(() => D.CLASS_ORDER, []).forEach((k) => {
    const C = D.CLASSES[k]; if (!C) return;
    add({ id: "cl-" + k, f: "Classes", n: C.name, img: `assets/h/${k}_sym.png`, page: "team", k: `classe ${C.name} fiche passif element arme sorts`,
      voir: ["classes", "strat-equipe", "sorts"],
      b: () => {
        const st0 = D.STATS || {}; const el = st0[C.elRec] || {};
        const clean = (t) => String(t || "").replace(/\{\{[^}]*?::([^}]*)\}\}/g, "$1").replace(/\{\{[^}]*\}\}/g, "").replace(/\s*•\s*/g, " ").split(/(?<=\.)\s/)[0];
        const W = V(() => E.CLASS_WEAPONS[k].map((t) => (E.WTYPES[t] || {}).name).filter(Boolean).join(" et "), "?");
        const base = V(() => C.spells.filter((x) => !x.variant).sort((a, b) => a.lvl - b.lvl), []);
        const pick = base.length <= 6 ? base : [0, 1, 2, 3, 4, 5].map((i) => base[Math.round((i * (base.length - 1)) / 5)]);
        const mine = sv().chars.filter((c) => c.cls === k);
        return [
          ["p", C.desc || ""],
          ["kv", [
            ["Élément conseillé", el.name ? `${el.name}${el.el ? ` (${ELN[el.el]})` : ""}` : "?"],
            ["Armes favorites", `${W} (+${N(() => E.WEAPON.fav * 100)} % de dégâts)`],
            ["Paires de sorts", fr(base.length)],
          ]],
          ["h", "Passif"],
          ["p", C.passive ? `**${C.passive.name}** : ${C.passive.desc}` : ""],
          ["h", "Sorts clés au fil des niveaux"],
          ["ul", pick.map((x) => { const g = (x.grades || [])[0] || x; return `**${x.name}** (niv. ${x.lvl}, ${g.pa} PA)${x.desc ? " : " + clean(x.desc) : ""}`; })],
          ["p", mine.length ? `Dans ta partie : ${mine.map((c) => `**${c.name}** niv. ${c.lvl}${c.ren ? ` (Renaissance ${c.ren})` : ""}`).join(", ")}.` : `Tu n'as pas encore de ${C.name}.`],
        ];
      } });
  });

  /* ---------- glossaire (idée 4A) : les mots sont soulignés dans le guide, une fois par chapitre ---------- */
  const GLOSS = [
    ["PA", "Points d'action : ce qu'un héros dépense pour lancer ses sorts à chaque tour (6 au départ, 12 au plus)."],
    ["PM", "Points de mouvement : dans Idlus on ne se déplace pas, ils donnent de l'esquive en première ligne et de la poussée."],
    ["PO", "Portée : bonus des sorts à distance et des dégâts de poussée."],
    ["XP", "Expérience : fait monter le niveau des héros (200 au plus)."],
    ["stasis", "Difficulté d'un donjon, de 1 à " + N(() => E.STASIS_MAX) + " : monstres plus forts, meilleures récompenses."],
    ["Initiative", "Décide qui joue en premier à chaque tour."],
    ["puits", "Réserve de poids gagnée en forgemagie, qui paie les pertes des succès neutres."],
    ["exo", "Exotique : PA, PM, PO ou Invocation ajoutés à un objet avec une rune Ga."],
    ["érosion", "Au Kolizéum, dès le tour " + N(() => E.KOLI.ero) + " : soins et vie max baissent à chaque tour."],
    ["Rayonnant", "Objet au jet plus haut que d'habitude, plus rare."],
    ["archimonstre", "Version rare d'un monstre, dont on capture l'âme avec une Pierre d'âme."],
    ["Champion", "Monstre avec un pouvoir (Enragé, Blindé…), qui fait monter les Sceaux."],
    ["Sceau", "Bonus porté par un héros, qui grandit avec les Champions vaincus."],
    ["chromatique", "Monstre aux couleurs rares (1 sur " + N(() => Math.round(1 / E.CHROMA_CHANCE)) + "), pour l'album des Chromatiques."],
    ["Potentiel", "Rangs d'un Dofus (0 à " + N(() => E.DPOT_MAX) + "), montés avec des éclats gagnés en donjon."],
    ["Maîtrise", "Après le niveau 200, l'XP donne des points à placer dans l'arbre de sa classe (elle remplace l'ancienne Renaissance)."],
    ["kolizetons", "Monnaie du Kolizéum."],
    ["Bribes de rêve", "Monnaie du Songe infini."],
    ["Doplons", "Monnaie des temples, gagnée contre les Dopeuls."],
    ["Essence", "Monnaie des familiers et de l'élevage."],
    ["trop-plein", "Place de secours quand le sac est plein."],
    ["trophée de zone", "Bonus gagné quand chaque monstre d'une sous-zone est tué " + N(() => D.HUNT_TIERS[1].n) + " fois."],
    ["synergie", "+2 % de dégâts et d'XP par classe différente dans l'équipe."],
    ["Sablier", "Réserve de temps qui fait tourner le jeu ×2 ou ×3."],
  ];
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let GRX = null;
  const grx = () => GRX || (GRX = GLOSS.map(([t, d]) => [new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(t)}s?)(?![\\p{L}\\p{N}])`, t.length <= 3 ? "u" : "iu"), t, d]));
  let seen = null; // mots déjà soulignés dans le chapitre en cours
  function gloss(html) {
    if (!seen) return html;
    return html.split(/(<[^>]+>)/).map((part, i) => {
      if (i % 2 || !part) return part;
      for (const [rx, t, d] of grx()) {
        if (seen.has(t)) continue;
        const m = rx.exec(part); if (!m) continue;
        seen.add(t); const at = m.index + m[1].length;
        return part.slice(0, at) + `<abbr class="gd-g" tabindex="0" data-act="gd-gl" data-v="${h(t)}" title="${h(d)}">${m[2]}</abbr>` + gloss(part.slice(at + m[2].length));
      }
      return part;
    }).join("");
  }

  /* ---------- calculateurs (idée 5A) ---------- */
  const st = { id: null, q: "", at: null, calc: {}, fam: {}, sum: false };
  const FK = "idlus-guide-familles"; // familles ouvertes, gardées sur l'appareil
  try { const o = JSON.parse(localStorage.getItem(FK) || "{}"); if (o && typeof o === "object") st.fam = o; } catch (e) {}
  const famSave = () => { try { localStorage.setItem(FK, JSON.stringify(st.fam)); } catch (e) {} };
  const sel = (k, opts, v) => `<select data-act="gd-calc" data-k="${k}" aria-label="${h(k)}">${opts.map(([a, b]) => `<option value="${h(a)}" ${String(a) === String(v) ? "selected" : ""}>${h(b)}</option>`).join("")}</select>`;
  const dur = (sec) => { sec = Math.max(0, Math.round(sec)); const hh = Math.floor(sec / 3600), mm = Math.round((sec % 3600) / 60); return hh ? `${hh} h ${String(mm).padStart(2, "0")}` : `${mm} min`; };
  const runsFor = (q, goal) => (q > 0 ? Math.ceil(Math.log(1 - goal) / Math.log(1 - q)) : Infinity);
  const CALC = {
    dofus: () => {
      const s = S(); const n0 = V(() => E.team(s).length, 1) || 1;
      const k = +(st.calc.dk || 10), n = +(st.calc.dn || n0);
      const p = V(() => 1 / E.dofusOdds(k), 0), q = 1 - Math.pow(1 - p, n);
      return [`<div class="gd-cin"><label>Stasis ${sel("dk", Array.from({ length: V(() => E.STASIS_MAX, 15) }, (_, i) => [i + 1, i + 1]), k)}</label><label>Héros dans l'équipe ${sel("dn", Array.from({ length: V(() => E.TEAM_MAX, 8) }, (_, i) => [i + 1, i + 1]), n)}</label></div>`,
        [["Chance par héros", p ? "1 / " + fr(Math.round(1 / p)) : "?"], ["Chance par donjon fini", q < 0.01 ? fr(Math.round(q * 100000) / 1000) + " %" : pc(q)], ["Donjons pour 50 % de chance", fr(runsFor(q, 0.5))], ["Donjons pour 90 % de chance", fr(runsFor(q, 0.9))]]];
    },
    recrue: () => {
      const s = S(); const n = s.chars.length; const max = V(() => E.HERO_MAX, 19), tm = V(() => E.TEAM_MAX, 8);
      const sum = (a, b) => { let t = 0; for (let i = a; i <= b; i++) t += E.recruitCost(i); return t; };
      if (n >= max) return ["", [["Héros", `${n} / ${max} : c'est complet`]]];
      return ["", [["Tes héros", `${n} / ${max}`], [`Prochain héros (${n + 1}e)`, fr(E.recruitCost(n + 1)) + " kamas"], ["Tes kamas", fr(Math.floor(s.kamas))], n < tm ? [`Jusqu'à ${tm} héros (équipe pleine)`, fr(sum(n + 1, tm)) + " kamas"] : null, [`Jusqu'à ${max} héros`, fr(sum(n + 1, max)) + " kamas"]]];
    },
    sablier: () => {
      const s = S(); const B = s.sablier || {}; const ok = V(() => E.sabUnlocked(s), false);
      if (!ok) return ["", [["Sablier", "pas encore débloqué"]]];
      const r = B.r || 0, max = V(() => E.sabMaxOf(s), 0);
      return ["", [["Ta réserve", dur(r)], ["Réserve maximum", dur(max)], ["Plein dans", r >= max ? "déjà plein" : dur((max - r) / E.sabRate(s))], ["En ×2, la réserve dure", dur(r)], ["En ×3, la réserve dure", dur(r / 2)], ...(V(() => E.sabMaxSpd(s), 3) >= 4 ? [["En ×4, la réserve dure", dur(r / 3)]] : []), ["Maîtrise du temps", "niveau " + V(() => E.sabMtLvl(s), 1) + " / 50"]]];
    },
    xp: () => {
      const s = S(); const L = s.chars; const c = L.find((x) => String(x.id) === String(st.calc.xh)) || L[0]; if (!c) return ["", []];
      let left = 0; for (let l = c.lvl; l < E.MAX_LVL; l++) left += E.heroXpNeed(c, l);
      left -= c.xp || 0;
      const need = c.lvl < E.MAX_LVL ? E.heroXpNeed(c) : 0;
      return [`<div class="gd-cin"><label>Héros ${sel("xh", L.map((x) => [x.id, `${x.name} (niv. ${x.lvl})`]), c.id)}</label></div>`,
        [["Niveau", fr(c.lvl) + (c.ren ? ` · Renaissance ${c.ren}` : "")], ["XP pour le niveau suivant", c.lvl < E.MAX_LVL ? fr(Math.max(0, need - (c.xp || 0))) : "niveau max"], ["XP jusqu'au niveau " + fr(E.MAX_LVL), fr(Math.max(0, left))], ...(c.lvl >= E.MAX_LVL ? [["Maîtrise", fr(V(() => E.mt(c).lvl, 0)) + " niveaux, " + fr(V(() => E.mtPts(c), 0)) + " points"]] : [])]];
    },
  };
  const CALC_N = { dofus: "Calculateur : chance de Dofus", recrue: "Calculateur : recrutement", sablier: "Calculateur : Sablier", xp: "Calculateur : XP d'un héros" };
  function calcHtml(id) {
    const f = CALC[id]; if (!f || !S()) return "";
    const [inputs, rows] = V(f, ["", []]);
    return `<div class="gd-calc"><b class="small">${X().IC("cristal")} ${h(CALC_N[id] || "")}</b>${inputs}<div class="gd-kv">${rows.filter(Boolean).map(([a, c]) => `<div><span>${h(a)}</span><b class="num">${h(c)}</b></div>`).join("")}</div></div>`;
  }

  /* ---------- ajouts aux chapitres : calculateurs (5A), tableaux repliés (11A), « Je connais DOFUS » (15A) ---------- */
  const fmRow = (load, tier) => V(() => { const o = E.fmOdds(load, 1, 10, 10, tier, false, 0); return `critique ${pc(o.sc)} · neutre ${pc(o.sn)} · échec ${pc(o.ec)}`; });
  const EXTRA = {
    equipe: () => [["calc", "recrue"], ["more", "Prix de tous les recrutements", ["kv", Array.from({ length: Math.max(0, V(() => E.HERO_MAX, 19) - 1) }, (_, i) => [`${i + 2}e héros`, N(() => E.recruitCost(i + 2)) + " kamas"])]]],
    niveaux: () => [["calc", "xp"]],
    sablier: () => [["calc", "sablier"]],
    dofus: () => [["calc", "dofus"], ["more", `Chance par héros, stasis 1 à ${N(() => E.STASIS_MAX)}`, ["kv", Array.from({ length: V(() => E.STASIS_MAX, 15) }, (_, i) => [`Stasis ${i + 1}`, V(() => "1 / " + fr(Math.round(E.dofusOdds(i + 1))))])]]],
    forgemagie: () => [["more", "Chances selon la charge de l'objet", ["kv", [
      ...[0.3, 0.6, 0.8, 1, 1.2].map((l) => [`Objet chargé à ${fr(l * 100)} %, rune simple`, fmRow(l, "")]),
      ["Objet chargé à 60 %, rune Pa", fmRow(0.6, "pa")], ["Objet chargé à 60 %, rune Ra", fmRow(0.6, "ra")],
    ]]], ["p", "Ces chances valent loin du jet maximum ; au-delà de 80 % de la plage du jet, le succès critique est divisé par quatre."]],
  };
  const DOF = {
    combat: "Pas de grille ni de déplacement : les PM donnent de l'esquive en première ligne et de la poussée, la portée un bonus de dégâts. Les sorts partent seuls, dans l'ordre de la barre.",
    caracs: "Mêmes paliers qu'en DOFUS : Vitalité 1 pour 1, Sagesse 3 points pour 1, éléments de plus en plus chers après 100. Remettre les points à zéro est gratuit.",
    sorts: "Comme dans DOFUS 3, chaque sort a une variante ; ici la barre se règle avec des conditions et des cibles, puisque les héros jouent seuls.",
    donjons: "La stasis vient de DOFUS 3, mais ici elle va jusqu'à 15 et chaque palier se débloque en réussissant le précédent, donjon par donjon.",
    dofus: "Pas d'échange ni de vente de Dofus. Aucun bonus de butin ne change leurs chances, et le Potentiel (rangs 0 à X) est propre à Idlus.",
    forgemagie: "Mêmes trois issues et même puits que dans DOFUS. Différences : près du jet maximum la rune passe bien plus difficilement, et la Renaissance des métiers améliore les chances.",
    koli: "Kolizéum en 3 contre 3 contre l'équipe enregistrée d'un autre joueur (ou un Fantôme), pas en direct. Les Sceaux sont coupés.",
    hdv: "Taxe de 2 % à la mise en vente, comme dans DOFUS. La vente directe au jeu (Cours des ressources) est propre à Idlus.",
    montures: "Pas de jauges d'endurance ou de maturité à remplir : la monture prend une part de l'XP de son héros et lui donne ses caractéristiques.",
    alignement: "Bonta et Brâkmar comme dans DOFUS : honneur et 20 rangs, agressions, talents d'ordre, Arsenal de la cité et guerre des régions sur la carte.",
    maitrise: "Il n'y a pas de Maîtrise dans DOFUS : c'est un ajout d'Idlus pour aller plus loin que le niveau 200 (elle remplace l'ancienne Renaissance).",
    metiers: "Le niveau de métier demandé est celui de l'objet, comme dans DOFUS. Les métiers sont partagés par tout le compte.",
  };
  /* ---------- « Où tu en es » (6A) et « Prochain objectif » (7A) : lus dans la partie à l'ouverture du chapitre ---------- */
  const lowJob = () => V(() => { const J = sv().jobs || {}; const k = Object.keys(J).sort((a, b) => (J[a].lvl || 1) - (J[b].lvl || 1))[0]; return k ? [k, J[k].lvl || 1] : null; }, null);
  const PROG = {
    equipe: () => { const s = sv(); const n = s.chars.length, tm = V(() => E.TEAM_MAX, 8), mx = V(() => E.HERO_MAX, 19); const cl = new Set(V(() => E.team(s), []).map((c) => c.cls)).size;
      return [`${n} héros sur ${mx}, ${fr(V(() => E.team(s).length, 0))} en équipe, ${cl} classe${cl > 1 ? "s" : ""} différente${cl > 1 ? "s" : ""}.`, n < tm ? `Recruter le ${n + 1}e héros (${N(() => E.recruitCost(n + 1))} kamas).` : n < mx ? "Recruter des héros de réserve pour la récolte et les expéditions." : null]; },
    niveaux: () => { const T = V(() => E.team(sv()), []); if (!T.length) return null; const lo = T.slice().sort((a, b) => a.lvl - b.lvl)[0];
      return [`Meilleur héros niveau ${best()}, équipe en moyenne niveau ${fr(Math.round(T.reduce((a, c) => a + c.lvl, 0) / T.length))}.`, lo.lvl < V(() => E.MAX_LVL, 200) ? `Faire monter ${lo.name} (niveau ${lo.lvl}), le plus bas de l'équipe.` : null]; },
    donjons: () => { const sk = stasisTop(); return [`${fr(bossDone())} donjon${bossDone() > 1 ? "s" : ""} terminé${bossDone() > 1 ? "s" : ""} sur ${N(() => Object.keys(D.DUNGEONS).length)}, meilleure stasis réussie : ${sk}.`, !bossDone() ? "Terminer un premier donjon." : sk < 4 ? "Atteindre la stasis 4." : sk < 7 ? "Atteindre la stasis 7 avec une équipe bien équipée." : sk < 10 ? "Atteindre la stasis 10." : sk < V(() => E.STASIS_MAX, 15) ? `Pousser jusqu'à la stasis ${N(() => E.STASIS_MAX)}.` : null]; },
    dofus: () => { const s = sv(); const dq = V(() => Object.values(s.dofusQ || {}), []); const done = dq.filter((q) => q.done).length;
      return [`${fr(s.cnt.dofus || 0)} Dofus obtenu${(s.cnt.dofus || 0) > 1 ? "s" : ""} sur ${N(() => E.DOFUS_ORDER.length)}, ${done} quête${done > 1 ? "s" : ""} de Dofus terminée${done > 1 ? "s" : ""} sur ${dq.length}.`, done < dq.length ? "Avancer la prochaine quête de Dofus (Héros › Dofus › Quêtes et butin)." : null]; },
    familiers: () => { const n = cnt(sv().pets), req = V(() => E.PET_LVL, 10); return [`${n} familier${n > 1 ? "s" : ""}.`, best() < req ? `Monter un héros niveau ${req}.` : !n ? "Obtenir un premier familier." : null]; },
    montures: () => { const n = cnt(sv().mounts), req = V(() => E.MOUNT_LVL, 60); return [`${n} monture${n > 1 ? "s" : ""}.`, best() < req ? `Monter un héros niveau ${req}.` : !n ? "Capturer une première monture." : null]; },
    maitrise: () => { const s = sv(); const M = s.chars.filter((c) => V(() => E.mtPts(c), 0) > 0).sort((a, b) => E.mtPts(b) - E.mtPts(a)); const top = M[0];
      return [top ? `${M.length} héros avec de la Maîtrise, au plus ${fr(E.mtPts(top))} points (${top.name}).` : "Aucune Maîtrise pour l'instant.", top ? `Placer les points de ${top.name} (Héros › Maîtrise).` : `Monter un héros niveau ${N(() => E.MAX_LVL)}.`]; },
    metiers: () => { const J = sv().jobs || {}; const ks = Object.keys(J); if (!ks.length) return null; const lo = lowJob();
      return [`${ks.length} métiers de récolte, meilleur niveau ${Math.max(...ks.map((k) => J[k].lvl || 1))}.`, lo ? `Monter le métier le plus bas (${lo[0]}, niveau ${lo[1]}).` : null]; },
    sablier: () => { const s = sv(); if (!V(() => E.sabUnlocked(s), false)) return ["Pas encore débloqué.", `Atteindre l'étape ${N(() => E.SAB_UNLOCK_STEP)} de la quête principale.`]; const r = (s.sablier || {}).r || 0; return [`Réserve : ${dur(r)} sur ${dur(V(() => E.sabMaxOf(s), 0))}.`, null]; },
    succes: () => { const s = sv(); const n = cnt(s.ach), t = V(() => E.ACH.length, 0); return [`${fr(n)} succès sur ${fr(t)}.`, null]; },
    archis: () => { const n = cnt(sv().souls); return [`${fr(n)} âme${n > 1 ? "s" : ""} capturée${n > 1 ? "s" : ""} sur ${N(() => E.ARCHI_TOTAL)}.`, null]; },
    alignement: () => { const s = sv(); const req = V(() => E.ALIGN_MIN_LVL, 30); return s.align ? [`Rang d'alignement ${N(() => E.alignRankIdx(s))} sur 20.`, null] : ["Pas encore d'alignement.", best() < req ? `Monter un héros niveau ${req}.` : "Choisir Bonta ou Brâkmar."]; },
  };

  /* ---------- chapitres lus (14A) : gardés dans la sauvegarde, succès « Érudit d'Idlus » quand tout est lu ---------- */
  const readOf = () => { const s = S(); if (!s) return {}; return s.guideLu || (s.guideLu = {}); };
  const readN = () => { const R = readOf(); return CH.filter((c) => R[c.id]).length; };
  function markRead(id) {
    const s = S(); if (!s || !CH.some((c) => c.id === id)) return; const R = readOf(); if (R[id]) return;
    R[id] = 1; X().markDirty(); if (E.checkAch) try { E.checkAch(s); } catch (e) {}
  }
  if (E.ACH && !E.ACH.some((a) => a.id === "guide_erudit")) E.ACH.push({ id: "guide_erudit", cat: "Collection", name: "Érudit d'Idlus", desc: "Lire tous les chapitres du guide.", test: (s) => CH.every((c) => s.guideLu && s.guideLu[c.id]), kamas: 10000, title: "Érudit d'Idlus" });

  /* ---------- fiche d'un donjon (idée 18A) et comparateur d'un jet (idée 19A) ---------- */
  const dgList = () => V(() => Object.keys(D.DUNGEONS).sort((a, b) => D.DUNGEONS[a].lvl - D.DUNGEONS[b].lvl || D.DUNGEONS[a].name.localeCompare(D.DUNGEONS[b].name, "fr")), []);
  const EL = { t: ["fo", "dt"], f: ["ine", "df"], e: ["cha", "de"], a: ["age", "da"] };
  Object.assign(CALC, {
    dj: () => {
      const s = sv(); const L = dgList(); if (!L.length) return ["", []];
      const top = Math.max(1, ...V(() => E.team(s), []).map((c) => c.lvl));
      let did = st.calc.dj; if (!D.DUNGEONS[did]) did = (s.dungeon && s.dungeon.id) || L.filter((d) => D.DUNGEONS[d].lvl <= top).pop() || L[0];
      const d = D.DUNGEONS[did]; const M = (D.MONSTERS || {})[d.boss] || {}; const SI = (s.stasis || {})[did] || {}; const sub = E.SUBS && E.SUBS[d.access];
      const dof = V(() => Object.values(E.DOFUS).filter((x) => x.dg === did).map((x) => x.name).join(", "), "");
      return [`<div class="gd-cin"><label>Donjon ${sel("dj", L.map((k) => [k, `${D.DUNGEONS[k].name} (niv. ${D.DUNGEONS[k].lvl})`]), did)}</label><button class="btn sm" data-act="dgopen" data-id="${h(did)}">Ouvrir sa fiche</button></div>`,
        [["Niveau", fr(d.lvl)], ["Salles avant le boss", fr((d.rooms || []).length)], ["Boss", M.name || "?"], ["Clé", d.key || "?"], sub ? ["Accès (et clé en chasse)", sub.name] : null,
          ["Débloqué", V(() => E.dungeonUnlocked(s, did), false) ? "oui" : "pas encore"], ["Victoires sur le boss", fr((s.progress.bossKills || {})[did] || 0)], ["Ta meilleure stasis", SI.max ? fr(SI.max) : "aucune"], dof ? ["Dofus de ce boss", dof] : null]];
    },
    jet: () => {
      const s = sv(); const L = s.chars; if (!L.length) return ["", []];
      const c = L.find((x) => String(x.id) === String(st.calc.jh)) || L[0];
      const S0 = V(() => E.charStats(s, c), null); if (!S0) return ["", []];
      const el = ["t", "f", "e", "a"].sort((a, b) => (S0[EL[b][0]] || 0) - (S0[EL[a][0]] || 0))[0];
      const kind = st.calc.jk || "el", n = +(st.calc.jn || 10);
      const sp = V(() => D.CLASSES[c.cls].spells.find((x) => x.lvl <= c.lvl && E.spellGrade(x, c.lvl).fx.some((f) => f.k === "dmg")), null);
      const fx = sp ? E.spellGrade(sp, c.lvl).fx.find((f) => f.k === "dmg") : { min: 10, max: 14 };
      const base = ((fx.min + fx.max) / 2) * V(() => E.DMG_SCALE, 1);
      const hit = (st0) => base * (1 + Math.max(-50, (st0[EL[el][0]] || 0) + (st0.pui || 0)) / 100) + (st0.do || 0) + (st0[EL[el][1]] || 0);
      const S1 = Object.assign({}, S0); const key = kind === "el" ? EL[el][0] : kind; S1[key] = (S1[key] || 0) + n;
      const a = hit(S0), b = hit(S1); const ELN2 = { t: "Terre", f: "Feu", e: "Eau", a: "Air" };
      return [`<div class="gd-cin"><label>Héros ${sel("jh", L.map((x) => [x.id, `${x.name} (niv. ${x.lvl})`]), c.id)}</label><label>Jet ${sel("jk", [["el", `${(D.STATS[EL[el][0]] || {}).name} (son élément)`], ["pui", "Puissance"], ["do", "Dommages"], [EL[el][1], (D.STATS[EL[el][1]] || {}).name]], kind)}</label><label>De ${sel("jn", [1, 5, 10, 20, 50, 100].map((x) => [x, "+" + x]), n)}</label></div>`,
        [["Élément le plus fort", ELN2[el]], [sp ? `Sort de référence : ${sp.name}` : "Sort de référence", `${fr(Math.round(a))} dégâts en moyenne`], ["Avec le jet", `${fr(Math.round(b))} dégâts`], ["Gain", "+" + fr(Math.round(((b - a) / Math.max(1, a)) * 1000) / 10) + " %"]]];
    },
  });
  Object.assign(CALC_N, { dj: "Fiche d'un donjon", jet: "Comparateur : ce qu'un jet change sur tes dégâts" });
  EXTRA.donjons = () => [["calc", "dj"]];
  EXTRA.equipement = () => [["calc", "jet"]];
  const fm0 = EXTRA.forgemagie; EXTRA.forgemagie = () => fm0().concat([["calc", "jet"]]);

  /* ---------- questions fréquentes (idée 20A) : les questions qui reviennent dans le chat et les bugs signalés ---------- */
  add({ id: "faq", f: "Bien débuter", n: "Questions fréquentes", ic: "bug", page: null, k: "faq question pourquoi bug probleme aide",
    voir: ["aide", "parcours"],
    b: () => [
      ["p", "Les questions qui reviennent le plus souvent dans le chat et dans les bugs signalés. Touche une question pour lire la réponse."],
      ["more", "Pourquoi mon Sceau ne monte pas ?", ["p", `Un Sceau ne monte qu'en battant des Champions **de son pouvoir** : un Sceau Enragé compte les Champions Enragés. Les rangs arrivent à ${V(() => { const r = E.SEAL_RANKS; return r.slice(0, -1).join(", ") + " et " + r[r.length - 1]; }, "1, 5, 15, 40 et 100")} Champions. Les Champions tués avant la 1.1 ne comptent pas.`]],
      ["more", "La chance de Dofus monte-t-elle après la stasis 10 ?", ["p", "Non : elle monte jusqu'à la stasis 10 puis reste la même. Aucun bonus (butin, prospection, idoles) ne la change. Le calculateur du chapitre Dofus donne tes chances."]],
      ["more", "Le Sablier accélère-t-il le temps d'absence ?", ["p", "Non, jamais. Il ne s'use que jeu ouvert, quand quelque chose avance."]],
      ["more", "J'ai perdu ma clé en donjon, c'est normal ?", ["p", "Oui : une clé = une tentative. Perdre ou quitter fait perdre la clé, sauf avec une Fiole de résurrection (une fois par donjon)."]],
      ["more", "Ma forgemagie rate tout le temps, pourquoi ?", ["p", "Au-delà de 80 % de la plage d'un jet, le succès critique est divisé par quatre, et plus l'objet est chargé, moins il passe. Le tableau du chapitre Forgemagie donne les chances selon la charge."]],
      ["more", "Mon héros ne gagne presque plus d'XP.", ["p", `Un héros plus de ${N(() => E.XP_PEN.free, 6)} niveaux au-dessus des monstres perd de l'XP. Change de zone : l'accueil propose la zone conseillée pour ton niveau.`]],
      ["more", "Pourquoi mon équipe est redescendue de zone ?", ["p", "Avec la progression automatique, l'équipe redescend d'une zone après 3 défaites sur les 6 derniers combats, et remonte après 12 victoires d'affilée."]],
      ["more", "Combien de chance pour une monture ?", ["p", "La chance est par victoire dans la zone sauvage de l'espèce, pas par héros, et les bonus de butin ne la changent pas. Les chiffres sont dans le chapitre Montures."]],
      ["more", "Ma partie est-elle sauvegardée en ligne ?", ["p", "Avec un compte, la partie 1 se synchronise avec le serveur. Sans compte, elle reste sur l'appareil : Options › Sauvegarde permet de l'exporter."]],
      ["more", "Pourquoi mon compte n'est plus au classement ?", ["p", "Le serveur ne classe que des parties qu'il a validées. Une progression impossible pour le temps joué est signalée à Xener ; un compte suspendu sort des classements jusqu'à la fin de sa suspension. Détails dans le chapitre Classements."]],
      ["more", "Comment signaler un bug ?", ["p", "« Signaler un bug » en bas du menu : le signalement part directement à l'équipe du jeu, avec ce qu'il faut pour le corriger."]],
    ] });

  /* ---------- astuce du jour dans le Havre-Sac (idée 22A) : une astuce tirée des chapitres, la même toute la journée ---------- */
  let dayTip = null;
  function tipDay() {
    const day = Math.floor(Date.now() / 86400000);
    if (!dayTip || dayTip.day !== day) {
      const T = []; CH.forEach((c) => { try { (c.b() || []).forEach((b) => { if (b && b[0] === "tip" && b[1].length >= 60 && !/de la page|ce bouton|ici/i.test(b[1])) T.push([c, b[1]]); }); } catch (e) {} });
      const x = T.length ? T[day % T.length] : null;
      dayTip = { day, html: x ? `<div class="gd-day">${X().IC("idee")}<span class="grow small"><b>Astuce du jour · ${h(x[0].n)}</b> : ${md(x[1]).replace(/<abbr[^>]*>|<\/abbr>/g, "")}</span><button class="btn sm ghost" data-act="gd-open" data-v="${h(x[0].id)}">Lire la suite</button></div>` : "" };
    }
    return dayTip.html;
  }

  /* ---------- bulle pour les nouveaux comptes (idée 23A) : propose « Par où commencer ? » après les premiers combats ---------- */
  if (E.TIPS && !E.TIPS.some((t) => t.id === "guide")) E.TIPS.splice(1, 0, { id: "guide", name: "Le guide", hint: "trois combats", anchor: '#nav .sn-guide, #nav [data-nk="guide"]',
    cond: (s) => ((s.stats && s.stats.fights) || 0) >= 3,
    txt: "Le bouton ? en haut de chaque page ouvre le guide sur la page affichée. Le chapitre « Par où commencer ? » te dit quoi faire ensuite, calculé sur ta partie." });

  /* ---------- icônes à côté des titres (idée 24A) ---------- */
  const HICON = { potentiel: "dofus", brisage: "forge", recolte: "pioche", artisanat: "metiers", "les-cles": "cle", "la-stasis": "coffre", recompenses: "coffre", sceaux: "couronne",
    almanax: "almanax", "hotel-de-vente": "bourse", "chasse-au-tresor": "carte", "avis-de-recherche": "parchemin_or", ameliorations: "havre", parchemins: "parchemin_or", panoplies: "sac",
    defaite: "combat", "mode-manuel": "combat", "trophees-de-zone": "trophee", "etoiles-de-zone": "trophee", "boss-de-guilde": "couronne", percepteurs: "bourse", "les-obtenir": "coffre",
    "renaissance-des-metiers": "phenix", passif: "idee", semaine: "quetes", "commandes-d-artisans": "metiers", "temples-et-dopeuls": "kamas", "heures-de-donjon": "coffre", missions: "carte",
    "la-boucle-de-jeu": "logo", "consignes-d-absence": "phenix", "sorts-cles-au-fil-des-niveaux": "idee", "album-de-la-menagerie": "meuble", "collection-de-panoplies": "sac" };
  const GICON = { kolizetons: "combat", Doplons: "kamas", "Bribes de rêve": "cristal", Essence: "poussiere", Potentiel: "dofus", Sablier: "cristal", Sceau: "couronne", Champion: "couronne",
    Renaissance: "phenix", "Éveil": "phenix", stasis: "coffre", "trophée de zone": "trophee", exo: "forge", puits: "forge", archimonstre: "dofus", chromatique: "teinture", Rayonnant: "cristal",
    "trop-plein": "sac", synergie: "combat", PA: "combat", PM: "combat", PO: "combat", XP: "trophee", Initiative: "combat", "érosion": "combat" };

  /* ---------- rendu ---------- */
  const norm = (s) => (E.searchNorm ? E.searchNorm(s) : String(s || "").toLowerCase());
  const slug = (s) => norm(s).replace(/ /g, "-");
  const md = (s) => gloss(h(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"));
  const blocks = (c) => { let L; try { L = (c.b() || []).concat(EXTRA[c.id] ? EXTRA[c.id]() : []); } catch (e) { L = [["p", "Ce chapitre n'a pas pu s'afficher."]]; } if (DOF[c.id]) L.push(["dof", DOF[c.id]]); return L.filter(Boolean); };
  const txt = (b) => (!b || b[0] === "calc" || b[0] === "go" ? "" : b[0] === "more" ? b[1] + " " + txt(b[2]) : Array.isArray(b[1]) ? b[1].map((x) => (Array.isArray(x) ? x.join(" ") : x)).join(" ") : b[1]);
  const flat = (c) => blocks(c).map(txt).join(" ");
  let IDX = null;
  const index = () => IDX || (IDX = CH.map((c) => ({ c, t: norm(`${c.n} ${c.f} ${c.ou || ""} ${c.de || ""} ${c.k || ""}`), body: norm(flat(c)) })));
  function found(q) {
    const words = norm(q).split(" ").filter(Boolean); if (!words.length) return null;
    return index().filter((x) => words.every((w) => x.t.includes(w) || x.body.includes(w))).sort((a, b) => (words.every((w) => b.t.includes(w)) ? 1 : 0) - (words.every((w) => a.t.includes(w)) ? 1 : 0)).map((x) => x.c);
  }
  const navOn = (k) => k && window.DX.NAV.some((F) => F.pages.some((p) => p[0] === k));
  const isNew = (c) => c.nv && Date.now() < Date.parse(c.nv) + 7 * 86400000; // idée 3A : « nouveau » 7 jours après un changement
  function blockHtml(b) {
    const [k, v] = b;
    if (k === "p") return `<p>${md(v)}</p>`;
    if (k === "h") { const sl = slug(v); return `<h3 id="gd-${sl}">${HICON[sl] ? X().IC(HICON[sl]) + " " : ""}${md(v)}</h3>`; }
    if (k === "tip") return `<p class="gd-tip">${X().IC("idee")}<span>${md(v)}</span></p>`;
    if (k === "ul") return `<ul>${v.filter(Boolean).map((x) => `<li>${md(x)}</li>`).join("")}</ul>`;
    if (k === "ol") return `<ol>${v.filter(Boolean).map((x) => `<li>${md(x)}</li>`).join("")}</ol>`;
    if (k === "kv") return `<div class="gd-kv">${v.filter(Boolean).map(([a, c, ic]) => `<div><span>${ic ? X().IC(ic) + " " : ""}${h(a).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</span><b class="num">${h(c)}</b></div>`).join("")}</div>`;
    if (k === "calc") return calcHtml(v);
    if (k === "go") return `<div class="gd-todo">${v.map((x) => `<div class="gd-td ${x.ok ? "ok" : ""}"><span class="gd-tdi">${x.ok ? "✓" : x.ic ? X().IC(x.ic) : "•"}</span><span class="grow">${md(x.t)}</span>${x.nav ? `<button class="btn sm" data-act="nav" data-v="${h(x.nav)}">${h(x.b || "Y aller")}</button>` : x.ch ? `<button class="btn sm" data-act="gd-go" data-v="${h(x.ch)}">${h(x.b || "Lire")}</button>` : ""}</div>`).join("")}</div>`;
    if (k === "more") return `<details class="gd-more"><summary>${h(v)}</summary>${blockHtml(b[2])}</details>`;
    if (k === "dof") return `<div class="gd-dof"><b class="xs">Je connais DOFUS</b><span>${md(v)}</span></div>`;
    return "";
  }
  const ico = (c) => (c.img ? `<img class="uico" src="${h(c.img)}" alt="" loading="lazy">` : c.ic ? X().IC(c.ic) : "");
  function progHtml(c) {
    const f = PROG[c.id]; if (!f || !S()) return ""; const r = V(f, null); if (!r || (!r[0] && !r[1])) return "";
    return `<div class="gd-prog">${r[0] ? `<span><b>Où tu en es :</b> ${md(r[0])}</span>` : ""}${r[1] ? `<span><b>Prochain objectif :</b> ${md(r[1])}</span>` : ""}</div>`;
  }
  function chapter(c) {
    const go = c.page && (navOn(c.page) || c.page === "combat" || c.page === "home" || c.go) ? `<button class="btn sm primary" data-act="nav" data-v="${h(c.page)}">Ouvrir la page</button>` : "";
    const rel = (c.voir || []).map((id) => CH.find((x) => x.id === id)).filter(Boolean);
    seen = c.id === "glossaire" ? null : new Set();
    const meta = c.ou || c.de ? `<div class="gd-meta">${c.ou ? `<span><b>Où :</b> ${md(c.ou)}</span>` : ""}${c.de ? `<span><b>Débloqué :</b> ${md(c.de)}</span>` : ""}</div>` : "";
    const body = progHtml(c) + blocks(c).map(blockHtml).join("");
    seen = null;
    return `<article class="panel gd-ch" data-k="${h(c.id)}"><div class="phead"><div class="gd-ht">${ico(c)}<div><h2>${h(c.n)}${isNew(c) ? ' <span class="tag good">nouveau</span>' : ""}</h2><div class="xs muted">${h(c.f)}</div></div></div><div class="gd-act"><button class="btn sm ghost gd-star ${favs().includes(c.id) ? "on" : ""}" data-act="gd-fav" data-v="${h(c.id)}" aria-pressed="${favs().includes(c.id)}" title="Épingler ce chapitre en haut de la liste">${X().G("star")}</button><button class="btn sm ghost" data-act="gd-link" data-v="${h(c.id)}" title="Copier le lien de ce chapitre">${X().G("share")} Lien</button>${go}</div></div>
      <div class="pad gd-body">${meta}${body}
      ${rel.length ? `<div class="gd-rel"><span class="xs muted">Voir aussi</span>${rel.map((x) => `<button class="btn sm" data-act="gd-go" data-v="${h(x.id)}">${h(x.n)}</button>`).join("")}</div>` : ""}</div></article>`;
  }
  /* favoris (idée 21A) dans la sauvegarde ; taille du texte (idée 17A) sur l'appareil */
  const favs = () => { const s = S(); return s && Array.isArray(s.guideFav) ? s.guideFav : []; };
  const ZK = "idlus-guide-taille";
  let zoom = 1; try { const z = +localStorage.getItem(ZK); if (z >= 0 && z <= 3) zoom = z; } catch (e) {}
  function list(cur, L, srch) {
    const R = readOf(); const F = srch ? [] : favs().map((id) => CH.find((c) => c.id === id)).filter(Boolean);
    const item = (c) => `<button class="gd-it" data-act="gd-go" data-v="${h(c.id)}" aria-pressed="${c.id === cur}">${ico(c)}<span>${h(c.n)}</span>${isNew(c) ? '<span class="sn-newdot" title="Nouveau"></span>' : R[c.id] ? '<span class="gd-lu" title="Lu">✓</span>' : ""}</button>`;
    const fav = F.length ? `<div class="gd-fam"><span class="gd-fn">★ Favoris</span>${F.map(item).join("")}</div>` : "";
    const by = FAM.map((f) => [f, L.filter((c) => c.f === f)]).filter(([, x]) => x.length);
    const curF = (CH.find((c) => c.id === cur) || {}).f;
    /* menu déroulant (demande de Mathis, 1.2.4.x) : une famille repliée par défaut, celle du chapitre affiché ouverte ; tout ouvert pendant une recherche */
    /* plusieurs familles ouvertes à la fois (demande de Mathis) : la famille du chapitre lu s'ouvre et reste ouverte, rien ne se referme tout seul */
    if (curF && !(curF in st.fam)) { st.fam[curF] = true; famSave(); }
    return fav + by.map(([f, x]) => { const op = srch || !!st.fam[f]; const lu = x.filter((c) => R[c.id]).length;
      return `<div class="gd-fam ${op ? "open" : ""}"><button class="gd-fh" data-act="gd-fam" data-v="${h(f)}" aria-expanded="${op}"><span class="gd-fn">${h(f)}</span><span class="gd-fc">${lu ? `${lu}/` : ""}${x.length}</span><span class="gd-chev" aria-hidden="true">›</span></button>${op ? `<div class="gd-fl">${x.map(item).join("")}</div>` : ""}</div>`; }).join("");
  }
  function html() {
    const F = st.q ? found(st.q) : null;
    let cur = CH.find((c) => c.id === st.id) || CH[0];
    if (F && F.length && !F.includes(cur)) cur = F[0];
    const L = F || CH;
    return `<div class="pagehead"><h1>Guide</h1><span class="small muted"><b class="num">${readN()}</b> / ${CH.length} chapitres lus</span><span class="gd-zb" role="group" aria-label="Taille du texte"><button class="btn sm ghost" data-act="gd-z" data-v="-1" ${zoom <= 0 ? "disabled" : ""} aria-label="Texte plus petit">A−</button><button class="btn sm ghost" data-act="gd-z" data-v="1" ${zoom >= 3 ? "disabled" : ""} aria-label="Texte plus grand">A+</button></span></div>
      <div class="gd gd-z${zoom} ${F ? "srch" : ""} ${st.sum ? "sum" : ""}">
        <aside class="gd-side"><label class="gd-q">${X().G("search")}<input id="gdQ" type="search" placeholder="Chercher dans le guide" aria-label="Chercher dans le guide" autocomplete="off" value="${h(st.q)}"></label>
          ${F && !F.length ? `<p class="note">Rien ne correspond à « ${h(st.q)} ».</p>` : `${F ? "" : `<button class="btn sm gd-sumb" data-act="gd-sum" aria-expanded="${st.sum}">${st.sum ? "Fermer le sommaire" : "Sommaire par famille"}</button>`}<div class="gd-list">${list(cur.id, L, !!F)}</div>`}
          <label class="gd-sel"><span class="xs muted">Chapitre</span><select data-act="gd-sel" aria-label="Chapitre">${!F && favs().length ? `<optgroup label="★ Favoris">${favs().map((id) => CH.find((c) => c.id === id)).filter(Boolean).map((c) => `<option value="${h(c.id)}">${h(c.n)}</option>`).join("")}</optgroup>` : ""}${FAM.map((f) => { const x = L.filter((c) => c.f === f); return x.length ? `<optgroup label="${h(f)}">${x.map((c) => `<option value="${h(c.id)}" ${c.id === cur.id ? "selected" : ""}>${h(c.n)}</option>`).join("")}</optgroup>` : ""; }).join("")}</select></label></aside>
        <div class="gd-main">${F && !F.length ? "" : chapter(cur)}</div>
      </div>`;
  }
  function page(main) {
    st.id = st.id || "parcours"; markRead((CH.find((c) => c.id === st.id) || CH[0]).id); window.DX.morph(main, html());
    if (st.at) { const el = document.getElementById("gd-" + st.at); st.at = null; if (el) setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 30); }
  }
  window.DX.pages.guide = page;
  const paint = () => { const m = document.getElementById("main"); if (UI().tab === "guide" && m) page(m); };

  /* chapitre d'une page du menu (bouton « ? ») */
  const KEY = { heroes: "team", succes: "succes" };
  function forPage() {
    const ui = UI(); const t = ui.tab;
    if (t === "world") return ui.world === "dungeons" ? "dungeons" : ui.world === "enc" ? "enc" : "world";
    if (t === "quests") return ui.qt === "ach" || ui.qt === "orn" ? "succes" : ({ jour: "quests", dofus: "dofusq" })[ui.qt] || ui.qt || "quests";
    if (t === "team") return ({ spells: "spells", stats: "hstats", pet: "pet" })[ui.hero] || "team";
    if (t === "home") return "home";
    return KEY[t] || t;
  }
  /* open("donjons#la-stasis") ouvre le chapitre au bon paragraphe (idée 1A) ; open() choisit le chapitre de la page affichée */
  function open(id) {
    const ui = UI();
    if (!id && ui.tab === "guide") id = st.id || "parcours";
    if (!id) { const k = forPage(); const c = CH.find((x) => x.page === k || (x.pages || []).includes(k)); id = c ? c.id : st.id || "parcours"; }
    const [cid, at] = String(id).split("#");
    st.id = cid; st.at = at || null; st.q = ""; if (ui.tab !== "guide") { ui.prevTab = ui.tab; ui.tab = "guide"; } ui.slot = null;
    X().closeSheet(); window.scrollTo(0, 0); X().render();
  }
  /* petit bouton « ? » à poser sur un bloc d'une autre page : GUIDE.q("donjons#la-stasis") */
  const q = (target, label) => `<button class="gd-qb" data-act="gd-open" data-v="${h(target)}" title="${h(label || "Voir dans le guide")}" aria-label="${h(label || "Voir dans le guide")}">?</button>`;

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest && ev.target.closest("[data-act]"); if (!t || !S()) return; const a = t.dataset.act;
    if (a === "gd-open") { ev.preventDefault(); ev.stopPropagation(); open(t.dataset.v || null); return; }
    if (a === "gd-link") { copyLink(t.dataset.v); return; }
    if (a === "gd-fam") { const f = t.dataset.v; st.fam[f] = !st.fam[f]; famSave(); paint(); return; }
    if (a === "gd-sum") { st.sum = !st.sum; paint(); return; }
    if (a === "gd-fav") { const s = S(); const L = favs().slice(); const i = L.indexOf(t.dataset.v); if (i >= 0) L.splice(i, 1); else L.unshift(t.dataset.v); s.guideFav = L; X().markDirty(); paint(); return; }
    if (a === "gd-z") { zoom = Math.max(0, Math.min(3, zoom + (+t.dataset.v || 0))); try { localStorage.setItem(ZK, String(zoom)); } catch (e) {} paint(); return; }
    if (a === "gd-gl") { const g = GLOSS.find((x) => x[0] === t.dataset.v); if (g) X().toast(`${g[0]} : ${g[1]}`, "info"); return; }
    if (a === "gd-go") { st.id = t.dataset.v; st.sum = false; paint(); const c = document.querySelector(".gd-main"); if (c && window.matchMedia("(max-width:899px)").matches) c.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0); }
  }, true);
  document.addEventListener("change", (ev) => {
    const t = ev.target; if (!t.dataset) return;
    if (t.dataset.act === "gd-sel") { st.id = t.value; paint(); }
    if (t.dataset.act === "gd-calc") { st.calc[t.dataset.k] = t.value; paint(); }
  });
  document.addEventListener("input", (ev) => { if (ev.target.id === "gdQ") { st.q = ev.target.value; paint(); } });

  /* lien partageable (idée 12A) : https://idlus.github.io/?guide=donjons ouvre le chapitre dès que la partie est affichée */
  const linkOf = (id) => `${location.origin}${location.pathname}?guide=${encodeURIComponent(id)}`;
  function copyLink(id) {
    const u = linkOf(id); const ok = () => X().toast("Lien du chapitre copié : colle-le où tu veux.", "info");
    try { navigator.clipboard.writeText(u).then(ok, () => window.prompt("Lien du chapitre", u)); } catch (e) { window.prompt("Lien du chapitre", u); }
  }
  try {
    const m = /[?&]guide=([a-z0-9%#-]{2,80})/i.exec(location.search);
    if (m) {
      const want = decodeURIComponent(m[1]);
      const qs = location.search.replace(/([?&])guide=[^&]*&?/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + qs + location.hash);
      let calm = 0, tries = 0;
      const w = setInterval(() => {
        const nav = document.getElementById("nav"), sh = document.getElementById("sheet");
        calm = S() && nav && nav.innerHTML && !(sh && sh.innerHTML) ? calm + 1 : 0;
        if (++tries > 600) return clearInterval(w);
        if (calm < 3) return;
        clearInterval(w); if (CH.some((c) => c.id === want.split("#")[0])) open(want);
      }, 500);
    }
  } catch (e) {}

  /* bulles de découverte (idée 9A) : le chapitre qui en dit plus */
  const TIP = { combat: "combat", equip: "equipement", stats: "caracs", harvest: "metiers", protector: "metiers", keys: "donjons#la-stasis", offline: "absence", loss: "combat#defaite",
    guide: "parcours", havre: "home", almanax: "quetes", pets: "familiers", stars: "world", align: "alignement", fm: "forgemagie", mounts: "montures", archis: "archis", idols: "idoles", account: "options", ren: "maitrise", maitrise: "maitrise", navnews: "recherche" };
  const forTip = (id) => TIP[id] || null;

  if (E.SEARCH_PAGES && !E.SEARCH_PAGES.some((p) => p[0] === "guide")) E.SEARCH_PAGES.push(["guide", "Guide", "Journal › Guide : le détail de chaque fonctionnalité, avec les chiffres"]);
  window.GUIDE = { open, q, CH, forPage, forTip, tipDay, V, N, fr, pc };
})();
