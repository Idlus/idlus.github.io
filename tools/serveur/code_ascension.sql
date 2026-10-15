-- Teaser « La montée de la 1.1 », sommet. Mathis 15/10/2026 : « je veux que tu créer les codes cadeaux ».
-- Code ASCENSION = 3 h de Sablier de Xélor, pour tous (comptes et parties sans compte), jusqu'au lendemain (heure de Paris).
-- Ne fait rien si le code existe déjà.
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
select 'ASCENSION', '{"s": 3}'::jsonb, 'Le sommet de la montée de la 1.1 : 3 h de Sablier de Xélor !', null,
  (now() at time zone 'Europe/Paris')::date + 1, false, true
where not exists (select 1 from public.gift_codes where code = 'ASCENSION');
select code, reward, ends, accounts_only, active from public.gift_codes where code = 'ASCENSION';
