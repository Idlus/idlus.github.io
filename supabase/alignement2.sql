-- ============================================================================
-- ALIGNEMENT 2 — refonte des alignements (choix de Mathis : 1A conflit réel, 2A régions de la carte, 3A honneur et 20 rangs).
-- Le jeu envoie dans le résumé de la partie (saves.meta->'align', js/honneur.js) : h honneur, r rang (0 à 20),
-- rg points de guerre de la semaine par région, f région de front. Le camp et l'attente de changement restent tenus
-- par alignement.sql (align_camp) : ce fichier s'appuie dessus et le remplace pour la guerre (régions au lieu de la semaine).
-- - align_hon : honneur et rang du compte (plafonné : +600 de l'heure depuis l'envoi précédent, jamais plus de 20 rangs).
-- - align_reg_pts : points de guerre par compte, semaine, région et camp (plafond : 600 par semaine au total, comme avant).
-- - align_region : qui tient chaque région. Une région change de camp quand un camp fait 70 % des points de la semaine
--   (200 points au moins) ; sinon elle garde son camp. Calculé par align_regions(), lisible sans compte.
-- - lb_hon : classement d'honneur (sans les comptes « en vérification »).
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
declare a jsonb := new.meta->'align'; c public.align_camp%rowtype; o public.align_hon%rowtype; h int; lim int; rk int; vw int; k text; v int; tot int; old int;
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((new.meta->>'panel')::boolean, false) then return new; end if;
  select * into c from public.align_camp where user_id = new.user_id; -- rempli juste avant par align_from_save
  if not found or c.side is distinct from a->>'s' then return new; end if;
  -- honneur : plafonné à +600 de l'heure depuis l'envoi précédent (un changement de camp repart de l'honneur envoyé)
  h := greatest(0, least(40000, coalesce((a->>'h')::int, 0)));
  select * into o from public.align_hon where user_id = new.user_id;
  if found and o.side = c.side then
    lim := o.hon + 100 + floor(extract(epoch from now() - o.at) / 3600 * 600)::int; h := least(h, lim);
  elsif not found then
    h := least(h, 6100); -- premier envoi : au plus le rang 10 (ancien niveau 100)
  end if;
  rk := align_rank_of(h); -- le rang suit l'honneur retenu par le serveur, pas celui envoyé
  insert into public.align_hon (user_id, side, hon, rank, front, at) values (new.user_id, c.side, h, rk, left(a->>'f', 20), now())
    on conflict (user_id) do update set side = excluded.side, hon = excluded.hon, rank = excluded.rank, front = excluded.front, at = now();
  -- points de guerre par région, semaine en cours seulement, 600 au total par semaine
  vw := coalesce((a->>'w')::int, -1);
  if vw <> align_wk() or jsonb_typeof(a->'rg') <> 'object' then return new; end if;
  select coalesce(sum(pts), 0) into tot from public.align_reg_pts where user_id = new.user_id and w = vw;
  for k, v in select key, least(600, greatest(0, coalesce(value::text::int, 0))) from jsonb_each(a->'rg') loop
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
create or replace function public.align_regions() returns jsonb language plpgsql security definer set search_path = public
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
revoke all on function public.align_regions() from public;
grant execute on function public.align_regions() to anon, authenticated;

-- ---------- classement d'honneur ----------
create or replace view public.lb_hon as
  select h.user_id, p.pseudo, h.side, c.ord, h.hon, h.rank, l.main, l.main_lvl
  from public.align_hon h join public.profiles p on p.id = h.user_id join public.align_camp c on c.user_id = h.user_id and c.side = h.side
  left join public.ladder l on l.user_id = h.user_id
  where not coalesce(l.flagged, false);
grant select on public.lb_hon to anon, authenticated;
