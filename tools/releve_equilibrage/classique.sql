select round(extract(epoch from now() - p.created_at) / 86400, 2) as age, round(extract(epoch from now() - s.updated_at) / 86400, 2) as inactif,
  x.d->'stats'->'playtime' as pt, x.d->'kamas' as k, x.d->'mono' is not null as mono,
  (select jsonb_agg(jsonb_build_object('l', c->'lvl', 'c', c->'cls', 't', c->'inTeam', 'm', c->'mt'->'lvl', 'x', c->'merc'))
     from jsonb_array_elements(case when jsonb_typeof(x.d->'chars') = 'array' then x.d->'chars' else '[]'::jsonb end) c) as h,
  (select jsonb_object_agg(e.key, e.value->'max') from jsonb_each(case when jsonb_typeof(x.d->'stasis') = 'object' then x.d->'stasis' else '{}'::jsonb end) e) as st,
  l.suspect, l.flagged
from public.saves s join public.profiles p on p.id = s.user_id
  cross join lateral (select s.data::jsonb as d) x
  left join public.ladder l on l.user_id = s.user_id
where s.data ~ '^\s*\{'
