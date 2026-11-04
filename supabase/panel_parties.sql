-- Idlus · Panel Xener, parties des joueurs sur les trois serveurs (2.2.4.4, Mathis 04/11 : « y'a plein de parties que je ne vois
-- pas dans les panels », réponse « les deux »). Lecture seule : ne crée aucune table et ne change aucune donnée.
-- adm_parties(p_srv, p_ids) : pour chaque compte, sa partie Éternel (public.saves, public.ladder), Classique · Saison 1
-- (s1.saves, s1.ladder) et Monocompte (mono.parties, niveau de mono.parties_ok de la même saison) : niveau et dernier envoi.
--   p_ids donné : ces comptes-là (la liste « Comptes » du panel) ;
--   sinon : les comptes qui ont une partie sur le serveur p_srv ('e', 's' ou 'm'), du dernier envoi au plus ancien (150 au plus).
-- Les espaces s1 et mono absents (base de test) comptent comme vides. Installé par l'étape « panel-parties » de Serveur OVH.
create or replace function public.adm_parties(p_srv text, p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path = public
as $$ declare
  s1 boolean := to_regclass('s1.saves') is not null and to_regclass('s1.ladder') is not null;
  mo boolean := to_regclass('mono.parties') is not null and to_regclass('mono.parties_ok') is not null;
  k text := case when p_srv in ('s', 'm') then p_srv else 'e' end;
  q text; r jsonb;
begin
  perform public.adm_need(true);
  q := 'select coalesce(jsonb_agg(x), ''[]''::jsonb) from (select p.id, p.pseudo, l.main cls, l.level e_lvl, sv.updated_at e_at, '
    || case when s1 then 'sl.level s_lvl, ss.updated_at s_at, ' else 'null::int s_lvl, null::timestamptz s_at, ' end
    || case when mo then 'mp.lvl m_lvl, mp.at m_at ' else 'null::int m_lvl, null::timestamptz m_at ' end
    || 'from public.profiles p left join public.ladder l on l.user_id = p.id left join public.saves sv on sv.user_id = p.id '
    || case when s1 then 'left join s1.ladder sl on sl.user_id = p.id left join s1.saves ss on ss.user_id = p.id ' else '' end
    || case when mo then 'left join lateral (select x.updated_at at, (select case when jsonb_typeof(o.resume -> ''niveau'') = ''number'' then (o.resume ->> ''niveau'')::numeric::int end
         from mono.parties_ok o where o.user_id = x.user_id and o.saison = x.saison) lvl from mono.parties x where x.user_id = p.id order by x.saison desc limit 1) mp on true ' else '' end
    || 'where case when $1 is not null then p.id = any($1) else '
    || case k when 's' then case when s1 then 'ss.updated_at is not null' else 'false' end
              when 'm' then case when mo then 'mp.at is not null' else 'false' end
              else 'sv.updated_at is not null' end
    || ' end order by ' || k || '_at desc nulls last, p.created_at desc limit 150) x';
  execute q into r using p_ids;
  return r;
end $$;
do $$ begin
  revoke all on function public.adm_parties(text, uuid[]) from public, anon;
  grant execute on function public.adm_parties(text, uuid[]) to authenticated;
end $$;
