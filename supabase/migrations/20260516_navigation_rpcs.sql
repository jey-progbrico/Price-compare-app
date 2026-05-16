-- Migration : Optimisation de la navigation catalogue (Rayons et Groupes)
-- Date : 2026-05-16

-- 1. Récupérer uniquement les noms de rayons uniques
-- On délègue le tri au SQL, beaucoup plus performant
CREATE OR REPLACE FUNCTION get_unique_rayons(p_store_id text DEFAULT NULL)
RETURNS TABLE (rayon_name text) AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT rayon 
  FROM produits 
  WHERE rayon IS NOT NULL
  ORDER BY rayon ASC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Récupérer uniquement les noms de groupes uniques pour un rayon
CREATE OR REPLACE FUNCTION get_unique_groups(p_rayon_name text, p_store_id text DEFAULT NULL)
RETURNS TABLE (group_name text) AS $$
BEGIN
  RETURN QUERY 
  SELECT DISTINCT groupe_produit
  FROM produits 
  WHERE rayon = p_rayon_name 
    AND groupe_produit IS NOT NULL
  ORDER BY groupe_produit ASC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 3. Index de performance pour les jointures et tris de navigation
-- Accélère massivement le DISTINCT et le filtrage par rayon
CREATE INDEX IF NOT EXISTS idx_produits_navigation ON produits(rayon, groupe_produit);
