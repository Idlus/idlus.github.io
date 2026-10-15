-- ============================================================================
-- BOSS DES MONDES — retrait des essais faussés par le bug du Dom de Pin (2.0.6, choix 3B de Mathis, 16/10/2026)
-- Le Dom de Pin et le Lance-Éclair frappaient un % des PV ×1 000 du boss : un essai faisait 50 000 à 110 000 points
-- au lieu de quelques milliers. On retire du boss EN COURS les essais au-dessus de :'SEUIL' points, et leurs points de
-- la barre de PV commune. Les coffres et Fragments déjà reçus restent (ils sont dans les parties).
-- Lancé seulement par le workflow « Serveur OVH » : étape wb-retrait-essai (affiche puis annule tout) ou wb-retrait
-- (avec la phrase de Mathis). Par défaut c'est un ESSAI.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
\set SEUIL 15000
begin;
\echo '== Boss en cours'
select n, wb_name(n) as boss, hp, dmg, started from public.wb_state where id = 1;
\echo '== Essais sur ce boss, du plus fort au plus faible (les 25 premiers)'
select pseudo_of(h.user_id) as joueur, h.points, h.grade, h.lvl, h.at from public.wb_hits h, public.wb_state s where s.id = 1 and h.n = s.n order by h.points desc limit 25;
\echo '== Essais retirés (au-dessus du seuil)'
with x as (delete from public.wb_hits h using public.wb_state s where s.id = 1 and h.n = s.n and h.points > :SEUIL returning h.user_id, h.points)
, t as (select count(*) as essais, coalesce(sum(points), 0) as pts from x)
update public.wb_state s set dmg = greatest(0, s.dmg - t.pts) from t where s.id = 1 returning t.essais, t.pts as points_retires, s.dmg as barre_apres;
select (:'CONFIRMATION' = 'RETIRE LES ESSAIS DU BUG') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
