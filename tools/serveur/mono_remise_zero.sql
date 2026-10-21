-- ============================================================================
-- Remise à zéro des parties de la bêta Monocompte (saison de test 0), demande écrite de Mathis le 21/10/2026 :
-- « remettre à zéro les parties Monocompte des testeurs ». Raison : un bug du jeu (corrigé en 2.1.35.1, js/codes.js)
-- redonnait les codes cadeaux du compte Classique à la partie Monocompte (objets niveau 200, kamas, coffres, Sablier).
-- Lancé une fois par le workflow « Serveur OVH », étape monocompte-remise-zero (après une sauvegarde complète de la base
-- et la relance de supabase/monocompte.sql, qui crée les colonnes mono.saisons.gen et mono.saisons.remise).
--
-- Ce que l'outil fait, en UNE transaction (tout ou rien) :
--   1. garde-fous : la saison ouverte est la saison 0 et c'est une saison de test, sinon rien n'est fait ;
--   2. marqueur : mono.saisons.gen passe de 0 à 1 (génération des parties) et mono.saisons.remise = maintenant. Le jeu
--      (2.1.35.2) le lit dans mono_acces : sa partie Monocompte locale d'avant la remise est mise de côté sur l'appareil
--      (copie renommée) et le joueur repart sur « Nouvelle partie de la bêta » ; mono.push refuse une partie d'avant ;
--   3. efface toutes les données de partie de la saison 0 (liste ci-dessous, table par table) ;
--   4. affiche le nombre de lignes par table avant et après (jamais de données de joueurs) et vérifie que tout est vide.
-- Relançable sans danger : si la génération de la saison est déjà 1 (remise faite), l'outil n'efface RIEN (les parties
-- créées après la remise ne sont jamais touchées) et affiche seulement les comptes.
--
-- Gardé (non effacé) : mono.saisons (sauf le marqueur), mono.testeurs, mono.cles et leur journal mono.cles_essais, les amis
-- (public.amis*), les réglages (act_regles, defis, boutique, bureau_reglages, bureau_creneaux), les appareils et paires
-- autorisées du Bureau (anti-multicompte), bureau_prefs et bureau_mp (préférences, messages privés désactivés), les droits
-- cosmétiques d'autres saisons, et toutes les tables du Classique (schéma public).
-- Effacé pour la saison 0 : parties, parties_ok, copies, eternel, bouclier (journal des refus), bons, eclats (registre),
-- collection, cosm_droits gagnés en saison 0 (Boutique temporelle, défis, Serment : payés avec des Éclats effacés), ops,
-- objets, sortis, HdV de saison (hdv, ventes, ordres), echanges, classements (lb_saison, grp_semaine), renforts, renfort_log,
-- Bureau (recherches, salons et tout ce qui en dépend : membres, invitations, combats, membres des combats, butins, journal,
-- discussion ; expéditions et inscriptions ; photos bureau_heros) et les intentions de rendez-vous (sans saison : toutes).
-- Pour une autre remise plus tard : changer « cible » (2, 3…) dans le bloc ci-dessous.
-- ============================================================================
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '10s';

-- garde-fous
do $$ begin
  if mono.saison_ouverte() is distinct from 0 then raise exception 'la saison ouverte n''est pas la saison de test 0 : rien n''est fait'; end if;
  if not (select test from mono.saisons where id = 0) then raise exception 'la saison 0 n''est pas une saison de test : rien n''est fait'; end if;
end $$;

