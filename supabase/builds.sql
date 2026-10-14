-- ============================================================================
-- Idlus — builds partagés (1.0.23). Appliqué automatiquement par le workflow « Serveur en ligne »
-- après chat.sql (il s'appuie sur adm_need, alog, profiles, chat_sanctions) ; relançable sans danger.
-- Page Communauté › Builds : un joueur connecté avec Discord publie le build d'un de ses héros (10 au plus)
-- depuis la fenêtre « Partager le build » ; tout le monde, même sans compte, regarde, filtre et copie.
-- ❤ J'aime (un par compte, pas sur ses propres builds), vues (une par joueur et par build),
-- « Signaler » (caché dès 3 signalements, jusqu'à la décision de l'équipe dans le panel admin).
-- Le build lui-même est le code « IDLUS1-… » du jeu (js/engine.js, E.buildCode) : classe, niveau et objets
-- sont relus dans le code par le serveur, rien n'est cru sur parole. Personne ne lit les tables directement.
-- ============================================================================

create table if not exists public.builds (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  pseudo text not null,
  hid int,
  cls text not null,
  lvl int not null check (lvl between 1 and 200),
  el text not null check (el in ('fo', 'ine', 'cha', 'age', 'multi')),
  bud text not null check (bud in ('abo', 'moy', 'pre')),
  tags text[] not null default '{}',
  title text not null check (length(title) between 4 and 60),
  note text not null default '' check (length(note) <= 300),
  code text not null check (length(code) <= 4000),
  items text[] not null default '{}',
  sex text not null default 'm' check (sex in ('m', 'f')),
  head int not null default 0,
  likes int not null default 0,
  views int not null default 0,
  reports int not null default 0,
  hidden boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists builds_user on public.builds (user_id);
create index if not exists builds_cls_lvl on public.builds (cls, lvl) where not hidden and not removed;
alter table public.builds enable row level security; -- aucune règle : tout passe par les fonctions ci-dessous

create table if not exists public.build_likes (
  build_id bigint not null references public.builds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
create index if not exists build_likes_at on public.build_likes (created_at);
alter table public.build_likes enable row level security;

create table if not exists public.build_views (
  build_id bigint not null references public.builds (id) on delete cascade,
  who text not null,
  primary key (build_id, who)
);
alter table public.build_views enable row level security;

create table if not exists public.build_reports (
  build_id bigint not null references public.builds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (build_id, user_id)
);
alter table public.build_reports enable row level security;

-- ---------- un build tel que la page le montre ----------
create or replace function public.build_row(b public.builds, wk bigint) returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object('id', b.id, 'by', coalesce((select pseudo from profiles where id = b.user_id), b.pseudo), 'cls', b.cls, 'lvl', b.lvl,
    'el', b.el, 'bud', b.bud, 'tags', to_jsonb(b.tags), 'title', b.title, 'note', b.note, 'code', b.code, 'sex', b.sex, 'head', b.head,
    'likes', b.likes, 'wk', coalesce(wk, 0), 'views', b.views, 'at', b.updated_at, 'new', b.created_at,
    'liked', exists (select 1 from build_likes l where l.build_id = b.id and l.user_id = auth.uid()),
    'mine', coalesce(b.user_id = auth.uid(), false), 'hidden', case when b.user_id = auth.uid() then b.hidden else false end)
$$;
revoke all on function public.build_row(public.builds, bigint) from public, anon, authenticated;

-- ---------- la liste (tout le monde, avec ou sans compte) ----------
-- p_br : tranche de niveau ('1-50', '51-100', '101-150', '151-199', '200') ; p_sort : 'week' (plus aimés cette semaine),
-- 'new', 'top' (de tous les temps), 'views', 'fav' (les numéros de p_ids, favoris gardés dans la partie), 'mine'.
-- p_q cherche dans le titre ; p_items (objets dont le nom correspond, trouvés par le jeu) dans l'équipement.
-- Renvoie 24 builds à partir de p_off, le nombre total et, sur la première page, le build de la semaine.
create or replace function public.builds_list(p_cls text default null, p_br text default null, p_el text default null, p_bud text default null,
  p_q text default null, p_items text[] default null, p_sort text default 'week', p_off int default 0, p_ids bigint[] default null)
returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare
  lo int := 1; hi int := 200; q text := nullif(btrim(replace(replace(coalesce(p_q, ''), '%', ''), '_', '')), '');
  s text := coalesce(p_sort, 'week'); off int := greatest(0, least(coalesce(p_off, 0), 2000)); res jsonb; wb jsonb;
begin
  if p_br ~ '^\d+-\d+$' then lo := split_part(p_br, '-', 1)::int; hi := split_part(p_br, '-', 2)::int;
  elsif p_br ~ '^\d+$' then lo := p_br::int; hi := p_br::int; end if;
  with f as (
    select b, (select count(*) from build_likes l where l.build_id = b.id and l.created_at > now() - interval '7 days') wk
    from builds b
    where not b.removed
      and (case when s = 'mine' then b.user_id = auth.uid() else not b.hidden end)
      and (s <> 'fav' or b.id = any(coalesce(p_ids, '{}')))
      and (coalesce(p_cls, '') = '' or b.cls = p_cls)
      and b.lvl between lo and hi
      and (coalesce(p_el, '') = '' or b.el = p_el)
      and (coalesce(p_bud, '') = '' or b.bud = p_bud)
      and (q is null or b.title ilike '%' || q || '%' or (p_items is not null and b.items && p_items))
  )
  select jsonb_build_object('n', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(build_row(x.b, x.wk) order by x.o) from (
      select f.b, f.wk, row_number() over (order by
        case when s = 'week' then f.wk end desc nulls last,
        case when s in ('week', 'top') then (f.b).likes end desc nulls last,
        case when s = 'views' then (f.b).views end desc nulls last,
        (f.b).updated_at desc) o
      from f order by o limit 24 offset off) x), '[]'::jsonb)) into res;
  if off = 0 and s <> 'mine' and s <> 'fav' then
    select build_row(b, w.wk) into wb from builds b join (
      select build_id, count(*) wk from build_likes where created_at > now() - interval '7 days' group by build_id) w on w.build_id = b.id
    where not b.hidden and not b.removed and w.wk >= 3 order by w.wk desc, b.likes desc, b.id limit 1;
    res := res || jsonb_build_object('week', wb);
  end if;
  return res;
end $$;
revoke all on function public.builds_list(text, text, text, text, text, text[], text, int, bigint[]) from public;
grant execute on function public.builds_list(text, text, text, text, text, text[], text, int, bigint[]) to anon, authenticated;

-- ---------- mes builds (titre « Théorycrafteur », mise à jour en un clic) ----------
create or replace function public.builds_me() returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'hid', hid, 'title', title, 'cls', cls, 'lvl', lvl, 'likes', likes, 'views', views,
    'hidden', hidden, 'el', el, 'tags', to_jsonb(tags), 'note', note, 'code', code, 'at', updated_at) order by updated_at desc), '[]'::jsonb)
  from builds where user_id = auth.uid() and not removed
