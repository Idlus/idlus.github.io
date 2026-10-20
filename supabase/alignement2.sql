-- ============================================================================
-- ALIGNEMENT 2 — refonte des alignements (choix de Mathis : 1A conflit réel, 2A régions de la carte, 3A honneur et 20 rangs).
-- Le jeu envoie dans le résumé de la partie (saves.meta->'align', js/honneur.js) : h honneur, r rang (0 à 20),
-- rg points de guerre de la semaine par région, f région de front. Le camp et l'attente de changement restent tenus
-- par alignement.sql (align_camp) : ce fichier s'appuie dessus et le remplace pour la guerre (régions au lieu de la semaine).
-- - align_hon : honneur et rang du compte (plafonné : +600 de l'heure depuis l'envoi précédent, jamais plus de 20 rangs).
-- - align_reg_pts : points de guerre par compte, semaine, région et camp (plafond : 600 par semaine au total, comme avant).
-- - align_region : qui tient chaque région. Une région change de camp quand un camp fait 70 % des points de la semaine
--   (200 points au moins) ; sinon elle garde son camp. Calculé par align_regions(), lisible sans compte.
-- - lb_hon : classement d'honneur (sans les comptes « en vérification ») ; le jeu y lit le rang affiché (0 à 20, choix 2A).
-- - align_regions_cache : l'état des régions calculé au plus une fois toutes les 3 minutes (choix 3A), recalculé aussitôt
--   si une région change de camp hors de ce calcul ou à la nouvelle semaine.
-- Transition v13 → v14 : un envoi sans honneur (ancien jeu, ou serveur sans js/honneur.js) ne touche pas à l'honneur ;
-- après un changement de camp, l'honneur retenu ne dépasse pas celui déjà tenu + 100.
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur hors de ces tables.
-- ============================================================================

create table if not exists public.align_hon (
  user_id uuid primary key references auth.users (id) on delete cascade,
  side text not null check (side in ('bonta', 'brakmar')),
  hon int not null default 0,
  rank int not null default 0,
  front text,
  at timestamptz not null default now()
);
alter table public.align_hon enable row level security;

create table if not exists public.align_reg_pts (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  region text not null,
  side text not null check (side in ('bonta', 'brakmar')),
  pts int not null default 0,
  primary key (user_id, w, region, side)
);
create index if not exists align_reg_pts_w on public.align_reg_pts (w, region, side);
alter table public.align_reg_pts enable row level security;

create table if not exists public.align_region (
  region text primary key,
  holder text check (holder in ('bonta', 'brakmar')),
  since timestamptz not null default now()
);
alter table public.align_region enable row level security;

create or replace function public.align_regions_list() returns text[] language sql immutable
as $$ select array['astrub','amakna','cania','wabbit','sidimote','koalaks','albuera','abrak','moon','dragoeufs','otomai','minotoror','pandala',
  'frigost','saharach','asse','grobe','sakai','valonia','nimotopia','possedes','vulkania'] $$;

-- rang d'un total d'honneur (comme E.honRankOf : 300 pour le rang 1, puis +15 % par rang, arrondi à 10)
create or replace function public.align_rank_of(h int) returns int language plpgsql immutable
as $$ declare r int := 0; c int := 0; begin
  while r < 20 loop c := c + (round(300 * power(1.15, r) / 10) * 10)::int; exit when h < c; r := r + 1; end loop; return r; end $$;

-- ---------- déclencheur : honneur et points par région à chaque envoi de partie ----------
create or replace function public.align2_from_save() returns trigger language plpgsql security definer set search_path = public
as $$
declare a jsonb := new.meta->'align'; c public.align_camp%rowtype; o public.align_hon%rowtype; h int; lim int; rk int; vw int; k text; v int; tot int; old int; js jsonb;
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((new.meta->>'panel')::boolean, false) then return new; end if;
  select * into c from public.align_camp where user_id = new.user_id; -- rempli juste avant par align_from_save
  if not found or c.side is distinct from a->>'s' then return new; end if;
  -- honneur : seulement si l'envoi en porte un, entier (un ancien jeu v13 ou un serveur sans js/honneur.js n'envoie pas « h » :
  -- rien n'est écrit, sinon l'honneur repartirait de 0 et le vrai serait plafonné ensuite)
  if jsonb_typeof(a->'h') = 'number' and (a->>'h') ~ '^-?[0-9]{1,9}(\.0+)?$' then
    h := greatest(0, least(40000, (a->>'h')::numeric::int));
    select * into o from public.align_hon where user_id = new.user_id;
    if found and o.side = c.side then
      lim := o.hon + 100 + floor(extract(epoch from now() - o.at) / 3600 * 600)::int; h := least(h, lim); -- +600 de l'heure au plus
    elsif found then
      h := least(h, o.hon + 100); -- changement de camp accepté : jamais plus que l'honneur déjà tenu + 100 (le jeu redescend au rang 2)
    else
      h := least(h, 6100); -- premier envoi : au plus le rang 10 (ancien niveau 100)
    end if;
    rk := align_rank_of(h); -- le rang suit l'honneur retenu par le serveur, pas celui envoyé
    insert into public.align_hon (user_id, side, hon, rank, front, at) values (new.user_id, c.side, h, rk, left(a->>'f', 20), now())
      on conflict (user_id) do update set side = excluded.side, hon = excluded.hon, rank = excluded.rank, front = excluded.front, at = now();
  end if;
  -- points de guerre par région, semaine en cours seulement, 600 au total par semaine
  vw := coalesce((a->>'w')::int, -1);
  if vw <> align_wk() or jsonb_typeof(a->'rg') <> 'object' then return new; end if;
  select coalesce(sum(pts), 0) into tot from public.align_reg_pts where user_id = new.user_id and w = vw;
  for k, js in select key, value from jsonb_each(a->'rg') loop
    if jsonb_typeof(js) <> 'number' then continue; end if; -- valeur illisible : ignorée, sans perdre les autres régions
    v := least(600, greatest(0, floor(js::text::numeric)::int));
    if not (k = any (align_regions_list())) then continue; end if;
    old := null;
    select pts into old from public.align_reg_pts where user_id = new.user_id and w = vw and region = k and side = c.side;
    old := coalesce(old, 0);
    v := least(v, old + greatest(0, 600 - tot));
    if v > old then
      insert into public.align_reg_pts (user_id, w, region, side, pts) values (new.user_id, vw, k, c.side, v)
        on conflict (user_id, w, region, side) do update set pts = excluded.pts;
      tot := tot + (v - old);
    end if;
  end loop;
  return new;
