/* ============================================================================
   HISTOIRE — la quête principale racontée en scènes (Classique · Saison 1 seulement). Pas de DOM ici (voir histoireui.js).
   Décisions de Mathis (maquette « Refaire les quêtes », 02/11) : 2A des scènes avec un personnage qui parle, 2 à 4 objectifs
   et une récompense ; 7A images de DOFUS (portraits ChatGPT de Mathis, sinon le monstre) ; 9B tout réécrit avant l'ouverture,
   chapitre par chapitre, validé par Mathis. 03/11 : des boosters en récompense (Mathis « Ajoute des booster aussi »).
   Règles :
   - mêmes objectifs que la quête principale de l'Éternel (E.MAIN_QUEST, 93 étapes) et MÊMES récompenses par objectif
     (E.questGive : kamas, XP, clés, coffres, meubles), pour ne pas toucher à l'équilibrage ;
   - les objectifs d'une scène avancent tous en même temps ; un objectif fini paie tout de suite (les clés arrivent à temps) ;
   - S.quest.step = nombre d'objectifs terminés : le Sablier (6), « Héros d'Amakna » (22), la course et les succès de
     chapitre gardent leurs seuils, car les scènes d'un chapitre couvrent exactement les étapes de ce chapitre ;
   - en plus : 2 boosters par scène, 3 de plus par chapitre fini (dans la réserve de 30 de js/cartes.js).
   État : S.hist = { sc: scène en cours, d: [objectifs finis de la scène], p: {objectif: compteur}, vu: dernière scène lue }.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  const Q = E.MAIN_QUEST;
  if (!Q) return;
  const { DUNGEONS, MONSTERS } = D;

  /* ---------------- personnages ---------------- */
  // img : portrait ChatGPT de Mathis (assets/s1/npc-N.webp) ; mon : monstre de DOFUS montré en attendant un portrait
  E.HIST_NPC = {
    ganymede: { n: "Ganymède", img: "assets/s1/npc-1.webp", r: "gardien d'Incarnam" },
    ataman: { n: "Ataman l'Archiviste", r: "archiviste d'Astrub" },
    gisele: { n: "Fermière Gisèle", r: "fermière d'Astrub" },
    pretresse: { n: "Prêtresse de l'Almanax", r: "servante des Mérydes" },
    bolet: { n: "Maître Bolet", r: "paysan d'Amakna" },
    heraut: { n: "Héraut des deux cités", r: "messager de Bonta et Brâkmar" },
    cawotte: { n: "Capitaine Cawotte", img: "assets/s1/npc-2.webp", r: "garde des plaines de Cania" },
    otomai: { n: "Otomaï", r: "alchimiste de l'archipel" },
    naufrage: { n: "Naufragé de Moon", r: "pirate repenti" },
    koalak: { n: "Grand Koalak", r: "ancien de la montagne" },
    abraknyde: { n: "Ancienne Abraknyde", r: "mémoire de la forêt" },
    fecaline: { n: "Fecaline la Sage", r: "sage de Frigost" },
    pandawa: { n: "Maître Pandawa", r: "sage de Pandala" },
    labyrinthe: { n: "Gardien du Labyrinthe", r: "vigie de l'île du Minotoror" },
    moine: { n: "Moine de Grobe", r: "veilleur des tombeaux" },
    nomade: { n: "Le Nomade", r: "guide de Saharach" },
    xelorium: { n: "Gardienne du Xélorium", r: "servante de Xélor" },
    mineur: { n: "Mineur de Sakaï", r: "chef de la mine" },
    obscuranti: { n: "Obscuranti déchu", r: "ancien serviteur de l'Ombre" },
    ilyzaelle: { n: "Ilyzaelle", r: "fille du Comte Harebourg" },
    amiral: { n: "Amiral de Sufokia", r: "chef de la flotte trithonne" },
    gdim: { n: "Gardien des Dimensions", r: "portier des mondes divins" },
    messager: { n: "Messager de l'Eliocalypse", r: "témoin des Cavaliers" },
    wabbit: { n: "Wabbit Repenti", img: "assets/s1/npc-3.webp", r: "ancien sujet du Wa Wabbit" },
  };

  /* ---------------- scènes ----------------
     g : index des étapes de E.MAIN_QUEST (un objectif = une étape) ; txt d'un objectif : celui de l'étape.
     in : ce que dit le personnage en ouvrant la scène ; out : sa réplique à la fin. 200 caractères au plus par réplique. */
  const SC = [
    /* ---- Chapitre 1 · L'éveil (niv. 1-50) : écrit, à valider par Mathis ---- */
    { ch: 0, t: "Le réveil", npc: "ganymede", g: [0, 1, 2],
      in: ["Ah, te voilà enfin réveillé ! Je suis Ganymède, gardien d'Incarnam. Les âmes qui arrivent ici ont tout à apprendre, et toi aussi.",
        "La Route des âmes grouille de petites bêtes. Chasse-les, prends quelques niveaux et mets-toi quelque chose sur le dos. On ne part pas à l'aventure en pyjama."],
      out: "Pas mal du tout ! Tu tiens ton arme dans le bon sens, c'est déjà mieux que la moitié des aventuriers que j'ai vus passer." },
    { ch: 0, t: "Les racines d'Incarnam", npc: "ganymede", g: [3, 4],
      in: ["Un aventurier ne vit pas que de combats. La forêt d'Incarnam regorge de bois, de plantes et de minerais.",
        "Envoie un de tes héros récolter pendant que les autres chassent. Les ressources d'aujourd'hui feront tes armes de demain."],
      out: "Tes sacs commencent à peser. Garde tout : un jour, ce Bois de Frêne deviendra un bâton ou une hache." },
    { ch: 0, t: "La Crypte de Kardorim", npc: "ganymede", g: [5],
      in: ["Une rumeur court au Cimetière : Kardorim s'est relevé dans sa crypte. Ce vieux squelette ne supporte pas qu'on trouble son repos.",
        "Trouve sa clé au Cimetière d'Incarnam, descends dans la crypte et rends-lui la paix. Ensuite, Astrub t'attend."],
      out: "Kardorim est retombé en poussière. Le temps file vite, en bas : tu peux maintenant l'accélérer avec le Sablier. Bonne route !" },
    { ch: 0, t: "Bienvenue à Astrub", npc: "ataman", g: [6, 7, 8],
      in: ["Bienvenue à Astrub, la cité des nouveaux venus ! Je suis Ataman, et j'archive tout ce qui passe ici, aventuriers compris.",
        "Chasse un peu dans la cité, fabrique ton premier objet et installe-toi dans ton Havre-Sac. Tout héros a besoin d'un chez-soi."],
      out: "Te voilà inscrit dans mes registres comme aventurier, logé et artisan. C'est un bon début de légende." },
    { ch: 0, t: "Le Tournesol Affamé", npc: "gisele", g: [9, 10],
      in: ["Au secours ! Un Tournesol Affamé s'est installé dans ma grange. Il mange tout : le blé, les poules, et presque mon mari.",
        "Il est coriace, prends d'abord quelques niveaux. La clé de la grange, tu l'as déjà : Ganymède te l'a donnée après la crypte."],
      out: "Ma grange est sauvée ! Garde son trophée, et prends cette clé : elle ouvre la cour du Bouftou Royal, à Amakna." },
    { ch: 0, t: "Prières et primes", npc: "pretresse", g: [11, 12],
      in: ["Chaque jour, un Méryde veille sur le Monde des Douze. Fais-lui une offrande à l'Almanax, il saura te le rendre.",
        "Et pour des kamas gagnés honnêtement, le tableau des avis de recherche a toujours des primes. Remplis-en trois."],
      out: "Le Méryde a l'air content, et ta bourse aussi. Voilà ce que j'appelle une journée bien remplie." },
    { ch: 0, t: "Le Bouftou Royal", npc: "bolet", g: [13, 14],
      in: ["Les champs d'Amakna sont envahis de Bouftous, et leur roi mène la danse depuis sa cour. Il faut lui couper la laine sous le pied !",
        "Ta clé ouvre sa cour. Ensuite, fais le ménage dans la forêt d'Amakna : ses bêtes n'attendent que toi."],
      out: "Le Bouftou Royal a perdu sa couronne et la forêt respire. Le roi Allister lui-même entendra parler de toi." },
    { ch: 0, t: "Bonta ou Brâkmar", npc: "heraut", g: [15, 16],
      in: ["Deux cités se disputent le monde : Bonta la lumineuse et Brâkmar la ténébreuse. Au niveau 30, il te faudra choisir ton camp.",
        "En attendant, va voir la forgemagie et brise un objet en runes. Un bon guerrier sait aussi améliorer son équipement."],
      out: "Ton choix est fait et tes premières runes brillent. Bonta comme Brâkmar ont besoin d'aventuriers comme toi." },
    { ch: 0, t: "Les Scarafeuilles", npc: "cawotte", g: [17, 18],
      in: ["Capitaine Cawotte, au rapport ! Le Scarabosse Doré et ses Scarafeuilles bloquent la route de Cania. Il faut les écraser.",
        "Ensuite, rejoins-moi dans les plaines : les Porkass piétinent tout. Mes gardes et moi, on ne suffit plus."],
      out: "Les plaines de Cania sont calmes, ou presque. Prends cette clé : le Donjon des Bworks est le prochain sur ta route." },
    { ch: 0, t: "Le Clos des Blops", npc: "cawotte", g: [19, 20, 21],
      in: ["La Bworkette commande les Bworks depuis son donjon, et plus loin, le Blop Coco Royal règne sur le Clos des Blops.",
        "Ce sont les deux plus gros dangers de Cania. Atteins le niveau 50 et va les voir. Après eux, tout Amakna saura ton nom."],
      out: "Tu l'as fait ! Incarnam, Astrub, Amakna et Cania te doivent beaucoup. À partir d'aujourd'hui, tu es un Héros d'Amakna." },
    /* ---- Chapitre 2 · Les terres sauvages (niv. 50-100) : écrit, à valider par Mathis ---- */
    { ch: 1, t: "Le Wa Wabbit", npc: "wabbit", g: [22, 23],
      in: ["Psst, par ici ! Je suis un Wabbit, mais un gentil, promis. Notre roi, le Wa Wabbit, a perdu la tête et l'île avec lui.",
        "Chasse dans les champs de Cawottes, puis monte à son château. Je ne veux pas qu'on lui fasse trop de mal… juste un peu."],
      out: "Le Wa Wabbit boude sur son trône, mais l'île respire. Tiens, cette clé t'ouvre le village des Kanniboul, sur l'île de Moon." },
    { ch: 1, t: "Les Kanniboul", npc: "naufrage", g: [24, 25, 26],
      in: ["Ohé, moussaillon ! J'ai fait naufrage sur l'île de Moon. Les masques de la forêt m'ont pris mon chapeau et ma dignité.",
        "Les Kanniboul tiennent le village et leur chef a un faible pour les pirates en sauce. Débarrasse-moi d'eux et deviens plus fort."],
      out: "Mon chapeau est revenu, ma dignité presque. Un certain Brumen cherche de l'aide dans son laboratoire : voilà sa clé." },
    { ch: 1, t: "Le laboratoire de Brumen", npc: "koalak", g: [27, 28, 29],
      in: ["La montagne gronde, étranger. Les Kaliptus dépérissent, et les landes de Sidimote sont plus désolées que jamais.",
        "On dit que tout vient du laboratoire de Brumen, où Nelween fait d'étranges expériences. Va voir, et ramène-nous la paix."],
      out: "Les expériences de Nelween sont finies. Les Kaliptus reverdissent déjà. Otomaï t'attend sur son archipel." },
    { ch: 1, t: "L'arche d'Otomaï", npc: "otomai", g: [30, 31, 32],
      in: ["Ah, l'aventurier dont tout le monde parle ! Je suis Otomaï. Mes recherches sur l'arche avancent… quand on me laisse travailler.",
        "Gourlo le Terrible a pris la cale de mon arche pour son repaire. Chasse sur le pont, puis descends lui montrer la sortie."],
      out: "Ma cale est libre et mes fioles intactes, ou presque. Prends cette clé : l'Antre de la Reine Nyée n'attend que toi." },
    { ch: 1, t: "La Reine Nyée", npc: "abraknyde", g: [33, 34],
      in: ["Les arbres de la sombre forêt ont peur, jeune pousse. La Reine Nyée y tisse ses toiles et étouffe nos racines.",
        "Traverse la forêt sans abîmer nos branches et coupe ses fils. La forêt se souviendra de toi."],
      out: "La sombre forêt chante à nouveau. Un cirque étrange s'est installé près du port de Frigost : voici la clé du chapiteau." },
    { ch: 1, t: "Le chapiteau des Riktus", npc: "fecaline", g: [35, 36],
      in: ["Bienvenue à Frigost, voyageur. Le froid est rude, mais ce qui m'inquiète, c'est ce chapiteau planté près du port.",
        "Choudini et ses Magik Riktus y font des tours qui n'amusent personne. Chasse sur le port, puis va voir le spectacle."],
      out: "Le chapiteau est replié et Choudini a disparu dans un nuage de fumée. Les Abraknydes ont un service à te demander." },
    { ch: 1, t: "L'Abraknyde Ancestral", npc: "abraknyde", g: [37],
      in: ["Le plus vieux d'entre nous, l'Abraknyde Ancestral, a perdu la raison. Il frappe tout ce qui passe dans son domaine.",
        "Ce n'est pas un ennemi, c'est un ancien malade. Va le calmer, même s'il faut lui tailler quelques branches."],
      out: "L'Ancestral dort enfin. En tombant, il a laissé une clé : celle de l'arbre de Moon, le maître de l'île des Kanniboul." },
    { ch: 1, t: "L'arbre de Moon", npc: "naufrage", g: [38, 39],
      in: ["Moon en personne ! Le maître de l'île est sorti de son arbre, et il n'est pas content qu'on ait chassé ses Kanniboul.",
        "Atteins le niveau 100 et va le voir. Après lui, plus aucune terre sauvage ne te fera peur. Moi, je reste au port."],
      out: "Moon est vaincu ! Toutes les terres sauvages connaissent ton nom. La mer t'appelle maintenant, vers les îles lointaines." },
    /* ---- Chapitre 3 · Les îles lointaines (niv. 100-150) ---- */
    { ch: 2, t: "Damadrya", npc: "pandawa", g: [40, 41],
      in: ["Bienvenue sur Pandala, voyageur. Ici, la terre, l'eau, le feu et l'air se disputent sans cesse, et Plantala en souffre.",
        "Damadrya, la gardienne de la bambusaie, ne laisse plus passer personne. Va lui parler… avec tes armes, s'il le faut."],
      out: "La bambusaie est ouverte. Un vieux gardien t'attend sur l'île du Minotoror : prends cette clé du labyrinthe." },
    { ch: 2, t: "Le labyrinthe", npc: "labyrinthe", g: [42, 43],
      in: ["Halte ! Personne n'entre dans le labyrinthe sans mon accord. Le Minotoror rôde au centre et peu en reviennent.",
        "Montre-moi ce que tu vaux sur l'île, puis entre. Si tu ressors, je t'offre à boire. Si tu ne ressors pas, je garde la clé."],
      out: "Tu es ressorti, et le Minotoror non ! Je te dois un verre. En attendant, prends cette clé : la serre du Royalmouth, à Frigost." },
    { ch: 2, t: "Le Royalmouth", npc: "fecaline", g: [44, 45, 46],
      in: ["Te revoilà à Frigost ! Les champs de glace sont envahis, et le Royalmouth a fait de sa serre une forteresse gelée.",
        "Il garde la chaleur pour lui seul pendant que la bourgade grelotte. Prends des forces et va lui rendre visite."],
      out: "La serre est ouverte et la chaleur revient. Otomaï a encore besoin de toi, près du village des Zoths." },
    { ch: 2, t: "Le Rasboul", npc: "otomai", g: [47, 48],
      in: ["Mon ami ! Les Zoths de mon archipel suivent un nouveau chef, Silf le Rasboul Majeur. Il veut mes recherches.",
        "Il se cache au fond d'un goulet. Traverse le village des Zoths et va lui expliquer que la science n'est pas à vendre."],
      out: "Le Rasboul a fui et mes carnets sont saufs. Maître Pandawa te réclame à Feudala : voici la clé de l'atelier de Tanukouï San." },
    { ch: 2, t: "Tanukouï San", npc: "pandawa", g: [49, 50, 51],
      in: ["Feudala brûle, voyageur. Tanukouï San fabrique des machines de guerre dans son atelier, et la Dame des eaux s'en inquiète.",
        "Arrête Tanukouï San, puis va voir la Dame des eaux dans sa vallée. Il faut rendre l'équilibre aux éléments de Pandala."],
      out: "Le feu et l'eau se sont calmés. Pandala te remercie, et la Dame des eaux t'a laissé une drôle de clé : celle des Mansots." },
    { ch: 2, t: "Le Mansot Royal", npc: "fecaline", g: [52, 53],
      in: ["Dans la forêt des pins perdus, les Mansots creusent jour et nuit. Leur roi cherche quelque chose sous la glace.",
        "Je n'aime pas quand on creuse si près de la prison d'Harebourg. Va voir ce que veut ce Mansot Royal."],
      out: "Le Mansot Royal ne creusera plus. Il cherchait un vieux laboratoire, celui du Tynril. Voici sa clé." },
    { ch: 2, t: "Le laboratoire du Tynril", npc: "otomai", g: [54, 55],
      in: ["Le Tynril ? Une de mes vieilles expériences ratées… Bon, plutôt réussie, vu comme il a grandi. Je n'en suis pas fier.",
        "Prends des forces, entre dans le laboratoire et règle-lui son compte. Et ne dis à personne que c'était moi."],
      out: "Le Tynril est hors d'état de nuire, et mon secret est bien gardé. Le Naufragé de Moon te cherche dans le berceau d'Alma." },
    { ch: 2, t: "Le Grolandais violent", npc: "naufrage", g: [56, 57, 58],
      in: ["Moussaillon ! Mon ancien capitaine, Ben le Ripate, s'est échoué près du berceau d'Alma avec son Grolandais violent.",
        "Il dit que mon chapeau lui appartient. Va lui montrer qui commande maintenant, et deviens assez fort pour le grand froid."],
      out: "Ben le Ripate a coulé avec son bateau. Le chapeau est à moi pour de bon ! Les îles lointaines sont à toi, cap sur le grand froid." },
    /* ---- Chapitre 4 · Le grand froid (niv. 150-190) ---- */
    { ch: 3, t: "L'Obsidiantre", npc: "fecaline", g: [59, 60],
      in: ["Les larmes d'Ouronigride gèlent tout ce qu'elles touchent, et au fond de l'hypogée, l'Obsidiantre se réveille.",
        "C'est un gardien de pierre noire, plus dur que la glace. S'il sort, Frigost tombera. Va l'arrêter avant."],
      out: "L'Obsidiantre est retombé dans son sommeil de pierre. Un moine de Grobe a besoin d'un héros comme toi." },
    { ch: 3, t: "Le Shogun Tofugawa", npc: "moine", g: [61, 62, 63],
      in: ["L'Armée de brume s'éveille dans le cimetière de Grobe, et le Shogun Tofugawa la commande depuis sa tombe.",
        "Les Yokai ne doivent pas quitter l'île. Prie avec moi, puis va lui rendre son repos éternel."],
      out: "La brume se lève sur Grobe et les tombeaux se taisent. Que les esprits te protègent dans le grand froid." },
    { ch: 3, t: "Les Givrefoux", npc: "fecaline", g: [64, 65],
      in: ["Le village enseveli n'est pas si vide qu'il en a l'air. Les Givrefoux y ont creusé leur tanière sous la neige.",
        "Leur Tengu attaque les voyageurs qui cherchent un abri. Chasse dans le village, puis va voir ce Tengu de près."],
      out: "Les Givrefoux ont fui vers les montagnes. Le Nomade te fait dire qu'il t'attend dans les sables de Saharach." },
    { ch: 3, t: "Le Père Ver", npc: "nomade", g: [66, 67],
      in: ["Du froid au sable brûlant, tu voyages vite. Les gorges de Saharach hurlent, et le sol tremble sous nos pieds.",
        "C'est le Père Ver qui creuse son boyau sous le désert. Si on le laisse faire, Saharach s'effondrera."],
      out: "Le désert ne tremble plus. Sous le sable, le Père Ver gardait une clé en forme de sablier : celle de l'Horologium de XLII." },
    { ch: 3, t: "XLII", npc: "xelorium", g: [68, 69, 70],
      in: ["Tu entres au Xélorium, là où le temps se range en tiroirs. Quelqu'un les a tous ouverts, et les heures s'échappent.",
        "XLII, le gardien de l'Horologium, a déréglé toutes les horloges. Remets de l'ordre avant que demain arrive hier."],
      out: "Les aiguilles tournent dans le bon sens. Xélor te remercie, à sa façon : tu as gagné un peu de temps. Fecaline t'appelle." },
    { ch: 3, t: "Le Korriandre", npc: "fecaline", g: [71, 72],
      in: ["La forêt pétrifiée était vivante autrefois. Le Korriandre l'a changée en pierre, arbre après arbre.",
        "C'est la dernière ombre de Frigost avant la prison d'Harebourg. Abats-la, et Frigost respirera enfin."],
      out: "La forêt reprend des couleurs. Frigost te doit beaucoup, héros. Les mineurs de Sakaï, eux, ont un problème plus bruyant." },
    { ch: 3, t: "La mine de Sakaï", npc: "mineur", g: [73, 74],
      in: ["Les Gobelins ont repris notre mine ! Leur chef, Grolloum, s'est installé au fond avec nos meilleures pioches.",
        "Traverse la plaine de Sakaï et va le déloger. Il nous faut la mine avant l'hiver, et l'hiver ici dure toute l'année."],
      out: "La mine est à nous ! Mais en creusant, les Gobelins ont réveillé quelque chose de bien plus gros dans les cavernes." },
    { ch: 3, t: "Le Kolosso", npc: "mineur", g: [75, 76],
      in: ["C'est le Kolosso. Un géant de glace grand comme une montagne. Mes mineurs refusent de redescendre, et je les comprends.",
        "Atteins le niveau 190 et va le voir. Si tu le bats, je grave ton nom à l'entrée de la mine."],
      out: "Le Kolosso est tombé et ton nom est gravé à l'entrée. Le grand froid est derrière toi. Les Dimensions divines t'attendent." },
    /* ---- Chapitre 5 · Les Dimensions divines (niv. 190-200) ---- */
    { ch: 4, t: "La Pyramide d'Ombre", npc: "obscuranti", g: [77, 78, 79],
      in: ["J'ai servi l'Ombre, autrefois. Je sais ce qu'elle veut : avaler toute la lumière du Monde des Douze.",
        "Elle grandit dans sa pyramide, au cœur de la Dimension Obscure. Atteins le niveau 200 et va l'affronter. Moi, je n'ose plus."],
      out: "L'Ombre est vaincue et la lumière revient. Je peux enfin dormir. Ilyzaelle te cherche : son père a besoin d'aide." },
    { ch: 4, t: "Le Comte Harebourg", npc: "ilyzaelle", g: [80, 81, 82],
      in: ["Mon père, le Comte Harebourg, a sombré dans la folie du temps. Il a gelé Frigost pour arrêter les saisons.",
        "Nileza, sa servante, garde la route de son donjon. Passe-la, puis va libérer mon père de lui-même. S'il te plaît."],
      out: "Mon père est vaincu, et Frigost peut enfin connaître le printemps. Merci, héros. Je ne l'oublierai jamais." },
    { ch: 4, t: "Merkator", npc: "amiral", g: [83, 84],
      in: ["Merkator a englouti la baie de Sufokia et s'est enfermé dans son Aquadôme. Ma flotte ne peut plus sortir du port.",
        "Les trithons attendent un héros capable de respirer sous l'eau. Prends une grande inspiration et plonge."],
      out: "L'Aquadôme est ouvert et la flotte peut sortir. Sufokia te salue ! Le Gardien des Dimensions veut te voir." },
    { ch: 4, t: "Le roi Nidas", npc: "gdim", g: [85, 86],
      in: ["Les mondes des dieux s'ouvrent à ceux qui ont fait leurs preuves, et tu les as faites. Voici Enutrosor.",
        "Le roi Nidas y amasse tout l'or du monde et ne rend jamais rien. Va lui faire les poches, c'est le seul langage qu'il comprend."],
      out: "Le roi Nidas a perdu son trône, et son or retourne aux Enutrofs. Écaflipus t'attend : là-bas, tout est question de chance." },
    { ch: 4, t: "Le Chalœil", npc: "gdim", g: [87, 88],
      in: ["Écaflipus est la dimension du jeu et du hasard. Le Chalœil y triche à chaque partie, et personne ne gagne jamais.",
        "Montre-lui qu'un héros n'a pas besoin de chance. Gagne sa partie, et la dernière porte s'ouvrira."],
      out: "Le Chalœil a perdu sa première partie. Il te tend une clé noire, sans un mot. C'est celle de l'Arbre de Mort." },
    { ch: 4, t: "Les Cavaliers", npc: "messager", g: [89, 90, 91],
      in: ["Les quatre Cavaliers de l'Eliocalypse chevauchent vers le Monde des Douze. J'ai vu ce qu'ils laissent derrière eux.",
        "Corruption règne sur l'Arbre de Mort et Guerre sur le Trône de Sang. Arrête-les un par un, avant qu'ils ne se rejoignent."],
      out: "Corruption et Guerre sont tombés. Mais le ciel se couvre : la Tempête de l'Eliocalypse se lève. C'est la dernière bataille." },
    { ch: 4, t: "La Tempête de l'Eliocalypse", npc: "ganymede", g: [92],
      in: ["Te voilà au bout du chemin. Tu te souviens de la Route des âmes ? Tu tenais à peine ton arme. Regarde-toi maintenant.",
        "Servitude, Misère, puis la Tempête elle-même : arrête-les et le Monde des Douze sera sauvé. Je crois en toi, depuis le début."],
      out: "Le ciel s'éclaircit sur le Monde des Douze. Tu es parti d'Incarnam, tu reviens en légende. Tu es un Héros du Krosmoz." },
  ];
  /* Chapitre pas encore écrit (n'arrive plus : les 5 sont écrits) : une scène par boss, sans dialogue. */
  const CH = E.QUEST_CHAPTERS || [{ start: 0, end: Q.length }];
  const written = new Set(SC.map((x) => x.ch));
  CH.forEach((C, k) => {
    if (written.has(k)) return;
    let g = [];
    for (let i = C.start; i < C.end; i++) {
      g.push(i);
      const q = Q[i]; const last = i === C.end - 1;
      if ((q.t === "boss" && g.length >= 2) || g.length >= 4 || last) {
        const b = g.map((j) => Q[j]).reverse().find((x) => x.t === "boss");
        SC.push({ ch: k, t: (b || q).title, npc: null, mon: b && DUNGEONS[b.dg] ? DUNGEONS[b.dg].boss : null, g, in: [], out: "" });
        g = [];
      }
    }
  });
  SC.sort((a, b) => a.ch - b.ch || Math.min(...a.g) - Math.min(...b.g));
  SC.forEach((x, n) => { x.n = n; x.last = !SC[n + 1] || SC[n + 1].ch !== x.ch; });
  E.HIST_SC = SC;
  const SCN = {}; SC.forEach((x) => x.g.forEach((i) => (SCN[i] = x.n))); // étape → scène
  E.HIST_BOOST = 2; // boosters par scène (Mathis 03/11 « un peu plus »)
  E.HIST_BOOST_CH = 3; // boosters en plus à la fin d'un chapitre

  /* ---------------- état ---------------- */
  E.histOn = (S) => !!(E.isS1c && E.isS1c(S));
  const H = (S) => { if (!S.hist) S.hist = { sc: 0, d: [], p: {}, vu: -1 }; return S.hist; };
  E.hist = H;
  E.histScene = (S) => SC[H(S).sc] || null;
  E.histDone = (S) => H(S).sc >= SC.length;
  const topLvl = (S) => Math.max(1, ...S.chars.filter((c) => !c.merc).map((c) => c.lvl || 1));
  const stepsBefore = (n) => SC.slice(0, n).reduce((a, x) => a + x.g.length, 0);
  const syncStep = (S) => { const T = H(S); S.quest = S.quest || { step: 0, prog: 0 }; S.quest.step = Math.min(Q.length, stepsBefore(T.sc) + T.d.length); };

  /* progression d'un objectif : [a, b] */
  E.histGoalProg = (S, i) => {
    const q = Q[i]; const T = H(S); const n0 = q.n || 1;
    if (SCN[i] < T.sc || (SCN[i] === T.sc && T.d.includes(i))) return [n0, n0]; // scène passée ou objectif fini
    const p = SCN[i] === T.sc ? T.p[i] || 0 : 0; // une scène à venir ne compte pas encore
    switch (q.t) {
      case "kill": case "harvest": case "craft": case "fm": case "brk": case "bounty": return [Math.min(p, q.n), q.n];
      case "almanax": return [Math.min(Math.max(p, E.almanax && E.almanax(S).done ? 1 : 0), q.n), q.n];
      case "lvl": return [Math.min(topLvl(S), q.n), q.n];
      case "equip": return [Math.min(Math.max(0, ...S.chars.map((c) => Object.keys(c.equip || {}).length)), q.n), q.n];
      case "havre": return [Math.min(E.havreTotal ? E.havreTotal(S) : 0, q.n), q.n];
      case "boss": return [S.progress && S.progress.bossKills[q.dg] ? 1 : 0, 1];
      case "align": return [S.align ? 1 : 0, 1];
    }
    return [0, 1];
  };
  E.histGoalDone = (S, i) => { const [a, b] = E.histGoalProg(S, i); return a >= b; };
  // l'objectif mis en avant (bande d'objectifs, accueil) : le premier pas encore fini de la scène
  E.histFocus = (S) => { const sc = E.histScene(S); if (!sc) return null; const T = H(S); return sc.g.find((i) => !T.d.includes(i)) ?? null; };

  /* ---------------- avancer ---------------- */
  let busy = false;
  E.histCheck = (S) => {
    if (!E.histOn(S) || busy) return; busy = true;
    try {
      const T = H(S); let guard = 0;
      while (guard++ < 12) {
        const sc = E.histScene(S); if (!sc) break;
        let moved = false;
        for (const i of sc.g) {
          if (T.d.includes(i) || !E.histGoalDone(S, i)) continue;
          T.d.push(i); delete T.p[i]; syncStep(S); // l'objectif est compté avant de payer (une montée de niveau relance la vérification)
          const r = E.questGive ? E.questGive(S, i) : { kamas: 0, ex: "" };
          E.note(S, `Objectif atteint · ${Q[i].title} (+${r.kamas.toLocaleString("fr-FR")} kamas${r.ex ? ", " + r.ex : ""})`, "rare");
          moved = true;
        }
        if (sc.g.every((i) => T.d.includes(i))) {
          T.sc++; T.d = []; T.p = {}; syncStep(S);
          const nb = E.boosterGive ? E.boosterGive(S, E.HIST_BOOST + (sc.last ? E.HIST_BOOST_CH : 0)) : 0;
          const who = sc.npc ? E.HIST_NPC[sc.npc].n : "";
          E.note(S, `Scène terminée : ${sc.t}${who && sc.out ? ` · ${who} : « ${sc.out} »` : ""}${nb ? ` (+${nb} booster${nb > 1 ? "s" : ""})` : ""}`, "rare");
          if (sc.last) {
            const C = CH[sc.ch];
            if (sc.ch === 0) E.note(S, "Chapitre 1 achevé : vous êtes un Héros d'Amakna !", "rare");
            else if (C) E.note(S, `Chapitre ${sc.ch + 1} achevé : ${C.name} !`, "rare");
            if (T.sc >= SC.length) E.note(S, "Quête principale achevée : vous êtes un Héros du Krosmoz !", "rare");
          }
          E.emit(S, "hscene", { n: sc.n, ch: sc.ch });
          moved = true;
        }
        if (!moved) break;
      }
    } finally { busy = false; }
  };
  E.histSeen = (S) => { const T = H(S); T.vu = T.sc; };
  E.histNew = (S) => E.histOn(S) && !E.histDone(S) && H(S).vu < H(S).sc;

  /* compteurs : seulement pour les objectifs de la scène en cours */
  const count = (S, t, data) => {
    const sc = E.histScene(S); if (!sc) return; const T = H(S);
    sc.g.forEach((i) => {
      if (T.d.includes(i)) return; const q = Q[i];
      if (t === "win" && q.t === "kill" && data.sub === q.sub) T.p[i] = (T.p[i] || 0) + (data.mons || []).length;
      else if (t === "harvest" && q.t === "harvest") T.p[i] = (T.p[i] || 0) + (data.n || 0);
      else if (t === q.t && ["craft", "fm", "brk", "bounty", "almanax"].includes(t)) T.p[i] = (T.p[i] || 0) + 1;
    });
  };
  const emit0 = E.emit;
  E.emit = function (S, t, d) {
    const r = emit0.apply(this, arguments);
    if (S && S.s1c && !S.mono && E.histOn(S) && t !== "hscene") try { count(S, t, d || {}); E.histCheck(S); } catch (e) {}
    return r;
  };

  /* ---------------- ce que voit le reste du jeu ---------------- */
  // bande d'objectifs, accueil, fiche du joueur : l'objectif mis en avant, avec le texte de son étape
  const step0 = E.questStep, prog0 = E.questProgress;
  E.questStep = function (S) {
    if (!E.histOn(S)) return step0.apply(this, arguments);
    const i = E.histFocus(S); return i == null ? null : Q[i];
  };
  E.questProgress = function (S) {
    if (!E.histOn(S)) return prog0.apply(this, arguments);
    const i = E.histFocus(S); return i == null ? null : E.histGoalProg(S, i);
  };
  const des0 = E.deserialize;
  E.deserialize = function () { const S = des0.apply(this, arguments); try { if (S && E.histOn(S)) { H(S); syncStep(S); } } catch (e) {} return S; };


  /* ======================= QUÊTES DE RÉGION (Saison 1, 5A : dialogues et un choix) =======================
     Mêmes étapes et mêmes récompenses que l'Éternel (js/quetes.js). En plus : le personnage parle, et à la fin on choisit
     un camp ou une façon de faire. Le choix donne l'un des deux titres (cosmétique, sans effet sur l'équilibrage), et
     chaque quête finie donne 2 boosters. in : 2 répliques ; q : la question ; a, b : [bouton, titre, réplique de fin]. */
  E.RQ_S1 = {
    incarnam: { in: ["Les âmes perdues errent sur la route d'Incarnam. Certaines ont peur, d'autres sont juste un peu perdues.", "Aide-moi à les guider. Rapporte-moi des Cendres Éternelles, elles éclairent leur chemin."],
      q: "Les âmes sont rassemblées. Qu'en fais-tu ?", a: ["Les guider vers Astrub", "le Guide des âmes", "Elles partent vers Astrub, rassurées. Tu as un don pour ça."], b: ["Les garder à Incarnam", "le Gardien d'Incarnam", "Elles restent ici, sous ta garde. Incarnam aura un nouveau protecteur."] },
    astrub: { in: ["Les archives d'Astrub ont été pillées ! Des pages entières ont disparu dans les souterrains.", "Retrouve les voleurs et ramène-moi de quoi réparer les reliures. Tout est noté, même les crimes."],
      q: "Les voleurs sont pris. Que fais-tu des pages volées ?", a: ["Tout rendre aux archives", "l'Archiviste d'Astrub", "Chaque page à sa place. Ataman en pleure de joie."], b: ["En garder une pour toi", "le Lecteur curieux", "Une page manque, mais Ataman fait semblant de ne pas voir."] },
    amakna: { in: ["Les champs du roi Allister sont envahis. Arakne, Bouftous, Scarafeuilles : tout le monde mange mon blé !", "Rapporte-moi des pattes d'Arakne, il me faut des preuves pour le roi. Et débarrasse-moi du Kwakwa."],
      q: "Les champs sont libres. Comment les protéger ?", a: ["Planter un épouvantail", "l'Épouvantail d'Amakna", "Ton épouvantail fait peur à tout le monde, même à moi."], b: ["Monter la garde la nuit", "le Veilleur des champs", "Tu veilles sous la lune. Plus une bête n'ose approcher."] },
    bontabrak: { in: ["Le Rat Blanc et le Rat Noir se disputent les égouts de Bonta et de Brâkmar. Les deux cités en ont assez.", "Fais le ménage dans les égouts et rends visite au Rat Blanc. Après, on verra qui a raison."],
      q: "Le Rat Blanc est battu. Le Rat Noir te propose un marché. Tu acceptes ?", a: ["Soutenir le Rat Blanc", "l'Allié du Rat Blanc", "Le Rat Blanc garde ses égouts, et Bonta dort tranquille."], b: ["Écouter le Rat Noir", "le Complice du Rat Noir", "Le Rat Noir sourit dans l'ombre. Brâkmar saura s'en souvenir."] },
    vulkania: { npc: "Volcanologue de Vulkania", in: ["Les volcans de Vulkania se réveillent, et les forêts d'Etraktopel brûlent à moitié.", "Rapporte-moi des Pierres de Cristal pour mes mesures, et calme les bêtes du cratère."],
      q: "Le volcan gronde encore. Que fais-tu ?", a: ["Refroidir le cratère", "le Dompteur de lave", "La lave ralentit. L'archipel peut souffler."], b: ["Laisser le volcan parler", "l'Ami du volcan", "Tu laisses la lave couler où elle veut. Le volcan t'aime bien."] },
    otomai: { in: ["Un coffret maudit s'est échoué sur l'île des naufragés. Je veux l'étudier, mais les Corailleurs le gardent.", "Rapporte-moi ces coffrets, et va voir le Corailleur Magistral dans sa grotte. Prudence, il pince."],
      q: "Tu tiens le coffret maudit. Tu l'ouvres ?", a: ["Le donner à Otomaï", "l'Assistant d'Otomaï", "Otomaï l'étudie avec des gants. Sage décision."], b: ["L'ouvrir toi-même", "le Briseur de malédictions", "Le coffret claque, une fumée verte… et rien. Tu as eu de la chance."] },
    cania: { in: ["Les Porkass piétinent tout et les Blops débordent du lac. Les plaines de Cania ont besoin de toi.", "Rapporte-moi des bouts de Blop, puis va voir le Blop Coco Royal. Et méfie-toi des Dopeuls du village."],
      q: "Les Blops sont calmés. Que fais-tu du lac ?", a: ["Le rendre aux pêcheurs", "l'Ami des pêcheurs", "Les pêcheurs reviennent sur les rives. Cania sourit."], b: ["Le garder pour les Blops", "le Berger des Blops", "Les Blops restent, mais sages. Ils t'adorent maintenant."] },
    abrak: { in: ["Les arbres vivants ont la mémoire longue, jeune pousse. Montre-leur que tu respectes la forêt.", "Rapporte-moi des racines tombées, sans en arracher une seule. Puis va voir la Reine Nyée."],
      q: "La forêt t'accepte. Elle te demande un serment.", a: ["Protéger la forêt", "le Protecteur des Abraknydes", "Les branches s'inclinent. La forêt a un nouveau gardien."], b: ["Voyager librement", "le Marcheur des bois", "La forêt te laisse passer où tu veux. C'est un honneur rare."] },
    wabbit: { in: ["Le Wa Wabbit a perdu la tête, et ses Wabbits avec lui. Moi, je me suis repenti. Aide-moi à ramener le calme.", "Rapporte-moi des dents de Wabbit, comme preuve. Puis va rendre visite au roi, deux fois s'il le faut."],
      q: "Le Wa Wabbit est à genoux. Que fais-tu de lui ?", a: ["Lui pardonner", "le Clément des Wabbits", "Le Wa Wabbit renifle et promet d'être sage. On verra."], b: ["Le chasser de l'île", "le Fléau des Wabbits", "Le Wa Wabbit part en barque. L'île sera plus calme sans lui."] },
    albuera: { in: ["Le Rakoopeur tient les futaies enneigées d'Albuera. Rejoins la rébellion, on a besoin de bras !", "Rapporte-nous de la résine pour nos torches, et va déloger le Rakoopeur de son refuge."],
      q: "Le refuge est pris. La rébellion veut un chef.", a: ["Prendre la tête", "le Chef des rebelles", "Les rebelles lèvent leurs torches pour toi. Albuera est libre."], b: ["Laisser la place", "le Rebelle discret", "Tu repars sans bruit. On parlera longtemps du héros sans nom."] },
    moon: { in: ["Des pirates ont pillé ma jungle, et les Kanniboul en profitent. Si tu me rapportes mon trésor, je saurai être généreux.", "Commence par les noix de Kokoko, mes préférées. Puis va voir les Kanniboul, ils me doivent des excuses."],
      q: "Le trésor de Moon est retrouvé. Tu le lui rends ?", a: ["Tout rendre à Moon", "l'Ami de Moon", "Moon compte ses noix une par une. Il a l'air ému."], b: ["Garder une noix", "le Pirate de Moon", "Moon fronce les sourcils… puis rit. Un vrai pirate, enfin !"] },
    pwak: { in: ["Les Chocomanciens ont volé la recette sacrée de Pwâk ! Sans elle, plus de gâteaux, plus de fête.", "Rapporte-moi de la viande pour la cuisine, et va reprendre la recette à Mawabouaino dans sa fonderie."],
      q: "La recette est retrouvée. Qu'en fais-tu ?", a: ["La rendre au chef", "le Gardien de la recette", "Le chef serre la recette contre lui. Ce soir, on mange !"], b: ["La partager à toute l'île", "le Pâtissier de Pwâk", "Tout le monde cuisine, partout. L'île sent le chocolat."] },
    koalaks: { in: ["Les Kaliptus dépérissent et le canyon gronde. La montagne compte sur toi, étranger.", "Rapporte-moi des fleurs de Kaliptus pour mes remèdes, et va voir le Koulosse dans sa caverne."],
      q: "Le Koulosse est vaincu. La montagne veut un nom pour toi.", a: ["Grimpeur", "le Grimpeur des Koalaks", "Les Koalaks t'apprennent à grimper. Tu te débrouilles bien."], b: ["Gardien des Kaliptus", "le Gardien des Kaliptus", "Les Kaliptus refleurissent sous ta garde. La montagne est fière."] },
    sidimote: { in: ["Quelque chose hurle la nuit dans les landes de Sidimote. Je veux savoir quoi, et le faire taire.", "Rapporte-moi du venin de scorbute, ça m'aide à rester éveillé. Puis suis les hurlements jusqu'à leur source."],
      q: "Les hurlements se sont tus. Tu restes veiller ?", a: ["Veiller avec lui", "le Veilleur des landes", "Vous veillez ensemble. Les landes n'ont jamais été si calmes."], b: ["Repartir sur la route", "le Voyageur de Sidimote", "Tu repars au matin. Le Veilleur te salue de loin."] },
    dragoeufs: { in: ["Les œufs du sanctuaire sont menacés. Un Dragoeuf ne pardonne jamais à qui touche à sa couvée.", "Rapporte-moi des coquilles tombées, puis passe l'épreuve de Draegnerys. Seuls les dignes approchent des œufs."],
      q: "Un œuf éclot devant toi. Le petit te regarde.", a: ["Le rendre à sa mère", "l'Ami des Dragoeufs", "La mère dragoeuf baisse la tête devant toi. Un grand honneur."], b: ["Le laisser te suivre un peu", "le Parrain de Dragoeuf", "Le petit te suit jusqu'au village, puis rentre. Il reviendra."] },
    saharach: { in: ["Le désert garde ses secrets sous le sable brûlant. Avec toi, nous irons jusqu'au cimetière des Mastodontes.", "Rapporte-moi de la graisse pour nos montures, puis va réveiller la Mantiscore… et la rendormir."],
      q: "Le cimetière est ouvert. Que fais-tu des os des Mastodontes ?", a: ["Les laisser reposer", "le Respectueux des sables", "Le désert s'apaise. Les anciens dorment en paix."], b: ["Les étudier", "l'Explorateur de Saharach", "Tu repars les poches pleines de notes. Le Nomade est intrigué."] },
    frigost: { in: ["La glace avance chaque nuit sur la bourgade. Il faut briser l'emprise d'Harebourg, pas à pas.", "Rapporte-moi de quoi tenir chaud aux habitants, puis va voir le Royalmouth dans sa serre."],
      q: "La bourgade est sauvée cette nuit. Et demain ?", a: ["Rester protéger la bourgade", "le Rempart de Frigost", "La bourgade dort tranquille. Tu es son rempart."], b: ["Marcher vers Harebourg", "le Briseur de glace", "Tu regardes le château au loin. Un jour, tu iras."] },
    asse: { in: ["Mon théâtre a besoin d'un héros pour sa prochaine pièce. Le rôle est dangereux, évidemment.", "Rapporte-moi des cornes de Rhinoféroce pour les décors, et va affronter le Maître des Pantins sur scène."],
      q: "Le public applaudit. Tu fais une révérence ?", a: ["Saluer le public", "la Vedette de Dramak", "Le public hurle ton nom. Dramak te réserve le premier rôle."], b: ["Quitter la scène en silence", "le Héros des coulisses", "Tu disparais dans les coulisses. Le mystère fait ta légende."] },
    divines: { in: ["Les mondes des dieux s'ouvrent à ceux qui ont fait leurs preuves. Les as-tu faites ?", "Rapporte-moi des cordes de Boursoin, puis va voir Malléfisk et Fraktale. Les dieux regardent."],
      q: "Les dieux te proposent une bénédiction. Laquelle ?", a: ["Celle de la force", "le Béni des dieux", "Une chaleur te traverse. Les dieux t'ont choisi."], b: ["Aucune, merci", "l'Indépendant des Douze", "Les dieux sont vexés, mais impressionnés. Rares sont ceux qui refusent."] },
    pandala: { in: ["Les quatre éléments de Pandala se querellent. Un sage doit rétablir l'équilibre, et tu es là.", "Rapporte-moi des tiges de Bambouto pour la méditation, puis va voir Damadrya et la Dame des eaux."],
      q: "L'équilibre revient. Quel élément veux-tu honorer ?", a: ["La terre et le feu", "l'Élu de Feudala", "Le feu danse pour toi à Feudala."], b: ["L'eau et l'air", "l'Élu d'Akwadala", "L'eau chante pour toi à Akwadala."] },
    minotoror: { in: ["Le Minotoror rôde au cœur du labyrinthe. Peu en reviennent : prouve que tu es de ceux-là.", "Rapporte-moi des peaux de Minos, puis entre. Deux fois, si tu veux mon respect."],
      q: "Tu ressors du labyrinthe. Tu notes le chemin ?", a: ["Dessiner la carte", "le Cartographe du labyrinthe", "Ta carte est accrochée à l'entrée. Plus personne ne se perd."], b: ["Garder le secret", "le Maître du labyrinthe", "Toi seul connais le chemin. Le gardien te respecte."] },
    grobe: { in: ["L'Armée de brume s'éveille dans les tombeaux. Les Yokai ne doivent pas quitter l'île de Grobe.", "Rapporte-moi des étoffes de samouraï fantôme pour les rites, puis va calmer le Shogun et Koumiho."],
      q: "Les esprits sont calmes. Que leur offres-tu ?", a: ["Une prière", "le Pèlerin de Grobe", "Les esprits s'inclinent et retournent dormir."], b: ["Un combat d'honneur", "le Samouraï de brume", "Un esprit te salue, sabre levé. Tu as gagné son respect."] },
    valonia: { in: ["Les galeries d'Ereboria ne sont plus sûres depuis que les Marteaux-Aigris s'y sont retranchés.", "Rapporte-moi du sel pour nos réserves, et va voir mon cousin Clochecuivre dans son bastion. Il a mauvais caractère."],
      q: "Les Marteaux-Aigris se rendent. Que fais-tu d'eux ?", a: ["Les réconcilier", "le Pacificateur de Valonia", "Les Marteaux-Aigris trinquent avec les mineurs. Enfin."], b: ["Les chasser des galeries", "le Marteau de Valonia", "Les galeries sont vides et sûres. Barbéryl t'offre une bière."] },
    obscure: { in: ["L'Ombre grandit dans sa pyramide. Il faut l'affronter avant qu'elle n'avale la lumière.", "Rapporte-moi des masques du Vide, ils protègent de son regard. Puis va la voir, deux fois s'il le faut."],
      q: "L'Ombre est vaincue. Il reste un éclat d'ombre. Tu le gardes ?", a: ["Le détruire", "le Porteur de lumière", "L'éclat se dissout dans la lumière. Tu as bien fait."], b: ["Le garder", "le Maître des ombres", "L'éclat se blottit dans ta poche. Il est sage… pour l'instant."] },
    nimotopia: { in: ["Le Comte Razof chasse tout ce qui bouge à Nimotopia. À notre tour de le chasser.", "Rapporte-moi du poivre pour brouiller les pistes, puis va le trouver dans son camp."],
      q: "Le Comte Razof est pris. Que fais-tu de ses trophées ?", a: ["Libérer les bêtes", "l'Ami des bêtes", "Les bêtes repartent dans les bois. Nimotopia respire."], b: ["Garder un trophée", "le Chasseur de chasseurs", "Tu gardes le chapeau du Comte. Il te va bien."] },
    sakai: { in: ["Les Gobelins ont repris la mine abandonnée. Il nous faut la récupérer avant l'hiver.", "Rapporte-moi des oreilles de Gobosteur comme preuve, puis va déloger Grolloum."],
      q: "La mine est à vous. Tu partages le filon ?", a: ["Avec tous les mineurs", "le Camarade de Sakaï", "Tout le monde a sa part. Les mineurs chantent ton nom."], b: ["Avec le chef seulement", "le Contremaître de Sakaï", "Le chef te nomme contremaître. Ça grogne un peu."] },
    ecailles: { in: ["Les Crocodailles ont pris Crocuzko. Torkélonia attend son champion.", "Rapporte-nous des aubergines, c'est ce qui les attire. Puis va au sanctuaire de Torkélonia."],
      q: "Torkélonia est libérée. Elle te propose de rester.", a: ["Devenir son champion", "le Champion de Torkélonia", "Torkélonia pose sa carapace près de toi. Tu es son champion."], b: ["Repartir à l'aventure", "le Voyageur des Écailles", "Elle te regarde partir, lentement, comme une tortue."] },
    possedes: { in: ["Kabahal prépare un rituel sur l'atoll. Le cauchemar de l'Aurore Pourpre ne doit pas recommencer.", "Rapporte-moi du sel pour tracer des cercles de protection, puis va briser l'Éternel Conflit et le rituel."],
      q: "Le rituel est brisé. Tu dis la vérité aux survivants ?", a: ["Tout leur raconter", "le Témoin de l'Aurore", "Les survivants pleurent, puis sourient. Ils savent enfin."], b: ["Garder le secret", "le Gardien du cauchemar", "Tu gardes le cauchemar pour toi. Ils dormiront mieux."] },
    sufokia: { in: ["Merkator a englouti la baie. Les trithons attendent un héros capable de respirer sous l'eau.", "Rapporte-moi des piles Steamer pour nos scaphandres, puis plonge vers l'Aquadôme et le vaisseau de Meno."],
      q: "La baie est libre. La flotte te propose un grade.", a: ["Accepter", "l'Amiral de la baie", "Tu reçois ta casquette d'amiral. Elle prend un peu l'eau."], b: ["Rester simple marin", "le Marin de Sufokia", "Tu gardes ton bonnet de marin. Les trithons t'adorent."] },
    cavaliers: { in: ["Les quatre Cavaliers chevauchent vers le Monde des Douze. Il faut les arrêter un à un.", "Rapporte-moi des haricots, oui, des haricots : ils détestent ça. Puis va voir Corruption et Guerre."],
      q: "Deux Cavaliers sont tombés. Tu poursuis les autres ?", a: ["Les poursuivre", "le Chasseur de Cavaliers", "Tu pars sur leurs traces. Ils te craignent déjà."], b: ["Garder la frontière", "le Rempart des Douze", "Tu tiens la frontière. Aucun Cavalier ne passera."] },
    harebourg: { in: ["Mon père, le Comte, a sombré dans la folie du temps. Avant lui, il faut passer mes propres défenses.", "Oui, les miennes : je dois savoir si tu es assez fort. Rapporte-moi de la bave de Nessil, puis viens me battre."],
      q: "Tu as battu Ilyzaelle. Elle te demande de l'aide pour son père.", a: ["Lui promettre", "le Protecteur d'Ilyzaelle", "Ilyzaelle sourit, pour la première fois depuis longtemps."], b: ["Refuser, trop dangereux", "l'Héritier du froid", "Elle hoche la tête. Elle ira seule, mais tu as gagné son estime."] },
    wukin: { in: ["L'encre et le papier se font la guerre. Un royaume entier risque de s'effacer.", "Rapporte-moi des haricots pour fabriquer de l'encre, puis va voir le roi Imagami et la reine Amirukam."],
      q: "Les deux royaumes signent la paix. Avec quelle plume ?", a: ["La plume d'encre", "le Scribe de Wukin", "Le traité brille d'encre noire. Wukin est fier de toi."], b: ["La feuille de papier", "le Plieur de Wukang", "Le traité est plié en forme de grue. Wukang applaudit."] },
  };
  const rqClaim0 = E.rqClaim;
  // Saison 1 : la fin de la quête demande un choix (a ou b) ; le titre vient du choix, le reste ne change pas, plus 2 boosters
  E.rqClaim = function (S, id, opt) {
    const X = E.RQ_S1[id];
    if (!E.histOn(S) || !X) return rqClaim0.apply(this, arguments);
    if (opt !== "a" && opt !== "b") return "Fais ton choix pour finir la quête.";
    const t0 = (S.titlesExtra || []).slice();
    const r = rqClaim0.call(this, S, id); if (r) return r;
    const base = E.regionTitle(E.REGION[id]);
    if (!t0.includes(base)) S.titlesExtra = (S.titlesExtra || []).filter((t) => t !== base); // le titre « l'Ami de … » laisse la place à celui du choix
    const T = E.rqState(S, id); T.ch = opt; const ti = X[opt][1];
    if (!S.titlesExtra.includes(ti)) S.titlesExtra.push(ti);
    const nb = E.boosterGive ? E.boosterGive(S, E.RQ_BOOST) : 0;
    E.note(S, `${E.rqNpc(S, E.REGION[id])} : « ${X[opt][2]} » (titre « ${ti} »${nb ? `, +${nb} boosters` : ""})`, "rare");
    return null;
  };
  E.RQ_BOOST = 2;
  // espaces insécables avant ? ! : ; et dans les guillemets, pour qu'un signe ne parte jamais seul à la ligne
  const nb = (t) => (typeof t === "string" ? t.replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0") : t);
  SC.forEach((x) => { x.in = x.in.map(nb); x.out = nb(x.out); });
  Object.values(E.RQ_S1).forEach((x) => { x.in = x.in.map(nb); x.q = nb(x.q); ["a", "b"].forEach((k) => { x[k] = x[k].map(nb); }); });
  E.rqNpc = (S, R) => (E.histOn(S) && E.RQ_S1[R.id] && E.RQ_S1[R.id].npc) || R.npc;

  /* ---------------- personnage d'une scène ---------------- */
  E.histWho = (sc) => {
    if (sc.npc && E.HIST_NPC[sc.npc]) return E.HIST_NPC[sc.npc];
    const m = sc.mon && MONSTERS[sc.mon]; return { n: m ? m.name : "", mon: sc.mon, r: "" };
  };
})(typeof window !== "undefined" ? window : globalThis);
