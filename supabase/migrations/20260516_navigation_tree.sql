-- Migration : Arbre de navigation complet pour résolution rapide
-- Date : 2026-05-16

-- Cette fonction permet de récupérer toutes les paires Rayon/Groupe existantes
-- Elle est utilisée pour résoudre les noms réels depuis les slugs en un seul appel.
CREATE OR REPLACE FUNCTION get_navigation_tree(p_store_id text DEFAULT NULL)
RETURNS TABLE (rayon_name text, group_name text) AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT rayon, groupe_produit 
  FROM produits 
  WHERE rayon IS NOT NULL AND groupe_produit IS NOT NULL
  ORDER BY rayon ASC, groupe_produit ASC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
