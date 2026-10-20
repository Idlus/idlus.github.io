-- ============================================================================
-- Code cadeau AKILEUSS2H (2 h de Sablier, 1 utilisation, comptes seulement, jusqu'au 31/10/2026) et message privé
-- de Xener à Akileuss avec le code. Demande écrite de Mathis du 20/10/2026 : « crée le code AKILEUSS2H pour Akileuss
-- et transmet lui directement » (geste pour le Sablier de l'Ascension, choix B).
-- Lancé seulement par le workflow « Serveur OVH », étape code-akileuss. Rien n'est changé si un des deux comptes manque
-- ou si le code existe déjà.
-- ============================================================================
\set ON_ERROR_STOP 1
begin;
select count(*) = 1 as ok_a from public.profiles where lower(pseudo) = 'akileuss' \gset
select count(*) = 1 as ok_x from public.profiles where lower(pseudo) = 'xener' \gset
select not exists (select 1 from public.gift_codes where code = 'AKILEUSS2H') as ok_c \gset
\if :ok_a
\else
  \echo 'Compte Akileuss introuvable (ou en double) : rien n''est changé.'
  rollback;
  \quit
\endif
\if :ok_x
\else
  \echo 'Compte Xener introuvable (ou en double) : rien n''est changé.'
  rollback;
  \quit
\endif
\if :ok_c
\else
  \echo 'Le code AKILEUSS2H existe déjà : rien n''est changé.'
  rollback;
  \quit
\endif
select id as akileuss from public.profiles where lower(pseudo) = 'akileuss' \gset
select id as xener, pseudo as xpseudo from public.profiles where lower(pseudo) = 'xener' \gset
insert into public.gift_codes (code, reward, msg, max_uses, ends, accounts_only)
  values ('AKILEUSS2H', '{"s": 2}'::jsonb, 'Sablier de l''Ascension', 1, date '2026-10-31', true);
insert into public.chat_msgs (ch, user_id, to_id, pseudo, body)
  values ('p', :'xener', :'akileuss', :'xpseudo',
    'Salut Akileuss ! Merci pour ton signalement sur le Sablier de l''Ascension. Voici un code de 2 h de Sablier : AKILEUSS2H (Options › Code cadeau). Bon jeu !');
select public.alog('code cadeau créé : AKILEUSS2H (2 h de Sablier pour Akileuss, demande de Mathis) et envoyé en message privé');
\echo '== Fait'
select code, reward, max_uses, ends, accounts_only, active from public.gift_codes where code = 'AKILEUSS2H';
select id, ch, length(body) as taille, created_at from public.chat_msgs where ch = 'p' and to_id = :'akileuss' and user_id = :'xener' order by id desc limit 1;
commit;
