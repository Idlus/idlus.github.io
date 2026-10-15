-- ============================================================================
-- 1.1 : ÉLEVAGE (js/elevage.js, js/elevageui.js).
-- 1) Naissances exceptionnelles annoncées dans le chat Général (choix 10A) : le résumé de la partie porte la liste
--    « mrare » (clés « chr:dd:Ivoire », « st:dd:Ivoire:6 », « gen:dd:Prune »). Une seule annonce par compte et par
--    clé, seulement pour une partie classée et jamais pour un compte signalé (comme dsub, supabase/collections.sql).
-- 2) Classement Élevage (choix 12A) : le résumé porte « elev » = { c : couleurs trouvées, s : étoiles de l'écurie,
--    chr : chromatiques }. Bornes : 41 couleurs, 400 étoiles, 41 chromatiques.
-- Rien ne rapporte de kamas ni d'objet. Relançable : create ... if not exists, create or replace, drop trigger if exists.
-- Aucune donnée de joueur n'est modifiée ni supprimée.
-- ============================================================================
create table if not exists public.mount_births (
  user_id uuid not null references auth.users (id) on delete cascade,
  k text not null check (k ~ '^(chr|st|gen):(dd|mu|vk):[^:<>]{1,20}(:[1-7])?$'),
  at timestamptz not null default now(),
  primary key (user_id, k)
);
alter table public.mount_births enable row level security;
drop policy if exists "lire les naissances" on public.mount_births;
create policy "lire les naissances" on public.mount_births for select to anon, authenticated using (true);

create table if not exists public.elevage_ladder (
  user_id uuid primary key references auth.users (id) on delete cascade,
  colours int not null default 0 check (colours between 0 and 41),
  stars int not null default 0 check (stars between 0 and 400),
  chroma int not null default 0 check (chroma between 0 and 41),
  updated_at timestamptz not null default now()
);
alter table public.elevage_ladder enable row level security;
drop policy if exists "lire le classement élevage" on public.elevage_ladder;
create policy "lire le classement élevage" on public.elevage_ladder for select to anon, authenticated using (true);
-- (aucune écriture directe : seul le déclencheur ci-dessous écrit)

create or replace function public.elevage_from_save() returns trigger language plpgsql security definer set search_path = public
as $$ declare k text; bad boolean; e jsonb; n int := 0; begin
  if new.meta is null then return new; end if;
  select flagged into bad from ladder where user_id = new.user_id;
  if not found or bad then return new; end if;
  e := new.meta->'elev';
  if jsonb_typeof(e) = 'object' then
    insert into elevage_ladder (user_id, colours, stars, chroma, updated_at)
      values (new.user_id, least(41, greatest(0, coalesce((e->>'c')::int, 0))), least(400, greatest(0, coalesce((e->>'s')::int, 0))), least(41, greatest(0, coalesce((e->>'chr')::int, 0))), now())
      on conflict (user_id) do update set colours = excluded.colours, stars = excluded.stars, chroma = excluded.chroma, updated_at = now();
  end if;
  if jsonb_typeof(new.meta->'mrare') = 'array' then
    for k in select distinct x from jsonb_array_elements_text(new.meta->'mrare') x where x ~ '^(chr|st|gen):(dd|mu|vk):[^:<>]{1,20}(:[1-7])?$' limit 10 loop
      insert into mount_births (user_id, k) values (new.user_id, k) on conflict do nothing;
      if found and n < 3 then
        n := n + 1;
        perform chat_ann(new.user_id, jsonb_build_object('t', 'mrare', 'k', split_part(k, ':', 1), 'sp', split_part(k, ':', 2), 'c', split_part(k, ':', 3), 'st', nullif(split_part(k, ':', 4), '')));
      end if;
    end loop;
  end if;
  return new;
exception when others then return new; -- l'élevage ne doit jamais bloquer une sauvegarde
end $$;
revoke all on function public.elevage_from_save() from public, anon, authenticated;
-- après saves_ladder (ordre alphabétique des déclencheurs) : la ligne du classement est déjà à jour
drop trigger if exists saves_suite_elevage on public.saves;
create trigger saves_suite_elevage after insert or update on public.saves for each row execute function public.elevage_from_save();

create or replace view public.lb_elevage as
  select e.user_id, p.pseudo, l.main, l.main_lvl, e.colours, e.stars, e.chroma
  from public.elevage_ladder e join public.ladder l on l.user_id = e.user_id join public.profiles p on p.id = e.user_id where not l.flagged;
grant select on public.lb_elevage to anon, authenticated;