exception when others then return new; -- l'alignement ne doit jamais empêcher d'enregistrer une partie
end $$;
drop trigger if exists saves_align2 on public.saves_ok;
-- le nom trie après saves_align : le camp est à jour avant ce déclencheur
create trigger saves_align2 after insert or update on public.saves_ok for each row execute function public.align2_from_save();

-- ---------- état des régions : jauge de la semaine, camp qui les tient (mis à jour à la lecture) ----------
-- 3A : le résultat est gardé 3 minutes (align_regions_cache) ; un seul calcul à la fois (verrou), les autres lisent le résultat.
-- Toute écriture dans align_region hors du calcul (panel, correction à la main) efface le cache ; la semaine suivante aussi.
create table if not exists public.align_regions_cache (
  id int primary key default 1 check (id = 1),
  w int not null,
  data jsonb not null,
  at timestamptz not null default now()
);
alter table public.align_regions_cache enable row level security;
create or replace function public.align_regions_ttl() returns interval language sql immutable as $$ select interval '3 minutes' $$;
create or replace function public.align_region_touch() returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if coalesce(current_setting('idlus.align_calc', true), '') <> '1' then delete from public.align_regions_cache; end if;
  return null;
end $$;
drop trigger if exists align_region_touch on public.align_region;
create trigger align_region_touch after insert or update or delete on public.align_region for each statement execute function public.align_region_touch();

create or replace function public.align_regions() returns jsonb language plpgsql security definer set search_path = public
as $$
declare cw int := align_wk(); x public.align_regions_cache%rowtype; res jsonb;
begin
  select * into x from public.align_regions_cache where id = 1;
  if found and x.w = cw and x.at > now() - align_regions_ttl() then return x.data; end if;
  perform pg_advisory_xact_lock(hashtext('idlus.align_regions'));
  select * into x from public.align_regions_cache where id = 1; -- un autre appel vient peut-être de le calculer
  if found and x.w = cw and x.at > now() - align_regions_ttl() then return x.data; end if;
  perform set_config('idlus.align_calc', '1', true);
  res := align_regions_calc();
  perform set_config('idlus.align_calc', '', true);
  insert into public.align_regions_cache (id, w, data, at) values (1, cw, res, now())
    on conflict (id) do update set w = excluded.w, data = excluded.data, at = excluded.at;
  return res;
end $$;
revoke all on function public.align_regions() from public;
grant execute on function public.align_regions() to anon, authenticated;

-- le calcul lui-même (sans cache)
create or replace function public.align_regions_calc() returns jsonb language plpgsql security definer set search_path = public
as $$
declare cw int := align_wk(); r text; b bigint; k bigint; hd text; out jsonb := '{}'::jsonb;
begin
  foreach r in array align_regions_list() loop
    select coalesce(sum(x.pts) filter (where x.side = 'bonta'), 0), coalesce(sum(x.pts) filter (where x.side = 'brakmar'), 0) into b, k
      from public.align_reg_pts x left join public.ladder l on l.user_id = x.user_id
      where x.w = cw and x.region = r and not coalesce(l.flagged, false);
    insert into public.align_region (region) values (r) on conflict do nothing;
    select holder into hd from public.align_region where region = r;
    if b + k >= 200 and b * 100 >= (b + k) * 70 and hd is distinct from 'bonta' then
      update public.align_region set holder = 'bonta', since = now() where region = r; hd := 'bonta';
    elsif b + k >= 200 and k * 100 >= (b + k) * 70 and hd is distinct from 'brakmar' then
      update public.align_region set holder = 'brakmar', since = now() where region = r; hd := 'brakmar';
    end if;
    out := out || jsonb_build_object(r, jsonb_build_object('b', b, 'k', k, 'h', hd, 'since', (select since from public.align_region where region = r)));
  end loop;
  return jsonb_build_object('w', cw, 'regs', out,
    'cb', (select count(*) from public.lb_align where side = 'bonta'), 'ck', (select count(*) from public.lb_align where side = 'brakmar'));
end $$;
revoke all on function public.align_regions_calc() from public, anon, authenticated;

-- ---------- classement d'honneur ----------
create or replace view public.lb_hon as
  select h.user_id, p.pseudo, h.side, c.ord, h.hon, h.rank, l.main, l.main_lvl
  from public.align_hon h join public.profiles p on p.id = h.user_id join public.align_camp c on c.user_id = h.user_id and c.side = h.side
  left join public.ladder l on l.user_id = h.user_id
  where not coalesce(l.flagged, false);
grant select on public.lb_hon to anon, authenticated;
