-- ============================================================================
-- Eronny (Classique · Saison 1) : partie en ligne et partie validée remises à sa copie du jour 2026-11-12 (prise le 11/11 à
-- 23h02, heure de Paris), 3 minutes avant que le bug corrigé en 2.2.14.20 la remplace par une nouvelle partie.
-- Même effet que le bouton du panel (s1.adm_save_restore) ; son appareil reprendra la version en ligne et gardera l'autre
-- en copie de secours. À lancer seulement avec l'accord écrit de Mathis.
-- Workflow « Serveur OVH » : étape restaurer-eronny-s1-essai (affiche puis annule tout) ou restaurer-eronny-s1 (avec la
-- phrase). Par défaut c'est un ESSAI. N'affiche que des dates et des tailles, jamais la partie.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
begin;
select id as uid from public.profiles where lower(pseudo) = 'eronny' \gset
\echo '== Avant'
select s.updated_at as partie_en_ligne, length(s.data) as taille, o.src_at as partie_validee, j.at as copie, j.lvl as copie_niveaux, j.kamas as copie_kamas, length(j.data) as taille_copie
  from s1.saves s left join s1.saves_ok o on o.user_id = s.user_id left join s1.saves_jour j on j.user_id = s.user_id and j.day = date '2026-11-12'
  where s.user_id = :'uid';
select count(*) = 1 as copie_ok from s1.saves_jour where user_id = :'uid' and day = date '2026-11-12' \gset
\if :copie_ok
\else
  \echo 'Pas de copie du 12/11 : rien n''est changé.'
  rollback;
  \quit
\endif
with d as (select data from s1.saves_jour where user_id = :'uid' and day = date '2026-11-12')
update s1.saves s set data = d.data, meta = s.meta || jsonb_build_object('remise', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')), updated_at = clock_timestamp() from d where s.user_id = :'uid';
update s1.saves_ok o set data = s.data, src_at = s.updated_at, bilan = null, accept = false, at = now() from s1.saves s where o.user_id = :'uid' and s.user_id = :'uid';
select public.alog('Bouclier : partie S1 d''Eronny remise au 11/11 23h02 (bug 2.2.14.20, accord de Mathis)');
\echo '== Après'
select s.updated_at as partie_en_ligne, length(s.data) as taille, o.src_at as partie_validee, length(o.data) as taille_validee,
  (s.data = j.data) as en_ligne_egale_copie, (o.data = j.data) as validee_egale_copie
  from s1.saves s left join s1.saves_ok o on o.user_id = s.user_id left join s1.saves_jour j on j.user_id = s.user_id and j.day = date '2026-11-12'
  where s.user_id = :'uid';
select (:'CONFIRMATION' = 'REMETS ERONNY AU 11/11') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
