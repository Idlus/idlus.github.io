-- ============================================================================
-- L'ASCENSION — Idlus (1.1) : les 5 classements (choix 20 A B C D F) et les lots du top 10.
-- Les scores viennent du résumé de la sauvegarde (meta.asc, js/verify.js), comme les niveaux du classement :
--   rapidite : étages 91 à 100 en Difficile, sans auto, le moins de tours de combat (rangé du plus petit au plus grand)
--   classe   : meilleur étage en Difficile avec une classe (k = la classe)
--   sursis   : meilleur étage en Difficile sans utiliser de Sursis
--   puriste  : meilleur étage en Difficile avec seulement des sorts de sa classe
--   audela   : meilleur étage de l'Au-delà de la semaine (m = numéro de semaine)
-- Mois : année × 12 + mois (UTC), comme E.ascMonth ; semaine : comme E.weekIdx.
-- Lots (asc_claim, le mois ou la semaine d'après) : top 10 de chaque classement = un titre, 3 Fioles de Volonté et 100 000 kamas
-- (Au-delà : titre « Maître de l'Au-delà », 2 Fioles). Envoyés par hdv_op comme les lots du Songe infini.
-- S'appuie sur classements.sql (ladder, profiles), hdv.sql (hdv_op, hdv_ops_after) et guildes.sql (g_err).
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur.
-- ============================================================================

create table if not exists public.asc_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  m int not null,                 -- mois (ou semaine pour l'Au-delà)
  cat text not null check (cat in ('rapidite', 'classe', 'sursis', 'puriste', 'audela')),
  k text not null default '',     -- la classe pour « classe »
  score int not null,
  at timestamptz not null default now(),
  primary key (user_id, m, cat, k)
);
create index if not exists asc_scores_rank on public.asc_scores (m, cat, k, score desc);
alter table public.asc_scores enable row level security;
drop policy if exists "ascension lisible" on public.asc_scores;
create policy "ascension lisible" on public.asc_scores for select using (true);

create or replace function public.asc_month() returns int language sql stable
as $$ select (extract(year from now() at time zone 'utc')::int * 12 + extract(month from now() at time zone 'utc')::int - 1) $$;
create or replace function public.asc_week() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- les scores du résumé envoyé avec la sauvegarde (seulement pour le mois et la semaine en cours, et seulement s'ils montent)
create or replace function public.asc_from_save() returns trigger language plpgsql security definer set search_path = public
as $$
declare a jsonb := new.meta->'asc'; mo int := asc_month(); wk int := asc_week(); c text; v int;
  put constant text := 'insert into public.asc_scores (user_id, m, cat, k, score) values ($1, $2, $3, $4, $5)
    on conflict (user_id, m, cat, k) do update set score = excluded.score, at = now()
    where (excluded.cat = ''rapidite'' and excluded.score < public.asc_scores.score) or (excluded.cat <> ''rapidite'' and excluded.score > public.asc_scores.score)';
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((a->>'m')::int, -1) = mo then
    for c, v in select key, least(greatest(coalesce((value#>>'{}')::int, 0), 0), 100) from jsonb_each(coalesce(a->'cls', '{}'::jsonb)) where key ~ '^[a-z]{2,8}$' loop
      if v > 0 then execute put using new.user_id, mo, 'classe', c, v; end if;
    end loop;
    v := least(greatest(coalesce((a->>'nos')::int, 0), 0), 100); if v > 0 then execute put using new.user_id, mo, 'sursis', '', v; end if;
    v := least(greatest(coalesce((a->>'pur')::int, 0), 0), 100); if v > 0 then execute put using new.user_id, mo, 'puriste', '', v; end if;
    v := coalesce((a->>'spd')::int, 0); if v >= 10 then execute put using new.user_id, mo, 'rapidite', '', least(v, 100000); end if; -- 10 étages : au moins 10 tours
  end if;
  if coalesce((a->>'w')::int, -1) = wk then
    v := least(greatest(coalesce((a->>'x')::int, 0), 0), 10000); if v > 100 then execute put using new.user_id, wk, 'audela', '', v; end if;
  end if;
  return new;
end $$;
drop trigger if exists saves_ascension on public.saves;
create trigger saves_ascension after insert or update on public.saves for each row execute function public.asc_from_save();

-- classement public (sans les comptes « en vérification ») ; rapidité : le moins de tours d'abord
create or replace view public.lb_asc as
  select s.user_id, p.pseudo, l.main, s.m, s.cat, s.k, s.score, s.at,
    rank() over (partition by s.m, s.cat, s.k order by case when s.cat = 'rapidite' then s.score else -s.score end, s.at asc) as r
  from public.asc_scores s join public.profiles p on p.id = s.user_id left join public.ladder l on l.user_id = s.user_id
  where not coalesce(l.flagged, false) and not coalesce(l.suspect, false);
grant select on public.lb_asc to anon, authenticated;

create table if not exists public.asc_lots (
  user_id uuid not null references auth.users (id) on delete cascade,
  m int not null, cat text not null, k text not null default '',
  r int,
  at timestamptz not null default now(),
  primary key (user_id, m, cat, k)
);
alter table public.asc_lots enable row level security;

-- les lots des mois (et semaines de l'Au-delà) passés où le joueur était dans le top 10
create or replace function public.asc_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); mo int := asc_month(); wk int := asc_week(); x record; k bigint := 0; f int := 0; titles text[] := '{}'; got jsonb := '[]'::jsonb; t text;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  for x in select b.m, b.cat, b.k, b.r from lb_asc b
           where b.user_id = me and b.r <= 10 and ((b.cat <> 'audela' and b.m between mo - 3 and mo - 1) or (b.cat = 'audela' and b.m between wk - 4 and wk - 1))
             and not exists (select 1 from asc_lots a where a.user_id = me and a.m = b.m and a.cat = b.cat and a.k = b.k) loop
    insert into asc_lots (user_id, m, cat, k, r) values (me, x.m, x.cat, x.k, x.r) on conflict do nothing;
    t := case x.cat when 'rapidite' then 'Éclair de l''Ascension' when 'classe' then 'Champion de classe de l''Ascension' when 'sursis' then 'Sans filet'
                    when 'puriste' then 'Puriste de l''Ascension' else 'Maître de l''Au-delà' end;
    titles := array_append(titles, t);
    if x.cat = 'audela' then f := f + 2; else f := f + 3; k := k + 100000; end if;
    got := got || jsonb_build_object('m', x.m, 'cat', x.cat, 'k', x.k, 'r', x.r);
  end loop;
  if jsonb_array_length(got) > 0 then
    foreach t in array (select array_agg(distinct u) from unnest(titles) u) loop
      perform hdv_op(me, jsonb_build_object('title', t), format('Classement de L''Ascension : titre « %s »', t));
    end loop;
    perform hdv_op(me, jsonb_build_object('k', k, 'cons', jsonb_build_object('fiole_volonte', f)),
      format('Classement de L''Ascension : %s Fioles de Volonté%s', f, case when k > 0 then format(' et %s kamas', k) else '' end));
  end if;
  return jsonb_build_object('ok', jsonb_array_length(got), 'fioles', f, 'kamas', k, 'got', got, 'ops', hdv_ops_after(me, p_after));
end $$;
revoke all on function public.asc_claim(bigint) from public, anon;
grant execute on function public.asc_claim(bigint) to authenticated;
