-- ============================================================================
-- ALIGNEMENT — Idlus (1.0.30, choix 34A) : le camp du compte et la guerre des cités.
-- Le jeu envoie son camp dans le résumé de la partie (saves.meta->'align' : s camp, o ordre, l niveau
-- d'alignement, w semaine, p points de guerre de la semaine, ps camp demandé, c chapitres finis ; js/alignement.js).
-- Le serveur tient le camp du compte (align_camp) : un changement de camp n'est accepté que 7 jours après
-- que le serveur l'a vu demandé, et ramène au rang 1. Les points de guerre sont plafonnés (600 par semaine,
-- 150 de l'heure depuis l'envoi précédent) et comptent pour le camp que tient le serveur.
-- Le camp s'affiche dans le chat, les profils et les classements (vue lb_align, lisible sans compte).
-- Le camp gagnant d'une semaine a +5 % d'XP et de butin la semaine suivante (align_war_state, appliqué par le jeu).
-- S'appuie sur classements.sql (ladder, saves) et schema.sql (profiles). Relançable sans danger :
-- ne supprime ni ne modifie aucune donnée de joueur (seulement les deux tables d'ici, remplies par le déclencheur).
-- ============================================================================

create table if not exists public.align_camp (
  user_id uuid primary key references auth.users (id) on delete cascade,
  side text not null check (side in ('bonta', 'brakmar')),
  ord text not null default 'coeur',
  lvl int not null default 0,
  chap int not null default 0,              -- chapitres de quêtes finis
  since timestamptz not null default now(),
  pend_side text,                           -- camp demandé (changement en attente)
  pend_at timestamptz,                      -- date à partir de laquelle le changement est accepté
  updated_at timestamptz not null default now()
);
alter table public.align_camp enable row level security; -- lecture par la vue lb_align et align_me seulement

create table if not exists public.align_war (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,                           -- semaine (lundi, UTC : comme E.weekIdx)
  side text not null,
  pts int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, w, side)
);
create index if not exists align_war_w on public.align_war (w, side);
alter table public.align_war enable row level security;

create or replace function public.align_wk() returns int language sql stable
as $$ select floor((extract(epoch from now()) / 86400 + 3) / 7)::int $$;

-- ---------- déclencheur : le camp et les points de guerre à chaque envoi de partie ----------
create or replace function public.align_from_save() returns trigger language plpgsql security definer set search_path = public
as $$
declare a jsonb := new.meta->'align'; s text; o text; lv int; ps text; ch int; c public.align_camp%rowtype; vw int; vp int; old_p int; prev timestamptz; lim int;
begin
  if a is null or jsonb_typeof(a) <> 'object' then return new; end if;
  if coalesce((new.meta->>'panel')::boolean, false) then return new; end if; -- partie de test
  s := a->>'s'; if s is null or s not in ('bonta', 'brakmar') then return new; end if;
  o := coalesce(a->>'o', 'coeur'); if o not in ('coeur', 'esprit', 'oeil') then o := 'coeur'; end if;
  lv := least(100, greatest(0, coalesce((a->>'l')::int, 0)));
  ch := least(5, greatest(0, coalesce((a->>'c')::int, 0)));
  ps := a->>'ps'; if ps is not null and ps not in ('bonta', 'brakmar') then ps := null; end if;
  select * into c from public.align_camp where user_id = new.user_id;
  if not found then
    insert into public.align_camp (user_id, side, ord, lvl, chap) values (new.user_id, s, o, lv, ch);
    select * into c from public.align_camp where user_id = new.user_id;
  elsif s = c.side then
    -- même camp : ordre, niveau, chapitres ; un changement demandé démarre l'attente (une seule fois), une annulation l'efface
    update public.align_camp set ord = o, lvl = lv, chap = greatest(chap, ch), updated_at = now(),
      pend_side = case when ps is null or ps = c.side then null else ps end,
      pend_at = case when ps is null or ps = c.side then null when c.pend_side = ps then c.pend_at else now() + interval '7 days' end
      where user_id = new.user_id;
  elsif c.pend_side = s and c.pend_at <= now() then
    -- l'attente de 7 jours est finie : le serveur accepte le nouveau camp (rang 1 au plus)
    update public.align_camp set side = s, ord = o, lvl = least(lv, 20), chap = ch, since = now(), pend_side = null, pend_at = null, updated_at = now()
      where user_id = new.user_id;
  else
    return new; -- autre camp sans attente finie : le serveur garde le sien et ne compte pas les points
  end if;
  -- points de guerre de la semaine : plafonnés, et pas plus vite que 150 de l'heure depuis l'envoi précédent
  vw := coalesce((a->>'w')::int, -1); vp := least(600, greatest(0, coalesce((a->>'p')::int, 0)));
  if vw <> align_wk() or vp <= 0 then return new; end if;
  select x.pts, x.at into old_p, prev from public.align_war x where x.user_id = new.user_id and x.w = vw and x.side = s;
  if not found then old_p := 0; prev := now() - interval '1 hour'; end if;
  lim := old_p + 60 + floor(extract(epoch from now() - prev) / 3600 * 150)::int;
  vp := least(vp, lim);
  if vp > old_p then
    insert into public.align_war (user_id, w, side, pts, at) values (new.user_id, vw, s, vp, now())
      on conflict (user_id, w, side) do update set pts = excluded.pts, at = excluded.at;
  end if;
  return new;
