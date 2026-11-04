-- ============================================================================
-- Idlus — Monocompte : objectif commun au serveur de la campagne de saison (js/histoire.js, E.CAMP), comme
-- supabase/histoire_s1.sql pour le Classique · Saison 1. Mathis, 04/11/2026 : « installe l'objectif de campagne sur le serveur Monocompte ».
-- DÉPLOIEMENT MANUEL SEULEMENT (étape monocompte-campagne de « Serveur OVH », ou monocompte-installer après mono_cles.sql) :
-- jamais dans la liste « tous » de .github/workflows/supabase.yml. Il utilise mono.saisons, mono.need, mono.jour_de,
-- mono.date_saison, mono.semaine_de et mono.saison_en_jeu (monocompte.sql). Relançable sans danger : il ne supprime ni ne vide rien.
-- Le chapitre k (1 à 8) s'ouvre la semaine k de la saison. Le serveur compte les comptes qui le finissent pendant sa
-- semaine (une fois par compte et par saison) ; le jeu lit ces nombres et donne un Coffre en or quand l'objectif est atteint.
-- Le serveur ne donne rien lui-même : il ne fait que compter.
-- ============================================================================

create table if not exists mono.camp_fin (
  user_id uuid not null references auth.users (id) on delete cascade,
  saison int not null references mono.saisons (id) on delete cascade,
  ch smallint not null check (ch between 1 and 8),
  at timestamptz not null default now(),
  primary key (user_id, saison, ch)
);
alter table mono.camp_fin enable row level security;
revoke all on mono.camp_fin from anon, authenticated;

-- semaine de la saison ouverte (1 à 8), 0 hors du jeu
create or replace function mono.camp_wk(p_s int) returns int language sql stable security definer set search_path = mono, public
as $$ select case when p_s is null or not mono.saison_en_jeu(p_s) then 0 else least(8, mono.semaine_de(mono.jour_de(p_s, mono.date_saison(p_s)))) end $$;

-- le joueur a fini le chapitre p_ch : compté seulement pendant la semaine de ce chapitre ; renvoie le nombre du chapitre
create or replace function public.mono_camp_done(p_ch int) returns int language plpgsql security definer set search_path = mono, public
as $$ declare u uuid := mono.need(); s int := mono.saison_ouverte();
begin
  if p_ch is null or p_ch < 1 or p_ch > 8 then raise exception 'chapitre inconnu'; end if;
  if s is null then return 0; end if;
  if p_ch = mono.camp_wk(s) then insert into mono.camp_fin (user_id, saison, ch) values (u, s, p_ch) on conflict do nothing; end if;
  return (select count(*) from mono.camp_fin where saison = s and ch = p_ch);
end $$;

-- nombres de tous les chapitres de la saison ouverte : { "1": 12, "2": 3, ... } (sans les comptes)
create or replace function public.mono_camp_count() returns jsonb language sql stable security definer set search_path = mono, public
as $$ select coalesce(jsonb_object_agg(ch::text, n), '{}'::jsonb) from (select ch, count(*) n from mono.camp_fin where saison = mono.saison_ouverte() group by ch) x $$;

revoke all on function mono.camp_wk(int) from public, anon, authenticated;
revoke all on function public.mono_camp_done(int) from public, anon;
grant execute on function public.mono_camp_done(int) to authenticated;
revoke all on function public.mono_camp_count() from public;
grant execute on function public.mono_camp_count() to anon, authenticated;
