-- ============================================================================
-- Idlus — coefficient de brisage commun à tous les joueurs en ligne (0.1.43, comme sur un serveur DOFUS).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger.
-- Chaque brisage d'un modèle d'objet baisse son coefficient de 3 % (minimum 10 %) ; il remonte de 1 % toutes les 6 minutes.
-- 1.0.30 « Forge » (choix 43A de Mathis) : de 10 % à 200 %. Sous 100 %, +1 % toutes les 6 minutes comme avant ; au-dessus,
-- +1 % par heure jusqu'à 200 % tant que personne ne brise ce modèle. Un modèle jamais brisé suit le coefficient de départ :
-- 100 % à l'installation de ce fichier (brisage_base), puis +1 % par heure jusqu'à 200 %.
-- L'installation ne supprime ni ne modifie aucune ligne existante ; brisage_list et brisage_hit gardent leur forme pour les
-- versions du jeu d'avant la 1.0.30 (modèles sous 100 %), brisage_sync et brisage_hit_sync servent la 1.0.30.
-- Le jeu ne touche jamais les tables : il lit la liste et envoie ses brisages par les fonctions ci-dessous.
-- ============================================================================
create table if not exists public.brisage_coef (
  tpl text primary key,
  v real not null default 100,
  t timestamptz not null default now()
);
alter table public.brisage_coef enable row level security;
create table if not exists public.brisage_hits (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  n int not null default 0
);
create index if not exists brisage_hits_user on public.brisage_hits (user_id, at);
alter table public.brisage_hits enable row level security;

-- 1.0.30 : départ des coefficients au-dessus de 100 % (une seule ligne, posée à la première installation)
create table if not exists public.brisage_base (
  id int primary key default 1 check (id = 1),
  t timestamptz not null default now()
);
alter table public.brisage_base enable row level security;
insert into public.brisage_base (id) values (1) on conflict (id) do nothing;
create index if not exists brisage_coef_t on public.brisage_coef (t);

-- 1.0.30 : coefficient actuel d'une ligne enregistrée à p_v % à l'heure p_t (même calcul que E.coefAt dans js/engine.js)
create or replace function public.brisage_cur(p_v real, p_t timestamptz) returns int
language sql stable set search_path = public as $$
  select (case
    when v < 100 and m < (100 - v) * 6 then floor(v + m / 6)
    when v < 100 then least(200, 100 + floor((m - (100 - v) * 6) / 60))
    else least(200, floor(v + m / 60)) end)::int
  from (select p_v::float8 as v, greatest(0, extract(epoch from now() - p_t)::float8 / 60) as m) x;
$$;

-- 1.0.30 : coefficient d'un modèle jamais brisé (100 % à l'installation, +1 % par heure jusqu'à 200 %)
create or replace function public.brisage_def() returns int
language sql stable set search_path = public as $$
  select coalesce((select public.brisage_cur(100, b.t) from public.brisage_base b where b.id = 1), 100);
$$;

-- Les modèles dont le coefficient est sous 100 % : { "modèle": coefficient } (versions d'avant la 1.0.30)
create or replace function public.brisage_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(tpl, cur), '{}'::jsonb)
  from (select c.tpl, least(b.d, public.brisage_cur(c.v, c.t)) as cur from public.brisage_coef c, (select public.brisage_def() as d) b) x
  where cur < 100;
$$;

-- 1.0.30 : (interne) enregistre des brisages, au plus 300 par appel et 1 500 par tranche de 10 minutes et par joueur.
-- Renvoie null, ou le message d'erreur. Chaque brisage : coefficient actuel − 3 %, au moins 10 %.
create or replace function public.brisage_apply(p_tpls text[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); n int; recent int; x text; d int;
begin
  if u is null then return 'Connexion requise.'; end if;
  n := coalesce(array_length(p_tpls, 1), 0);
  if n = 0 then return null; end if;
  if n > 300 then p_tpls := p_tpls[1:300]; n := 300; end if;
  select coalesce(sum(h.n), 0) into recent from public.brisage_hits h where h.user_id = u and h.at > now() - interval '10 minutes';
  if recent + n > 1500 then return 'Trop de brisages d''un coup : réessaie dans quelques minutes.'; end if;
  insert into public.brisage_hits (user_id, n) values (u, n);
  delete from public.brisage_hits where at < now() - interval '1 hour';
  d := public.brisage_def();
  foreach x in array p_tpls loop
    insert into public.brisage_coef as c (tpl, v, t) values (left(x, 40), greatest(10, d - 3), now())
    on conflict (tpl) do update set v = greatest(10, least(d, public.brisage_cur(c.v, c.t)) - 3), t = now();
  end loop;
  return null;
end;
$$;

-- Envoie des brisages et renvoie la liste à jour (versions d'avant la 1.0.30)
create or replace function public.brisage_hit(p_tpls text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public.brisage_apply(p_tpls);
  if e is not null then return jsonb_build_object('err', e); end if;
  return public.brisage_list();
end;
$$;

-- 1.0.30 : { now, t0 (heure du serveur et départ des coefficients, en millisecondes), since (à renvoyer au prochain appel),
-- rows: { modèle: [coefficient enregistré, heure en millisecondes] } }. Sans p_since : tous les modèles sous le coefficient
-- de départ ; avec : seulement ceux brisés depuis (le jeu garde les autres et calcule leur remontée lui-même).
create or replace function public.brisage_sync(p_since timestamptz default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'now', floor(extract(epoch from now()) * 1000)::bigint,
    't0', (select floor(extract(epoch from b.t) * 1000)::bigint from public.brisage_base b where b.id = 1),
    'since', now() - interval '1 minute',
    'rows', coalesce((select jsonb_object_agg(c.tpl, jsonb_build_array(c.v, floor(extract(epoch from c.t) * 1000)::bigint))
      from public.brisage_coef c, (select public.brisage_def() as d) b
      where case when p_since is null then least(b.d, public.brisage_cur(c.v, c.t)) < b.d else c.t > p_since end), '{}'::jsonb));
$$;

-- 1.0.30 : envoie des brisages puis renvoie ce qui a changé, comme brisage_sync
create or replace function public.brisage_hit_sync(p_tpls text[], p_since timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  e := public.brisage_apply(p_tpls);
  if e is not null then return jsonb_build_object('err', e); end if;
  return public.brisage_sync(p_since);
end;
$$;

revoke all on function public.brisage_list() from public;
revoke all on function public.brisage_hit(text[]) from public;
grant execute on function public.brisage_list() to anon, authenticated;
grant execute on function public.brisage_hit(text[]) to authenticated;
-- 1.0.30
revoke all on function public.brisage_cur(real, timestamptz) from public, anon, authenticated;
revoke all on function public.brisage_def() from public, anon, authenticated;
revoke all on function public.brisage_apply(text[]) from public, anon, authenticated;
revoke all on function public.brisage_sync(timestamptz) from public;
revoke all on function public.brisage_hit_sync(text[], timestamptz) from public;
grant execute on function public.brisage_sync(timestamptz) to anon, authenticated;
grant execute on function public.brisage_hit_sync(text[], timestamptz) to authenticated;
