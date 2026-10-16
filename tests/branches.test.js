/* 2.1 « Branches lointaines » : chaque nouvel effet agit vraiment en combat et en farm. Lancer : node tests/branches.test.js */
"use strict";
const assert=require("assert");const R="../";
const E=require(R+"js/engine.js");require(R+"js/systems.js");require(R+"js/maitrise_moteur.js");const D=require(R+"js/data.js");
let seed=1;const rng=()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};E.setRng(rng);E.setClock(()=>1760600000000);
const K=["d","t","f","e","a","hp","res","cri","cx","h","t1","low","pa","pm","sh","rev","pass","vv","rv","boss","exe","cre","chd","loot","kam","xp","xpj","rec","champ"];
const zero=()=>{const o={st:{}};K.forEach(k=>o[k]=0);return o;};
const sub=D.ZONES[0].subs[0].id;
function fight(setup,mt,N=60){seed=7;const S=E.newState("T","iop");S.chars[0].lvl=200;E.startHunt(S,sub);E.startFight(S);const F=S.fight;const h=F.ents.find(e=>e.side==="c");const ms=F.ents.filter(e=>e.side==="m");
 ms.forEach(m=>{m.hpMax=m.hp=1e9;});setup&&setup(F,h,ms);h.mt=Object.assign(zero(),mt);
 const hi=F.ents.indexOf(h);let i=0;while(!F.over&&i++<N)E.step(S);
 const dealt={};F.fx.filter(x=>x.k==="hit"&&x.s===hi).forEach(x=>dealt[x.seq]=(dealt[x.seq]||0)+x.v);
 const tot=Object.values(dealt).reduce((a,b)=>a+b,0);return {F,h,ms,tot,hits:F.fx.filter(x=>x.k==="hit"&&x.s===hi).map(x=>x.v),round:F.round};}
