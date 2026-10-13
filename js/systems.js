/* ============================================================================
   SYSTÈMES v2.6 — Idlus
   Havre-Sac, Forgemagie, Almanax, Alignement (Bonta / Brâkmar), Quêtes,
   Avis de recherche, Succès, Ornements, cadres de carte de héros.
   Logique pure (pas de DOM), branchée sur le moteur via E.bonus / E.emit.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const { STATS, STAT_ORDER, RUNE_SIMPLE_ONLY, MONSTERS, DUNGEONS, ITEMS, RES, CLASSES } = D;
  const SUBS = E.SUBS;
  const rnd = () => E.rnd(); // même hasard que le moteur (réglable, rejouable par le serveur)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const topLvl = (S) => Math.max(...S.chars.map((c) => c.lvl));
  const note = (S, t, k) => E.note(S, t, k);
  const addRes = (S, n, q) => E.addRes(S, n, q);
  const giveTeamXp = (S, pctOfLevel) => {
    const list = E.team(S).length ? E.team(S) : S.chars;
    list.forEach((c) => E.giveXp(S, c, Math.round(E.xpNeed(c.lvl) * pctOfLevel)));
  };

  /* ---------------- Havre-Sac : améliorations permanentes payées en kamas ---------------- */
  const HAVRE = [
    { id: "xp",      name: "Bibliothèque",          icon: "📚", per: 2,  max: 50, base: 300,  g: 1.5, unit: "% d'expérience" },
    { id: "drop",    name: "Salle des trophées",    icon: "🏺", per: 2,  max: 50, base: 400,  g: 1.5, unit: "% de butin" },
    { id: "kamas",   name: "Coffre-fort",           icon: "💰", per: 3,  max: 40, base: 250,  g: 1.5, unit: "% de kamas" },
    { id: "hp",      name: "Salle d'entraînement",  icon: "🥊", per: 1,  max: 30, base: 600,  g: 1.45, unit: "% de PV en combat" },
    { id: "gather",  name: "Jardin",                icon: "🌿", per: 4,  max: 30, base: 300,  g: 1.5, unit: "% de vitesse de récolte" },
    { id: "bag",     name: "Grenier",               icon: "🎒", per: 50, max: 20, base: 500,  g: 1.5,  unit: " places dans le sac (et 10 de trop-plein)" },
    { id: "offtime", name: "Lit douillet",          icon: "🛏", per: 1,  max: 8,  base: 2000, g: 1.9,  unit: " h de progression hors ligne (8 h de base)" },
    { id: "offrate", name: "Majordome",             icon: "🎩", per: 5,  max: 7,  base: 2500, g: 1.9,  unit: " % d'efficacité hors ligne (25 % de base)" },
  ];
  E.HAVRE = HAVRE;
  E.havreLvl = (S, id) => (S.havre && S.havre[id]) || 0;
  E.havreCost = (S, id) => { const H = HAVRE.find((x) => x.id === id); return Math.round(H.base * Math.pow(H.g, E.havreLvl(S, id))); };
  E.havreTotal = (S) => Object.values(S.havre || {}).reduce((a, b) => a + b, 0);
  E.buyHavre = (S, id) => {
    const H = HAVRE.find((x) => x.id === id); if (!H) return "Amélioration inconnue.";
    const l = E.havreLvl(S, id); if (l >= H.max) return "Niveau maximum atteint.";
    const cost = E.havreCost(S, id); if (S.kamas < cost) return `Il faut ${cost.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= cost; S.havre[id] = l + 1; E.emit(S, "havre", { id }); return null;
  };

  /* ---------------- Almanax (0.1.39) : le calendrier de DOFUS ----------------
     Chaque jour a son Méryde et son type de bonus, les mêmes que dans DOFUS (tools/import_almanax.py).
     La cible (famille, zone, donjon) suit le niveau du meilleur héros. Le bonus vaut jusqu'à minuit une fois
     l'offrande faite, et compte à part du plafond commun des bonus (Mathis, 13/10). */
  const ALM_CAL = "Mazic|de la naissance|fete;Arouz|de la famine|eco;Orage|des tempêtes|chal;Thomahon|du nord|drop;Ling|du blizzard|gather:paysan;Sebklav|de la majesté|xp;Yvad|de la boue|xp;Leszak|du ménage|chal;Stun|du perfectionnisme|eco;Trôma|de la rapidité|enclos;Ashvey|des reflets|drop;Rojers|de la couleur grise|gather:mineur;Katlestyn|du rube|chal;Guigui|des frissons|gather:bucheron;Poupline|de l'odorat|drop;Bubba|de la famille|chal1;Kia|de l'araknophobie|chal;Yêcetu|de la pêche|gather:pecheur;Eskarina|de la curiosité|archi;Inkola|de la contagion|drop;Magikow|des secrets|craft2;Danizzal|des mauvaises herbes|gather:alchimiste;Kestra|de la modestie|fm;Shiva|de la mollesse|chal;Billfer|des cimetières|xp;Pierrock|de la solidité|gather:bucheron;Maribri|de la vigueur|craft2;Koppapi|des rats|chal;Krala|de la laine|chal1;Lôrf|du toucher|drop;Teskirf|de la fraîcheur|gather:alchimiste;Tolgnas|des larmes|dg;Ruevas|du goût|eco;Marke|de l'adresse|xp;Eritem|des engelures|drop;Val|des promesses|kamas;Misdup|de la simplicité|eco;Kimykay|des frontières|archi;Eramas|du frêne|gather:bucheron;Kilistin|de la férocité|dg;Meash|de la vitalité|enclos;Bazûkana|des lacs|gather:pecheur;Karlita|du crépuscule|chal;Edyxo|du cuivre|gather:mineur;Duf|du béguin|fete;Güss|du vieillissement|drop;Tehego|du manque|eco;Eidnas|des mycoses|drop;Amirniana|de l'inquiétude|xp;Karat|de la tranquillité|gather:pecheur;Atog|de l'altitude|chal;Bii|de la barbarie|drop;Ludobel|des scrupules|xp;Rumo|du réveil|chal;Vinstyl|de la claustrophobie|chal1;Kanabal|du sang-froid|dg;Krisdip|de la détermination|chal;Tiko|de l'envie|drop;Tidihef|de l'exotisme|dg;Fitsef|du divertissement|drop;Jonat|du mauvais goût|eco;Meluze|de l'imprudence|xp;Marifriss|du charme|gather:bucheron;Sylkauf|de l'hibernation|xp;Darkchy|de l'agressivité|archi;Marilez|du commerce|eco;Tella|des acrobaties|chal;Davkaz|des Wabbits|drop;Totot|de l'enthousiasme|gather:paysan;Inndo|du succès|enclos;Laetux|des marécages|chal1;Tajonoo|de l'insipidité|eco;Maëmon|de l'arrogance|dg;Todobaï|des superstitions|gather:alchimiste;Cycloune|des grossièretés|chal1;Orété|de la différence|xp;Wish|de la couleur verte|kamas;Ninefi|de la créativité|fm;Icleen|des souterrains|gather:mineur;Elosi|de la solitude|xp;Cébeyon|du déjà-vu|archi;Konala|de l'insensibilité|drop;Perviom|de la pluie|filon;Socren|de la légèreté|xp;Fala|des microbes|drop;Dees|de la gourmandise|chal;Sha|de la digestion|drop;Clynt|de la susceptibilité|xp;Ocarian|du charisme|drop;Mahadine|des queues|xp;Kimbru|de la poisse|chal;Azra|des plaisanteries|dg;Yamato|de la soif|chal1;Jébédaï|des conjurations|xp;Typlanêt|de la sécurité|eco;Tasmalin|des montagnes|gather:alchimiste;Itourp|des inversions|drop;Bensom|de l'orge|gather:paysan;Enaibi|de la lenteur|xp;Mak|du théâtre|chal;Nunu|de la force|enclos;Jay|de l'élasticité|archi;Mobbib|des revenants|drop;Gorzarel|des parfums|gather:bucheron;Bûnty|des nuages|drop;Mascha|de la productivité|craft2;Etnop|des œufs|xp;Sehb|du sucré|drop;Duc|de la sensualité|dg;Tchoub|du luxe|gather:mineur;Viti|de l'est|chal;Scheik|des objets perdus|drop;Sylfaen|du silence|drop;Katelruz|des taches|xp;Lakha|de l'écho|chal1;Rakreveï|du dégoût|drop;Fako|des paniers percés|kamas;Proff|des mauvaises fréquentations|chal;Shinkarré|de la pureté|gather:mineur;Mylka|des plumages|drop;Franek|du jardinage|gather:alchimiste;Esthoma|de la colère|craft2;Gymcitro|des moisissures|dg;Rikku|du désordre|archi;Malava|de la vue|drop;Bo|des plaines|chal1;Bipup|de la sève|gather:bucheron;Azkatraz|des mensonges|chal;Bigg|de la bêtise|xp;Bern|des ravins|drop;Loumi|de la prospection|eco;Duanaf|de l'adaptation|craft2;Zebdara|de la germination|gather:paysan;Todeb|des fausses notes|chal;Emil|de la minutie|eco;Nell|de l'esprit d'équipe|drop;Ku|de la délicatesse|filon;Khâm|de la propreté|drop;Kevlatahmu|des pollens|archi;Tyrben|du bruit|gather:mineur;Jember|de l'imitation|eco;Ntamak|de la mode|craft2;Krisegis|de l'aventure|xp;Osebo|des fleuves|gather:pecheur;Daza|des champs|filon;Alikindoy|de la générosité|drop;Taelstrom|de l'architecture|chal1;Milidès|de l'efficacité|craft2;Izmar|du goût du sang|drop;Ani|de la pitié|xp;Xandra|de la vantardise|fm;Tiny|de l'imagination|dg;Namyknof|des plages|chal1;Elgero|de la pauvreté|kamas;Mikart|de la zizanie|kamas;Martero||drop;Toun|des mystères|xp;Mendelia|des chiffres|dg;Halden|des ongles et des griffes|xp;Tigibon|du déséquilibre|archi;Verôl|des orchidées|gather:alchimiste;Jibejan|de l'initiative|enclos;Teluomaj|des collections|drop;Aazimar|de la géométrie|chal;Blou||gather:bucheron;Yaka|de la débrouille|eco;Bek|de la couleur rouge|xp;Pytch|du sud|chal1;Seyroth|des racines|chal;Redfis|de la poussière|gather:mineur;Lim|de la passion|drop;Grut|du blé|gather:paysan;Atsu|de la musique|drop;Gnat|des coquillages|chal1;Hellmut|des malformations|xp;Azrou|des cloques|drop;Oopah|des stalactites|filon;Bouliks|de la sérénité|eco;Ansôh|des ventouses|drop;Ikoan|des malédictions|archi;Poch|des dents|drop;Lamarilu|de l'obéissance|xp;Rems|des écailles|drop;Yanouchk|de la fierté|chal;Sirdal|de la modération|eco;Eiwech|du rêve|xp;Alaokit|de la fertilité|dg;Poupik|des ruisseaux|gather:pecheur;Lazura|de la couleur jaune|gather:paysan;Unkn|des nœuds|xp;Blid|de la rigueur|fm;Jihelair|de la portée|enclos;Oskerine|du magnétisme|gather:mineur;Pasquéoz|de la pilosité|chal1;Klernodie|de la tristesse|dg;Zuart|de la désobéissance|xp;Bouilli|de la salive|drop;Okajin|des fossiles|archi;Luzbel|des prairies|xp;Titi|des malfaçons|brise;Alucard|des algues|dg;Gurvamon|de la chaleur|filon;Alhera|de la convoitise|drop;Tholank|du mal de mer|xp;Kaoly|de la fidélité|xp;Xan|de la rareté|gather:bucheron;Anulideven|de l'impureté|chal;Lokhaan|de l'égarement|chal1;Benka|de l'improvisation|drop;Nobozil|de la brise|dg;Olileb|de la déshydratation|dg;Aleb|des montées d'adrénaline|dg;Krisdanh|des extinctions|xp;Jycêdus|de la bienfaisance|gather:alchimiste;Pô|de la liberté|chal;Puliblak|de la bonté|xp;Anshâ|de la lave|drop;Meda|de la patience|gather:pecheur;Jü|du bronzage|chal1;Dramon|des arcs-en-ciel|chal;Zeg|de la paresse|eco;Tix|des coups de soleil|drop;Rigamix|de la polyvalence|craft2;Matgap|du respect|drop;Sab|des traditions|drop;Ouchim|de la nostalgie|chal1;Margarou|de la jalousie|chal;Orreip|des étoiles filantes|archi;Lortecaps|de l'excitation|gather:alchimiste;Marjul|de la couleur marron|gather:mineur;Ynniw|des cornes|drop;Pilserpus|de la satisfaction|eco;Gridoo|de la nausée|drop;Theomak|de l'espoir|chal;Pierdem|du salé|gather:pecheur;Guiboun|de l'euphorie|drop;Mikala|des pustules|dg;Lolzeolf|des paysans|gather:paysan;Fizzi|de l'injustice|kamas;Talentyre|des vagues|gather:pecheur;Noon|de l'ennui|gather:bucheron;Dyw|de la rosée|dg;So|du mauvais caractère|chal;Bitkyo|de l'astuce|fm;Manoush|des contes|dg;Ancestrotek|de la fatigue|xp;Vikotoru||drop;Lorko|de la volonté|craft2;Lucimay|de l'indécision|chal;Zouzo|de l'érudition|xp;Cherop||chal1;Davut|de l'écume marine|filon;Mud||xp;Mau|de l'agilité|enclos;Xa|de l'endurance|xp;Grugin|des querelles|kamas;Yukin||gather:paysan;Farod|de l'effroi|archi;Makss|de l'illusion|chal;Latürb|des courants d'air|drop;Nosruo|des sous-bois|filon;Guidys|de la fragilité|dg;Olvido|des pirates|dg;Nido|de la gastronomie|drop;Bodirom|de l'orgueil|eco;Djuuma|de la sécheresse|chal1;Foluk|de l'ouest|drop;Emp|du recyclage|kamas;Franho|des surprises|dg;Nufrank|de la dureté|gather:mineur;Wasaru|de la calvitie|dg;Sad|du sens de l'orientation|drop;Dethoama||chal;Sulp||dg;Moomoo|de l'oubli|xp;Kosal|de la stabilité|gather:bucheron;Chik|de la complicité|xp;Jujü|des futaies|chal1;Ounirom|des marées|gather:pecheur;Ketzakwet|des découvertes|dg;Krûnsh|des cauchemars|xp;Kroketh|de la chasse|drop;Takeza|de la grâce|enclos;Benjo|de la sagesse|enclos;Emattera|du gaz|drop;Diakollec|des voyages|xp;Astirout|de la pandrista|xp;Eylen|des ombres|chal;Dnegeleht|de la relaxation|gather:paysan;Kuri|de l'insouciance|dg;Yaloop|de la prévoyance|gather:bucheron;Fry|du brouillard|chal;Zellina|des inondations|filon;Sephy|de la mémoire|dg;Baba|de l'appétit|craft2;Viviantho|de l'apprentissage|craft2;Patawaii|de l'obscurité|archi;Sili|du fer|gather:mineur;Rikoo|des fourrures|drop;Capt|de la myxomawose|xp;Coyo|de la sculpture|eco;Fredocigam|des hallucinations|gather:alchimiste;Tchokun|de l'instinct de survie|drop;Macugny|du culot|kamas;Asid|de la peur|fete;Mitomiel|de l'impudeur|dg;Nikodeus|de la métamorphose|drop;Miloune|du tissage|eco;Kacinka|de la justice|xp;Mathrû|de la vengeance|chal;Hito|des ecchymoses|gather:bucheron;Pouki|du camouflage|drop;Poup|de la folie|xp;Tilapiatsu|des naufrages|chal;Otoul|de l'intelligence|enclos;Namsporp|de la laideur|xp;Jacoula|des abysses|drop;Dek|des poisons|chal;Flouky|de la persévérance|fm;Reniator|des stratagèmes|xp;Mustasly|des ordures|xp;Messikriss|de la conservation|drop;Annbonny|de la maniaquerie|chal1;Waro|de l'écologie|eco;Julo|des mauvais présages|archi;Mûnir|des parasites|xp;Jeffarctor|du flair|drop;Vanderivz|du remerciement|dg;Fafah|de l'avoine|gather:paysan;Lateralus|des gerçures|chal1;Uicuic|de la délinquance|drop;Tinyrus|de la souplesse|gather:bucheron;Troyle|des bouffées de chaleur|xp;Eltux|de la couleur bleue|gather:mineur;Inooni|du givre|chal;Ezimuos|de la docilité|xp;Tiris|de l'ingéniosité|craft2;Edacsak|des chutes|chal1;Eltruteht|de la musculature|gather:bucheron;Ologar|des trous|xp;Adam|des punitions|kamas;Kountar|de la douceur|drop;Moko|des flocons|gather:alchimiste;Ingmar|de la couleur blanche|dg;Foya|de la maladresse|enclos;Bovjouski|des pieds|eco;Mig|de la malveillance|xp;Sêpt|de l'abondance|filon;Jason|de la rage|chal;Eboren|de l'embonpoint|drop;Lucyvan|des récompenses|chal1;Ryf|des migrations|gather:pecheur;Sebsokk|des défis|chal;Reivax|de la joie|xp;Benjak|des alliages|craft2;Grüg|de la putréfaction|chal1;Maxarès|des marins|filon;Math|des gargouillis|drop;Milivar|du mérite|drop;Simsof|du plaisir|fete;Fhenris|de l'élégance|dg;Korri|de l'insatisfaction|xp;Ediva|de l'avidité|kamas;Cocoyuyu|de la satiété|gather:paysan;Dari|du superflu|drop;Aisk|des indigestions|archi".split(";").map((x) => x.split("|"));
  const JOBN = { paysan: "Paysan", bucheron: "Bûcheron", mineur: "Mineur", alchimiste: "Alchimiste", pecheur: "Pêcheur" };
  /* v : valeur (équilibrée avec Mathis : « réduit encore ») ; t : la cible ; txt : le bonus en clair */
  const ALM_KINDS = {
    xp:     { name: "Expérience", ic: "parchemin_or", v: 30, t: "fam", txt: (v, T) => `+${v} % d'XP contre ${T ? "les " + T.name : "une famille de monstres de ton niveau"}` },
    drop:   { name: "Butin", ic: "coffre", v: 30, t: "zone", txt: (v, T) => `+${v} % de butin ${T ? "dans la zone " + T.name : "dans une zone de ton niveau"}` },
    kamas:  { name: "Fortune", ic: "kamas", v: 30, t: "fam", txt: (v, T) => `+${v} % de kamas contre ${T ? "les " + T.name : "une famille de monstres de ton niveau"}` },
    archi:  { name: "Traque", ic: "dofus", v: 100, txt: () => "Archimonstres deux fois plus fréquents" },
    dg:     { name: "Donjon du jour", ic: "cle", v: 45, t: "dg", txt: (v, T) => `+${v} % d'XP et de butin ${T ? "au donjon " + T.name : "dans un donjon de ton niveau"}` },
    chal:   { name: "Challenges augmentés", ic: "combat", v: 50, txt: (v) => `Bonus des challenges réussis en donjon +${v} %` },
    chal1:  { name: "Challenge supplémentaire", ic: "combat", v: 1, txt: () => "Un challenge de plus à chaque combat" },
    gather: { name: "Récolte abondante", ic: "pioche", v: 50, txt: (v, T, job) => `${JOBN[job] || "Un métier"} : +${v} % de ressources récoltées` },
    filon:  { name: "Filons", ic: "cristal", v: 50, txt: () => "Les filons apparaissent 1,5 fois plus souvent" },
    eco:    { name: "Économie d'ingrédients", ic: "metiers", v: 10, txt: (v) => `${v} % des ingrédients rendus à la fabrication` },
    craft2: { name: "Fabrication intensive", ic: "metiers", v: 6, txt: (v) => `${v} % de chances de fabriquer un objet en plus` },
    fm:     { name: "Forgemagie améliorée", ic: "forge", v: 10, txt: (v) => `${v} % de chances de garder la rune` },
    brise:  { name: "Concassage", ic: "forge", v: 6, txt: (v) => `${v} % de chances d'une rune en plus en brisant` },
    enclos: { name: "Efficacité des enclos", ic: "havre", v: 50, txt: () => "Naissances et XP de l'enclos ×1,5" },
    fete:   { name: "Jour de fête", ic: "bonbon", v: 30, txt: (v, T, job, day) => `+${v} % d'XP et de butin partout${/-10-31$/.test(day) ? ", et des bonbons surprises dans le butin" : ""}` },
  };
  E.ALM_KINDS = ALM_KINDS;
  const FETES = { "01-01": "Nouvel An", "02-14": "Saint-Ballotin", "10-31": "Nuit d'Halouine", "12-25": "Nowel" };
  const dayKey = (t = E.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  E.dayKey = dayKey;
  const hashStr = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); return (x >>> 0) / 4294967296; };
  /* le jour du calendrier (année bissextile : le 29 février a aussi son Méryde) */
  E.almDay = (t = E.now()) => {
    const d = new Date(t); const i = Math.round((Date.UTC(2028, d.getMonth(), d.getDate()) - Date.UTC(2028, 0, 1)) / 864e5);
    const [mer, of, k] = ALM_CAL[i] || ["Méryde", "", "xp"]; const [kind, job] = (k || "xp").split(":");
    const day = dayKey(t); const fete = FETES[day.slice(5)] || null;
    return { day, mer, of: of ? "Méryde " + of : "Méryde", kind: ALM_KINDS[kind] ? kind : "xp", job: job || null, fete };
  };
  /* cibles proches du niveau du meilleur héros, tirées au sort avec le jour (la même pour tous les joueurs de ce niveau) */
  const near = (list, lvl, lo, hi) => { const ok = list.filter(([, l]) => l >= lvl - lo && l <= lvl + hi); return ok.length ? ok : list.slice().sort((a, b) => Math.abs(a[1] - lvl) - Math.abs(b[1] - lvl)).slice(0, 3); };
  /* familles chassables : niveaux (milieu des sous-zones) où l'on rencontre au moins un de leurs monstres */
  const FAMS = Object.keys(E.RACE_MONS).filter((r) => D.RACES[r]).map((r) => { const ms = new Set(E.RACE_MONS[r]); return [r, Object.keys(SUBS).filter((k) => SUBS[k].lvl && (SUBS[k].monsters || []).some((m) => ms.has(m))).map((k) => Math.round((SUBS[k].lvl[0] + SUBS[k].lvl[1]) / 2))]; })
    .filter(([, ls]) => ls.length).map(([r, ls]) => [r, Math.min(...ls), ls]).sort((a, b) => a[1] - b[1] || String(a[0]).localeCompare(String(b[0])));
  E.almTarget = (S, kind, day, top = topLvl(S)) => {
    const K = ALM_KINDS[kind]; if (!K || !K.t) return null; const h = hashStr(kind + day);
    if (K.t === "fam") { const ok = FAMS.filter(([, , ls]) => ls.some((l) => l >= top - 12 && l <= top + 4)); const L = ok.length ? ok : near(FAMS, top, 0, 0); const r = L[Math.floor(h * L.length)][0]; return { id: r, name: D.RACES[r] }; }
    if (K.t === "zone") { const Z = Object.keys(SUBS).filter((k) => SUBS[k].lvl).map((k) => [k, Math.round((SUBS[k].lvl[0] + SUBS[k].lvl[1]) / 2)]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])); const L = near(Z, top, 10, 4); const k = L[Math.floor(h * L.length)][0]; return { id: k, name: SUBS[k].name, lvl: SUBS[k].lvl }; }
    if (K.t === "dg") { const G = Object.keys(DUNGEONS).map((k) => [k, DUNGEONS[k].lvl]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])); const L = near(G, top, 15, 3); const k = L[Math.floor(h * L.length)][0]; return { id: k, name: DUNGEONS[k].name, lvl: DUNGEONS[k].lvl }; }
    return null;
  };
  /* où aller pour profiter du bonus : la zone (ou le donjon) de la cible, la plus proche du niveau */
  E.almWhere = (S, A) => {
    const T = A.target; if (!T) return null; const top = topLvl(S); const mid = (k) => (SUBS[k].lvl[0] + SUBS[k].lvl[1]) / 2;
    if (A.kind === "dg") return { dg: T.id, name: T.name };
    if (A.kind === "drop") return { sub: T.id, name: T.name, lvl: SUBS[T.id].lvl };
    const mons = new Set(E.RACE_MONS[T.id] || []);
    const subs = Object.keys(SUBS).filter((k) => SUBS[k].lvl && (SUBS[k].monsters || []).some((m) => mons.has(m))).sort((a, b) => Math.abs(mid(a) - top) - Math.abs(mid(b) - top));
    return subs.length ? { sub: subs[0], name: SUBS[subs[0]].name, lvl: SUBS[subs[0]].lvl } : null;
  };
  /* l'offrande demandée (inchangée depuis 2.6) */
  const ALM_POOL = (() => {
    const m = new Map();
    Object.values(MONSTERS).forEach((mo) => { if (mo.boss || mo.archiOf) return; mo.drops.forEach(([r, p]) => { if (p >= 5 && !E.isKey(r)) m.set(r, Math.min(m.get(r) || 999, mo.lvl[0])); }); });
    return [...m.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  })();
  E.ALM_XP_MIN = 15; // l'offrande rapporte l'XP d'environ 15 minutes de chasse (simulation 0.1.39)
  E.almOfferXp = (lvl) => Math.round(E.monsterXp(lvl) * 50 * E.ALM_XP_MIN);
  E.almanax = (S, t = E.now()) => {
    const A = E.almDay(t); const day = A.day; const now = topLvl(S);
    /* 0.1.44.2 : l'offrande et la cible du jour sont tirées avec le niveau du premier passage de la journée,
       sinon elles changent à chaque niveau gagné (retour de joueur). Les jours suivants (aperçu) gardent le niveau actuel. */
    let top = now;
    if (S.res && day === dayKey()) { if (!S.almLvl || S.almLvl.day !== day) S.almLvl = { day, lvl: now }; top = S.almLvl.lvl; }
    const pool = ALM_POOL.filter(([, l]) => l <= Math.max(8, top + 2));
    const [res, lvl] = pool[Math.floor(hashStr("alm" + day) * pool.length)] || ALM_POOL[0];
    const qty = 4 + Math.floor(hashStr("q" + day) * 6) + Math.floor(lvl / 10);
    const done = !!(S.almanax && S.almanax.day === day);
    const target = done && S.almanax.kind === A.kind ? S.almanax.t || null : E.almTarget(S, A.kind, day, top);
    const K = ALM_KINDS[A.kind]; const v = Math.round(K.v * almFurn(S));
    const bonus = { kind: A.kind, v, name: K.name, ic: K.ic, txt: K.txt(v, target, A.job, day) };
    return Object.assign(A, { res, qty, bonus, target, done, kamas: 100 + now * 20, xp: E.almOfferXp(now) });
  };
  /* le meuble « Calendrier de l'Almanax » renforce le bonus du jour de moitié */
  const almFurn = (S) => 1 + (E.furnBonus ? E.furnBonus(S, "almanax") : 0) / 100;
  E.almanaxOffer = (S) => {
    const A = E.almanax(S); if (A.done) return "Offrande déjà faite aujourd'hui.";
    if ((S.res[A.res] || 0) < A.qty) return `Il faut ${A.qty} × ${A.res}.`;
    S.res[A.res] -= A.qty; if (!S.res[A.res]) delete S.res[A.res];
    S.almanax = { day: A.day, kind: A.kind, v: A.bonus.v, t: A.target, job: A.job };
    S.kamas += A.kamas; S.cnt.almanax = (S.cnt.almanax || 0) + 1;
    (E.team(S).length ? E.team(S) : S.chars).forEach((c) => E.giveXp(S, c, E.almOfferXp(c.lvl)));
    note(S, `Offrande à ${A.mer} acceptée : ${A.bonus.txt}, jusqu'à minuit.`, "rare");
    // série de jours consécutifs (un jour manqué fait redescendre d'un palier)
    const st = S.almStreak; const yest = dayKey(E.now() - 864e5);
    if (st.last === yest) st.n++;
    else if (!st.last) st.n = 1;
    else { const lower = E.ALM_TIERS.filter((x) => x < st.n).pop() || 0; st.n = lower + 1; }
    st.last = A.day;
    const R = E.ALM_TIERS_R[st.n] || (st.n > 30 && st.n % 90 === 0 ? { cons: "coffre_obsidienne" } : st.n > 30 && st.n % 30 === 0 ? { cons: "coffre_or" } : null);
    if (R) {
      let txt = "";
      if (R.lot) txt = resLot(S, 3, 5, 10).join(", ");
      if (R.cons) { E.addCons(S, R.cons); txt = D.CONSUMABLES[R.cons].name; }
      if (R.furn && !S.furniture.includes(R.furn)) { S.furniture.push(R.furn); txt = `meuble « ${R.furn} »`; }
      if (R.title) { if (!S.titlesExtra.includes(R.title)) S.titlesExtra.push(R.title); S.unlocks.almanax = 1; txt = `titre « ${R.title} » et ornement de l'Almanax`; }
      note(S, `Série d'Almanax : ${st.n} jours ! Récompense : ${txt}.`, "rare");
    }
    E.emit(S, "almanax", {}); return null;
  };
  E.ALM_TIERS = [3, 7, 14, 30];
  E.ALM_TIERS_R = { 3: { lot: 1 }, 7: { cons: "coffre_argent" }, 14: { furn: "Calendrier de l'Almanax" }, 30: { title: "Fidèle de l'Almanax" } };
  /* le bonus actif aujourd'hui (offrande faite), sinon null */
  const almOn = (S) => { const A = S.almanax; if (!A || A.day !== dayKey() || !ALM_KINDS[A.kind]) return null; if (A.v === undefined) return null; return A; };
  E.almOn = almOn;
  const tid = (A) => A.t && A.t.id;
  /* multiplicateurs appelés par le moteur (E.almMult, valeur neutre 1 sans offrande) */
  E.almMult = (S, what, x) => {
    const A = almOn(S); if (!A) return 1; const f = 1 + A.v / 100;
    switch (what) {
      case "xp": // x = monstre vaincu
        if (A.kind === "fete") return f;
        if (A.kind === "dg") return S.dungeon && S.dungeon.id === tid(A) ? f : 1;
        return A.kind === "xp" && x && String(MONSTERS[x.base || x.key] && MONSTERS[x.base || x.key].race) === String(tid(A)) ? f : 1;
      case "kamas": return A.kind === "kamas" && x && String(MONSTERS[x.base || x.key] && MONSTERS[x.base || x.key].race) === String(tid(A)) ? f : 1;
      case "drop":
        if (A.kind === "fete") return f;
        if (A.kind === "dg") return S.dungeon && S.dungeon.id === tid(A) ? f : 1;
        return A.kind === "drop" && !S.dungeon && S.sub === tid(A) ? f : 1;
      case "archi": return A.kind === "archi" ? f : 1;
      case "chal": return A.kind === "chal" && S.dungeon ? f : 1;
      case "chal1": return A.kind === "chal1" ? A.v : 0;
      case "gather": return A.kind === "gather" && x === A.job ? f : 1;
      case "filon": return A.kind === "filon" ? f : 1;
      case "enclos": return A.kind === "enclos" ? f : 1;
      default: return A.kind === what ? A.v / 100 : 0; // eco, craft2, fm, brise : une chance
    }
  };
  E.almChance = (S, what) => { const p = E.almMult(S, what); return p > 0 && p < 1 && rnd() < p; };
  /* une quantité multipliée, arrondie au hasard (1,5 × 3 = 4 ou 5) */
  E.almQty = (q, m) => { const v = q * m; const n = Math.floor(v); return n + (rnd() < v - n ? 1 : 0); };
  /* Nuit d'Halouine : un bonbon surprise de temps en temps dans le butin */
  E.almCandy = (S) => { const A = almOn(S); if (!A || A.kind !== "fete" || !/-10-31$/.test(A.day) || rnd() >= 0.03) return null; const ids = ["bonbon_sagesse", "bonbon_prospecteur", "bonbon_dore", "bonbon_recolteur", "bonbon_traqueur"]; const id = ids[Math.floor(rnd() * ids.length)]; E.addCons(S, id); return id; };

  /* ---------------- 0.1.38 : achats du jour ----------------
     Plus de vente au jeu : chaque jour, le jeu rachète 3 ressources de ton niveau, à bon prix (1,5 × l'ancien prix),
     dans la limite de 100 chacune. Les mêmes pour tout le monde au même niveau, renouvelées à minuit. */
  E.GBUY = { n: 3, max: 100, mult: 1.5 };
  E.gameBuys = (S, t = E.now()) => {
    const day = dayKey(t); const top = topLvl(S);
    const ok = ALM_POOL.filter(([r]) => E.resPrice(r) > 0);
    let pool = ok.filter(([, l]) => l <= Math.max(8, top + 2) && l >= top - 30);
    if (pool.length < E.GBUY.n) pool = ok.filter(([, l]) => l <= Math.max(8, top + 2));
    const got = S.gbuy && S.gbuy.d === day ? S.gbuy.got || {} : {};
    const list = [];
    for (let i = 0; list.length < E.GBUY.n && i < 40; i++) {
      const [res] = pool[Math.floor(hashStr(`gbuy${day}:${Math.floor(top / 10)}:${i}`) * pool.length)] || [];
      if (!res || list.some((x) => x.res === res)) continue;
      list.push({ res, price: Math.ceil(E.resPrice(res) * E.GBUY.mult), max: E.GBUY.max, got: got[res] || 0 });
    }
    return { day, list };
  };
  E.gameBuySell = (S, res, qty) => {
    const G = E.gameBuys(S); const o = G.list.find((x) => x.res === res);
    if (!o) return "Le jeu n'achète pas cette ressource aujourd'hui.";
    const n = Math.min(Math.floor(+qty) || 0, o.max - o.got, S.res[res] || 0);
    if (n <= 0) return o.got >= o.max ? "Quantité du jour déjà atteinte." : `Tu n'as pas de ${res}.`;
    if (!S.gbuy || S.gbuy.d !== G.day) S.gbuy = { d: G.day, got: {} };
    S.gbuy.got[res] = (S.gbuy.got[res] || 0) + n;
    S.res[res] -= n; if (!S.res[res]) delete S.res[res];
    S.kamas += n * o.price; return null;
  };
  /* ---------------- Alignement : Bonta ou Brâkmar ---------------- */
  const ALIGN = {
    bonta: { name: "Bonta", adj: "Bontarien", badge: 24049, color: "#4f8fe0", bonusName: "PV",
      orders: { coeur: { name: "Cœur Vaillant", ranks: ["Disciple de Menalt", "Écuyer", "Chevalier de l'Espoir", "Champion Merveilleux", "Héros Légendaire"] },
                esprit: { name: "Esprit Salvateur", ranks: ["Disciple de Jiva", "Apprenti Éclairé", "Adepte des Écrits", "Maître des Parchemins", "Gardien du Savoir"] },
                oeil: { name: "Œil Attentif", ranks: ["Disciple de Silvosse", "Espion Silencieux", "Chasseur de Renégats", "Assassin Suprême", "Maître des Illusions"] } } },
    brakmar: { name: "Brâkmar", adj: "Brâkmarien", badge: 24076, color: "#e0573a", bonusName: "dégâts",
      orders: { coeur: { name: "Cœur Saignant", ranks: ["Disciple de Djaul", "Surineur", "Chevalier du Désespoir", "Champion du Chaos", "Héros de l'Apocalypse"] },
                esprit: { name: "Esprit Malsain", ranks: ["Disciple d'Hécate", "Apprenti Sombre", "Adepte des Douleurs", "Maître des Sévices", "Gardien des Tortures"] },
                oeil: { name: "Œil Putride", ranks: ["Disciple de Brumaire", "Espion Sombre", "Chasseur d'Âmes", "Psychopathe", "Maître des Ombres"] } } },
  };
  const ORDER_BONUS = { coeur: { kind: "dmg", per: 1, txt: "+1 % de dégâts par rang" }, esprit: { kind: "xp", per: 3, txt: "+3 % d'expérience par rang" }, oeil: { kind: "drop", per: 3, txt: "+3 % de butin par rang" } };
  E.ALIGN = ALIGN; E.ORDER_BONUS = ORDER_BONUS;
  E.ALIGN_MIN_LVL = 30;
  E.alignNeed = (l) => 60 + 12 * l;
  E.alignLvl = (S) => (S.align ? S.align.lvl || 0 : 0);
  E.alignRankIdx = (S) => Math.min(5, Math.floor(E.alignLvl(S) / 20)); // 0 = Néophyte
  E.alignRankName = (S) => { const A = S.align; if (!A) return ""; const i = E.alignRankIdx(S); return i ? ALIGN[A.side].orders[A.order].ranks[i - 1] : "Néophyte"; };
  E.chooseAlign = (S, side, order) => {
    if (topLvl(S) < E.ALIGN_MIN_LVL) return `Niveau ${E.ALIGN_MIN_LVL} requis.`;
    if (!ALIGN[side] || !ALIGN[side].orders[order]) return "Choix invalide.";
    if (S.align && S.align.side === side) { S.align.order = order; note(S, `Vous rejoignez l'ordre ${ALIGN[side].orders[order].name}.`, "info"); return null; }
    const lost = S.align ? " (votre ancien alignement est perdu)" : "";
    S.align = { side, order, lvl: 0, xp: 0 }; S.alignQuest = null; newAlignQuest(S);
    note(S, `Vous êtes désormais ${ALIGN[side].adj}, ordre ${ALIGN[side].orders[order].name}${lost}.`, "rare");
    E.emit(S, "align", {}); return null;
  };
  E.giveAlignXp = (S, x) => {
    const A = S.align; if (!A) return; A.xp += x; const before = E.alignRankIdx(S);
    while (A.lvl < 100 && A.xp >= E.alignNeed(A.lvl)) { A.xp -= E.alignNeed(A.lvl); A.lvl++; }
    if (A.lvl >= 100) A.xp = 0;
    const after = E.alignRankIdx(S);
    if (after > before) { note(S, `Nouveau rang d'alignement : ${E.alignRankName(S)} !`, "rare"); E.emit(S, "alignrank", { rank: after }); }
  };
  const alignBonus = (S, kind) => {
    const A = S.align; if (!A) return 0; const r = E.alignRankIdx(S); let b = 0;
    if (kind === "hp" && A.side === "bonta") b += 2 * r;
    if (kind === "dmg" && A.side === "brakmar") b += 2 * r;
    const ob = ORDER_BONUS[A.order]; if (ob && ob.kind === kind) b += ob.per * r;
    return b;
  };

  /* ---------------- Bonus combinés ---------------- */
  /* Plafond commun : Havre-Sac, meubles, Almanax, alignement, bonbons et, plus tard, familiers et Dofus s'additionnent
     sans dépasser ces valeurs (relevées pour le Havre-Sac 4.0 afin que les meubles comptent toujours).
     Hors ligne : 24 h et 80 % d'efficacité au total, base comprise. */
  E.BONUS_CAP = { xp: 175, drop: 175, kamas: 200, offtime: 16, offrate: 55 };
  E.bonus = (S, kind) => Math.min(rawBonus(S, kind), E.BONUS_CAP[kind] ?? Infinity);
  const rawBonus = (S, kind) => {
    let b = 0;
    const H = HAVRE.find((x) => x.id === kind); if (H) b += E.havreLvl(S, kind) * H.per;
    b += alignBonus(S, kind) + E.furnBonus(S, kind); // 0.1.39 : l'Almanax compte à part (E.almMult)
    if (kind === "drop" || kind === "kamas" || kind === "gather") b += E.boostPct(S, kind);
    if (kind === "xp" || kind === "drop" || kind === "kamas") b += E.boostPct(S, "royal");
    if (kind === "xp" || kind === "drop") b += E.starBonus(S); // étoiles de la zone chassée (0.1.8.1)
    b += E.guildBonus(S, kind); // 0.1.21 : bonus de la guilde, sous les mêmes plafonds
    if (E.legTeamBonus && (kind === "xp" || kind === "drop" || kind === "kamas")) b += E.legTeamBonus(S, kind); // 0.1.48 : légendaires (Larme de Neru, Diadème, Plume)
    return b;
  };

  /* ---------------- Havre-Sac 4.0 : pièces, meubles, entraînement, atelier ---------------- */
  /* Les 8 améliorations ci-dessus restent telles quelles ; elles sont rangées par pièce. Un meuble n'agit
     qu'une fois placé, dans la pièce qui correspond à son effet, et les places sont limitées. */
  E.ROOMS = [
    { id: "biblio",   name: "Bibliothèque",         icon: "parchemin_or", color: "#7fb3ff", desc: "Savoir et expérience",      ups: ["xp"],
      slots: (S) => 2 + (E.havreLvl(S, "xp") >= 25 ? 1 : 0), nextSlot: (S) => (E.havreLvl(S, "xp") < 25 ? 25 : 0), up: "xp" },
    { id: "trophees", name: "Salle des trophées",   icon: "trophee",      color: "#e8c063", desc: "Butin et trophées de boss", ups: ["drop"],
      slots: (S) => 3 + (E.havreLvl(S, "drop") >= 20 ? 1 : 0) + (E.havreLvl(S, "drop") >= 40 ? 1 : 0), nextSlot: (S) => { const l = E.havreLvl(S, "drop"); return l < 20 ? 20 : l < 40 ? 40 : 0; }, up: "drop" },
    { id: "entrain",  name: "Salle d'entraînement", icon: "combat",       color: "#ff8a6b", desc: "Endurance et héros au repos", ups: ["hp"], post: "train" },
    { id: "reserve",  name: "Réserve",              icon: "coffre",       color: "#c99a2e", desc: "Kamas et place dans le sac", ups: ["kamas", "bag"], slots: () => 2 },
    { id: "jardin",   name: "Jardin",               icon: "pioche",       color: "#8fd16a", desc: "Récolte",                   ups: ["gather"], slots: () => 2 },
    { id: "chambre",  name: "Chambre",              icon: "almanax",      color: "#c7a0ff", desc: "Progression hors ligne",    ups: ["offtime", "offrate"], slots: () => 2 },
    { id: "atelier",  name: "Atelier",              icon: "forge",        color: "#9ad0c2", desc: "Fabrication automatique",   ups: [], post: "atelier" },
    { id: "enclos",   name: "Enclos",               icon: "ailes",        color: "#d9a066", desc: "Élevage des montures",       ups: [], post: "enclos", slots: () => 3 },
  ];
  E.room = (id) => E.ROOMS.find((r) => r.id === id);
  E.roomSlots = (S, id) => { const R = E.room(id); return R && R.slots ? R.slots(S) : 0; };

  /* Catalogue des meubles. kind : xp, drop, kamas (%), gather (% de vitesse), hp (% de PV), offrate (% d'efficacité
     hors ligne), offtime (heures hors ligne), bag (places), almanax (bonus du jour de l'Almanax, en % de plus). */
  const FURN = {
    "Statue de l'Ordre":       { room: "biblio",  kind: "xp",      v: 3,  src: "Comptoir de la cité" },
    "Calendrier de l'Almanax": { room: "biblio",  kind: "almanax", v: 50, src: "14 jours d'Almanax d'affilée" },
    "Étagère de grimoires":    { room: "biblio",  kind: "xp",      v: 2,  src: "Bricoleur niveau 60" },
    "Globe des Douze":         { room: "biblio",  kind: "xp",      v: 3,  src: "Succès : vaincre des monstres dans chaque sous-zone jusqu'au niveau 100" },
    "Bannière de la cité":     { room: "reserve", kind: "kamas",   v: 3,  src: "Comptoir de la cité" },
    "Tirelire Bouftou":        { room: "reserve", kind: "kamas",   v: 2,  src: "Butin rare à Astrub", zone: "astrub" },
    "Coffre en frêne":         { room: "reserve", kind: "bag",     v: 10, src: "Bricoleur niveau 30" },
    "Coffre en merisier":      { room: "reserve", kind: "bag",     v: 25, src: "Bricoleur niveau 120" },
    "Épouvantail d'Amakna":    { room: "jardin",  kind: "gather",  v: 5,  src: "Butin rare à Amakna", zone: "amakna" },
    "Arrosoir de Cania":       { room: "jardin",  kind: "gather",  v: 5,  src: "Bricoleur niveau 40" },
    "Bonsaï de Pandala":       { room: "jardin",  kind: "gather",  v: 8,  src: "Butin rare à Pandala", zone: "pandala" },
    "Ruche":                   { room: "jardin",  kind: "gather",  v: 10, src: "Succès : 10 000 ressources récoltées" },
    "Tapis de Koalak":         { room: "chambre", kind: "offrate", v: 3,  src: "Butin rare aux Koalaks", zone: "koalaks" },
    "Lit à baldaquin":         { room: "chambre", kind: "offtime", v: 1,  src: "Bricoleur niveau 80" },
    "Lanterne d'Otomaï":       { room: "chambre", kind: "offrate", v: 3,  src: "Butin rare à Otomaï", zone: "otomai" },
    /* 0.1.9 : objets d'élevage de l'enclos */
    "Mangeoire":               { room: "enclos",  kind: "mxp",     v: 1,  src: "Bricoleur niveau 50", txt: "Les montures à l'écurie gagnent 10 % de l'XP de l'équipe" },
    "Abreuvoir":               { room: "enclos",  kind: "birth",   v: 1,  src: "Bricoleur niveau 70", txt: "Naissance en 6 h au lieu de 8" },
    "Caresseur":               { room: "enclos",  kind: "kids",    v: 1,  src: "Butin rare à Cania", zone: "cania", txt: "Chaque monture peut avoir 4 petits au lieu de 3" },
    "Deuxième couple":         { room: "enclos",  kind: "pair2",   v: 1,  src: "Succès : 10 naissances à l'enclos", txt: "Deux couples à l'enclos en même temps" },
  };
  /* Trophées de boss : gagnés à la première victoire en stasis 5. Force selon le niveau du donjon :
     1 % avant 60, 2 % de 60 à 119, 3 % de 120 à 159, 4 % ensuite ; la récolte compte double. */
  const TROPHY = {
    crypte_kardorim: ["Trophée de Kardorim", "xp"], grange_tournesol: ["Trophée du Tournesol Affamé", "gather"],
    chateau_ensable: ["Trophée de Mob l'Éponge", "kamas"], cour_bouftou_royal: ["Trophée du Bouftou Royal", "hp"],
    cache_kankreblath: ["Trophée de Kankreblath", "drop"], donjon_tofus: ["Trophée du Batofu", "xp"],
    donjon_squelettes: ["Trophée du Chafer Rōnin", "hp"], donjon_scarafeuilles: ["Trophée du Scarabosse Doré", "drop"],
    donjon_bworks: ["Trophée de la Bworkette", "kamas"], nid_kwakwa: ["Trophée du Kwakwa", "xp"],
    clos_blops: ["Trophée du Blop Coco Royal", "drop"], labo_brumen: ["Trophée de Nelween", "xp"],
    pitons_craqueleur: ["Trophée du Craqueleur Légendaire", "hp"], bateau_chouque: ["Trophée du Chouque", "kamas"],
    chapiteau_riktus: ["Trophée de Choudini", "drop"], domaine_ancestral: ["Trophée de l'Abraknyde Ancestral", "gather"],
    caverne_koulosse: ["Trophée du Koulosse", "hp"], taniere_meulou: ["Trophée du Meulou", "xp"],
    arbre_moon: ["Trophée de Moon", "drop"], antre_dragon_cochon: ["Trophée du Dragon Cochon", "kamas"],
    repaire_kharnozor: ["Trophée de Kharnozor", "offrate"], biblio_corbac: ["Trophée du Maître Corbac", "xp"],
    goulet_rasboul: ["Trophée de Silf le Rasboul Majeur", "kamas"], bambusaie_damadrya: ["Trophée de Damadrya", "gather"],
    labyrinthe_minotoror: ["Trophée du Minotoror", "hp"], antre_crocabulia: ["Trophée de Crocabulia", "drop"],
    serre_royalmouth: ["Trophée du Royalmouth", "kamas"], repaire_skeunk: ["Trophée de Skeunk", "xp"],
    chateau_wa_wabbit: ["Trophée du Wa Wabbit", "drop"], terrier_wa_wabbit: ["Trophée du Wa Wobot", "kamas"],
    /* 0.1.45 « Donjons de légende » */
    ventre_baleine: ["Trophée du Protozorreur", "hp"], tour_bethel: ["Trophée de Bethel Akarna", "xp"],
    brasserie_dazak: ["Trophée de Dazak Martegel", "kamas"], vaisseau_meno: ["Trophée du Capitaine Meno", "drop"],
    temple_koutoulou: ["Trophée de la Larve de Koutoulou", "offrate"], palais_dantinea: ["Trophée de Dantinéa", "gather"],
    manoir_katrepat: ["Trophée d'Anerice la Shushess", "xp"], tour_solar: ["Trophée de Solar", "hp"],
    temple_kao: ["Trophée de la Prêtresse de Kao", "kamas"], sanctuaire_torkelonia: ["Trophée de Torkélonia", "drop"],
    arbre_mort: ["Trophée de Corruption", "xp"], fers_tyrannie: ["Trophée de Servitude", "kamas"],
    sentence_balance: ["Trophée de Misère", "drop"], trone_sang: ["Trophée de Guerre", "hp"],
    tempete_eliocalypse: ["Trophée des Cavaliers de l'Eliocalypse", "drop"], memoire_orukam: ["Trophée du Roi Imagami", "gather"],
    souvenir_imagiro: ["Trophée de la Reine Amirukam", "offrate"], rituel_kabahal: ["Trophée de Kabahal", "xp"],
    aurore_pourpre: ["Trophée de l'Éternel Conflit", "hp"], chambre_malefices: ["Trophée de Belladone", "kamas"],
    breuil_venerable: ["Trophée du Vénérable Endormi", "gather"], autel_dechireuse: ["Trophée de la Déchireuse", "drop"],
  };
  E.TROPHY_STASIS = 5;
  E.trophyPct = (lvl) => (lvl < 60 ? 1 : lvl < 120 ? 2 : lvl < 160 ? 3 : 4);
  for (const did in TROPHY) {
    const dg = DUNGEONS[did]; if (!dg) continue; const [name, kind] = TROPHY[did];
    FURN[name] = { room: "trophees", kind, v: E.trophyPct(dg.lvl) * (kind === "gather" ? 2 : 1), src: `${dg.name}, première victoire en stasis ${E.TROPHY_STASIS}`, trophy: did };
  }
  E.FURN = FURN;
  E.trophyOf = (did) => (TROPHY[did] ? TROPHY[did][0] : null);
  const FURN_TXT = { xp: "% d'XP", drop: "% de butin", kamas: "% de kamas", gather: "% de vitesse de récolte", hp: "% de PV en combat", offrate: "% d'efficacité hors ligne", offtime: " h hors ligne", bag: " places dans le sac" };
  E.furnEffect = (name) => { const F = FURN[name]; if (!F) return "Décoratif"; if (F.txt) return F.txt; return F.kind === "almanax" ? "Bonus du jour de l'Almanax ×1,5" : `+${F.v}${FURN_TXT[F.kind]}`; };
  E.giveFurn = (S, name, why) => {
    if (!name || S.furniture.includes(name)) return false;
    S.furniture.push(name); note(S, `Nouveau meuble : ${name}${why ? ` (${why})` : ""} ! À placer dans le Havre-Sac.`, "rare"); return true;
  };
  E.placed = (S, room) => ((S.placed && S.placed[room]) || []);
  E.isPlaced = (S, name) => { const F = FURN[name]; return !!F && E.placed(S, F.room).includes(name); };
  E.placeFurn = (S, name) => {
    const F = FURN[name]; if (!F || !S.furniture.includes(name)) return "Meuble inconnu.";
    if (E.isPlaced(S, name)) return null;
    const list = (S.placed[F.room] = S.placed[F.room] || []);
    if (list.length >= E.roomSlots(S, F.room)) return `${E.room(F.room).name} : plus de place. Retirez d'abord un meuble.`;
    list.push(name); return null;
  };
  E.unplaceFurn = (S, name) => { for (const r in S.placed) S.placed[r] = S.placed[r].filter((x) => x !== name); return null; };
  E.furnBonus = (S, kind) => {
    let b = 0;
    for (const r in S.placed || {}) for (const n of S.placed[r]) { const F = FURN[n]; if (F && F.kind === kind) b += F.v; }
    return b;
  };
  const checkFurn = (S, type, data) => {
    if (type === "win" && data.sub && SUBS[data.sub]) {
      const z = SUBS[data.sub].zone;
      for (const n in FURN) if (FURN[n].zone === z && !S.furniture.includes(n) && rnd() < E.FURN_DROP) E.giveFurn(S, n, "butin rare");
    }
    if (type === "harvest" && (S.cnt.harvest || 0) >= 10000) E.giveFurn(S, "Ruche", "succès");
    if (type === "win" && !S.furniture.includes("Globe des Douze") && S.progress && S.progress.wins) {
      if (Object.values(SUBS).every((s) => s.lvl[1] > 100 || (S.progress.wins[s.id] || 0) > 0)) E.giveFurn(S, "Globe des Douze", "succès");
    }
  };
  E.FURN_DROP = 1 / 1500; // par victoire dans la zone

  /* Salle d'entraînement : un héros hors de l'équipe gagne 25 % de l'XP moyenne de l'équipe, sans combattre. */
  E.TRAIN_SHARE = 0.25;
  /* Malus d'écart : jusqu'à 10 niveaux sous la moyenne de l'équipe, rien ne change ; au-delà, -5 % de gain par niveau,
     sans descendre sous 20 % du gain normal (soit 5 % de l'XP de l'équipe). */
  E.TRAIN_FREE_GAP = 10;
  E.trainGap = (S, c) => { const T = E.team(S); return T.length ? Math.round(T.reduce((s, x) => s + x.lvl, 0) / T.length) - c.lvl : 0; };
  E.trainMult = (S, c) => { const g = E.trainGap(S, c) - E.TRAIN_FREE_GAP; return g > 0 ? Math.max(0.2, 1 - g * 0.05) : 1; };
  E.trainShare = (S, c) => E.TRAIN_SHARE * E.trainMult(S, c);
  E.trainee = (S) => {
    const c = S.training != null ? S.chars.find((x) => x.id === S.training) : null;
    if (!c || c.inTeam || c.job || E.atelierHero(S) === c) { S.training = null; return null; }
    return c;
  };
  E.setTraining = (S, cid) => {
    if (cid == null) { S.training = null; return null; }
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (c.inTeam) return "Ce héros est dans l'équipe : retirez-le d'abord de l'équipe.";
    if (c.job) return "Ce héros récolte : rappelez-le d'abord.";
    if (E.atelierHero(S) === c) return "Ce héros travaille à l'atelier.";
    S.training = cid; note(S, `${c.name} s'entraîne au Havre-Sac.`, "info"); return null;
  };

  /* Atelier : se construit une fois ; un héros affecté y fabrique une recette toutes les 20 min, même hors ligne. */
  E.ATELIER_COST = 50000; E.ATELIER_PERIOD_S = 1200;
  E.buildAtelier = (S) => {
    if (S.atelier.built) return "L'atelier est déjà construit.";
    if (S.kamas < E.ATELIER_COST) return `Il faut ${E.ATELIER_COST.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= E.ATELIER_COST; S.atelier.built = true; note(S, "L'atelier est construit !", "up"); return null;
  };
  E.atelierHero = (S) => (S.atelier && S.atelier.cid != null ? S.chars.find((x) => x.id === S.atelier.cid) || null : null);
  E.atelierRecipe = (rec) => {
    if (!rec) return null;
    if (rec.k === "tpl") { const T = ITEMS[rec.id]; return T && T.craft ? { name: T.name, job: T.craft.job, lvl: E.craftReq(rec.id), ing: T.craft.ing } : null; }
    const R = D.SPECIAL_CRAFTS[rec.id]; return R ? { name: rec.id, job: R.job, lvl: R.lvl, ing: R.ing } : null;
  };
  E.setAtelier = (S, cid, rec) => {
    const A = S.atelier; if (!A.built) return "Construisez d'abord l'atelier.";
    if (cid == null) { const c = E.atelierHero(S); A.cid = null; A.prog = 0; A.stall = null; if (c) note(S, `${c.name} quitte l'atelier.`, "info"); return null; }
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    const R = E.atelierRecipe(rec); if (!R) return "Choisissez une recette.";
    if (S.crafts[R.job].lvl < R.lvl) return `${D.CRAFT_JOBS[R.job].name} niveau ${R.lvl} requis.`;
    if (A.cid !== cid) {
      if (S.dungeon && c.inTeam && !c.job) return "Impossible pendant un donjon.";
      if (c.inTeam && !c.job && E.team(S).length <= 1) return "Il faut au moins un personnage dans l'équipe.";
      if (c.inTeam) { c.inTeam = false; S.fight = S.dungeon ? S.fight : null; }
      c.job = null; if (S.training === cid) S.training = null;
      A.prog = 0;
    }
    A.cid = cid; A.rec = { k: rec.k, id: rec.id }; A.stall = null;
    note(S, `${c.name} fabrique à l'atelier : ${R.name}.`, "info"); return null;
  };
  E.atelierTick = (S, sec, opts = {}) => {
    const A = S.atelier; if (!A || !A.built || A.cid == null) return 0;
    const c = E.atelierHero(S); if (!c || c.inTeam || c.job) { A.cid = null; A.prog = 0; return 0; }
    A.prog = (A.prog || 0) + sec; let n = 0;
    while (A.prog >= E.ATELIER_PERIOD_S && n < 500) {
      const r = A.rec && A.rec.k === "tpl" ? E.craftItem(S, A.rec.id) : A.rec ? E.craftSpecial(S, A.rec.id) : "Aucune recette.";
      if (typeof r === "string") { if (A.stall !== r && !opts.quiet) note(S, `Atelier en pause : ${r}`, "info"); A.stall = r; A.prog = E.ATELIER_PERIOD_S; break; }
      A.stall = null; A.prog -= E.ATELIER_PERIOD_S; A.made = (A.made || 0) + 1; n++;
    }
    return n;
  };

  /* Meubles fabriqués par le Bricoleur */
  const FURN_CRAFTS = {
    "Coffre en frêne":      { lvl: 30,  ing: [["Bois de Frêne", 40], ["Bois de Châtaignier", 15], ["Fer", 20]] },
    "Arrosoir de Cania":    { lvl: 40,  ing: [["Cuivre", 30], ["Bronze", 20], ["Bois de Noyer", 15]] },
    "Étagère de grimoires": { lvl: 60,  ing: [["Bois de Chêne", 40], ["Kobalte", 20], ["Houblon", 20]] },
    "Lit à baldaquin":      { lvl: 80,  ing: [["Bois d'Érable", 40], ["Lin", 30], ["Manganèse", 15]] },
    "Coffre en merisier":   { lvl: 120, ing: [["Bois de Merisier", 50], ["Argent", 25], ["Malt", 20]] },
    "Mangeoire":            { lvl: 50,  ing: [["Bois de Chêne", 30], ["Oueille", 20], ["Fer", 15]] },
    "Abreuvoir":            { lvl: 70,  ing: [["Bois d'Érable", 30], ["Pierre de Granit", 20], ["Bronze", 15]] },
  };
  for (const n in FURN_CRAFTS) D.SPECIAL_CRAFTS[n] = Object.assign({ job: "bricoleur", furn: true, unique: true }, FURN_CRAFTS[n]);
  /* 0.1.9 : filet de capture des montures, fabriqué par le Bricoleur (ou acheté 2 000 kamas) */
  D.SPECIAL_CRAFTS["Filet de capture"] = { job: "bricoleur", lvl: 40, cons: "filet", ing: [["Oueille", 8], ["Bois de Frêne", 10], ["Fer", 5]] };

  /* ---------------- Consommables spéciaux (utilitaires et coffres) ---------------- */
  const resLot = (S, n, qmin, qmax, acc) => {
    const top = topLvl(S); const pool = ALM_POOL.filter(([, l]) => l <= top + 3 && l >= top - 25); const P = pool.length ? pool : ALM_POOL.slice(0, 10);
    const got = [];
    for (let i = 0; i < n; i++) { const [r] = P[Math.floor(rnd() * P.length)]; const q = qmin + Math.floor(rnd() * (qmax - qmin + 1)); S.res[r] = (S.res[r] || 0) + q; got.push(`${q} × ${r}`); if (acc) acc.push(["res", r, q]); }
    return got;
  };
  E.resLot = resLot;
  /* 0.1.30 « Coffres » : cinq coffres du sac, du bois aux Douze. Kamas = minutes de chasse au niveau du meilleur héros
     (environ 50 kamas par minute et par niveau d'après la simulation de chasse, bon équipement). */
  E.CHEST_TIERS = [
    { k: 250,  dust: 5,   lots: 2, q: [3, 6],   cons: 0, rare: 0, eclats: 0, items: 0 },
    { k: 750,  dust: 12,  lots: 3, q: [5, 10],  cons: 1, rare: 0, eclats: 0, items: 0 },
    { k: 1500, dust: 25,  lots: 4, q: [8, 14],  cons: 0, rare: 1, eclats: 2, items: 0, scroll: ["p", 0.05] },
    { k: 3000, dust: 50,  lots: 5, q: [12, 20], cons: 0, rare: 2, eclats: 4, items: 1, scroll: ["g", 0.10] },
    { k: 6000, dust: 100, lots: 6, q: [20, 30], cons: 0, rare: 3, eclats: 8, items: 2, scroll: ["g", 1] },
  ];
  E.CHEST_COMMON = ["bonbon_sagesse", "bonbon_prospecteur", "bonbon_dore", "bonbon_recolteur", "parchemin_avis"];
  E.CHEST_RARE = ["bonbon_royal", "fiole_resu", "cristal_fm", "bonbon_traqueur"];
  /* objets de ton niveau : un équipement de niveau proche (pas de Dofus) */
  E.chestItemPool = (lvl) => Object.keys(ITEMS).filter((t) => { const T = ITEMS[t]; return T.slot && T.slot !== "dofus" && !T.hidden && T.lvl <= lvl + 5 && T.lvl >= Math.max(1, lvl - 15); });
  E.openChest = (S, id) => {
    const C = D.CONSUMABLES[id]; const T = E.CHEST_TIERS[C.tier]; const top = topLvl(S); const got = []; const loot = []; // loot : [type, id, quantité] pour la fenêtre d'ouverture
    const k = T.k * top; S.kamas += k; got.push(`${k.toLocaleString("fr-FR")} kamas`);
    addRes(S, E.POUSSIERE, T.dust); got.push(`${T.dust} ${E.POUSSIERE}`); loot.push(["res", E.POUSSIERE, T.dust]);
    got.push(...resLot(S, T.lots, T.q[0], T.q[1], loot));
    const give = (pool, n) => { for (let i = 0; i < n; i++) { const g = pool[Math.floor(rnd() * pool.length)]; E.addCons(S, g); got.push(D.CONSUMABLES[g].name); loot.push(["cons", g, 1]); } };
    give(E.CHEST_COMMON, T.cons); give(E.CHEST_RARE, T.rare);
    if (T.eclats) { addRes(S, E.RARE_COMPONENT, T.eclats); got.push(`${T.eclats} × ${E.RARE_COMPONENT}`); loot.push(["res", E.RARE_COMPONENT, T.eclats]); }
    if (T.items) { const pool = E.chestItemPool(top); for (let i = 0; i < T.items && pool.length; i++) { const t = pool[Math.floor(rnd() * pool.length)]; const it = E.rollItem(S, t, {}); got.push(ITEMS[t].name); loot.push(["item", t, 1, it && it.uid]); } }
    if (T.scroll && rnd() < T.scroll[1]) { const st = ["fo", "ine", "cha", "age", "vit", "sa"][Math.floor(rnd() * 6)]; const sid = "parch_" + st + "_" + T.scroll[0]; E.addCons(S, sid); got.push(D.CONSUMABLES[sid].name); loot.push(["cons", sid, 1]); }
    S.cnt.chests = (S.cnt.chests || 0) + 1;
    // message court : la fenêtre d'ouverture montre le détail ; sans fenêtre, les récompenses rares regroupées (×2, ×3)
    const nRes = loot.filter((x) => x[0] === "res").length; const cnt = new Map();
    loot.filter((x) => x[0] !== "res").forEach((x) => { const n = x[0] === "item" ? ITEMS[x[1]].name : D.CONSUMABLES[x[1]].name; cnt.set(n, (cnt.get(n) || 0) + 1); });
    const best = [...cnt].map(([n, q]) => (q > 1 ? `${n} ×${q}` : n));
    note(S, S.settings && S.settings.cele === false
      ? `${C.name} : +${k.toLocaleString("fr-FR")} kamas${best.length ? " · " + best.join(" · ") : ""} · ${nRes} ressources.`
      : `${C.name} ouvert : +${k.toLocaleString("fr-FR")} kamas${best.length ? ` et ${best.length} récompense${best.length > 1 ? "s" : ""} rare${best.length > 1 ? "s" : ""}` : ""}.`, "rare");
    E.celebrate({ t: "chest", id, got, kamas: k, loot });
    return got;
  };
  E.useSpecial = (S, id, arg) => {
    const C = D.CONSUMABLES[id];
    const take = () => { S.cons[id]--; if (!S.cons[id]) delete S.cons[id]; };
    if (C.auto) return "Cet objet s'utilise automatiquement au bon moment.";
    if (C.kind === "scroll") {
      const c = S.chars.find((x) => x.id === arg); if (!c) return "Choisissez un héros.";
      const room = E.scrollRoom(c, C.stat); if (room <= 0) return `${c.name} a déjà +${E.SCROLL_MAX} ${D.STATS[C.stat].name} grâce aux parchemins.`;
      take(); c.scrolls = c.scrolls || {}; c.scrolls[C.stat] = (c.scrolls[C.stat] || 0) + Math.min(C.v, room);
      E.emit(S, "scroll", { cid: c.id, stat: C.stat });
      return null;
    }
    if (id === "potion_savoir") {
      const J = S.jobs[arg]; if (!J) return "Choisissez un métier.";
      take(); J.xp += Math.max(E.jobXpNeed(J.lvl), 0);
      while (J.lvl < 200 && J.xp >= E.jobXpNeed(J.lvl)) { J.xp -= E.jobXpNeed(J.lvl); J.lvl++; }
      note(S, `Potion de Savoir : ${D.GATHER_JOBS[arg].name} niveau ${J.lvl}.`, "up"); return null;
    }
    if (id === "cristal_fm") { if (S.fmShield) return "Un Cristal est déjà actif."; take(); S.fmShield = true; note(S, "Cristal de Forgemagie actif : la prochaine forgemagie ne peut rien faire baisser.", "info"); return null; }
    if (C.kind === "chest") { take(); E.openChest(S, id); return null; }
    return "Inutilisable.";
  };

  /* ---------------- Comptoirs : Bureau des primes (jetons) et Comptoir de la cité (insignes) ---------------- */
  const SHOPS = {
    prime: { name: "Bureau des primes", cur: "jetons", curName: "Jetons de chasseur", icon: "🎟", items: [
      { id: "b1", cons: "bonbon_sagesse", cost: 4 }, { id: "b2", cons: "bonbon_prospecteur", cost: 4 }, { id: "b3", cons: "bonbon_dore", cost: 4 }, { id: "b4", cons: "bonbon_recolteur", cost: 4 },
      { id: "b5", cons: "parchemin_avis", cost: 2 }, { id: "b6", cons: "bonbon_traqueur", cost: 6 }, { id: "b7", cons: "fiole_resu", cost: 8 },
      { id: "t1", title: "Traqueur de primes", cost: 20 }, { id: "o1", orn: "avis", name: "Ornement « Avis de recherche »", cost: 30 }, { id: "t2", title: "Fléau des hors-la-loi", cost: 60 } ] },
    cite: { name: "Comptoir de la cité", cur: "insignes", curName: "Insignes de cité", icon: "🎖", items: [
      { id: "w1", wing: "or", name: "Ailes dorées", cost: 20 }, { id: "w2", wing: "argent", name: "Ailes argentées", cost: 20 }, { id: "w3", wing: "sombre", name: "Ailes sombres", cost: 30 },
      { id: "c1", cons: "bonbon_royal", cost: 12 }, { id: "f1", furn: "Bannière de la cité", cost: 15 }, { id: "f2", furn: "Statue de l'Ordre", cost: 40 },
      { id: "t3", titleSide: true, cost: 25 } ] },
  };
  E.SHOPS = SHOPS;
  E.shopItemName = (S, it) => it.res ? `${(it.n || 1) > 1 ? it.n + " × " : ""}${it.res}` : it.cons ? D.CONSUMABLES[it.cons].name : it.title ? `Titre « ${it.title} »` : it.titleSide ? `Titre « Champion de ${S.align ? ALIGN[S.align.side].name : "la cité"} »` : it.furn ? `Meuble : ${it.furn}` : it.name;
  E.shopOwned = (S, it) => (it.title && S.titlesExtra.includes(it.title)) || (it.titleSide && S.align && S.titlesExtra.includes(`Champion de ${ALIGN[S.align.side].name}`)) || (it.orn && S.unlocks[it.orn]) || (it.wing && S.unlocks["wing_" + it.wing]) || (it.furn && S.furniture.includes(it.furn));
  // qty (0.1.45) : plusieurs d'un coup, pour les articles « many » (Galets, coffres…)
  E.buyShop = (S, shop, id, qty) => {
    const Sh = SHOPS[shop]; const it = Sh && Sh.items.find((x) => x.id === id); if (!it) return "Article inconnu.";
    if (shop === "cite" && !S.align) return "Choisissez d'abord un alignement.";
    if (E.shopOwned(S, it)) return "Déjà obtenu.";
    const n = it.many ? clamp(Math.floor(+qty || 1), 1, 100) : 1; const cost = it.cost * n;
    if ((S.tokens[Sh.cur] || 0) < cost) return `Il faut ${cost} ${Sh.curName.toLowerCase()}.`;
    S.tokens[Sh.cur] -= cost;
    if (it.res) E.addRes(S, it.res, (it.n || 1) * n);
    if (it.cons) E.addCons(S, it.cons, n);
    if (it.title) S.titlesExtra.push(it.title);
    if (it.titleSide) S.titlesExtra.push(`Champion de ${ALIGN[S.align.side].name}`);
    if (it.orn) S.unlocks[it.orn] = 1;
    if (it.wing) S.unlocks["wing_" + it.wing] = 1;
    if (it.furn) S.furniture.push(it.furn);
    note(S, `${Sh.name} : ${n > 1 ? n + " × " : ""}${E.shopItemName(S, it)} obtenu${n > 1 ? "s" : ""}.`, "up"); return null;
  };
  E.setWing = (S, cid, w) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; c.wing = w && S.unlocks["wing_" + w] ? w : null; };

  /* ---------------- Métiers de forgemagie (0.1.41, comme dans DOFUS) ----------------
     Six métiers, un par famille d'objets : Costumage (coiffes, capes), Joaillomage (amulettes, anneaux), Cordomage (ceintures, bottes),
     Forgemage (armes du Forgeron), Sculptemage (armes du Sculpteur), Façomage (boucliers). Niveau 1 à 200.
     Chacun s'apprend au niveau 65 du métier d'artisanat lié (sauf pour ceux qui forgemageaient déjà avant 0.1.41).
     Comme dans DOFUS, le niveau ne change pas les chances : il monte en forgemageant des objets proches de son niveau,
     et le niveau 200 permet de signer un objet. L'ancien métier unique (S.fmJob) donne son niveau aux six. */
  E.FM_MAX = 200; E.FM_LEARN = 65;
  E.FM_JOBS = {
    costumage: { name: "Costumage", base: "tailleur", slots: ["coiffe", "cape"] },
    joaillomage: { name: "Joaillomage", base: "bijoutier", slots: ["amulette", "anneau"] },
    cordomage: { name: "Cordomage", base: "cordonnier", slots: ["ceinture", "bottes"] },
    forgemage: { name: "Forgemage", base: "forgeron", slots: [] },
    sculptemage: { name: "Sculptemage", base: "sculpteur", slots: [] },
    facomage: { name: "Façomage", base: "faconneur", slots: ["bouclier"] },
  };
  E.fmJobs = (S) => {
    if (!S.fmJobs) { const old = S.fmJob || { lvl: 1, xp: 0 }; S.fmJobs = {}; for (const j in E.FM_JOBS) S.fmJobs[j] = { lvl: Math.min(E.FM_MAX, old.lvl || 1), xp: 0 };
      if ((old.lvl || 1) > 1 || ((S.cnt && S.cnt.fm) || 0) > 0) S.fmJobs.old = 1; } // déjà forgemage : les six métiers restent ouverts
    return S.fmJobs;
  };
  /* le métier de forgemagie d'un objet */
  E.fmJobOf = (tpl) => { const T = ITEMS[tpl]; if (!T) return "forgemage"; if (T.slot === "arme") return T.craft && T.craft.job === "sculpteur" ? "sculptemage" : "forgemage";
    for (const j in E.FM_JOBS) if (E.FM_JOBS[j].slots.includes(T.slot)) return j; return "forgemage"; };
  E.fmJob = (S, job) => { const J = E.fmJobs(S); if (job) return J[job]; let best = J.forgemage; for (const j in E.FM_JOBS) if (J[j].lvl > best.lvl) best = J[j]; return best; };
  E.fmTop = (S) => E.fmJob(S).lvl;
  E.fmLearned = (S, job) => { const J = E.fmJobs(S); if (J.old) return true; const b = S.crafts[E.FM_JOBS[job].base]; return !!b && b.lvl >= E.FM_LEARN; };
  E.fmNeed = (l) => 20 + 30 * l;
  E.fmGainXp = (S, x, job) => {
    const J = E.fmJob(S, job || "forgemage"); if (!J || J.lvl >= E.FM_MAX) return; J.xp += x;
    while (J.lvl < E.FM_MAX && J.xp >= E.fmNeed(J.lvl)) { J.xp -= E.fmNeed(J.lvl); J.lvl++; if (J.lvl % 10 === 0 || J.lvl === E.FM_MAX) note(S, `${E.FM_JOBS[job || "forgemage"].name} niveau ${J.lvl}`, "up"); }
    if (J.lvl >= E.FM_MAX) J.xp = 0;
  };
  /* XP d'une tentative : comme dans DOFUS, un objet bien en dessous du niveau du métier rapporte peu */
  E.fmXpFor = (S, tpl, weight) => { const T = ITEMS[tpl]; const J = E.fmJob(S, E.fmJobOf(tpl)); const gap = J.lvl - T.lvl;
    return Math.round((10 + T.lvl / 2) * (1 + Math.min(weight, 30) / 10) * clamp(1 - Math.max(0, gap - 20) / 60, 0.15, 1)); };
  /* ---------------- Fusion et transmutation des runes (0.1.8.2) ---------------- */
  E.RUNE_FUSE_N = 3; E.TRANSMUTE_N = 5;
  E.transmuteCost = (tier) => (tier === "ra" ? 2000 : tier === "pa" ? 600 : 200);
  E.transmuteTargets = () => STAT_ORDER.filter((k) => k !== "pa" && STATS[k] && STATS[k].pts > 0);
  E.fuseRunes = (S, key, dir) => {
    const [tier, stat] = key.split(":"); if (!STATS[stat]) return "Rune inconnue.";
    if (tier === "ga" || tier === "ta") return "Une rune exotique ou de transcendance ne se fusionne pas.";
    if (RUNE_SIMPLE_ONLY.includes(stat)) return "Cette caractéristique n'existe qu'en rune simple.";
    const take = (k, n) => { S.runes[k] -= n; if (!S.runes[k]) delete S.runes[k]; };
    const give = (k, n) => { S.runes[k] = (S.runes[k] || 0) + n; };
    if (dir === "up") {
      const next = tier === "" ? "pa" : tier === "pa" ? "ra" : null; if (!next) return "Une rune Ra ne se fusionne pas.";
      if ((S.runes[key] || 0) < E.RUNE_FUSE_N) return `Il faut ${E.RUNE_FUSE_N} runes.`;
      take(key, E.RUNE_FUSE_N); give(E.runeKey(next, stat), 1); return null;
    }
    const prev = tier === "ra" ? "pa" : tier === "pa" ? "" : null; if (prev === null) return "Une rune simple ne se casse pas.";
    if (!(S.runes[key] > 0)) return "Aucune rune.";
    take(key, 1); give(E.runeKey(prev, stat), E.RUNE_FUSE_N); return null;
  };
  E.transmute = (S, key, toStat) => {
    const [tier, stat] = key.split(":"); if (!STATS[stat] || !E.transmuteTargets().includes(toStat)) return "Caractéristique impossible.";
    if (tier === "ga" || tier === "ta") return "Une rune exotique ou de transcendance ne se transmute pas.";
    if (toStat === stat) return "Choisissez une autre caractéristique.";
    if (tier && RUNE_SIMPLE_ONLY.includes(toStat)) return "Cette caractéristique n'existe qu'en rune simple : transmutez des runes simples.";
    if ((S.runes[key] || 0) < E.TRANSMUTE_N) return `Il faut ${E.TRANSMUTE_N} runes.`;
    const cost = E.transmuteCost(tier); if (S.kamas < cost) return `Il faut ${cost} kamas.`;
    S.kamas -= cost; S.runes[key] -= E.TRANSMUTE_N; if (!S.runes[key]) delete S.runes[key];
    const nk = E.runeKey(tier, toStat); S.runes[nk] = (S.runes[nk] || 0) + 1; return null;
  };

  /* ---------------- Forgemagie (0.1.41, comme dans DOFUS) ----------------
     Chaque rune a trois issues : succès critique (la rune passe, rien ne baisse), succès neutre (la rune passe, une autre
     caractéristique perd l'équivalent de son poids, sauf si le reliquat paie), échec critique (la rune ne passe pas et une
     caractéristique perd l'équivalent de son poids). Ce qui est perdu en trop remplit le reliquat (le puits) de l'objet.
     Plus l'objet est chargé (poids actuel / poids au jet maximum), plus le succès critique est rare. Over : jusqu'à 101 de poids
     par caractéristique (505 Vitalité, 101 Force). Une caractéristique que l'objet n'a pas (exo de Vitalité…) passe avec le
     reliquat, jusqu'à 20 de poids. Aucune dépense de kamas : seules les runes comptent. */
  E.OVER_W = 101; E.EXO_STAT_W = 20;
  E.FM_KIND = { sc: "Succès critique", sn: "Succès neutre", ec: "Échec critique" };
  E.fmWeights = (it) => {
    const T = ITEMS[it.tpl]; let cur = 0, max = 0;
    for (const k in T.stats) { const mx = T.stats[k][1]; if (mx > 0 && STATS[k]) max += mx * STATS[k].w; }
    for (const k in it.stats) { const v = it.stats[k]; if (v > 0 && STATS[k]) cur += v * STATS[k].w; }
    max = Math.max(1, max); return { cur, max, load: cur / max };
  };
  E.fmCap = (T, k) => { const s = T.stats[k]; if (s) return s[1] > 0 ? Math.max(s[1], Math.floor(E.OVER_W / STATS[k].w)) : 0; return Math.max(1, Math.floor(E.EXO_STAT_W / STATS[k].w)); };
  E.FM_ODDS = { sc: 0.66, scLoad: 0.7, scNear: 0.1, ec: 0.07, ecLoad: 0.3, oSc: 0.3, oScSlope: 0.5, oScLoad: 0.5, oEc: 0.3, oEcSlope: 0.4, oTop: 1.3 };
  E.fmOdds = (load, nv, mx, cap, tier, exoStat) => {
    const O = E.FM_ODDS; let sc, ec;
    if (!exoStat && nv <= mx) { sc = O.sc - Math.max(0, load - 0.6) * O.scLoad - (mx > 0 && nv / mx > 0.9 ? O.scNear : 0); ec = O.ec + Math.max(0, load - 0.7) * O.ecLoad; }
    else { const base = exoStat ? 0 : mx; const o = (nv - base) / Math.max(1, cap - base); sc = O.oSc - o * O.oScSlope - Math.max(0, load - 0.9) * O.oScLoad; ec = O.oEc + o * O.oEcSlope; }
    sc *= clamp((O.oTop - load) / 0.2, 0, 1); // au-delà de 130 % du poids de l'objet, plus de succès critique
    const tp = tier === "ra" ? 0.8 : tier === "pa" ? 0.9 : 1;
    sc = clamp(sc * tp, 0, 0.9); ec = clamp(ec + (1 - tp) * 0.3, 0.03, 0.85);
    if (exoStat) ec = 1 - sc; // exo d'une caractéristique : réussite totale ou rune perdue
    return { sc, sn: Math.max(0, 1 - sc - ec), ec };
  };
  E.fmBlock = (S, it) => {
    const T = ITEMS[it.tpl]; if (!T) return "Objet introuvable.";
    if (T.trophy || T.slot === "dofus") return "Pas de forgemagie sur les Dofus et les trophées.";
    if (T.leg) return "Pas de forgemagie sur les objets légendaires.";
    if (it.trans) return "Objet transcendé : il ne se forgemage plus.";
    const job = E.fmJobOf(it.tpl); if (!E.fmLearned(S, job)) return `${E.FM_JOBS[job].name} : s'apprend au niveau ${E.FM_LEARN} de ${D.CRAFT_JOBS[E.FM_JOBS[job].base].name}.`;
    return null;
  };
  E.fmInfo = (S, uid, runeKey) => {
    const it = S.items[uid]; if (!it) return null; const T = ITEMS[it.tpl]; const ri = E.runeInfo(runeKey); const k = ri.stat;
    if (ri.exo || ri.trans) return { ok: false, why: "Rune spéciale : voir plus bas." };
    const block = E.fmBlock(S, it); if (block) return { ok: false, why: block };
    const job = E.fmJobOf(it.tpl);
    const has = !!T.stats[k]; const [mn, mx] = has ? T.stats[k] : [0, 0];
    const cur = it.stats[k] || 0; let add = ri.pts; let w = ri.weight;
    const malus = has && mx <= 0;
    if (malus) { if (cur >= 0) return { ok: false, why: "Malus déjà remonté à 0." }; add = Math.min(add, -cur); w = add * STATS[k].w / 2; } // un malus remonte vers 0 à moitié de poids
    if (!has && E.EXO_STATS.includes(k)) return { ok: false, why: "Utilisez une rune Ga." };
    const cap = malus ? 0 : E.fmCap(T, k); const nv = cur + add;
    if (nv > cap) return { ok: false, why: `Over maximum atteint (${cap}).`, cur, cap, mx };
    const well = it.well || 0;
    if (!has && well < w) return { ok: false, why: `Exo de ${STATS[k].name} : il faut ${Math.ceil(w)} de reliquat (l'objet en a ${Math.round(well)}).`, exoStat: true, cur, cap };
    const W = E.fmWeights(it); const o = malus ? { sc: 0.7, sn: 0.25, ec: 0.05 } : E.fmOdds(W.load, nv, mx, cap, ri.tier, !has);
    return { ok: true, stat: k, cur, add, nv, mn, mx, cap, w, sc: o.sc, sn: o.sn, ec: o.ec, chance: o.sc + o.sn, over: has && mx > 0 && nv > mx, exoStat: !has, malus, load: W.load, well, wellOk: well >= w, kamas: 0, job };
  };
  const fmLog = (it, txt, ok, kind) => { (it.fmLog = it.fmLog || []).unshift({ t: E.now(), txt, ok, k: kind || (ok ? "sc" : "ec") }); if (it.fmLog.length > 8) it.fmLog.length = 8; };
  const wTxt = (w) => (Math.round(w * 10) / 10).toLocaleString("fr-FR");
  /* retire au moins w de poids aux autres caractéristiques positives, l'over et les exo d'abord (comme dans DOFUS) */
  const fmLose = (it, T, skip, w) => {
    let lost = 0; const parts = [];
    for (let guard = 0; lost < w - 1e-9 && guard < 40; guard++) {
      const pos = Object.keys(it.stats).filter((k) => k !== skip && STATS[k] && it.stats[k] > 0 && !(it.trans && it.trans.k === k));
      if (!pos.length) break;
      const first = pos.filter((k) => !T.stats[k] || it.stats[k] > T.stats[k][1]);
      const pool = first.length ? first : pos; const k = pool[Math.floor(rnd() * pool.length)];
      const unit = STATS[k].w; let d = Math.min(it.stats[k], Math.max(1, Math.ceil((w - lost) / unit)));
      if (first.length && T.stats[k] && it.stats[k] > T.stats[k][1]) d = Math.min(d, it.stats[k] - T.stats[k][1]) || d;
      it.stats[k] -= d; if (!T.stats[k] && it.stats[k] <= 0) delete it.stats[k];
      if (it.roll && it.roll[k] !== undefined && it.stats[k] !== undefined) it.roll[k] = Math.min(it.roll[k], it.stats[k]);
      lost += d * unit; parts.push(`−${d} ${STATS[k].name}`);
    }
    return { parts, lost };
  };
  E.forgemage = (S, uid, runeKey) => {
    const it = S.items[uid]; if (!it) return { err: "Objet introuvable." };
    if (!(S.runes[runeKey] > 0)) return { err: "Vous n'avez pas cette rune." };
    const f = E.fmInfo(S, uid, runeKey); if (!f.ok) return { err: f.why };
    if (!E.almChance(S, "fm")) { S.runes[runeKey]--; if (!S.runes[runeKey]) delete S.runes[runeKey]; } // 0.1.39 : Almanax « Forgemagie améliorée »
    S.cnt.fm = (S.cnt.fm || 0) + 1; it.fm = (it.fm || 0) + 1;
    E.emit(S, "fm", {});
    const T = ITEMS[it.tpl]; const wasPerfect = E.isPerfect(it);
    E.fmGainXp(S, E.fmXpFor(S, it.tpl, f.w), f.job);
    const r = rnd(); const kind = r < f.sc ? "sc" : r < f.sc + f.sn ? "sn" : "ec";
    const parts = [];
    if (kind !== "ec") {
      var roll0 = it.roll ? it.roll[f.stat] : undefined; it.stats[f.stat] = f.nv; if (it.roll && it.roll[f.stat] !== undefined) it.roll[f.stat] = Math.min(f.mx, (it.roll[f.stat] || 0) + f.add);
      parts.push(`+${f.add} ${STATS[f.stat].name}${f.over ? " (over)" : f.exoStat ? " (exo)" : ""}`);
      if (f.exoStat) it.well = Math.max(0, (it.well || 0) - f.w);
      S.cnt.fmSc = (S.cnt.fmSc || 0) + (kind === "sc" ? 1 : 0);
    }
    if (kind !== "sc" && !f.exoStat) {
      if (S.fmShield) { S.fmShield = false; parts.push("le Cristal protège l'objet"); }
      else if (kind === "sn" && (it.well || 0) >= f.w) { it.well -= f.w; parts.push(`le reliquat paie ${wTxt(f.w)}`); }
      else { const L = fmLose(it, T, f.stat, f.w); parts.push(...L.parts);
        if (kind === "sn" && L.lost < f.w - 0.05) { it.stats[f.stat] = f.cur; if (!T.stats[f.stat] && !f.cur) delete it.stats[f.stat]; if (roll0 !== undefined) it.roll[f.stat] = roll0; parts.length = 0; parts.push(...L.parts, "rien d'autre à faire baisser : la rune ne passe pas"); it.well = (it.well || 0) + L.lost; } // objet vidé : pas de gain gratuit
        else { const extra = kind === "ec" ? L.lost : L.lost - f.w; if (extra > 0.05) { it.well = (it.well || 0) + extra; parts.push(`+reliquat ${wTxt(extra)}`); } } }
    }
    if (kind === "ec" && f.exoStat) parts.push(`${E.runeName(runeKey)} perdue`);
    const perfect = !wasPerfect && E.isPerfect(it);
    if (perfect) { note(S, `${T.name} est désormais Parfait !`, "rare"); parts.push("objet Parfait"); }
    const txt = `${E.FM_KIND[kind]} : ${parts.join(" · ") || "rien ne change"}`; fmLog(it, txt, kind !== "ec", kind);
    return { ok: kind !== "ec", kind, txt, perfect };
  };

  /* ---------------- Exotique (0.1.41, comme dans DOFUS) : +1 PA, +1 PM, +1 Portée ou +1 Invocation ----------------
     Sur tout objet (pas les Dofus et trophées), qui n'a pas déjà cette caractéristique ni d'autre exo, en succès critique seulement :
     un échec ne coûte que la rune. Un seul exo PA, un seul PM et un seul Po porté par héros. Chances adaptées au jeu (DOFUS : 1 %).
     Runes Ga : coffres de boss des donjons 150+ (stasis 7, Ga PA en stasis 8), archimonstres 150+, atelier de runes. */
  E.EXO_STATS = ["pa", "pm", "po", "inv"];
  E.EXO_ONE = ["pa", "pm", "po"];
  E.EXO = { pa: { chance: 0.05 }, pm: { chance: 0.06 }, po: { chance: 0.08 }, inv: { chance: 0.10 } };
  E.EXO_LVL = 150; // niveau des donjons et archimonstres qui donnent des runes Ga
  E.EXO_CRAFT = { pa: { ra: 25, eclat: 5, kamas: 150000 }, pm: { ra: 10, eclat: 3, kamas: 50000 }, po: { ra: 10, eclat: 3, kamas: 50000 }, inv: { ra: 10, eclat: 3, kamas: 50000 } };
  E.EXO_DROP = { pmpo: 1 / 40, pa: 1 / 100, archi: 1 / 25 };
  E.exoKey = (stat) => E.runeKey("ga", stat);
  E.exoOk = (it) => { const T = ITEMS[it.tpl]; return !!T && T.slot !== "dofus" && !T.trophy; };
  E.exoInfo = (S, uid, stat) => {
    const it = S.items[uid]; if (!it || !E.EXO[stat]) return { ok: false, why: "Objet introuvable." };
    const T = ITEMS[it.tpl]; const X = E.EXO[stat]; const key = E.exoKey(stat);
    const base = { stat, key, chance: X.chance, kamas: 0, have: S.runes[key] || 0 };
    const block = E.fmBlock(S, it); if (block) return Object.assign(base, { ok: false, why: block });
    if (it.exo) return Object.assign(base, { ok: false, why: `Cet objet a déjà un exo (${STATS[it.exo].name}).` });
    if (T.stats[stat]) return Object.assign(base, { ok: false, why: "L'objet a déjà cette caractéristique." });
    if (!(S.runes[key] > 0)) return Object.assign(base, { ok: false, why: `Il faut une ${E.runeName(key)}.` });
    return Object.assign(base, { ok: true });
  };
  E.exoForge = (S, uid, stat) => {
    const f = E.exoInfo(S, uid, stat); if (!f.ok) return { err: f.why };
    const it = S.items[uid]; const T = ITEMS[it.tpl]; const job = E.fmJobOf(it.tpl);
    if (!E.almChance(S, "fm")) { S.runes[f.key]--; if (!S.runes[f.key]) delete S.runes[f.key]; }
    S.cnt.fm = (S.cnt.fm || 0) + 1; it.fm = (it.fm || 0) + 1; S.cnt.exoTry = (S.cnt.exoTry || 0) + 1;
    E.emit(S, "fm", {}); E.fmGainXp(S, E.fmXpFor(S, it.tpl, 30) * 2, job);
    if (rnd() < f.chance) {
      it.exo = stat; S.cnt.exo = (S.cnt.exo || 0) + 1;
      const txt = `Succès critique : exo +1 ${STATS[stat].name} !`; fmLog(it, txt, true, "sc");
      note(S, `${T.name} : forgemagie exotique réussie, +1 ${STATS[stat].name} !`, "rare");
      E.celebrate({ t: "exo", tpl: it.tpl, stat }); E.emit(S, "exo", { stat });
      return { ok: true, kind: "sc", txt };
    }
    const txt = `Échec critique : ${E.runeName(f.key)} perdue, l'objet est intact`; fmLog(it, txt, false, "ec");
    return { ok: false, kind: "ec", txt };
  };
  /* atelier de runes : des runes Ra d'une même caractéristique + Éclats de trouvaille + kamas → 1 rune Ga */
  E.exoCraftInfo = (S, stat, fromKey) => {
    const C = E.EXO_CRAFT[stat]; if (!C) return { ok: false, why: "Rune inconnue." };
    const [tier] = (fromKey || "").split(":"); const have = S.runes[fromKey] || 0; const ecl = S.res[E.RARE_COMPONENT] || 0;
    const base = { stat, fromKey, need: C.ra, have, eclat: C.eclat, haveEclat: ecl, kamas: C.kamas };
    if (tier !== "ra") return Object.assign(base, { ok: false, why: "Choisissez une rune Ra." });
    if (have < C.ra) return Object.assign(base, { ok: false, why: `Il faut ${C.ra} ${E.runeName(fromKey)}.` });
    if (ecl < C.eclat) return Object.assign(base, { ok: false, why: `Il faut ${C.eclat} ${E.RARE_COMPONENT}.` });
    if (S.kamas < C.kamas) return Object.assign(base, { ok: false, why: `Il faut ${C.kamas} kamas.` });
    return Object.assign(base, { ok: true });
  };
  E.exoCraft = (S, stat, fromKey) => {
    const f = E.exoCraftInfo(S, stat, fromKey); if (!f.ok) return f.why;
    S.runes[fromKey] -= f.need; if (!S.runes[fromKey]) delete S.runes[fromKey];
    S.res[E.RARE_COMPONENT] -= f.eclat; S.kamas -= f.kamas;
    const k = E.exoKey(stat); S.runes[k] = (S.runes[k] || 0) + 1; return null;
  };
  const giveExoRune = (S, stat, out, why) => { const k = E.exoKey(stat); S.runes[k] = (S.runes[k] || 0) + 1; S.cnt.exoRunes = (S.cnt.exoRunes || 0) + 1; if (out) out.push(E.runeName(k)); note(S, `${why} : ${E.runeName(k)} !`, "rare"); };
  const pmPoInv = () => { const r = rnd(); return r < 0.4 ? "pm" : r < 0.8 ? "po" : "inv"; };
  E.exoDrop = (S, lvl, k, out) => {
    if (lvl < E.EXO_LVL || k < 7) return;
    if (k >= 8 && rnd() < E.EXO_DROP.pa) giveExoRune(S, "pa", out, "Butin du boss");
    else if (rnd() < E.EXO_DROP.pmpo) giveExoRune(S, pmPoInv(), out, "Butin du boss");
  };
  E.exoArchi = (S, m) => { if ((m.lvl || 0) >= E.EXO_LVL && rnd() < E.EXO_DROP.archi) giveExoRune(S, pmPoInv(), null, `Archimonstre ${m.name}`); };

  /* ---------------- Runes de transcendance (0.1.41, comme les runes astrales des Songes Infinis) ----------------
     Gagnées dans les coffres de palier de l'Expédition sans fin (palier 20 et plus). Réussite garantie : la caractéristique
     s'ajoute en dernier, puis l'objet ne peut plus être forgemagé. Interdite sur un objet over ou exo. */
  E.TRANS = { vit: 50, fo: 10, ine: 10, cha: 10, age: 10, sa: 3, pui: 5, ini: 100, pp: 3, cri: 1, so: 1 };
  E.transKey = (stat) => E.runeKey("ta", stat);
  E.transInfo = (S, uid, stat) => {
    const it = S.items[uid]; if (!it || !E.TRANS[stat]) return { ok: false, why: "Objet introuvable." };
    const T = ITEMS[it.tpl]; const key = E.transKey(stat); const base = { stat, key, v: E.TRANS[stat], have: S.runes[key] || 0 };
    const block = E.fmBlock(S, it); if (block) return Object.assign(base, { ok: false, why: block });
    if (it.exo) return Object.assign(base, { ok: false, why: "Interdite sur un objet exo." });
    for (const k in it.stats) if (it.stats[k] > 0 && (!T.stats[k] || it.stats[k] > T.stats[k][1])) return Object.assign(base, { ok: false, why: "Interdite sur un objet over ou exo." });
    if (!(S.runes[key] > 0)) return Object.assign(base, { ok: false, why: `Il faut une ${E.runeName(key)}.` });
    return Object.assign(base, { ok: true });
  };
  E.transForge = (S, uid, stat) => {
    const f = E.transInfo(S, uid, stat); if (!f.ok) return { err: f.why };
    const it = S.items[uid]; const T = ITEMS[it.tpl];
    S.runes[f.key]--; if (!S.runes[f.key]) delete S.runes[f.key];
    it.stats[stat] = (it.stats[stat] || 0) + f.v; it.trans = { k: stat, v: f.v };
    S.cnt.fm = (S.cnt.fm || 0) + 1; S.cnt.trans = (S.cnt.trans || 0) + 1; it.fm = (it.fm || 0) + 1;
    E.fmGainXp(S, E.fmXpFor(S, it.tpl, 30), E.fmJobOf(it.tpl));
    if (E.fmPlanOf(S, uid)) E.stopFmPlan(S, uid);
    const txt = `Transcendance : +${f.v} ${STATS[stat].name} · l'objet ne se forgemage plus`; fmLog(it, txt, true, "sc");
    note(S, `${T.name} est transcendé : +${f.v} ${STATS[stat].name}.`, "rare");
    return { ok: true, kind: "sc", txt };
  };
  /* Signature (niveau 200 du métier de l'objet, comme la rune de signature de DOFUS) */
  E.signItem = (S, uid, name) => {
    const it = S.items[uid]; if (!it) return "Objet introuvable."; const job = E.fmJobOf(it.tpl);
    if (E.fmJob(S, job).lvl < E.FM_MAX) return `${E.FM_JOBS[job].name} niveau ${E.FM_MAX} requis pour signer.`;
    const n = String(name || "").trim().slice(0, 24); if (!n) return "Nom manquant.";
    it.sig = n; return null;
  };

  /* ---------------- Forgemagie automatique (0.1.9.1) : un plan par objet, tourne en jeu comme hors ligne ----------------
     Plan : objectifs (caractéristique → jet visé), runes autorisées, budget de kamas, plancher. Une tentative toutes les 10 min
     (8 min au Forgemage 50, 6 min au 100), 2 plans en parallèle, pas de héros à affecter. Le plan s'arrête quand les objectifs sont
     atteints, que les runes ou le budget manquent, ou que le plancher est touché. */
  E.FM_PLAN_MAX = 2;
  E.fmPlanPeriod = (S) => { const l = E.fmTop(S); return l >= 100 ? 360 : l >= 50 ? 480 : 600; };
  E.fmPlans = (S) => S.fmPlans || (S.fmPlans = []);
  E.fmPlanOf = (S, uid) => E.fmPlans(S).find((p) => p.uid === uid && !p.done);
  E.fmPlanActive = (S) => E.fmPlans(S).filter((p) => !p.done);
  E.FM_PLAN_RUNES = { all: "Celles du sac (Ra, Pa puis simples)", simple: "Simples seulement", hi: "Pa et Ra seulement" };
  E.FM_PLAN_FLOOR = { pct: "Arrêter si une autre caractéristique baisse de plus de 5 %", first: "Arrêter à la première baisse", never: "Ne jamais s'arrêter (le reliquat encaisse)" };
  E.startFmPlan = (S, uid, cfg) => {
    const it = S.items[uid]; if (!it) return "Objet introuvable."; const T = ITEMS[it.tpl];
    { const bl = E.fmBlock(S, it); if (bl) return bl; }
    if (E.fmPlanOf(S, uid)) return "Cet objet a déjà un plan en cours.";
    if (E.fmPlanActive(S).length >= E.FM_PLAN_MAX) return `${E.FM_PLAN_MAX} plans en parallèle au maximum.`;
    const goals = {};
    for (const k in cfg.goals || {}) { const [, mx] = T.stats[k] || [0, 0]; if (mx <= 0) continue; const cap = E.fmCap(T, k); const v = clamp(Math.round(+cfg.goals[k] || mx), 1, cap); if (v > (it.stats[k] || 0)) goals[k] = v; }
    if (!Object.keys(goals).length) return "Choisissez au moins un objectif au-dessus du jet actuel.";
    const plan = { uid, name: T.name, goals, runes: E.FM_PLAN_RUNES[cfg.runes] ? cfg.runes : "all", budget: Math.max(0, Math.round(+cfg.budget || 0)), floor: E.FM_PLAN_FLOOR[cfg.floor] ? cfg.floor : "pct",
      base: Object.assign({}, it.stats), spent: 0, prog: 0, tries: 0, ok: 0, log: [], done: null, t0: E.now() };
    const plans = E.fmPlans(S); plans.push(plan); while (plans.length > 6) { const i = plans.findIndex((p) => p.done); if (i < 0) break; plans.splice(i, 1); }
    note(S, `Plan de forgemagie lancé : ${T.name}.`, "info"); return null;
  };
  E.stopFmPlan = (S, uid, drop) => { const plans = E.fmPlans(S); const i = plans.findIndex((p) => p.uid === uid && (drop ? !!p.done : !p.done)); if (i < 0) return; if (drop) plans.splice(i, 1); else { plans[i].done = "Arrêté"; plans[i].at = E.now(); } };
  E.fmPlanGoalsLeft = (S, plan) => { const it = S.items[plan.uid]; if (!it) return []; return Object.keys(plan.goals).filter((k) => (it.stats[k] || 0) < plan.goals[k]); };
  const PLAN_TIERS = { all: ["ra", "pa", ""], simple: [""], hi: ["ra", "pa"] };
  const planLog = (plan, txt, ok) => { plan.log.unshift({ t: E.now(), txt, ok }); if (plan.log.length > 8) plan.log.length = 8; };
  const endPlan = (S, plan, why, quiet) => { plan.done = why; plan.at = E.now(); if (why === "Objectifs atteints") S.cnt.fmPlanOk = (S.cnt.fmPlanOk || 0) + 1; if (!quiet) note(S, `Plan ${plan.name} : ${why}.`, why === "Objectifs atteints" ? "up" : "info"); };
  /* une tentative : retourne false quand le plan s'arrête */
  const fmPlanStep = (S, plan, quiet) => {
    const it = S.items[plan.uid]; if (!it) { endPlan(S, plan, "Objet disparu", quiet); return false; }
    const left = E.fmPlanGoalsLeft(S, plan); if (!left.length) { endPlan(S, plan, "Objectifs atteints", quiet); return false; }
    /* la plus grosse rune qui reste sous l'objectif ; sinon la plus petite qui le dépasse (jusqu'au plafond), comme à la main */
    let best = null, over = null;
    for (const k of left) for (const tier of PLAN_TIERS[plan.runes]) {
      if (tier && RUNE_SIMPLE_ONLY.includes(k)) continue;
      const key = E.runeKey(tier, k); if (!(S.runes[key] > 0)) continue;
      const f = E.fmInfo(S, plan.uid, key); if (!f || !f.ok) continue;
      if (f.nv <= plan.goals[k]) { if (!best || f.add > best.f.add) best = { key, f }; }
      else if (!over || f.add < over.f.add) over = { key, f };
    }
    if (!best) best = over;
    if (!best) { endPlan(S, plan, "Plus de runes adaptées", quiet); return false; }
    const r = E.forgemage(S, plan.uid, best.key); if (r.err) { endPlan(S, plan, r.err, quiet); return false; }
    plan.tries++; if (r.ok) plan.ok++;
    planLog(plan, `${E.runeName(best.key)} : ${r.txt}`, r.ok);
    if (r.kind !== "sc" && plan.floor !== "never") {
      for (const k in plan.base) { const v = it.stats[k] || 0, b = plan.base[k]; if (b <= 0) continue;
        if ((plan.floor === "first" && v < b) || (plan.floor === "pct" && v < b * 0.95)) { endPlan(S, plan, `Plancher touché (${STATS[k].name} ${b} → ${v})`, quiet); return false; } }
    }
    if (!E.fmPlanGoalsLeft(S, plan).length) { endPlan(S, plan, "Objectifs atteints", quiet); return false; }
    return true;
  };
  E.fmPlanTick = (S, sec, opts = {}) => {
    const plans = E.fmPlanActive(S); if (!plans.length) return []; const period = E.fmPlanPeriod(S); const out = [];
    for (const plan of plans) {
      const t0 = plan.tries, ok0 = plan.ok, k0 = plan.spent; plan.prog = (plan.prog || 0) + sec; let n = 0;
      while (!plan.done && plan.prog >= period && n < 300) { plan.prog -= period; n++; if (!fmPlanStep(S, plan, opts.quiet)) break; }
      if (plan.tries > t0 || plan.done) { const it = S.items[plan.uid];
        out.push({ name: plan.name, tries: plan.tries - t0, ok: plan.ok - ok0, kamas: plan.spent - k0, done: plan.done,
          txt: Object.keys(plan.goals).map((k) => `${STATS[k].name} ${it ? it.stats[k] || 0 : "?"}/${plan.goals[k]}`).join(", ") }); }
    }
    return out;
  };
  E.fmPlanEta = (S, plan) => Math.max(0, E.fmPlanPeriod(S) - (plan.prog || 0));


  /* ---------------- Protecteurs de ressources (0.1.10.1) ----------------
     Environ une fois sur 60 récoltes (au plus un à la fois, 30 min de calme après), un gardien de la ressource apparaît et attend 15 min.
     Si l'équipe chasse, « Combattre » le place dans le prochain combat avec quelques monstres de la zone. Victoire : récolte de cette
     ressource ×2 pendant 20 min, 10 de la ressource et 3 Éclats de trouvaille. Défaite ou délai passé : il repart. Désactivable dans les Options. */
  E.PROT_CHANCE = 1 / 60; E.PROT_WAIT_S = 900; E.PROT_CALM_S = 1800; E.PROT_BOOST_S = 1200;
  E.PROT_RE = { paysan: /Épouvantail|Tournesol|Bouftou|Champ|Blé|Pissenlit/, bucheron: /Abrak|Arbre|Chêne|Tronk|Bambou|Kokoko/, mineur: /Roche|Golem|Mineur|Crocabulia|Kobalte|Craqueleur|Cristal/, alchimiste: /Ortie|Fleur|Rose|Champa|Mandragore|Trèfle|Menthe/, pecheur: /Crabe|Poisson|Kraken|Crustorail|Moule|Mérulor|Gobus|Crevette|Pichon/ };
  E.PROT_TITLE = { paysan: "Protecteur des céréales", bucheron: "Protecteur des bois", mineur: "Protecteur des minerais", alchimiste: "Protecteur des plantes", pecheur: "Protecteur des poissons" };
  const protPool = {}; const protMons = (job) => protPool[job] || (protPool[job] = Object.keys(MONSTERS).filter((k) => E.PROT_RE[job] && E.PROT_RE[job].test(MONSTERS[k].name) && !MONSTERS[k].boss && !MONSTERS[k].archiOf));
  E.protActive = (S, now = E.now()) => (S.protector && S.protector.until > now ? S.protector : null);
  E.protSpawn = (S, c, W) => {
    if (S.settings && S.settings.protOff) return; const now = E.now();
    if (E.protActive(S, now) || (S.protCalm || 0) > now || rnd() >= E.PROT_CHANCE) return;
    const pool = protMons(W.job); if (!pool.length) return;
    const lvl = Math.max(c.lvl, ...E.team(S).map((x) => x.lvl), 1);
    const mon = pool.slice().sort((a, b) => Math.abs(MONSTERS[a].lvl[0] - lvl) - Math.abs(MONSTERS[b].lvl[0] - lvl))[0];
    S.protector = { job: W.job, res: W.res, mon, cid: c.id, until: now + E.PROT_WAIT_S * 1000, at: now };
    note(S, `${E.PROT_TITLE[W.job]} apparaît pendant que ${c.name} récolte : ${MONSTERS[mon].name} garde le ${W.res}. Vous avez 15 min : bouton « Combattre » sur l'Accueil ou dans Métiers.`, "rare");
  };
  E.protCanFight = (S) => { const P = E.protActive(S); if (!P) return "Aucun protecteur."; if (S.dungeon) return "Impossible pendant un donjon."; if (!E.team(S).length) return "Votre équipe est vide."; if (!S.hunting || !S.sub) return "Partez chasser avec l'équipe pour l'affronter."; return null; };
  /* 0.1.29.3 : « Combattre » prépare tout seul le combat. Si les héros de l'équipe récoltent, ils reviennent ; si l'équipe ne chasse pas,
     elle part chasser dans sa dernière zone. Après le combat (ou si le protecteur repart), chacun reprend ce qu'il faisait (E.protRestore). */
  E.protWhy = (S) => { const P = E.protActive(S); if (!P) return "Aucun protecteur."; if (S.dungeon) return "Impossible pendant un donjon : finissez-le d'abord.";
    if (E.expActive && E.expActive(S)) return "Impossible pendant une expédition : finissez-la d'abord.";
    if (!E.team(S).length && !S.chars.some((c) => c.inTeam && c.job)) return "Votre équipe est vide : ajoutez un héros dans Équipe et héros."; return null; };
  E.protFight = (S) => {
    const err = E.protWhy(S); if (err) return err; const P = S.protector; const jobs = {};
    if (!E.team(S).length) { S.chars.filter((c) => c.inTeam && c.job).slice(0, 8).forEach((c) => { jobs[c.id] = c.job; c.job = null; }); S.fight = null; }
    let hunt = false;
    if (!S.hunting || !S.sub) {
      const sid = S.sub && E.subUnlocked(S, S.sub) ? S.sub : Object.keys(SUBS).find((k) => E.subUnlocked(S, k));
      const e2 = sid ? E.startHunt(S, sid) : "Aucune zone ouverte.";
      if (e2) { S.chars.forEach((c) => { if (jobs[c.id] && !c.job) c.job = jobs[c.id]; }); return e2; }
      hunt = true;
    }
    if (Object.keys(jobs).length || hunt) P.back = { jobs, hunt };
    P.go = true; return null;
  };
  E.protRestore = (S, B) => {
    if (!B) return; const names = [];
    S.chars.forEach((c) => { const W = B.jobs && B.jobs[c.id]; if (W && !c.job) { c.job = Object.assign({}, W, { prog: 0 }); names.push(c.name); } });
    if (B.hunt && !S.dungeon && !(E.expActive && E.expActive(S))) { S.hunting = false; S.fight = null; }
    else if (names.length && !S.dungeon) S.fight = null;
    if (names.length) note(S, `${names.join(", ")} ${names.length > 1 ? "reprennent" : "reprend"} la récolte.`, "info");
  };
  E.protGroup = (S, sub, team, monsterEntity) => {
    const P = E.protActive(S); if (!P || !P.go) return null;
    const avg = team.reduce((a, c) => a + c.lvl, 0) / team.length; const lvl = Math.round(Math.min(200, avg + 3));
    const g = monsterEntity(P.mon, lvl); g.name = `${MONSTERS[P.mon].name} protecteur`; g.prot = true;
    g.hpMax = g.hp = Math.round(g.hpMax * (1.5 + team.length * 0.6)); g.dmg *= team.length > 1 ? 1.3 : 1.1; g.attacks = team.length > 1 ? 2 : 1; g.ini += 80; /* seul : une attaque par tour */
    const mons = [g].concat(E.makeGroup(S, sub, team.length).slice(0, Math.max(0, team.length - 1)));
    P.go = false; P.fighting = true;
    return { mons, label: `${E.PROT_TITLE[P.job]} · ${sub.name}` };
  };
  E.protEnd = (S, win) => {
    const P = S.protector; if (!P) return; const now = E.now();
    S.protector = null; S.protCalm = now + E.PROT_CALM_S * 1000; if (P.back) S.protBack = P.back;
    if (win) {
      S.protBoost = { res: P.res, until: now + E.PROT_BOOST_S * 1000 };
      addRes(S, P.res, 10); addRes(S, E.RARE_COMPONENT, 3);
      S.cnt = S.cnt || {}; S.cnt.prot = (S.cnt.prot || 0) + 1;
      note(S, `${E.PROT_TITLE[P.job]} vaincu ! ${P.res} ×2 pendant 20 min, +10 ${P.res} et +3 ${E.RARE_COMPONENT}.`, "rare");
    } else note(S, `${E.PROT_TITLE[P.job]} l'emporte et repart avec son ${P.res}.`, "warn");
  };
  E.protMult = (S, res) => (S.protBoost && S.protBoost.res === res && S.protBoost.until > E.now() ? 2 : 1);
  E.protExpire = (S) => { const P = S.protector; if (P && P.fighting && !(S.fight && S.fight.prot && !S.fight.over)) P.fighting = false;
    if (P && !P.fighting && P.until <= E.now()) { S.protector = null; S.protCalm = E.now() + E.PROT_CALM_S * 1000; note(S, `${E.PROT_TITLE[P.job]} est reparti sans combattre.`, "info"); if (P.back) S.protBack = P.back; }
    if (S.protBack && !(S.fight && S.fight.prot && !S.fight.over)) { const B = S.protBack; S.protBack = null; E.protRestore(S, B); } };



  /* ---------------- Carnet de panoplies (0.1.10.1) : pièces, où les obtenir ---------------- */
  let SET_IDX = null;
  const setIdx = () => {
    if (SET_IDX) return SET_IDX;
    const pieces = {}, drops = {}, zonesOf = {}, dgOf = {};
    for (const t in ITEMS) { const T = ITEMS[t]; if (T.set) (pieces[T.set] = pieces[T.set] || []).push(t); }
    for (const k in MONSTERS) (MONSTERS[k].items || []).forEach(([t, p]) => (drops[t] = drops[t] || []).push([k, p]));
    for (const sid in SUBS) { const sb = SUBS[sid]; if (sb.hidden) continue; (sb.monsters || []).forEach((m) => { const k = Array.isArray(m) ? m[0] : m; (zonesOf[k] = zonesOf[k] || []).push(sid); }); }
    for (const did in DUNGEONS) { const dg = DUNGEONS[did]; [dg.boss, ...(dg.bossMobs || []), ...dg.rooms.flatMap((r) => r.mobs)].forEach((k) => { (dgOf[k] = dgOf[k] || new Set()).add(did); }); }
    for (const st in pieces) pieces[st].sort((a, b) => ITEMS[a].lvl - ITEMS[b].lvl || ITEMS[a].name.localeCompare(ITEMS[b].name, "fr"));
    return (SET_IDX = { pieces, drops, zonesOf, dgOf });
  };
  E.setPieces = (setId) => setIdx().pieces[setId] || [];
  E.setLvl = (setId) => Math.max(0, ...E.setPieces(setId).map((t) => ITEMS[t].lvl));
  /* sources d'une pièce : recette, puis monstres (zones de chasse, donjons), le plus probable d'abord */
  E.itemSources = (tpl) => {
    const I = setIdx(); const T = ITEMS[tpl]; const out = [];
    if (T && T.craft) out.push({ k: "craft", job: T.craft.job, lvl: E.craftReq(tpl) });
    (I.drops[tpl] || []).slice().sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([m, p]) => {
      const M = MONSTERS[m]; const subs = (I.zonesOf[m] || []).slice(0, 2); const dgs = [...(I.dgOf[m] || [])].slice(0, 2);
      out.push({ k: M.boss ? "boss" : "mon", mon: m, p, subs, dgs });
    });
    return out;
  };
  E.ownedTpls = (S) => { const o = {}; for (const u in S.items) o[S.items[u].tpl] = (o[S.items[u].tpl] || 0) + 1; return o; };
  /* panoplie « connue » : une pièce possédée, une recette à portée de métier, ou un monstre qui la lâche déjà vu */
  E.setKnown = (S, setId, owned) => E.setPieces(setId).some((t) => owned[t] || (ITEMS[t].craft && S.crafts[ITEMS[t].craft.job] && S.crafts[ITEMS[t].craft.job].lvl >= E.craftReq(t)) || (setIdx().drops[t] || []).some(([m]) => S.bestiary[m]));

  /* ---------------- Codes cadeaux (0.1.10.1) ----------------
     Code = « IDLUS- » + contenu (JSON en base64url) + « - » + signature. Fabriqué par tools/code_cadeau.js, vérifié sans serveur :
     ce n'est pas inviolable, mais un code inventé ou modifié est refusé. Contenu : id (unique), k kamas, r ressources [[nom, n]],
     c consommables [[id, n]], i objets [[modèle, n]] (0.1.26), t titre, o ornement (clé d'un ornement à débloquer), e date de fin (AAAA-MM-JJ), m message. Un code par partie. */
  E.GIFT_SALT = "idlus·cadeau·v1·pousse-du-pionnier";
  const fnv = (str, seed) => { let x = seed >>> 0; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619) >>> 0; return x >>> 0; };
  E.giftSig = (body) => (fnv(E.GIFT_SALT + body, 2166136261).toString(36).padStart(7, "0") + fnv(body + E.GIFT_SALT, 33554467).toString(36).padStart(7, "0")).toUpperCase();
  const b64u = { enc: (txt) => { const b = typeof Buffer !== "undefined" ? Buffer.from(txt, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(txt))); return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec: (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return typeof Buffer !== "undefined" ? Buffer.from(s, "base64").toString("utf8") : decodeURIComponent(escape(atob(s))); } };
  E.makeGift = (data) => { const body = b64u.enc(JSON.stringify(data)); return `IDLUS-${body}-${E.giftSig(body)}`; };
  E.readGift = (code) => {
    const m = /^IDLUS-([A-Za-z0-9_-]+)-([0-9A-Z]{14})$/.exec(String(code || "").trim().replace(/\s+/g, ""));
    if (!m) return { err: "Ce code n'a pas le bon format (il commence par IDLUS-)." };
    if (E.giftSig(m[1]) !== m[2].toUpperCase()) return { err: "Ce code n'est pas valide." };
    let d; try { d = JSON.parse(b64u.dec(m[1])); } catch (e) { return { err: "Ce code n'est pas valide." }; }
    if (!d || !d.id) return { err: "Ce code n'est pas valide." };
    return { data: d };
  };
  E.giftText = (d) => { const p = [];
    if (d.k) p.push(`${d.k.toLocaleString("fr-FR")} kamas`);
    (d.r || []).forEach(([n, q]) => p.push(`${q} × ${n}`));
    (d.c || []).forEach(([id, q]) => p.push(`${q} × ${(D.CONSUMABLES[id] || { name: id }).name}`));
    (d.i || []).forEach(([id, q]) => p.push(`${q} × ${(ITEMS[id] || { name: id }).name}`)); // 0.1.26 : objets d'équipement
    if (d.t) p.push(`titre « ${d.t} »`);
    if (d.o && ORN[d.o]) p.push(`ornement « ${ORN[d.o].name(null)} »`);
    return p.join(", "); };
  /* Donne le contenu d'un code déjà vérifié (ancien code IDLUS-… ou code du serveur, 0.1.26). */
  E.giveGift = (S, d, now = E.now()) => {
    S.gifts = S.gifts || {};
    if (d.k) S.kamas += Math.max(0, Math.round(+d.k) || 0);
    (d.r || []).forEach(([n, q]) => { if (RES[n]) addRes(S, n, Math.max(1, Math.round(+q) || 1)); });
    (d.c || []).forEach(([id, q]) => { if (D.CONSUMABLES[id]) E.addCons(S, id, Math.max(1, Math.round(+q) || 1)); });
    (d.i || []).forEach(([id, q]) => { if (ITEMS[id]) for (let n = Math.min(10, Math.max(1, Math.round(+q) || 1)); n > 0; n--) E.rollItem(S, id, { radiant: false }); });
    S.titlesExtra = S.titlesExtra || []; S.unlocks = S.unlocks || {};
    if (d.t && !S.titlesExtra.includes(d.t)) S.titlesExtra.push(String(d.t).slice(0, 40));
    if (d.o && ORN[d.o]) S.unlocks[d.o] = 1;
    S.gifts[d.id] = now;
    const txt = E.giftText(d); note(S, `Code cadeau : ${txt}${d.m ? ` · ${d.m}` : ""}`, "rare");
    return { ok: true, txt, msg: d.m || "" };
  };
  E.redeemGift = (S, code, now = E.now()) => {
    const r = E.readGift(code); if (r.err) return r;
    const d = r.data; S.gifts = S.gifts || {};
    if (S.gifts[d.id]) return { err: "Ce code a déjà été utilisé sur cette partie." };
    if (d.e && now > new Date(d.e + "T23:59:59").getTime()) return { err: `Ce code a expiré le ${new Date(d.e).toLocaleDateString("fr-FR")}.` };
    return E.giveGift(S, d, now);
  };

  /* ---------------- Ornements (contour de la carte de héros) ---------------- */
  const ORN = {
    heros:     { name: () => "Écharpe du Héros d'Amakna", req: "Terminer la quête principale", ok: (S) => S.quest && S.quest.step >= Q.length },
    avis:      { name: () => "Cadre « Avis de recherche »", req: "Bureau des primes (30 jetons)", ok: (S) => !!S.unlocks.avis },
    almanax:   { name: () => "Sceau de l'Almanax", req: "Série d'Almanax de 30 jours", ok: (S) => !!S.unlocks.almanax },
    ame:       { name: () => "Âme violette", req: "Éternelle moisson, palier 4 (âmes des archimonstres jusqu'à Moon)", ok: (S) => !!S.unlocks.ame },
    ailes:     { name: (S) => (S.align ? `Ailes de ${ALIGN[S.align.side].name}` : "Ailes d'alignement"), req: "Choisir un alignement (Bonta ou Brâkmar) — elles grandissent avec le rang", ok: (S) => !!S.align },
    couronne:  { name: () => "Couronne du Maître des donjons", req: "Vaincre chaque boss de donjon au moins une fois", ok: (S) => Object.keys(DUNGEONS).every((d) => S.progress.bossKills[d]) },
    epines:    { name: () => "Épines d'Archimonstre", req: "Vaincre 25 archimonstres", ok: (S) => Object.values(S.archis).reduce((a, b) => a + b, 0) >= 25 },
    lauriers:  { name: () => "Lauriers", req: "Obtenir 20 succès", ok: (S) => Object.keys(S.ach || {}).length >= 20 },
    flammes:   { name: () => "Flammes Rayonnantes", req: "Porter 3 objets Rayonnants en même temps sur un héros", ok: (S) => !!(S.ornSeen && S.ornSeen.flammes) },
    solitaire: { name: () => "Aura du Solitaire", req: "Ancien Emblème du Solitaire niveau 100 (retiré en 0.1.8.2 : seuls ceux qui l'avaient le gardent)", ok: (S) => !!(S.unlocks && S.unlocks.solitaire) },
    stasis:    { name: () => "Sceau du Maître de la stasis", req: "Terminer un donjon en stasis 10", ok: (S) => !!S.unlocks.stasis10 },
    pionnier:  { name: () => "Pousse du Pionnier", req: "Tester la version de test avant le multijoueur (récompense exclusive)", ok: (S) => !!S.unlocks.pionnier },
    phenix:    { name: () => "Ailes du Phénix", req: "Dix renaissances sur un même héros", ok: (S) => !!(S.unlocks && S.unlocks.phenix) },
  };
  /* Récompense des testeurs : titre et ornement exclusifs, donnés à toute partie jouée sur la version de test. */
  E.PIONEER_TITLE = "Pionnier d'Idlus";
  E.grantPioneer = (S) => {
    if (S.unlocks.pionnier && S.titlesExtra.includes(E.PIONEER_TITLE)) return false;
    S.unlocks.pionnier = 1; if (!S.titlesExtra.includes(E.PIONEER_TITLE)) S.titlesExtra.push(E.PIONEER_TITLE); return true;
  };
  E.ORN = ORN;
  E.ornUnlocked = (S, id) => !!ORN[id] && ORN[id].ok(S);
  E.setOrn = (S, cid, id) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; if (id && !E.ornUnlocked(S, id)) return "Ornement verrouillé."; c.orn = id || null; return null; };

  /* ---------------- Carte de héros : cadres et élément dominant ---------------- */
  // 0.1.26 : cadres « Métal orné » : 5 métaux en deux rangs (un rang tous les 20 niveaux), puis Krosmoz au niveau 200
  E.FRAMES = ["Bois I", "Bois II", "Bronze I", "Bronze II", "Argent I", "Argent II", "Or I", "Or II", "Émeraude I", "Émeraude II", "Krosmoz"];
  E.FRAME_KEYS = ["bois1", "bois2", "bronze1", "bronze2", "argent1", "argent2", "or1", "or2", "eme1", "eme2", "krosmoz"];
  E.frameKey = (lvl) => E.FRAME_KEYS[E.frameIdx(lvl || 1)];
  E.frameIdx = (lvl) => (lvl >= 200 ? 10 : Math.min(9, Math.floor(lvl / 20)));
  E.domEl = (st) => { const m = [["t", st.fo], ["f", st.ine], ["e", st.cha], ["a", st.age]].sort((a, b) => b[1] - a[1]); return m[0][1] > 0 ? m[0][0] : "n"; };
  E.radiantWorn = (S, c) => Object.values(c.equip).filter((u) => S.items[u] && S.items[u].radiant).length;

  /* ---------------- Avis de recherche ---------------- */
  E.BOUNTY_SLOTS = 3;
  const makeBounty = (S) => {
    const top = topLvl(S);
    const subs = Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id) && s.lvl[0] <= top + 3 && s.lvl[1] >= top - 12);
    const pool = subs.length ? subs : Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id)).sort((a, b) => b.lvl[0] - a.lvl[0]).slice(0, 3);
    const dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top + 6);
    const taken = new Set((S.bounties || []).map((b) => b.key));
    if (dgs.length && rnd() < 0.25) {
      const d = dgs[Math.floor(rnd() * dgs.length)]; const dg = DUNGEONS[d];
      if (!taken.has(dg.boss)) return { id: E.now() + Math.floor(rnd() * 1e6), key: dg.boss, dg: d, n: 1, prog: 0, kamas: Math.round(dg.lvl * 60), xp: 0.25, axp: 120 };
    }
    for (let tries = 0; tries < 20; tries++) {
      const s = pool[Math.floor(rnd() * pool.length)]; const k = s.monsters[Math.floor(rnd() * s.monsters.length)];
      if (taken.has(k)) continue;
      const m = MONSTERS[k]; const n = 12 + Math.floor(rnd() * 4) * 6;
      return { id: E.now() + Math.floor(rnd() * 1e6), key: k, sub: s.id, n, prog: 0, kamas: Math.round(n * (m.lvl[0] + 5) * 2.2), xp: 0.08 + n / 600, axp: 30 + n };
    }
    return null;
  };
  const fillBounties = (S) => { S.bounties = (S.bounties || []).filter(Boolean); while (S.bounties.length < E.BOUNTY_SLOTS) { const b = makeBounty(S); if (!b) break; S.bounties.push(b); } };
  E.fillBounties = fillBounties;
  E.rerollCost = (S) => 30 * topLvl(S);
  E.rerollBounty = (S, id) => {
    const i = S.bounties.findIndex((b) => b.id === id); if (i < 0) return "Avis introuvable.";
    if ((S.cons.parchemin_avis || 0) > 0) { S.cons.parchemin_avis--; if (!S.cons.parchemin_avis) delete S.cons.parchemin_avis; }
    else { const c = E.rerollCost(S); if (S.kamas < c) return `Il faut ${c} kamas.`; S.kamas -= c; }
    S.bounties.splice(i, 1); fillBounties(S); return null;
  };
  const completeBounty = (S, b) => {
    S.kamas += b.kamas; giveTeamXp(S, b.xp); if (S.align) E.giveAlignXp(S, b.axp);
    S.cnt.bounty = (S.cnt.bounty || 0) + 1;
    const tk = b.dg ? 2 : 1; S.tokens.jetons = (S.tokens.jetons || 0) + tk;
    let extra = ""; const r = rnd(); if (r < 0.05) { E.addCons(S, "coffre_argent"); extra = ", Coffre en argent"; } else if (r < 0.25) { E.addCons(S, "coffre_bois"); extra = ", Coffre en bois"; }
    note(S, `Avis de recherche rempli : ${MONSTERS[b.key].name} (+${b.kamas.toLocaleString("fr-FR")} kamas, +${tk} jeton${tk > 1 ? "s" : ""}${extra}).`, "rare");
    E.emit(S, "bounty", {});
  };

  /* ---------------- Quête principale ---------------- */
  const Q = [
    { title: "Premiers pas", txt: "Chassez sur la Route des âmes d'Incarnam.", t: "kill", sub: "inc_route", n: 10 },
    { title: "Un peu d'expérience", txt: "Atteignez le niveau 5.", t: "lvl", n: 5 },
    { title: "S'équiper", txt: "Équipez 2 objets sur un même héros (Héros → Équipement).", t: "equip", n: 2 },
    { title: "La forêt d'Incarnam", txt: "Chassez dans la Forêt d'Incarnam.", t: "kill", sub: "inc_foret", n: 20 },
    { title: "Mettre la main à la pâte", txt: "Récoltez 30 ressources (Métiers → Récolte : envoyez un héros récolter).", t: "harvest", n: 30 },
    { title: "La Crypte de Kardorim", txt: "Trouvez la clé au Cimetière d'Incarnam et vainquez Kardorim.", t: "boss", dg: "crypte_kardorim" },
    { title: "Bienvenue à Astrub", txt: "Chassez dans la Cité d'Astrub.", t: "kill", sub: "ast_cite", n: 20 },
    { title: "Apprenti artisan", txt: "Fabriquez un objet (Métiers → Artisanat).", t: "craft", n: 1 },
    { title: "Le Havre-Sac", txt: "Achetez 3 améliorations du Havre-Sac (Accueil → Havre-Sac).", t: "havre", n: 3 },
    { title: "Monter en puissance", txt: "Atteignez le niveau 15.", t: "lvl", n: 15 },
    { title: "Le Tournesol Affamé", txt: "Vainquez le boss de la Grange du Tournesol Affamé.", t: "boss", dg: "grange_tournesol" },
    { title: "Dévotion", txt: "Faites une offrande à l'Almanax (Quêtes → Almanax).", t: "almanax", n: 1 },
    { title: "Chasseur de primes", txt: "Remplissez 3 avis de recherche (Quêtes).", t: "bounty", n: 3 },
    { title: "Le Bouftou Royal", txt: "Vainquez le Bouftou Royal.", t: "boss", dg: "cour_bouftou_royal" },
    { title: "Les terres d'Amakna", txt: "Chassez dans la Forêt d'Amakna.", t: "kill", sub: "ama_foret", n: 30 },
    { title: "Le choix d'un camp", txt: `Atteignez le niveau ${30} et choisissez Bonta ou Brâkmar (Quêtes → Alignement).`, t: "align" },
    { title: "Briseur de runes", txt: "Brisez un objet en runes (Forgemagie → Brisage). La forgemagie s'apprend ensuite au niveau 65 d'un métier d'artisanat.", t: "brk", n: 1 }, // 0.1.41 : la forgemagie s'apprend au niveau 65 (comme dans DOFUS)
    { title: "Le Scarabosse Doré", txt: "Vainquez le Donjon des Scarafeuilles.", t: "boss", dg: "donjon_scarafeuilles" },
    { title: "Les plaines de Cania", txt: "Chassez dans la Plaine des Porkass.", t: "kill", sub: "can_porkass", n: 30 },
    { title: "La Bworkette", txt: "Vainquez le Donjon des Bworks.", t: "boss", dg: "donjon_bworks" },
    { title: "Niveau 50", txt: "Atteignez le niveau 50.", t: "lvl", n: 50 },
    { title: "Le Blop Coco Royal", txt: "Vainquez le Clos des Blops.", t: "boss", dg: "clos_blops" },
  ];
  E.MAIN_QUEST = Q;
  E.questStep = (S) => (S.quest && S.quest.step < Q.length ? Q[S.quest.step] : null);
  E.questProgress = (S) => {
    const q = E.questStep(S); if (!q) return null; const P = S.quest;
    switch (q.t) {
      case "kill": case "harvest": case "craft": case "fm": case "brk": case "bounty": return [Math.min(P.prog, q.n), q.n];
      // 0.1.29.5 : une offrande déjà faite aujourd'hui (avant d'arriver à l'étape) compte aussi
      case "almanax": return [Math.min(Math.max(P.prog, E.almanax(S).done ? 1 : 0), q.n), q.n];
      case "lvl": return [Math.min(topLvl(S), q.n), q.n];
      case "equip": return [Math.min(Math.max(...S.chars.map((c) => Object.keys(c.equip).length)), q.n), q.n];
      case "havre": return [Math.min(E.havreTotal(S), q.n), q.n];
      case "boss": return [S.progress.bossKills[q.dg] ? 1 : 0, 1];
      case "align": return [S.align ? 1 : 0, 1];
    }
    return [0, 1];
  };
  /* Récompenses à thème de la quête principale (en plus des kamas et de l'XP) */
  const QX = {
    0: { lot: "inc_route" }, 1: { cons: "bonbon_sagesse" }, 2: { item: "inc_paturages" }, 3: { lot: "inc_foret" }, 4: { cons: "potion_savoir" },
    5: { key: "grange_tournesol", cons: "bonbon_sagesse" }, 6: { item: "ast_cite" }, 7: { res: [["Bois de Frêne", 20], ["Fer", 20], ["Blé", 15]] }, 8: { cons: "coffre_bois" },
    9: { cons: "fiole_resu" }, 10: { key: "cour_bouftou_royal", furn: "Trophée du Tournesol Affamé", scrolls: true }, 11: { cons: "bonbon_recolteur" }, 12: { cons: "parchemin_avis", n: 2 },
    13: { item: "ast_tainela", furn: "Trophée du Bouftou Royal", cons: "bonbon_sagesse" }, 14: { cons: "coffre_argent" }, 15: { cons: "bonbon_royal" }, 16: { cons: "cristal_fm", n: 2 },
    17: { key: "donjon_bworks", furn: "Trophée du Scarabosse Doré" }, 18: { item: "can_porkass" }, 19: { cons: "fiole_resu", furn: "Trophée de la Bworkette" }, 20: { cons: "coffre_or" },
    21: { furn: "Trophée du Blop Coco Royal", orn: "heros" },
  };
  E.QUEST_EXTRA = QX;
  const rewardItem = (S, sid) => {
    const sub = SUBS[sid]; if (!sub) return null; const top = topLvl(S);
    const pool = [...new Set(sub.monsters.flatMap((k) => (MONSTERS[k].items || []).map(([t]) => t)))].filter((t) => ITEMS[t] && ITEMS[t].lvl <= Math.max(top, 3));
    if (!pool.length) return null; const tpl = pool.sort((a, b) => ITEMS[b].lvl - ITEMS[a].lvl)[Math.floor(rnd() * Math.min(3, pool.length))];
    const it = E.rollItem(S, tpl, { radiant: false }); const T = ITEMS[tpl];
    for (const k in T.stats) { const [a, b] = T.stats[k]; it.stats[k] = Math.max(it.stats[k], Math.round(a + (b - a) * (0.8 + rnd() * 0.2))); }
    return T.name;
  };
  E.questExtraText = (i) => {
    const x = QX[i]; if (!x) return ""; const p = [];
    if (x.key) p.push(DUNGEONS[x.key].key); if (x.item) p.push(`un objet de ${SUBS[x.item] ? SUBS[x.item].name : "la zone"} (bon jet)`);
    if (x.lot) p.push(`ressources de ${SUBS[x.lot] ? SUBS[x.lot].name : "la zone"}`); if (x.res) p.push(x.res.map(([r, q]) => `${q} × ${r}`).join(", "));
    if (x.cons) p.push(`${x.n ? x.n + " × " : ""}${D.CONSUMABLES[x.cons].name}`); if (x.furn) p.push(`meuble « ${x.furn} »`); if (x.scrolls) p.push("un Petit parchemin de chaque caractéristique"); if (x.orn) p.push("un ornement exclusif");
    return p.join(", ");
  };
  const giveQuestExtra = (S, i) => {
    const x = QX[i]; if (!x) return "";
    if (x.key) S.res[DUNGEONS[x.key].key] = (S.res[DUNGEONS[x.key].key] || 0) + 1;
    if (x.item) rewardItem(S, x.item);
    if (x.lot) { const sub = SUBS[x.lot]; const drops = [...new Set(sub.monsters.flatMap((k) => MONSTERS[k].drops.map(([r]) => r)))].slice(0, 3); drops.forEach((r) => (S.res[r] = (S.res[r] || 0) + 6)); }
    if (x.res) x.res.forEach(([r, q]) => (S.res[r] = (S.res[r] || 0) + q));
    if (x.cons) E.addCons(S, x.cons, x.n || 1);
    if (x.furn && !S.furniture.includes(x.furn)) S.furniture.push(x.furn);
    if (x.scrolls) ["fo", "ine", "cha", "age", "vit", "sa"].forEach((k) => E.addCons(S, "parch_" + k + "_p", 1));
    return E.questExtraText(i);
  };
  const questReward = (i) => ({ kamas: 80 + i * 60, xp: 0.35 });
  const checkQuest = (S) => {
    let guard = 0;
    while (guard++ < 5) {
      const q = E.questStep(S); if (!q) return; const [a, b] = E.questProgress(S); if (a < b) return;
      const r = questReward(S.quest.step);
      S.quest = { step: S.quest.step + 1, prog: 0 };
      const ex = giveQuestExtra(S, S.quest.step - 1);
      note(S, `Quête terminée : ${q.title} (+${r.kamas} kamas${ex ? ", " + ex : ""})`, "rare");
      if (S.quest.step >= Q.length) note(S, "Quête principale achevée : vous êtes un Héros d'Amakna !", "rare");
      S.kamas += r.kamas; giveTeamXp(S, r.xp);
    }
  };

  /* ---------------- Quêtes d'alignement (missions renouvelables) ---------------- */
  const newAlignQuest = (S) => {
    if (!S.align) return;
    const top = topLvl(S); const side = ALIGN[S.align.side];
    const subs = Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id) && s.lvl[0] <= top + 2 && s.lvl[1] >= top - 15);
    const pool = subs.length ? subs : Object.values(SUBS).filter((s) => E.subUnlocked(S, s.id));
    const r = rnd();
    const flav = S.align.side === "bonta"
      ? ["Patrouille bontarienne", "Ordre de la Milice", "Protéger les voyageurs", "Mission de l'Ordre"]
      : ["Raid brâkmarien", "Contrat de la Milice noire", "Semer la terreur", "Mission de l'Ordre"];
    const title = flav[Math.floor(rnd() * flav.length)];
    const dgs = Object.keys(DUNGEONS).filter((d) => E.dungeonUnlocked(S, d) && DUNGEONS[d].lvl <= top + 4 && DUNGEONS[d].lvl >= top - 25);
    const axp = 420 + top * 9;
    if (dgs.length && r < 0.2) { const d = dgs[Math.floor(rnd() * dgs.length)]; S.alignQuest = { title, t: "boss", dg: d, n: 1, prog: 0, axp: axp * 1.5, kamas: 300 + top * 25, txt: `Vaincre ${MONSTERS[DUNGEONS[d].boss].name} (${DUNGEONS[d].name}) pour ${side.name}.` }; return; }
    const s = pool[Math.floor(rnd() * pool.length)]; const n = 25 + Math.floor(rnd() * 4) * 10;
    S.alignQuest = { title, t: "kill", sub: s.id, n, prog: 0, axp, kamas: 150 + top * 12, txt: `Éliminer ${n} monstres dans ${s.name} au nom de ${side.name}.` };
  };
  E.newAlignQuest = newAlignQuest;
  const completeAlignQuest = (S) => {
    const q = S.alignQuest; S.alignQuest = null; newAlignQuest(S);
    S.kamas += q.kamas; S.cnt.alignq = (S.cnt.alignq || 0) + 1;
    const ins = q.t === "boss" ? 5 : 3; S.tokens.insignes = (S.tokens.insignes || 0) + ins;
    let extra = ""; if (rnd() < 0.25) { E.addCons(S, "coffre_bois"); extra = ", Coffre en bois"; }
    note(S, `Mission d'alignement accomplie : ${q.title} (+${q.kamas} kamas, +${ins} insignes${extra}).`, "up");
    E.giveAlignXp(S, q.axp);
  };

  /* ---------------- Succès ---------------- */
  const ACH = [];
  const add = (id, cat, name, desc, test, kamas, extra = {}) => ACH.push(Object.assign({ id, cat, name, desc, test, kamas }, extra));
  // 0.1.12 : Renaissance (les titres sont donnés par la renaissance elle-même)
  [[1, "Première renaissance", "Un héros renaît une première fois.", 5000], [5, "Cinq renaissances", "Un héros atteint sa cinquième renaissance.", 25000], [10, "Phénix", "Un héros atteint sa dixième renaissance.", 100000]]
    .forEach(([n, nm, d, k]) => add("ren" + n, "Progression", nm, d, (S) => S.chars.some((c) => (c.ren || 0) >= n), k));
  [10, 20, 30, 40, 50, 60, 70].forEach((l) => add("lvl" + l, "Progression", `Niveau ${l}`, `Un héros atteint le niveau ${l}.`, (S) => topLvl(S) >= l, l * 40, l === 50 ? { title: "le Vétéran" } : {}));
  [[100, ""], [1000, ""], [10000, "Fléau des monstres"]].forEach(([n, t]) => add("win" + n, "Combat", `${n.toLocaleString("fr-FR")} victoires`, `Gagner ${n.toLocaleString("fr-FR")} combats.`, (S) => S.stats.wins >= n, Math.round(Math.sqrt(n) * 60), t ? { title: t } : {}));
  [[1, ""], [10, ""], [25, "Chasseur d'Archis"]].forEach(([n, t]) => add("archi" + n, "Combat", n === 1 ? "Premier archimonstre" : `${n} archimonstres`, `Vaincre ${n} archimonstre${n > 1 ? "s" : ""}.`, (S) => Object.values(S.archis).reduce((a, b) => a + b, 0) >= n, 300 * n, t ? { title: t } : {}));
  [[10, ""], [100, ""], [500, ""], [1000, "Tueur de Champions"]].forEach(([n, t]) => add("champ" + n, "Chasse", `${n.toLocaleString("fr-FR")} Champions`, `Vaincre ${n.toLocaleString("fr-FR")} monstres Champions en chasse.`, (S) => (S.champs || 0) >= n, Math.round(Math.sqrt(n) * 120), t ? { title: t } : {}));
  Object.entries(DUNGEONS).sort((a, b) => a[1].lvl - b[1].lvl).forEach(([id, d]) => add("dg_" + id, "Donjons", d.name, `Vaincre ${MONSTERS[d.boss].name}.`, (S) => !!S.progress.bossKills[id], d.lvl * 30));
  /* 0.1 : un succès par mécanique unique de boss (stasis 5+, aucun héros à terre pendant le combat du boss) */
  Object.entries(E.BOSS_SIGS).forEach(([did, mk]) => { const d = DUNGEONS[did], M = E.BOSS_MECHS[mk]; if (!d || !M) return;
    add("sig_" + did, "Donjons", M.name, `Vaincre ${MONSTERS[d.boss].name} en stasis 5 ou plus sans qu'aucun héros ne tombe pendant le combat du boss.`, (S) => !!(S.sigWins || {})[did], d.lvl * 60, { title: M.title }); });
  add("dg_all", "Donjons", "Maître des donjons", "Vaincre tous les boss de donjon.", (S) => Object.keys(DUNGEONS).every((d) => S.progress.bossKills[d]), 5000, { title: "Maître des donjons" });
  [1, 5, 10].forEach((n) => add("fam" + n, "Chasse", `${n} famille${n > 1 ? "s" : ""}`, `Compléter ${n} famille${n > 1 ? "s" : ""} de monstres (palier Traqueur).`, (S) => Object.keys(S.families).length >= n, 400 * n));
  [1, 10, 25].forEach((n) => add("tro" + n, "Chasse", `${n} trophée${n > 1 ? "s" : ""}`, `Obtenir ${n} trophée${n > 1 ? "s" : ""} de sous-zone.`, (S) => Object.keys(S.trophies).length >= n, 300 * n));
  [[1, ""], [5, "l'Étincelant"]].forEach(([n, t]) => add("rad" + n, "Objets", n === 1 ? "Premier Rayonnant" : `${n} Rayonnants`, `Obtenir ${n} objet${n > 1 ? "s" : ""} Rayonnant${n > 1 ? "s" : ""}.`, (S) => (S.radiants || 0) >= n, 500 * n, t ? { title: t } : {}));
  [[10, ""], [100, ""]].forEach(([n]) => add("craft" + n, "Métiers", `${n} fabrications`, `Fabriquer ${n} objets.`, (S) => (S.cnt.craft || 0) >= n, 20 * n));
  [[1000, ""], [10000, "Main verte"]].forEach(([n, t]) => add("harv" + n, "Métiers", `${n.toLocaleString("fr-FR")} récoltes`, `Récolter ${n.toLocaleString("fr-FR")} ressources.`, (S) => (S.cnt.harvest || 0) >= n, Math.round(n / 2), t ? { title: t } : {}));
  [[1, ""], [50, "Forgemage"]].forEach(([n, t]) => add("fm" + n, "Forgemagie", n === 1 ? "Première forgemagie" : `${n} forgemagies`, `Tenter ${n} forgemagie${n > 1 ? "s" : ""}.`, (S) => (S.cnt.fm || 0) >= n, 50 * n, t ? { title: t } : {}));
  [[1, ""], [10, "le Perfectionniste"]].forEach(([n, t]) => add("parf" + n, "Forgemagie", n === 1 ? "Premier objet Parfait" : `${n} objets Parfaits`, `Posséder ${n} objet${n > 1 ? "s" : ""} Parfait${n > 1 ? "s" : ""} (toutes les caractéristiques au jet maximum).`, (S) => E.perfectCount(S) >= n, 800 * n, t ? { title: t } : {}));
  add("fmjob100", "Forgemagie", "Grand Forgemage", "Un métier de forgemagie au niveau 100.", (S) => E.fmTop(S) >= 100, 5000, { title: "Grand Forgemage" });
  add("fmjob200", "Forgemagie", "Maître Forgemage", "Un métier de forgemagie au niveau 200.", (S) => E.fmTop(S) >= 200, 20000, { title: "Maître Forgemage" });
  add("fmtrans", "Forgemagie", "Transcendance", "Transcender un objet avec une rune de transcendance.", (S) => (S.cnt.trans || 0) >= 1, 10000);
  add("exo1", "Forgemagie", "Exotique", "Réussir une forgemagie exotique (+1 PA, PM ou Portée).", (S) => (S.cnt.exo || 0) >= 1, 10000, { title: "l'Exotique" });
  add("exopa", "Forgemagie", "Un PA de plus", "Porter un objet exo PA.", (S) => S.chars.some((c) => Object.values(c.equip).some((u) => S.items[u] && S.items[u].exo === "pa")), 20000);
  add("prot1", "Métiers", "Gardien des récoltes", "Vaincre un protecteur de ressources.", (S) => (S.cnt.prot || 0) >= 1, 2000);
  add("prot25", "Métiers", "Fléau des protecteurs", "Vaincre 25 protecteurs de ressources.", (S) => (S.cnt.prot || 0) >= 25, 10000, { title: "Fléau des protecteurs" });
  add("fmplan10", "Forgemagie", "Forgemagie automatique", "10 plans de forgemagie terminés avec leurs objectifs atteints.", (S) => (S.cnt.fmPlanOk || 0) >= 10, 3000);
  [[1, ""], [7, ""], [30, "Dévot d'Almanax"]].forEach(([n, t]) => add("alm" + n, "Quêtes", `${n} offrande${n > 1 ? "s" : ""}`, `Faire ${n} offrande${n > 1 ? "s" : ""} à l'Almanax.`, (S) => (S.cnt.almanax || 0) >= n, 150 * n, t ? { title: t } : {}));
  [[10, ""], [50, "Chasseur de primes"]].forEach(([n, t]) => add("bty" + n, "Quêtes", `${n} avis de recherche`, `Remplir ${n} avis de recherche.`, (S) => (S.cnt.bounty || 0) >= n, 80 * n, t ? { title: t } : {}));
  add("mainq", "Quêtes", "Héros d'Amakna", "Terminer la quête principale.", (S) => S.quest && S.quest.step >= Q.length, 8000, { title: "Héros d'Amakna" });
  add("align", "Alignement", "Le choix d'un camp", "Choisir Bonta ou Brâkmar.", (S) => !!S.align, 500);
  [1, 2, 3, 4, 5].forEach((r) => add("arank" + r, "Alignement", `Rang d'alignement ${r}`, `Atteindre le niveau d'alignement ${r * 20}.`, (S) => E.alignRankIdx(S) >= r, 600 * r, r === 5 ? { title: "Légende de la cité" } : {}));
  [[10, ""], [50, ""]].forEach(([n]) => add("havre" + n, "Havre-Sac", `Havre-Sac ×${n}`, `Acheter ${n} améliorations du Havre-Sac.`, (S) => E.havreTotal(S) >= n, 100 * n));
  [2, 4, 8].forEach((n) => add("team" + n, "Progression", `${n} héros`, `Avoir ${n} héros.`, (S) => S.chars.length >= n, 250 * n));
  /* 0.1.10 : idoles */
  add("idol1", "Idoles", "Première idole", "Fabriquer une idole chez le Bricoleur.", (S) => (S.cnt.idols || 0) >= 1, 500);
  add("idol12", "Idoles", "Douze idoles", "Posséder 12 idoles.", (S) => (S.cnt.idols || 0) >= 12, 2000);
  add("idol36", "Idoles", "Collection complète", "Posséder les 36 idoles.", (S) => (S.cnt.idols || 0) >= 36, 10000, { title: "l'Idolâtre" });
  add("idolsix", "Idoles", "Six statuettes", "Gagner un combat avec 6 idoles actives.", (S) => (S.cnt.idolSix || 0) >= 1, 1500);
  add("idol100", "Idoles", "Score 100", "Gagner un combat avec un score d'idoles de 100 ou plus.", (S) => (S.cnt.idolBest || 0) >= 100, 5000, { title: "le Téméraire" });
  add("idol200", "Idoles", "Score 200", "Gagner un combat avec un score d'idoles de 200 ou plus.", (S) => (S.cnt.idolBest || 0) >= 200, 20000, { title: "Maître des idoles" });
  /* 0.1.13 : archimonstres et Dofus */
  [[1, "Première âme", "Capturer l'âme d'un archimonstre avec une Pierre d'âme.", 500, ""], [25, "25 âmes", "Capturer 25 âmes d'archimonstres.", 2500, ""], [100, "100 âmes", "Capturer 100 âmes d'archimonstres.", 10000, "Chasseur d'âmes"], [205, "L'album complet", "Capturer l'âme de tous les archimonstres.", 50000, ""]]
    .forEach(([n, nm, d, k, t]) => add("soul" + n, "Archimonstres", nm, d, (S) => (S.cnt.souls || 0) >= (n === 205 ? E.ARCHI_TOTAL || n : n), k, t ? { title: t } : {}));
  add("dofus1", "Archimonstres", "Premier Dofus", "Obtenir un Dofus.", (S) => (S.cnt.dofus || 0) >= 1, 2000);
  add("dofus6", "Archimonstres", "Six Dofus portés", "Un héros porte 6 Dofus en même temps.", (S) => S.chars.some((c) => Object.values(c.equip).filter((u) => S.items[u] && ITEMS[S.items[u].tpl] && ITEMS[S.items[u].tpl].dofus).length >= 6), 10000, { title: "Porteur de Dofus" });
  add("dofus18", "Archimonstres", "Gardien des Dofus", "Obtenir les 18 Dofus.", (S) => (S.cnt.dofus || 0) >= 18, 100000, { title: "Gardien des Dofus" });
  E.ACH = ACH;
  const checkAch = (S) => {
    ACH.forEach((a) => {
      if (S.ach[a.id]) return;
      if (!a.test(S)) return;
      S.ach[a.id] = E.now(); S.kamas += a.kamas;
      note(S, `Succès : ${a.name}${a.title ? ` — titre « ${a.title} »` : ""} (+${a.kamas.toLocaleString("fr-FR")} kamas)`, "rare");
    });
  };
  E.checkAch = checkAch;
  E.titles = (S) => ACH.filter((a) => a.title && S.ach[a.id]).map((a) => a.title).concat(S.titlesExtra || []);
  E.setTitle = (S, cid, t) => { const c = S.chars.find((x) => x.id === cid); if (!c) return; c.title = t && E.titles(S).includes(t) ? t : null; };

  /* ---------------- Branchements sur les événements du moteur ---------------- */
  const prevEmit = E.emit;
  let depth = 0;
  E.emit = (S, type, data) => {
    if (prevEmit) prevEmit(S, type, data);
    if (!S.cnt) return;
    if (depth > 3) return;
    depth++;
    try { onEvent(S, type, data); } finally { depth--; }
  };
  const onEvent = (S, type, data) => {
    const q = E.questStep(S);
    checkFurn(S, type, data);
    if (type === "win") {
      data.mons.forEach((m) => {
        if (q && q.t === "kill" && data.sub === q.sub) S.quest.prog++;
        (S.bounties || []).forEach((b) => { if (!b.dg && b.key === m.key && b.prog < b.n) b.prog++; });
        const aq = S.alignQuest; if (aq && aq.t === "kill" && data.sub === aq.sub && aq.prog < aq.n) aq.prog++;
      });
    }
    if (type === "dungeon") {
      const dg = DUNGEONS[data.id];
      (S.bounties || []).forEach((b) => { if (b.dg === data.id && b.prog < b.n) b.prog++; });
      const aq = S.alignQuest; if (aq && aq.t === "boss" && aq.dg === data.id) aq.prog = 1;
      if (S.align) E.giveAlignXp(S, Math.round(dg.lvl * 2));
    }
    if (type === "harvest") { S.cnt.harvest = (S.cnt.harvest || 0) + data.n; if (q && q.t === "harvest") S.quest.prog += data.n; }
    if (type === "craft") { S.cnt.craft = (S.cnt.craft || 0) + 1; if (q && q.t === "craft") S.quest.prog++; }
    if (type === "fm" && q && q.t === "fm") S.quest.prog++;
    if (type === "brk" && q && q.t === "brk") S.quest.prog++;
    if (type === "bounty" && q && q.t === "bounty") S.quest.prog++;
    if (type === "almanax" && q && q.t === "almanax") S.quest.prog++;
    // avis remplis
    if (S.bounties) { const done = S.bounties.filter((b) => b.prog >= b.n); if (done.length) { S.bounties = S.bounties.filter((b) => b.prog < b.n); done.forEach((b) => completeBounty(S, b)); fillBounties(S); } }
    if (S.alignQuest && S.alignQuest.prog >= S.alignQuest.n) completeAlignQuest(S);
    // ornement des flammes
    if (!S.ornSeen.flammes && S.chars.some((c) => E.radiantWorn(S, c) >= 3)) { S.ornSeen.flammes = 1; note(S, "Ornement débloqué : Flammes Rayonnantes !", "rare"); }
    // limites de stock : le surplus part au marchand de secours (30 % de l.ancien prix)
    if (type === "win" || type === "harvest") for (const n in S.resCap) { const ex = (S.res[n] || 0) - S.resCap[n]; if (ex > 0) E.merchantRes(S, n, ex); }
    checkQuest(S);
    if (type !== "harvest" || (S._achT || 0) + 1500 < E.now()) { S._achT = E.now(); checkAch(S); }
  };
  E.refreshSystems = (S) => { initState(S); fillBounties(S); if (S.align && !S.alignQuest) newAlignQuest(S); checkQuest(S); if (E.refreshArchis) E.refreshArchis(S); checkAch(S); };

  /* ---------------- État ---------------- */
  const initState = (S) => {
    for (const k of ["havre", "ach", "cnt", "ornSeen", "almanax"]) if (!S[k] || typeof S[k] !== "object") S[k] = {};
    if (!S.quest) S.quest = { step: 0, prog: 0 };
    if (!Array.isArray(S.bounties)) S.bounties = [];
    if (S.align === undefined) S.align = null;
    if (S.alignQuest === undefined) S.alignQuest = null;
    if (!S.tools) S.tools = {};
    for (const k of ["tokens", "unlocks", "almStreak", "resCap", "resSeen", "resFav", "resT"]) if (!S[k] || typeof S[k] !== "object") S[k] = {};
    if (!Array.isArray(S.over)) S.over = []; // 0.1.37 : Coffre de trop-plein
    if (!S.almStreak.n) S.almStreak.n = 0;
    for (const k of ["titlesExtra", "furniture", "shop"]) if (!Array.isArray(S[k])) S[k] = [];
    // Havre-Sac 4.0
    if (!S.placed || typeof S.placed !== "object") S.placed = {};
    for (const r in S.placed) S.placed[r] = (S.placed[r] || []).filter((n) => FURN[n] && FURN[n].room === r && S.furniture.includes(n)).slice(0, E.roomSlots(S, r));
    if (!S.atelier || typeof S.atelier !== "object") S.atelier = { built: false, cid: null, rec: null, prog: 0, made: 0 };
    if (S.training === undefined) S.training = null;
    // trophées déjà mérités (stasis 5 passée avant le Havre-Sac 4.0)
    for (const did in S.stasis || {}) { const t = E.trophyOf(did); if (t && S.stasis[did].max >= E.TROPHY_STASIS && !S.furniture.includes(t)) S.furniture.push(t); }
  };
  const baseNew = E.newState;
  E.newState = (name, cls) => { const S = baseNew(name, cls); initState(S); fillBounties(S); return S; };
  const baseDes = E.deserialize;
  E.deserialize = (txt) => {
    const raw = JSON.parse(txt); const oldV = raw.v || 1;
    const S = baseDes(txt);
    initState(S);
    if (oldV < 4) {
      S.settings.theme = "dark";
      S.chars.forEach((c) => { if (c.job === undefined) c.job = null; });
      // anciennes cibles de récolte par métier : abandonnées (la récolte se fait maintenant par héros)
      for (const j in S.jobs) { delete S.jobs[j].target; delete S.jobs[j].prog; }
      (S.migration = S.migration || []).push("v2.6 : thème Krosmoz, Havre-Sac, forgemagie, Almanax, quêtes, avis de recherche, succès, alignement, récolte par héros, combat manuel, Amakna et Cania (6 nouveaux donjons).");
      // succès déjà mérités : pas de pluie de kamas rétroactive
      ACH.forEach((a) => { if (a.test(S)) S.ach[a.id] = 1; });
    }
    if (oldV < 5) {
      S.chars.forEach((c) => { if (c.job && c.job.sub) delete c.job.sub; });
      if (S.settings.auto && S.settings.auto.recycle === undefined) S.settings.auto.recycle = false;
      (S.migration = S.migration || []).push("v2.7 : progression plus rapide jusqu'au niveau 60, objets et ressources plus rares, Synergie d'équipe, outils fabriqués, filons, nouveaux consommables et coffres, récompenses de quêtes, Bureau des primes, sac et forgemagie réorganisés.");
    }
    // Havre-Sac 3.4 : les meubles déjà gagnés sont placés d'office, tant qu'il reste de la place
    if (raw.placed === undefined) S.furniture.forEach((n) => { if (FURN[n]) E.placeFurn(S, n); });
    fillBounties(S); if (S.align && !S.alignQuest) newAlignQuest(S);
    // 0.1.29.5 : étape « Dévotion » coincée alors que l'offrande du jour est faite : validée au chargement
    { const q = E.questStep(S); if (q && q.t === "almanax") checkQuest(S); }
    return S;
  };

  /* 0.1.10.1 : compositions d'équipe (jusqu'à 3, qui joue, rangées, cible prioritaire) */
  E.COMP_MAX = 3;
  E.compOf = (S) => { const T = E.team(S); const fs = E.frontSet(S); const rows = {}; T.forEach((c) => (rows[c.id] = fs.has(c.id) ? "f" : "b"));
    return { ids: T.map((c) => c.id), rows, auto: E.isAutoPlace(S), focus: (S.settings && S.settings.focus) || "auto" }; };
  E.compMatch = (S) => { const ids = E.team(S).map((c) => c.id).sort().join(","); return (S.comps || []).findIndex((k) => k && k.ids.slice().sort().join(",") === ids); };
  E.saveComp = (S, i, name) => {
    S.comps = S.comps || []; if (i == null || i < 0) i = S.comps.length;
    if (i >= E.COMP_MAX) return "Trois compositions au maximum : remplacez-en une.";
    if (!E.team(S).length) return "L'équipe est vide.";
    const old = S.comps[i]; S.comps[i] = Object.assign(E.compOf(S), { name: (name || (old && old.name) || `Composition ${i + 1}`).slice(0, 24) });
    return null;
  };
  E.delComp = (S, i) => { if (!S.comps || !S.comps[i]) return; S.comps.splice(i, 1); Object.keys(S.compDg || {}).forEach((d) => { if (S.compDg[d] === i) delete S.compDg[d]; else if (S.compDg[d] > i) S.compDg[d]--; }); };
  /* applique une composition : les héros prévus quittent la récolte, l'entraînement ou l'atelier ; renvoie une erreur ou { moved } */
  E.applyComp = (S, i) => {
    const K = (S.comps || [])[i]; if (!K) return { err: "Composition introuvable." };
    if (S.dungeon) return { err: "Impossible de changer l'équipe en donjon." };
    const ids = K.ids.filter((id) => S.chars.some((c) => c.id === id)).slice(0, 8);
    if (!ids.length) return { err: "Plus aucun héros de cette composition." };
    const moved = [];
    S.chars.forEach((c) => {
      const want = ids.includes(c.id);
      if (want) {
        if (c.job) { c.job = null; moved.push(c.name); }
        if (S.training === c.id) { S.training = null; moved.push(c.name); }
        if (E.atelierHero(S) === c) { E.setAtelier(S, null); moved.push(c.name); }
      }
      c.inTeam = want;
    });
    if (K.auto) S.placeAuto = true; else { S.placeAuto = false; E.team(S).forEach((c) => (c.row = K.rows[c.id] === "f" ? "f" : "b")); }
    S.settings.focus = K.focus || "auto"; S.fight = null;
    return { moved: [...new Set(moved)] };
  };
  /* retenir la composition gagnante d'un donjon, pour la suggérer dans sa fiche */
  E.compWin = (S, did) => { const i = E.compMatch(S); if (i >= 0) (S.compDg = S.compDg || {})[did] = i; };

  root.SYSTEMS = true;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
