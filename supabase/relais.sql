-- ============================================================================
-- Passage de relais vers Diablofus (Mathis 25/11/2026, maquette « Relais vers Diablofus », choix 2A 3A+B 4A 5C).
-- Chaque compte Idlus reçoit un code personnel « IDLUS-XXXX-XXXX-XXXX » et un palier de Vétéran (1 Bronze, 2 Argent, 3 Or)
-- calculé par le SERVEUR (fonction record, mode « veteran ») sur ses parties validées des trois serveurs (la meilleure compte),
-- plus le Défi d'adieu réussi (adieu). Le palier ne descend jamais. Diablofus lit le palier d'un code avec veteran_lookup
-- (appelé par son serveur, api.diablofus.com) et remet titre, ornement, auréole et Ogrines au compte qui entre le code.
-- Aucune donnée personnelle nouvelle : seulement l'identifiant du compte, le code, le palier.
-- ============================================================================

create table if not exists public.veterans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  palier int not null default 0 check (palier between 0 and 3),
  adieu boolean not null default false,
  detail jsonb not null default '{}'::jsonb,   -- niveau, Dofus, stasis de la meilleure partie (pour vérifier à la main)
  cree timestamptz not null default now(),
  maj timestamptz not null default now()
);
alter table public.veterans enable row level security;
revoke all on public.veterans from anon, authenticated;

-- Parties validées du compte (Éternel, Classique · Saison 1, Monocompte), sans celles retirées des classements pour triche.
create or replace function public.veteran_parties(p_user uuid)
returns table (srv text, data text)
language sql security definer set search_path = public as $$
  select 'eternel', o.data from public.saves_ok o
    where o.user_id = p_user and not exists (select 1 from public.ladder l where l.user_id = p_user and l.flagged)
  union all
  select 's1', o.data from s1.saves_ok o
    where o.user_id = p_user and not exists (select 1 from s1.ladder l where l.user_id = p_user and l.flagged)
  union all
  (select 'mono', p.data from mono.parties_ok p where p.user_id = p_user order by p.at desc limit 4)
$$;
revoke all on function public.veteran_parties(uuid) from public, anon, authenticated;
grant execute on function public.veteran_parties(uuid) to service_role;

-- Écrit le palier calculé par la fonction record (jamais plus bas qu'avant) et crée le code au premier passage.
create or replace function public.veteran_set(p_user uuid, p_palier int, p_adieu boolean, p_detail jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.veterans; c text; h text;
begin
  select * into r from public.veterans where user_id = p_user;
  if r.user_id is null then
    loop
      h := upper(replace(gen_random_uuid()::text, '-', ''));
      c := 'IDLUS-' || substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4);
      exit when not exists (select 1 from public.veterans where code = c);
    end loop;
    insert into public.veterans (user_id, code, palier, adieu, detail)
      values (p_user, c, greatest(0, least(3, coalesce(p_palier, 0))), coalesce(p_adieu, false), coalesce(p_detail, '{}'::jsonb))
      returning * into r;
  else
    update public.veterans set palier = greatest(palier, least(3, coalesce(p_palier, 0))), adieu = adieu or coalesce(p_adieu, false),
      detail = case when coalesce(p_palier, 0) >= palier then coalesce(p_detail, detail) else detail end, maj = now()
      where user_id = p_user returning * into r;
  end if;
  return jsonb_build_object('code', r.code, 'palier', r.palier, 'adieu', r.adieu);
end $$;
revoke all on function public.veteran_set(uuid, int, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.veteran_set(uuid, int, boolean, jsonb) to service_role;

-- Diablofus (son serveur) : palier et Défi d'adieu d'un code, rien d'autre (ni pseudo ni compte). null si le code n'existe pas.
-- Le code fait 48 bits tirés au hasard : impossible à deviner en essayant.
create or replace function public.veteran_lookup(p_code text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('palier', v.palier, 'adieu', v.adieu) from public.veterans v
    where v.code = upper(btrim(coalesce(p_code, ''))) and (v.palier > 0 or v.adieu)
$$;
revoke all on function public.veteran_lookup(text) from public;
grant execute on function public.veteran_lookup(text) to anon, authenticated, service_role;

-- Chiffres pour Mathis (lecture seule, sans pseudo) : combien de comptes par palier
create or replace function public.veteran_stats()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('codes', count(*), 'bronze', count(*) filter (where palier = 1), 'argent', count(*) filter (where palier = 2),
    'or', count(*) filter (where palier = 3), 'adieu', count(*) filter (where adieu)) from public.veterans
$$;
revoke all on function public.veteran_stats() from public, anon, authenticated;
grant execute on function public.veteran_stats() to service_role;