exception when others then return new; -- le camp ne doit jamais empêcher d'enregistrer une partie
end $$;
drop trigger if exists saves_align on public.saves;
drop trigger if exists saves_align on public.saves_ok; -- 2.1.4 : sur la dernière partie validée (schema.sql)
create trigger saves_align after insert or update on public.saves_ok for each row execute function public.align_from_save();

-- ---------- vues et appels ----------
-- qui est de quel camp (sans les comptes « en vérification »)
create or replace view public.lb_align as
  select c.user_id, p.pseudo, c.side, c.ord, c.lvl, c.chap, l.main, l.main_lvl
  from public.align_camp c join public.profiles p on p.id = c.user_id left join public.ladder l on l.user_id = c.user_id
  where not coalesce(l.flagged, false);
grant select on public.lb_align to anon, authenticated;

-- mon camp vu par le serveur (attente d'un changement comprise)
create or replace function public.align_me() returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce((select jsonb_build_object('side', side, 'ord', ord, 'lvl', lvl, 'chap', chap, 'since', since, 'pend_side', pend_side, 'pend_at', pend_at)
  from public.align_camp where user_id = auth.uid()), '{}'::jsonb) $$;
revoke all on function public.align_me() from public, anon;
grant execute on function public.align_me() to authenticated;

-- la guerre de la semaine p_w (points et joueurs de chaque camp) et le gagnant de la semaine d'avant
create or replace function public.align_war_state(p_w int) returns jsonb language sql stable security definer set search_path = public
as $$
  with t as (
    select x.w, x.side, sum(x.pts)::bigint as pts, count(*) as n from public.align_war x left join public.ladder l on l.user_id = x.user_id
    where x.w in (p_w, p_w - 1) and x.pts > 0 and not coalesce(l.flagged, false) group by x.w, x.side)
  select jsonb_build_object('w', p_w,
    'b', coalesce((select pts from t where w = p_w and side = 'bonta'), 0), 'k', coalesce((select pts from t where w = p_w and side = 'brakmar'), 0),
    'nb', coalesce((select n from t where w = p_w and side = 'bonta'), 0), 'nk', coalesce((select n from t where w = p_w and side = 'brakmar'), 0),
    'cb', (select count(*) from public.lb_align where side = 'bonta'), 'ck', (select count(*) from public.lb_align where side = 'brakmar'),
    'prev', jsonb_build_object('w', p_w - 1, 'b', coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0), 'k', coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0),
      'win', case when coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0) > coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0) then 'bonta'
                  when coalesce((select pts from t where w = p_w - 1 and side = 'brakmar'), 0) > coalesce((select pts from t where w = p_w - 1 and side = 'bonta'), 0) then 'brakmar' end))
$$;
revoke all on function public.align_war_state(int) from public;
grant execute on function public.align_war_state(int) to anon, authenticated;
