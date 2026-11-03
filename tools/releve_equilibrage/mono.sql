select 'saison' as genre, row_to_json(s)::jsonb as v from (select id, debut, etat, test, gen, remise from mono.saisons) s
union all
select 'partie', jsonb_build_object('saison', m.saison, 'maj', m.updated_at, 'pt', x.d->'stats'->'playtime', 'k', x.d->'kamas',
  'h', (select jsonb_agg(jsonb_build_object('l', c->'lvl', 'c', c->'cls', 'm', c->'mt'->'lvl', 'x', c->'merc'))
     from jsonb_array_elements(case when jsonb_typeof(x.d->'chars') = 'array' then x.d->'chars' else '[]'::jsonb end) c),
  'st', (select jsonb_object_agg(e.key, e.value->'max') from jsonb_each(case when jsonb_typeof(x.d->'stasis') = 'object' then x.d->'stasis' else '{}'::jsonb end) e))
from mono.parties m cross join lateral (select m.data::jsonb as d) x where m.data ~ '^\s*\{'
union all
select 'copie', jsonb_build_object('u', md5(c.user_id::text), 'saison', c.saison, 'jour', c.jour, 'pt', x.d->'stats'->'playtime', 'k', x.d->'kamas',
  'l', (select max((h->>'lvl')::int) from jsonb_array_elements(case when jsonb_typeof(x.d->'chars') = 'array' then x.d->'chars' else '[]'::jsonb end) h where coalesce(h->>'merc', '') in ('', 'false')),
  'm', (select max((h->'mt'->>'lvl')::int) from jsonb_array_elements(case when jsonb_typeof(x.d->'chars') = 'array' then x.d->'chars' else '[]'::jsonb end) h))
from mono.copies c cross join lateral (select c.data::jsonb as d) x where c.data ~ '^\s*\{'