-- tables et lignes concernées (filtre sur la saison 0), et tables gardées (comptées pour contrôle)
create temp table rz_tables (ordre int primary key, t text not null, filtre text not null, efface boolean not null) on commit drop;
insert into rz_tables values
  (1, 'mono.parties', 'saison = 0', true), (2, 'mono.parties_ok', 'saison = 0', true), (3, 'mono.copies', 'saison = 0', true),
  (4, 'mono.eternel', 'saison = 0', true), (5, 'mono.bouclier', 'saison = 0', true), (6, 'mono.bons', 'saison = 0', true),
  (7, 'mono.eclats', 'saison = 0', true), (8, 'mono.collection', 'saison = 0', true), (9, 'mono.cosm_droits', 'saison = 0', true),
  (10, 'mono.ops', 'saison = 0', true), (11, 'mono.sortis', 'saison = 0', true), (12, 'mono.hdv', 'saison = 0', true),
  (13, 'mono.ventes', 'saison = 0', true), (14, 'mono.ordres', 'saison = 0', true), (15, 'mono.echanges', 'saison = 0', true),
  (16, 'mono.objets', 'saison = 0', true), (17, 'mono.lb_saison', 'saison = 0', true), (18, 'mono.grp_semaine', 'saison = 0', true),
  (19, 'mono.renforts', 'saison = 0', true), (20, 'mono.renfort_log', 'saison = 0', true), (21, 'mono.bureau_recherches', 'saison = 0', true),
  (22, 'mono.bureau_butins', 'combat in (select id from mono.bureau_combats where saison = 0)', true),
  (23, 'mono.bureau_combat_membres', 'combat in (select id from mono.bureau_combats where saison = 0)', true),
  (24, 'mono.bureau_combats', 'saison = 0', true),
  (25, 'mono.bureau_invitations', 'salon in (select id from mono.bureau_salons where saison = 0)', true),
  (26, 'mono.bureau_membres', 'salon in (select id from mono.bureau_salons where saison = 0)', true),
  (27, 'mono.bureau_journal', 'salon in (select id from mono.bureau_salons where saison = 0)', true),
  (28, 'mono.bureau_msgs', 'salon in (select id from mono.bureau_salons where saison = 0)', true),
  (29, 'mono.bureau_salons', 'saison = 0', true),
  (30, 'mono.bureau_inscriptions', 'expedition in (select id from mono.bureau_expeditions where saison = 0)', true),
  (31, 'mono.bureau_expeditions', 'saison = 0', true), (32, 'mono.bureau_heros', 'saison = 0', true),
  (33, 'mono.bureau_intentions', 'true', true),
  (50, 'mono.saisons', 'true', false), (51, 'mono.testeurs', 'true', false), (52, 'mono.cles', 'true', false), (53, 'mono.cles_essais', 'true', false),
  (54, 'mono.act_regles', 'true', false), (55, 'mono.defis', 'true', false), (56, 'mono.boutique', 'true', false),
  (57, 'mono.bureau_reglages', 'true', false), (58, 'mono.bureau_creneaux', 'true', false), (59, 'mono.bureau_appareils', 'true', false),
  (60, 'mono.bureau_paires_ok', 'true', false), (61, 'mono.bureau_prefs', 'true', false), (62, 'mono.bureau_mp', 'true', false),
  (63, 'public.amis', 'true', false), (64, 'public.amis_demandes', 'true', false), (65, 'public.amis_presence', 'true', false),
  (66, 'public.amis_invits', 'true', false);
create temp table rz_comptes (ordre int, quand text, lignes bigint) on commit drop;
create temp table rz_fait (fait boolean) on commit drop;
create function pg_temp.rz_compter(p_quand text) returns void language plpgsql as $$ declare r record; n bigint; begin
  for r in select * from rz_tables order by ordre loop
    if to_regclass(r.t) is null then n := null; else execute format('select count(*) from %s where %s', r.t, r.filtre) into n; end if;
    insert into rz_comptes values (r.ordre, p_quand, n);
  end loop;
end $$;
do $$ begin perform pg_temp.rz_compter('avant'); end $$;

-- marqueur et effacement (une seule fois par génération)
do $$ declare cible constant int := 1; g int; r record; begin
  -- verrou sur la ligne de la saison : un envoi de partie en cours (mono.push lit la génération « for share ») finit avant,
  -- les suivants attendent la fin de la remise et lisent la nouvelle génération
  select gen into g from mono.saisons where id = 0 for update;
  if g >= cible then raise notice 'Remise à zéro déjà faite (génération %) : rien n''est effacé.', g; return; end if;
  update mono.saisons set gen = cible, remise = now() where id = 0;
  -- attend les écritures en cours sur ces tables, bloque les nouvelles jusqu'à la fin de la transaction
  for r in select t from rz_tables where efface and to_regclass(t) is not null order by ordre loop
    execute format('lock table %s in share row exclusive mode', r.t);
  end loop;
  for r in select t, filtre from rz_tables where efface and to_regclass(t) is not null order by ordre loop
    execute format('delete from %s where %s', r.t, r.filtre);
  end loop;
  insert into rz_fait values (true);
  raise notice 'Remise à zéro faite : saison 0, génération %.', cible;
end $$;

do $$ begin perform pg_temp.rz_compter('apres'); end $$;
-- contrôle (si la remise vient d'être faite) : plus aucune ligne de la saison 0 dans les tables effacées
do $$ declare n int; begin
  if not exists (select 1 from rz_fait) then return; end if;
  select count(*) into n from rz_comptes c join rz_tables t using (ordre) where t.efface and c.quand = 'apres' and c.lignes > 0;
  if n > 0 then raise exception 'remise incomplète : % table(s) pas vide(s)', n; end if;
end $$;
select t.t as table_, case when t.efface then 'efface (saison 0)' else 'garde' end as action,
       a.lignes as avant, p.lignes as apres
  from rz_tables t join rz_comptes a on a.ordre = t.ordre and a.quand = 'avant' join rz_comptes p on p.ordre = t.ordre and p.quand = 'apres'
  order by t.ordre;
select id as saison, etat, test, gen as generation, remise from mono.saisons where id = 0;
commit;
