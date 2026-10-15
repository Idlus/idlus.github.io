/* ============================================================================
   LES RELIQUES DE L'ASCENSION — Idlus (1.2.x). Demande de Mathis (15/10) : « drop des équipements uniques au mode de jeu »,
   réponses 1A (reliques de montée), 2 (tous les 5 étages), 3B (6 emplacements), 4A (caractéristiques + effet unique), 5A (Reliquaire),
   6A (pas de refonte), puis « un pool de reliques encore et des effets inédits, chaque item animé selon la rareté ».
   - 240 reliques propres à la tour (40 par emplacement : Arme, Coiffe, Cape, Anneau, Amulette, Bottes ; 18 communes, 14 rares,
     8 légendaires), vrais visuels d'objets DOFUS (assets/i). Chacune : une ligne de caractéristiques et un effet unique.
   - Tous les 5 étages, après le sort du palier : 3 reliques de 3 emplacements différents, on en garde 1 (ou on passe). La rareté
     monte avec l'étage (5-25 : 70/30/0 ; 30-55 : 50/40/10 ; 60-100 : 30/45/25 ; Au-delà : 20/45/35). Une relique par emplacement :
     une nouvelle Arme remplace l'Arme portée. Le marchand en vend 2 (40 / 80 / 160 Fragments de la montée).
   - L'Au-delà (étage 101 et au-delà) : 6 reliques de départ après les 8 sorts de départ, puis une tous les 5 étages comme dans la tour.
   - Perdues à la fin de la montée, comme les sorts et les glyphes. En auto, la tour prend la meilleure rareté (emplacement vide d'abord).
   - Le Reliquaire garde toutes les reliques trouvées, montée après montée : titre « Reliquaire » à 15, cadre « Cadre de la Tour »
     à 50, ornement « Sceau du Reliquaire » à 100, titre « Maître du Reliquaire » et aura chromatique à 240. Rien ne rend plus fort
     hors de la tour.
   - Dans la tour : Vitalité = PV (× (1 + niveau / 40)), Puissance = Puissance (× (1 + niveau / 80)), Dégâts = % de dégâts,
     Esquive = chance d'éviter un coup (½ % par point), PM = +5 % d'esquive chacun (le grimpeur ne se déplace pas), Sagesse = % de Fragments.
   Branché sur js/ascension.js (ascSetup, roundFx, dieFx, ascApply, paliers, marchand, auto) et sur le hook de dégâts E.legPre du
   moteur. Les effets ne touchent que les combats de la tour (F.asc). Pas de DOM : l'interface est dans js/ascensionui.js.
   ========================================================================== */
