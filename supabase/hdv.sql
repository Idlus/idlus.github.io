-- ============================================================================
-- Idlus — hôtel de vente et échanges entre joueurs (multijoueur, étape 4).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger.
--
-- Principe : la partie reste sur l'appareil et part en ligne toutes les 30 s (saves.data).
-- Chaque mouvement de l'hôtel de vente est une « opération » (hdv_ops) que le jeu applique
-- à la partie, dans l'ordre, puis note le numéro de la dernière appliquée (S.hdv.op).
-- Pour vérifier qu'un joueur possède bien ce qu'il vend ou les kamas qu'il dépense, le
-- serveur part de sa dernière partie en ligne et y ajoute les opérations qu'elle ne
-- contient pas encore. Un objet mis en vente est copié depuis la partie en ligne (le jeu
-- ne peut pas inventer ses caractéristiques) et quitte la partie du vendeur.
-- Le jeu ne touche jamais les tables : tout passe par les fonctions ci-dessous.
-- ============================================================================

create table if not exists public.hdv_listings (
  id bigint generated always as identity primary key,
  seller uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('eq', 'res', 'rune', 'cons')),
  key text not null,              -- modèle d'objet (eq) ou nom de la ressource / rune / consommable
  name text not null,
  lvl int not null default 0,
  slot text,
  qty int not null default 1,     -- taille du lot (1, 10 ou 100 ; 1 pour un équipement)
  price bigint not null,          -- prix du lot
  item jsonb,                     -- l'objet exact (jet, forgemagie, Rayonnant) pour un équipement
  status text not null default 'open' check (status in ('open', 'sold', 'gone')),
  buyer uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  closed_at timestamptz
);
create index if not exists hdv_open_key on public.hdv_listings (key, price) where status = 'open';
create index if not exists hdv_open_cat on public.hdv_listings (cat, lvl) where status = 'open';
create index if not exists hdv_seller on public.hdv_listings (seller, status);
create index if not exists hdv_expire on public.hdv_listings (expires_at) where status = 'open';
alter table public.hdv_listings enable row level security;

create table if not exists public.hdv_ops (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,         -- { k: kamas, res|runes|cons: {nom: quantité}, rm: [uid], add: [objet] }
  txt text,
  at timestamptz not null default now()
);
create index if not exists hdv_ops_user on public.hdv_ops (user_id, id);
alter table public.hdv_ops enable row level security;

create table if not exists public.hdv_sales (
  id bigint generated always as identity primary key,
  key text not null, cat text not null, name text, qty int not null, price bigint not null,
  seller uuid, buyer uuid,
  at timestamptz not null default now()
);
create index if not exists hdv_sales_key on public.hdv_sales (key, at);
alter table public.hdv_sales enable row level security;

create table if not exists public.trades (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  offer_a jsonb not null default '{}'::jsonb,
  offer_b jsonb not null default '{}'::jsonb,
  ok_a boolean not null default false,
  ok_b boolean not null default false,
  ver int not null default 0,
  status text not null default 'open' check (status in ('open', 'done', 'cancel')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trades_a on public.trades (a, status);
create index if not exists trades_b on public.trades (b, status);
alter table public.trades enable row level security;

-- ---------- outils internes ----------
create or replace function public.hdv_err(t text) returns jsonb language sql immutable as $$ select jsonb_build_object('err', t) $$;

-- Partie en ligne d'un joueur autorisé à échanger, sinon une erreur lisible.
create or replace function public.hdv_save(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare d jsonb;
begin
  if p_user is null then raise exception 'Connecte-toi pour utiliser l''hôtel de vente.'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'Choisis d''abord ton pseudo.'; end if;
  if exists (select 1 from profiles where id = p_user and suspended_at is not null) then raise exception 'Compte suspendu.'; end if;
  if exists (select 1 from ladder where user_id = p_user and flagged) then raise exception 'Ta partie est en vérification : les échanges sont bloqués en attendant.'; end if;
  select data::jsonb into d from saves where user_id = p_user;
  if d is null then raise exception 'Ta partie n''est pas encore en ligne : attends quelques secondes.'; end if;
  if coalesce((d->>'panelUsed')::boolean, false) then raise exception 'Partie retouchée par le panel de test : tu peux regarder, mais pas vendre ni acheter.'; end if;
  return d;
end $$;

create or replace function public.hdv_cursor(d jsonb) returns bigint language sql immutable as $$ select coalesce((d->'hdv'->>'op')::bigint, 0) $$;

-- Kamas réels : partie en ligne + opérations pas encore dedans.
create or replace function public.hdv_kamas(p_user uuid, d jsonb) returns numeric language sql stable security definer set search_path = public
as $$ select coalesce((d->>'kamas')::numeric, 0) + coalesce((select sum((o.payload->>'k')::numeric) from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d)), 0) $$;

-- Quantité réelle d'une ressource ('res'), rune ('runes') ou consommable ('cons').
create or replace function public.hdv_qty(p_user uuid, d jsonb, b text, k text) returns numeric language sql stable security definer set search_path = public
as $$ select coalesce((d->b->>k)::numeric, 0) + coalesce((select sum((o.payload->b->>k)::numeric) from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d)), 0) $$;

create or replace function public.hdv_bucket(c text) returns text language sql immutable as $$ select case c when 'res' then 'res' when 'rune' then 'runes' when 'cons' then 'cons' end $$;

-- Objet échangeable ? Renvoie l'objet (sans uid) ou lève une erreur.
create or replace function public.hdv_item(p_user uuid, d jsonb, p_uid bigint) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare it jsonb;
begin
  it := d->'items'->(p_uid::text);
  if it is null then raise exception 'Objet introuvable dans ta partie en ligne : attends quelques secondes et réessaie.'; end if;
  if exists (select 1 from hdv_ops o where o.user_id = p_user and o.id > hdv_cursor(d) and o.payload->'rm' @> to_jsonb(array[p_uid])) then raise exception 'Cet objet n''est plus dans ton sac.'; end if;
  if coalesce((it->>'locked')::boolean, false) then raise exception 'Objet verrouillé : déverrouille-le d''abord.'; end if;
  if exists (select 1 from hdv_block where key = it->>'tpl') then raise exception 'Les Dofus et les trophées ne s''échangent pas.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c, jsonb_each_text(coalesce(c->'equip', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet équipé : retire-le d''abord.'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(d->'chars', '[]'::jsonb)) c, jsonb_array_elements(coalesce(c->'gear', '[]'::jsonb)) g, jsonb_each_text(coalesce(g->'eq', '{}'::jsonb)) e where e.value = p_uid::text) then raise exception 'Objet utilisé dans un équipement enregistré : retire-le d''abord.'; end if;
  return it - 'uid';
