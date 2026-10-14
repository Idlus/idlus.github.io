-- ============================================================================
-- Idlus 1.0.30 « L'économie » : Jackpot du serveur de la Foire du Trool (choix 28C).
-- Appliqué automatiquement par le workflow « Serveur en ligne » ; relançable sans danger : ne supprime ni ne modifie
-- aucune donnée de joueur.
--
-- Un ticket coûte 10 000 kamas : 9 000 vont au pot de l'heure, 1 000 sortent du jeu. Tickets illimités depuis la 1.0.32.6
-- (Mathis, 14/10/2026 : « ticket illimité pour le jackpot ») ; avant, 100 tickets par jour (heure de
-- Paris) et par joueur au plus. À la fin de chaque heure, un gagnant est tiré au sort parmi les tickets de l'heure
-- (chaque ticket est une chance) et reçoit tout le pot.
-- Pas de tâche planifiée : le tirage d'une heure finie se fait au premier appel qui suit (foire_jackpot, que le jeu
-- appelle quand la page est ouverte ou quand le joueur a des tickets d'une heure finie, ou foire_jackpot_buy).
-- Les kamas passent comme ceux de l'Hôtel de vente (supabase/hdv.sql) : le serveur vérifie les kamas dans la partie en
-- ligne (hdv_save, hdv_kamas) et écrit des opérations (hdv_op) : −10 000 par ticket à l'achat, + le pot au gagnant.
-- Les Caisses du Trool, elles, se jouent dans la partie (js/foire.js) : elles ne passent pas par le serveur.
-- ============================================================================
create table if not exists public.foire_tickets (
  hour timestamptz not null,               -- début de l'heure du tirage
  user_id uuid not null references auth.users (id) on delete cascade,
  n int not null default 0,                -- tickets de ce joueur pour cette heure
  day date not null,                       -- jour (heure de Paris) de l'achat, pour la limite de 100 par jour
  primary key (hour, user_id)
);
create index if not exists foire_tickets_user on public.foire_tickets (user_id, day);
alter table public.foire_tickets enable row level security;

create table if not exists public.foire_draws (
  hour timestamptz primary key,
  pot bigint not null default 0,
  tickets int not null default 0,
  players int not null default 0,
  winner uuid,
  pseudo text,
  at timestamptz not null default now()
);
alter table public.foire_draws enable row level security;

