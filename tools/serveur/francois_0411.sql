-- 04/11/2026, ordre écrit de Mathis (fil « Bloquer la triche à l'horloge ») : « ban 7 jours, sauvegarde remise a zéro ».
-- Compte « Francois » (Monocompte seulement). CONFIRMATION 'non' = essai : n'affiche que des chiffres, ne change rien.
-- Pour de vrai (étape francois-0411, après une sauvegarde complète de la base), en UNE transaction :
--   1. suspension 7 jours (même effet que le bouton « 7 j » du panel, public.adm_suspend) ;
--   2. partie Monocompte remise à sa toute première copie (la première partie reçue le jour de la création du compte),
--      avec meta.remise : la version en ligne s'impose à l'appareil (comme « Restaurer » du panel, mono_adm_restaurer) ;
--   3. effacés pour la saison ouverte : partie validée, classement de saison, Couronne, renfort, bons de butin, Éclats,
--      collection, droits cosmétiques de la saison, copies. Gardés : journal du Bouclier, HdV et échanges déjà faits.
\set ON_ERROR_STOP on
\set CONFIRMATION 'non'
begin;
set local lock_timeout = '10s';
create temp table fr_cfg (conf text) on commit drop;
insert into fr_cfg values (:'CONFIRMATION');
do $$ declare u uuid; n int; s int := mono.saison_ouverte(); c record; conf text := (select conf from fr_cfg); t text; m int; begin
  select count(*) into n from public.profiles where lower(pseudo) = 'francois';
  if n <> 1 then raise exception 'attendu 1 compte Francois, trouvé %', n; end if;
  select id into u from public.profiles where lower(pseudo) = 'francois';
  if exists (select 1 from public.admins where user_id = u) then raise exception 'impossible sur un admin'; end if;
  raise notice 'saison ouverte : %', s;
  for c in select jour, saison, at, meta ->> 'lvl' lvl, length(data) taille,
      coalesce(((data::jsonb) -> 'stats' ->> 'playtime')::numeric / 3600, -1) h from mono.copies where user_id = u order by jour loop
    raise notice 'copie % (saison %, reçue %) : niveau %, % h de jeu, % octets', c.jour, c.saison, c.at, c.lvl, round(c.h, 2), c.taille;
  end loop;
  foreach t in array array['mono.parties', 'mono.parties_ok', 'mono.lb_saison', 'mono.grp_semaine', 'mono.renforts', 'mono.bons', 'mono.eclats', 'mono.collection', 'mono.cosm_droits', 'mono.copies'] loop
    if to_regclass(t) is null then continue; end if;
    execute format('select count(*) from %s where user_id = $1', t) using u into m;
    raise notice '% : % ligne(s)', t, m;
  end loop;
  if conf <> 'REMETS FRANCOIS A ZERO' then raise notice 'ESSAI : rien n''est changé.'; return; end if;
  select * into c from mono.copies where user_id = u and saison = s order by jour limit 1;
  if not found then raise exception 'pas de copie de la saison ouverte : rien n''est fait'; end if;
  -- 1. suspension 7 jours
  update public.profiles set suspended_at = now(), suspended_until = now() + interval '7 days' where id = u;
  update public.ladder set flagged = true, flag_reason = 'compte suspendu' where user_id = u;
  perform public.alog('compte de Francois suspendu 7 jour(s)');
  -- 2. partie remise à la première copie
  perform mono.verrou(u);
  insert into mono.parties (user_id, saison, data, meta, updated_at)
    select u, s, data, meta || jsonb_build_object('remise', jour), clock_timestamp() from mono.copies where user_id = u and jour = c.jour
    on conflict (user_id, saison) do update set data = excluded.data, meta = excluded.meta, updated_at = excluded.updated_at;
  -- 3. effacements de la saison ouverte
  foreach t in array array['mono.parties_ok', 'mono.lb_saison', 'mono.grp_semaine', 'mono.renforts', 'mono.bons', 'mono.eclats', 'mono.collection', 'mono.cosm_droits', 'mono.copies'] loop
    if to_regclass(t) is null then continue; end if;
    execute format('delete from %s where user_id = $1 and saison = $2', t) using u, s;
    get diagnostics m = row_count; raise notice '% : % ligne(s) effacée(s)', t, m;
  end loop;
  raise notice 'FAIT : Francois suspendu 7 jours, partie remise à la copie du %.', c.jour;
end $$;
select pseudo, suspended_at is not null as suspendu, suspended_until from public.profiles where lower(pseudo) = 'francois';
commit;
