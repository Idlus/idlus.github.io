-- ============================================================================
-- MAÎTRISE LENTE — reset des Maîtrises dans les classements (choix 5A de Mathis, 16/10/2026)
-- Le jeu remet les Maîtrises à 0 au chargement de chaque partie (E.VERSION 13). Ce fichier retire tout de suite
-- la Maîtrise des classements pour TOUS les comptes, absents compris : niveau classé moins la Maîtrise comptée (mtl),
-- Maîtrise, clés de voûte et code d'arbre retirés des héros, classement par classe plafonné au niveau 200.
-- Lancé seulement par le workflow « Serveur OVH » : étape maitrise-reset-essai (affiche puis annule tout) ou
-- maitrise-reset (avec la phrase de Mathis). Par défaut c'est un ESSAI.
-- ============================================================================
\set ON_ERROR_STOP 1
\set CONFIRMATION 'non'
begin;
\echo '== Avant : comptes avec de la Maîtrise au classement'
select count(*) filter (where mtl > 0) as comptes, coalesce(sum(mtl), 0) as maitrise_totale, max(mtl) as max_compte from public.ladder;
update public.ladder set level = greatest(0, level - mtl), mtl = 0 where mtl > 0;
update public.ladder l set heroes = (
    select coalesce(jsonb_agg((x - 'mt' - 'mc') || case when x ? 'ks' then '{"ks": []}'::jsonb else '{}'::jsonb end order by i), '[]'::jsonb)
    from jsonb_array_elements(l.heroes) with ordinality as e(x, i))
  where exists (select 1 from jsonb_array_elements(l.heroes) x where x ? 'mt' or x ? 'mc');
update public.ladder_class set score = 200 where score > 200;
\echo '== Après'
select count(*) filter (where mtl > 0) as comptes_avec_maitrise,
  (select count(*) from public.ladder l, jsonb_array_elements(l.heroes) x where coalesce((x->>'mt')::int, 0) > 0) as heros_avec_maitrise,
  (select count(*) from public.ladder_class where score > 200) as classes_au_dessus_de_200 from public.ladder;
select (:'CONFIRMATION' = 'RESET DES MAITRISES') as appliquer \gset
\if :appliquer
  commit;
  \echo 'APPLIQUÉ.'
\else
  rollback;
  \echo 'ESSAI seulement : rien n''a été changé (rollback).'
\endif
