-- ============================================================================
-- Idlus — coefficient de brisage commun à tous les joueurs en ligne (0.1.43, comme sur un serveur DOFUS).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger.
-- Chaque brisage d'un modèle d'objet baisse son coefficient de 3 % (minimum 10 %) ; il remonte de 1 % toutes les 6 minutes.
-- Le jeu ne touche jamais la table : il lit la liste et envoie ses brisages par les deux fonctions ci-dessous.
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

-- Les modèles dont le coefficient est sous 100 % : { "modèle": coefficient }
create or replace function public.brisage_list() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(tpl, cur), '{}'::jsonb)
  from (select tpl, least(100, floor(v + extract(epoch from now() - t) / 360)) as cur from public.brisage_coef) x
  where cur < 100;
$$;

-- Envoie des brisages (au plus 300 par appel, 1 500 par tranche de 10 minutes et par joueur) et renvoie la liste à jour
create or replace function public.brisage_hit(p_tpls text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := auth.uid(); n int; recent int; x text;
begin
  if u is null then return jsonb_build_object('err', 'Connexion requise.'); end if;
  n := coalesce(array_length(p_tpls, 1), 0);
  if n = 0 then return public.brisage_list(); end if;
  if n > 300 then p_tpls := p_tpls[1:300]; n := 300; end if;
  select coalesce(sum(h.n), 0) into recent from public.brisage_hits h where h.user_id = u and h.at > now() - interval '10 minutes';
  if recent + n > 1500 then return jsonb_build_object('err', 'Trop de brisages d''un coup : réessaie dans quelques minutes.'); end if;
  insert into public.brisage_hits (user_id, n) values (u, n);
  delete from public.brisage_hits where at < now() - interval '1 hour';
  foreach x in array p_tpls loop
    insert into public.brisage_coef as c (tpl, v, t) values (left(x, 40), 97, now())
    on conflict (tpl) do update set v = greatest(10, least(100, floor(c.v + extract(epoch from now() - c.t) / 360)) - 3), t = now();
  end loop;
  return public.brisage_list();
end;
$$;
revoke all on function public.brisage_list() from public;
revoke all on function public.brisage_hit(text[]) from public;
grant execute on function public.brisage_list() to anon, authenticated;
grant execute on function public.brisage_hit(text[]) to authenticated;
