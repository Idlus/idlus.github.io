-- Coupe la session de compte qui renouvelle son jeton en boucle (heure de l'appareil fausse, 1.0.29.6) : demande écrite de
-- Mathis le 14/10/2026 (« coupe la session qui se renouvelle en boucle »). Une seule session, et seulement si elle a renouvelé
-- plus de 200 fois sur les 10 dernières minutes (normalement une fois par heure). Ses jetons partent avec elle ; le joueur se
-- reconnecte avec Discord, sa partie est gardée. N'affiche que des nombres.
-- Lancé par le workflow « Serveur OVH », étape couper-boucle.
with s as (
  select session_id, count(*) as n from auth.refresh_tokens
  where created_at >= now() - interval '10 minutes' and session_id is not null
  group by session_id order by n desc limit 1
), d as (
  delete from auth.sessions where id = (select session_id from s where n > 200) returning id
)
select (select coalesce(max(n), 0) from s) as renouvellements_10_min_session_la_plus_active,
       (select count(*) from d) as sessions_coupees;
