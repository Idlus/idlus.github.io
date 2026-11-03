-- Saison 1 : classement de la semaine de la Chevauchée des Cavaliers et classement de la manche des Expéditions de saison.
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.).
-- Les chiffres viennent du résumé que le serveur calcule sur la partie validée (VERIFY.fullSummary, champ s1lb) : rien n'est
-- envoyé par le jeu lui-même. Un compte retiré des classements (ladder.flagged) n'apparaît pas.
-- Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.

create table if not exists public.lb_s1 (
  user_id uuid primary key references auth.users (id) on delete cascade,
  w int not null default -1,      -- semaine de saison du meilleur essai de Chevauchée
  chev_n int not null default 0,  -- Cavaliers vaincus (0 à 4)
  chev_k int not null default 0,  -- stasis
  chev_t int not null default 0,  -- tours
  m int not null default -1,      -- manche des Expéditions
  exp int not null default 0,     -- somme des 3 meilleurs scores de la manche
  at timestamptz not null default now()
);
alter table public.lb_s1 enable row level security;
revoke all on public.lb_s1 from anon, authenticated;

create or replace function public.lb_s1_from_save() returns trigger language plpgsql security definer set search_path = public as $$
declare x jsonb := new.meta->'s1lb';
begin
  if x is null or jsonb_typeof(x) <> 'object' then return new; end if;
  insert into lb_s1 (user_id, w, chev_n, chev_k, chev_t, m, exp, at)
    values (new.user_id, coalesce((x->>'w')::int, -1), least(4, greatest(0, coalesce((x->>'n')::int, 0))), least(15, greatest(0, coalesce((x->>'k')::int, 0))),
      least(9999, greatest(0, coalesce((x->>'t')::int, 0))), coalesce((x->>'m')::int, -1), least(300000, greatest(0, coalesce((x->>'x')::int, 0))), now())
    on conflict (user_id) do update set w = excluded.w, chev_n = excluded.chev_n, chev_k = excluded.chev_k, chev_t = excluded.chev_t, m = excluded.m, exp = excluded.exp, at = now();
  return new;
end $$;
drop trigger if exists saves_lb_s1 on public.saves_ok;
create trigger saves_lb_s1 after insert or update on public.saves_ok for each row execute function public.lb_s1_from_save();

-- p_w : semaine de saison (E.s1cWeek) ; 50 premiers : Cavaliers vaincus, puis stasis, puis le moins de tours
create or replace function public.lb_chev(p_w int) returns table (rang bigint, user_id uuid, pseudo text, n int, k int, t int)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by l.chev_n desc, l.chev_k desc, l.chev_t asc, l.at asc), l.user_id, pseudo_of(l.user_id), l.chev_n, l.chev_k, l.chev_t
  from lb_s1 l where l.w = p_w and l.chev_n > 0 and not exists (select 1 from ladder d where d.user_id = l.user_id and d.flagged)
  order by l.chev_n desc, l.chev_k desc, l.chev_t asc, l.at asc limit 50 $$;
-- p_m : manche (E.s1cManche) ; 50 premiers à la somme des 3 meilleurs scores
create or replace function public.lb_exps1(p_m int) returns table (rang bigint, user_id uuid, pseudo text, score int)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by l.exp desc, l.at asc), l.user_id, pseudo_of(l.user_id), l.exp
  from lb_s1 l where l.m = p_m and l.exp > 0 and not exists (select 1 from ladder d where d.user_id = l.user_id and d.flagged)
  order by l.exp desc, l.at asc limit 50 $$;
grant execute on function public.lb_chev(int), public.lb_exps1(int) to anon, authenticated;
revoke execute on function public.lb_s1_from_save() from anon, authenticated, public;
