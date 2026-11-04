#!/bin/bash
# Lecture seule (04/11/2026) : qui renouvelle sa session en boucle, depuis quand, à quel rythme, avec quel navigateur.
# Rien n'est modifié ni coupé. Les adresses IP et e-mails ne sont jamais affichés (seulement leur nombre).
# Lancé par le workflow « Serveur OVH », étape boucle-enquete.
set -uo pipefail
q() { echo "== $1"; bash tools/serveur/vps_sql.sh lecture "$2" | python3 -c 'import json,sys
for r in json.load(sys.stdin): print(json.dumps(r, ensure_ascii=False))'; }
q "Sessions les plus actives (60 min)" "select rt.session_id::text sid, public.pseudo_of(rt.user_id::uuid) pseudo, count(*) n, min(rt.created_at) premier, max(rt.created_at) dernier,
  count(distinct rt.parent) parents, s.created_at sess_creee, s.refreshed_at, s.not_after, s.user_agent, (select count(*) from auth.sessions s2 where s2.user_id = s.user_id) sessions_du_compte
  from auth.refresh_tokens rt left join auth.sessions s on s.id = rt.session_id where rt.created_at > now() - interval '60 minutes' group by rt.session_id, rt.user_id, s.id order by n desc limit 5"
q "Session la plus active par heure (depuis 04/11 00 h UTC)" "with h as (select date_trunc('hour', created_at) h, session_id, count(*) n from auth.refresh_tokens where created_at > '2026-11-04 00:00+00' group by 1, 2),
  r as (select *, row_number() over (partition by h order by n desc) k from h) select h, session_id::text sid, n from r where k <= 2 order by h"
q "Rythme de la session la plus active (écarts entre deux renouvellements, 15 min)" "with s as (select session_id from auth.refresh_tokens where created_at > now() - interval '15 minutes' group by 1 order by count(*) desc limit 1),
  t as (select created_at, extract(epoch from created_at - lag(created_at) over (order by id)) d, parent, revoked from auth.refresh_tokens where session_id = (select session_id from s) and created_at > now() - interval '15 minutes')
  select count(*) n, round(min(d)::numeric, 3) mini, round((percentile_cont(0.5) within group (order by d))::numeric, 3) mediane, round(max(d)::numeric, 3) maxi,
  count(*) filter (where d < 0.2) rafales, count(*) - count(distinct parent) parents_reutilises, count(*) filter (where not revoked) non_revoques from t"
q "Par minute, session la plus active (30 dernières min)" "with s as (select session_id from auth.refresh_tokens where created_at > now() - interval '15 minutes' group by 1 order by count(*) desc limit 1)
  select to_char(date_trunc('minute', created_at), 'HH24:MI') m, count(*) n from auth.refresh_tokens where session_id = (select session_id from s) and created_at > now() - interval '30 minutes' group by 1 order by 1"
q "Journal d'audit du compte le plus actif (60 min) : actions, nb d'adresses IP" "with s as (select user_id from auth.refresh_tokens where created_at > now() - interval '15 minutes' group by 1 order by count(*) desc limit 1)
  select payload->>'action' action, count(*) n, count(distinct ip_address) ips, min(created_at) premier, max(created_at) dernier from auth.audit_log_entries
  where created_at > now() - interval '60 minutes' and payload->>'actor_id' = (select user_id from s) group by 1 order by n desc"
U="(select user_id::uuid from auth.refresh_tokens where created_at > now() - interval '15 minutes' group by 1 order by count(*) desc limit 1)"
for t in public.saves s1.saves; do
  q "Partie $t du compte le plus actif (sans contenu ; heure de l'appareil = savedAt)" "select to_jsonb(x) - 'data' meta, (x.data::jsonb)->>'v' v, to_timestamp(((x.data::jsonb)->>'savedAt')::bigint / 1000.0) saved_at_appareil,
    to_timestamp(((x.data::jsonb)->>'lastTick')::bigint / 1000.0) last_tick from $t x where x.user_id = $U"
done
q "Partie Monocompte du compte le plus actif" "select to_jsonb(x) - 'data' meta, to_timestamp(((x.data::jsonb)->>'savedAt')::bigint / 1000.0) saved_at_appareil from mono.parties x where x.user_id = $U order by saison desc limit 1"
q "Bouclier (3 serveurs, 7 jours) du compte le plus actif" "select 'public' sv, why, at from public.bouclier_log where user_id = $U and at > now() - interval '7 days'
  union all select 's1', why, at from s1.bouclier_log where user_id = $U and at > now() - interval '7 days' union all select 'mono', why, at from mono.bouclier where user_id = $U and at > now() - interval '7 days' order by at desc limit 25"
q "Sessions du compte" "select id::text, created_at, refreshed_at, user_agent, (select count(*) from auth.refresh_tokens r where r.session_id = s.id) jetons from auth.sessions s where s.user_id = $U"
q "Autres comptes : sessions qui ont renouvelé plus de 30 fois une heure donnée (7 jours)" "select public.pseudo_of(user_id::uuid) pseudo, date_trunc('hour', created_at) h, count(*) n from auth.refresh_tokens
  where created_at > now() - interval '7 days' and user_id::uuid <> $U group by 1, 2 having count(*) > 30 order by 2"
echo "== Auth : un renouvellement d'un autre joueur, pour comparer (referer)"
bash tools/serveur/vps_sql.sh commande "docker logs --since 3h supabase-auth 2>&1 | grep 'grant_type\":\"refresh_token' | grep -v 752fc072 | tail -3" | sed -E 's/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/<ip>/g; s/"(actor_name|actor_username|actor_id)":"[^"]*"/"\1":"-"/g' || true
echo "== Auth : appels autres que /token du compte qui boucle (5 min)"
bash tools/serveur/vps_sql.sh commande "docker logs --since 5m supabase-auth 2>&1 | grep 752fc072 | grep -v '\"path\":\"/token\"' | grep -v audit_event | tail -5" | sed -E 's/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/<ip>/g' || true
echo "== Auth (GoTrue) : derniers messages de renouvellement (IP retirées)"
bash tools/serveur/vps_sql.sh commande "docker logs --since 5m supabase-auth 2>&1 | grep -i refresh | tail -8" | sed -E 's/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/<ip>/g; s/[0-9a-f:]{15,}/<ip6>/g; s/"(email|actor_username|referer)":"[^"]*"/"\1":"-"/g' || true
