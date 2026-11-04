-- Idlus · annonces par serveur (2.2.4, refonte du Panel Xener, choix 3A). Appliqué après chat.sql par « Serveur en ligne »
-- (ajouté à sa liste le 04/11 sur les mots de Mathis : « installe les annonces par serveur sur le serveur »).
-- Relançable sans danger. Test : tests/annonce_srv_sql.test.js
-- 04/11 (refonte du Panel Xener, choix 3A « une seule page Annoncer ») : annonce sur les serveurs cochés, p_srv = 'e' (Éternel),
-- 's' (Classique · Saison 1), 'm' (Monocompte), séparés par des virgules. Bandeau : srv null si les trois (comme adm_announce), sinon
-- la liste ('e,s', 's', 'm'…) que le jeu compare au serveur de la partie ; message dans les salons des serveurs cochés ('g' = Éternel).
create or replace function public.adm_announce_srv(p_body text, p_banner boolean, p_chat boolean, p_hours int, p_srv text) returns void language plpgsql security definer set search_path = public
as $$ declare b text := left(btrim(coalesce(p_body, '')), 300);
  s text[] := array(select x from unnest(array['e', 's', 'm']) x where x = any(string_to_array(replace(coalesce(p_srv, ''), ' ', ''), ','))); begin
  perform public.adm_need(true);
  if b = '' then raise exception 'annonce vide'; end if;
  if cardinality(s) = 0 then raise exception 'aucun serveur choisi'; end if;
  if p_banner then insert into announces (body, banner, until, srv) values (b, true, case when p_hours > 0 then now() + make_interval(hours => p_hours) end, case when cardinality(s) = 3 then null else array_to_string(s, ',') end); end if;
  if p_chat then insert into chat_msgs (ch, user_id, pseudo, kind, body, data) select case c when 'e' then 'g' else c end, auth.uid(), public.pseudo_of(auth.uid()), 'ann', b, jsonb_build_object('t', 'admin', 'banner', p_banner) from unnest(s) c; end if;
  perform public.alog(format('annonce publiée (%s) : « %s »', array_to_string(s, ','), left(b, 60)));
end $$;
do $$ begin
  revoke all on function public.adm_announce_srv(text, boolean, boolean, int, text) from public, anon;
  grant execute on function public.adm_announce_srv(text, boolean, boolean, int, text) to authenticated;
end $$;
