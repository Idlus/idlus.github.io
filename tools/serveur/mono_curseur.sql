-- 22/10/2026, choix de Mathis « Toutes les parties » : le curseur des opérations (S.hdv.op) des parties Monocompte a sauté sur un
-- numéro du Classique (asc_claim et autres appels Classique, corrigé en 2.1.37.3). Les mono.ops au-dessus de l'ancien curseur ne
-- sont jamais livrées. On remet à 0 le curseur des parties dont il dépasse le dernier numéro de mono.ops (partie et copie vérifiée),
-- avec la marque « remise » pour que le jeu reprenne la version du serveur. Le jeu livre alors ces opérations au chargement.
begin;
set local lock_timeout = '3s';
create temp table _c on commit drop as
  select p.user_id, p.saison from mono.parties p
  where p.saison = 0 and mono.cursor(p.data::jsonb) > coalesce((select max(id) from mono.ops), 0);
select count(*) as parties, coalesce(sum((select count(*) from mono.ops o where o.user_id = c.user_id and o.saison = c.saison)), 0) as operations_a_livrer from _c c;
do $c$ declare r record; begin
  for r in select * from _c loop perform mono.verrou(r.user_id); end loop;
end $c$;
update mono.parties p set data = jsonb_set(p.data::jsonb, '{hdv,op}', '0')::text,
  meta = p.meta || jsonb_build_object('remise', to_char(now() at time zone 'UTC', 'YYYY-MM-DD')), updated_at = clock_timestamp()
  from _c c where p.user_id = c.user_id and p.saison = c.saison;
update mono.parties_ok k set data = jsonb_set(k.data::jsonb, '{hdv,op}', '0')::text
  from _c c where k.user_id = c.user_id and k.saison = c.saison and mono.cursor(k.data::jsonb) > coalesce((select max(id) from mono.ops), 0);
select count(*) as restant from mono.parties p where p.saison = 0 and mono.cursor(p.data::jsonb) > coalesce((select max(id) from mono.ops), 0);
commit;