const res=[];const ok=(n,c,info)=>{res.push([c?"OK ":"KO ",n,info]);};
// dégâts
let a=fight(null,{}),b;
b=fight((F,h,ms)=>ms.forEach(m=>m.boss=true),{boss:50});let a2=fight((F,h,ms)=>ms.forEach(m=>m.boss=true),{});ok("boss (Chasseur de géants)",Math.abs(b.tot/a2.tot-1.5)<0.02,(b.tot/a2.tot).toFixed(3)+" attendu 1.5");
b=fight((F,h,ms)=>ms.forEach(m=>m.champ="x"),{chd:40});a2=fight((F,h,ms)=>ms.forEach(m=>m.champ="x"),{});ok("Champions (Traqueur)",Math.abs(b.tot/a2.tot-1.4)<0.02,(b.tot/a2.tot).toFixed(3)+" attendu 1.4");
b=fight((F,h,ms)=>ms.forEach(m=>m.hp=1e8),{exe:30});a2=fight((F,h,ms)=>ms.forEach(m=>m.hp=1e8),{});ok("achèvement <30 % (Bourreau)",Math.abs(b.tot/a2.tot-1.3)<0.02,(b.tot/a2.tot).toFixed(3)+" attendu 1.3");
const a3=fight(null,{exe:30});ok("achèvement ignoré au-dessus de 30 %",a3.tot===a.tot,a3.tot+" = "+a.tot);
{const B=fight(null,{cre:5},14),A=fight(null,{},14);const H=(r)=>r.F.fx.filter(x=>x.k==="hit"&&x.s===r.F.ents.indexOf(r.h)).map(x=>x.v);const hb=H(B),ha=H(A);const sum=(x)=>x.reduce((p,q)=>p+q,0);const r0=sum(hb.slice(0,2))/sum(ha.slice(0,2)),r1=sum(hb.slice(-4))/sum(ha.slice(-4));ok("crescendo (Crescendo)",r0<1.03&&r1>1.12,"début ×"+r0.toFixed(3)+", tour "+B.round+" ×"+r1.toFixed(3)+" (+5 % par tour)");}
// vol de vie
b=fight((F,h)=>{h.hp=Math.round(h.hpMax/2);},{vv:5},6);a2=fight((F,h)=>{h.hp=Math.round(h.hpMax/2);},{},6);ok("vol de vie (Sangsue)",b.h.hp>a2.h.hp,"PV "+a2.h.hp+" → "+b.h.hp+" (soin "+(b.h.hp-a2.h.hp)+", dégâts infligés "+b.tot+")");
// renvoi
b=fight((F,h,ms)=>ms.forEach(m=>m.dmg*=300),{rv:20},12);a2=fight((F,h,ms)=>ms.forEach(m=>m.dmg*=300),{},12);const lost=(r)=>r.ms.reduce((s,m)=>s+(m.hpMax-m.hp),0);ok("renvoi (Miroir)",lost(b)>lost(a2),"PV perdus par les monstres "+lost(a2)+" → "+lost(b));
// farm
seed=3;const S=E.newState("T","iop");const c=S.chars[0];c.lvl=200;E.mt(c).lvl=900;const T=E.mtTree("iop");
const path=(to,from)=>{const prev=new Map([[from,-1]]);const q=[from];while(q.length){const x=q.shift();if(x===to)break;for(const y of T.N[x].adj)if(!prev.has(y)&&!T.N[y].neb){prev.set(y,x);q.push(y);}}const p=[];let x=to;while(x!==from){p.push(x);x=prev.get(x);}return p;};
E.MT_GATES.forEach(G=>E.stasisInfo(S,G.did).max=15);E.mtGateSync(S);
const ends=T.N.filter(n=>n.end);
const fx0=E.mtFx(S,c);
const setBr=(name)=>{const en=ends.find(n=>n.br===name);E.mt(c).t[E.mt(c).lo]=path(en.id,T.start);};const noBr=(name)=>{const en=ends.find(n=>n.br===name);E.mt(c).t[E.mt(c).lo]=path(en.id,T.start).filter(i=>T.N[i].d!==6);};
const SUBO=D.ZONES[0].subs[0];const mons=()=>E.makeGroup(S,SUBO,1).map(m=>(m.champ=null,m));
const rew=(name,on)=>{(on?setBr:noBr)(name);seed=11;let k=0,x=0,r=0;for(let i=0;i<300;i++){seed=11+i;const g=mons();seed=500+i;const o=E.giveRewards(S,g,{offline:true});k+=o.kamas;x+=o.xp[c.id]||Object.values(o.xp)[0]||0;r+=Object.values(o.res).reduce((a,b)=>a+b,0)+o.items.length;}return {k,x,r};};
let A=rew("Le Banquier",false),B=rew("Le Banquier",true);setBr("Le Banquier");ok("kamas (Banquier)",B.k/A.k>1.1,"×"+(B.k/A.k).toFixed(3)+" (mtTeam ×"+E.mtTeam(S,[c],"kam").toFixed(3)+")");
A=rew("L'Érudit",false);B=rew("L'Érudit",true);setBr("L'Érudit");ok("XP (Érudit)",B.x/A.x>1.1,"×"+(B.x/A.x).toFixed(3)+" (mtOwn ×"+E.mtOwn(S,c,"xp").toFixed(3)+")");
A=rew("Le Pilleur",false);B=rew("Le Pilleur",true);setBr("Le Pilleur");ok("butin (Pilleur)",B.r/A.r>1.05,"×"+(B.r/A.r).toFixed(3)+" (mtTeam ×"+E.mtTeam(S,[c],"loot").toFixed(3)+")");
const champs=(name,on)=>{(on?setBr:noBr)(name);seed=99;let n=0;for(let i=0;i<20000;i++)n+=E.makeGroup(S,SUBO,1).some(m=>m.champ)?1:0;return n;};
A=champs("Le Traqueur",false);B=champs("Le Traqueur",true);setBr("Le Traqueur");ok("chance de Champion (Traqueur)",B>A,A+" → "+B+" groupes sur 20 000 (×"+E.mtTeam(S,[c],"champ").toFixed(3)+")");
// récolte
const gat=(on)=>{(on?setBr:noBr)("L'Artisan");seed=5;const job=Object.keys(S.jobs)[0];S.jobs[job].lvl=1;S.jobs[job].xp=0;const r0=E.jobRes(job)[0][0];c.job={job,res:r0,prog:0};let q=0;for(let i=0;i<200;i++){c.job.prog=1e6;q+=E.gatherPartial(S,c);}return {q,xp:S.jobs[job].xp+S.jobs[job].lvl*1e6};};
A=gat(false);B=gat(true);setBr("L'Artisan");ok("récolte + XP de métier (Artisan)",B.q>A.q&&B.xp>A.xp,"récolte ×"+(B.q/A.q).toFixed(3)+" (×"+E.mtOwn(S,c,"rec").toFixed(3)+"), XP métier en hausse");

