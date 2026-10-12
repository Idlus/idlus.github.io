/* ============================================================================
   MONTURES (0.1.9) — Idlus

   Dragodindes, Muldos et Volkornes : capture au filet dans une zone sauvage, croissance par
   une part de l'XP du héros, élevage à l'enclos du Havre-Sac (générations, bicolores).
   Les couleurs, icônes et bonus au niveau 100 viennent de DOFUS (DofusDB).

   Le bloc DATA est généré par tools/build_mounts.js : ne pas le modifier à la main.
   ============================================================================ */
(function (root) {
  "use strict";
  const D = root.DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const E = root.ENGINE || (typeof require !== "undefined" ? require("./engine.js") : null);
  const rnd = () => E.rnd();
  const note = (S, t, k) => E.note(S, t, k);

  /* DATA */
  const MOUNTS = {"dd":{"name":"Dragodinde","base":{"vit":300},"cols":{"Rousse":{"icon":97010,"s":{"so":50},"g":1},"Amande":{"icon":97020,"s":{"ini":1500},"g":1},"Dorée":{"icon":97018,"s":{"inv":2},"g":1},"Indigo":{"icon":97017,"s":{"cha":100},"g":2,"p":["Rousse","Dorée"]},"Ébène":{"icon":97004,"s":{"age":100},"g":2,"p":["Amande","Dorée"]},"Pourpre":{"icon":97019,"s":{"fo":100},"g":3,"p":["Indigo","Rousse"]},"Orchidée":{"icon":97022,"s":{"ine":100},"g":3,"p":["Ébène","Amande"]},"Ivoire":{"icon":97016,"s":{"pui":70},"g":4,"p":["Pourpre","Orchidée"]},"Turquoise":{"icon":97015,"s":{"pp":80},"g":4,"p":["Indigo","Ébène"]},"Émeraude":{"icon":97021,"s":{"cri":12},"g":5,"p":["Ivoire","Turquoise"]},"Prune":{"icon":97023,"s":{"do":20},"g":5,"p":["Pourpre","Turquoise"]}},"bico":{"Rousse|Amande":["Amande et Rousse",97038],"Rousse|Dorée":["Dorée et Rousse",97046],"Rousse|Indigo":["Indigo et Rousse",97062],"Rousse|Ébène":["Ébène et Rousse",97012],"Rousse|Pourpre":["Pourpre et Rousse",97071],"Rousse|Orchidée":["Orchidée et Rousse",97070],"Rousse|Ivoire":["Ivoire et Rousse",97011],"Rousse|Turquoise":["Turquoise et Rousse",97069],"Rousse|Émeraude":["Émeraude et Rousse",97057],"Rousse|Prune":["Prune et Rousse",97084],"Amande|Dorée":["Amande et Dorée",97033],"Amande|Indigo":["Amande et Indigo",97036],"Amande|Ébène":["Amande et Ébène",97034],"Amande|Pourpre":["Amande et Pourpre",97041],"Amande|Orchidée":["Amande et Orchidée",97040],"Amande|Ivoire":["Amande et Ivoire",97037],"Amande|Turquoise":["Amande et Turquoise",97039],"Amande|Émeraude":["Amande et Émeraude",97035],"Amande|Prune":["Prune et Amande",97077],"Dorée|Indigo":["Dorée et Indigo",97044],"Dorée|Ébène":["Dorée et Ébène",97042],"Dorée|Pourpre":["Dorée et Pourpre",97049],"Dorée|Orchidée":["Dorée et Orchidée",97048],"Dorée|Ivoire":["Dorée et Ivoire",97045],"Dorée|Turquoise":["Dorée et Turquoise",97047],"Dorée|Émeraude":["Dorée et Émeraude",97043],"Dorée|Prune":["Prune et Dorée",97078],"Indigo|Ébène":["Ébène et Indigo",97051],"Indigo|Pourpre":["Indigo et Pourpre",97065],"Indigo|Orchidée":["Indigo et Orchidée",97064],"Indigo|Ivoire":["Indigo et Ivoire",97061],"Indigo|Turquoise":["Indigo et Turquoise",97063],"Indigo|Émeraude":["Émeraude et Indigo",97055],"Indigo|Prune":["Prune et Indigo",97082],"Ébène|Pourpre":["Ébène et Pourpre",97054],"Ébène|Orchidée":["Ébène et Orchidée",97053],"Ébène|Ivoire":["Ébène et Ivoire",97009],"Ébène|Turquoise":["Ébène et Turquoise",97052],"Ébène|Émeraude":["Ébène et Émeraude",97050],"Ébène|Prune":["Prune et Ébène",97079],"Pourpre|Orchidée":["Orchidée et Pourpre",97076],"Pourpre|Ivoire":["Ivoire et Pourpre",97068],"Pourpre|Turquoise":["Turquoise et Pourpre",97073],"Pourpre|Émeraude":["Émeraude et Pourpre",97060],"Pourpre|Prune":["Prune et Pourpre",97087],"Orchidée|Ivoire":["Ivoire et Orchidée",97067],"Orchidée|Turquoise":["Turquoise et Orchidée",97072],"Orchidée|Émeraude":["Émeraude et Orchidée",97059],"Orchidée|Prune":["Prune et Orchidée",97086],"Ivoire|Turquoise":["Ivoire et Turquoise",97066],"Ivoire|Émeraude":["Émeraude et Ivoire",97056],"Ivoire|Prune":["Prune et Ivoire",97083],"Turquoise|Émeraude":["Émeraude et Turquoise",97058],"Turquoise|Prune":["Prune et Turquoise",97085],"Émeraude|Prune":["Prune et Émeraude",97080]}},"mu":{"name":"Muldo","base":{"pm":1},"cols":{"Doré":{"icon":97094,"s":{"pui":50},"g":1},"Pourpre":{"icon":97093,"s":{"rt":16},"g":1},"Indigo":{"icon":97092,"s":{"re":16},"g":1},"Ébène":{"icon":97091,"s":{"ra":16},"g":1},"Orchidée":{"icon":97090,"s":{"rf":16},"g":1},"Roux":{"icon":97095,"s":{"tac":40},"g":2,"p":["Pourpre","Doré"]},"Amande":{"icon":97096,"s":{"fui":40},"g":2,"p":["Ébène","Doré"]},"Ivoire":{"icon":97097,"s":{"epa":40},"g":2,"p":["Indigo","Orchidée"]},"Turquoise":{"icon":97098,"s":{"epm":40},"g":2,"p":["Ébène","Indigo"]},"Prune":{"icon":97099,"s":{"cri":10},"g":3,"p":["Roux","Amande"]},"Émeraude":{"icon":97100,"s":{"dcri":30},"g":3,"p":["Ivoire","Turquoise"]},"Ambre":{"icon":97297,"s":{"dt":30},"g":4,"p":["Pourpre","Émeraude"]},"Corail":{"icon":97298,"s":{"df":30},"g":4,"p":["Orchidée","Émeraude"]},"Azur":{"icon":97299,"s":{"de":30},"g":4,"p":["Indigo","Émeraude"]},"Aigue-marine":{"icon":97300,"s":{"da":30},"g":4,"p":["Ébène","Émeraude"]}},"bico":{"Doré|Pourpre":["Doré et Pourpre",97101],"Doré|Indigo":["Doré et Indigo",97108],"Doré|Ébène":["Doré et Ébène",97110],"Doré|Orchidée":["Doré et Orchidée",97105],"Doré|Roux":["Roux et Doré",97115],"Doré|Amande":["Doré et Amande",97121],"Doré|Ivoire":["Doré et Ivoire",97126],"Doré|Turquoise":["Turquoise et Doré",97145],"Doré|Prune":["Prune et Doré",97150],"Doré|Émeraude":["Doré et Émeraude",97160],"Doré|Ambre":["Ambre et Doré",97301],"Doré|Corail":["Corail et Doré",97315],"Doré|Azur":["Azur et Doré",97328],"Doré|Aigue-marine":["Aigue-marine et Doré",97340],"Pourpre|Indigo":["Indigo et Pourpre",97102],"Pourpre|Ébène":["Ébène et Pourpre",97103],"Pourpre|Orchidée":["Orchidée et Pourpre",97104],"Pourpre|Roux":["Roux et Pourpre",97111],"Pourpre|Amande":["Pourpre et Amande",97117],"Pourpre|Ivoire":["Pourpre et Ivoire",97122],"Pourpre|Turquoise":["Turquoise et Pourpre",97140],"Pourpre|Prune":["Prune et Pourpre",97146],"Pourpre|Émeraude":["Pourpre et Émeraude",97156],"Pourpre|Ambre":["Ambre et Pourpre",97304],"Pourpre|Corail":["Corail et Pourpre",97318],"Pourpre|Azur":["Azur et Pourpre",97331],"Pourpre|Aigue-marine":["Aigue-marine et Pourpre",97343],"Indigo|Ébène":["Ébène et Indigo",97109],"Indigo|Orchidée":["Indigo et Orchidée",97106],"Indigo|Roux":["Roux et Indigo",97113],"Indigo|Amande":["Indigo et Amande",97119],"Indigo|Ivoire":["Indigo et Ivoire",97124],"Indigo|Turquoise":["Turquoise et Indigo",97141],"Indigo|Prune":["Prune et Indigo",97148],"Indigo|Émeraude":["Indigo et Émeraude",97158],"Indigo|Ambre":["Ambre et Indigo",97303],"Indigo|Corail":["Corail et Indigo",97317],"Indigo|Azur":["Azur et Indigo",97330],"Indigo|Aigue-marine":["Aigue-marine et Indigo",97342],"Ébène|Orchidée":["Ébène et Orchidée",97107],"Ébène|Roux":["Roux et Ébène",97114],"Ébène|Amande":["Ébène et Amande",97120],"Ébène|Ivoire":["Ébène et Ivoire",97125],"Ébène|Turquoise":["Turquoise et Ébène",97142],"Ébène|Prune":["Prune et Ébène",97149],"Ébène|Émeraude":["Ébène et Émeraude",97159],"Ébène|Ambre":["Ambre et Ébène",97302],"Ébène|Corail":["Corail et Ébène",97316],"Ébène|Azur":["Azur et Ébène",97329],"Ébène|Aigue-marine":["Aigue-marine et Ébène",97341],"Orchidée|Roux":["Roux et Orchidée",97112],"Orchidée|Amande":["Orchidée et Amande",97118],"Orchidée|Ivoire":["Orchidée et Ivoire",97123],"Orchidée|Turquoise":["Turquoise et Orchidée",97165],"Orchidée|Prune":["Prune et Orchidée",97147],"Orchidée|Émeraude":["Orchidée et Émeraude",97157],"Orchidée|Ambre":["Ambre et Orchidée",97305],"Orchidée|Corail":["Corail et Orchidée",97319],"Orchidée|Azur":["Azur et Orchidée",97332],"Orchidée|Aigue-marine":["Aigue-marine et Orchidée",97344],"Roux|Amande":["Roux et Amande",97116],"Roux|Ivoire":["Roux et Ivoire",97127],"Roux|Turquoise":["Turquoise et Roux",97143],"Roux|Prune":["Prune et Roux",97151],"Roux|Émeraude":["Roux et Émeraude",97161],"Roux|Ambre":["Ambre et Roux",97307],"Roux|Corail":["Corail et Roux",97321],"Roux|Azur":["Azur et Roux",97334],"Roux|Aigue-marine":["Aigue-marine et Roux",97346],"Amande|Ivoire":["Amande et Ivoire",97138],"Amande|Turquoise":["Turquoise et Amande",97144],"Amande|Prune":["Prune et Amande",97152],"Amande|Émeraude":["Amande et Émeraude",97162],"Amande|Ambre":["Ambre et Amande",97306],"Amande|Corail":["Corail et Amande",97320],"Amande|Azur":["Azur et Amande",97333],"Amande|Aigue-marine":["Aigue-marine et Amande",97345],"Ivoire|Turquoise":["Turquoise et Ivoire",97139],"Ivoire|Prune":["Prune et Ivoire",97153],"Ivoire|Émeraude":["Ivoire et Émeraude",97163],"Ivoire|Ambre":["Ambre et Ivoire",97308],"Ivoire|Corail":["Corail et Ivoire",97322],"Ivoire|Azur":["Azur et Ivoire",97335],"Ivoire|Aigue-marine":["Aigue-marine et Ivoire",97347],"Turquoise|Prune":["Prune et Turquoise",97154],"Turquoise|Émeraude":["Turquoise et Émeraude",97164],"Turquoise|Ambre":["Ambre et Turquoise",97309],"Turquoise|Corail":["Corail et Turquoise",97323],"Turquoise|Azur":["Azur et Turquoise",97336],"Turquoise|Aigue-marine":["Aigue-marine et Turquoise",97348],"Prune|Émeraude":["Prune et Émeraude",97155],"Prune|Ambre":["Ambre et Prune",97311],"Prune|Corail":["Corail et Prune",97325],"Prune|Azur":["Azur et Prune",97338],"Prune|Aigue-marine":["Aigue-marine et Prune",97350],"Émeraude|Ambre":["Ambre et Émeraude",97310],"Émeraude|Corail":["Corail et Émeraude",97324],"Émeraude|Azur":["Azur et Émeraude",97337],"Émeraude|Aigue-marine":["Aigue-marine et Émeraude",97349],"Ambre|Corail":["Ambre et Corail",97312],"Ambre|Azur":["Ambre et Azur",97313],"Ambre|Aigue-marine":["Ambre et Aigue-marine",97314],"Corail|Azur":["Corail et Azur",97326],"Corail|Aigue-marine":["Corail et Aigue-marine",97327],"Azur|Aigue-marine":["Azur et Aigue-marine",97339]}},"vk":{"name":"Volkorne","base":{"pa":1},"cols":{"Pourpre":{"icon":97178,"s":{"fo":70},"g":1},"Orchidée":{"icon":97179,"s":{"ine":70},"g":1},"Indigo":{"icon":97176,"s":{"cha":70},"g":1},"Ébène":{"icon":97177,"s":{"age":70},"g":1},"Doré":{"icon":97186,"s":{"vit":150},"g":2,"p":["Pourpre","Indigo"]},"Jade":{"icon":97187,"s":{"rt":12},"g":2,"p":["Pourpre","Ébène"]},"Rubis":{"icon":97188,"s":{"rf":12},"g":2,"p":["Orchidée","Pourpre"]},"Saphir":{"icon":97189,"s":{"re":12},"g":2,"p":["Indigo","Orchidée"]},"Améthyste":{"icon":97190,"s":{"ra":12},"g":2,"p":["Ébène","Indigo"]},"Ivoire":{"icon":97182,"s":{"rpa":30},"g":3,"p":["Jade","Rubis"]},"Turquoise":{"icon":97183,"s":{"rpm":30},"g":3,"p":["Saphir","Améthyste"]},"Roux":{"icon":97180,"s":{"do":15},"g":3,"p":["Doré","Jade"]},"Amande":{"icon":97181,"s":{"fui":40},"g":3,"p":["Doré","Saphir"]},"Émeraude":{"icon":97185,"s":{"cri":7},"g":4,"p":["Ivoire","Turquoise"]},"Prune":{"icon":97184,"s":{"dcri":20},"g":4,"p":["Roux","Amande"]}},"bico":{"Pourpre|Orchidée":["Pourpre et Orchidée",97191],"Pourpre|Indigo":["Pourpre et Indigo",97192],"Pourpre|Ébène":["Pourpre et Ébène",97193],"Pourpre|Doré":["Doré et Pourpre",97235],"Pourpre|Jade":["Jade et Pourpre",97239],"Pourpre|Rubis":["Rubis et Pourpre",97253],"Pourpre|Saphir":["Saphir et Pourpre",97264],"Pourpre|Améthyste":["Améthyste et Pourpre",97276],"Pourpre|Ivoire":["Ivoire et Pourpre",97210],"Pourpre|Turquoise":["Turquoise et Pourpre",97215],"Pourpre|Roux":["Roux et Pourpre",97204],"Pourpre|Amande":["Amande et Pourpre",97197],"Pourpre|Émeraude":["Émeraude et Pourpre",97226],"Pourpre|Prune":["Prune et Pourpre",97219],"Orchidée|Indigo":["Orchidée et Indigo",97194],"Orchidée|Ébène":["Orchidée et Ébène",97195],"Orchidée|Doré":["Doré et Orchidée",97236],"Orchidée|Jade":["Jade et Orchidée",97240],"Orchidée|Rubis":["Rubis et Orchidée",97254],"Orchidée|Saphir":["Saphir et Orchidée",97265],"Orchidée|Améthyste":["Améthyste et Orchidée",97277],"Orchidée|Ivoire":["Ivoire et Orchidée",97211],"Orchidée|Turquoise":["Turquoise et Orchidée",97216],"Orchidée|Roux":["Roux et Orchidée",97205],"Orchidée|Amande":["Amande et Orchidée",97198],"Orchidée|Émeraude":["Émeraude et Orchidée",97227],"Orchidée|Prune":["Prune et Orchidée",97220],"Indigo|Ébène":["Indigo et Ébène",97196],"Indigo|Doré":["Doré et Indigo",97237],"Indigo|Jade":["Jade et Indigo",97241],"Indigo|Rubis":["Rubis et Indigo",97255],"Indigo|Saphir":["Saphir et Indigo",97266],"Indigo|Améthyste":["Améthyste et Indigo",97278],"Indigo|Ivoire":["Ivoire et Indigo",97212],"Indigo|Turquoise":["Turquoise et Indigo",97217],"Indigo|Roux":["Roux et Indigo",97206],"Indigo|Amande":["Amande et Indigo",97199],"Indigo|Émeraude":["Émeraude et Indigo",97228],"Indigo|Prune":["Prune et Indigo",97221],"Ébène|Doré":["Doré et Ébène",97238],"Ébène|Jade":["Jade et Ébène",97242],"Ébène|Rubis":["Rubis et Ébène",97256],"Ébène|Saphir":["Saphir et Ébène",97267],"Ébène|Améthyste":["Améthyste et Ébène",97279],"Ébène|Ivoire":["Ivoire et Ébène",97213],"Ébène|Turquoise":["Turquoise et Ébène",97218],"Ébène|Roux":["Roux et Ébène",97207],"Ébène|Amande":["Amande et Ébène",97200],"Ébène|Émeraude":["Émeraude et Ébène",97229],"Ébène|Prune":["Prune et Ébène",97222],"Doré|Jade":["Jade et Doré",97249],"Doré|Rubis":["Rubis et Doré",97263],"Doré|Saphir":["Saphir et Doré",97274],"Doré|Améthyste":["Améthyste et Doré",97286],"Doré|Ivoire":["Doré et Ivoire",97293],"Doré|Turquoise":["Doré et Turquoise",97294],"Doré|Roux":["Doré et Roux",97291],"Doré|Amande":["Doré et Amande",97292],"Doré|Émeraude":["Doré et Émeraude",97296],"Doré|Prune":["Doré et Prune",97295],"Jade|Rubis":["Jade et Rubis",97250],"Jade|Saphir":["Jade et Saphir",97251],"Jade|Améthyste":["Jade et Améthyste",97252],"Jade|Ivoire":["Jade et Ivoire",97245],"Jade|Turquoise":["Jade et Turquoise",97246],"Jade|Roux":["Jade et Roux",97244],"Jade|Amande":["Jade et Amande",97243],"Jade|Émeraude":["Jade et Émeraude",97248],"Jade|Prune":["Jade et Prune",97247],"Rubis|Saphir":["Rubis et Saphir",97289],"Rubis|Améthyste":["Rubis et Améthyste",97290],"Rubis|Ivoire":["Rubis et Ivoire",97259],"Rubis|Turquoise":["Rubis et Turquoise",97260],"Rubis|Roux":["Rubis et Roux",97258],"Rubis|Amande":["Rubis et Amande",97257],"Rubis|Émeraude":["Rubis et Émeraude",97262],"Rubis|Prune":["Rubis et Prune",97261],"Saphir|Améthyste":["Saphir et Améthyste",97275],"Saphir|Ivoire":["Saphir et Ivoire",97270],"Saphir|Turquoise":["Saphir et Turquoise",97271],"Saphir|Roux":["Saphir et Roux",97269],"Saphir|Amande":["Saphir et Amande",97268],"Saphir|Émeraude":["Saphir et Émeraude",97273],"Saphir|Prune":["Saphir et Prune",97272],"Améthyste|Ivoire":["Améthyste et Ivoire",97282],"Améthyste|Turquoise":["Améthyste et Turquoise",97283],"Améthyste|Roux":["Améthyste et Roux",97281],"Améthyste|Amande":["Améthyste et Amande",97280],"Améthyste|Émeraude":["Améthyste et Émeraude",97285],"Améthyste|Prune":["Améthyste et Prune",97284],"Ivoire|Turquoise":["Ivoire et Turquoise",97214],"Ivoire|Roux":["Roux et Ivoire",97208],"Ivoire|Amande":["Amande et Ivoire",97202],"Ivoire|Émeraude":["Émeraude et Ivoire",97233],"Ivoire|Prune":["Prune et Ivoire",97288],"Turquoise|Roux":["Roux et Turquoise",97209],"Turquoise|Amande":["Amande et Turquoise",97203],"Turquoise|Émeraude":["Émeraude et Turquoise",97234],"Turquoise|Prune":["Prune et Turquoise",97224],"Roux|Amande":["Amande et Roux",97201],"Roux|Émeraude":["Émeraude et Roux",97231],"Roux|Prune":["Prune et Roux",97287],"Amande|Émeraude":["Émeraude et Amande",97230],"Amande|Prune":["Prune et Amande",97223],"Émeraude|Prune":["Prune et Émeraude",97225]}}};
  /* /DATA */
  E.MOUNTS = MOUNTS;
  /* Espèces : sous-zone sauvage, niveau de héros requis, chance de capture par victoire (avec un filet),
     base de la courbe d'XP (un héros du niveau de la zone, part de 40 %, monte sa monture au niveau 100 en 6 h environ). */
  E.MOUNT_SP = {
    dd: { sub: "can_plaines", req: 60,  rate: 1 / 80,  xp: 5000,  wild: ["Rousse", "Amande", "Dorée"] },
    mu: { sub: "oto_plaines", req: 100, rate: 1 / 240, xp: 12000, wild: ["Doré", "Pourpre", "Indigo", "Ébène", "Orchidée"] },
    vk: { sub: "sak_plaine",  req: 180, rate: 1 / 400, xp: 18000, wild: ["Pourpre", "Orchidée", "Indigo", "Ébène"] },
  };
  E.MOUNT_ORDER = ["dd", "mu", "vk"];
  E.MOUNT_LVL = 60; E.MOUNT_MAX = 100;
  E.NET_COST = 2000;                       // filet de capture, à l'unité
  E.STABLE = 10; E.STABLE_ENCLOS = 10;     // places à l'écurie, + 10 avec l'enclos
  E.ENCLOS_COST = 50000;
  E.BIRTH_MS = 8 * 3600e3; E.BIRTH_FAST_MS = 6 * 3600e3;
  E.KIDS = 3; E.BREED_LVL = 50;
  E.MOUNT_SHARES = [0, 10, 25, 40, 60, 90]; E.MOUNT_SHARE_DEF = 40;
  E.STABLE_XP = 0.1;                       // Mangeoire : part de l'XP moyenne de l'équipe pour les montures à l'écurie
  E.ODDS = { known: [25, 35, 35, 5], free: [0, 45, 45, 10] }; // [nouvelle couleur, parent A, parent B, bicolore] en %

  /* ---------- couleurs ---------- */
  const spOf = (M) => MOUNTS[M.sp];
  const isBico = (c) => c.includes("|");
  E.isBico = isBico;
  E.bicoKey = (sp, a, b) => (MOUNTS[sp].bico[`${a}|${b}`] ? `${a}|${b}` : MOUNTS[sp].bico[`${b}|${a}`] ? `${b}|${a}` : null);
  E.colourName = (sp, c) => (isBico(c) ? MOUNTS[sp].bico[c][0] : c);
  E.mountName = (M) => `${spOf(M).name} ${E.colourName(M.sp, M.c)}`;
  E.mountIcon = (sp, c) => (isBico(c) ? MOUNTS[sp].bico[c][1] : MOUNTS[sp].cols[c].icon);
  /* bonus au niveau 100 : base de l'espèce + stat de la couleur (deux tiers de chaque couleur pour un bicolore) */
  E.mountStatsMax = (sp, c) => {
    const Sp = MOUNTS[sp]; const o = Object.assign({}, Sp.base);
    const add = (s, f) => { for (const k in s) o[k] = (o[k] || 0) + Math.round(s[k] * f); };
    if (isBico(c)) c.split("|").forEach((x) => add(Sp.cols[x].s, 2 / 3)); else add(Sp.cols[c].s, 1);
    return o;
  };
  const WHOLE = ["pa", "pm", "inv"]; // PA, PM, Invocation : seulement au niveau 100
  E.mountStatsAt = (M) => {
    const mx = E.mountStatsMax(M.sp, M.c); const o = {};
    for (const k in mx) o[k] = WHOLE.includes(k) ? (M.lvl >= E.MOUNT_MAX ? mx[k] : 0) : Math.max(1, Math.round(mx[k] * Math.min(E.MOUNT_MAX, M.lvl) / E.MOUNT_MAX));
    return o;
  };
  /* première couleur d'un bicolore : celle qu'il transmet à l'élevage */
  E.mainColour = (c) => (isBico(c) ? c.split("|")[0] : c);
  E.gen = (sp, c) => (isBico(c) ? Math.max(...c.split("|").map((x) => MOUNTS[sp].cols[x].g)) : MOUNTS[sp].cols[c].g);

  /* ---------- écurie ---------- */
  E.mountOf = (S, c) => { const M = c && c.mount != null && S.mounts && S.mounts[c.mount]; return M && MOUNTS[M.sp] ? M : null; };
  E.mountOwner = (S, uid) => S.chars.find((c) => c.mount === uid);
  E.mountReq = (M) => Math.max(E.MOUNT_LVL, E.MOUNT_SP[M.sp].req);
  /* un montilier prend la place de la monture */
  E.mountBlocked = (S, c) => { const P = E.petOf ? E.petOf(S, c) : null; return !!(P && E.isMonti && E.isMonti(P.id)); };
  E.mountStats = (S, c) => { const M = E.mountOf(S, c); return M && c.lvl >= E.mountReq(M) && !E.mountBlocked(S, c) ? E.mountStatsAt(M) : null; };
  E.stableCap = (S) => E.STABLE + (S.enclos && S.enclos.built ? E.STABLE_ENCLOS : 0);
  E.stableN = (S) => Object.keys(S.mounts || {}).length;
  E.equipMount = (S, cid, uid) => {
    const c = S.chars.find((x) => x.id === cid); if (!c) return "Héros introuvable.";
    if (uid == null) { delete c.mount; E.emit(S, "equip", {}); return null; }
    const M = S.mounts[uid]; if (!M) return "Monture introuvable.";
    if (c.lvl < E.mountReq(M)) return `Niveau ${E.mountReq(M)} requis pour monter un${M.sp === "dd" ? "e " : " "}${spOf(M).name}.`;
    if (E.mountBlocked(S, c)) return "Ce héros chevauche un montilier : retirez-le d'abord.";
    const o = E.mountOwner(S, uid); if (o) delete o.mount;
    c.mount = uid; if (c.mountShare == null) c.mountShare = M.lvl >= E.MOUNT_MAX ? 0 : E.MOUNT_SHARE_DEF;
    E.emit(S, "equip", {}); return null;
  };
  E.mountShare = (S, c) => { const M = E.mountOf(S, c); if (!M || M.lvl >= E.MOUNT_MAX) return 0; return c.lvl >= E.MAX_LVL ? 100 : (c.mountShare == null ? E.MOUNT_SHARE_DEF : c.mountShare); };
  E.setMountShare = (S, cid, v) => { const c = S.chars.find((x) => x.id === cid); if (c && E.MOUNT_SHARES.includes(+v)) c.mountShare = +v; };
  E.seeColour = (S, sp, c) => { (S.mountSeen[sp] = S.mountSeen[sp] || {})[c] = 1; };
  E.giveMount = (S, sp, c, why, opts = {}) => {
    if (!MOUNTS[sp] || !(isBico(c) ? MOUNTS[sp].bico[c] : MOUNTS[sp].cols[c])) return null;
    if (E.stableN(S) >= E.stableCap(S)) { if (!opts.quiet) note(S, `Écurie pleine (${E.stableCap(S)} places) : ${MOUNTS[sp].name} ${E.colourName(sp, c)} relâché${sp === "dd" ? "e" : ""}.`, "warn"); return null; }
    const uid = S.mountUid++; const M = S.mounts[uid] = { uid, sp, c, lvl: 1, xp: 0, kids: 0, got: E.now() };
    const neu = !(S.mountSeen[sp] && S.mountSeen[sp][c]); E.seeColour(S, sp, c);
    note(S, `${neu ? "Nouvelle couleur : " : "Monture : "}${E.mountName(M)}${why ? " (" + why + ")" : ""} !`, "rare");
    E.celebrate({ t: "mount", uid, neu });
    return M;
  };
  /* capture : dans la zone sauvage de l'espèce, avec un filet dans le sac ; le filet ne part que si la capture réussit */
  E.mountHunt = (S, sid) => {
    const sp = E.MOUNT_ORDER.find((k) => E.MOUNT_SP[k].sub === sid); if (!sp) return null;
    if (!(S.cons.filet > 0) || rnd() >= E.MOUNT_SP[sp].rate) return null;
    if (E.stableN(S) >= E.stableCap(S)) return null; // écurie pleine : le filet n'est pas perdu
    const wild = E.MOUNT_SP[sp].wild; const c = wild[Math.floor(rnd() * wild.length)];
    const M = E.giveMount(S, sp, c, "capturé au filet"); if (!M) return null;
    S.cons.filet--; if (!S.cons.filet) delete S.cons.filet;
    S.stats.captures = (S.stats.captures || 0) + 1;
    return M;
  };
  E.buyNets = (S, n) => {
    n = Math.max(1, n | 0); const cost = n * E.NET_COST;
    if (S.kamas < cost) return `Il faut ${cost.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= cost; E.addCons(S, "filet", n); return null;
  };

  /* ---------- expérience ---------- */
  E.mountXpNeed = (sp, l) => Math.round(E.MOUNT_SP[sp].xp * (1 + l / 20));
  E.giveMountXp = (S, M, g) => {
    if (M.lvl >= E.MOUNT_MAX || g <= 0) return false;
    M.xp += g; let up = false;
    while (M.lvl < E.MOUNT_MAX && M.xp >= E.mountXpNeed(M.sp, M.lvl)) { M.xp -= E.mountXpNeed(M.sp, M.lvl); M.lvl++; up = true; }
    if (M.lvl >= E.MOUNT_MAX) { M.xp = 0; const o = E.mountOwner(S, M.uid); if (o) o.mountShare = 0; note(S, `${E.mountName(M)} atteint le niveau ${E.MOUNT_MAX} : bonus au maximum${o ? `, ${o.name} garde toute son XP` : ""}.`, "up"); }
    if (up) { const o = E.mountOwner(S, M.uid); if (o) E.refreshSpells(o, E.charStats(S, o)); }
    return up;
  };
  /* part d'XP du héros donnée à sa monture (retourne ce que le héros ne garde pas) */
  E.mountXpShare = (S, c, g) => {
    const M = E.mountOf(S, c); const sh = E.mountShare(S, c); if (!M || !sh || g <= 0) return 0;
    const mg = Math.round(g * sh / 100); E.giveMountXp(S, M, mg); return mg;
  };
  /* Mangeoire : les montures à l'écurie (non montées) reçoivent une part de l'XP moyenne de l'équipe */
  E.stableXp = (S, avg) => {
    if (!avg || !E.furnBonus || !E.furnBonus(S, "mxp")) return;
    for (const uid in S.mounts) { const M = S.mounts[uid]; if (!E.mountOwner(S, +uid) && M.lvl < E.MOUNT_MAX) E.giveMountXp(S, M, Math.round(avg * E.STABLE_XP)); }
  };

  /* ---------- enclos ---------- */
  E.buildEnclos = (S) => {
    if (S.enclos.built) return "L'enclos est déjà construit.";
    if (S.kamas < E.ENCLOS_COST) return `Il faut ${E.ENCLOS_COST.toLocaleString("fr-FR")} kamas.`;
    S.kamas -= E.ENCLOS_COST; S.enclos.built = true; note(S, "L'enclos est construit : l'écurie gagne 10 places et les naissances peuvent commencer.", "up"); return null;
  };
  E.kidsCap = (S) => E.KIDS + (E.furnBonus ? E.furnBonus(S, "kids") : 0);
  E.pairCap = (S) => 1 + (E.furnBonus ? E.furnBonus(S, "pair2") : 0);
  E.birthMs = (S) => (E.furnBonus && E.furnBonus(S, "birth") ? E.BIRTH_FAST_MS : E.BIRTH_MS);
  E.inPair = (S, uid) => S.enclos.pairs.some((p) => p.a === uid || p.b === uid);
  /* pourquoi une monture ne peut pas se reproduire (null si elle peut) */
  E.breedWhy = (S, M) => (M.lvl < E.BREED_LVL ? `niveau ${E.BREED_LVL} requis` : M.kids >= E.kidsCap(S) ? "a eu tous ses petits" : E.inPair(S, M.uid) ? "déjà à l'enclos" : null);
  /* la couleur que donne un couple : recette connue (parents de la couleur) ou rien */
  E.childOf = (sp, a, b) => { a = E.mainColour(a); b = E.mainColour(b); const cols = MOUNTS[sp].cols;
    return Object.keys(cols).find((c) => cols[c].p && ((cols[c].p[0] === a && cols[c].p[1] === b) || (cols[c].p[0] === b && cols[c].p[1] === a))) || null; };
  E.breedOdds = (S, A, B) => {
    const child = E.childOf(A.sp, A.c, B.c); const o = child ? E.ODDS.known : E.ODDS.free;
    const a = E.mainColour(A.c), b = E.mainColour(B.c); const bk = E.bicoKey(A.sp, a, b);
    const list = []; if (child) list.push([child, o[0], true]); list.push([a, o[1]], [b, o[2]]);
    if (bk && a !== b) list.push([bk, o[3]]); else list[list.length - 1][1] += o[3];
    return list;
  };
  E.startBreed = (S, ua, ub) => {
    if (!S.enclos.built) return "Construisez d'abord l'enclos.";
    const A = S.mounts[ua], B = S.mounts[ub]; if (!A || !B || A === B) return "Choisissez deux montures.";
    if (A.sp !== B.sp) return "Les deux montures doivent être de la même espèce.";
    if (S.enclos.pairs.length >= E.pairCap(S)) return "L'enclos est occupé : attendez la naissance.";
    for (const M of [A, B]) { const w = E.breedWhy(S, M); if (w) return `${E.mountName(M)} : ${w}.`; }
    S.enclos.pairs.push({ a: ua, b: ub, t: E.birthMs(S) });
    note(S, `${E.mountName(A)} et ${E.mountName(B)} sont à l'enclos : naissance dans ${Math.round(E.birthMs(S) / 3600e3)} h.`, "info"); return null;
  };
  E.stopBreed = (S, i) => { const p = S.enclos.pairs[i]; if (!p) return "Couple introuvable."; S.enclos.pairs.splice(i, 1); return null; };
  const birth = (S, p) => {
    const A = S.mounts[p.a], B = S.mounts[p.b]; if (!A || !B) return true; // monture disparue : couple annulé
    if (E.stableN(S) >= E.stableCap(S)) { if (!p.wait) { p.wait = true; note(S, "Un petit attend à l'enclos : l'écurie est pleine.", "warn"); } return false; }
    const odds = E.breedOdds(S, A, B); let r = rnd() * 100; let c = odds[odds.length - 1][0];
    for (const [col, pc] of odds) { if (r < pc) { c = col; break; } r -= pc; }
    A.kids++; B.kids++; S.enclos.births = (S.enclos.births || 0) + 1;
    E.giveMount(S, A.sp, c, `né à l'enclos, ${E.colourName(A.sp, A.c)} + ${E.colourName(B.sp, B.c)}`);
    if (S.enclos.births >= 10 && E.giveFurn) E.giveFurn(S, "Deuxième couple", "succès : 10 naissances");
    return true;
  };
  /* temps réel (ms), en jeu comme hors ligne */
  E.enclosTick = (S, ms) => {
    if (!S.enclos || !S.enclos.pairs.length) return;
    for (const p of S.enclos.pairs) p.t = Math.max(0, p.t - ms);
    S.enclos.pairs = S.enclos.pairs.filter((p) => p.t > 0 || !birth(S, p));
  };
  /* carnet : croisements qui donneraient une couleur jamais vue, avec les deux montures les mieux placées */
  E.nextCrosses = (S, sp) => {
    const cols = MOUNTS[sp].cols; const seen = S.mountSeen[sp] || {}; const out = [];
    const mine = Object.values(S.mounts).filter((M) => M.sp === sp);
    const best = (col) => mine.filter((M) => E.mainColour(M.c) === col && !E.breedWhy(S, M)).sort((x, y) => y.lvl - x.lvl)[0] || null;
    const any = (col) => mine.some((M) => E.mainColour(M.c) === col);
    for (const c in cols) {
      const p = cols[c].p; if (!p || seen[c] || !any(p[0]) || !any(p[1])) continue;
      const A = best(p[0]), B = best(p[1]);
      out.push({ c, p, a: A, b: B, ok: !!(A && B && S.enclos.built && S.enclos.pairs.length < E.pairCap(S)) });
    }
    return out;
  };
  E.mountsBySp = (S, sp) => Object.values(S.mounts).filter((M) => M.sp === sp).sort((x, y) => y.lvl - x.lvl);

  root.MOUNTS_READY = true;
  if (typeof module !== "undefined" && module.exports) module.exports = E;
})(typeof window !== "undefined" ? window : globalThis);
