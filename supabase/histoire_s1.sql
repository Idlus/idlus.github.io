-- Saison 1, quêtes : objectif commun au serveur de la campagne de saison (js/histoire.js, E.CAMP).
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.).
-- Chaque chapitre k (1 à 8) de la campagne s'ouvre la semaine k. Le serveur compte les joueurs qui le finissent pendant
-- sa semaine (un compte une seule fois) ; le jeu lit ces nombres et donne un Coffre en or quand l'objectif est atteint.
-- Le serveur ne donne rien lui-même : il ne fait que compter. Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.
-- Il a besoin de public.s1_cfg (supabase/saison1_vitrine.sql, placé avant lui dans la liste EXTRA).

create table if not exists public.camp_fin (
  user_id uuid not null references auth.users (id) on delete cascade,
  ch smallint not null check (ch between 1 and 8),
  at timestamptz not null default now(),
  primary key (user_id, ch)
);
alter table public.camp_fin enable row level security;
drop policy if exists "campagne : les siens" on public.camp_fin;
create policy "campagne : les siens" on public.camp_fin for select using (user_id = auth.uid());
revoke insert, update, delete on public.camp_fin from anon, authenticated;

-- semaine de la saison (1 à 8), 0 avant l'ouverture, 9 après la fin
create or replace function public.camp_wk() returns int language sql stable security definer set search_path = public as $$
  select case when c.debut is null or now() < c.debut then 0
    else least(9, floor(extract(epoch from now() - c.debut) / 604800.0)::int + 1) end
  from s1_cfg c where c.id = 1 $$;

-- le joueur a fini le chapitre p_ch : compté seulement pendant la semaine de ce chapitre ; renvoie le nombre du chapitre
create or replace function public.camp_done(p_ch int)
returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'connexion nécessaire'; end if;
  if p_ch is null or p_ch < 1 or p_ch > 8 then raise exception 'chapitre inconnu'; end if;
  if p_ch = camp_wk() then insert into camp_fin (user_id, ch) values (me, p_ch) on conflict do nothing; end if;
  return (select count(*) from camp_fin where ch = p_ch);
end $$;

-- nombres de tous les chapitres : { "1": 12, "2": 3, ... } (lisible par tous, sans les comptes)
create or replace function public.camp_count()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(ch::text, n), '{}'::jsonb) from (select ch, count(*) n from camp_fin group by ch) x $$;

revoke all on function public.camp_wk() from public;
revoke all on function public.camp_done(int) from public, anon;
grant execute on function public.camp_done(int) to authenticated;
grant execute on function public.camp_count() to anon, authenticated;
