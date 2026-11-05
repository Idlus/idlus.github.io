select data->>'t' typ, coalesce(data->>'srv', '?') srv, count(*) annonces,
  count(distinct (user_id::text || coalesce(data->>'cls', '') || coalesce(data->>'name', '') || coalesce(data->>'id', '') || coalesce(data->>'n', ''))) uniques
from public.chat_msgs where kind = 'ann' and data->>'t' in ('lvl200', 'ren', 'dofus', 'dsub', 'first', 'chroma', 'mrare') group by 1, 2 order by 1, 2