end $$;

create or replace function public.hdv_op(p_user uuid, p jsonb, t text) returns void language sql security definer set search_path = public
as $$ insert into hdv_ops (user_id, payload, txt) values (p_user, p, t) $$;

create or replace function public.hdv_ops_after(p_user uuid, p_after bigint) returns jsonb language sql stable security definer set search_path = public
as $$ select coalesce(jsonb_agg(jsonb_build_object('id', id, 'p', payload, 't', txt) order by id), '[]'::jsonb) from (select * from hdv_ops where user_id = p_user and id > coalesce(p_after, 0) order by id limit 300) o $$;

create or replace function public.hdv_back(L hdv_listings) returns jsonb language sql immutable
as $$ select case when L.cat = 'eq' then jsonb_build_object('add', jsonb_build_array(L.item)) else jsonb_build_object(hdv_bucket(L.cat), jsonb_build_object(L.key, L.qty)) end $$;

-- Annonces expirées : l'objet revient au vendeur.
create or replace function public.hdv_expire() returns void language plpgsql security definer set search_path = public
as $$
declare L hdv_listings;
begin
  for L in update hdv_listings set status = 'gone', closed_at = now() where id in (select id from hdv_listings where status = 'open' and expires_at < now() limit 200) returning * loop
    perform hdv_op(L.seller, hdv_back(L), 'Annonce expirée, revenue dans ton sac : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  end loop;
end $$;

create or replace function public.hdv_tax(p bigint) returns bigint language sql immutable as $$ select greatest(1, ceil(p * 0.02))::bigint $$;

-- ---------- fonctions appelées par le jeu ----------
create or replace function public.hdv_sync(p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  if auth.uid() is null then return hdv_err('non connecté'); end if;
  perform hdv_expire();
  perform hdv_order_expire();
  return jsonb_build_object('ops', hdv_ops_after(auth.uid(), p_after));
end $$;

create or replace function public.hdv_list(p_after bigint, p_cat text, p_key text, p_uid bigint, p_lot int, p_n int, p_price bigint, p_name text, p_lvl int, p_slot text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; it jsonb; b text; tax bigint; n int := greatest(1, coalesce(p_n, 1)); tpl text;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_price is null or p_price < 1 or p_price > 2000000000 then return hdv_err('Prix invalide.'); end if;
  if n > 20 then return hdv_err('20 lots au maximum d''un coup.'); end if;
  if (select count(*) from hdv_listings where seller = me and status = 'open') + n > 20 then return hdv_err('Plus de place : 20 ventes à la fois au maximum.'); end if;
  tax := hdv_tax(p_price);
  if hdv_kamas(me, d) < tax * n then return hdv_err('Pas assez de kamas pour la taxe de mise en vente.'); end if;
  if p_cat = 'eq' then
    begin it := hdv_item(me, d, p_uid); exception when raise_exception then return hdv_err(sqlerrm); end;
    tpl := it->>'tpl';
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price, item) values (me, 'eq', tpl, left(coalesce(p_name, tpl), 80), coalesce(p_lvl, 0), left(p_slot, 20), 1, p_price, it);
    perform hdv_op(me, jsonb_build_object('k', -tax, 'rm', jsonb_build_array(p_uid)), 'Mis en vente : ' || coalesce(p_name, tpl));
  elsif p_cat in ('res', 'rune', 'cons') then
    b := hdv_bucket(p_cat);
    if p_lot not in (1, 10, 100) then return hdv_err('Lots de 1, 10 ou 100.'); end if;
    if p_key is null or exists (select 1 from hdv_block where key = p_key) then return hdv_err('Cette ressource ne s''échange pas.'); end if;
    if hdv_qty(me, d, b, p_key) < p_lot * n then return hdv_err('Tu n''en as pas assez (ou la sauvegarde en ligne n''est pas encore à jour).'); end if;
    insert into hdv_listings (seller, cat, key, name, lvl, slot, qty, price) select me, p_cat, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_lot, p_price from generate_series(1, n);
    perform hdv_op(me, jsonb_build_object('k', -tax * n, b, jsonb_build_object(p_key, -p_lot * n)), 'Mis en vente : ' || n || ' × ' || p_key || ' ×' || p_lot);
  else return hdv_err('Catégorie inconnue.');
  end if;
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.hdv_buy(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; L hdv_listings; who text;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into L from hdv_listings where id = p_id for update;
  if L.id is null or L.status <> 'open' or L.expires_at < now() then return hdv_err('Trop tard : quelqu''un l''a déjà acheté ou l''annonce est terminée.'); end if;
  if L.seller = me then return hdv_err('C''est ta propre annonce.'); end if;
  if hdv_kamas(me, d) < L.price then return hdv_err('Pas assez de kamas.'); end if;
  update hdv_listings set status = 'sold', buyer = me, closed_at = now() where id = L.id;
  who := coalesce(pseudo_of(me), 'un joueur');
  perform hdv_op(me, hdv_back(L) || jsonb_build_object('k', -L.price), 'Acheté : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  perform hdv_op(L.seller, jsonb_build_object('k', L.price, 'sold', L.id), 'Vendu à ' || who || ' : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  insert into hdv_sales (key, cat, name, qty, price, seller, buyer) values (L.key, L.cat, L.name, L.qty, L.price, L.seller, me);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.hdv_cancel(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); L hdv_listings;
begin
  if me is null then return hdv_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  update hdv_listings set status = 'gone', closed_at = now() where id = p_id and seller = me and status = 'open' returning * into L;
  if L.id is null then return hdv_err('Annonce introuvable ou déjà vendue.'); end if;
  perform hdv_op(me, hdv_back(L), 'Retiré de la vente : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.hdv_reprice(p_after bigint, p_id bigint, p_price bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; L hdv_listings; tax bigint;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if p_price is null or p_price < 1 or p_price > 2000000000 then return hdv_err('Prix invalide.'); end if;
  select * into L from hdv_listings where id = p_id and seller = me and status = 'open' for update;
  if L.id is null then return hdv_err('Annonce introuvable ou déjà vendue.'); end if;
  tax := hdv_tax(p_price);
  if hdv_kamas(me, d) < tax then return hdv_err('Pas assez de kamas pour la taxe.'); end if;
  update hdv_listings set price = p_price where id = L.id;
  perform hdv_op(me, jsonb_build_object('k', -tax), 'Nouveau prix : ' || L.name);
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Recherche : une ligne par objet ou ressource, avec le prix le plus bas à l'unité.
create or replace function public.hdv_search(p_cat text, p_q text, p_slot text, p_lmin int, p_lmax int) returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(r order by r->>'name'), '[]'::jsonb) from (
    select jsonb_build_object('key', key, 'cat', min(cat), 'name', min(name), 'lvl', max(lvl), 'slot', min(slot), 'n', count(*), 'qty', sum(qty), 'unit', min(price::numeric / qty)) r
    from hdv_listings
    where status = 'open' and expires_at > now() and (p_cat is null or cat = p_cat)
      and (p_q is null or p_q = '' or name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
      and (p_slot is null or p_slot = '' or slot = p_slot) and lvl between coalesce(p_lmin, 0) and coalesce(p_lmax, 1000)
    group by key limit 80) x
$$;

create or replace function public.hdv_offers(p_key text) returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'qty', qty, 'price', price, 'item', item, 'mine', seller = auth.uid(), 'exp', expires_at) order by price::numeric / qty, id), '[]'::jsonb)
  from (select * from hdv_listings where key = p_key and status = 'open' and expires_at > now() order by price::numeric / qty, id limit 60) x
$$;

-- Prix moyen à l'unité, jour par jour sur 14 jours, et ventes de la semaine.
create or replace function public.hdv_stats(p_key text) returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'u', u) order by d) from (select date_trunc('day', at)::date d, round(sum(price)::numeric / sum(qty), 1) u from hdv_sales where key = p_key and at > now() - interval '14 days' group by 1) s), '[]'::jsonb),
    'week', (select coalesce(sum(qty), 0) from hdv_sales where key = p_key and at > now() - interval '7 days'),
    'avg', (select round(sum(price)::numeric / nullif(sum(qty), 0), 1) from hdv_sales where key = p_key and at > now() - interval '14 days'),
    'last', (select coalesce(jsonb_agg(jsonb_build_object('q', qty, 'p', price) order by at desc), '[]'::jsonb) from (select * from hdv_sales where key = p_key order by at desc limit 10) l))
