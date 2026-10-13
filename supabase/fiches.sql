-- ============================================================================
-- Idlus — fiches détaillées des joueurs (0.1.52.1), panel admin › « Fiches joueurs ».
-- Réservé à Mathis (adm_need(true)) : ni les modérateurs ni les joueurs ne peuvent les lire.
-- Ne crée aucune table et ne modifie aucune donnée : deux fonctions de lecture seulement.
-- Le texte peut être relancé sans danger.
-- ============================================================================

-- Tous les comptes, avec de quoi trier (dernier envoi, niveau, création, temps de jeu).
create or replace function public.adm_roster(p_q text, p_sort text) returns jsonb language plpgsql stable security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select p.id, p.pseudo, p.created_at, p.suspended_at, l.main cls, coalesce(l.level, 0) level, coalesce(l.main_lvl, 1) main_lvl, coalesce(l.playtime, 0) playtime,
      coalesce(l.flagged, false) flagged, s.updated_at last_save, s.game_version, s.device, u.last_sign_in_at last_login,
      g.name guild, k.cote, cs.mute_until, coalesce(cs.banned, false) banned,
      exists (select 1 from mods m where m.user_id = p.id) is_mod, exists (select 1 from admins a where a.user_id = p.id) is_admin
    from profiles p left join auth.users u on u.id = p.id left join ladder l on l.user_id = p.id left join saves s on s.user_id = p.id
      left join guild_members gm on gm.user_id = p.id left join guilds g on g.id = gm.guild_id left join koli k on k.user_id = p.id
      left join chat_sanctions cs on cs.user_id = p.id
    where p_q is null or p_q = '' or p.pseudo ilike '%' || replace(replace(p_q, '%', ''), '_', '\_') || '%'
    order by
      case when p_sort = 'niveau' then coalesce(l.level, 0) end desc nulls last,
      case when p_sort = 'temps' then coalesce(l.playtime, 0) end desc nulls last,
      case when p_sort = 'creation' then p.created_at end desc nulls last,
      s.updated_at desc nulls last, p.created_at desc
    limit 500) x);
end $$;

-- La fiche d'un joueur : compte, partie en ligne (texte complet, lu par le jeu pour la détailler),
-- guilde, Kolizéum, Hôtel de vente, échanges, boss, codes cadeaux, idées, chat et modération.
-- Pas d'adresse e-mail ni de messages privés.
create or replace function public.adm_player(p_user uuid) returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare ps text := public.pseudo_of(p_user); begin
  perform public.adm_need(true);
  if ps is null then return null; end if;
  return jsonb_build_object(
    'id', p_user, 'pseudo', ps,
    'acc', (select jsonb_build_object('created_at', p.created_at, 'suspended_at', p.suspended_at, 'last_login', u.last_sign_in_at,
        'providers', coalesce(u.raw_app_meta_data -> 'providers', jsonb_build_array(u.raw_app_meta_data ->> 'provider')),
        'discord', coalesce(u.raw_user_meta_data -> 'custom_claims' ->> 'global_name', u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
        'is_mod', exists (select 1 from mods m where m.user_id = p_user), 'is_admin', exists (select 1 from admins a where a.user_id = p_user))
      from profiles p left join auth.users u on u.id = p.id where p.id = p_user),
    'save', (select jsonb_build_object('data', s.data, 'meta', s.meta, 'version', s.game_version, 'device', s.device, 'at', s.updated_at, 'size', length(s.data)) from saves s where s.user_id = p_user),
    'ladder', (select to_jsonb(l) - 'user_id' - 'heroes' from ladder l where l.user_id = p_user),
    'guild', (select jsonb_build_object('name', g.name, 'lvl', g.lvl, 'rank', gm.rank, 'given', gm.given, 'week', gm.week, 'joined_at', gm.joined_at, 'last_give', gm.last_give,
        'members', (select count(*) from guild_members x where x.guild_id = g.id))
      from guild_members gm join guilds g on g.id = gm.guild_id where gm.user_id = p_user),
    'koli', (select jsonb_build_object('cote', k.cote, 'best', k.best, 'n', k.n, 'win', k.win, 'loss', k.loss, 'dwin', k.dwin, 'dloss', k.dloss, 'lvl', k.lvl, 'w', k.w, 'at', k.at,
        'fights', (select count(*) from koli_fights f where f.att = p_user or f.def = p_user),
        'weeks', (select coalesce(jsonb_agg(jsonb_build_object('w', x.w, 'cote', x.cote, 'rank', x.rank) order by x.w desc), '[]'::jsonb) from (select * from koli_weeks kw where kw.user_id = p_user order by kw.w desc limit 4) x))
      from koli k where k.user_id = p_user),
    'hdv', jsonb_build_object(
      'open', (select count(*) from hdv_listings where seller = p_user and status = 'open'),
      'open_k', (select coalesce(sum(price), 0) from hdv_listings where seller = p_user and status = 'open'),
      'sold', (select count(*) from hdv_sales where seller = p_user), 'sold_k', (select coalesce(sum(price), 0) from hdv_sales where seller = p_user),
      'bought', (select count(*) from hdv_sales where buyer = p_user), 'bought_k', (select coalesce(sum(price), 0) from hdv_sales where buyer = p_user),
      'orders', (select count(*) from hdv_orders where buyer = p_user and status = 'open'),
      'trades', (select count(*) from trades where (a = p_user or b = p_user) and status = 'done'),
      'last', (select coalesce(jsonb_agg(x order by x.at desc), '[]'::jsonb) from (select name, qty, price, at, (seller = p_user) sold from hdv_sales where seller = p_user or buyer = p_user order by at desc limit 8) x)),
    'boss', jsonb_build_object(
      'wb_n', (select count(*) from wb_hits where user_id = p_user), 'wb_pts', (select coalesce(sum(points), 0) from wb_hits where user_id = p_user),
      'wb_last', (select max(at) from wb_hits where user_id = p_user),
      'gb_n', (select count(*) from gboss_hits where user_id = p_user), 'gb_pts', (select coalesce(sum(points), 0) from gboss_hits where user_id = p_user)),
    'gifts', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'at', at) order by at desc), '[]'::jsonb) from gift_uses where user_id = p_user),
    'ideas', (select coalesce(jsonb_agg(jsonb_build_object('title', title, 'tag', tag, 'at', created_at) order by created_at desc), '[]'::jsonb) from ideas where user_id = p_user),
    'chat', jsonb_build_object(
      'pub', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v')),
      'pub7', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch in ('g', 'c', 'v') and created_at > now() - interval '7 days'),
      'priv', (select count(*) from chat_msgs where user_id = p_user and kind = 'msg' and ch = 'p'),
      'last', (select max(created_at) from chat_msgs where user_id = p_user and kind = 'msg')),
    'mod', jsonb_build_object(
      'reports', (select count(distinct reporter) from reports where target = p_user), 'reports_open', (select count(*) from reports where target = p_user and open),
      'reported', (select count(*) from reports where reporter = p_user),
      'mute_until', (select mute_until from chat_sanctions where user_id = p_user), 'banned', (select coalesce(banned, false) from chat_sanctions where user_id = p_user),
      'log', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'txt', txt) order by at desc), '[]'::jsonb) from (select at, txt from admin_log where txt ilike '%' || ps || '%' order by at desc limit 10) x))
  );
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_roster(text, text)', 'adm_player(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
