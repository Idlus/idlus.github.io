-- Saison 1, lot 4 : registre des Fragments du Temps et vitrine de saison, gardés par le serveur.
-- CE FICHIER NE S'INSTALLE QUE DANS L'ESPACE DE SAISON : tools/saison_schema.js l'ajoute à supabase/saison1.sql (public. → s1.)
-- et il n'est pas dans la liste « tous » de .github/workflows/supabase.yml (jamais dans le Classique).
-- Le jeu tient le même registre dans la partie (js/saisonc.js) ; le serveur vérifie les bornes des activités (par jour, par
-- semaine, 800 au plus), refuse un achat sans assez de Fragments et garde les cosmétiques achetés, liés au compte.
-- Relançable sans danger. PAS ENCORE INSTALLÉ : accord écrit de Mathis nécessaire.

create table if not exists public.s1_cfg (id int primary key default 1 check (id = 1), debut timestamptz);
insert into public.s1_cfg (id) values (1) on conflict do nothing;
alter table public.s1_cfg enable row level security;
drop policy if exists "s1 cfg lisible" on public.s1_cfg;
create policy "s1 cfg lisible" on public.s1_cfg for select using (true);
revoke insert, update, delete on public.s1_cfg from anon, authenticated;

create table if not exists public.frag_led (
  user_id uuid not null references auth.users (id) on delete cascade,
  src text not null check (length(src) between 3 and 80),
  n int not null check (n between -1000 and 8),
  at timestamptz not null default now(),
  primary key (user_id, src)
);
alter table public.frag_led enable row level security;
drop policy if exists "fragments : les siens" on public.frag_led;
create policy "fragments : les siens" on public.frag_led for select using (user_id = auth.uid());
revoke insert, update, delete on public.frag_led from anon, authenticated;

-- bornes des activités (mêmes valeurs que E.S1C.ACT dans js/saisonc.js)
create or replace function public.frag_act_max(k text) returns int language sql immutable as $$
  select case k when 'dj' then 8 when 'arch' then 6 when 'job' then 4 when 'bounty' then 4 when 'mt' then 4 else 0 end $$;

-- p_rows : [{ src: 'act:<jour>:<activité>:<cumul>', n }] ; renvoie le solde du serveur
create or replace function public.frag_post(p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); r jsonb; s text; n int; parts text[]; d int; k text; t0 timestamptz; week int; quota int; tot int; dsum int;
begin
  if me is null then raise exception 'connexion nécessaire'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 60 then raise exception 'envoi illisible'; end if;
  select coalesce(debut, (select min(at) from frag_led where user_id = me), now()) into t0 from s1_cfg where id = 1;
  if now() >= t0 + interval '56 days' then return (select coalesce(sum(n), 0) from frag_led where user_id = me); end if;
  week := least(8, greatest(1, ceil(extract(epoch from now() - t0) / 604800.0)::int));
  quota := least(800, 100 * week);
  for r in select * from jsonb_array_elements(p_rows) loop
    s := r ->> 'src'; n := coalesce((r ->> 'n')::int, 0);
    parts := string_to_array(coalesce(s, ''), ':');
    if array_length(parts, 1) <> 4 or parts[1] <> 'act' or parts[2] !~ '^[0-9]{1,2}$' or n < 1 or n > 8 then continue; end if;
    d := parts[2]::int; k := parts[3];
    if frag_act_max(k) = 0 or d < 1 or d > 56 then continue; end if;
    select coalesce(sum(f.n), 0) into dsum from frag_led f where f.user_id = me and f.src like format('act:%s:%s:%%', d, k);
    if dsum + n > frag_act_max(k) then continue; end if; -- borne du jour de cette activité
    select coalesce(sum(f.n), 0) into tot from frag_led f where f.user_id = me and f.n > 0;
    if tot + n > quota then continue; end if; -- quota de la semaine (100 par semaine, 800 au plus)
    insert into frag_led (user_id, src, n) values (me, s, n) on conflict do nothing;
  end loop;
  return (select coalesce(sum(f.n), 0) from frag_led f where f.user_id = me);
end $$;

-- prix de la vitrine (mêmes valeurs que E.VIT dans js/vitrine.js)
create or replace function public.vit_prix(p_id text) returns int language sql immutable as $$
  select case p_id when 'v_aiguilles' then 60 when 'v_tictac' then 60 when 'v_gardien' then 60
    when 'v_rouages' then 120 when 'v_coucou' then 120 when 'v_cadran' then 120 when 'v_voyageur' then 120 when 'v_village' then 120
    when 'v_horloge' then 200 when 'v_sablier' then 200 when 'v_rouagier' then 200 when 'v_cadre' then 200
    when 'v_fissure' then 160
    when 'v_st9' then 60 when 'v_st10' then 60 when 'v_st12' then 120 when 'v_st21' then 60 when 'v_st22' then 120 when 'v_st24' then 60 when 'v_st30' then 120 when 'v_st35' then 60 -- lot 5 : autocollants et meubles rares (js/saisonsoc.js)
    when 'v_mb6' then 60 when 'v_mb3' then 120 when 'v_mb5' then 120 when 'v_mb9' then 120 when 'v_mb4' then 200 when 'v_mb7' then 200 when 'v_mb12' then 160
    else 0 end $$;

create or replace function public.vit_buy(p_id text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p int := vit_prix(p_id); bal int;
begin
  if me is null then return 'Connexion nécessaire.'; end if;
  if p = 0 then return 'Objet inconnu.'; end if;
  if exists (select 1 from frag_led where user_id = me and src = 'vit:' || p_id) then return null; end if; -- déjà acheté : rien à refaire
  perform pg_advisory_xact_lock(hashtext('vit:' || me::text));
  select coalesce(sum(n), 0) into bal from frag_led where user_id = me;
  if bal < p then return format('Il faut %s Fragments du Temps.', p); end if;
  insert into frag_led (user_id, src, n) values (me, 'vit:' || p_id, -p) on conflict do nothing;
  return null;
end $$;

-- cosmétiques de la vitrine du compte (lus aussi par la partie Éternel : ils sont liés au compte)
create or replace function public.vit_mine()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(substr(src, 5) order by at), '[]'::jsonb) from frag_led where user_id = auth.uid() and src like 'vit:%' $$;

revoke all on function public.frag_post(jsonb) from public, anon;
revoke all on function public.vit_buy(text) from public, anon;
revoke all on function public.vit_mine() from public, anon;
grant execute on function public.frag_post(jsonb) to authenticated;
grant execute on function public.vit_buy(text) to authenticated;
grant execute on function public.vit_mine() to authenticated;
