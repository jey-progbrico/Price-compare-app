-- Migration : Optimisation des statistiques du Dashboard
-- Date : 2026-05-16

-- 1. Création de la fonction RPC optimisée avec support SaaS
-- Utilisation de SECURITY INVOKER pour respecter le RLS
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_store_id text DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Note : Le paramètre p_store_id est prévu pour l'évolution SaaS.
  -- Pour l'instant, SECURITY INVOKER assure que l'utilisateur ne voit que ses données.
  SELECT json_build_object(
    'total_produits', (SELECT count(*) FROM produits),
    'total_releves', (SELECT count(*) FROM releves_prix),
    'total_rayons', (SELECT count(DISTINCT rayon) FROM produits WHERE rayon IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 2. Index crucial pour la performance du comptage des rayons
CREATE INDEX IF NOT EXISTS idx_produits_rayon ON produits(rayon);
