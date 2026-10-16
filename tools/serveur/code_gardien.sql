-- 7A du « Bouclier du serveur » (2.1.14) : titre unique « Gardien du serveur » pour le joueur qui a signalé le problème.
-- Code à usage unique, compte obligatoire, tiré au hasard par la base : il n'apparaît ni dans le dépôt ni dans le journal
-- du workflow. Mathis le lit dans son panel (onglet « Codes cadeaux ») et l'envoie lui-même au joueur. Relançable :
-- ne crée rien si un code de ce titre existe déjà.
\set ON_ERROR_STOP on
insert into public.gift_codes (code, reward, msg, max_uses, accounts_only)
select 'GARDIEN' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
       '{"t":"Gardien du serveur"}'::jsonb, 'Merci d''avoir aidé à protéger Idlus !', 1, true
where not exists (select 1 from public.gift_codes where reward ->> 't' = 'Gardien du serveur');
select count(*) as codes_gardien, max(uses) as utilisations from public.gift_codes where reward ->> 't' = 'Gardien du serveur';
