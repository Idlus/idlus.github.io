-- ============================================================================
-- Idlus — récompense de vote sur Dofus Fan Games (choix de Mathis du 02/11/2026 : 1C Sablier + kamas, 2C sans limite par jour).
-- Le joueur vote sur https://dofusfangames.com/jeu/idlus, puis clique « Récupérer » dans le jeu. La fonction serveur « vote »
-- (supabase/functions/vote) lit son adresse IP, demande à l'API du site si cette adresse a voté (clé secrète gardée ici, dans
-- vote_cfg, jamais envoyée au jeu), puis appelle vote_srv_claim. Les kamas et le Sablier arrivent par la voie de l'hôtel de vente
-- (hdv_ops, js/market.js) : le Bouclier les compte déjà comme un don du serveur, et rien n'est perdu si l'onglet se ferme.
-- Règles : un vote = une récompense (empreinte de l'IP + heure du vote), une récompense par compte toutes les 55 minutes
-- (le site laisse revoter toutes les heures), comptes connectés seulement, partie Classique (hdv_ops), compte en vérification refusé.
-- Aucune adresse IP n'est gardée : seulement une empreinte SHA-256 salée (le sel est dans vote_cfg), effacée après 30 jours.
-- 03/11 (Mathis 2A + Sablier, 3A+B) : bonus de série (kamas et Sablier) et objectif du mois (paliers pour tout le serveur, +1 h aux votants).
-- 04/11 (Mathis : « pouvoir voter sur classique et monocompte saison 1 ») : la récompense va dans la partie où le joueur clique
-- « Récupérer » : Éternel (hdv_ops), Classique · Saison 1 (s1.hdv_ops, supabase/saison1.sql) ou Monocompte de la saison ouverte
-- (mono.ops, supabase/monocompte.sql). Un vote reste une seule récompense, et une par compte toutes les 55 minutes, toutes parties confondues.
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
alter table public.vote_claims add column if not exists cible text not null default 'eternel'; -- 04/11 : partie qui a reçu la récompense
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

-- Jour et mois de Paris d'un instant (série de jours, objectif du mois)
create or replace function public.vote_jour(t timestamptz) returns date language sql immutable as $$ select (t at time zone 'Europe/Paris')::date $$;
create or replace function public.vote_mois(t timestamptz) returns text language sql immutable as $$ select to_char(t at time zone 'Europe/Paris', 'YYYY-MM') $$;
create index if not exists vote_claims_at on public.vote_claims (at);

-- 2A (Mathis 03/11) : série = jours de Paris d'affilée avec au moins un vote récompensé, jusqu'à hier (aujourd'hui ne casse rien).
-- Chaque jour d'affilée avant aujourd'hui ajoute 10 % de kamas ET de Sablier au vote, jusqu'à +50 %.
create or replace function public.vote_serie(p_user uuid) returns int language plpgsql stable security definer set search_path = public
as $$ declare d date := vote_jour(now()) - 1; n int := 0;
begin
  while exists (select 1 from vote_claims where user_id = p_user and at >= (d::timestamp at time zone 'Europe/Paris') and at < ((d + 1)::timestamp at time zone 'Europe/Paris')) and n < 400 loop
    n := n + 1; d := d - 1;
  end loop;
  return n;
end $$;
create or replace function public.vote_bonus(p_user uuid) returns int language sql stable security definer set search_path = public
as $$ select 10 * least(5, vote_serie(p_user)) $$;

-- 3A+B : objectif du mois. Chaque palier atteint par tous les votes du mois donne du Sablier à tout joueur du Classique qui se
-- connecte ce mois-ci (vote_moi le verse, une fois par palier), et 1 h de plus à ceux qui ont voté ce mois-ci.
create table if not exists public.vote_paliers_pris (
  user_id uuid not null references auth.users (id) on delete cascade,
  mois text not null,
  palier int not null,
  h real not null,
  at timestamptz not null default now(),
  primary key (user_id, mois, palier)
);
alter table public.vote_paliers_pris enable row level security;
create or replace function public.vote_paliers() returns jsonb language sql immutable
as $$ select '[{"n": 250, "h": 1}, {"n": 500, "h": 2}, {"n": 1000, "h": 3}]'::jsonb $$;

-- 04/11 : la partie qui reçoit (« eternel », « s1 » ou « mono ») : connue du serveur ? niveau du héros principal, compte en vérification
create or replace function public.vote_cible(p_cible text) returns text language sql immutable
as $$ select case when p_cible in ('s1', 'mono') then p_cible else 'eternel' end $$;
create or replace function public.vote_partie(p_user uuid, p_cible text) returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare lv int; fl boolean; s int; begin
  if p_cible = 's1' then
    if to_regclass('s1.ladder') is null then return jsonb_build_object('err', 'La Saison 1 n''est pas encore ouverte sur le serveur.'); end if;
    select main_lvl, flagged into lv, fl from s1.ladder where user_id = p_user;
    if not found then return jsonb_build_object('err', 'Ta partie Saison 1 n''est pas encore sur le serveur : joue quelques minutes en ligne, puis réessaie.'); end if;
  elsif p_cible = 'mono' then
    if to_regclass('mono.parties') is null then return jsonb_build_object('err', 'Le Monocompte n''est pas ouvert sur le serveur.'); end if;
    s := mono.saison_ouverte();
    if s is null then return jsonb_build_object('err', 'Aucune saison Monocompte ouverte en ce moment.'); end if;
    if not exists (select 1 from mono.parties where user_id = p_user and saison = s) then
      return jsonb_build_object('err', 'Ta partie Monocompte n''est pas encore sur le serveur : joue quelques minutes en ligne, puis réessaie.'); end if;
    select niveau into lv from mono.lb_saison where user_id = p_user and saison = s;
  else
    select main_lvl, flagged into lv, fl from ladder where user_id = p_user;
  end if;
  if coalesce(fl, false) then return jsonb_build_object('err', 'Ton compte est en vérification : la récompense de vote attendra.', 'flag', true); end if;
  return jsonb_build_object('ok', true, 'lvl', greatest(1, coalesce(lv, 1)), 's', s);
end $$;
-- verse dans la partie choisie, par son registre (le Bouclier de chaque espace compte déjà ces gains comme un don du serveur)
create or replace function public.vote_verse(p_user uuid, p_cible text, p jsonb, t text) returns void language plpgsql security definer set search_path = public
as $$ begin
  if p_cible = 's1' then perform s1.hdv_op(p_user, p, t);
  elsif p_cible = 'mono' then perform mono.op(p_user, mono.saison_ouverte(), p, t);
  else perform hdv_op(p_user, p, t); end if;
end $$;
revoke all on function public.vote_partie(uuid, text) from public, anon, authenticated;
revoke all on function public.vote_verse(uuid, text, jsonb, text) from public, anon, authenticated;

-- ---------- côté serveur (fonction « vote », rôle service_role) ----------
create or replace function public.vote_srv_cfg() returns jsonb language sql stable security definer set search_path = public
as $$ select jsonb_build_object('cle', cle, 'sel', sel, 'actif', actif) from vote_cfg where id = 1 $$;

drop function if exists public.vote_srv_claim(uuid, text, bigint);
create or replace function public.vote_srv_claim(p_user uuid, p_ip text, p_voted_at bigint, p_cible text default 'eternel') returns jsonb
language plpgsql security definer set search_path = public
as $$ declare
  c text := vote_cible(p_cible); pt jsonb; last timestamptz; k bigint; s real; b int; n int;
begin
  if p_user is null or coalesce(p_ip, '') = '' or coalesce(p_voted_at, 0) <= 0 then return jsonb_build_object('err', 'Demande invalide.'); end if;
  -- l'empreinte de l'adresse n'est gardée que 30 jours (les votes restent comptés : total, mois, série)
  update vote_claims set ip = 'efface:' || id where at < now() - interval '30 days' and ip not like 'efface:%';
  pt := vote_partie(p_user, c);
  if pt ? 'err' then return jsonb_build_object('err', pt ->> 'err'); end if;
  if exists (select 1 from vote_claims where ip = p_ip and voted_at = p_voted_at) then
    return jsonb_build_object('deja', true);
  end if;
  select max(at) into last from vote_claims where user_id = p_user;
  if last is not null and last > now() - interval '55 minutes' then
    return jsonb_build_object('attente', ceil(extract(epoch from (last + interval '55 minutes' - now())))::int);
  end if;
  b := vote_bonus(p_user);
  k := round(vote_kamas((pt ->> 'lvl')::int) * (100 + b) / 100.0);
  s := 0.5 * (100 + b) / 100.0;
  insert into vote_claims (user_id, ip, voted_at, k, sab, cible) values (p_user, p_ip, p_voted_at, k, s, c) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('deja', true); end if; -- deux clics en même temps : un seul passe
  perform vote_verse(p_user, c, jsonb_build_object('k', k, 'sab', s, 'vote', 1),
    'Merci pour ton vote sur Dofus Fan Games : ' || replace(to_char(k, 'FM999G999G999'), ',', ' ') || ' kamas et ' || round(s * 60) || ' min de Sablier'
    || case when b > 0 then ' (série +' || b || ' %).' else '.' end);
  return jsonb_build_object('ok', true, 'k', k, 'sab', s, 'bonus', b, 'cible', c);
end $$;

revoke all on function public.vote_srv_cfg() from public, anon, authenticated;
revoke all on function public.vote_srv_claim(uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.vote_serie(uuid) from public, anon, authenticated;
revoke all on function public.vote_bonus(uuid) from public, anon, authenticated;
grant execute on function public.vote_srv_cfg() to service_role;
grant execute on function public.vote_srv_claim(uuid, text, bigint, text) to service_role;

-- ---------- côté joueur : où j'en suis, objectif du mois, votants du mois ; verse les paliers atteints ----------
-- 04/11 : p_cible = partie ouverte dans le jeu ; les paliers et le titre y sont versés (une fois par compte, dans la première partie qui les voit)
drop function if exists public.vote_moi();
create or replace function public.vote_moi(p_cible text default 'eternel') returns jsonb language plpgsql security definer set search_path = public
as $$ declare
  me uuid := auth.uid(); c text := vote_cible(p_cible); pt jsonb; m text := vote_mois(now()); d0 date := vote_jour(now());
  debut timestamptz := (date_trunc('month', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris';
  tot int; nm int; P jsonb := vote_paliers(); x jsonb; h real; paye jsonb := '[]'::jsonb; flag boolean;
  avant timestamptz := (date_trunc('month', now() at time zone 'Europe/Paris') - interval '1 month') at time zone 'Europe/Paris'; mp text; rg int; titre jsonb := null;
begin
  if me is null then return jsonb_build_object('actif', false); end if;
  select count(*) into tot from vote_claims where at >= debut;
  select count(*) into nm from vote_claims where user_id = me and at >= debut;
  pt := vote_partie(me, c); flag := pt ? 'err'; -- partie inconnue du serveur ou compte en vérification : rien n'est versé ni compté pris
  if not flag then
    for x in select * from jsonb_array_elements(P) loop
      if tot >= (x->>'n')::int and not exists (select 1 from vote_paliers_pris where user_id = me and mois = m and palier = (x->>'n')::int) then
        h := (x->>'h')::real + case when nm > 0 then 1 else 0 end;
        insert into vote_paliers_pris (user_id, mois, palier, h) values (me, m, (x->>'n')::int, h) on conflict do nothing;
        if found then
          perform vote_verse(me, c, jsonb_build_object('sab', h, 'vote', 1), 'Objectif des votes du mois : ' || (x->>'n') || ' votes atteints, ' || h || ' h de Sablier pour toi' || case when nm > 0 then ' (dont 1 h pour ton vote).' else '.' end);
          paye := paye || jsonb_build_object('n', (x->>'n')::int, 'h', h);
        end if;
      end if;
    end loop;
    -- 4 (Mathis 03/11 : « Réservés au top 10 ») : le top 10 des votants du mois précédent reçoit le titre « Voix d'Idlus »
    mp := vote_mois(avant);
    if not exists (select 1 from vote_paliers_pris where user_id = me and mois = mp and palier = 0) then
      select r into rg from (select c.user_id, rank() over (order by count(*) desc) as r from vote_claims c left join ladder l on l.user_id = c.user_id
        where c.at >= avant and c.at < debut and not coalesce(l.flagged, false) group by c.user_id) t where t.user_id = me;
      if rg is not null and rg <= 10 then
        insert into vote_paliers_pris (user_id, mois, palier, h) values (me, mp, 0, 0) on conflict do nothing;
        if found then
          perform vote_verse(me, c, jsonb_build_object('title', 'Voix d''Idlus', 'vote', 1), 'Top 10 des votants du mois dernier (n° ' || rg || ') : titre « Voix d''Idlus » !');
          titre := jsonb_build_object('rang', rg, 't', 'Voix d''Idlus');
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object(
    'titre', titre, 'cible', c, 'partie', pt ->> 'err',
    'actif', coalesce((select actif and cle is not null from vote_cfg where id = 1), false),
    'last', (select max(at) from vote_claims where user_id = me),
    'n', (select count(*) from vote_claims where user_id = me),
    'nm', nm,
    'serie', vote_serie(me) + case when exists (select 1 from vote_claims where user_id = me and at >= (d0::timestamp at time zone 'Europe/Paris')) then 1 else 0 end,
    'bonus', vote_bonus(me),
    'jours', (select jsonb_agg(jsonb_build_object('d', to_char(g, 'DD/MM'), 'j', (array['dim','lun','mar','mer','jeu','ven','sam'])[extract(dow from g)::int + 1],
        'n', (select count(*) from vote_claims c where c.user_id = me and vote_jour(c.at) = g::date)) order by g)
      from generate_series(d0 - 6, d0, interval '1 day') g),
    'obj', jsonb_build_object('n', tot, 'cible', 1000, 'fin', 'jusqu''au ' || to_char((date_trunc('month', d0) + interval '1 month - 1 day'), 'DD/MM'),
      'paliers', (select jsonb_agg(jsonb_build_object('n', (y->>'n')::int, 'r', (y->>'h') || ' h de Sablier pour tous, +1 h aux votants')) from jsonb_array_elements(P) y)),
    'paye', paye,
    'top', (select coalesce(jsonb_agg(jsonb_build_object('p', t.pseudo, 'n', t.n, 'moi', t.user_id = me) order by t.n desc, t.pseudo), '[]'::jsonb) from (
      select c.user_id, p.pseudo, count(*) as n from vote_claims c join profiles p on p.id = c.user_id left join ladder l on l.user_id = c.user_id
      where c.at >= debut and not coalesce(l.flagged, false) group by c.user_id, p.pseudo order by count(*) desc, p.pseudo limit 10) t),
    'now', now());
end $$;
revoke all on function public.vote_moi(text) from public;
grant execute on function public.vote_moi(text) to authenticated;
-- partie Monocompte : seules les fonctions mono_* partent du jeu (liste blanche E.MONO.RPC, js/mono.js) ; versé par mono.ops
create or replace function public.mono_vote_moi() returns jsonb language sql security invoker set search_path = public
as $$ select public.vote_moi('mono') $$;
revoke all on function public.mono_vote_moi() from public;
grant execute on function public.mono_vote_moi() to authenticated;

-- Panel de Mathis : combien de votes récompensés (aujourd'hui, 7 jours, 30 jours)
create or replace function public.adm_votes() returns jsonb language plpgsql stable security definer set search_path = public
as $$ begin
  perform adm_need(true);
  return jsonb_build_object(
    'jour', (select count(*) from vote_claims where at > date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'sept', (select count(*) from vote_claims where at > now() - interval '7 days'),
    'trente', (select count(*) from vote_claims where at > now() - interval '30 days'),
    'mois', (select count(*) from vote_claims where at >= (date_trunc('month', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris'),
    'joueurs', (select count(distinct user_id) from vote_claims where at > now() - interval '7 days'),
    'parties', (select coalesce(jsonb_object_agg(cible, n), '{}'::jsonb) from (select cible, count(*) as n from vote_claims where at > now() - interval '7 days' group by cible) x));
end $$;
revoke all on function public.adm_votes() from public;
grant execute on function public.adm_votes() to authenticated;
