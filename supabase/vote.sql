-- ============================================================================
-- Idlus — récompense de vote sur Dofus Fan Games (choix de Mathis du 02/11/2026 : 1C Sablier + kamas, 2C sans limite par jour).
-- Le joueur vote sur https://dofusfangames.com/jeu/idlus, puis clique « Récupérer » dans le jeu. La fonction serveur « vote »
-- (supabase/functions/vote) lit son adresse IP, demande à l'API du site si cette adresse a voté (clé secrète gardée ici, dans
-- vote_cfg, jamais envoyée au jeu), puis appelle vote_srv_claim. Les kamas et le Sablier arrivent par la voie de l'hôtel de vente
-- (hdv_ops, js/market.js) : le Bouclier les compte déjà comme un don du serveur, et rien n'est perdu si l'onglet se ferme.
-- Règles : un vote = une récompense (empreinte de l'IP + heure du vote), une récompense par compte toutes les 55 minutes
-- (le site laisse revoter toutes les heures), comptes connectés seulement, partie Classique (hdv_ops), compte en vérification refusé.
-- Aucune adresse IP n'est gardée : seulement une empreinte SHA-256 salée (le sel est dans vote_cfg), effacée après 30 jours.
-- S'appuie sur hdv.sql (hdv_op) et classements.sql (ladder). Relançable sans danger.
-- ============================================================================

-- Réglages (une seule ligne) : clé de l'API, posée par le workflow « Serveur OVH » (étape vote-cle) depuis le secret DFG_VOTE_KEY.
create table if not exists public.vote_cfg (
  id int primary key default 1 check (id = 1),
  cle text,
  sel text not null default md5(random()::text || clock_timestamp()::text),
  actif boolean not null default true
);
alter table public.vote_cfg enable row level security; -- aucune règle : seule la fonction serveur (service_role) la lit
insert into public.vote_cfg (id) values (1) on conflict (id) do nothing;

create table if not exists public.vote_claims (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ip text not null,          -- empreinte salée de l'adresse IP (jamais l'adresse)
  voted_at bigint not null,  -- heure du vote donnée par le site (secondes Unix)
  k bigint not null default 0,
  sab real not null default 0,
  at timestamptz not null default now()
);
create unique index if not exists vote_claims_vote on public.vote_claims (ip, voted_at);
create index if not exists vote_claims_user on public.vote_claims (user_id, at desc);
alter table public.vote_claims enable row level security;

-- Kamas d'un vote : un quart d'heure de gains ordinaires au niveau du héros principal (mêmes repères que V.KAMAS_PTS, js/verify.js),
-- de 5 000 kamas au niveau 1 à 217 500 au niveau 200. Le Sablier : 30 minutes (la réserve garde son plafond, E.sabGift).
create or replace function public.vote_kamas(p_lvl int) returns bigint language sql immutable as $$
  with p(l, k) as (values (1, 20000), (20, 75000), (60, 385000), (120, 510000), (200, 870000)),
  x as (select greatest(1, least(200, coalesce(p_lvl, 1))) as v),
  seg as (select a.l as l0, a.k as k0, b.l as l1, b.k as k1 from p a join p b on b.l = (select min(l) from p where l > a.l))
  select round(coalesce((select k0 + (k1 - k0) * ((select v from x) - l0)::numeric / (l1 - l0) from seg where (select v from x) <= l1 order by l1 limit 1), 870000) / 4)::bigint
$$;

-- ---------- côté serveur (fonction « vote », rôle service_role) ----------
create or replace function public.vote_srv_cfg() returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('cle', cle, 'sel', sel, 'actif', actif) from vote_cfg where id = 1 $$;

create or replace function public.vote_srv_claim(p_user uuid, p_ip text, p_voted_at bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$ declare
  l ladder%rowtype; last timestamptz; k bigint; s real := 0.5; n int;
begin
  if p_user is null or coalesce(p_ip, '') = '' or coalesce(p_voted_at, 0) <= 0 then return jsonb_build_object('err', 'Demande invalide.'); end if;
  delete from vote_claims where at < now() - interval '30 days';
  select * into l from ladder where user_id = p_user;
  if found and l.flagged then return jsonb_build_object('err', 'Ton compte est en vérification : la récompense de vote attendra.'); end if;
  if exists (select 1 from vote_claims where ip = p_ip and voted_at = p_voted_at) then
    return jsonb_build_object('deja', true);
  end if;
  select max(at) into last from vote_claims where user_id = p_user;
  if last is not null and last > now() - interval '55 minutes' then
    return jsonb_build_object('attente', ceil(extract(epoch from (last + interval '55 minutes' - now())))::int);
  end if;
  k := vote_kamas(coalesce(l.main_lvl, 1));
  insert into vote_claims (user_id, ip, voted_at, k, sab) values (p_user, p_ip, p_voted_at, k, s) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('deja', true); end if; -- deux clics en même temps : un seul passe
  perform hdv_op(p_user, jsonb_build_object('k', k, 'sab', s, 'vote', 1),
    'Merci pour ton vote sur Dofus Fan Games : ' || replace(to_char(k, 'FM999G999G999'), ',', ' ') || ' kamas et 30 min de Sablier.');
  return jsonb_build_object('ok', true, 'k', k, 'sab', s);
end $$;

revoke all on function public.vote_srv_cfg() from public, anon, authenticated;
revoke all on function public.vote_srv_claim(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.vote_srv_cfg() to service_role;
grant execute on function public.vote_srv_claim(uuid, text, bigint) to service_role;

-- ---------- côté joueur : où j'en suis (sans rien révéler d'autre) ----------
create or replace function public.vote_moi() returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object(
  'actif', coalesce((select actif and cle is not null from vote_cfg where id = 1), false),
  'last', (select max(at) from vote_claims where user_id = auth.uid()),
  'n', (select count(*) from vote_claims where user_id = auth.uid()),
  'now', now()) $$;
revoke all on function public.vote_moi() from public;
grant execute on function public.vote_moi() to authenticated;

-- Panel de Mathis : combien de votes récompensés (aujourd'hui, 7 jours, 30 jours)
create or replace function public.adm_votes() returns jsonb language plpgsql stable security definer set search_path = public
as $$ begin
  perform adm_need(true);
  return jsonb_build_object(
    'jour', (select count(*) from vote_claims where at > date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'sept', (select count(*) from vote_claims where at > now() - interval '7 days'),
    'trente', (select count(*) from vote_claims),
    'joueurs', (select count(distinct user_id) from vote_claims where at > now() - interval '7 days'));
end $$;
revoke all on function public.adm_votes() from public;
grant execute on function public.adm_votes() to authenticated;
