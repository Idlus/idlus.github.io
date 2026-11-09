-- Codes cadeaux « top des votes » (09/11/2026, demande de Mathis) : remerciement quand Idlus entre dans le top 3
-- puis le top 2 du classement Dofus Fan Games. Code ouvert à tous (règle DFG : rien de réservé aux votants),
-- une fois par compte et par serveur (Éternel, Saison 1 ; le Monocompte refuse les codes), valable 14 jours.
-- Ne se lance qu'avec les mots de Mathis : étapes code-top3 et code-top2 du workflow « Serveur OVH ».
-- Relançable sans danger : un code déjà créé n'est pas modifié.
\set ON_ERROR_STOP on
\if :{?QUEL}
\else
  \set QUEL 'aucun'
\endif

begin;
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
select 'TOP3VOTES',
       '{"s": 2, "t": "Sur le podium des votes"}'::jsonb,
       'Merci pour vos votes : Idlus est dans le top 3 de Dofus Fan Games !',
       null, (now() at time zone 'Europe/Paris')::date + 14, false, true
where :'QUEL' = 'top3'
on conflict (code) do nothing;

insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only, active)
select 'TOP2VOTES',
       '{"s": 3, "t": "Vice-champion des votes", "x": [["m", "teintures", 5]]}'::jsonb,
       'Merci pour vos votes : Idlus est 2e sur Dofus Fan Games !',
       null, (now() at time zone 'Europe/Paris')::date + 14, false, true
where :'QUEL' = 'top2'
on conflict (code) do nothing;

select code, reward, msg, ends, accounts_only, active, uses from public.gift_codes where code in ('TOP3VOTES', 'TOP2VOTES') order by code;
commit;
