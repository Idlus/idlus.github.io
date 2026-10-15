-- Annonce en boucle « le Guide » : demande de Mathis (15/10/2026, « créer moi un message qui sera récurrent dans le chat du jeu
-- pour expliquer qu'il y a un guide »). Chat Général seulement (pas de bandeau), toutes les 2 heures, sans date de fin.
-- Créée exactement comme le bouton du panel (public.adm_loop_save, supabase/annonces_boucle.sql), au nom de Xener : elle
-- apparaît ensuite dans Panel › Annonces › « Annonces en boucle », où Mathis peut la modifier, la mettre en pause ou la supprimer.
-- Ne touche à aucune autre boucle. Refuse si le même texte existe déjà (on peut relancer sans créer de doublon).
-- Lancé par le workflow « Serveur OVH », étape boucle-guide.
\set ON_ERROR_STOP 1
\pset footer off
\set texte 'Perdu dans Idlus ? Le Guide explique tout le jeu : bouton ? en haut de chaque page, ou menu Journal › Guide. La loupe (Ctrl + K sur PC) trouve n''importe quoi.'
begin;
select public.pseudo_of(u) compte_admin, set_config('request.jwt.claim.sub', u::text, true) is not null s1,
       set_config('request.jwt.claim.role', 'authenticated', true) is not null s2,
       set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) is not null s3
  from (select a.user_id u from public.admins a left join public.profiles p on p.id = a.user_id
        order by (p.pseudo = 'Xener') desc nulls last limit 1) x;
select exists (select 1 from public.announce_loops where body = :'texte') as deja \gset
\if :deja
  \echo 'Cette annonce en boucle existe déjà : rien de créé.'
\else
  select coalesce(public.adm_loop_save(null, :'texte', 120, false, true, 10, null, true), 'OK') as resultat \gset
  \echo 'Création :' :resultat
\endif
select id, every_min minutes, banner bandeau, chat, active, next_at, char_length(body) caracteres, left(body, 70) debut
  from public.announce_loops order by id;
commit;
\echo 'BOUCLE GUIDE TERMINÉE.'
