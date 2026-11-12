-- ============================================================================
-- Idlus 3.0 — fermeture de l'Hôtel de vente (2B de Mathis, 12/11/2026 : « on enlève définitivement l'hdv », annonces rendues).
-- À lancer UNE fois, au moment de publier la 3.0 (workflow « Serveur OVH », étape « hdv-fermer », avec une sauvegarde) :
--   1. pose le drapeau public.hdv_ferme (hdv_list, hdv_buy, hdv_reprice, hdv_order_new, hdv_order_fill refusent ensuite) ;
--   2. chaque annonce ouverte revient au sac de son vendeur (même opération qu'un retrait : hdv_back) ;
--   3. chaque offre d'achat ouverte est close et ses kamas restants rendus (hdv_order_close).
-- Les opérations arrivent dans la partie au prochain hdv_sync, comme une vente. Relançable : il ne reste alors rien d'ouvert.
-- Lancé avec search_path = public (Éternel), puis s1, public (Saison 1).
-- ============================================================================
insert into hdv_ferme (id) values (1) on conflict do nothing;
do $$
declare L hdv_listings; O hdv_orders; nl int := 0; no int := 0;
begin
  for L in select * from hdv_listings where status = 'open' order by id for update loop
    perform pg_advisory_xact_lock(hashtext('hdv' || L.seller::text));
    update hdv_listings set status = 'gone', closed_at = now() where id = L.id;
    perform hdv_op(L.seller, hdv_back(L), 'L''Hôtel de vente ferme avec Idlus 3.0 : ' || L.name || case when L.qty > 1 then ' ×' || L.qty else '' end || ' revenu dans ton sac');
    nl := nl + 1;
  end loop;
  for O in select * from hdv_orders where status = 'open' order by id for update loop
    perform pg_advisory_xact_lock(hashtext('hdv' || O.buyer::text));
    perform hdv_order_close(O, 'gone', 'L''Hôtel de vente ferme avec Idlus 3.0');
    no := no + 1;
  end loop;
  raise notice 'HdV fermé : % annonces rendues, % offres d''achat closes', nl, no;
end $$;
