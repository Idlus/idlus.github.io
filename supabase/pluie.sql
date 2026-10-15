-- ============================================================================
-- Idlus — Pluie de kamas (panel Xener › Annonces › « Pluie de kamas »). Choix de Mathis 15/10 : 1C 2A 3A 5A 6A.
-- Mathis met des kamas de SON compte dans une pluie de quelques minutes. Les joueurs connectés à un compte cliquent
-- « Je participe » ; à la fin, la pluie est partagée à parts égales entre eux. Rien n'est créé : les kamas sortent
-- de la partie de Xener (opération hdv_ops négative, vérifiée comme à l'hôtel de vente) et arrivent chez les
-- participants par la même voie que le paiement d'une vente. Le reste de la division (et toute la pluie si
-- personne ne participe ou si Mathis l'annule) revient à Xener.
-- Pas de tâche planifiée : la pluie finie est partagée par le premier appel de rain_state() qui suit sa fin
-- (verrou « skip locked », comme ann_tick). Appliqué par le workflow « Serveur en ligne » ; relançable sans danger.
-- ============================================================================

create table if not exists public.kamas_rains (
  id bigint generated always as identity primary key,
  by_user uuid not null references auth.users (id) on delete cascade,
  total bigint not null check (total > 0),
  msg text not null default '',
  ends timestamptz not null,
  status text not null default 'open' check (status in ('open', 'done', 'cancel')),
  n int not null default 0,          -- participants au moment du partage
  share bigint not null default 0,   -- part de chacun
  ann_id bigint,                     -- bandeau ouvert avec la pluie (effacé à la fin)
  at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists kamas_rains_open on public.kamas_rains (ends) where status = 'open';
alter table public.kamas_rains enable row level security; -- aucune lecture directe : seulement par les fonctions ci-dessous

create table if not exists public.kamas_rain_joins (
  rain_id bigint not null references public.kamas_rains (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  primary key (rain_id, user_id)
);
alter table public.kamas_rain_joins enable row level security;

create or replace function public.rain_fmt(n bigint) returns text language sql immutable
as $$ select replace(to_char(n, 'FM999G999G999G999'), ',', ' ') $$;

-- Partage les pluies finies (appelé par rain_state, donc par le jeu des joueurs connectés).
create or replace function public.rain_close() returns void language plpgsql security definer set search_path = public
as $$
declare r kamas_rains; cnt int; sh bigint; rest bigint; j record;
begin
  for r in select * from kamas_rains where status = 'open' and ends <= now() order by id for update skip locked loop
    select count(*) into cnt from kamas_rain_joins where rain_id = r.id;
    sh := case when cnt > 0 then r.total / cnt else 0 end;
    rest := r.total - sh * cnt;
    for j in select user_id from kamas_rain_joins where rain_id = r.id loop
      perform hdv_op(j.user_id, jsonb_build_object('k', sh, 'rain', r.id), 'Pluie de kamas : +' || rain_fmt(sh) || ' kamas offerts par ' || coalesce(pseudo_of(r.by_user), 'Xener'));
    end loop;
    if rest > 0 then
      perform hdv_op(r.by_user, jsonb_build_object('k', rest, 'rain', r.id), case when cnt = 0 then 'Pluie de kamas sans participant : ' || rain_fmt(rest) || ' kamas revenus' else 'Pluie de kamas : ' || rain_fmt(rest) || ' kamas non partagés revenus' end);
    end if;
    update kamas_rains set status = 'done', n = cnt, share = sh, closed_at = now() where id = r.id;
    if r.ann_id is not null then update announces set until = now() where id = r.ann_id and (until is null or until > now()); end if;
    if cnt > 0 then
      insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', r.by_user, pseudo_of(r.by_user), 'ann',
        'La pluie de kamas est finie : ' || cnt || case when cnt > 1 then ' joueurs reçoivent ' else ' joueur reçoit ' end || rain_fmt(sh) || ' kamas' || case when cnt > 1 then ' chacun.' else '.' end,
        jsonb_build_object('t', 'admin', 'banner', false, 'rain', r.id));
    end if;
  end loop;
end $$;
revoke all on function public.rain_close() from public, anon, authenticated;

-- État pour le jeu : la pluie en cours, ou la dernière finie depuis moins de 15 minutes. Lisible par tous (invités compris).
create or replace function public.rain_state() returns jsonb language plpgsql security definer set search_path = public
as $$
declare r kamas_rains; me uuid := auth.uid(); cnt int;
begin
  if exists (select 1 from kamas_rains where status = 'open' and ends <= now()) then perform rain_close(); end if;
  select * into r from kamas_rains where status = 'open' or (status = 'done' and closed_at > now() - interval '15 minutes') order by (status = 'open') desc, id desc limit 1;
  if r.id is null then return null; end if;
  select count(*) into cnt from kamas_rain_joins where rain_id = r.id;
  return jsonb_build_object('id', r.id, 'st', r.status, 'total', r.total, 'msg', r.msg, 'by', pseudo_of(r.by_user), 'ends', r.ends, 'now', now(),
    'n', case when r.status = 'done' then r.n else cnt end, 'share', r.share,
    'in', me is not null and exists (select 1 from kamas_rain_joins where rain_id = r.id and user_id = me),
    'mine', me is not null and me = r.by_user);
end $$;
revoke all on function public.rain_state() from public;
grant execute on function public.rain_state() to anon, authenticated;

-- « Je participe » : un compte (2A), partie en ligne, pas en vérification. Une fois par pluie.
create or replace function public.rain_join(p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); r kamas_rains;
begin
  if me is null then return hdv_err('Connecte-toi à un compte (gratuit) pour participer à la pluie de kamas.'); end if;
  begin perform hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  select * into r from kamas_rains where id = p_id;
  if r.id is null or r.status <> 'open' or r.ends <= now() then return hdv_err('Cette pluie de kamas est déjà finie.'); end if;
  if r.by_user = me then return hdv_err('Ce sont tes kamas : tu ne peux pas participer à ta propre pluie.'); end if;
  insert into kamas_rain_joins (rain_id, user_id) values (r.id, me) on conflict do nothing;
  return rain_state();
end $$;
revoke all on function public.rain_join(bigint) from public;
grant execute on function public.rain_join(bigint) to authenticated;

-- Panel : lancer une pluie avec ses propres kamas (5A : seulement Xener). Une seule pluie à la fois.
-- p_min : durée en minutes (1 à 60). p_announce (6A) : bandeau pendant la pluie + message dans le chat Général.
create or replace function public.adm_rain_open(p_total bigint, p_min int, p_msg text, p_announce boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; have numeric; m text := left(btrim(coalesce(p_msg, '')), 140); id_ bigint; aid bigint; manual boolean; body text;
begin
  perform adm_need(true);
  if exists (select 1 from kamas_rains where status = 'open' and ends <= now()) then perform rain_close(); end if;
  if exists (select 1 from kamas_rains where status = 'open') then return hdv_err('Une pluie de kamas est déjà en cours.'); end if;
  if p_total is null or p_total < 1000 then return hdv_err('Au moins 1 000 kamas.'); end if;
  if p_min is null or p_min < 1 or p_min > 60 then return hdv_err('Durée : de 1 à 60 minutes.'); end if;
  begin d := hdv_save(me); exception when others then return hdv_err(sqlerrm); end;
  have := hdv_kamas(me, d);
  if have < p_total then return hdv_err('Pas assez de kamas sur ton compte en ligne : ' || rain_fmt(floor(have)::bigint) || ' (la partie part en ligne toutes les 30 s).'); end if;
  insert into kamas_rains (by_user, total, msg, ends) values (me, p_total, m, now() + make_interval(mins => p_min)) returning id into id_;
  perform hdv_op(me, jsonb_build_object('k', -p_total, 'rain', id_), 'Pluie de kamas lancée : ' || rain_fmt(p_total) || ' kamas mis en jeu');
  if p_announce then
    body := 'Pluie de kamas : ' || rain_fmt(p_total) || ' kamas à partager pendant ' || p_min || ' min ! Accueil › « Je participe ».' || case when m <> '' then ' ' || m else '' end;
    body := left(body, 300);
    manual := exists (select 1 from announces where banner and (until is null or until > now())); -- un seul bandeau à la fois
    if not manual then
      insert into announces (body, banner, until) values (body, true, now() + make_interval(mins => p_min)) returning id into aid;
      update kamas_rains set ann_id = aid where id = id_;
    end if;
    insert into chat_msgs (ch, user_id, pseudo, kind, body, data) values ('g', me, pseudo_of(me), 'ann', body, jsonb_build_object('t', 'admin', 'banner', not manual, 'rain', id_));
  end if;
  perform alog(format('pluie de kamas lancée : %s kamas, %s min', p_total, p_min));
  return jsonb_build_object('ok', true, 'id', id_, 'ops', hdv_ops_after(me, hdv_cursor(d)));
end $$;
revoke all on function public.adm_rain_open(bigint, int, text, boolean) from public;
grant execute on function public.adm_rain_open(bigint, int, text, boolean) to authenticated;

-- Panel : arrêter la pluie tout de suite. p_share = true : partage maintenant entre les participants ; false : tout revient à Xener.
create or replace function public.adm_rain_stop(p_id bigint, p_share boolean) returns jsonb language plpgsql security definer set search_path = public
as $$
declare r kamas_rains;
begin
  perform adm_need(true);
  select * into r from kamas_rains where id = p_id and status = 'open' for update;
  if r.id is null then return hdv_err('Pas de pluie en cours.'); end if;
  if p_share then
    update kamas_rains set ends = now() where id = r.id;
    perform rain_close();
  else
    perform hdv_op(r.by_user, jsonb_build_object('k', r.total, 'rain', r.id), 'Pluie de kamas annulée : ' || rain_fmt(r.total) || ' kamas revenus');
    update kamas_rains set status = 'cancel', closed_at = now() where id = r.id;
    if r.ann_id is not null then update announces set until = now() where id = r.ann_id; end if;
    perform alog('pluie de kamas annulée');
    return jsonb_build_object('ok', true);
  end if;
  perform alog('pluie de kamas arrêtée et partagée');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.adm_rain_stop(bigint, boolean) from public;
grant execute on function public.adm_rain_stop(bigint, boolean) to authenticated;

-- Panel : les dernières pluies.
create or replace function public.adm_rains() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform adm_need(true);
  return (select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) from (select id, total, msg, ends, status, n, share, at,
    (select count(*) from kamas_rain_joins j where j.rain_id = k.id) joined from kamas_rains k order by id desc limit 10) x);
end $$;
revoke all on function public.adm_rains() from public;
grant execute on function public.adm_rains() to authenticated;
