-- 1.1.2.4 : annonces en boucle (panel Xener › Annonces › « Annonces en boucle »).
-- Mathis écrit un texte, choisit un rythme (ex. toutes les heures), le bandeau et/ou le chat Général, une date de fin facultative.
-- Pas de tâche planifiée sur le serveur : le jeu des joueurs connectés appelle ann_tick() (au plus une fois par passage du bandeau,
-- toutes les 2 minutes, et seulement quand une annonce est due). Le premier appel qui arrive publie l'annonce, les autres ne font
-- rien (verrou « skip locked » + prochaine heure avancée). Personne en ligne = personne à prévenir, donc rien n'est publié.
-- Un seul bandeau à la fois : si une annonce ponctuelle de Mathis est affichée, la boucle passe seulement dans le chat cette fois-là.
create table if not exists public.announce_loops (
  id bigint generated always as identity primary key,
  body text not null,
  every_min int not null default 60,
  banner boolean not null default true,
  chat boolean not null default true,
  show_min int not null default 10,
  ends timestamptz,
  active boolean not null default true,
  next_at timestamptz not null default now(),
  last_at timestamptz,
  sent int not null default 0,
  by_user uuid,
  at timestamptz not null default now()
);
alter table public.announce_loops enable row level security; -- aucune lecture directe : seulement par les fonctions ci-dessous
alter table public.announces add column if not exists loop_id bigint;

-- Publie les annonces en boucle dues, renvoie l'heure de la prochaine (null s'il n'y en a aucune).
create or replace function public.ann_tick() returns timestamptz language plpgsql security definer set search_path = public
as $$ declare r record; manual boolean; nxt timestamptz; begin
  for r in select * from announce_loops where active and next_at <= now() order by id for update skip locked loop
    if r.ends is not null and r.ends <= now() then update announce_loops set active = false where id = r.id; continue; end if;
    update announces set until = now() where loop_id = r.id and (until is null or until > now()); -- l'ancien bandeau de cette boucle s'efface
    manual := exists (select 1 from announces where loop_id is null and banner and (until is null or until > now()) and srv is distinct from 'm'); -- 2.1.36 : un bandeau Monocompte ne prend pas la place du Classique
    if r.banner and not manual then
      insert into announces (body, banner, until, loop_id) values (r.body, true, now() + make_interval(mins => r.show_min), r.id);
    end if;
    if r.chat or (r.banner and manual) then -- bandeau déjà pris : l'annonce passe quand même dans le chat
      insert into chat_msgs (ch, user_id, pseudo, kind, body, data)
        values ('g', r.by_user, public.pseudo_of(r.by_user), 'ann', r.body, jsonb_build_object('t', 'admin', 'banner', r.banner and not manual, 'loop', r.id));
    end if;
    -- prochaine heure : on saute les passages manqués (personne en ligne) au lieu de tous les publier d'un coup
    update announce_loops set last_at = now(), sent = sent + 1,
      next_at = r.next_at + make_interval(mins => r.every_min) * (floor(extract(epoch from now() - r.next_at) / (r.every_min * 60)) + 1)
      where id = r.id;
  end loop;
  select min(next_at) into nxt from announce_loops where active and (ends is null or ends > now());
  return nxt;
end $$;
revoke all on function public.ann_tick() from public;
grant execute on function public.ann_tick() to anon, authenticated;

create or replace function public.adm_loops() returns jsonb language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  return (select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (select id, body, every_min, banner, chat, show_min, ends, active
    and (ends is null or ends > now()) active, next_at, last_at, sent from announce_loops) x);
end $$;

-- Crée (p_id null) ou modifie une annonce en boucle. Renvoie null si tout va bien, sinon la raison du refus.
-- p_now : la première annonce part tout de suite (sinon après un intervalle).
create or replace function public.adm_loop_save(p_id bigint, p_body text, p_every int, p_banner boolean, p_chat boolean, p_show int, p_ends timestamptz, p_now boolean)
returns text language plpgsql security definer set search_path = public
as $$ declare b text := btrim(coalesce(p_body, '')); e int := greatest(15, least(10080, coalesce(p_every, 60))); s int; begin
  perform public.adm_need(true);
  if b = '' then return 'Le texte est vide.'; end if;
  if char_length(b) > 200 then return '200 caractères au plus.'; end if;
  if b ~ '[\r\n]' then return 'Le texte doit tenir sur une seule ligne.'; end if;
  if not (p_banner or p_chat) then return 'Choisis au moins le bandeau ou le chat.'; end if;
  if p_ends is not null and p_ends <= now() then return 'La date de fin est déjà passée.'; end if;
  s := greatest(1, least(e, coalesce(p_show, 10)));
  if p_id is null then
    if (select count(*) from announce_loops) >= 20 then return 'Déjà 20 annonces en boucle : supprimes-en une.'; end if;
    insert into announce_loops (body, every_min, banner, chat, show_min, ends, next_at, by_user)
      values (b, e, p_banner, p_chat, s, p_ends, case when p_now then now() else now() + make_interval(mins => e) end, auth.uid());
    perform public.alog(format('annonce en boucle créée (toutes les %s min) : « %s »', e, left(b, 60)));
  else
    update announce_loops set body = b, every_min = e, banner = p_banner, chat = p_chat, show_min = s, ends = p_ends, active = true,
      next_at = case when p_now then now() else greatest(now(), coalesce(last_at, at) + make_interval(mins => e)) end where id = p_id;
    if not found then return 'Cette annonce en boucle n''existe plus.'; end if;
    update announces set body = b where loop_id = p_id and (until is null or until > now()); -- bandeau en cours corrigé aussi
    perform public.alog(format('annonce en boucle modifiée : « %s »', left(b, 60)));
  end if;
  return null;
end $$;

-- Pause (p_on false) ou reprise ; une reprise repart au prochain passage prévu (ou tout de suite s'il est dépassé).
create or replace function public.adm_loop_on(p_id bigint, p_on boolean) returns text language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  update announce_loops set active = p_on, next_at = case when p_on then greatest(next_at, now()) else next_at end,
    ends = case when p_on and ends <= now() then null else ends end where id = p_id;
  if not p_on then update announces set until = now() where loop_id = p_id and (until is null or until > now()); end if;
  perform public.alog(case when p_on then 'annonce en boucle reprise' else 'annonce en boucle en pause' end);
  return null;
end $$;

create or replace function public.adm_loop_del(p_id bigint) returns text language plpgsql security definer set search_path = public
as $$ begin
  perform public.adm_need(true);
  delete from announce_loops where id = p_id;
  update announces set until = now() where loop_id = p_id and (until is null or until > now());
  perform public.alog('annonce en boucle supprimée');
  return null;
end $$;

do $$ declare f text; begin
  foreach f in array array['adm_loops()', 'adm_loop_save(bigint, text, int, boolean, boolean, int, timestamptz, boolean)', 'adm_loop_on(bigint, boolean)', 'adm_loop_del(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
