-- 28/10/2026 23:17 UTC, ordre écrit de Mathis : « pour les autres relève le bouclier pour que ça arrête de les vérifier h24 ».
-- « C'est bon » du panel (public.adm_flag(p_user, false)) pour les deux comptes que le plafond de Maîtrise retenait : lucy8 et Gagou.
begin;
do $$ declare n int; r record; begin
  select count(*) into n from public.profiles where pseudo in ('lucy8', 'Gagou');
  if n <> 2 then raise exception 'attendu 2 comptes, trouvé %', n; end if;
  for r in select id, pseudo from public.profiles where pseudo in ('lucy8', 'Gagou') loop
    update public.ladder set flagged = false, suspect = false, flag_reason = null, verified = true where user_id = r.id;
    update public.saves_ok set accept = true where user_id = r.id;
    perform public.alog(format('%s remis dans les classements', r.pseudo));
  end loop;
end $$;
select p.pseudo, l.suspect, l.flagged, l.verified, o.accept from public.profiles p join public.ladder l on l.user_id = p.id join public.saves_ok o on o.user_id = p.id where p.pseudo in ('lucy8', 'Gagou');
commit;