$$;

create or replace function public.hdv_mine() returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'open', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'exp', expires_at) order by expires_at) from hdv_listings where seller = auth.uid() and status = 'open'), '[]'::jsonb),
    'sold', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'item', item, 'at', closed_at, 'buyer', pseudo_of(buyer)) order by closed_at desc) from (select * from hdv_listings where seller = auth.uid() and status = 'sold' and closed_at > now() - interval '7 days' order by closed_at desc limit 40) s), '[]'::jsonb))
$$;

-- ---------- échanges directs ----------
-- Offre : { k: kamas, items: [uid], res: {nom: n}, runes: {clé: n}, cons: {clé: n} }
create or replace function public.trade_check(p_user uuid, d jsonb, o jsonb) returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare out_items jsonb := '[]'::jsonb; u jsonb; b text; e record;
begin
  if coalesce((o->>'k')::numeric, 0) < 0 then raise exception 'Montant invalide.'; end if;
  if hdv_kamas(p_user, d) < coalesce((o->>'k')::numeric, 0) then raise exception 'Pas assez de kamas.'; end if;
  for u in select * from jsonb_array_elements(coalesce(o->'items', '[]'::jsonb)) loop
    out_items := out_items || jsonb_build_array(hdv_item(p_user, d, (u #>> '{}')::bigint));
  end loop;
  foreach b in array array['res', 'runes', 'cons'] loop
    for e in select * from jsonb_each_text(coalesce(o->b, '{}'::jsonb)) loop
      if e.value::numeric <= 0 then raise exception 'Quantité invalide.'; end if;
      if exists (select 1 from hdv_block where key = e.key) then raise exception '% ne s''échange pas.', e.key; end if;
      if hdv_qty(p_user, d, b, e.key) < e.value::numeric then raise exception 'Pas assez de % (ou la sauvegarde en ligne n''est pas encore à jour).', e.key; end if;
    end loop;
  end loop;
  return out_items;
end $$;

create or replace function public.trade_neg(o jsonb) returns jsonb language sql immutable
as $$ select jsonb_strip_nulls(jsonb_build_object('k', -coalesce((o->>'k')::numeric, 0), 'rm', o->'items',
  'res', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'res', '{}'::jsonb))),
  'runes', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'runes', '{}'::jsonb))),
  'cons', (select jsonb_object_agg(key, -value::numeric) from jsonb_each_text(coalesce(o->'cons', '{}'::jsonb))))) $$;