// pénalités des clés de voûte sur la fiche
{const base=()=>{noBr("Le Banquier");return E.charStats(S,c);};const s0=base();setBr("Le Banquier");const s1=E.charStats(S,c);ok("PV −10 % (Coffre d'or)",s1.hpMax<s0.hpMax,s0.hpMax+" → "+s1.hpMax);
noBr("Le Traqueur");const r0=E.charStats(S,c).rf;setBr("Le Traqueur");const r1=E.charStats(S,c).rf;ok("résistances −8 (Grand veneur)",r1===r0-8+ (0),r0+" → "+r1);}
{const sh=(h)=>{const r=fight(null,{h},1);return r.F.fx.filter(x=>x.k==="buff"&&/Bouclier/.test(x.txt||""))[0].txt;};const a=sh(0),b=sh(-25);ok("boucliers −25 % (Soif de sang)",a!==b,a+" → "+b);}

// 2.1 : améliorations de la Maîtrise
{const nts=T.N.filter(n=>n.br&&n.t==="nt"),joys=T.N.filter(n=>n.br&&n.t==="joy");ok("un joyau ◆ à côté de chaque notable de branche (17A)",nts.length>0&&joys.length===nts.length&&joys.every(j=>j.adj.some(y=>T.N[y].t==="nt"&&T.N[y].br===j.br)),nts.length+" notables, "+joys.length+" joyaux");}
{const all=T.N.filter(n=>n.br==="La Sangsue").map(n=>n.id);const need=new Set();all.forEach(id=>path(id,T.start).forEach(x=>need.add(x)));E.mt(c).t[E.mt(c).lo]=[...need];S.titlesExtra=[];E.mtBrSync(S);
 ok("branche complète : titre (9A)",E.mtBrDone(c).some(B=>B.n==="La Sangsue")&&S.titlesExtra.includes("Buveur d'étoiles"),S.titlesExtra.join(","));
 E.mt(c).t[E.mt(c).lo]=[...need].filter(i=>i!==all[all.length-1]);S.titlesExtra=[];ok("branche incomplète : pas de titre",!E.mtBrDone(c).some(B=>B.n==="La Sangsue"),"");}
{E.mt(c).t[E.mt(c).lo]=[];const ks=T.N.find(n=>n.t==="ks"&&!n.neb&&n.gated==null);const L=path(ks.id,T.start).length;const lv=E.mt(c).lvl;E.mt(c).lvl=5;E.mt(c).obj=ks.id;
 const n1=E.mtObjStep(S,c);ok("objectif : place les points libres sur le chemin (12A)",n1===Math.min(L,E.mtPts(c))&&E.mtGot(c).size-1===n1,n1+" posés sur "+L);
 E.mt(c).lvl=lv;E.mtObjStep(S,c);ok("objectif atteint puis retiré",E.mtGot(c).has(ks.id)&&E.mt(c).obj==null,"");E.mt(c).t[E.mt(c).lo]=[];}
{noBr("L'Artisan");const a=E.mtOwn(S,c,"rec");const art=T.N.filter(n=>n.br==="L'Artisan").map(n=>n.id);const need=new Set();art.forEach(id=>path(id,T.start).forEach(x=>need.add(x)));E.mt(c).t[E.mt(c).lo]=[...need];const b=E.mtOwn(S,c,"rec");ok("Artisan : ~+20 % de récolte (8A)",b/a>1.17&&b/a<1.26,"×"+(b/a).toFixed(3));E.mt(c).t[E.mt(c).lo]=[];}

const ko=res.filter(r=>r[0]==="KO ");if(ko.length){console.log(ko.map(r=>r.join(" ")).join("\n"));process.exit(1);}
console.log(`ok - branches lointaines : ${res.length} effets vérifiés`);
