-- ============================================================================
-- Idlus 1.0.30 « L'économie » : vente directe des ressources au jeu (choix 13 à 17).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger : ne supprime ni ne modifie
-- aucune donnée de joueur (seul l'historique des prix de plus de 4 jours est effacé au fil des ventes).
--
-- Prix d'une unité = prix de base (vente_base, écrit par supabase/vente_data.sql) × coef de la ressource.
-- Le coef est commun à tout le serveur, de ×0,1 (plancher) à ×3 (plafond) :
--   - chaque vente le fait baisser de quantité / 2 000 (vendre 2 000 unités : −1) ; un gros lot est payé unité par
--     unité au coef du moment (aire sous le coef) : il baisse pendant la vente ;
--   - sans vente, il remonte tout seul vers ×3 : la moitié de l'écart en 6 h.
-- Équilibre pour r unités vendues par heure : coef = 3 − r / 231. Même calcul dans le jeu (E.VENTE, js/vente.js ;
-- tests/vente.test.js le vérifie).
-- Une vente passe comme celles de l'Hôtel de vente (supabase/hdv.sql) : le serveur vérifie la ressource dans la
-- partie en ligne (hdv_save, hdv_qty) puis écrit une opération (hdv_op : kamas +, ressource −) que le jeu applique
-- et dont il garde le numéro (S.hdv.op, paramètre p_after).
-- Guilde (branche des guildes) : si public.guild_sale_share(uuid, bigint) existe, elle verse la part de la guilde au
-- coffre et renvoie le montant pris ; si public.guild_has_upgrade(uuid, text) dit vrai pour 'comptoir', +5 % au prix.
-- Sans ces fonctions, la vente marche pareil, sans part ni bonus.
-- Le jeu ne touche jamais les tables : tout passe par vente_sell, vente_cours et vente_courbe.
-- ============================================================================
create table if not exists public.vente_base (key text primary key, base int not null);
alter table public.vente_base enable row level security;

create table if not exists public.vente_cours (
  key text primary key,
  c real not null default 3,               -- coef à l'instant t
  v real not null default 0,               -- volume vendu récemment, à l'instant t (s'efface de moitié en 6 h)
  t timestamptz not null default now()
);
alter table public.vente_cours enable row level security;

-- Une ligne par ressource et par heure : quantité vendue, coef juste après la dernière vente de l'heure (courbe 48 h)
create table if not exists public.vente_hist (
  key text not null,
  h timestamptz not null,                  -- début de l'heure
  q bigint not null default 0,
  c real not null,
  t timestamptz not null,                  -- moment de la dernière vente de l'heure
  primary key (key, h)
);
create index if not exists vente_hist_h on public.vente_hist (h);
alter table public.vente_hist enable row level security;

create table if not exists public.vente_quota (
  user_id uuid primary key references auth.users (id) on delete cascade,
  t timestamptz not null default now(),    -- début de la tranche de 10 minutes
  n int not null default 0                 -- ventes dans la tranche (60 au plus)
);
alter table public.vente_quota enable row level security;

-- Coef et volume maintenant, depuis leur valeur à l'instant t (21 600 s = 6 h : la moitié de l'écart).
create or replace function public.vente_c(c real, t timestamptz) returns double precision language sql stable as $$
  select least(3, greatest(0.1, 3 - (3 - c) * power(2::double precision, -greatest(0, extract(epoch from now() - t))::double precision / 21600)))
$$;
create or replace function public.vente_v(v real, t timestamptz) returns double precision language sql stable as $$
  select greatest(0, v * power(2::double precision, -greatest(0, extract(epoch from now() - t))::double precision / 21600))
$$;

-- Comptoir de guilde : +5 % (seulement si la fonction des guildes existe)
create or replace function public.vente_up(p_user uuid) returns boolean language plpgsql stable security definer set search_path = public
as $$
declare up boolean := false;
begin
  if p_user is null or to_regprocedure('public.guild_has_upgrade(uuid,text)') is null then return false; end if;
  begin execute 'select coalesce(public.guild_has_upgrade($1, $2), false)' into up using p_user, 'comptoir';
  exception when others then up := false;
  end;
  return coalesce(up, false);