$$;
revoke all on function public.builds_me() from public, anon;
grant execute on function public.builds_me() to authenticated;

-- ---------- publier ou mettre à jour un build ----------
-- p_id : le build à mettre à jour (le sien), ou null pour un nouveau. Renvoie {id} ou {err : message pour le joueur}.
-- Mise à jour en un clic (menu du héros) : p_title nul garde le titre, le conseil, les usages et l'élément déjà publiés.
create or replace function public.build_publish(p_id bigint, p_hid int, p_el text, p_bud text, p_tags text[], p_title text, p_note text, p_code text,
  p_sex text default 'm', p_head int default 0)
returns jsonb language plpgsql security definer set search_path = public
as $$ declare
  u uuid := auth.uid(); pr record; sa record; j jsonb; cl text; lv int; its text[];
  t text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  n text := btrim(coalesce(p_note, ''));
  c text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  tg text[] := array(select x from (select distinct on (x) x, o from unnest(coalesce(p_tags, '{}')) with ordinality u(x, o)
    where x in ('Donjon', 'Kolizéum', 'Farm', 'Songe', 'Débutant') order by x, o) y order by o);
  nid bigint;
begin
  if u is null then return jsonb_build_object('err', 'Connecte-toi avec Discord pour publier un build.'); end if;
  if p_id is not null and p_title is null then
    select title, note, tags, el into t, n, tg, p_el from builds where id = p_id and user_id = u and not removed;
    if not found then return jsonb_build_object('err', 'Ce build n''existe plus : publie-le à nouveau.', 'gone', true); end if;
  end if;
  select pseudo, suspended_at into pr from profiles where id = u;
  if not found then return jsonb_build_object('err', 'Choisis d''abord ton pseudo.'); end if;
  if pr.suspended_at is not null then return jsonb_build_object('err', 'Ton compte est suspendu.'); end if;
  select * into sa from chat_sanctions where user_id = u;
  if found and (sa.banned or sa.mute_until > now()) then return jsonb_build_object('err', 'Tu ne peux pas publier de build pour le moment.'); end if;
  if length(t) < 4 then return jsonb_build_object('err', 'Donne un titre à ton build (4 caractères au moins).'); end if;
  if length(t) > 60 then return jsonb_build_object('err', 'Le titre fait 60 caractères au maximum.'); end if;
  if length(n) > 300 then return jsonb_build_object('err', 'Le conseil fait 300 caractères au maximum.'); end if;
  if (t || ' ' || n) ~* '(https?://|www\.|discord\.(gg|com)|[a-z0-9-]+\.(com|fr|net|org|gg|io|be|ch|xyz|ru|ly|me|tv)(/|\s|$))' then
    return jsonb_build_object('err', 'Les liens ne sont pas autorisés dans un build.'); end if;
  if coalesce(p_el, '') not in ('fo', 'ine', 'cha', 'age', 'multi') then return jsonb_build_object('err', 'Choisis l''élément du build.'); end if;
  if coalesce(p_bud, '') not in ('abo', 'moy', 'pre') then return jsonb_build_object('err', 'Budget inconnu.'); end if;
  if array_length(tg, 1) > 3 then return jsonb_build_object('err', 'Trois usages au plus.'); end if;
  if length(c) > 4000 or left(c, 7) <> 'IDLUS1-' then return jsonb_build_object('err', 'Ce build ne peut pas être lu.'); end if;
  begin
    j := convert_from(decode(substr(c, 8), 'base64'), 'UTF8')::jsonb;
    cl := j ->> 'cls'; lv := (j ->> 'lvl')::int;
    its := array(select v from jsonb_each_text(coalesce(j -> 'eq', '{}'::jsonb)) e(k, v) where v ~ '^[a-z0-9_]{1,40}$');
  exception when others then return jsonb_build_object('err', 'Ce build ne peut pas être lu.');
  end;
  if cl is null or cl !~ '^[a-z]{2,10}$' or lv is null or lv not between 1 and 200 then return jsonb_build_object('err', 'Ce build ne peut pas être lu.'); end if;
  if coalesce(array_length(its, 1), 0) < 3 then return jsonb_build_object('err', 'Équipe au moins 3 objets sur ce héros avant de publier son build.'); end if;
  if exists (select 1 from builds where user_id = u and updated_at > now() - interval '15 seconds') then
    return jsonb_build_object('err', 'Attends quelques secondes avant de republier.'); end if;
  if p_id is not null then
    update builds set hid = p_hid, cls = cl, lvl = lv, el = p_el, bud = p_bud, tags = tg, title = t, note = n, code = c, items = its,
      sex = case when p_sex = 'f' then 'f' else 'm' end, head = greatest(0, least(coalesce(p_head, 0), 20)), pseudo = pr.pseudo, updated_at = now()
    where id = p_id and user_id = u and not removed returning id into nid;
    if nid is null then return jsonb_build_object('err', 'Ce build n''existe plus : publie-le à nouveau.', 'gone', true); end if;
    return jsonb_build_object('id', nid, 'upd', true);
  end if;
  if (select count(*) from builds where user_id = u and not removed) >= 10 then
    return jsonb_build_object('err', 'Tu as déjà 10 builds publiés : supprimes-en un dans « Mes builds » ou mets-en un à jour.'); end if;
  insert into builds (user_id, pseudo, hid, cls, lvl, el, bud, tags, title, note, code, items, sex, head)
    values (u, pr.pseudo, p_hid, cl, lv, p_el, p_bud, tg, t, n, c, its, case when p_sex = 'f' then 'f' else 'm' end, greatest(0, least(coalesce(p_head, 0), 20)))
    returning id into nid;
  return jsonb_build_object('id', nid);