-- Tire au sort les heures finies qui n'ont pas encore de gagnant (verrou exclusif : un seul tirage à la fois ;
-- les achats prennent le même verrou en partage, un tirage attend donc les achats en cours).
create or replace function public.foire_resolve() returns void language plpgsql security definer set search_path = public
as $$
declare H timestamptz; tot bigint; pl int; w uuid; ps text; done int;
begin
  if not exists (select 1 from foire_tickets t where t.hour < date_trunc('hour', clock_timestamp())
      and not exists (select 1 from foire_draws d where d.hour = t.hour)) then return; end if;
  perform pg_advisory_xact_lock(hashtext('foire_draw'));
  for H in select distinct t.hour from foire_tickets t where t.hour < date_trunc('hour', clock_timestamp())
      and not exists (select 1 from foire_draws d where d.hour = t.hour) order by 1 limit 48 loop
    select coalesce(sum(n), 0), count(*) filter (where n > 0) into tot, pl from foire_tickets where hour = H;
    w := null; ps := null;
    if tot > 0 then
      -- tirage pondéré : chaque ticket est une chance (course d'exponentielles)
      select user_id into w from foire_tickets where hour = H and n > 0 order by -ln(1 - random()) / n limit 1;
      select pseudo into ps from profiles where id = w;
    end if;
    insert into foire_draws (hour, pot, tickets, players, winner, pseudo) values (H, tot * 9000, tot, pl, w, ps) on conflict (hour) do nothing;
    get diagnostics done = row_count;
    if done = 1 and w is not null then
      perform hdv_op(w, jsonb_build_object('k', tot * 9000, 'jack', 1),
        'Jackpot du Trool : tu remportes le pot de ' || replace(to_char(tot * 9000, 'FM999,999,999,999'), ',', ' ') || ' kamas (' || tot || ' tickets) !');
      -- 1.0.30.6 « Grande annonce du Jackpot » : tout le serveur voit le gagnant en plein écran (js/giga.js), puis la ligne
      -- reste dans le chat Général. Seulement pour un tirage récent (pas pour une vieille heure tirée en retard).
      if H >= date_trunc('hour', clock_timestamp()) - interval '2 hours' then
        insert into chat_msgs (ch, user_id, pseudo, kind, data) values ('g', w, ps, 'ann',
          jsonb_build_object('t', 'jack', 'k', tot * 9000, 'n', tot, 'pl', pl, 'h', floor(extract(epoch from H) * 1000)));
      end if;
    end if;
  end loop;
end $$;

-- État du Jackpot : { hour, end (ms), pot, tickets, players, mine (mes tickets de l'heure), day (mes tickets du jour),
-- max, last: [{ p, k, n, h }] (derniers gagnants), wait: [heures finies où j'ai des tickets pas encore tirées] }
create or replace function public.foire_state(p_user uuid) returns jsonb language plpgsql security definer set search_path = public
as $$
declare H timestamptz := date_trunc('hour', clock_timestamp()); dd date := (clock_timestamp() at time zone 'Europe/Paris')::date;
begin
  return jsonb_build_object(
    'hour', floor(extract(epoch from H) * 1000), 'end', floor(extract(epoch from H + interval '1 hour') * 1000),
    'now', floor(extract(epoch from clock_timestamp()) * 1000),
    'pot', coalesce((select sum(n) from foire_tickets where hour = H), 0) * 9000,
    'tickets', coalesce((select sum(n) from foire_tickets where hour = H), 0),
    'players', (select count(*) from foire_tickets where hour = H and n > 0),
    'mine', coalesce((select n from foire_tickets where hour = H and user_id = p_user), 0),
    'day', coalesce((select sum(n) from foire_tickets where user_id = p_user and day = dd), 0),
    'max', 0, -- 0 : pas de limite (1.0.32.6)
    'last', coalesce((select jsonb_agg(jsonb_build_object('p', coalesce(pseudo, '?'), 'k', pot, 'n', tickets, 'h', floor(extract(epoch from hour) * 1000), 'me', winner = p_user) order by hour desc)
      from (select * from foire_draws where winner is not null order by hour desc limit 6) x), '[]'::jsonb));
end $$;

-- ---------- fonctions appelées par le jeu ----------
-- Lire le Jackpot (tire au sort les heures finies au passage). Sans compte : le pot et les derniers gagnants.
create or replace function public.foire_jackpot() returns jsonb language plpgsql security definer set search_path = public
as $$
begin
  perform foire_resolve();
  return foire_state(auth.uid());
end $$;

-- Acheter p_n tickets (1 à 100 d'un coup, sans limite par jour depuis la 1.0.32.6) pour le tirage de l'heure.
create or replace function public.foire_jackpot_buy(p_after bigint, p_n int) returns jsonb language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid(); d jsonb; n int := coalesce(p_n, 0); H timestamptz; dd date;
begin
  begin d := hdv_save(me); exception when raise_exception then return hdv_err(replace(sqlerrm, 'l''hôtel de vente', 'le Jackpot')); end;
  perform pg_advisory_xact_lock(hashtext('hdv' || me::text));
  if n < 1 or n > 100 then return hdv_err('De 1 à 100 tickets d''un coup.'); end if;
  perform foire_resolve();
  perform pg_advisory_xact_lock_shared(hashtext('foire_draw'));
  H := date_trunc('hour', clock_timestamp()); dd := (clock_timestamp() at time zone 'Europe/Paris')::date;
  if hdv_kamas(me, d) < n * 10000 then return hdv_err('Pas assez de kamas (ou ta partie en ligne n''est pas encore à jour : attends quelques secondes).'); end if;
  insert into foire_tickets as x (hour, user_id, n, day) values (H, me, n, dd)
    on conflict (hour, user_id) do update set n = x.n + excluded.n;
  perform hdv_op(me, jsonb_build_object('k', -n * 10000, 'jt', n),
    'Jackpot du Trool : ' || n || ' ticket' || case when n > 1 then 's' else '' end || ' pour ' || replace(to_char(n * 10000, 'FM999,999,999'), ',', ' ') || ' kamas');
  return foire_state(me) || jsonb_build_object('ok', true, 'ops', hdv_ops_after(me, p_after));
end $$;

-- ---------- droits ----------
do $$
begin
  execute 'revoke all on function public.foire_resolve() from public, anon, authenticated';
  execute 'revoke all on function public.foire_state(uuid) from public, anon, authenticated';
  execute 'revoke all on function public.foire_jackpot() from public';
  execute 'grant execute on function public.foire_jackpot() to anon, authenticated';
  execute 'revoke all on function public.foire_jackpot_buy(bigint, int) from public, anon';
  execute 'grant execute on function public.foire_jackpot_buy(bigint, int) to authenticated';
end $$;
