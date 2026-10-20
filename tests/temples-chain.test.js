/* Enchaînement des temples : règles, récompenses et interruptions.
   Lancer : node tests/temples-chain.test.js */
"use strict";
const assert = require("assert");
const E = require("../js/engine.js");
require("../js/systems.js"); require("../js/pets.js"); require("../js/mounts.js"); require("../js/elevage.js");
require("../js/idols.js"); require("../js/renaissance.js"); require("../js/archis.js");
require("../js/welcome.js"); require("../js/defi.js"); require("../js/gboss.js"); require("../js/legendaires.js"); require("../js/songe.js");
require("../js/suivi.js"); require("../js/vie.js");

let t = Date.UTC(2030, 0, 8, 10, 0); E.setClock(() => t);
let seed = 4242; E.setRng(() => { seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; });
const team = (lvl) => { const S = E.newState("Vie", "iop"); S.chars[0].lvl = lvl; ["eni", "feca", "cra"].forEach((k, i) => { E.addChar(S, k, "H" + i, lvl).inTeam = true; }); Object.values(E.SUBS).forEach((s) => (S.progress.wins[s.id] = 20)); return S; };


const D = require('../js/data.js');
function fresh(all=true) {
  t=Date.UTC(2030,0,8,10); seed=4242;
  const S=team(120);
  if(all) D.CLASS_ORDER.filter(k=>!E.templeHero(S,k)).forEach(k=>{E.addChar(S,k,k,120).inTeam=false;});
  S.sub=Object.values(E.SUBS).find(s=>!s.hidden && s.lvl[0]>=60 && s.lvl[1]<=80).id;
  E.startHunt(S,S.sub); return S;
}
function step(S, win=true, dt=E.STEP_MS) {
  if(S.fight && !S.fight.over) S.fight.ents.filter(e=>e.side===(win?'m':'c')).forEach(e=>e.hp=0);
  t+=dt; E.tick(S,dt);
}
function until(S, stop, win=true, dt=E.STEP_MS) {
  for(let i=0;i<1000;i++){step(S,win,dt);if(stop())return;}
  throw Error('combat ou série bloqués');
}
function summary(S){return JSON.parse(JSON.stringify({temple:S.temple,tokens:S.tokens,kamas:S.kamas,res:S.res,items:S.items,chars:S.chars.map(c=>[c.lvl,c.xp]),ach:S.ach,titles:S.titlesExtra,wins:S.stats.wins,fights:S.stats.fights}));}
// Résolution réelle par le moteur, avec résultat forcé pour comparer exactement les récompenses.
const A=fresh(); assert.equal(E.act(A,'templeRunStart'),null);
assert.deepEqual(E.templeRun(A),{current:1,total:D.CLASS_ORDER.length});
assert.ok(E.templeRunStart(A)); assert.ok(E.templeFight(A,'iop'));
until(A,()=>!E.templeRun(A)); assert.equal(Object.keys(A.temple.done).length,D.CLASS_ORDER.length);
const actual=summary(A);
const B=fresh(); for(const cls of E.templeClasses(B)) {
  assert.equal(E.templeFight(B,cls),null); until(B,()=>!!B.temple.done[cls]);
}
assert.deepEqual(actual,summary(B),'récompenses et succès identiques aux défis individuels');
const C=fresh(false); E.templeState(C).done.iop=1; E.templeRunStart(C);
assert.deepEqual(E.templeRun(C),{current:1,total:3}); E.templeRunStop(C);
assert.equal(C.temple.pend,null); assert.equal(E.templeRun(C),null);
const L=fresh(); E.templeRunStart(L); until(L,()=>!!L.temple.fighting);
const combat=L.fight; E.templeRunStop(L); assert.equal(L.fight,combat);
until(L,()=>combat.over); assert.equal(Object.keys(L.temple.done).length,1);
const F=fresh(); E.templeRunStart(F); until(F,()=>!E.templeRun(F),false);
assert.equal(Object.keys(F.temple.done).length,0); assert.equal(F.tokens.doplons||0,0);
for(const change of [s=>s.hunting=false,s=>s.dungeon={},s=>{s.exp=Object.assign(s.exp||{},{on:true,pend:[],pick:0});},s=>s.tresor={cur:{ready:true}},s=>s.sub='invalide',s=>s.chars[0].inTeam=false,s=>t+=864e5]) {
  const S=fresh(); E.templeRunStart(S); change(S); E.tick(S,0); assert.equal(E.templeRun(S),null); assert.equal(S.temple.pend,null);
}
const I=fresh(); E.templeRunStart(I); until(I,()=>!!I.temple.fighting); I.fight=null; E.tick(I,0); assert.equal(E.templeRun(I),null);
const R=fresh(); E.templeRunStart(R); const loaded=E.deserialize(E.serialize(R)); assert.equal(E.templeRun(loaded),null); E.templeRunStop(R);
const O=fresh(); E.templeRunStart(O); E.catchUpGen(O,0).next(); assert.equal(E.templeRun(O),null); assert.equal(O.temple.pend,null);
for(const change of [s=>s.hunting=false,s=>s.dungeon={},s=>{s.exp=Object.assign(s.exp||{},{on:true,pend:[],pick:0});},s=>s.tresor={cur:{ready:true}},s=>E.templeClasses(s).forEach(k=>E.templeState(s).done[k]=1)]) {
  const S=fresh(); change(S); assert.ok(E.templeRunStart(S)); assert.equal(E.templeRun(S),null);
}
const X=fresh(); E.templeRunStart(X); const sub=E.SUBS[X.sub], old=sub.monsters; sub.monsters=[];
try { assert.throws(()=>E.startFight(X)); assert.equal(E.templeRun(X),null); } finally {sub.monsters=old;}
const Q=fresh(); E.templeRunStart(Q); const mk=E.makeGroup; E.makeGroup=()=>{throw Error('erreur simulée');};
try {assert.throws(()=>E.tick(Q,10000),/erreur simulée/);assert.equal(E.templeRun(Q),null);} finally {E.makeGroup=mk;}
const Z=fresh(); E.templeRunStart(Z); const front=E.frontSet;
E.frontSet=()=>{throw Error('erreur après préparation');};
try {assert.throws(()=>E.startFight(Z),/erreur après préparation/);assert.equal(E.templeRun(Z),null);assert.equal(Z.temple.fighting,null);assert.equal(Z.temple.need,false);} finally {E.frontSet=front;}
const V=fresh(); E.templeState(V).streak={n:6,last:E.dayKey(t-864e5)};
E.templeRunStart(V); until(V,()=>!E.templeRun(V));
assert.equal(V.temple.streak.n,7); assert.equal(V.tokens.doplons,actual.tokens.doplons+3);
const W=fresh(); E.templeRunStart(W); const prot=E.protGroup;
E.protGroup=(S)=>{S.temple.pend=null;return null;};
try {E.startFight(W);assert.equal(E.templeRun(W),null);} finally {E.protGroup=prot;}
const H=fresh(); E.templeRunStart(H); until(H,()=>!E.templeRun(H),true,10000); assert.equal(Object.keys(H.temple.done).length,D.CLASS_ORDER.length);
console.log('ok - temples : tous les combats, parité des récompenses, arrêt, défaite, interruptions, restrictions, absence, chargement et erreurs');