end $$;
revoke all on function public.build_publish(bigint, int, text, text, text[], text, text, text, text, int) from public, anon;
grant execute on function public.build_publish(bigint, int, text, text, text[], text, text, text, text, int) to authenticated;

-- ---------- supprimer un de ses builds ----------
create or replace function public.build_delete(p_id bigint) returns text language plpgsql security definer set search_path = public
as $$ begin
  if auth.uid() is null then return 'non connecté'; end if;
  delete from builds where id = p_id and user_id = auth.uid();
  return null;
end $$;
revoke all on function public.build_delete(bigint) from public, anon;
grant execute on function public.build_delete(bigint) to authenticated;

-- ---------- ❤ J'aime (un par compte, on peut le retirer) ----------
create or replace function public.build_like(p_id bigint) returns jsonb language plpgsql security definer set search_path = public
as $$ declare u uuid := auth.uid(); b record; on_ boolean;
begin
  if u is null then return jsonb_build_object('err', 'Connecte-toi avec Discord pour aimer un build.'); end if;
  select id, user_id, likes into b from builds where id = p_id and not removed and not hidden;
  if not found then return jsonb_build_object('err', 'Ce build n''est plus disponible.'); end if;
  if b.user_id = u then return jsonb_build_object('err', 'Tu ne peux pas aimer ton propre build.'); end if;
  if exists (select 1 from build_likes where build_id = p_id and user_id = u) then
    delete from build_likes where build_id = p_id and user_id = u; on_ := false;
    update builds set likes = greatest(0, likes - 1) where id = p_id returning likes into b.likes;
  else
    insert into build_likes (build_id, user_id) values (p_id, u); on_ := true;
    update builds set likes = likes + 1 where id = p_id returning likes into b.likes;
  end if;
  return jsonb_build_object('liked', on_, 'likes', b.likes);
