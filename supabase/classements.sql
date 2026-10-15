-- ============================================================================
-- Idlus — classements (multijoueur, étape 3). Appliqué automatiquement par le
-- workflow « Serveur en ligne » (.github/workflows/supabase.yml) ; relançable sans danger.
-- Les classements se remplissent tout seuls à chaque envoi de partie (déclencheur sur saves).
-- Les records de donjon ne sont écrits que par la fonction serveur « record », qui rejoue
-- le combat avant de l'accepter.
-- ============================================================================

-- ---------- classement général (niveau, album, succès) ----------
create table if not exists public.ladder (
  user_id uuid primary key references auth.users (id) on delete cascade,
  main text,
  level int not null default 0,
  album int not null default 0,
  succes int not null default 0,
  playtime int not null default 0,
  heroes jsonb not null default '[]'::jsonb,
  flagged boolean not null default false,
  flag_reason text,
  updated_at timestamptz not null default now()
);
-- 0.1.17 : héros principal (niveau, titre) pour le chat, Dofus obtenus pour les annonces
alter table public.ladder add column if not exists main_lvl int not null default 1;
alter table public.ladder add column if not exists title text;
alter table public.ladder add column if not exists dofus jsonb not null default '[]'::jsonb;
-- 0.1.35 : niveaux donnés par les recrutements (un héros recruté arrive à la moitié du meilleur niveau : ce n'est pas de la triche)
alter table public.ladder add column if not exists rec int not null default 0;
-- 0.1.49 : points de succès (classement des points)
alter table public.ladder add column if not exists pts int not null default 0;
-- 1.0.5 : course de lancement en direct : étape de la quête principale et heure où elle a été atteinte
alter table public.ladder add column if not exists qstep int not null default 0;
alter table public.ladder add column if not exists qstep_at timestamptz;
-- 1.0.8 : classement des métiers : {"tailleur": [niveau, xp], …, "tous": [somme des niveaux, somme des xp]}
alter table public.ladder add column if not exists jobs jsonb not null default '{}'::jsonb;
-- 1.0.9 : métiers de récolte et de forgemagie, classement de la semaine. jobs : [niveau, xp du niveau, xp totale, xp gagnée
-- pendant la semaine jobs_w] ; jobs_base : xp totale de chaque métier au début de la semaine ; jobs_prev : xp gagnée la semaine jobs_pw
alter table public.ladder add column if not exists jobs_w int not null default 0;
alter table public.ladder add column if not exists jobs_base jsonb not null default '{}'::jsonb;
alter table public.ladder add column if not exists jobs_prev jsonb not null default '{}'::jsonb;
alter table public.ladder add column if not exists jobs_pw int not null default 0;
-- 1.0.19 « Métiers comme dans DOFUS » : 1 quand la partie envoyée a ses métiers d'objets au niveau des objets (niveaux convertis)
alter table public.ladder add column if not exists jobs_cobj int not null default 0;
-- 1.0.32.11 « Vérifié par Mathis » : un joueur que Mathis remet dans les classements n'est plus remis « en vérification »
-- automatiquement (avant, une partie qui avait servi au panel de test y retombait à chaque envoi) ; seul Mathis peut l'y remettre
alter table public.ladder add column if not exists verified boolean not null default false;
-- 1.0.32.13 « Mathis décide » : la vérification automatique ne retire plus personne des classements ; elle signale seulement le
-- compte à Mathis (suspect + flag_reason, onglet « En vérification » du panel Xener). Seul Mathis retire un joueur (flagged).
-- Exception : sa propre partie retouchée par le panel de test (mode « Comme un joueur ») reste hors des classements.
alter table public.ladder add column if not exists suspect boolean not null default false;
-- 1.0.19 : pour les classements, un compte pas encore revenu depuis la mise à jour montre ses métiers d'objets au niveau converti
-- (3 × niveau + 2, au plus 200, même part de la barre d'XP, comme la conversion du jeu) ; rien n'est modifié en base, le jeu
-- convertit la partie au prochain chargement. L'XP totale suit la courbe du jeu (30 × niveau^1,55 par niveau), le gain de la semaine reste.
create or replace function public.jobs_shown(j jsonb, c int) returns jsonb language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; l0 int; x0 bigint; l1 int; x1 bigint; cum bigint; sl bigint := 0; sx bigint := 0; st bigint := 0; sg bigint := 0; have boolean := false;
begin
  if coalesce(c, 0) >= 1 or j is null or j = '{}'::jsonb then return j; end if;
  foreach k in array array['tailleur','bijoutier','cordonnier','forgeron','sculpteur','faconneur'] loop
    v := j->k;
    if jsonb_typeof(v) = 'array' then
      l0 := least(greatest(coalesce((v->>0)::int, 1), 1), 200); x0 := greatest(coalesce((v->>1)::bigint, 0), 0);
      if l0 < 200 and (l0 > 1 or x0 > 0) then
        l1 := least(200, 3 * l0 + 2);
        x1 := case when l1 >= 200 then 0 else floor(least(1.0, x0::numeric / floor(30 * power(l0, 1.55))::numeric) * floor(30 * power(l1, 1.55)))::bigint end;
        select coalesce(sum(floor(30 * power(i, 1.55))), 0)::bigint into cum from generate_series(1, l1 - 1) i;
        j := j || jsonb_build_object(k, jsonb_build_array(l1, x1, cum + x1) || case when jsonb_array_length(v) >= 4 then jsonb_build_array(v->3) else '[]'::jsonb end);
      end if;
    end if;
  end loop;
  foreach k in array array['tailleur','bijoutier','cordonnier','forgeron','sculpteur','faconneur','bricoleur'] loop -- somme « tous » refaite
    v := j->k;
    if jsonb_typeof(v) = 'array' then
      have := true; sl := sl + coalesce((v->>0)::bigint, 0); sx := sx + coalesce((v->>1)::bigint, 0); st := st + coalesce((v->>2)::bigint, 0); sg := sg + coalesce((v->>3)::bigint, 0);
    end if;
  end loop;
  if have and jsonb_typeof(j->'tous') = 'array' then j := j || jsonb_build_object('tous', jsonb_build_array(sl, sx, st, sg)); end if;
  return j;
end $$;
alter table public.ladder enable row level security;
drop policy if exists "classement lisible" on public.ladder;
create policy "classement lisible" on public.ladder for select using (not flagged or user_id = auth.uid());

-- meilleur héros de chaque classe, pour le filtre par classe
create table if not exists public.ladder_class (
  user_id uuid not null references auth.users (id) on delete cascade,
  cls text not null,
  score int not null,
  primary key (user_id, cls)
);
alter table public.ladder_class enable row level security;
drop policy if exists "classes lisibles" on public.ladder_class;
create policy "classes lisibles" on public.ladder_class for select using (true);

-- ---------- records de donjon (vérifiés par le serveur) ----------
create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  did text not null,
  dname text,
  k int not null,
  t int not null,
  at timestamptz not null default now(),
  primary key (user_id, did)
);
alter table public.records enable row level security;
drop policy if exists "records lisibles" on public.records;
create policy "records lisibles" on public.records for select using (true);

create table if not exists public.records_week (
  user_id uuid not null references auth.users (id) on delete cascade,
  w int not null,
  did text not null,
  dname text,
  bracket int not null default 0,
  k int not null,
  t int not null,
  at timestamptz not null default now(),
  primary key (user_id, w, did)
);
alter table public.records_week enable row level security;
drop policy if exists "records semaine lisibles" on public.records_week;
create policy "records semaine lisibles" on public.records_week for select using (true);
-- 1.0.30 (choix 23B) : équipe du record (classes des héros du combat rejoué par la fonction « record »), montrée dans la fiche
-- du donjon et dans Classements › Donjons. Les records d'avant gardent une équipe vide : rien n'est modifié.
alter table public.records add column if not exists team jsonb not null default '[]'::jsonb;
alter table public.records_week add column if not exists team jsonb not null default '[]'::jsonb;

-- ---------- les « Premiers » : gravés pour toujours ----------
create table if not exists public.firsts (
  kind text not null,
  key text not null default '',
  label text,
  user_id uuid references auth.users (id) on delete set null,
  pseudo text,
  at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.firsts enable row level security;
drop policy if exists "premiers lisibles" on public.firsts;
create policy "premiers lisibles" on public.firsts for select using (true);

-- ---------- administrateurs (Mathis) ----------
create table if not exists public.admins (user_id uuid primary key references auth.users (id) on delete cascade);
alter table public.admins enable row level security;
-- le tout premier compte créé est celui de Mathis
insert into public.admins (user_id) select id from public.profiles order by created_at limit 1 on conflict do nothing;
-- s'il n'y a encore aucun compte, le premier pseudo créé devient administrateur
create or replace function public.first_admin() returns trigger language plpgsql security definer set search_path = public
as $$ begin if not exists (select 1 from public.admins) then insert into public.admins (user_id) values (new.id) on conflict do nothing; end if; return new; end $$;
drop trigger if exists profiles_first_admin on public.profiles;
create trigger profiles_first_admin after insert on public.profiles for each row execute function public.first_admin();

-- ---------- vues publiques (sans les joueurs « en vérification ») ----------
-- 0.1.26 : main_lvl (niveau du héros principal) ajouté en dernière colonne, pour le cadre du médaillon ; 0.1.49 : pts (points de succès) après
-- 1.0.30 : team (équipe du record) en dernière colonne de lb_records et lb_week
create or replace view public.lb_level as
  select l.user_id, p.pseudo, l.main, l.level, l.album, l.succes, l.heroes, l.main_lvl, l.pts
  from public.ladder l join public.profiles p on p.id = l.user_id where not l.flagged;
create or replace view public.lb_class as
  select c.user_id, p.pseudo, c.cls, c.score
  from public.ladder_class c join public.ladder l on l.user_id = c.user_id join public.profiles p on p.id = c.user_id where not l.flagged;
create or replace view public.lb_records as
  select r.user_id, p.pseudo, l.main, r.did, r.dname, r.k, r.t, r.at, l.main_lvl, r.team
  from public.records r join public.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
create or replace view public.lb_week as
  select r.user_id, p.pseudo, l.main, r.w, r.did, r.dname, r.bracket, r.k, r.t, r.at,
    rank() over (partition by r.w, r.did order by r.k desc, r.t asc, r.at asc) as r, l.main_lvl, r.team
  from public.records_week r join public.ladder l on l.user_id = r.user_id join public.profiles p on p.id = r.user_id where not l.flagged;
grant select on public.lb_level, public.lb_class, public.lb_records, public.lb_week to anon, authenticated;
-- 1.0.5 : course de lancement : les comptes classés par étape de la quête principale, puis par qui l'a atteinte en premier
create or replace view public.lb_race as
  select l.user_id, p.pseudo, l.main, l.main_lvl, l.qstep, l.qstep_at
  from public.ladder l join public.profiles p on p.id = l.user_id where not l.flagged and l.qstep > 0;
grant select on public.lb_race to anon, authenticated;
-- 1.0.8 : classement des métiers : une ligne par compte et par métier (et « tous »), sans les joueurs en vérification
-- 1.0.9 : + total (xp totale depuis le niveau 1, pour « Encore … XP pour dépasser … ») ; 1.0.19 : métiers montrés convertis (jobs_shown)
-- 1.0.25 : + ren (renaissances du métier, ou leur somme pour « tous ») : le jeu classe par renaissance, puis niveau, puis XP
create or replace view public.lb_jobs as
  select l.user_id, p.pseudo, l.main, l.main_lvl, j.key as job, (j.value->>0)::int as lvl, (j.value->>1)::bigint as xp, c.jj as alljobs, coalesce((j.value->>2)::bigint, 0) as total,
    coalesce((j.value->>4)::int, 0) as ren
  from public.ladder l join public.profiles p on p.id = l.user_id cross join lateral (select public.jobs_shown(l.jobs, l.jobs_cobj) as jj) c cross join lateral jsonb_each(c.jj) j
  where not l.flagged and jsonb_typeof(j.value) = 'array';
grant select on public.lb_jobs to anon, authenticated;
-- 1.0.9 : classement de la semaine (semaine w = celle des donjons de la semaine, du lundi au dimanche, en UTC) : xp gagnée
-- par compte et par métier, cette semaine (jobs) et la précédente (jobs_prev) ; r = place dans la semaine
create or replace view public.lb_jobs_week as
  select x.*, rank() over (partition by x.w, x.job order by x.gain desc) as r from (
    select l.user_id, p.pseudo, l.main, l.main_lvl, l.jobs_w as w, j.key as job, coalesce((j.value->>3)::bigint, 0) as gain, (j.value->>0)::int as lvl
    from public.ladder l join public.profiles p on p.id = l.user_id cross join lateral jsonb_each(public.jobs_shown(l.jobs, l.jobs_cobj)) j
    where not l.flagged and l.jobs_w > 0 and jsonb_typeof(j.value) = 'array'
    union all
    select l.user_id, p.pseudo, l.main, l.main_lvl, l.jobs_pw as w, j.key as job, coalesce((j.value #>> '{}')::bigint, 0) as gain, null::int as lvl
    from public.ladder l join public.profiles p on p.id = l.user_id cross join lateral jsonb_each(l.jobs_prev) j
    where not l.flagged and l.jobs_pw > 0 and jsonb_typeof(j.value) = 'number'
  ) x where x.gain > 0;
grant select on public.lb_jobs_week to anon, authenticated;

-- ---------- mise à jour du classement à chaque envoi de partie ----------
-- La partie envoie un résumé (meta) : niveau de l'équipe, album, succès, héros.
-- Un progrès impossible depuis l'envoi précédent met le joueur « en vérification » :
-- 1.0.32.13 : il reste classé et joue normalement, le compte est seulement signalé à Mathis, qui décide (panel Xener).
create or replace function public.ladder_from_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := new.meta; o public.ladder%rowtype; rk int; lv int; al int; su int; pt int; rc int; ps int; qs int; secs numeric; reason text; bad boolean;
  jb jsonb := '{}'::jsonb; jn text; jl int; jr int; jx bigint; jtt bigint; jg text; jsum jsonb := '{}'::jsonb; wnow int; jbase jsonb; jprev jsonb := '{}'::jsonb; jpw int := 0; bt bigint; jgain bigint; jv jsonb; hadrow boolean;
  cobj int; conv boolean := false; stale boolean := false; hide boolean := false;
  jnames constant jsonb := '{"tailleur":"Tailleur","bijoutier":"Bijoutier","cordonnier":"Cordonnier","forgeron":"Forgeron","sculpteur":"Sculpteur","faconneur":"Façonneur","bricoleur":"Bricoleur"}';
  -- 1.0.9 : tous les métiers classés et leur groupe (le total du groupe : tous, tous_recolte, tous_fm)
  jgroup constant jsonb := '{"tailleur":"tous","bijoutier":"tous","cordonnier":"tous","forgeron":"tous","sculpteur":"tous","faconneur":"tous","bricoleur":"tous",
    "paysan":"tous_recolte","bucheron":"tous_recolte","mineur":"tous_recolte","alchimiste":"tous_recolte","pecheur":"tous_recolte",
    "costumage":"tous_fm","joaillomage":"tous_fm","cordomage":"tous_fm","forgemage":"tous_fm","sculptemage":"tous_fm","facomage":"tous_fm"}';
begin
  if m is null or m->>'level' is null then return new; end if;
  lv := coalesce((m->>'level')::int, 0); al := coalesce((m->>'album')::int, 0);
  su := coalesce((m->>'succes')::int, 0); pt := coalesce((m->>'playtime')::int, 0);
  rc := coalesce((m->>'rec')::int, 0); ps := least(greatest(coalesce((m->>'pts')::int, 0), 0), 50000);
  qs := least(greatest(coalesce((m->>'qstep')::int, 0), 0), 500);
  select * into o from public.ladder where user_id = new.user_id;
  hadrow := found; -- (found change à chaque requête : on garde ici si le compte était déjà classé)
  -- 1.0.19 « Métiers comme dans DOFUS » : conv = premier envoi d'une partie aux métiers convertis (le saut de niveau ne compte ni dans
  -- la semaine, ni pour la vérification de vitesse, ni pour les « Premiers ») ; stale = partie pas encore convertie (vieil onglet)
  -- envoyée après : elle ne touche plus aux métiers
  cobj := case when coalesce((m->>'cobj')::int, 0) >= 1 then 1 else 0 end;
  conv := hadrow and cobj = 1 and o.jobs_cobj = 0;
  stale := hadrow and cobj = 0 and o.jobs_cobj = 1;
  -- 1.0.8 : métiers (seulement ceux qui sont connus, niveau 1 à 200) ; 1.0.9 : xp totale et xp gagnée dans la semaine
  wnow := floor((extract(epoch from now()) / 86400 + 3) / 7)::int; -- même semaine que les donjons de la semaine
  if hadrow and o.jobs_w = wnow then jbase := o.jobs_base; jprev := o.jobs_prev; jpw := o.jobs_pw;
  else -- nouvelle semaine : on part des derniers totaux connus, et la semaine passée est gardée pour le titre
    jbase := '{}'::jsonb;
    if hadrow then
      select coalesce(jsonb_object_agg(key, (value->>2)::bigint), '{}'::jsonb) into jbase from jsonb_each(o.jobs) where jsonb_typeof(value) = 'array' and value->>2 is not null and jgroup ? key;
      if o.jobs_w > 0 then
        select coalesce(jsonb_object_agg(key, (value->>3)::bigint), '{}'::jsonb) into jprev from jsonb_each(o.jobs) where jsonb_typeof(value) = 'array' and coalesce((value->>3)::bigint, 0) > 0;
        jpw := o.jobs_w;
      end if;
    end if;
  end if;
  if jsonb_typeof(m->'jobs') = 'object' and not stale then
    for jn in select jsonb_object_keys(jgroup) loop
      jv := m->'jobs'->jn;
      if jsonb_typeof(jv) = 'array' then
        jl := least(greatest(coalesce((jv->>0)::int, 1), 1), 200);
        jx := least(greatest(coalesce((jv->>1)::bigint, 0), 0), 2000000000);
        -- 1.0.25 « Renaissance des métiers » : 4e valeur envoyée = nombre de renaissances (0 à 10), gardé en 5e ; l'XP totale compte toutes les vies
        jr := case when jsonb_array_length(jv) >= 4 and jsonb_typeof(jv->3) = 'number' then least(greatest(floor((jv->>3)::numeric)::int, 0), 10) else 0 end;
        if jsonb_array_length(jv) >= 3 then
          jtt := least(greatest(coalesce((jv->>2)::bigint, 0), 0), 1000000000000);
          bt := coalesce((jbase->>jn)::bigint, jtt); -- métier vu pour la première fois cette semaine : il part de là
          if conv and jgroup->>jn = 'tous' and jn <> 'bricoleur' then -- 1.0.19 : la conversion garde le gain de la semaine tel quel
            bt := jtt - case when o.jobs_w = wnow then coalesce((o.jobs->jn->>3)::bigint, 0) else 0 end;
          end if;
          jbase := jbase || jsonb_build_object(jn, bt);
          jgain := greatest(0, jtt - bt); -- une partie revenue en arrière ne gagne rien (et la base ne baisse pas)
          jb := jb || jsonb_build_object(jn, jsonb_build_array(jl, jx, jtt, jgain) || case when jr > 0 then jsonb_build_array(jr) else '[]'::jsonb end);
        else -- partie encore en 1.0.8 (sans xp totale) : niveau seulement, la semaine reprendra au prochain envoi
          jtt := 0; jgain := 0;
          jb := jb || jsonb_build_object(jn, jsonb_build_array(jl, jx));
        end if;
        jg := jgroup->>jn;
        jsum := jsum || jsonb_build_object(jg, jsonb_build_array(
          coalesce((jsum->jg->>0)::bigint, 0) + jl, coalesce((jsum->jg->>1)::bigint, 0) + jx, coalesce((jsum->jg->>2)::bigint, 0) + jtt, coalesce((jsum->jg->>3)::bigint, 0) + jgain,
          coalesce((jsum->jg->>4)::bigint, 0) + jr));
      end if;
    end loop;
    jb := jb || jsum;
  end if;
  if hadrow then
    secs := greatest(60, extract(epoch from (now() - o.updated_at)));
    -- 1.0.25.9 « Vérification plus juste » : 120 niveaux + 15 par minute (avant 60 + 1 par minute : des recrues montées au Sablier
    -- pendant une coupure de connexion de 2 min dépassaient la limite ; une partie retouchée saute toujours de centaines de niveaux)
    if lv - o.level - greatest(0, rc - o.rec) > 120 + secs / 4 then reason := format('+%s niveaux en %s min', lv - o.level, round(secs / 60));
    elsif al - o.album > 10 + secs / 300 then reason := format('+%s âmes en %s min', al - o.album, round(secs / 60));
    elsif pt + 120 < o.playtime then reason := 'temps de jeu en baisse';
    end if;
    -- 1.0.8 : un métier qui gagne plus de 60 niveaux en moins de 10 minutes (seulement si le serveur connaissait déjà les métiers)
    -- (1.0.9 : seulement l'artisanat ; la récolte et la forgemagie montent bien moins vite et ne gagnent pas de « Premier »)
    -- (1.0.12.1 « Artisanat haut niveau » : environ 10 fabrications par niveau, une réserve de ressources peut faire 60 niveaux d'un coup : seuil à 120)
    -- (1.0.19 « Métiers comme dans DOFUS » : environ 3 fabrications par niveau pour les métiers d'objets : seuil à 150 ; rien pour l'envoi de la conversion)
    if reason is null and secs < 600 and o.jobs <> '{}'::jsonb and not conv then
      select format('%s : +%s niveaux en %s min', jnames->>k, (jb->k->>0)::int - (o.jobs->k->>0)::int, round(secs / 60)) into reason
      from jsonb_object_keys(jnames) k
      where jsonb_typeof(jb->k) = 'array' and jsonb_typeof(o.jobs->k) = 'array' and (jb->k->>0)::int - (o.jobs->k->>0)::int > 150
        and coalesce((jb->k->>4)::int, 0) = 0 limit 1; -- 1.0.25 : un métier qui a renu remonte bien plus vite (+30 % d'XP par renaissance)
    end if;
  elsif lv > 400 and pt < 3600 then reason := 'niveau trop élevé pour le temps de jeu';
  end if;
  if coalesce((m->>'panel')::boolean, false) then reason := 'panel de test utilisé dans cette partie'; end if;
  if hadrow and o.verified then reason := null; end if; -- 1.0.32.11 : vérifié par Mathis, il reste dans les classements
  hide := reason is not null and coalesce((m->>'panel')::boolean, false) and exists (select 1 from public.admins a where a.user_id = new.user_id); -- 1.0.32.13
  insert into public.ladder (user_id, main, level, album, succes, playtime, heroes, flagged, suspect, flag_reason, updated_at, main_lvl, title, dofus, rec, pts, qstep, qstep_at, jobs, jobs_w, jobs_base, jobs_prev, jobs_pw, jobs_cobj)
    values (new.user_id, m->>'main', lv, al, su, pt, coalesce(m->'heroes', '[]'::jsonb), hide, reason is not null and not hide, reason, now(),
      coalesce((m->>'mainLvl')::int, 1), left(m->>'title', 40), coalesce(m->'dofus', '[]'::jsonb), rc, ps, qs, now(), jb,
      case when jb = '{}'::jsonb then 0 else wnow end, case when jb = '{}'::jsonb then '{}'::jsonb else jbase end, jprev, jpw, cobj)
    on conflict (user_id) do update set main = excluded.main, level = excluded.level, album = excluded.album, succes = excluded.succes,
      playtime = excluded.playtime, heroes = excluded.heroes, updated_at = now(), main_lvl = excluded.main_lvl, title = excluded.title, dofus = excluded.dofus, rec = excluded.rec, pts = excluded.pts,
      jobs = case when excluded.jobs = '{}'::jsonb then public.ladder.jobs else excluded.jobs end,
      jobs_w = case when excluded.jobs = '{}'::jsonb then public.ladder.jobs_w else excluded.jobs_w end,
      jobs_base = case when excluded.jobs = '{}'::jsonb then public.ladder.jobs_base else excluded.jobs_base end,
      jobs_prev = case when excluded.jobs = '{}'::jsonb then public.ladder.jobs_prev else excluded.jobs_prev end,
      jobs_pw = case when excluded.jobs = '{}'::jsonb then public.ladder.jobs_pw else excluded.jobs_pw end,
      jobs_cobj = greatest(public.ladder.jobs_cobj, excluded.jobs_cobj),
      qstep = excluded.qstep, qstep_at = case when excluded.qstep > public.ladder.qstep or public.ladder.qstep_at is null then now() else public.ladder.qstep_at end,
      flagged = public.ladder.flagged or excluded.flagged, suspect = public.ladder.suspect or excluded.suspect, flag_reason = coalesce(public.ladder.flag_reason, excluded.flag_reason);
  select flagged or suspect into bad from public.ladder where user_id = new.user_id; -- 1.0.32.13 : pas de « Premier » tant que Mathis n'a pas regardé
  delete from public.ladder_class where user_id = new.user_id;
  insert into public.ladder_class (user_id, cls, score)
    select new.user_id, x->>'cls', max(coalesce((x->>'lvl')::int, 0) + 200 * coalesce((x->>'ren')::int, 0))
    from jsonb_array_elements(coalesce(m->'heroes', '[]'::jsonb)) x where x->>'cls' is not null group by x->>'cls';
  if not bad and coalesce((m->>'lvl200')::boolean, false) then
    insert into public.firsts (kind, key, label, user_id, pseudo)
      select 'lvl200', '', 'Premier héros au niveau 200', new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
      on conflict do nothing;
  end if;
  -- 1.0.8 : le premier compte au niveau 200 de chaque métier d'artisanat (titre « Grand … » dans le jeu).
  -- 1.0.9 : seulement en y arrivant : le serveur doit avoir vu ce métier sous le niveau 200 (pas de « Premier » pour un compte
  -- déjà au niveau 200 avant la 1.0.8, ni pour la récolte et la forgemagie) ; 1.0.19 : ni par la conversion des niveaux (conv)
  if not bad and hadrow and not conv then
    insert into public.firsts (kind, key, label, user_id, pseudo)
      select 'job200', k, format('Premier %s au niveau 200', jnames->>k), new.user_id, p.pseudo
      from jsonb_object_keys(jnames) k cross join public.profiles p
      where p.id = new.user_id and jsonb_typeof(jb->k) = 'array' and (jb->k->>0)::int >= 200 and coalesce((jb->k->>4)::int, 0) = 0
        and jsonb_typeof(o.jobs->k) = 'array' and (o.jobs->k->>0)::int < 200 and coalesce((o.jobs->k->>4)::int, 0) = 0 -- 1.0.25 : pas en remontant après une renaissance
      on conflict do nothing;
    -- 1.0.9 : Grand Maître artisan : le premier compte avec les 7 métiers d'artisanat au niveau 200 (en y arrivant)
    if (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(jb->k) = 'array' and (jb->k->>0)::int >= 200) = 7
       and (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(o.jobs->k) = 'array' and (o.jobs->k->>0)::int >= 200) < 7
       and (select count(*) from jsonb_object_keys(jnames) k where jsonb_typeof(o.jobs->k) = 'array') = 7 then
      insert into public.firsts (kind, key, label, user_id, pseudo)
        select 'job200all', '', 'Premier Grand Maître artisan : les 7 métiers d''artisanat au niveau 200', new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.0 : course de lancement : les 10 premiers comptes à finir la quête principale après la sortie (13/10/2026, 16 h Paris)
  if not bad and coalesce((m->>'mainq')::boolean, false) and now() >= timestamptz '2026-10-13 14:00:00+00'
     and not exists (select 1 from public.firsts where kind = 'race10' and user_id = new.user_id) then
    select count(*) into rk from public.firsts where kind = 'race10';
    if rk < 10 then
      insert into public.firsts (kind, key, label, user_id, pseudo)
        select 'race10', (rk + 1)::text, format('Course de lancement de la 1.0 : n° %s sur 10', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.1 : les 10 premiers comptes à réunir les 4 Dofus de la 1.1 (Alliances, Trool, Onirique, Idlus) gagnent l'ornement « Gardien de la 1.1 »
  if not bad and jsonb_typeof(m->'dofus') = 'array' and (m->'dofus') ?& array['alliances', 'trool', 'onirique', 'idlus']
     and not exists (select 1 from public.firsts where kind = 'gardien11' and user_id = new.user_id) then
    select count(*) into rk from public.firsts where kind = 'gardien11';
    if rk < 10 then
      insert into public.firsts (kind, key, label, user_id, pseudo)
        select 'gardien11', (rk + 1)::text, format('Gardiens de la 1.1 : n° %s sur 10 à réunir les 4 Dofus', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  -- 1.1 : course de lancement de la 1.1 : les 10 premiers comptes à l'étage 100 de L'Ascension en Difficile (titre « Légende de la 1.1 »)
  if not bad and coalesce((m->>'ascd100')::boolean, false)
     and not exists (select 1 from public.firsts where kind = 'race11' and user_id = new.user_id) then
    select count(*) into rk from public.firsts where kind = 'race11';
    if rk < 10 then
      insert into public.firsts (kind, key, label, user_id, pseudo)
        select 'race11', (rk + 1)::text, format('Course de lancement de la 1.1 (L''Ascension) : n° %s sur 10', rk + 1), new.user_id, p.pseudo from public.profiles p where p.id = new.user_id
        on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists saves_ladder on public.saves;
create trigger saves_ladder after insert or update on public.saves for each row execute function public.ladder_from_save();

-- ---------- panneau de test : joueurs « en vérification » ----------
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
grant execute on function public.is_admin() to authenticated;
create or replace function public.admin_flagged()
returns table (user_id uuid, pseudo text, reason text, level int, updated_at timestamptz)
language sql security definer set search_path = public
as $$ select l.user_id, p.pseudo, l.flag_reason, l.level, l.updated_at from public.ladder l join public.profiles p on p.id = l.user_id
      where (l.flagged or l.suspect) and public.is_admin() order by l.updated_at desc $$;
create or replace function public.admin_unflag(p_user uuid)
returns void language plpgsql security definer set search_path = public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update public.ladder set flagged = false, suspect = false, flag_reason = null, verified = true where user_id = p_user; end $$;
create or replace function public.admin_flag(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$ begin if not public.is_admin() then raise exception 'réservé à Mathis'; end if;
  update public.ladder set flagged = true, suspect = false, flag_reason = coalesce(p_reason, 'décision de Mathis'), verified = false where user_id = p_user; end $$;
revoke all on function public.admin_flagged(), public.admin_unflag(uuid), public.admin_flag(uuid, text) from public, anon;
grant execute on function public.admin_flagged(), public.admin_unflag(uuid), public.admin_flag(uuid, text) to authenticated;

-- ---------- 1.0.30 (choix 37A) : GIGA annonce d'un Dofus ----------
-- Un Dofus tombé sur un boss s'annonce en plein écran chez tous les joueurs connectés, puis dans le chat Général.
-- La fonction « record » ({ dofus: { uid, did, k } }) vérifie la partie en ligne (le Dofus y est, la stasis est terminée,
-- l'équipe la refait, compte pas « en vérification ») puis écrit ici et dans chat_msgs (kind 'ann', data.t 'giga').
-- Une ligne par exemplaire (uid de l'objet) : jamais deux annonces pour le même Dofus. Invisible pour les joueurs.
create table if not exists public.dofus_ann (
  user_id uuid not null references auth.users (id) on delete cascade,
  uid bigint not null,
  dofus text not null,
  did text,
  k int,
  at timestamptz not null default now(),
  primary key (user_id, uid)
);
alter table public.dofus_ann enable row level security; -- aucune règle : seule la fonction serveur (service_role) y touche
create index if not exists dofus_ann_at on public.dofus_ann (user_id, at desc);

-- ---------- opérations ponctuelles (jouées une seule fois, même si ce fichier est réappliqué) ----------
create table if not exists public.ops_done (id text primary key, at timestamptz not null default now());
alter table public.ops_done enable row level security; -- aucune règle : invisible pour les joueurs
-- 1.0.12.1 : « remets à zéro la semaine des métiers » (Mathis, 13/10/2026 23:47 Paris, après le nerf des recettes 1.0.9.2) :
-- la semaine en cours repart de 0 XP pour tout le monde (le point de départ de la semaine devient l'XP totale actuelle).
-- Les niveaux, l'XP totale et la semaine passée ne changent pas.
do $$
declare wnow int := floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
begin
  if not exists (select 1 from public.ops_done where id = 'raz-semaine-metiers-2026-10-13') then
    update public.ladder l set
      jobs_base = coalesce((select jsonb_object_agg(j.key, (j.value->>2)::bigint) from jsonb_each(l.jobs) j
        where jsonb_typeof(j.value) = 'array' and j.value->>2 is not null and j.key not like 'tous%'), '{}'::jsonb),
      jobs = coalesce((select jsonb_object_agg(j.key, case when jsonb_typeof(j.value) = 'array' and jsonb_array_length(j.value) >= 4
        then jsonb_set(j.value, '{3}', '0'::jsonb) else j.value end) from jsonb_each(l.jobs) j), '{}'::jsonb)
    where l.jobs_w = wnow;
    insert into public.ops_done (id) values ('raz-semaine-metiers-2026-10-13');
  end if;
end $$;
-- 1.2.8.x « Nouveau départ des stasis » (Mathis, 15/10/2026, avec les sorts uniques des boss) : les classements des stasis de donjon
-- repartent de zéro pour tout le monde. Avant d'effacer, une copie est gardée dans records_s1 (tous les records) et
-- records_week_s1 (la semaine en cours), invisibles pour les joueurs. Les stasis débloquées, l'équipement, les semaines passées
-- (titre « Maître de la semaine ») et les Premiers gravés ne changent pas. La saison 2 ne compte que les stasis terminées
-- depuis la mise à jour (E.stasisSaison dans js/engine.js, lu par la fonction serveur « record »).
create table if not exists public.records_s1 (like public.records including all);
create table if not exists public.records_week_s1 (like public.records_week including all);
alter table public.records_s1 enable row level security; -- aucune règle : archive invisible pour les joueurs
alter table public.records_week_s1 enable row level security;
do $$
declare wnow int := floor((extract(epoch from now()) / 86400 + 3) / 7)::int;
begin
  if not exists (select 1 from public.ops_done where id = 'raz-stasis-sorts-des-boss-2026-10-15') then
    insert into public.records_s1 select * from public.records on conflict do nothing;
    insert into public.records_week_s1 select * from public.records_week where w = wnow on conflict do nothing;
    delete from public.records;
    delete from public.records_week where w = wnow;
    insert into public.ops_done (id) values ('raz-stasis-sorts-des-boss-2026-10-15');
  end if;
end $$;
-- Premiers depuis les sorts des boss : pour chaque donjon, la stasis la plus haute déjà prise (firsts kind « sb », key « donjon:stasis »)
create or replace view public.lb_first_sb as
  select distinct on (split_part(f.key, ':', 1)) split_part(f.key, ':', 1) as did, split_part(f.key, ':', 2)::int as k, f.pseudo, f.user_id, f.at
  from public.firsts f where f.kind = 'sb' order by split_part(f.key, ':', 1), split_part(f.key, ':', 2)::int desc;
grant select on public.lb_first_sb to anon, authenticated;
-- 2.0.4 « Classement sans les vies » (Mathis, 16/10/2026, choix 2A) : la Renaissance est devenue la Maîtrise en 2.0 et le jeu ramène
-- chaque héros rené au niveau 200. Les comptes pas encore reconnectés depuis gardaient niveau + 200 × vies (jusqu'à 2 200 par héros)
-- et restaient devant tout le monde. Une seule fois : leurs héros renés passent à 200 (ren 0), le niveau du compte (8 meilleurs héros)
-- et le score de classe sont plafonnés de la même façon. Rien ne change dans les parties ; les autres comptes ne bougent pas.
do $$
begin
  if not exists (select 1 from public.ops_done where id = 'classement-sans-vies-2026-10-16') then
    update public.ladder l set
      heroes = (select coalesce(jsonb_agg(case when coalesce((x->>'ren')::int, 0) > 0 then x || jsonb_build_object('lvl', 200, 'ren', 0) else x end), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x),
      level = (select coalesce(sum(v), 0) from (select case when coalesce((x->>'ren')::int, 0) > 0 then 200 else coalesce((x->>'lvl')::int, 0) end as v
        from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x order by 1 desc limit 8) t)
    where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(l.heroes) = 'array' then l.heroes else '[]'::jsonb end) x where coalesce((x->>'ren')::int, 0) > 0);
    update public.ladder_class set score = 200 where score > 200;
    insert into public.ops_done (id) values ('classement-sans-vies-2026-10-16');
  end if;
end $$;
