-- 28/10/2026 23:17 UTC, ordre écrit de Mathis : « ban ces deux comptes » (aife et Chizoumi, parties modifiées).
-- Même effet que le bouton « Définitive » du panel (public.adm_suspend(p_user, true, null)), lancé depuis le serveur.
begin;
do $$ declare n int; r record; begin
  select count(*) into n from public.profiles where pseudo in ('aife', 'Chizoumi');
  if n <> 2 then raise exception 'attendu 2 comptes, trouvé %', n; end if;
  for r in select id, pseudo from public.profiles where pseudo in ('aife', 'Chizoumi') loop
    if exists (select 1 from public.admins where user_id = r.id) then raise exception 'impossible sur un admin'; end if;
    update public.profiles set suspended_at = now(), suspended_until = null where id = r.id;
    update public.ladder set flagged = true, flag_reason = 'compte suspendu' where user_id = r.id;
    perform public.alog(format('compte de %s suspendu', r.pseudo));
    raise notice 'suspendu : %', r.pseudo;
  end loop;
end $$;
select pseudo, suspended_at is not null as suspendu, suspended_until from public.profiles where pseudo in ('aife', 'Chizoumi');
commit;