end $$;

-- ---------- fonctions appelées par le jeu ----------
-- Vendre des ressources : p_lots = { "ressource": quantité, … } (40 ressources au plus). Le serveur vend ce que la
-- partie en ligne contient vraiment (au plus la quantité demandée). Renvoie { ok, sold: { ressource: quantité },
-- k (kamas reçus), share (part du coffre de guilde), up (Comptoir de guilde), c: { ressource: [coef, volume] }, ops }.
create or replace function public.vente_sell(p_after bigint, p_lots jsonb) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; e record; b int; q bigint; have numeric; r vente_cours; cnt int; up boolean;
  c0 double precision; v0 double precision; c1 double precision; q1 double precision; units double precision;
  k bigint; ktot bigint := 0; share bigint := 0; nq bigint := 0; nk int := 0; one text;
  sold jsonb := '{}'::jsonb; res jsonb := '{}'::jsonb; cs jsonb := '{}'::jsonb; fn regprocedure; txt text;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(replace(sqlerrm, 'l''hôtel de vente', 'la vente directe')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_lots is null or jsonb_typeof(p_lots) <> 'object' then return hdv_err('Vente invalide.'); end if;
  if (select count(*) from jsonb_object_keys(p_lots)) > 40 then return hdv_err('40 ressources au plus d''un coup.'); end if;
  -- 60 ventes par tranche de 10 minutes au plus
  insert into vente_quota as x (user_id, t, n) values (me, now(), 1)
    on conflict (user_id) do update set t = case when x.t < now() - interval '10 minutes' then now() else x.t end,
      n = case when x.t < now() - interval '10 minutes' then 1 else x.n + 1 end
    returning x.n into cnt;
  if cnt > 60 then return hdv_err('Trop de ventes d''un coup : réessaie dans quelques minutes.'); end if;
  up := vente_up(me);
  -- dans l'ordre des noms : deux vendeurs verrouillent les lignes dans le même ordre (pas d'interblocage)
  for e in select j.key, j.value from jsonb_each(p_lots) j order by j.key loop
    q := case when jsonb_typeof(e.value) = 'number' then least(10000000, greatest(0, floor((e.value)::text::numeric)))::bigint else 0 end;
    if q < 1 then continue; end if;
    select base into b from vente_base where key = e.key;
    if b is null or b < 1 then continue; end if;
    have := hdv_qty(me, d, 'res', e.key);
    q := least(q, floor(have)::bigint);
    if q < 1 then continue; end if;
    insert into vente_cours (key) values (e.key) on conflict (key) do nothing;
    select * into r from vente_cours where key = e.key for update;
    c0 := vente_c(r.c, r.t); v0 := vente_v(r.v, r.t);
    c1 := c0 - q / 2000.0;
    if c1 >= 0.1 then units := q * (c0 + c1) / 2;                                   -- le coef baisse en ligne droite pendant la vente
    else q1 := (c0 - 0.1) * 2000; units := q1 * (c0 + 0.1) / 2 + (q - q1) * 0.1; c1 := 0.1; -- le plancher est atteint en route
    end if;
    k := floor(b * units * (case when up then 1.05 else 1 end) + 1e-9);
    update vente_cours set c = c1, v = v0 + q, t = now() where key = e.key;
    insert into vente_hist as hh (key, h, q, c, t) values (e.key, date_trunc('hour', now()), q, c1, now())
      on conflict (key, h) do update set q = hh.q + excluded.q, c = excluded.c, t = excluded.t;
    ktot := ktot + k; nq := nq + q; nk := nk + 1; one := e.key;
    res := res || jsonb_build_object(e.key, -q); sold := sold || jsonb_build_object(e.key, q);
    cs := cs || jsonb_build_object(e.key, jsonb_build_array(round(c1::numeric, 4), round((v0 + q)::numeric, 1)));
  end loop;
  if nk = 0 then return hdv_err('Rien à vendre : ta partie en ligne n''a pas ces ressources (attends quelques secondes et réessaie).'); end if;
  -- part de la guilde (fonction de la branche des guildes : elle verse au coffre et renvoie le montant pris)
  fn := to_regprocedure('public.guild_sale_share(uuid,bigint)');
  if ktot > 0 and fn is not null and pg_get_function_result(fn) in ('bigint', 'integer', 'numeric', 'smallint') then
    begin execute 'select coalesce(public.guild_sale_share($1, $2), 0)::bigint' into share using me, ktot;
    exception when others then share := 0; -- coffre indisponible : tout revient au vendeur
    end;
    share := least(greatest(coalesce(share, 0), 0), ktot);
  end if;
  txt := 'Vente directe : ' || case when nk = 1 then nq || ' × ' || one else nk || ' ressources (' || nq || ' unités)' end
    || ' pour ' || (ktot - share) || ' kamas' || case when share > 0 then ' (+' || share || ' pour le coffre de ta guilde)' else '' end;
  perform hdv_op(me, jsonb_build_object('k', ktot - share, 'res', res, 'vd', 1), txt);
  -- de temps en temps : l'historique de plus de 4 jours et les vieux compteurs s'effacent
  if random() < 0.02 then
    delete from vente_hist where h < now() - interval '4 days';
    delete from vente_quota where t < now() - interval '1 day';
  end if;
  return jsonb_build_object('ok', true, 'sold', sold, 'k', ktot - share, 'share', share, 'up', up, 'c', cs, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Tous les coefs : { c: { ressource: [coef, volume récent, vendues en 24 h] }, up, t (heure du serveur en ms) }.
-- Les ressources absentes sont au plafond ×3, sans vente récente. Le jeu la relit toutes les 15 minutes au plus,
-- et calcule la remontée entre deux lectures (E.venteNow).
create or replace function public.vente_cours() returns jsonb language plpgsql stable security definer set search_path = public
as $$
begin
  return jsonb_build_object(
    'c', coalesce((select jsonb_object_agg(x.key, jsonb_build_array(round(x.cc::numeric, 3), round(x.vv::numeric, 1), coalesce(s.q, 0)))
      from (select key, vente_c(c, t) cc, vente_v(v, t) vv from vente_cours) x
      left join (select key, sum(q) q from vente_hist where h > now() - interval '24 hours' group by key) s on s.key = x.key
      where x.cc < 2.995 or x.vv >= 1 or coalesce(s.q, 0) > 0), '{}'::jsonb),
    'up', vente_up(auth.uid()),
    't', floor(extract(epoch from now()) * 1000));
end $$;

-- Courbe d'une ressource : { pts: [[t (ms), coef, quantité], …] (une ligne par heure, 4 jours au plus), c: [coef, volume], base, t }
create or replace function public.vente_courbe(p_key text) returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'pts', coalesce((select jsonb_agg(jsonb_build_array(floor(extract(epoch from t) * 1000), round(c::numeric, 3), q) order by h)
      from vente_hist where key = p_key and h > now() - interval '4 days'), '[]'::jsonb),
    'c', coalesce((select jsonb_build_array(round(vente_c(c, t)::numeric, 3), round(vente_v(v, t)::numeric, 1)) from vente_cours where key = p_key), jsonb_build_array(3, 0)),
    'base', (select base from vente_base where key = p_key),
    't', floor(extract(epoch from now()) * 1000))
$$;

-- ---------- droits ----------
do $$
declare f text;
begin
  foreach f in array array['vente_c(real, timestamptz)', 'vente_v(real, timestamptz)', 'vente_up(uuid)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  execute 'revoke all on function public.vente_sell(bigint, jsonb) from public, anon';
  execute 'grant execute on function public.vente_sell(bigint, jsonb) to authenticated';
  foreach f in array array['vente_cours()', 'vente_courbe(text)'] loop
    execute 'revoke all on function public.' || f || ' from public';
    execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
end $$;