-- Additionne deux opérations (ce qu'on donne et ce qu'on reçoit) en une seule.
create or replace function public.trade_sum(x jsonb, y jsonb) returns jsonb language sql immutable
as $$ select jsonb_strip_nulls(jsonb_build_object(
  'k', coalesce((x->>'k')::numeric, 0) + coalesce((y->>'k')::numeric, 0),
  'rm', case when jsonb_array_length(coalesce(x->'rm', '[]')) + jsonb_array_length(coalesce(y->'rm', '[]')) > 0 then coalesce(x->'rm', '[]') || coalesce(y->'rm', '[]') end,
  'add', case when jsonb_array_length(coalesce(x->'add', '[]')) + jsonb_array_length(coalesce(y->'add', '[]')) > 0 then coalesce(x->'add', '[]') || coalesce(y->'add', '[]') end,
  'res', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'res', '{}')) union all select * from jsonb_each_text(coalesce(y->'res', '{}'))) a group by key) b),
  'runes', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'runes', '{}')) union all select * from jsonb_each_text(coalesce(y->'runes', '{}'))) a group by key) b),
  'cons', (select jsonb_object_agg(key, s) from (select key, sum(value::numeric) s from (select * from jsonb_each_text(coalesce(x->'cons', '{}')) union all select * from jsonb_each_text(coalesce(y->'cons', '{}'))) a group by key) b))) $$;

create or replace function public.trade_start(p_pseudo text) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); v_other uuid; id_ bigint;
begin
  begin perform hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  select id into v_other from profiles where lower(pseudo) = lower(p_pseudo);
  if v_other is null then return hdv_err('Joueur introuvable.'); end if;
  if v_other = me then return hdv_err('Tu ne peux pas échanger avec toi-même.'); end if;
  if exists (select 1 from ignores where ignores.user_id = v_other and ignores.other = me) then return hdv_err('Ce joueur ne reçoit pas tes demandes.'); end if;
  update trades set status = 'cancel', note = 'annulé', updated_at = now() where status = 'open' and (a = me or b = me);
  insert into trades (a, b) values (me, v_other) returning id into id_;
  return jsonb_build_object('ok', true, 'id', id_);
end $$;

