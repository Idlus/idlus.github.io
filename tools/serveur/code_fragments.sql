-- Code cadeau de la bande-annonce du Monocompte (Saison 1 « Les Fragments du Temps »).
-- Mathis 21/10/2026 : « créer et poste en jeu et sur discord ».
-- FRAGMENTS = 3 h de Sablier de Xélor, 150 000 kamas, 1 Coffre en or, 30 Bribes de rêve (serveur Classique) ;
-- pour tous, sans limite, jusqu'au 31/10/2026 inclus. Ne fait rien si le code existe déjà.
\set ON_ERROR_STOP on
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
select 'FRAGMENTS', '{"s": 3, "k": 150000, "c": [["coffre_or", 1]], "x": [["m", "bribes", 30]]}'::jsonb,
  'Merci d''avoir regardé la bande-annonce du Monocompte !', null, date '2026-10-31', false, true
where not exists (select 1 from public.gift_codes where code = 'FRAGMENTS');
select code, reward, max_uses, ends, active from public.gift_codes where code = 'FRAGMENTS';