(function (root) {
  "use strict";
  const D = root.DATA || require("./data.js");
  const E = root.ENGINE || require("./engine.js");
  if (!E.ascState) return;
  const { MONSTERS } = D; const A = E.ASC;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (str) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return (x ^ (x >>> 13)) >>> 0; };
  const seeded = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickOf = (a, r) => a[Math.floor(r() * a.length)];

  /* ---------- les 240 reliques ---------- */
  /* { id, slot, r (c/r/l), n, ic (objet DOFUS, assets/i), st { vit pui dmg esq sa pa pm }, fx { k, … }, d (l'effet en clair) } */
  const RELICS = E.ASC_RELICS = [
    {id:"dague-ebrechee",slot:"arme",r:"c",n:"Dague ébréchée",ic:8034,st:{dmg:8},fx:{k:"dmgFirstCast",v:30},d:"Ton premier sort du combat fait +30 %"},
    {id:"baton-du-novice",slot:"arme",r:"c",n:"Bâton du Novice",ic:183016,st:{vit:40},fx:{k:"so",v:10},d:"Tes soins font +10 %"},
    {id:"arc-du-braconnier",slot:"arme",r:"c",n:"Arc du Braconnier",ic:8048,st:{dmg:8},fx:{k:"dmgFull",v:15},d:"+15 % de dégâts sur les monstres à pleine vie"},
    {id:"epee-rouillee",slot:"arme",r:"c",n:"Épée rouillée",ic:8033,st:{dmg:6},fx:{k:"healCrit",v:2},d:"Chaque coup critique te rend 2 % de tes PV"},
    {id:"marteau-lourd",slot:"arme",r:"c",n:"Marteau lourd",ic:19039,st:{dmg:14},fx:{k:"paFirst",v:-1},d:"−1 PA au premier tour de chaque combat"},
    {id:"baguette-de-seve",slot:"arme",r:"c",n:"Baguette de Sève",ic:4097,fx:{k:"dmgEl",el:"t",v:15},d:"Tes sorts de Terre font +15 %"},
    {id:"pelle-rituelle",slot:"arme",r:"c",n:"Pelle rituelle",ic:4079,fx:{k:"dmgEl",el:"n",v:15},d:"Tes sorts Neutres font +15 %"},
    {id:"hache-du-bucheron",slot:"arme",r:"c",n:"Hache du Bûcheron",ic:19043,st:{dmg:10},fx:{k:"dmgBoss",v:-10},d:"−10 % de dégâts contre les boss"},
    {id:"dagues-jumelles",slot:"arme",r:"c",n:"Dagues jumelles",ic:8072,st:{dmg:5},fx:{k:"dmgSecond",v:15},d:"Ton deuxième sort du tour fait +15 %"},
    {id:"arc-court",slot:"arme",r:"c",n:"Arc court",ic:4080,st:{dmg:6},fx:{k:"dmgOdd",v:10},d:"+10 % de dégâts aux tours impairs"},
    {id:"baton-tordu",slot:"arme",r:"c",n:"Bâton tordu",ic:3049,st:{vit:30},fx:{k:"paTurn",v:1,heal:1},d:"Si ta barre a un sort de soin, +1 PA par tour"},
    {id:"epee-de-bois",slot:"arme",r:"c",n:"Épée de bois",ic:8018,fx:{k:"dmgLowSelf",v:20},d:"+20 % de dégâts quand tu es sous 30 % de PV"},
    {id:"fouet-du-dompteur",slot:"arme",r:"c",n:"Fouet du Dompteur",ic:6047,fx:{k:"recDmg",v:15},d:"Tes recrues et invocations font +15 %"},
    {id:"faux-rouillee",slot:"arme",r:"c",n:"Faux rouillée",ic:4022,st:{dmg:8},fx:{k:"paKill",v:1},d:"Tuer un monstre te donne +1 PA au tour suivant"},
    {id:"lame-du-vertige",slot:"arme",r:"r",n:"Lame du Vertige",ic:3045,st:{dmg:15},fx:{k:"paTurn",v:1},d:"Ton premier sort de chaque tour coûte 1 PA de moins"},
    {id:"faux-moissonneuse",slot:"arme",r:"r",n:"Faux Moissonneuse",ic:20025,st:{dmg:12},fx:{k:"paKill",v:2},d:"Tuer un monstre te donne +2 PA au tour suivant"},
    {id:"arc-celeste",slot:"arme",r:"r",n:"Arc Céleste",ic:2058,st:{dmg:8},fx:{k:"dmgEl",el:"a",v:25},d:"Tes sorts d'Air font +25 %"},
    {id:"baton-de-braise",slot:"arme",r:"r",n:"Bâton de Braise",ic:7056,st:{dmg:8},fx:{k:"dmgEl",el:"f",v:25},d:"Tes sorts de Feu font +25 %"},
    {id:"sceptre-des-marees",slot:"arme",r:"r",n:"Sceptre des Marées",ic:4048,st:{dmg:8},fx:{k:"dmgEl",el:"e",v:25},d:"Tes sorts d'Eau font +25 %"},
    {id:"marteau-sismique",slot:"arme",r:"r",n:"Marteau Sismique",ic:2020,st:{dmg:8},fx:{k:"dmgEl",el:"t",v:25},d:"Tes sorts de Terre font +25 %"},
    {id:"epee-du-duelliste",slot:"arme",r:"r",n:"Épée du Duelliste",ic:19067,st:{dmg:10},fx:{k:"dmgLast",v:30},d:"+30 % de dégâts quand il ne reste qu'un monstre"},
    {id:"dague-du-chasseur",slot:"arme",r:"r",n:"Dague du Chasseur",ic:3002,st:{dmg:10},fx:{k:"dmgLow",v:25},d:"+25 % de dégâts sur les monstres sous 30 % de PV"},
    {id:"baton-du-guerisseur",slot:"arme",r:"r",n:"Bâton du Guérisseur",ic:2094,st:{vit:80},fx:{k:"healCast",v:1},d:"Chaque sort offensif te rend 1 % de tes PV"},
    {id:"arc-du-patient",slot:"arme",r:"r",n:"Arc du Patient",ic:2052,st:{dmg:5},fx:{k:"dmgPerTurn",v:5,max:30},d:"+5 % de dégâts par tour écoulé (max +30 %)"},
    {id:"epee-du-grimpeur",slot:"arme",r:"l",n:"Épée du Grimpeur",ic:5049,st:{dmg:25},fx:{k:"pa",v:1},d:"+1 PA"},
    {id:"marteau-de-la-dizaine",slot:"arme",r:"l",n:"Marteau de la Dizaine",ic:2046,st:{dmg:20},fx:{k:"dmgBoss",v:40},d:"Les boss subissent +40 % de dégâts"},
    {id:"lame-jumelle",slot:"arme",r:"l",n:"Lame Jumelle",ic:8047,st:{dmg:10},fx:{k:"echoHit",v:30},d:"Chaque sort offensif est relancé à 30 % de puissance"},
    {id:"baton-des-quatre-vents",slot:"arme",r:"l",n:"Bâton des Quatre Vents",ic:6074,st:{dmg:12},fx:{k:"ignoreRes"},d:"Tes sorts ignorent les résistances des monstres"},
    {id:"faux-de-l-ascete",slot:"arme",r:"l",n:"Faux de l'Ascète",ic:8008,st:{dmg:15},fx:{k:"paKill",v:3,heal:5},d:"Tuer un monstre te rend 5 % de tes PV et +3 PA au tour suivant"},
    {id:"arc-du-sommet",slot:"arme",r:"l",n:"Arc du Sommet",ic:4108,st:{dmg:18},fx:{k:"dmgFirstCast",v:50,free:1},d:"Ton premier sort du combat fait +50 % et te rend ses PA"},
    {id:"chapeau-de-paille",slot:"coiffe",r:"c",n:"Chapeau de Paille",ic:16051,st:{vit:80}},
    {id:"bandeau-use",slot:"coiffe",r:"c",n:"Bandeau usé",ic:16172,st:{vit:50},fx:{k:"so",v:5},d:"Tes soins font +5 %"},
    {id:"casque-de-bouftou",slot:"coiffe",r:"c",n:"Casque de Bouftou",ic:16271,st:{vit:120},fx:{k:"dmg",v:-5},d:"−5 % de dégâts"},
    {id:"coiffe-de-laine",slot:"coiffe",r:"c",n:"Coiffe de Laine",ic:16150,st:{vit:40},fx:{k:"recHealFloor",v:10},d:"Tes recrues récupèrent 10 % de PV à chaque étage gagné"},
    {id:"capuche-trouee",slot:"coiffe",r:"c",n:"Capuche trouée",ic:16506,st:{vit:60},fx:{k:"cri",v:5},d:"+5 % de chance de coup critique"},
    {id:"bonnet-de-nuit",slot:"coiffe",r:"c",n:"Bonnet de Nuit",ic:16204,st:{vit:40},fx:{k:"regen",v:1},d:"Te rend 1 % de tes PV à chaque début de tour"},
    {id:"heaume-fendu",slot:"coiffe",r:"c",n:"Heaume fendu",ic:16016,st:{vit:150},fx:{k:"pm",v:-1},d:"−1 PM"},
    {id:"chapeau-du-sage",slot:"coiffe",r:"c",n:"Chapeau du Sage",ic:16042,st:{sa:10},fx:{k:"glyphPow",v:25},d:"Tes sorts à glyphe font +8 % de dégâts"},
    {id:"casque-de-cuir",slot:"coiffe",r:"c",n:"Casque de Cuir",ic:16610,st:{vit:70},fx:{k:"resFirst",v:10},d:"−10 % de dégâts subis au premier tour"},
    {id:"couronne-de-fleurs",slot:"coiffe",r:"c",n:"Couronne de fleurs",ic:16069,st:{vit:50},fx:{k:"recHp",v:20},d:"Tes recrues gagnent +20 % de PV"},
    {id:"capuche-de-voleur",slot:"coiffe",r:"c",n:"Capuche de Voleur",ic:16361,st:{vit:30},fx:{k:"frag",v:10},d:"+10 % de Fragments"},
    {id:"bonnet-de-tofu",slot:"coiffe",r:"c",n:"Bonnet de Tofu",ic:16205,st:{vit:60},fx:{k:"pmFirst",v:1},d:"+1 PM au premier tour"},
    {id:"chapeau-pointu",slot:"coiffe",r:"c",n:"Chapeau pointu",ic:16350,st:{vit:40},fx:{k:"dmgEl",el:"f",v:10},d:"Tes sorts de Feu font +10 %"},
    {id:"coiffe-du-pecheur",slot:"coiffe",r:"c",n:"Coiffe du Pêcheur",ic:16041,st:{vit:40},fx:{k:"dmgEl",el:"e",v:10},d:"Tes sorts d'Eau font +10 %"},
    {id:"capuche-du-veilleur",slot:"coiffe",r:"r",n:"Capuche du Veilleur",ic:16009,st:{vit:120},fx:{k:"recHealFloor",v:25},d:"Tes recrues récupèrent 25 % de PV à chaque étage gagné"},
    {id:"couronne-de-ronces",slot:"coiffe",r:"r",n:"Couronne de Ronces",ic:16001,st:{vit:80},fx:{k:"reflect",v:10},d:"Renvoie 10 % des dégâts subis"},
    {id:"masque-du-dopeul",slot:"coiffe",r:"r",n:"Masque du Dopeul",ic:16142,st:{vit:60},fx:{k:"sigPow",v:25},d:"Ton sort signature fait +25 %"},
    {id:"coiffe-du-sage",slot:"coiffe",r:"r",n:"Coiffe du Sage",ic:16140,st:{sa:20},fx:{k:"glyphPow",v:50},d:"Tes sorts à glyphe font +15 % de dégâts"},
    {id:"casque-royal",slot:"coiffe",r:"r",n:"Casque Royal",ic:16031,st:{vit:220}},
    {id:"heaume-du-rempart",slot:"coiffe",r:"r",n:"Heaume du Rempart",ic:16451,st:{vit:120},fx:{k:"res",v:10},d:"−10 % de dégâts subis"},
    {id:"capuche-des-brumes",slot:"coiffe",r:"r",n:"Capuche des Brumes",ic:16335,st:{vit:80},fx:{k:"dodge",v:10},d:"10 % de chance d'esquiver chaque coup"},
    {id:"diademe-vital",slot:"coiffe",r:"r",n:"Diadème Vital",ic:16359,st:{vit:100},fx:{k:"so",v:20},d:"Tes soins font +20 %"},
    {id:"casque-du-dompteur",slot:"coiffe",r:"r",n:"Casque du Dompteur",ic:16376,st:{vit:80},fx:{k:"recHp",v:40},d:"Tes recrues gagnent +40 % de PV"},
    {id:"chapeau-de-fete",slot:"coiffe",r:"r",n:"Chapeau de Fête",ic:16044,st:{vit:60},fx:{k:"frag",v:20},d:"+20 % de Fragments"},
    {id:"couronne-de-l-ascete",slot:"coiffe",r:"l",n:"Couronne de l'Ascète",ic:16612,st:{vit:300},fx:{k:"shieldStart",v:20},d:"Tu commences chaque combat avec un bouclier de 20 % de tes PV"},
    {id:"heaume-du-sursis",slot:"coiffe",r:"l",n:"Heaume du Sursis",ic:16133,st:{vit:150},fx:{k:"survive"},d:"Une fois par étage, le coup qui te tue te laisse à 1 PV"},
    {id:"coiffe-des-echos",slot:"coiffe",r:"l",n:"Coiffe des Échos",ic:16194,st:{vit:120},fx:{k:"echoDouble"},d:"Tes Échos de classe comptent double"},
    {id:"masque-du-mimique",slot:"coiffe",r:"l",n:"Masque du Mimique",ic:16284,st:{vit:100},fx:{k:"resBoss",v:15},d:"Les boss te font −15 % de dégâts"},
    {id:"couronne-du-sommet",slot:"coiffe",r:"l",n:"Couronne du Sommet",ic:16055,st:{vit:200},fx:{k:"paFirst",v:1,pm:1},d:"+1 PA et +1 PM au premier tour de chaque combat"},
    {id:"diademe-de-l-au-dela",slot:"coiffe",r:"l",n:"Diadème de l'Au-delà",ic:16256,st:{vit:180},fx:{k:"recHealFloor",v:100},d:"Tes recrues reviennent à tous leurs PV à chaque étage gagné"},
    {id:"cape-de-toile",slot:"cape",r:"c",n:"Cape de Toile",ic:17395,st:{esq:10}},
    {id:"manteau-rapiece",slot:"cape",r:"c",n:"Manteau rapiécé",ic:17217,st:{vit:40,esq:5}},
    {id:"cape-mouillee",slot:"cape",r:"c",n:"Cape mouillée",ic:17073,fx:{k:"resEl",el:"f",v:20},d:"−20 % de dégâts de Feu subis"},
    {id:"cape-seche",slot:"cape",r:"c",n:"Cape sèche",ic:17342,fx:{k:"resEl",el:"e",v:20},d:"−20 % de dégâts d'Eau subis"},
    {id:"cape-terreuse",slot:"cape",r:"c",n:"Cape terreuse",ic:17265,fx:{k:"resEl",el:"t",v:20},d:"−20 % de dégâts de Terre subis"},
    {id:"cape-venteuse",slot:"cape",r:"c",n:"Cape venteuse",ic:17076,fx:{k:"resEl",el:"a",v:20},d:"−20 % de dégâts d'Air subis"},
    {id:"cape-de-bure",slot:"cape",r:"c",n:"Cape de Bure",ic:17200,st:{pm:1,vit:-30}},
    {id:"cape-du-marcheur",slot:"cape",r:"c",n:"Cape du Marcheur",ic:17224,fx:{k:"pmFirst",v:1},d:"+1 PM au premier tour"},
    {id:"cape-de-plumes",slot:"cape",r:"c",n:"Cape de Plumes",ic:81069,st:{esq:5},fx:{k:"dodgeFirst",v:10},d:"10 % de chance d'esquiver le premier coup reçu de chaque tour"},
    {id:"cape-du-pillard",slot:"cape",r:"c",n:"Cape du Pillard",ic:17368,fx:{k:"frag",v:15},d:"+15 % de Fragments"},
    {id:"cape-chaude",slot:"cape",r:"c",n:"Cape chaude",ic:17379,st:{vit:40},fx:{k:"recHealEnd",v:10},d:"Tes recrues récupèrent 10 % de PV à la fin de chaque combat"},
    {id:"cape-du-dresseur",slot:"cape",r:"c",n:"Cape du Dresseur",ic:17054,fx:{k:"recHealFloor",v:10},d:"Tes recrues gardent 10 % de PV de plus entre les étages"},
    {id:"cape-de-cuir",slot:"cape",r:"c",n:"Cape de Cuir",ic:17187,st:{vit:60},fx:{k:"resNonBoss",v:5},d:"−5 % de dégâts subis des monstres non boss"},
    {id:"cape-du-tacle",slot:"cape",r:"c",n:"Cape du Tacle",ic:17327,fx:{k:"monPaFirst",v:1},d:"Les monstres manquent de PA au premier tour"},
    {id:"cape-de-brume",slot:"cape",r:"r",n:"Cape de Brume",ic:17151,st:{esq:15},fx:{k:"dodgeFirst",v:20},d:"20 % de chance d'esquiver le premier coup reçu de chaque tour"},
    {id:"cape-du-marchand",slot:"cape",r:"r",n:"Cape du Marchand",ic:17048,fx:{k:"shopDisc",v:25},d:"Les offres du marchand coûtent 25 % de moins"},
    {id:"cape-d-ombre",slot:"cape",r:"r",n:"Cape d'Ombre",ic:17173,fx:{k:"recHp",v:30},d:"Tes recrues et invocations gagnent +30 % de PV"},
    {id:"cape-plumee",slot:"cape",r:"r",n:"Cape plumée",ic:81003,st:{pm:1}},
    {id:"cape-du-tacleur",slot:"cape",r:"r",n:"Cape du Tacleur",ic:17082,fx:{k:"monDmg",v:-10},d:"Les monstres font −10 % de dégâts"},
    {id:"cape-de-l-alchimiste",slot:"cape",r:"r",n:"Cape de l'Alchimiste",ic:16298,st:{vit:60},fx:{k:"shopMore",v:1},d:"Le marchand propose une offre de plus"},
    {id:"cape-de-glace",slot:"cape",r:"r",n:"Cape de Glace",ic:17105,fx:{k:"monPaHit"},d:"Le monstre qui te frappe perd 1 PA (une fois par tour)"},
    {id:"cape-du-veilleur",slot:"cape",r:"r",n:"Cape du Veilleur",ic:17525,st:{vit:80},fx:{k:"resBoss",v:15},d:"−15 % de dégâts subis des boss"},
    {id:"cape-etoilee",slot:"cape",r:"r",n:"Cape étoilée",ic:17399,fx:{k:"cd",v:-1},d:"Tes sorts relancent un tour plus tôt"},
    {id:"cape-de-l-echo",slot:"cape",r:"r",n:"Cape de l'Écho",ic:17276,fx:{k:"otherCls",v:10},d:"Les sorts des autres classes font +10 %"},
    {id:"cape-de-la-tour",slot:"cape",r:"l",n:"Cape de la Tour",ic:17113,st:{vit:100},fx:{k:"res",v:15},d:"−15 % de tous les dégâts subis"},
    {id:"cape-du-phenix",slot:"cape",r:"l",n:"Cape du Phénix",ic:17005,fx:{k:"recRevive",v:50},d:"À chaque étage, une recrue morte revient avec la moitié de ses PV"},
    {id:"cape-miroir",slot:"cape",r:"l",n:"Cape Miroir",ic:17081,fx:{k:"reflect",v:25},d:"Renvoie 25 % des dégâts subis"},
    {id:"cape-du-temps",slot:"cape",r:"l",n:"Cape du Temps",ic:17075,st:{pm:1},fx:{k:"paEvery",n:3,v:2},d:"Un tour sur trois, +2 PA"},
    {id:"cape-du-pelerin",slot:"cape",r:"l",n:"Cape du Pèlerin",ic:17172,st:{vit:60},fx:{k:"shopCashback",v:20},d:"Le marchand te rend 20 % de ce que tu dépenses"},
    {id:"cape-du-sommet",slot:"cape",r:"l",n:"Cape du Sommet",ic:17293,st:{vit:60},fx:{k:"pa",v:1,pm:1,dmg:-20},d:"+1 PA et +1 PM, −20 % de dégâts"},
    {id:"anneau-de-cuivre",slot:"anneau",r:"c",n:"Anneau de Cuivre",ic:9394,st:{pui:5}},
    {id:"anneau-des-echos",slot:"anneau",r:"c",n:"Anneau des Échos",ic:9204,st:{pui:8},fx:{k:"otherCls",v:5},d:"Les sorts des autres classes font +5 %"},
    {id:"anneau-du-pillard",slot:"anneau",r:"c",n:"Anneau du Pillard",ic:9186,fx:{k:"frag",v:20},d:"+20 % de Fragments"},
    {id:"anneau-fendu",slot:"anneau",r:"c",n:"Anneau fendu",ic:9236,st:{pui:3},fx:{k:"frag",v:10},d:"+10 % de Fragments"},
    {id:"anneau-du-rat",slot:"anneau",r:"c",n:"Anneau du Rat",ic:9051,fx:{k:"fragKill",v:1},d:"+1 Fragment par monstre tué"},
    {id:"bague-d-os",slot:"anneau",r:"c",n:"Bague d'Os",ic:9052,fx:{k:"dmgHurt",v:10},d:"+10 % de dégâts sur les monstres blessés"},
    {id:"alliance-simple",slot:"anneau",r:"c",n:"Alliance simple",ic:9062,st:{vit:30,pui:3}},
    {id:"anneau-de-fer-blanc",slot:"anneau",r:"c",n:"Anneau de Fer-blanc",ic:9123,fx:{k:"paFirst",v:1},d:"+1 PA au premier tour de chaque combat"},
    {id:"anneau-du-novice",slot:"anneau",r:"c",n:"Anneau du Novice",ic:9363,st:{pui:5},fx:{k:"paFirst",v:1,sig:1},d:"+1 PA au premier tour si ton sort signature est dans ta barre"},
    {id:"anneau-de-sel",slot:"anneau",r:"c",n:"Anneau de Sel",ic:9412,fx:{k:"soulTurns",v:1},d:"Ton âme de boss se bat 1 tour de plus"},
    {id:"chevaliere-usee",slot:"anneau",r:"c",n:"Chevalière usée",ic:9155,st:{pui:4},fx:{k:"cri",v:5},d:"+5 % de chance de coup critique"},
    {id:"anneau-de-corde",slot:"anneau",r:"c",n:"Anneau de Corde",ic:9009,fx:{k:"shopGlyph",v:50},d:"Les glyphes du marchand coûtent moitié prix"},
    {id:"anneau-du-vagabond",slot:"anneau",r:"c",n:"Anneau du Vagabond",ic:9387,fx:{k:"mercDisc",v:50},d:"Les mercenaires coûtent moitié prix"},
    {id:"anneau-de-bois",slot:"anneau",r:"c",n:"Anneau de Bois",ic:9225,st:{vit:20,pui:2}},
    {id:"anneau-du-dompteur",slot:"anneau",r:"r",n:"Anneau du Dompteur",ic:9227,st:{vit:40},fx:{k:"recDmg",v:25},d:"Tes recrues font +25 % de dégâts"},
    {id:"anneau-glyphique",slot:"anneau",r:"r",n:"Anneau Glyphique",ic:9400,fx:{k:"glyphMax",v:3},d:"Un glyphe de plus par sort (3 au lieu de 2)"},
    {id:"anneau-du-sursis",slot:"anneau",r:"r",n:"Anneau du Sursis",ic:9277,fx:{k:"sursis",v:1},d:"+1 Sursis quand tu l'équipes (une fois)"},
    {id:"anneau-du-temps",slot:"anneau",r:"r",n:"Anneau du Temps",ic:9081,fx:{k:"cd",v:-1},d:"Tes sorts relancent 1 tour plus tôt"},
    {id:"anneau-de-fer",slot:"anneau",r:"r",n:"Anneau de Fer",ic:9365,fx:{k:"paFirst",v:1},d:"+1 PA au premier tour de chaque combat"},
    {id:"anneau-du-collectionneur",slot:"anneau",r:"r",n:"Anneau du Collectionneur",ic:9294,st:{pui:5},fx:{k:"pickMore",v:4},d:"Les paliers proposent 4 sorts au lieu de 3"},
    {id:"anneau-du-negociant",slot:"anneau",r:"r",n:"Anneau du Négociant",ic:9358,fx:{k:"shopFrag",v:30},d:"+30 Fragments à chaque marchand"},
    {id:"anneau-de-braise",slot:"anneau",r:"r",n:"Anneau de Braise",ic:9085,st:{pui:8},fx:{k:"dotEl",el:"f",v:1},d:"Tes sorts de Feu brûlent 1 tour de plus"},
    {id:"anneau-de-l-ame",slot:"anneau",r:"r",n:"Anneau de l'Âme",ic:9110,fx:{k:"soulTurns",v:2},d:"Ton âme capturée dure 2 tours de plus"},
    {id:"anneau-d-argent",slot:"anneau",r:"r",n:"Anneau d'Argent",ic:9403,st:{pui:12}},
    {id:"anneau-de-l-au-dela",slot:"anneau",r:"l",n:"Anneau de l'Au-delà",ic:9094,st:{pui:8},fx:{k:"every",v:3},d:"Un nouveau sort tous les 3 étages au lieu de 5"},
    {id:"anneau-des-ames",slot:"anneau",r:"l",n:"Anneau des Âmes",ic:9195,fx:{k:"soulBig",turns:5,pow:0.75},d:"Tes âmes capturées durent 5 tours à 75 % de puissance"},
    {id:"anneau-du-grimpeur",slot:"anneau",r:"l",n:"Anneau du Grimpeur",ic:9147,st:{pui:10},fx:{k:"pa",v:1,pm:1,frag:-30},d:"+1 PA et +1 PM, mais −30 % de Fragments"},
    {id:"anneau-du-destin",slot:"anneau",r:"l",n:"Anneau du Destin",ic:9158,fx:{k:"reroll"},d:"Chaque palier te laisse relancer une fois les 3 propositions"},
    {id:"anneau-de-l-ascete",slot:"anneau",r:"l",n:"Anneau de l'Ascète",ic:9114,st:{pui:15},fx:{k:"paBar",v:1,n:4},d:"+1 PA tant que ta barre a au moins 4 sorts"},
    {id:"anneau-du-sommet",slot:"anneau",r:"l",n:"Anneau du Sommet",ic:9098,st:{pui:20},fx:{k:"dmgPerFloor",v:2,max:40},d:"Chaque étage gagné te donne +2 % de dégâts jusqu'à la fin de la montée (max +40 %)"},
    {id:"amulette-de-corde",slot:"amulette",r:"c",n:"Amulette de Corde",ic:1023,st:{vit:40}},
    {id:"amulette-de-l-ascete",slot:"amulette",r:"c",n:"Amulette de l'Ascète",ic:1298,st:{vit:60},fx:{k:"healCast",v:1},d:"+1 % de tes PV rendu par sort lancé"},
    {id:"pendentif-de-bouftou",slot:"amulette",r:"c",n:"Pendentif de Bouftou",ic:1140,st:{vit:30,pui:3}},
    {id:"collier-de-dents",slot:"amulette",r:"c",n:"Collier de dents",ic:1131,fx:{k:"dmgHurt",v:8},d:"+8 % de dégâts sur les monstres blessés"},
    {id:"amulette-de-seve",slot:"amulette",r:"c",n:"Amulette de Sève",ic:1227,st:{vit:40},fx:{k:"dmgEl",el:"t",v:10},d:"Tes sorts de Terre font +10 %"},
    {id:"amulette-de-braise",slot:"amulette",r:"c",n:"Amulette de Braise",ic:1141,st:{vit:40},fx:{k:"dmgEl",el:"f",v:10},d:"Tes sorts de Feu font +10 %"},
    {id:"amulette-d-ecume",slot:"amulette",r:"c",n:"Amulette d'Écume",ic:1244,st:{vit:40},fx:{k:"dmgEl",el:"e",v:10},d:"Tes sorts d'Eau font +10 %"},
    {id:"amulette-de-brise",slot:"amulette",r:"c",n:"Amulette de Brise",ic:1284,st:{vit:40},fx:{k:"dmgEl",el:"a",v:10},d:"Tes sorts d'Air font +10 %"},
    {id:"medaillon-du-pillard",slot:"amulette",r:"c",n:"Médaillon du Pillard",ic:1165,fx:{k:"frag",v:10},d:"+10 % de Fragments"},
    {id:"amulette-du-veilleur",slot:"amulette",r:"c",n:"Amulette du Veilleur",ic:1303,st:{vit:50},fx:{k:"recHealEnd",v:15},d:"Tes recrues récupèrent 15 % de PV à la fin de chaque combat"},
    {id:"collier-de-plumes",slot:"amulette",r:"c",n:"Collier de Plumes",ic:1096,st:{esq:5}},
    {id:"amulette-du-dompteur",slot:"amulette",r:"c",n:"Amulette du Dompteur",ic:1042,fx:{k:"recHp",v:15},d:"Tes recrues gagnent +15 % de PV"},
    {id:"talisman-fele",slot:"amulette",r:"c",n:"Talisman fêlé",ic:1071,st:{pui:5,vit:-20}},
    {id:"amulette-de-cuivre",slot:"amulette",r:"c",n:"Amulette de Cuivre",ic:1125,st:{vit:20,pui:2}},
    {id:"amulette-des-echos",slot:"amulette",r:"r",n:"Amulette des Échos",ic:1278,st:{vit:60},fx:{k:"otherCls",v:10},d:"Les sorts des autres classes font +10 %"},
    {id:"talisman-du-sursis",slot:"amulette",r:"r",n:"Talisman du Sursis",ic:1331,st:{vit:80},fx:{k:"sursisPa",v:2},d:"Quand tu perds un Sursis, le combat suivant commence avec +2 PA"},
    {id:"amulette-glyphique",slot:"amulette",r:"r",n:"Amulette Glyphique",ic:1044,fx:{k:"glyphPow",v:50},d:"Tes sorts à glyphe font +15 % de dégâts"},
    {id:"collier-du-patient",slot:"amulette",r:"r",n:"Collier du Patient",ic:1155,st:{vit:60},fx:{k:"dmgPerTurn",v:2,max:20},d:"+2 % de dégâts par tour écoulé (max +20 %)"},
    {id:"amulette-de-jade",slot:"amulette",r:"r",n:"Amulette de Jade",ic:1116,st:{vit:120,pui:6}},
    {id:"medaillon-du-boss",slot:"amulette",r:"r",n:"Médaillon du Boss",ic:1112,st:{vit:40},fx:{k:"resBoss",v:15},d:"−15 % de dégâts subis des boss"},
    {id:"amulette-de-l-ame",slot:"amulette",r:"r",n:"Amulette de l'Âme",ic:1009,fx:{k:"soulCd",v:-1},d:"Ton âme capturée revient 1 tour plus tôt"},
    {id:"pendentif-du-marchand",slot:"amulette",r:"r",n:"Pendentif du Marchand",ic:1149,fx:{k:"shopRelics",v:2},d:"Le marchand propose 2 reliques de plus"},
    {id:"amulette-de-cristal",slot:"amulette",r:"r",n:"Amulette de Cristal",ic:1238,st:{vit:80},fx:{k:"cri",v:10},d:"+10 % de chance de coup critique"},
    {id:"collier-d-epines",slot:"amulette",r:"r",n:"Collier d'Épines",ic:1258,st:{vit:40},fx:{k:"reflect",v:8},d:"Renvoie 8 % des dégâts subis"},
    {id:"amulette-du-grimpeur",slot:"amulette",r:"l",n:"Amulette du Grimpeur",ic:1136,st:{vit:150},fx:{k:"pa",v:1},d:"+1 PA"},
    {id:"cur-de-la-tour",slot:"amulette",r:"l",n:"Cœur de la Tour",ic:1037,st:{vit:200},fx:{k:"so",v:40},d:"Tes soins font +40 %"},
    {id:"amulette-des-quatre",slot:"amulette",r:"l",n:"Amulette des Quatre",ic:1027,st:{vit:100},fx:{k:"dmg",v:15},d:"Tes quatre éléments font +15 %"},
    {id:"talisman-de-l-au-dela",slot:"amulette",r:"l",n:"Talisman de l'Au-delà",ic:1097,st:{vit:120},fx:{k:"recHealFloor",v:100},d:"Tes recrues reviennent à tous leurs PV à chaque étage gagné"},
    {id:"amulette-du-destin",slot:"amulette",r:"l",n:"Amulette du Destin",ic:1156,st:{vit:80},fx:{k:"pickMore",v:5,relics:5},d:"Les paliers proposent 5 sorts et 5 reliques au lieu de 3"},
    {id:"collier-du-sommet",slot:"amulette",r:"l",n:"Collier du Sommet",ic:1212,st:{vit:180},fx:{k:"dmg",v:10,res:10},d:"+10 % de dégâts et −10 % de dégâts subis"},
    {id:"sandales-de-corde",slot:"bottes",r:"c",n:"Sandales de Corde",ic:11377,st:{pm:1,vit:-20}},
    {id:"bottes-de-cuir",slot:"bottes",r:"c",n:"Bottes de Cuir",ic:11019,st:{vit:40}},
    {id:"bottes-du-marcheur",slot:"bottes",r:"c",n:"Bottes du Marcheur",ic:11010,fx:{k:"pmFirst",v:1},d:"+1 PM au premier tour"},
    {id:"bottes-du-pillard",slot:"bottes",r:"c",n:"Bottes du Pillard",ic:11280,fx:{k:"frag",v:10},d:"+10 % de Fragments"},
    {id:"bottes-crottees",slot:"bottes",r:"c",n:"Bottes crottées",ic:11214,st:{vit:30,esq:3}},
    {id:"sabots-de-bouftou",slot:"bottes",r:"c",n:"Sabots de Bouftou",ic:11184,st:{vit:60,esq:-3}},
    {id:"bottes-du-coureur",slot:"bottes",r:"c",n:"Bottes du Coureur",ic:11011,fx:{k:"ini"},d:"Tu joues avant les monstres au premier tour"},
    {id:"bottes-de-seve",slot:"bottes",r:"c",n:"Bottes de Sève",ic:11383,fx:{k:"dmgEl",el:"t",v:10},d:"Tes sorts de Terre font +10 %"},
    {id:"bottes-de-braise",slot:"bottes",r:"c",n:"Bottes de Braise",ic:11041,fx:{k:"dmgEl",el:"f",v:10},d:"Tes sorts de Feu font +10 %"},
    {id:"bottes-d-ecume",slot:"bottes",r:"c",n:"Bottes d'Écume",ic:11284,fx:{k:"dmgEl",el:"e",v:10},d:"Tes sorts d'Eau font +10 %"},
    {id:"bottes-de-brise",slot:"bottes",r:"c",n:"Bottes de Brise",ic:11037,fx:{k:"dmgEl",el:"a",v:10},d:"Tes sorts d'Air font +10 %"},
    {id:"pantoufles",slot:"bottes",r:"c",n:"Pantoufles",ic:11188,st:{vit:40},fx:{k:"regen",v:1},d:"Te rend 1 % de tes PV à chaque début de tour"},
    {id:"bottes-du-dompteur",slot:"bottes",r:"c",n:"Bottes du Dompteur",ic:11076,fx:{k:"recIni"},d:"Tes recrues jouent avant les monstres"},
    {id:"bottes-trouees",slot:"bottes",r:"c",n:"Bottes trouées",ic:11040,st:{esq:5,vit:-10}},
    {id:"bottes-de-la-dizaine",slot:"bottes",r:"r",n:"Bottes de la Dizaine",ic:11267,st:{pm:1},fx:{k:"dmgNoSursis",v:10},d:"Tant que tu n'as pas perdu de Sursis : +10 % de dégâts"},
    {id:"bottes-de-brume",slot:"bottes",r:"r",n:"Bottes de Brume",ic:11325,st:{esq:10},fx:{k:"dodge",v:10},d:"10 % de chance d'esquiver chaque coup"},
    {id:"bottes-du-tacle",slot:"bottes",r:"r",n:"Bottes du Tacle",ic:11221,fx:{k:"monDmg",v:-10},d:"Les monstres font −10 % de dégâts"},
    {id:"bottes-ailees",slot:"bottes",r:"r",n:"Bottes ailées",ic:11025,st:{pm:1,esq:5}},
    {id:"bottes-du-veilleur",slot:"bottes",r:"r",n:"Bottes du Veilleur",ic:11073,st:{vit:80},fx:{k:"res",v:10},d:"−10 % de dégâts subis"},
    {id:"bottes-du-patient",slot:"bottes",r:"r",n:"Bottes du Patient",ic:11201,fx:{k:"paFrom",n:3,v:1},d:"+1 PA à partir du 3e tour"},
    {id:"bottes-de-jade",slot:"bottes",r:"r",n:"Bottes de Jade",ic:11211,st:{vit:100,pui:4}},
    {id:"bottes-du-negociant",slot:"bottes",r:"r",n:"Bottes du Négociant",ic:11048,fx:{k:"shopDisc",v:15},d:"Les offres du marchand coûtent 15 % de moins"},
    {id:"bottes-du-collectionneur",slot:"bottes",r:"r",n:"Bottes du Collectionneur",ic:11279,fx:{k:"relicUp"},d:"Les reliques proposées sont d'une rareté au-dessus (max légendaire)"},
    {id:"bottes-de-glace",slot:"bottes",r:"r",n:"Bottes de Glace",ic:11044,fx:{k:"monPaHit"},d:"Le monstre qui te frappe perd 1 PA (une fois par tour)"},
    {id:"bottes-du-grimpeur",slot:"bottes",r:"l",n:"Bottes du Grimpeur",ic:11246,st:{pm:2}},
    {id:"bottes-du-sommet",slot:"bottes",r:"l",n:"Bottes du Sommet",ic:11017,st:{pa:1,pm:1}},
    {id:"bottes-de-l-au-dela",slot:"bottes",r:"l",n:"Bottes de l'Au-delà",ic:11297,st:{vit:100},fx:{k:"paDoubleFirst"},d:"Au premier tour de chaque combat, tes PA sont doublés"},
    {id:"bottes-du-phenix",slot:"bottes",r:"l",n:"Bottes du Phénix",ic:11344,st:{vit:80},fx:{k:"phoenix",v:50},d:"Une fois par montée, ta mort te ramène à 50 % de tes PV sans perdre de Sursis"},
    {id:"bottes-du-pelerin",slot:"bottes",r:"l",n:"Bottes du Pèlerin",ic:11008,st:{pm:1},fx:{k:"volFloor",v:1},d:"Chaque étage gagné te rend 1 Volonté"},
    {id:"bottes-des-quatre-vents",slot:"bottes",r:"l",n:"Bottes des Quatre Vents",ic:11228,st:{pm:1},fx:{k:"dmgAfterDodge",v:50},d:"Après une esquive, ton prochain sort fait +50 %"},
    {id:"dague-du-parieur",slot:"arme",r:"c",n:"Dague du Parieur",ic:4065,st:{dmg:5},fx:{k:"gamble",up:25,down:10},d:"À chaque combat, pile ou face : +25 % ou −10 % de dégâts"},
    {id:"hache-de-l-echo",slot:"arme",r:"c",n:"Hache de l'Écho",ic:8001,fx:{k:"chain",v:20},d:"Un monstre tué inflige 20 % de ses PV max au monstre suivant"},
    {id:"dague-empoisonnee",slot:"arme",r:"c",n:"Dague empoisonnée",ic:8004,fx:{k:"poison",v:3},d:"Tes coups empoisonnent : 3 % des PV max de la cible pendant 2 tours"},
    {id:"marteau-du-tresorier",slot:"arme",r:"c",n:"Marteau du Trésorier",ic:6030,fx:{k:"critFrag",v:1},d:"Chaque coup critique rapporte 1 Fragment"},
    {id:"lame-vampire",slot:"arme",r:"r",n:"Lame Vampire",ic:19038,st:{dmg:8},fx:{k:"drain",v:10},d:"Tes dégâts te rendent 10 % de leur valeur en PV"},
    {id:"epee-du-berserk",slot:"arme",r:"r",n:"Épée du Berserk",ic:5033,fx:{k:"berserk",max:50},d:"+1 % de dégâts par 1 % de PV manquant (max +50 %)"},
    {id:"baton-du-chaos",slot:"arme",r:"r",n:"Bâton du Chaos",ic:19035,st:{dmg:5},fx:{k:"chaosEl",v:40},d:"À chaque tour, un élément au hasard fait +40 %"},
    {id:"faux-du-pacte",slot:"arme",r:"r",n:"Faux du Pacte",ic:22012,fx:{k:"pacte",v:40,hp:4},d:"+40 % de dégâts, mais tu perds 4 % de tes PV à chaque tour"},
    {id:"lame-du-glouton",slot:"arme",r:"l",n:"Lame du Glouton",ic:4113,st:{dmg:10},fx:{k:"glutton",hp:1,heal:5,max:30},d:"Tuer un monstre te rend 5 % de tes PV et +1 % de PV max jusqu'à la fin de la montée (max +30 %)"},
    {id:"marteau-explosif",slot:"arme",r:"l",n:"Marteau Explosif",ic:22006,st:{dmg:15},fx:{k:"explode",v:20},d:"Un monstre tué explose : 20 % de ses PV max aux autres monstres"},
    {id:"casque-du-second-souffle",slot:"coiffe",r:"c",n:"Casque du Second Souffle",ic:16755,st:{vit:60},fx:{k:"secondWind",heal:20,pa:3},d:"La première fois sous 50 % de PV : +20 % de PV et +3 PA au tour suivant"},
    {id:"bonnet-du-tresorier",slot:"coiffe",r:"c",n:"Bonnet du Trésorier",ic:16191,st:{vit:40},fx:{k:"treasure",v:50},d:"+50 Fragments par boss vaincu"},
    {id:"coiffe-de-l-il",slot:"coiffe",r:"c",n:"Coiffe de l'Œil",ic:16003,st:{vit:50},fx:{k:"eyeBoss",v:10},d:"Tu vois les PV cachés par le Brouillard, et +10 % de dégâts sur les boss"},
    {id:"chapeau-du-veilleur-de-nuit",slot:"coiffe",r:"c",n:"Chapeau du Veilleur de nuit",ic:16011,st:{vit:60},fx:{k:"volFloor",v:1,n:10},d:"Tous les 10 étages gagnés, +1 Volonté"},
    {id:"heaume-de-fragments",slot:"coiffe",r:"r",n:"Heaume de Fragments",ic:16395,st:{vit:80},fx:{k:"fragArmor",v:30,cost:2},d:"Chaque coup reçu fait −30 % et te coûte 2 Fragments de la montée"},
    {id:"couronne-du-reliquaire",slot:"coiffe",r:"r",n:"Couronne du Reliquaire",ic:16475,st:{vit:60},fx:{k:"reliquaireBonus",per:10,max:20},d:"+1 % de dégâts par 10 reliques dans ton Reliquaire (max +20 %)"},
    {id:"masque-du-dernier-souffle",slot:"coiffe",r:"r",n:"Masque du Dernier Souffle",ic:16057,st:{vit:80},fx:{k:"lastStand",v:15},d:"Quand une recrue meurt, +15 % de dégâts jusqu'à la fin du combat"},
    {id:"diademe-de-jouvence",slot:"coiffe",r:"r",n:"Diadème de Jouvence",ic:16115,st:{vit:100},fx:{k:"shieldKill",v:5},d:"Tuer un monstre te donne un bouclier de 5 % de tes PV max"},
    {id:"couronne-de-l-echange",slot:"coiffe",r:"l",n:"Couronne de l'Échange",ic:16195,st:{vit:150},fx:{k:"swap"},d:"Au 3e tour, tu échanges tes PV (en %) avec le monstre le plus en forme"},
    {id:"heaume-du-sacrifice",slot:"coiffe",r:"l",n:"Heaume du Sacrifice",ic:16197,st:{vit:120},fx:{k:"dmgShare",v:30},d:"Tes recrues encaissent 30 % des dégâts que tu reçois"},
    {id:"cape-du-totem",slot:"cape",r:"c",n:"Cape du Totem",ic:17392,fx:{k:"totem",hp:30,dmg:50},d:"Un Tofu se bat à tes côtés à chaque combat (30 % de tes PV)"},
    {id:"cape-de-contre",slot:"cape",r:"c",n:"Cape de Contre",ic:17017,st:{esq:5},fx:{k:"counter",v:20},d:"Quand tu esquives, le monstre perd 20 % de ses PV max"},
    {id:"cape-du-leve-tot",slot:"cape",r:"c",n:"Cape du Lève-tôt",ic:17223,fx:{k:"ini",rec:1},d:"Toi et tes recrues jouez avant les monstres"},
    {id:"cape-de-sable",slot:"cape",r:"c",n:"Cape de Sable",ic:17479,st:{vit:30},fx:{k:"monPaFirst",v:3},d:"Au premier tour, les monstres manquent de PA et frappent à peine"},
    {id:"cape-du-jumeau",slot:"cape",r:"r",n:"Cape du Jumeau",ic:17669,fx:{k:"clone"},d:"Ta première recrue est dupliquée à chaque combat"},
    {id:"cape-de-la-rancune",slot:"cape",r:"r",n:"Cape de la Rancune",ic:17213,st:{vit:40},fx:{k:"woundMore",v:20},d:"Si tu perds, les monstres gardent 20 % de blessures de plus"},
    {id:"cape-du-colporteur",slot:"cape",r:"r",n:"Cape du Colporteur",ic:17363,fx:{k:"shopAfterBoss"},d:"Un marchand t'attend après chaque boss"},
    {id:"cape-de-l-horloge",slot:"cape",r:"r",n:"Cape de l'Horloge",ic:17254,st:{vit:40},fx:{k:"paFrom",n:5,v:2},d:"+2 PA à partir du 5e tour"},
    {id:"cape-de-l-ame-fidele",slot:"cape",r:"l",n:"Cape de l'Âme Fidèle",ic:17012,st:{vit:60},fx:{k:"soulAlways"},d:"Chaque boss vaincu te propose son âme, et elle se bat 1 tour de plus"},
    {id:"cape-du-prophete",slot:"cape",r:"l",n:"Cape du Prophète",ic:17150,st:{vit:80},fx:{k:"nextLeg"},d:"La première relique de ta prochaine montée sera légendaire"},
    {id:"anneau-du-change",slot:"anneau",r:"c",n:"Anneau du Change",ic:9374,fx:{k:"ecus",v:20},d:"20 % de tes Fragments gagnés tombent aussi en Écus"},
    {id:"anneau-de-patience",slot:"anneau",r:"c",n:"Anneau de Patience",ic:9330,st:{pui:3},fx:{k:"relicPity",n:3},d:"Après 3 paliers sans relique légendaire, la suivante l'est"},
    {id:"anneau-du-forgeron",slot:"anneau",r:"c",n:"Anneau du Forgeron",ic:9079,st:{pui:4},fx:{k:"fragHp",cost:10,v:1,max:30},d:"À chaque étage gagné, 10 Fragments deviennent +1 % de PV max (max +30 %)"},
    {id:"anneau-du-mercenaire",slot:"anneau",r:"c",n:"Anneau du Mercenaire",ic:9253,fx:{k:"mercFree"},d:"Les mercenaires te suivent gratuitement"},
    {id:"anneau-du-de",slot:"anneau",r:"r",n:"Anneau du Dé",ic:9015,st:{pui:6},fx:{k:"dice"},d:"À chaque combat, un bonus au hasard : +2 PA, +30 % de dégâts, bouclier de 25 % ou +1 PM"},
    {id:"anneau-de-la-meute",slot:"anneau",r:"r",n:"Anneau de la Meute",ic:9106,st:{pui:5},fx:{k:"recDmgPer",v:15},d:"+15 % de dégâts pour tes recrues par recrue vivante"},
    {id:"anneau-du-soigneur",slot:"anneau",r:"r",n:"Anneau du Soigneur",ic:9066,st:{pui:4},fx:{k:"recHealCast",v:5},d:"Chaque sort que tu lances soigne tes recrues de 5 %"},
    {id:"anneau-d-ambre",slot:"anneau",r:"r",n:"Anneau d'Ambre",ic:9088,st:{pui:8},fx:{k:"dmgFirstTurn",v:40},d:"+40 % de dégâts au premier tour de chaque combat"},
    {id:"anneau-de-l-avare",slot:"anneau",r:"l",n:"Anneau de l'Avare",ic:9014,st:{pui:10},fx:{k:"fragDmg",per:100,v:1,max:25},d:"+1 % de dégâts par 100 Fragments gardés dans la montée (max +25 %)"},
    {id:"anneau-du-double",slot:"anneau",r:"l",n:"Anneau du Double",ic:9313,st:{pui:12},fx:{k:"doubleCast",p:20},d:"20 % de chance que ton sort soit lancé deux fois"},
    {id:"amulette-du-sablier",slot:"amulette",r:"c",n:"Amulette du Sablier",ic:1098,st:{vit:40},fx:{k:"monPaFirst",v:2},d:"Au premier tour, les monstres perdent 2 PA"},
    {id:"amulette-de-rancune",slot:"amulette",r:"c",n:"Amulette de Rancune",ic:1224,st:{vit:40},fx:{k:"dmgAfterHit",v:15},d:"Après avoir été frappé, ton prochain sort fait +15 %"},
    {id:"amulette-du-glaneur",slot:"amulette",r:"c",n:"Amulette du Glaneur",ic:1262,st:{vit:30},fx:{k:"fragKill",v:2},d:"+2 Fragments par monstre tué"},
    {id:"amulette-de-veille",slot:"amulette",r:"c",n:"Amulette de Veille",ic:1320,st:{vit:50},fx:{k:"regenLow",v:3},d:"Sous 30 % de PV, tu récupères 3 % de PV par tour"},
    {id:"amulette-du-miroir",slot:"amulette",r:"r",n:"Amulette du Miroir",ic:1091,st:{vit:60},fx:{k:"reflectBoss",v:30},d:"Renvoie 30 % des dégâts des boss"},
    {id:"amulette-d-ivoire",slot:"amulette",r:"r",n:"Amulette d'Ivoire",ic:1115,st:{vit:80},fx:{k:"shieldTurn",v:5},d:"À chaque début de tour, un bouclier de 5 % de tes PV"},
    {id:"amulette-du-pese-ame",slot:"amulette",r:"r",n:"Amulette du Pèse-âme",ic:1025,st:{vit:60},fx:{k:"dmgVsSummon",v:50},d:"+50 % de dégâts sur les invocations des monstres, et tes invocations +25 %"},
    {id:"amulette-de-l-appel",slot:"amulette",r:"r",n:"Amulette de l'Appel",ic:1314,st:{vit:60},fx:{k:"recStart",v:1},d:"Chaque combat commence avec une recrue de plus, pour ce combat seulement"},
    {id:"amulette-du-temps-vole",slot:"amulette",r:"l",n:"Amulette du Temps Volé",ic:1153,st:{vit:120},fx:{k:"paLast",v:3},d:"+3 PA tant qu'il ne reste qu'un monstre"},
    {id:"cur-de-fragments",slot:"amulette",r:"l",n:"Cœur de Fragments",ic:1052,st:{vit:100},fx:{k:"fragRevive",cost:100},d:"Si tu meurs avec 100 Fragments, ils te ramènent à 50 % de tes PV (une fois par combat)"},
    {id:"bottes-du-deserteur",slot:"bottes",r:"c",n:"Bottes du Déserteur",ic:11134,st:{esq:4},fx:{k:"fleeLow",v:10},d:"Sous 25 % de PV, +10 % d'esquive"},
    {id:"bottes-de-l-eclaireur",slot:"bottes",r:"c",n:"Bottes de l'Éclaireur",ic:11141,fx:{k:"fragFloor",v:5},d:"+5 Fragments à chaque étage gagné"},
    {id:"bottes-de-plomb",slot:"bottes",r:"c",n:"Bottes de Plomb",ic:11052,st:{vit:80},fx:{k:"monPaFirst",v:1,self:1},d:"Les monstres perdent 1 PA au premier tour, toi aussi"},
    {id:"bottes-sautillantes",slot:"bottes",r:"c",n:"Bottes Sautillantes",ic:11083,st:{esq:6},fx:{k:"dodgeOdd",v:15},d:"Aux tours impairs, +15 % d'esquive"},
    {id:"bottes-du-charognard",slot:"bottes",r:"r",n:"Bottes du Charognard",ic:11318,fx:{k:"healKill",v:8},d:"Tuer un monstre te rend 8 % de tes PV"},
    {id:"bottes-de-foudre",slot:"bottes",r:"r",n:"Bottes de Foudre",ic:11258,st:{pm:1},fx:{k:"dmgEl",el:"a",v:15},d:"Tes sorts d'Air font +15 %"},
    {id:"bottes-du-fossoyeur",slot:"bottes",r:"r",n:"Bottes du Fossoyeur",ic:11138,fx:{k:"recReviveFight",v:30},d:"La première recrue qui meurt dans un combat revient avec 30 % de ses PV"},
    {id:"bottes-du-pisteur",slot:"bottes",r:"r",n:"Bottes du Pisteur",ic:11232,st:{esq:5},fx:{k:"dmgLow",v:20},d:"+20 % de dégâts sur les monstres sous 30 % de PV"},
    {id:"bottes-de-mercure",slot:"bottes",r:"l",n:"Bottes de Mercure",ic:11096,st:{pm:1},fx:{k:"paEvery",n:2,v:1},d:"Un tour sur deux, +1 PA"},
    {id:"bottes-du-funambule",slot:"bottes",r:"l",n:"Bottes du Funambule",ic:11276,st:{esq:10},fx:{k:"dodgeAll",v:25,res:-15},d:"25 % de chance d'esquiver chaque coup, mais +15 % de dégâts subis"},
  ];
  const BY = {}; RELICS.forEach((x) => (BY[x.id] = x));
  E.relById = (id) => BY[id] || null;
  E.RELICS = RELICS; // 1.2.5.4 : liste pour les codes cadeaux (Reliquaire)
  E.REL_SLOTS = ["arme", "coiffe", "cape", "anneau", "amulette", "bottes"];
  E.REL_SLOT_NAME = { arme: "Arme", coiffe: "Coiffe", cape: "Cape", anneau: "Anneau", amulette: "Amulette", bottes: "Bottes" };
  E.REL_RAR = { c: { name: "Commune", price: 40, w: 0 }, r: { name: "Rare", price: 80, w: 1 }, l: { name: "Légendaire", price: 160, w: 2 } };
  E.REL_STAT = { vit: "Vitalité", pui: "Puissance", dmg: "Dégâts", esq: "Esquive", sa: "Sagesse", pa: "PA", pm: "PM" };
  E.relStatTxt = (x) => Object.entries(x.st || {}).map(([k, v]) => `${v > 0 ? "+" : "−"}${Math.abs(v)}${k === "dmg" ? " %" : ""} ${E.REL_STAT[k] || k}`).join(" · ");
  A.relEvery = 5; A.relMax = 6; A.relStart = 6; A.relVit = 40; A.relPui = 80; A.relSo = 8; // relStart : reliques de départ de l'Au-delà ; relVit/relPui/relSo : échelle des caractéristiques selon le niveau (réglée par tools/ascension_sim.js)

  /* ---------- rareté selon l'étage ---------- */
  E.relRarTable = (f) => (f <= 25 ? { c: 70, r: 30, l: 0 } : f <= 55 ? { c: 50, r: 40, l: 10 } : f <= 100 ? { c: 30, r: 45, l: 25 } : { c: 20, r: 45, l: 35 });
  const rollRar = (r, T) => { let x = r() * 100; for (const k of ["l", "r", "c"]) { if (x < T[k]) return k; x -= T[k]; } return "c"; };
  const upRar = (k) => (k === "c" ? "r" : "l");

  /* ---------- reliques portées pendant la montée ---------- */
  E.relWorn = (R) => (R && R.relics) || [];
  E.relOf = (R) => E.relWorn(R).map((id) => BY[id]).filter(Boolean);
  E.relHas = (R, k) => { const L = E.relOf(R); for (const x of L) if (x.fx && x.fx.k === k) return x.fx; return null; };
  E.relAll = (R, k) => E.relOf(R).filter((x) => x.fx && x.fx.k === k).map((x) => x.fx);
  E.relSum = (R, k) => E.relAll(R, k).reduce((a, f) => a + (f.v || 0), 0);
  /* caractéristiques et modificateurs transversaux (plusieurs effets s'additionnent) */
  E.relMods = (R) => {
    const m = { vit: 0, pui: 0, dmg: 0, esq: 0, sa: 0, pa: 0, pm: 0, frag: 0, res: 0, dodge: 0, cri: 0, so: 0 };
    E.relOf(R).forEach((x) => {
      Object.entries(x.st || {}).forEach(([k, v]) => (m[k] = (m[k] || 0) + v));
      const f = x.fx; if (!f) return;
      if (f.k === "pa") { m.pa += f.v || 0; m.pm += f.pm || 0; m.frag += f.frag || 0; m.dmg += f.dmg || 0; }
      else if (f.k === "pm") m.pm += f.v || 0;
      else if (f.k === "dmg") { m.dmg += f.v || 0; m.res += f.res || 0; }
      else if (f.k === "frag") m.frag += f.v || 0;
      else if (f.k === "res") m.res += f.v || 0;
      else if (f.k === "dodge") m.dodge += f.v || 0;
      else if (f.k === "dodgeAll") { m.dodge += f.v || 0; m.res += f.res || 0; }
      else if (f.k === "cri") m.cri += f.v || 0;
      else if (f.k === "so") m.so += f.v || 0;
    });
    m.frag += m.sa; m.dodge += m.esq / 2 + m.pm * 5;
    return m;
  };
  /* équipe une relique : une par emplacement (la nouvelle remplace l'ancienne), inscrite au Reliquaire ; le Sursis offert ne l'est qu'une fois */
  E.relEquip = (S, R, id) => {
    const x = BY[id]; if (!x) return "Relique inconnue."; R.relics = R.relics || [];
    const i = R.relics.findIndex((k) => BY[k] && BY[k].slot === x.slot); if (i >= 0) R.relics.splice(i, 1);
    R.relics.push(id); E.relSeen(S, id);
    R.relOnce = R.relOnce || {}; const f = x.fx;
    if (f && f.k === "sursis" && !R.relOnce[id]) { R.relOnce[id] = 1; R.sursis += f.v; }
    return null;
  };
  E.relSlotOf = (R, slot) => E.relOf(R).find((x) => x.slot === slot) || null;

  /* ---------- tirage d'un palier : 3 reliques de 3 emplacements différents ---------- */
  E.relPickN = (R) => (E.relHas(R, "pickMore") || {}).v || 3;
  E.relChoices = (S, n, forceLeg) => {
    const Q = E.ascState(S); const R = Q.run; if (!R) return [];
    const r = seeded(hash(`relic|${Q.runs}|${R.f}|${R.fights}|${R.relRoll || 0}|${R.relOffered || 0}`)); // relOffered : les 6 reliques de départ de l'Au-delà diffèrent
    const T = E.relRarTable(Math.max(1, R.f - (R.fights ? 1 : 0))); // au départ de l'Au-delà (étage 101, aucun combat) : la table de l'Au-delà
    const worn = E.relWorn(R); const n0 = n || (E.relHas(R, "pickMore") || {}).relics || 3;
    const up = !!E.relHas(R, "relicUp"); const pity = E.relHas(R, "relicPity"); const leg = forceLeg || (pity && (R.relNoLeg || 0) >= pity.n);
    const out = []; const base = !R.fights && R.mode === "x" ? E.REL_SLOTS.filter((sl) => !E.relSlotOf(R, sl)) : E.REL_SLOTS; // départ de l'Au-delà : un emplacement vide par choix
    const slots = shuffle(base.length ? base : E.REL_SLOTS, r).slice(0, Math.min(6, n0));
    slots.forEach((sl) => {
      let rar = leg ? "l" : rollRar(r, T); if (up && !leg) rar = upRar(rar);
      const free = (x) => x.slot === sl && !worn.includes(x.id) && !out.includes(x.id);
      let P = RELICS.filter((x) => free(x) && x.r === rar); if (!P.length) P = RELICS.filter(free); if (P.length) out.push(pickOf(P, r).id);
    });
    return out;
  };
  /* le choix en attente (après le sort du palier) ; « nextLeg » rend légendaire la première offre de la montée suivante */
  E.relPend = (S) => {
    const Q = E.ascState(S); const R = Q.run; if (!R) return false;
    const leg = !!Q.relNextLeg && !R.relOffered; const opts = E.relChoices(S, 0, leg); if (!opts.length) return false;
    R.relOffered = (R.relOffered || 0) + 1; if (leg) delete Q.relNextLeg;
    R.pend = { t: "relic", opts, at: E.now(), rr: E.relHas(R, "reroll") ? 1 : 0 };
    if (opts.some((id) => BY[id].r === "l")) R.relNoLeg = 0; else R.relNoLeg = (R.relNoLeg || 0) + 1;
    return true;
  };
  E.relReroll = (S) => { const Q = E.ascState(S); const R = Q.run; const P = R && R.pend; if (!P || P.t !== "relic") return "Rien à relancer."; if (!P.rr) return "Plus de relance pour ce palier.";
    P.rr = 0; R.relRoll = (R.relRoll || 0) + 1; P.opts = E.relChoices(S); return null; };
  /* après un palier (sort, âme) ou un boss : la relique due, puis le marchand du Colporteur */
  E.relNext = (S, R) => {
    if (R.pend) return false;
    if (R.relDue) { R.relDue = 0; if (E.relPend(S)) return true; }
    if (R.shopDue) { R.shopDue = 0; R.pend = { t: "shop", at: E.now() }; E.relShopEnter(S, R); return true; }
    return false;
  };
  E.relDue = (R, done) => { if (done % A.relEvery === 0) R.relDue = 1; };
  /* l'auto : la meilleure rareté, un emplacement vide avant un remplacement */
  E.relAuto = (S) => { const R = E.ascState(S).run; const P = R && R.pend; if (!P || P.t !== "relic") return -1;
    let bi = -1, bs = -1; P.opts.forEach((id, i) => { const x = BY[id]; if (!x) return; const s = E.REL_RAR[x.r].w * 10 + (E.relSlotOf(R, x.slot) ? 0 : 5) + (x.fx ? 1 : 0); if (s > bs) { bs = s; bi = i; } });
    return bi; };

  /* ---------- le marchand ---------- */
  E.relPrice = (R, base, kind) => { let p = base * (1 - Math.min(80, E.relSum(R, "shopDisc")) / 100); if (kind === "glyph") p *= 1 - Math.min(90, E.relSum(R, "shopGlyph")) / 100; return Math.max(1, Math.round(p)); };
  E.relShopOffers = (S, R) => {
    const Q = E.ascState(S); const r = seeded(hash(`rshop|${Q.runs}|${R.f}`)); const T = E.relRarTable(R.f);
    const n = 2 + ((E.relHas(R, "shopRelics") || {}).v || 0) + (E.relHas(R, "shopMore") ? 1 : 0); const worn = E.relWorn(R); const out = [];
    shuffle(E.REL_SLOTS, r).slice(0, Math.min(6, n)).forEach((sl) => { const rar = rollRar(r, T); const free = (x) => x.slot === sl && !worn.includes(x.id) && !out.includes(x.id);
      let P = RELICS.filter((x) => free(x) && x.r === rar); if (!P.length) P = RELICS.filter(free); if (P.length) out.push(pickOf(P, r).id); });
    return out;
  };
  E.relShopEnter = (S, R) => { const P = R.pend; if (!P || P.t !== "shop") return; P.rel = E.relShopOffers(S, R);
    const sf = E.relSum(R, "shopFrag"); if (sf && R.relShopAt !== R.f) { R.relShopAt = R.f; R.frag += sf; } };
  E.relShopBuy = (S, R, i) => { const P = R.pend; const id = P && P.rel && P.rel[i]; const x = id && BY[id]; if (!x) return "Offre inconnue.";
    const price = E.relPrice(R, E.REL_RAR[x.r].price); if (R.frag < price) return `Il faut ${price} Fragments gagnés pendant cette montée.`;
    R.frag -= price; P.rel.splice(i, 1); E.relEquip(S, R, id); E.relCashback(R, price); return null; };
  E.relCashback = (R, price) => { const cb = E.relSum(R, "shopCashback"); if (cb) R.frag += Math.round(price * cb / 100); };
  E.relMerc = (R, price) => (E.relHas(R, "mercFree") ? 0 : Math.round(price * (1 - Math.min(100, E.relSum(R, "mercDisc")) / 100)));
  E.relGlyphMax = (R) => (E.relHas(R, "glyphMax") || {}).v || 2;
  E.relEvery = (R) => (E.relHas(R, "every") || {}).v || A.every;
  E.relEchoMult = (R) => (E.relHas(R, "echoDouble") ? 2 : 1);

  /* ---------- le Reliquaire : la collection, et ses récompenses (titres, cadre, ornement, aura) ---------- */
  E.relSeen = (S, id) => { const Q = E.ascState(S); Q.reliquaire = Q.reliquaire || {}; const first = !Q.reliquaire[id]; Q.reliquaire[id] = (Q.reliquaire[id] || 0) + 1; if (first) E.relRewardCheck(S); return first; };
  E.relCount = (S) => Object.keys((S.asc && S.asc.reliquaire) || {}).filter((k) => BY[k]).length;
  E.REL_REWARDS = [
    { n: 15, kind: "title", v: "Reliquaire", name: "Titre « Reliquaire »" },
    { n: 50, kind: "frame", v: "tour", name: "Cadre « Cadre de la Tour »" },
    { n: 100, kind: "orn", v: "reliquaire", name: "Ornement « Sceau du Reliquaire »" },
    { n: 240, kind: "title", v: "Maître du Reliquaire", name: "Titre « Maître du Reliquaire » et aura chromatique", aura: 1 },
  ];
  E.relRewardCheck = (S) => {
    const n = E.relCount(S); S.titlesExtra = S.titlesExtra || []; S.unlocks = S.unlocks || {};
    E.REL_REWARDS.forEach((rw) => { if (n < rw.n) return; const key = "rel" + rw.n; if (S.unlocks[key]) return; S.unlocks[key] = 1;
      if (rw.kind === "title" && !S.titlesExtra.includes(rw.v)) S.titlesExtra.push(rw.v);
      if (rw.aura && E.chroma) { try { const C = E.chroma(S); if (C && C.shop && !C.shop.aura) C.shop.aura = E.now(); } catch (e) { /* atelier absent */ } }
      E.note(S, `Reliquaire : ${rw.name} (${rw.n} reliques trouvées).`, "rare"); });
  };
  if (E.SFRAMES) E.SFRAMES.tour = { name: () => "Cadre de la Tour", req: "Reliquaire : trouver 50 reliques dans L'Ascension", ok: (S) => E.relCount(S) >= 50 };
  if (E.ORN) E.ORN.reliquaire = { name: () => "Sceau du Reliquaire", req: "Reliquaire : trouver 100 reliques dans L'Ascension", ok: (S) => E.relCount(S) >= 100 };

  /* ---------- le combat : mise en place ---------- */
  const heal = (F, t, v, why) => { if (!t.alive || v <= 0) return 0; const b = t.hp; t.hp = Math.min(t.hpMax, t.hp + Math.round(v)); const g = t.hp - b; if (g > 0) F.fx.push({ seq: F.seq, k: "heal", t: F.ents.indexOf(t), v: g }); if (g > 0 && why) F.log.push({ txt: `${why} : +${g} PV.`, cls: "c" }); return g; };
  const hurt = (F, t, v, el) => { if (!t.alive || v <= 0) return; v = Math.round(v); if (t.shield > 0) { const a = Math.min(t.shield, v); t.shield -= a; v -= a; } t.hp -= v; F.fx.push({ seq: F.seq, k: "hit", t: F.ents.indexOf(t), s: -1, v, el: el || "n" }); if (t.hp <= 0) { t.hp = 0; t.alive = false; } };
  const mons = (F) => F.ents.filter((e) => e.side === "m" && e.alive);
  const recs = (F) => F.ents.filter((e) => e.side === "c" && e.summon && e.alive);
  const summon = (F, hero, name, img, hp, dmg, el, extra) => { const s = Object.assign({ side: "c", tm: 0, summon: true, owner: F.ents.indexOf(hero), name, img, cls: hero.cls, lvl: hero.lvl, hpMax: hp, hp, ini: hero.ini - 1, dmg, el: el || "t", buffs: [], dots: [], debuffs: [], shield: 0, alive: true, cd: {}, paLoss: 0 }, extra || {});
    F.ents.push(s); F.order.push(F.ents.indexOf(s)); return s; };
  E.relSetup = (S, W, R, L) => {
    const F = W.F; const hero = F.ents[W.hero]; const M = E.relMods(R); const rl = W.rel = { paNext: 0, roundSeq: 0, seq: 0, hitRound: 0, kills: 0 };
    const hpB = (R.relHpF || 0) + (R.relHpG || 0);
    hero.hpMax = hero.hp = Math.max(1, Math.round(hero.hpMax * (1 + hpB / 100) + M.vit * (1 + L / A.relVit)));
    hero.st.pui = (hero.st.pui || 0) + Math.round(M.pui * (1 + L / A.relPui)); hero.st.cri = (hero.st.cri || 0) + M.cri; hero.st.so = (hero.st.so || 0) + Math.round(M.so * (1 + L / A.relSo));
    hero.st.pa = Math.max(1, hero.st.pa + M.pa); rl.pa0 = hero.st.pa; rl.reliqN = E.relCount(S); rl.res = M.res; rl.dodge = M.dodge; rl.dmg = M.dmg;
    const dmgBoss = E.relSum(R, "dmgBoss") + ((E.relHas(R, "eyeBoss") || {}).v || 0); const dmgFull = E.relSum(R, "dmgFull");
    if (dmgBoss || dmgFull) hero.expVs = { boss: dmgBoss, fresh: dmgFull };
    const dr = E.relHas(R, "drain"); if (dr) hero.vamp = (hero.vamp || 0) + dr.v / 100;
    const po = E.relHas(R, "poison"); if (po) hero.expPoison = po.v;
    if (E.relHas(R, "eyeBoss")) W.seeHp = 1;
    const ini = E.relHas(R, "ini"); if (ini) hero.expFirst = true;
    const sh = E.relSum(R, "shieldStart"); if (sh) hero.shield = Math.round(hero.hpMax * sh / 100);
    if (E.relHas(R, "survive")) rl.survive = 1; if (E.relHas(R, "phoenix") && !R.relPhoenix) rl.phoenix = 1; if (E.relHas(R, "fragRevive")) rl.fragRev = 1;
    const ga = E.relHas(R, "gamble"); if (ga) { rl.gamble = W.rng() < 0.5 ? ga.up : -ga.down; F.log.push({ txt: `Dague du Parieur : ${rl.gamble > 0 ? "pile, +" : "face, "}${rl.gamble} % de dégâts.`, cls: "dim" }); }
    if (E.relHas(R, "dice")) { rl.dice = pickOf(["pa", "dmg", "shield", "pm"], W.rng); if (rl.dice === "shield") hero.shield = Math.max(hero.shield || 0, Math.round(hero.hpMax * 0.25)); if (rl.dice === "pm") rl.dodge += 5; F.log.push({ txt: `Anneau du Dé : ${{ pa: "+2 PA", dmg: "+30 % de dégâts", shield: "un bouclier de 25 %", pm: "+1 PM" }[rl.dice]} pour ce combat.`, cls: "dim" }); }
    if (R.relPaNext) { rl.paNext += R.relPaNext; R.relPaNext = 0; }
    /* les monstres */
    const md = E.relSum(R, "monDmg"); if (md) mons(F).forEach((m) => { m.dmg *= 1 + md / 100; });
    /* recrues et invocations */
    const rd = E.relSum(R, "recDmg") + (E.relHas(R, "dmgVsSummon") ? 25 : 0); const rh = E.relSum(R, "recHp"); const rp = E.relHas(R, "recDmgPer");
    const rc = E.relHas(R, "recStart"); if (rc && W.rule !== "greve" && E.ascMonPool) { const P = E.ascMonPool(L); const k = pickOf(P, W.rng); const m = MONSTERS[k]; if (m) summon(F, hero, m.name, m.img, Math.round(hero.hpMax * 0.4), (6 + L * 1.25) * 1.1, m.el, { recruit: 90 + rl.kills, temp: 1 }); }
    const to = E.relHas(R, "totem"); if (to && MONSTERS.tofu) summon(F, hero, "Tofu totem", MONSTERS.tofu.img, Math.round(hero.hpMax * to.hp / 100), (6 + L * 1.25) * 1.1 * to.dmg / 100, MONSTERS.tofu.el, { recruit: 95, temp: 1 });
    if (E.relHas(R, "clone")) { const f = recs(F).find((e) => e.recruit !== undefined && e.recruit < 90); if (f) summon(F, hero, f.name, f.img, f.hpMax, f.dmg, f.el, { recruit: 96, temp: 1, hp: f.hp }); }
    const RS = recs(F); RS.forEach((s) => { if (rd) s.dmg *= 1 + rd / 100; if (rp) s.dmg *= 1 + rp.v * RS.length / 100; if (rh) { s.hpMax = Math.round(s.hpMax * (1 + rh / 100)); s.hp = Math.round(s.hp * (1 + rh / 100)); }
      if (ini && ini.rec) s.expFirst = true; if (E.relHas(R, "recIni")) s.ini += 1e6; });
    rl.recAlive = RS.length;
    /* âmes de boss : durée, puissance, relance */
    const SO = W.souls = Object.assign({}, A.souls); const sb = E.relHas(R, "soulBig"); if (sb) { SO.turns = sb.turns; SO.pow = sb.pow; }
    SO.turns += E.relSum(R, "soulTurns") + (E.relHas(R, "soulAlways") ? 1 : 0); SO.cd = Math.max(1, SO.cd + E.relSum(R, "soulCd"));
    E.relRound(S, W, R); // le premier tour commence tout de suite
  };

  /* ---------- le combat : à chaque tour ---------- */
  E.relRound = (S, W, R) => {
    const F = W.F; const rl = W.rel; if (!rl) return; const hero = F.ents[W.hero]; if (!hero || !hero.alive) return; const rd = F.round; const Ms = mons(F);
    /* PA du tour */
    let pa = rl.pa0 + rl.paNext; rl.paNext = 0;
    E.relAll(R, "paFirst").forEach((f) => { if (rd === 1 && (!f.sig || (W.defs || E.ASC_DEFS || []).some((d) => d && d.ascSig))) { pa += f.v; if (f.pm) rl.dodge += 5 * f.pm; } });
    E.relAll(R, "paTurn").forEach((f) => { if (!f.heal || (W.defs || E.ASC_DEFS || []).some((d) => d && E.spellKind(d.grades[0]) === "heal")) pa += f.v; });
    E.relAll(R, "paEvery").forEach((f) => { if (rd % f.n === 0) pa += f.v; }); E.relAll(R, "paFrom").forEach((f) => { if (rd >= f.n) pa += f.v; });
    const pb = E.relHas(R, "paBar"); if (pb && R.spells.length >= pb.n) pa += pb.v;
    const pl = E.relHas(R, "paLast"); if (pl && Ms.length === 1) pa += pl.v;
    if (rd === 1 && rl.dice === "pa") pa += 2;
    if (rd === 1 && E.relHas(R, "paDoubleFirst")) pa *= 2;
    if (rd === 1) E.relAll(R, "monPaFirst").forEach((f) => { Ms.forEach((m) => (m.paLoss = Math.min(3, (m.paLoss || 0) + f.v))); if (f.self) pa -= f.v; });
    if (rd === 1 && E.relSum(R, "pmFirst")) rl.pmFirst = 1;
    hero.st.pa = Math.max(1, Math.round(pa));
    /* soins, boucliers, pertes */
    const rg = E.relSum(R, "regen"); if (rg && rd > 1) heal(F, hero, hero.hpMax * rg / 100);
    const rgl = E.relSum(R, "regenLow"); if (rgl && rd > 1 && hero.hp < hero.hpMax * 0.3) heal(F, hero, hero.hpMax * rgl / 100, "Amulette de Veille");
    const st = E.relSum(R, "shieldTurn"); if (st) hero.shield = Math.min(Math.round(hero.hpMax * 0.5), (hero.shield || 0) + Math.round(hero.hpMax * st / 100));
    const pc = E.relHas(R, "pacte"); if (pc && rd > 1) hero.hp = Math.max(1, hero.hp - Math.round(hero.hpMax * pc.hp / 100));
    if (E.relHas(R, "chaosEl")) { rl.chaos = pickOf(["t", "f", "e", "a"], W.rng); }
    const sw = E.relHas(R, "secondWind"); if (sw && !rl.sw && hero.hp < hero.hpMax * 0.5) { rl.sw = 1; heal(F, hero, hero.hpMax * sw.heal / 100, "Second Souffle"); rl.paNext += sw.pa; F.log.push({ txt: `Second Souffle : +${sw.pa} PA au prochain tour.`, cls: "c" }); }
    if (E.relHas(R, "swap") && rd === 3 && !rl.swapped) { const t = Ms.slice().sort((a, b) => b.hp / b.hpMax - a.hp / a.hpMax)[0]; if (t && t.hp / t.hpMax > hero.hp / hero.hpMax) { rl.swapped = 1; const ph = hero.hp / hero.hpMax, pm = t.hp / t.hpMax; hero.hp = Math.max(1, Math.round(hero.hpMax * pm)); t.hp = Math.max(1, Math.round(t.hpMax * ph)); F.log.push({ txt: "Couronne de l'Échange : tes PV et ceux du monstre le plus en forme sont échangés !", cls: "c" }); } }
    /* coups critiques du tour passé */
    const hc = E.relSum(R, "healCrit"), cf = E.relSum(R, "critFrag");
    if ((hc || cf) && rd > 1) { const n = F.fx.filter((x) => x.k === "hit" && x.crit && x.seq > rl.seq && (x.s === W.hero || F.fx.some((c) => c.seq === x.seq && c.k === "cast" && c.s === W.hero))).length; if (n) { if (hc) heal(F, hero, hero.hpMax * hc * n / 100); if (cf) R.frag += cf * n; } }
    rl.seq = F.seq; rl.roundSeq = F.seq; rl.hitRound = 0; rl.paHitRound = 0;
    /* recrues : dernier souffle, retour au combat */
    const RS = recs(F); if (RS.length < rl.recAlive && E.relHas(R, "lastStand")) { rl.lastStand = 1; F.log.push({ txt: "Dernier Souffle : une recrue est tombée, tes dégâts montent.", cls: "c" }); }
    const rr = E.relHas(R, "recReviveFight"); if (rr && !rl.recRev) { const d = F.ents.find((e) => e.side === "c" && e.summon && !e.alive && e.recruit !== undefined); if (d) { rl.recRev = 1; d.alive = true; d.hp = Math.max(1, Math.round(d.hpMax * rr.v / 100)); F.order.push(F.ents.indexOf(d)); F.fx.push({ seq: F.seq, k: "summon", t: F.ents.indexOf(d) }); F.log.push({ txt: `${d.name} revient au combat (Bottes du Fossoyeur).`, cls: "c" }); } }
    rl.recAlive = recs(F).length;
  };

  /* ---------- le combat : les dégâts (hook E.legPre du moteur, après résistances) ---------- */
  const castDef = (W, hi) => { const F = W.F; for (let i = F.fx.length - 1; i >= 0 && i > F.fx.length - 40; i--) { const x = F.fx[i]; if (x.k === "cast" && x.s === hi) return x.sp && String(x.sp).startsWith("a~") ? (W.defs || E.ASC_DEFS)[+x.sp.slice(2)] || null : null; } return null; };
  const elOf = (d, hero) => { if (!d) return null; if (d.el && d.el !== "best") return d.el; const st = hero.st || {}; const best = ["t", "f", "e", "a"].map((el) => [el, st[(D.ELEMENTS[el] || {}).stat] || 0]).sort((a, b) => b[1] - a[1])[0]; return best ? best[0] : null; };
  const relDmg = (W, src, tgt, v) => {
    const F = W.F; const R = W.R; const rl = W.rel; if (!R || !rl) return v; const hero = F.ents[W.hero]; const Ms = mons(F);
    if (src === hero) {
      let m = 1 + (rl.dmg + (rl.gamble || 0) + (rl.dice === "dmg" ? 30 : 0)) / 100;
      const def = castDef(W, W.hero); const el = elOf(def, hero);
      E.relAll(R, "dmgEl").forEach((f) => { if (el === f.el) m *= 1 + f.v / 100; });
      if (rl.chaos && el === rl.chaos) m *= 1 + ((E.relHas(R, "chaosEl") || {}).v || 0) / 100;
      if (def) { const oc = E.relSum(R, "otherCls"); if (oc && def.id.split(":")[0] !== R.cls) m *= 1 + oc / 100;
        const sg = E.relSum(R, "sigPow"); if (sg && def.ascSig) m *= 1 + sg / 100;
        const gp = E.relSum(R, "glyphPow"); if (gp && (def.ascGl || []).length) m *= 1 + gp * 0.3 / 100; }
      const lo = E.relSum(R, "dmgLow"); if (lo && tgt.hp < tgt.hpMax * 0.3) m *= 1 + lo / 100;
      const hu = E.relSum(R, "dmgHurt"); if (hu && tgt.hp < tgt.hpMax) m *= 1 + hu / 100;
      const la = E.relSum(R, "dmgLast"); if (la && Ms.length === 1) m *= 1 + la / 100;
      const od = E.relSum(R, "dmgOdd"); if (od && F.round % 2 === 1) m *= 1 + od / 100;
      const ft = E.relSum(R, "dmgFirstTurn"); if (ft && F.round === 1) m *= 1 + ft / 100;
      E.relAll(R, "dmgPerTurn").forEach((f) => { m *= 1 + Math.min(f.max, f.v * (F.round - 1)) / 100; });
      E.relAll(R, "dmgPerFloor").forEach((f) => { m *= 1 + Math.min(f.max, f.v * (R.relFloors || 0)) / 100; });
      const ns = E.relSum(R, "dmgNoSursis"); if (ns && !R.usedSursis) m *= 1 + ns / 100;
      const ls = E.relSum(R, "dmgLowSelf"); if (ls && hero.hp < hero.hpMax * 0.3) m *= 1 + ls / 100;
      const bz = E.relHas(R, "berserk"); if (bz) m *= 1 + Math.min(bz.max, Math.round((1 - hero.hp / hero.hpMax) * 100)) / 100;
      const pc = E.relHas(R, "pacte"); if (pc) m *= 1 + pc.v / 100;
      const fd = E.relHas(R, "fragDmg"); if (fd) m *= 1 + Math.min(fd.max, Math.floor(R.frag / fd.per) * fd.v) / 100;
      const rb = E.relHas(R, "reliquaireBonus"); if (rb) m *= 1 + Math.min(rb.max, Math.floor((rl.reliqN || 0) / rb.per)) / 100;
      const vs = E.relSum(R, "dmgVsSummon"); if (vs && tgt.summon) m *= 1 + vs / 100;
      const lst = E.relSum(R, "lastStand"); if (lst && rl.lastStand) m *= 1 + lst / 100;
      const ah = E.relSum(R, "dmgAfterHit"); if (ah && rl.afterHit) { if (!rl.ahSeq) rl.ahSeq = F.seq; if (rl.ahSeq === F.seq) m *= 1 + ah / 100; else { rl.afterHit = 0; rl.ahSeq = 0; } }
      const ad = E.relSum(R, "dmgAfterDodge"); if (ad && rl.afterDodge) { if (!rl.adSeq) rl.adSeq = F.seq; if (rl.adSeq === F.seq) m *= 1 + ad / 100; else { rl.afterDodge = 0; rl.adSeq = 0; } }
      E.relAll(R, "dmgFirstCast").forEach((f) => { if ((hero.nCast || 0) === 0) { m *= 1 + f.v / 100; if (f.free && def && !rl.freeDone) { rl.freeDone = 1; rl.paNext += E.spellGrade(def, hero.lvl).pa; } } });
      const ds = E.relSum(R, "dmgSecond"); if (ds && F.fx.filter((x) => x.k === "cast" && x.s === W.hero && x.seq > rl.roundSeq).length === 2) m *= 1 + ds / 100;
      const eh = E.relSum(R, "echoHit"); if (eh) m *= 1 + eh / 100;
      const dc = E.relHas(R, "doubleCast"); if (dc && W.rng() * 100 < dc.p) { m *= 2; if (rl.dcSeq !== F.seq) { rl.dcSeq = F.seq; F.log.push({ txt: "Anneau du Double : le sort est lancé deux fois !", cls: "c" }); } }
      if (E.relHas(R, "ignoreRes")) { const rs = Math.max(0, ...Object.values(tgt.res || {})); m *= 1 / (1 - Math.min(A.resCap, rs) / 100); }
      const hcst = E.relSum(R, "healCast"); if (hcst && rl.hcSeq !== F.seq) { rl.hcSeq = F.seq; heal(F, hero, hero.hpMax * hcst / 100); }
      const rhc = E.relSum(R, "recHealCast"); if (rhc && rl.rhSeq !== F.seq) { rl.rhSeq = F.seq; recs(F).forEach((s) => heal(F, s, s.hpMax * rhc / 100)); }
      return v * m;
    }
    if (tgt === hero && src.side === "m") {
      let dodge = rl.dodge; if (rl.pmFirst && F.round === 1) dodge += 5 * E.relSum(R, "pmFirst");
      if (!rl.hitRound) dodge += E.relSum(R, "dodgeFirst"); if (F.round % 2 === 1) dodge += E.relSum(R, "dodgeOdd"); if (hero.hp < hero.hpMax * 0.25) dodge += E.relSum(R, "fleeLow");
      if (dodge > 0 && W.rng() * 100 < Math.min(60, dodge)) { F.fx.push({ seq: F.seq, k: "buff", t: W.hero, txt: "Esquive" }); rl.afterDodge = 1; rl.adSeq = 0;
        const ct = E.relHas(R, "counter"); if (ct && src.alive) { hurt(F, src, src.hpMax * ct.v / 100); F.log.push({ txt: `Cape de Contre : ${src.name} perd ${ct.v} % de ses PV.`, cls: "c" }); } return 0; }
      rl.hitRound = 1; rl.afterHit = 1; rl.ahSeq = 0;
      let m = 1 - rl.res / 100;
      E.relAll(R, "resEl").forEach((f) => { if (src.el === f.el) m *= 1 - f.v / 100; });
      const rbs = E.relSum(R, "resBoss"); if (rbs && src.boss) m *= 1 - rbs / 100; const rnb = E.relSum(R, "resNonBoss"); if (rnb && !src.boss) m *= 1 - rnb / 100;
      const rf = E.relSum(R, "resFirst"); if (rf && F.round === 1) m *= 1 - rf / 100;
      const fa = E.relHas(R, "fragArmor"); if (fa && R.frag >= fa.cost) { R.frag -= fa.cost; m *= 1 - fa.v / 100; }
      v *= m;
      const sh = E.relHas(R, "dmgShare"); if (sh) { const RS = recs(F); if (RS.length) { const part = v * sh.v / 100; RS.forEach((s) => hurt(F, s, part / RS.length, src.el)); v -= part; } }
      if (E.relHas(R, "monPaHit") && !rl.paHitRound) { rl.paHitRound = 1; src.paLoss = Math.min(2, (src.paLoss || 0) + 1); }
      const rfl = E.relSum(R, "reflect") + (src.boss ? E.relSum(R, "reflectBoss") : 0); if (rfl && src.alive) hurt(F, src, v * rfl / 100);
      v = Math.max(1, Math.round(v));
      if (v >= hero.hp + (hero.shield || 0)) { const after = v - Math.min(hero.shield || 0, v); const fr = E.relHas(R, "fragRevive");
        if (rl.phoenix) { rl.phoenix = 0; R.relPhoenix = 1; hero.hp = Math.round(hero.hpMax * 0.5) + after; F.log.push({ txt: "Bottes du Phénix : tu renais à 50 % de tes PV !", cls: "c" }); }
        else if (rl.survive) { rl.survive = 0; hero.hp = 1 + after; F.log.push({ txt: "Heaume du Sursis : le coup te laisse à 1 PV.", cls: "c" }); }
        else if (rl.fragRev && fr && R.frag >= fr.cost) { rl.fragRev = 0; R.frag -= fr.cost; hero.hp = Math.round(hero.hpMax * 0.5) + after; F.log.push({ txt: `Cœur de Fragments : ${fr.cost} Fragments te ramènent à 50 % de tes PV.`, cls: "c" }); } }
      return v;
    }
    return v;
  };
  const lp0 = E.legPre;
  E.legPre = (F, src, tgt, v) => { if (lp0) { v = lp0(F, src, tgt, v); if (v <= 0) return v; } const W = E.REL_W; if (!F.asc || !W || W.F !== F || !src) return v; try { return relDmg(W, src, tgt, v); } catch (e) { if (typeof console !== "undefined") console.warn("reliques", e); return v; } };

  /* ---------- le combat : un monstre tombe ---------- */
  E.relDie = (S, W, m, R) => {
    const F = W.F; const rl = W.rel; if (!rl || !R || m.summon) return; const hero = F.ents[W.hero]; rl.kills++;
    E.relAll(R, "paKill").forEach((f) => { rl.paNext += f.v; if (f.heal) heal(F, hero, hero.hpMax * f.heal / 100); });
    const hk = E.relSum(R, "healKill"); if (hk) heal(F, hero, hero.hpMax * hk / 100);
    const sk = E.relSum(R, "shieldKill"); if (sk) hero.shield = Math.min(Math.round(hero.hpMax * 0.5), (hero.shield || 0) + Math.round(hero.hpMax * sk / 100));
    const fk = E.relSum(R, "fragKill"); if (fk) R.frag += fk;
    const gl = E.relHas(R, "glutton"); if (gl) { heal(F, hero, hero.hpMax * gl.heal / 100); if ((R.relHpG || 0) < gl.max) { R.relHpG = (R.relHpG || 0) + gl.hp; hero.hpMax += Math.round(hero.hpMax * gl.hp / 100); } }
    const ch = E.relHas(R, "chain"); if (ch) { const n = mons(F)[0]; if (n) { hurt(F, n, m.hpMax * ch.v / 100); F.log.push({ txt: `Hache de l'Écho : ${n.name} encaisse le coup.`, cls: "c" }); } }
    const ex = E.relHas(R, "explode"); if (ex) { const L = mons(F); if (L.length) { L.forEach((o) => hurt(F, o, m.hpMax * ex.v / 100, "f")); F.log.push({ txt: `${m.name} explose (Marteau Explosif) !`, cls: "c" }); } }
  };

  /* ---------- fin d'un étage ---------- */
  E.relFrag = (S, R, fr, fl) => { const M = E.relMods(R); fr = Math.round(fr * (1 + Math.max(-90, M.frag) / 100)) + E.relSum(R, "fragFloor") + (fl.t === "boss" ? E.relSum(R, "treasure") : 0);
    const ec = E.relSum(R, "ecus"); if (ec) R.ecus += Math.round(fr * ec / 100); return Math.max(0, fr); };
  E.relRecruits = (S, R) => { // avant que les recrues mortes ne soient retirées
    const he = E.relSum(R, "recHealEnd"); if (he) R.recruits.forEach((x) => { if (x.hp > 0) x.hp = Math.min(1, x.hp + he / 100); });
    const rv = E.relHas(R, "recRevive"); if (rv && R.relRevAt !== R.f) { const d = R.recruits.find((x) => !(x.hp > 0)); if (d) { R.relRevAt = R.f; d.hp = rv.v / 100; } } };
  E.relWin = (S, R, W, fl) => {
    const Q = E.ascState(S); R.relFloors = (R.relFloors || 0) + 1;
    const fh = E.relHas(R, "fragHp"); if (fh && R.frag >= fh.cost && (R.relHpF || 0) < fh.max) { R.frag -= fh.cost; R.relHpF = (R.relHpF || 0) + fh.v; }
    E.relAll(R, "volFloor").forEach((f) => { if ((!f.n || R.f % f.n === 0) && Q.vol < A.volMax) Q.vol += f.v; });
    const hf = E.relSum(R, "recHealFloor"); if (hf) R.recruits.forEach((x) => { if (x.hp > 0) x.hp = Math.min(1, x.hp + hf / 100); });
    if (fl.t === "boss" && E.relHas(R, "shopAfterBoss")) R.shopDue = 1;
  };
  E.relLose = (S, R, W, out) => {
    const Q = E.ascState(S); const wm = E.relHas(R, "woundMore"); const wk = E.ascWoundKey(R.mode, R.f);
    if (wm && Q.wounds[wk]) Q.wounds[wk].hp = Q.wounds[wk].hp.map((p) => Math.max(0, p - wm.v / 100));
    const sp = E.relHas(R, "sursisPa"); if (sp && out.sursis) R.relPaNext = sp.v;
  };
  E.relEnd = (S, R, sum) => { const Q = E.ascState(S); if (E.relHas(R, "nextLeg")) Q.relNextLeg = 1; sum.relics = (R.relics || []).slice(); };

  root.ENGINE = E;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
