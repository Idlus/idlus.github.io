-- Code cadeau de la 1.2 « Les menus ». Mathis 15/10/2026 : « créer moi un code cadeau pour la 1.2 ».
-- MENUS12 = 3 h de Sablier de Xélor, 150 000 kamas, 1 Coffre en or, 30 Bribes de rêve ; pour tous, sans limite, jusqu'au 22/10/2026 inclus.
-- Ne fait rien si le code existe déjà.
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
select 'MENUS12', '{"s": 3, "k": 150000, "c": [["coffre_or", 1]], "x": [["m", "bribes", 30]]}'::jsonb,
  'Merci de jouer à la 1.2 « Les menus » !', null, date '2026-10-22', false, true
where not exists (select 1 from public.gift_codes where code = 'MENUS12');
select code, reward, max_uses, ends, active from public.gift_codes where code = 'MENUS12';
