-- ============================================================================
-- Idlus — carnet de bord (lot « Suivi »). Appliqué automatiquement par le workflow
-- « Serveur en ligne » après classements.sql (il s'appuie sur is_admin) ; relançable sans danger.
-- Un résumé par joueur et par semaine (niveau, XP et kamas par heure, bilan, meilleures zones),
-- envoyé à la demande du joueur pour aider à l'équilibrage. Lisible seulement par Mathis (is_admin),
-- sans pseudo dans la réponse.
-- ============================================================================
create table if not exists public.carnets (
  user_id uuid not null references auth.users (id) on delete cascade,
  week int not null,
  data jsonb not null,
  at timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.carnets enable row level security; -- aucune règle : on passe seulement par les fonctions ci-dessous

create or replace function public.carnet_send(p_week int, p_data jsonb) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 4000 then raise exception 'Carnet invalide.'; end if;
  if abs(p_week - floor(extract(epoch from now()) / 604800)::int) > 1 then raise exception 'Semaine invalide.'; end if;
  insert into carnets (user_id, week, data) values (auth.uid(), p_week, p_data)
    on conflict (user_id, week) do update set data = excluded.data, at = now();
end $$;
revoke all on function public.carnet_send(int, jsonb) from public, anon;
grant execute on function public.carnet_send(int, jsonb) to authenticated;

create or replace function public.carnet_admin(p_weeks int default 4) returns table (week int, data jsonb, at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à Mathis.'; end if;
  return query select c.week, c.data, c.at from carnets c
    where c.week >= floor(extract(epoch from now()) / 604800)::int - greatest(1, least(coalesce(p_weeks, 4), 52))
    order by c.at desc limit 1000;
end $$;
revoke all on function public.carnet_admin(int) from public, anon;
grant execute on function public.carnet_admin(int) to authenticated;