-- L'échange en cours (ou celui qui vient de se terminer, pour afficher le résultat).
create or replace function public.trade_state() returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce((select jsonb_build_object('id', t.id, 'me', case when t.a = auth.uid() then 'a' else 'b' end, 'pa', pseudo_of(t.a), 'pb', pseudo_of(t.b),
      'oa', t.offer_a, 'ob', t.offer_b, 'ka', t.ok_a, 'kb', t.ok_b, 'ver', t.ver, 'st', t.status, 'note', t.note,
      'ia', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'it', (s.data::jsonb)->'items'->(u #>> '{}'))), '[]'::jsonb) from saves s, jsonb_array_elements(t.offer_a->'items') u where s.user_id = t.a),
      'ib', (select coalesce(jsonb_agg(jsonb_build_object('uid', u, 'it', (s.data::jsonb)->'items'->(u #>> '{}'))), '[]'::jsonb) from saves s, jsonb_array_elements(t.offer_b->'items') u where s.user_id = t.b))
    from trades t where (t.a = auth.uid() or t.b = auth.uid()) and (t.status = 'open' and t.updated_at > now() - interval '15 minutes' or t.updated_at > now() - interval '20 seconds')
    order by t.id desc limit 1), 'null'::jsonb)
$$;

create or replace function public.trade_offer(p_id bigint, p_offer jsonb) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); t trades; o jsonb;
begin
  select * into t from trades where id = p_id and status = 'open' and (a = me or b = me) for update;
  if t.id is null then return hdv_err('Échange terminé.'); end if;
  o := jsonb_strip_nulls(jsonb_build_object('k', greatest(0, coalesce((p_offer->>'k')::bigint, 0)), 'items', p_offer->'items', 'res', p_offer->'res', 'runes', p_offer->'runes', 'cons', p_offer->'cons'));
  if jsonb_array_length(coalesce(o->'items', '[]')) > 12 then return hdv_err('12 objets au maximum.'); end if;
  if t.a = me then update trades set offer_a = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id;
  else update trades set offer_b = o, ok_a = false, ok_b = false, ver = ver + 1, updated_at = now() where id = t.id; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.trade_ok(p_id bigint, p_ver int, p_after bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); t trades; da jsonb; db jsonb; ia jsonb; ib jsonb;
begin
  select * into t from trades where id = p_id and status = 'open' and (a = me or b = me) for update;
  if t.id is null then return hdv_err('Échange terminé.'); end if;
  if t.ver <> p_ver then return hdv_err('L''offre vient de changer : vérifie-la avant de valider.'); end if;
  if t.a = me then update trades set ok_a = true, updated_at = now() where id = t.id returning * into t;
  else update trades set ok_b = true, updated_at = now() where id = t.id returning * into t; end if;
  if not (t.ok_a and t.ok_b) then return jsonb_build_object('ok', true, 'wait', true); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || least(t.a::text, t.b::text)));
  perform pg_advisory_xact_lock(hashtext('hdv' || greatest(t.a::text, t.b::text)));
  if exists (select 1 from hdv_ops o where o.user_id in (t.a, t.b) and o.txt like 'Échange avec %' and o.at > now() - interval '1 minute') then
    update trades set ok_a = false, ok_b = false where id = t.id; return hdv_err('Un échange par minute au maximum : réessaie dans un instant.'); end if;
  begin
    da := hdv_save(t.a); db := hdv_save(t.b);
    ia := trade_check(t.a, da, t.offer_a); ib := trade_check(t.b, db, t.offer_b);
  exception when raise_exception then
    update trades set ok_a = false, ok_b = false where id = t.id;
    return hdv_err(sqlerrm);
  end;
  perform hdv_op(t.a, trade_sum(trade_neg(t.offer_a), jsonb_strip_nulls(jsonb_build_object('k', coalesce((t.offer_b->>'k')::numeric, 0), 'add', case when jsonb_array_length(ib) > 0 then ib end, 'res', t.offer_b->'res', 'runes', t.offer_b->'runes', 'cons', t.offer_b->'cons'))), 'Échange avec ' || pseudo_of(t.b));
  perform hdv_op(t.b, trade_sum(trade_neg(t.offer_b), jsonb_strip_nulls(jsonb_build_object('k', coalesce((t.offer_a->>'k')::numeric, 0), 'add', case when jsonb_array_length(ia) > 0 then ia end, 'res', t.offer_a->'res', 'runes', t.offer_a->'runes', 'cons', t.offer_a->'cons'))), 'Échange avec ' || pseudo_of(t.a));
  update trades set status = 'done', note = 'fait', updated_at = now() where id = t.id;
  return jsonb_build_object('ok', true, 'done', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.trade_cancel(p_id bigint) returns void language sql security definer set search_path = public
as $$ update trades set status = 'cancel', note = 'annulé par ' || pseudo_of(auth.uid()), updated_at = now() where id = p_id and status = 'open' and (a = auth.uid() or b = auth.uid()) $$;

-- ---------- offres d'achat (0.1.33) ----------
-- Un joueur annonce « j'achète N × ressource à P kamas l'unité ». Les kamas (avec la taxe de 2 %)
-- sont mis de côté tout de suite ; n'importe qui peut lui vendre tout ou une partie, il est payé
-- aussitôt et l'acheteur reçoit la marchandise par une opération, même hors ligne. À la fin
-- (retrait, durée écoulée ou offre complète), ce qui n'a pas servi lui revient, taxe comprise :
-- la taxe ne porte que sur ce qu'il a vraiment reçu.
create table if not exists public.hdv_orders (
  id bigint generated always as identity primary key,
  buyer uuid not null references auth.users (id) on delete cascade,
  cat text not null check (cat in ('res', 'rune', 'cons')),
  key text not null,
  name text not null,
  lvl int not null default 0,
  slot text,
  qty int not null,               -- quantité voulue
  filled int not null default 0,  -- quantité déjà reçue
  price bigint not null,          -- prix à l'unité
  held bigint not null,           -- kamas mis de côté à la création (taxe comprise)
  status text not null default 'open' check (status in ('open', 'done', 'gone')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz
);
create index if not exists hdv_orders_key on public.hdv_orders (key, price desc) where status = 'open';
create index if not exists hdv_orders_buyer on public.hdv_orders (buyer, status);
create index if not exists hdv_orders_exp on public.hdv_orders (expires_at) where status = 'open';
alter table public.hdv_orders enable row level security;

-- Taxe sur un montant réellement payé (rien si rien n'a été reçu).
create or replace function public.hdv_otax(p numeric) returns bigint language sql immutable as $$ select case when p <= 0 then 0 else ceil(p * 0.02) end::bigint $$;

-- Ferme une offre et rend à l'acheteur ce qui n'a pas servi.
create or replace function public.hdv_order_close(O hdv_orders, st text, why text) returns void language plpgsql security definer set search_path = public
as $$
declare back bigint;
begin
  update hdv_orders set status = st, closed_at = now() where id = O.id;
  back := O.held - O.filled * O.price - hdv_otax(O.filled * O.price);
  if back > 0 then perform hdv_op(O.buyer, jsonb_build_object('k', back), why || ' : ' || O.name || ' (' || O.filled || ' / ' || O.qty || ' reçus), kamas restants rendus'); end if;
end $$;

create or replace function public.hdv_order_expire() returns void language plpgsql security definer set search_path = public
as $$
declare O hdv_orders;
begin
  for O in select * from hdv_orders where status = 'open' and expires_at < now() limit 200 for update skip locked loop
    perform hdv_order_close(O, 'gone', 'Offre d''achat terminée');
  end loop;
end $$;

create or replace function public.hdv_order_new(p_after bigint, p_cat text, p_key text, p_qty int, p_price bigint, p_days int, p_name text, p_lvl int, p_slot text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; tot numeric; held bigint;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  perform hdv_order_expire();
  if p_cat not in ('res', 'rune', 'cons') then return hdv_err('Les offres d''achat portent sur les ressources, clefs, runes et consommables.'); end if;
  if p_key is null or p_key = '' or exists (select 1 from hdv_block where key = p_key) then return hdv_err('Cette ressource ne s''échange pas.'); end if;
  if p_qty is null or p_qty < 1 or p_qty > 100000 then return hdv_err('Quantité invalide (1 à 100 000).'); end if;
  if p_price is null or p_price < 1 then return hdv_err('Prix invalide.'); end if;
  if p_days not in (3, 7, 14) then return hdv_err('Durée de 3, 7 ou 14 jours.'); end if;
  tot := p_qty::numeric * p_price;
  if tot > 2000000000 then return hdv_err('Offre trop grosse (2 milliards de kamas au maximum).'); end if;
  if (select count(*) from hdv_orders where buyer = me and status = 'open') >= 10 then return hdv_err('10 offres d''achat à la fois au maximum.'); end if;
  if exists (select 1 from hdv_orders where buyer = me and status = 'open' and key = p_key) then return hdv_err('Tu as déjà une offre pour cette ressource : retire-la d''abord.'); end if;
  held := tot + hdv_otax(tot);
  if hdv_kamas(me, d) < held then return hdv_err('Pas assez de kamas : il faut mettre de côté ' || held || ' kamas.'); end if;
  insert into hdv_orders (buyer, cat, key, name, lvl, slot, qty, price, held, expires_at)
    values (me, p_cat, p_key, left(coalesce(p_name, p_key), 80), coalesce(p_lvl, 0), left(p_slot, 20), p_qty, p_price, held, now() + make_interval(days => p_days));
  perform hdv_op(me, jsonb_build_object('k', -held), 'Offre d''achat : ' || p_qty || ' × ' || coalesce(p_name, p_key) || ' à ' || p_price || ' l''unité (kamas mis de côté)');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

create or replace function public.hdv_order_cancel(p_after bigint, p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); O hdv_orders;
begin
  if me is null then return hdv_err('non connecté'); end if;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into O from hdv_orders where id = p_id and buyer = me and status = 'open' for update;
  if O.id is null then return hdv_err('Offre introuvable ou déjà terminée.'); end if;
  perform hdv_order_close(O, 'gone', 'Offre d''achat retirée');
  return jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Vendre à une offre : tout ou une partie.
create or replace function public.hdv_order_fill(p_after bigint, p_id bigint, p_qty int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; O hdv_orders; b text; n int; pay bigint; who text;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(sqlerrm); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  select * into O from hdv_orders where id = p_id for update;
  if O.id is null or O.status <> 'open' or O.expires_at < now() then return hdv_err('Trop tard : cette offre est terminée.'); end if;
  if O.buyer = me then return hdv_err('C''est ta propre offre.'); end if;
  n := least(coalesce(p_qty, 0), O.qty - O.filled);
  if n < 1 then return hdv_err('Quantité invalide.'); end if;
  b := hdv_bucket(O.cat);
  if hdv_qty(me, d, b, O.key) < n then return hdv_err('Tu n''en as pas assez (ou la sauvegarde en ligne n''est pas encore à jour).'); end if;
  pay := n * O.price;
  who := coalesce(pseudo_of(me), 'un joueur');
  update hdv_orders set filled = filled + n where id = O.id returning * into O;
  perform hdv_op(me, jsonb_build_object('k', pay, b, jsonb_build_object(O.key, -n)), 'Vendu à une offre d''achat : ' || n || ' × ' || O.name);
  perform hdv_op(O.buyer, jsonb_build_object(b, jsonb_build_object(O.key, n), 'got', O.id), 'Offre d''achat : ' || who || ' t''a vendu ' || n || ' × ' || O.name || ' (' || O.filled || ' / ' || O.qty || ')');
  insert into hdv_sales (key, cat, name, qty, price, seller, buyer) values (O.key, O.cat, O.name, n, pay, me, O.buyer);
  if O.filled >= O.qty then perform hdv_order_close(O, 'done', 'Offre d''achat complète'); end if;
  return jsonb_build_object('ok', true, 'n', n, 'k', pay, 'ops', hdv_ops_after(me, p_after));
end $$;

-- Offres ouvertes : pour une ressource (p_key), ou toutes avec une recherche (p_q). Meilleur prix d'abord.
-- On ne montre jamais l'acheteur, seulement le prix, ce qui reste à acheter et le temps restant.
create or replace function public.hdv_orders_list(p_key text, p_q text, p_cat text) returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'lvl', lvl, 'left', qty - filled, 'qty', qty, 'price', price, 'exp', expires_at, 'mine', buyer = auth.uid()) order by price desc, id), '[]'::jsonb)
  from (select * from hdv_orders where status = 'open' and expires_at > now()
    and (p_key is null or p_key = '' or key = p_key) and (p_cat is null or p_cat = '' or cat = p_cat)
    and (p_q is null or p_q = '' or name ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
    order by price desc, id limit 120) x
$$;

create or replace function public.hdv_orders_mine() returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'key', key, 'name', name, 'qty', qty, 'filled', filled, 'price', price, 'held', held, 'st', status, 'exp', expires_at, 'at', closed_at) order by status <> 'open', coalesce(closed_at, created_at) desc), '[]'::jsonb)
  from (select * from hdv_orders where buyer = auth.uid() and (status = 'open' or closed_at > now() - interval '7 days') order by id desc limit 40) x
$$;

-- ---------- panel admin ----------
create or replace function public.adm_hdv() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(false);
  return jsonb_build_object(
    'open', (select count(*) from hdv_listings where status = 'open'),
    'sellers', (select count(distinct seller) from hdv_listings where status = 'open'),
    'sales7', (select count(*) from hdv_sales where at > now() - interval '7 days'),
    'vol7', (select coalesce(sum(price), 0) from hdv_sales where at > now() - interval '7 days'),
    'trades7', (select count(*) from trades where status = 'done' and updated_at > now() - interval '7 days'),
    'orders', (select count(*) from hdv_orders where status = 'open'),
    'last', coalesce((select jsonb_agg(jsonb_build_object('at', at, 'name', name, 'qty', qty, 'price', price, 's', pseudo_of(seller), 'b', pseudo_of(buyer)) order by at desc) from (select * from hdv_sales order by at desc limit 30) x), '[]'::jsonb),
    'top', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'qty', qty, 'price', price, 's', pseudo_of(seller)) order by price desc) from (select * from hdv_listings where status = 'open' order by price desc limit 15) x), '[]'::jsonb));
