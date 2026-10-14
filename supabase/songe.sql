-- ============================================================================
-- SONGE INFINI — Idlus (1.0.30) : classement de la semaine et lots du top 10.
-- Le record d'un joueur n'est écrit que par la fonction serveur « record » ({ songe: 1 }) : elle relit la
-- partie en ligne, rejoue deux songes de l'intensité annoncée (js/songe.js, E.sgReplay) et garde au plus un
-- quart de vagues de plus que son meilleur rejeu. Classement : intensité validée, puis vagues, puis le premier arrivé.
-- Lots (songe_claim, à partir du lundi) : top 3 = titre « Maître des Songes » (pour une semaine) et 2 000 Bribes,
-- 4e à 10e = 1 000 Bribes. Envoyés par hdv_op ({ bribes, title, untitle }) comme les coffres du boss de guilde.
-- S'appuie sur classements.sql (ladder), hdv.sql (hdv_op, hdv_ops_after) et guildes.sql (g_err).
-- Relançable sans danger : ne supprime ni ne modifie aucune donnée de joueur.
-- ============================================================================

-- meilleur songe vérifié de chaque joueur, par semaine (semaines du lundi, UTC : comme E.weekIdx)
create table if not exists public.songe_week (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  ii int not null,                          -- intensité validée (0 = Rêve … 7 = Cauchemar 3)
  waves int not null,                       -- vagues tenues à la Fin du rêve (comptées par le serveur)
  at timestamptz not null default now(),
  primary key (user_id, w)
);
create index if not exists songe_week_w on public.songe_week (w, ii desc, waves desc);
alter table public.songe_week enable row level security;
drop policy if exists "songe lisible" on public.songe_week;
create policy "songe lisible" on public.songe_week for select using (true);

-- classement public de la semaine (sans les comptes « en vérification »)
create or replace view public.lb_songe as
  select s.user_id, p.pseudo, l.main, l.main_lvl, s.w, s.ii, s.waves, s.at,
    rank() over (partition by s.w order by s.ii desc, s.waves desc, s.at asc) as r
  from public.songe_week s join public.profiles p on p.id = s.user_id left join public.ladder l on l.user_id = s.user_id
  where not coalesce(l.flagged, false);
grant select on public.lb_songe to anon, authenticated;

-- lots déjà donnés : une ligne par joueur et par semaine passée (kind : top3, top10 ou rien)
create table if not exists public.songe_lots (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  kind text not null,
  untitled boolean not null default false,  -- le titre de la semaine d'avant a été repris
  at timestamptz not null default now(),
  primary key (user_id, w)
);
alter table public.songe_lots enable row level security;

create or replace function public.songe_wk() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- les lots des semaines passées (jusqu'à 4 semaines en arrière) ; le titre passe au nouveau podium
create or replace function public.songe_claim(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); wk int := songe_wk(); x int; rk int; br int := 0; top boolean := false; got jsonb := '[]'::jsonb; last_top int; last_un int;
begin
  if me is null then return g_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  for x in wk - 4 .. wk - 1 loop
    if exists (select 1 from songe_lots where user_id = me and w = x) then continue; end if;
    select r into rk from lb_songe where w = x and user_id = me;
    if rk is null and x < wk - 1 then continue; end if; -- semaine sans songe : rien à noter (sauf la dernière, pour le titre)
    insert into songe_lots (user_id, w, kind) values (me, x, case when rk <= 3 then 'top3' when rk <= 10 then 'top10' else 'rien' end) on conflict do nothing;
    if rk <= 3 then br := br + 2000; top := true; got := got || jsonb_build_object('w', x, 'r', rk);
    elsif rk <= 10 then br := br + 1000; got := got || jsonb_build_object('w', x, 'r', rk); end if;
  end loop;
  if br > 0 then
    perform hdv_op(me, case when top then jsonb_build_object('bribes', br, 'title', 'Maître des Songes') else jsonb_build_object('bribes', br) end,
      format('Classement du Songe infini : %s Bribes de rêve%s', br, case when top then ' et le titre « Maître des Songes »' else '' end));
  end if;
  -- titre de la semaine : repris si la dernière semaine n'est pas dans le top 3
  select max(w) into last_top from songe_lots where user_id = me and kind = 'top3';
  select max(w) into last_un from songe_lots where user_id = me and untitled;
  if last_top is not null and last_top < wk - 1 and (last_un is null or last_un < last_top)
     and exists (select 1 from songe_lots where user_id = me and w = wk - 1 and kind <> 'top3') then
    update songe_lots set untitled = true where user_id = me and w = wk - 1;
    perform hdv_op(me, jsonb_build_object('untitle', 'Maître des Songes'), 'Songe infini : le titre « Maître des Songes » passe au podium de la semaine.');
  end if;
  return jsonb_build_object('ok', jsonb_array_length(got), 'bribes', br, 'top', top, 'got', got, 'ops', hdv_ops_after(me, p_after));
end $$;
revoke all on function public.songe_claim(bigint) from public, anon;
grant execute on function public.songe_claim(bigint) to authenticated;
