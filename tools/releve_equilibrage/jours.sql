select md5(j.user_id::text) as u, j.day::text as j, j.lvl as l, j.kamas as k, (j.data::jsonb)->'stats'->'playtime' as pt
from public.saves_jour j where j.data ~ '^\s*\{'
