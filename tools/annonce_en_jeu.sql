-- Annonce en jeu publiée par le workflow « Annonce en jeu » (.github/workflows/annonce-en-jeu.yml).
-- Appelle la même fonction que le bouton « Publier » du panel admin (public.adm_announce, supabase/chat.sql),
-- au nom du compte admin de Mathis (Xener) : bandeau en haut du jeu, message dans le Général, ligne au journal du panel.
-- Variables psql (posées par le workflow) : txt64 (texte en base64), chat (true/false), heures (0 = jusqu'à ce qu'on l'enlève), essai (true = tout annuler).
\set ON_ERROR_STOP 1
\pset footer off
begin;
select public.pseudo_of(u) compte_admin, set_config('request.jwt.claim.sub', u::text, true) is not null s1,
       set_config('request.jwt.claim.role', 'authenticated', true) is not null s2,
       set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) is not null s3
  from (select a.user_id u from public.admins a left join public.profiles p on p.id = a.user_id
        order by (p.pseudo = 'Xener') desc nulls last limit 1) x;
-- ban : oui, non (chat seul) ou libre (bandeau seulement si aucun autre bandeau n'est affiché en ce moment)
select case :'ban' when 'oui' then true when 'non' then false
  else not exists (select 1 from public.announces where banner and (until is null or until > now())) end as bandeau \gset
select public.adm_announce(convert_from(decode(:'txt64', 'base64'), 'UTF8'), :'bandeau'::boolean, :'chat'::boolean, :'heures'::int);
\echo 'Bandeau publié :' :bandeau
select id, until, length(body) caracteres, body from public.announces order by id desc limit 1;
\if :essai
  rollback;
  \echo 'ESSAI : annonce annulée, rien n''a changé sur le serveur.'
\else
  commit;
  \echo 'ANNONCE PUBLIÉE.'
\endif