end $$;
revoke all on function public.build_like(bigint) from public, anon;
grant execute on function public.build_like(bigint) to authenticated;

-- ---------- une vue (une seule par joueur et par build ; p_guest : identifiant de la partie sans compte) ----------
create or replace function public.build_view(p_id bigint, p_guest text default null) returns boolean language plpgsql security definer set search_path = public
as $$ declare w text := coalesce(auth.uid()::text, case when length(btrim(coalesce(p_guest, ''))) between 8 and 64 then 'g:' || btrim(p_guest) end); n int;
begin
  if w is null then return false; end if;
  insert into build_views (build_id, who) select p_id, w where exists (select 1 from builds where id = p_id and not removed) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update builds set views = views + 1 where id = p_id; end if;
  return n > 0;
end $$;
revoke all on function public.build_view(bigint, text) from public;
grant execute on function public.build_view(bigint, text) to anon, authenticated;

-- ---------- signaler (compte nécessaire ; caché dès 3 signalements) ----------
create or replace function public.build_report(p_id bigint, p_reason text default null) returns text language plpgsql security definer set search_path = public
as $$ declare u uuid := auth.uid(); b record; n int;
begin
  if u is null then return 'Connecte-toi avec Discord pour signaler un build.'; end if;
  select id, user_id into b from builds where id = p_id and not removed;
  if not found then return 'Ce build n''est plus disponible.'; end if;
  if b.user_id = u then return 'C''est ton build : tu peux le supprimer dans « Mes builds ».'; end if;
  insert into build_reports (build_id, user_id, reason) values (p_id, u, left(btrim(coalesce(p_reason, '')), 80)) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return 'Tu as déjà signalé ce build.'; end if;
  update builds set reports = reports + 1, hidden = hidden or reports + 1 >= 3 where id = p_id;
  return null;
end $$;
revoke all on function public.build_report(bigint, text) from public, anon;
grant execute on function public.build_report(bigint, text) to authenticated;

-- ---------- panel admin (onglet « Builds ») ----------
-- Les builds signalés, cachés ou supprimés d'abord, puis les derniers publiés.
create or replace function public.adm_builds() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(false);
  return (select coalesce(jsonb_agg(x order by x.k desc, x.at desc), '[]'::jsonb) from (
    select b.id, coalesce(p.pseudo, b.pseudo) as pseudo, b.cls, b.lvl, b.title, b.note, b.likes, b.views, b.reports, b.hidden, b.removed, b.updated_at as at,
      (b.reports > 0 or b.hidden or b.removed) as k,
      (select string_agg(nullif(r.reason, ''), ' · ') from build_reports r where r.build_id = b.id) as reasons
    from builds b left join profiles p on p.id = b.user_id
    order by (b.reports > 0 or b.hidden or b.removed) desc, b.updated_at desc limit 200) x);
end $$;

-- p_act : 'ok' (remis en ligne, signalements effacés), 'hide' (caché), 'del' (supprimé, récupérable), 'restore' (rétabli).
create or replace function public.adm_build_set(p_id bigint, p_act text) returns void language plpgsql security definer set search_path = public
as $$ declare t text;
begin
  perform public.adm_need(false);
  select title into t from builds where id = p_id;
  if not found then raise exception 'build introuvable'; end if;
  if p_act = 'ok' then
    delete from build_reports where build_id = p_id;
    update builds set hidden = false, reports = 0 where id = p_id;
  elsif p_act = 'hide' then update builds set hidden = true where id = p_id;
  elsif p_act = 'del' then update builds set removed = true where id = p_id;
  elsif p_act = 'restore' then update builds set removed = false, hidden = false where id = p_id;
  else raise exception 'action inconnue'; end if;
  perform public.alog(format('build n°%s « %s » : %s', p_id, t,
    case p_act when 'ok' then 'remis en ligne' when 'hide' then 'caché' when 'del' then 'supprimé' else 'rétabli' end));
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_builds()', 'adm_build_set(bigint, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
