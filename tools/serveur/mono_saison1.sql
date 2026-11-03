-- Ouverture de la Saison 1 du Monocompte (03/11/2026). Lancé par l'étape « monocompte-saison1 » de serveur-ovh.yml, sur l'ordre
-- écrit de Mathis seulement (phrase d'installation de la Saison 1), APRÈS une sauvegarde complète de la base.
--  1. clôture la saison de test de la bêta (0) avec mono_adm_fin_saison : chaque héros passe dans l'Éternel du Monocompte, rien
--     n'est effacé (fonction reprenable : on la rappelle jusqu'à etat = 'finie') ;
--  2. crée la Saison 1 (id 1, « Les Fragments du Temps »), ouverte, début 23h10 heure de Paris (Mathis 03/11), sans horloge de test.
--  3. le Monocompte s'ouvre à tous : mono.acces (supabase/monocompte.sql, réappliqué juste avant par l'étape) laisse entrer tout
--     compte connecté dès qu'une vraie saison est ouverte.
-- Relançable : une saison finie ne change plus, la Saison 1 déjà ouverte garde sa date.
\set ON_ERROR_STOP on
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.admins order by user_id limit 1), 'role', 'authenticated')::text, false);
select set_config('request.jwt.claim.sub', (select user_id::text from public.admins order by user_id limit 1), false);
select public.mono_adm_fin_saison(0) from mono.saisons where id = 0 and etat <> 'finie';
select public.mono_adm_fin_saison(0) from mono.saisons where id = 0 and etat <> 'finie';
select public.mono_adm_fin_saison(0) from mono.saisons where id = 0 and etat <> 'finie';
do $$ begin if exists (select 1 from mono.saisons where id = 0 and etat <> 'finie') then raise exception 'la saison de test n''est pas finie : relancer l''étape'; end if; end $$;
select public.mono_adm_saison(1, 'Saison 1', coalesce((select debut from mono.saisons where id = 1), timestamptz '2026-11-03 22:10:00+00'), false, 'ouverte', 'Les Fragments du Temps', 1)
  where not exists (select 1 from mono.saisons where id = 1 and etat in ('ouverte', 'cloture', 'finie'));
select id, nom, etat, test, debut from mono.saisons order by id;
select count(*) as heros_eternel from mono.eternel;
select count(*) as parties_saison_0 from mono.parties where saison = 0;