end $$;

create or replace function public.adm_hdv_remove(p_id bigint) returns void language plpgsql security definer set search_path = public
as $$
declare L hdv_listings;
begin
  perform public.adm_need(false);
  update hdv_listings set status = 'gone', closed_at = now() where id = p_id and status = 'open' returning * into L;
  if L.id is null then return; end if;
  perform hdv_op(L.seller, hdv_back(L), 'Annonce retirée par la modération : ' || L.name);
  perform alog('HdV : annonce retirée (' || L.name || ', ' || coalesce(pseudo_of(L.seller), '?') || ')');
end $$;

-- ---------- 1.0.16 : Hôtel de vente façon DOFUS 3 (lecture seule, rien n'est envoyé en continu) ----------
create index if not exists hdv_sales_buyer on public.hdv_sales (buyer, at);
create or replace function public.hdv_fold(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'àâäáãéèêëíìîïóòôöõúùûüçñœæ', 'aaaaaeeeeiiiiooooouuuucnoa')
$$;
-- Liste du tableau : prix des lots ×1 / ×10 / ×100, prix le plus bas à l'unité et prix moyen des 14 derniers jours.
-- p_keys : les favoris du joueur (sinon null). La recherche ignore les accents.
create or replace function public.hdv_market(p_cat text, p_q text, p_slot text, p_keys text[]) returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select jsonb_build_object('key', l.key, 'cat', min(l.cat), 'name', min(l.name), 'lvl', max(l.lvl), 'slot', min(l.slot), 'n', count(*), 'qty', sum(l.qty),
      'unit', round(min(l.price::numeric / l.qty), 2),
      'p1', min(l.price) filter (where l.qty = 1), 'p10', min(l.price) filter (where l.qty = 10), 'p100', min(l.price) filter (where l.qty = 100),
      'avg', (select round(sum(s.price)::numeric / nullif(sum(s.qty), 0), 1) from hdv_sales s where s.key = l.key and s.at > now() - interval '14 days')) r
    from hdv_listings l
    where l.status = 'open' and l.expires_at > now()
      and (p_keys is null or l.key = any(p_keys))
      and (p_cat is null or p_cat = '' or l.cat = p_cat)
      and (p_slot is null or p_slot = '' or l.slot = p_slot)
      and (p_q is null or p_q = '' or hdv_fold(l.name) like '%' || hdv_fold(replace(replace(p_q, '%', ''), '_', '')) || '%')
    group by l.key limit 400) x
