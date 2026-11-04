-- 2.2.4.9 « Hauts faits par serveur » (Mathis, 04/11) : les hauts faits sont communs à tous les salons, chacun dit maintenant
-- de quel serveur il vient (data.srv : 'e' Éternel, 's' Saison 1). Version Saison 1 de public.chat_ann (supabase/chat.sql) :
-- les fonctions de la saison (search_path s1, public) la trouvent avant celle de public. Elle lit le classement de la SAISON
-- (compte signalé, classe et niveau du héros principal) et écrit dans le chat commun. Fichier propre à la saison (EXTRA de
-- tools/saison_schema.js), jamais installé dans le Classique.
create or replace function s1.chat_ann(p_user uuid, p_data jsonb) returns void language plpgsql security definer set search_path = s1, public
as $$ declare pr record; lad record; begin
  select pseudo into pr from public.profiles where id = p_user;
  select main, main_lvl, flagged into lad from s1.ladder where user_id = p_user;
  if lad.flagged then return; end if;
  insert into public.chat_msgs (ch, user_id, pseudo, cls, lvl, kind, data) values ('g', p_user, pr.pseudo, lad.main, lad.main_lvl, 'ann', p_data || jsonb_build_object('srv', 's'));
end $$;
revoke all on function s1.chat_ann(uuid, jsonb) from public, anon, authenticated;
