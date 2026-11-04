// 04/11/2026, ordre écrit de Mathis (fil « Vérifier si Kenan triche en Classique S1 ») :
// « on va ban Kenan 7 jours et reset sa sauvegarde, enleve le aussi du classement ».
// Kenan a importé sa partie de l'Éternel dans sa partie Classique · Saison 1. Ce script écrit le SQL (sortie standard) :
//   essai (par défaut) : n'affiche que des chiffres, ne change rien ;
//   node kenan_0411.js VRAI : en UNE transaction, suspension 7 jours, partie S1 remplacée par une partie de saison neuve
//   (meta.remise : la version du serveur s'impose à son appareil, pas d'envoi forcé), partie validée = la neuve, copies S1
//   effacées, retiré des classements de la saison (s1.ladder « compte suspendu », comme le bouton du panel).
//   Sa partie Éternel (public) n'est pas touchée.
const path = require("path");
globalThis.window = globalThis;
const fs = require("fs");
const F = ["gamedata", "armes", "drops", "pieces", "data", "engine", "systems", "pets", "mounts", "elevage", "idols", "renaissance", "maitrise_moteur", "identite", "identmon", "identboss", "archis", "defi", "gboss", "verify", "koli", "legendaires", "dofusp", "collections", "sram", "champions", "wboss", "songe", "alliance", "chroma", "alignement", "honneur", "quetes", "saisonc", "cartes", "histoire", "banniere", "chevauchee", "expes1", "tournoi"]; // comme tools/build_server.js
const q = (fn) => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };
q(() => F.forEach((f) => { const p = path.join(__dirname, "../../js", f + ".js"); if (fs.existsSync(p)) require(p); }));
const E = globalThis.ENGINE;
const S = q(() => E.newState("Kratos", "cra"));
q(() => E.s1cStart(S, Date.UTC(2026, 10, 3, 22, 10)));
if (!E.isS1c(S)) throw new Error("partie de saison non marquée");
const data = E.serialize(S);
const meta = JSON.stringify(q(() => globalThis.VERIFY.fullSummary(E, S))); // résumé calculé comme le serveur (classements)
const vrai = process.argv[2] === "VRAI";
const tag = "$KENANSAVE$";
if (data.includes(tag)) throw new Error("balise dans la partie");
console.log(`\\set ON_ERROR_STOP on
begin;
set local lock_timeout = '10s';
create temp table kn_cfg (kv boolean, kd text, km jsonb) on commit drop;
insert into kn_cfg values (${vrai}, ${tag}${data}${tag}, ${tag}${meta}${tag}::jsonb);
do $$ declare u uuid; n int; m int; t text; c record; vrai boolean := (select kv from kn_cfg); d text := (select kd from kn_cfg); mt jsonb := (select km from kn_cfg); t_at timestamptz; begin
  select count(*) into n from public.profiles where lower(pseudo) = 'kenan';
  if n <> 1 then raise exception 'attendu 1 compte Kenan, trouvé %', n; end if;
  select id into u from public.profiles where lower(pseudo) = 'kenan';
  if exists (select 1 from public.admins where user_id = u) then raise exception 'impossible sur un admin'; end if;
  select level, playtime, flagged, flag_reason into c from s1.ladder where user_id = u;
  raise notice 'classement S1 : niveau %, temps % s, retiré %, raison %', c.level, c.playtime, c.flagged, c.flag_reason;
  raise notice 'partie neuve : % octets', length(d);
  for t in select format('%I.%I', table_schema, table_name) from information_schema.columns where table_schema = 's1' and column_name = 'user_id' and table_name in (select table_name from information_schema.tables where table_schema = 's1' and table_type = 'BASE TABLE') order by 1 loop
    execute format('select count(*) from %s where user_id = $1', t) using u into m;
    if m > 0 then raise notice '% : % ligne(s)', t, m; end if;
  end loop;
  if not vrai then raise notice 'ESSAI : rien n''est changé.'; return; end if;
  -- 1. suspension 7 jours (même effet que le bouton « 7 j » du panel)
  update public.profiles set suspended_at = now(), suspended_until = now() + interval '7 days' where id = u;
  perform public.alog('compte de Kenan suspendu 7 jour(s)');
  -- 2. partie S1 neuve, imposée à l'appareil ; partie validée = la neuve ; copies S1 effacées
  update s1.saves set data = d, meta = mt || jsonb_build_object('remise', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')), updated_at = clock_timestamp() where user_id = u returning updated_at into t_at;
  if t_at is null then raise exception 'pas de partie S1'; end if;
  update s1.saves_ok set data = d, meta = mt, bilan = null, res = null, src_at = t_at, accept = false, at = now() where user_id = u;
  delete from s1.saves_jour where user_id = u; get diagnostics m = row_count; raise notice 's1.saves_jour : % copie(s) effacée(s)', m;
  -- tout le reste de sa saison venu de la partie importée (alignement, chromatiques, élevage, Premiers, classement par classe,
  -- naissances de montures, Songe, Brisage…) ; gardés : sa partie (remise ci-dessus), son classement (retiré ci-dessous), le journal du Bouclier
  for t in select format('%I.%I', table_schema, table_name) from information_schema.columns where table_schema = 's1' and column_name = 'user_id'
      and table_name in (select table_name from information_schema.tables where table_schema = 's1' and table_type = 'BASE TABLE')
      and table_name not in ('saves', 'saves_ok', 'saves_jour', 'ladder', 'bouclier_log') order by 1 loop
    execute format('delete from %s where user_id = $1', t) using u; get diagnostics m = row_count;
    if m > 0 then raise notice '% : % ligne(s) effacée(s)', t, m; end if;
  end loop;
  -- 3. retiré des classements de la saison (revient tout seul à la fin de la suspension, avec sa partie neuve)
  update s1.ladder set flagged = true, verified = false, flag_reason = 'compte suspendu' where user_id = u;
  perform public.alog('Bouclier : partie S1 de Kenan remise à zéro (sauvegarde de l''Éternel importée)');
  raise notice 'FAIT : Kenan suspendu 7 jours, partie S1 remise à zéro, retiré du classement de la saison.';
end $$;
select p.pseudo, p.suspended_until, l.flagged, l.flag_reason, l.level from public.profiles p left join s1.ladder l on l.user_id = p.id where lower(p.pseudo) = 'kenan';
commit;`);