$$;
-- Courbe des prix : prix moyen à l'unité et quantité vendue, jour par jour (30 jours au plus), et prix moyen des 14 derniers jours.
create or replace function public.hdv_history(p_key text, p_days int) returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'u', u, 'q', q) order by d) from (select date_trunc('day', at)::date d, round(sum(price)::numeric / sum(qty), 1) u, sum(qty) q
      from hdv_sales where key = p_key and at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 30)) group by 1) s), '[]'::jsonb),
    'avg', (select round(sum(price)::numeric / nullif(sum(qty), 0), 1) from hdv_sales where key = p_key and at > now() - interval '14 days'),
    'week', (select coalesce(sum(qty), 0) from hdv_sales where key = p_key and at > now() - interval '7 days'))
$$;
-- Mes achats des 7 derniers jours (annonces achetées et offres d'achat remplies).
create or replace function public.hdv_bought() returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('cat', cat, 'key', key, 'name', name, 'qty', qty, 'price', price, 'at', at, 'seller', pseudo_of(seller)) order by at desc), '[]'::jsonb)
  from (select * from hdv_sales where buyer = auth.uid() and at > now() - interval '7 days' order by at desc limit 40) b
$$;

-- ---------- droits ----------
do $$
declare f text;
begin
  foreach f in array array['hdv_err(text)', 'hdv_save(uuid)', 'hdv_cursor(jsonb)', 'hdv_kamas(uuid, jsonb)', 'hdv_qty(uuid, jsonb, text, text)', 'hdv_bucket(text)', 'hdv_item(uuid, jsonb, bigint)',
    'hdv_op(uuid, jsonb, text)', 'hdv_ops_after(uuid, bigint)', 'hdv_back(hdv_listings)', 'hdv_expire()', 'hdv_tax(bigint)', 'trade_check(uuid, jsonb, jsonb)', 'trade_neg(jsonb)', 'trade_sum(jsonb, jsonb)',
    'hdv_otax(numeric)', 'hdv_order_close(hdv_orders, text, text)', 'hdv_order_expire()', 'hdv_fold(text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['hdv_sync(bigint)', 'hdv_list(bigint, text, text, bigint, int, int, bigint, text, int, text)', 'hdv_buy(bigint, bigint)', 'hdv_cancel(bigint, bigint)', 'hdv_reprice(bigint, bigint, bigint)',
    'hdv_mine()', 'trade_start(text)', 'trade_state()', 'trade_offer(bigint, jsonb)', 'trade_ok(bigint, int, bigint)', 'trade_cancel(bigint)', 'adm_hdv()', 'adm_hdv_remove(bigint)',
    'hdv_order_new(bigint, text, text, int, bigint, int, text, int, text)', 'hdv_order_cancel(bigint, bigint)', 'hdv_order_fill(bigint, bigint, int)', 'hdv_orders_mine()', 'hdv_bought()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['hdv_search(text, text, text, int, int)', 'hdv_offers(text)', 'hdv_stats(text)', 'hdv_orders_list(text, text, text)', 'hdv_market(text, text, text, text[])', 'hdv_history(text, int)'] loop
    execute 'grant execute on function public.' || f || ' to anon, authenticated';
  end loop;
end $$;
