-- Migration : Isolation SaaS Dashboard et KPIs (Phase 2)
-- Date : 2026-05-16
-- Objectif : Propager store_id sur les tables de flux et isoler les statistiques.

-- 1. Propagation de store_id sur les tables orphelines
ALTER TABLE historique_activites ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE support_conversations ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
-- Note: support_messages est isolé par sa conversation_id, mais on pourrait ajouter store_id pour perf.
-- cache_prix : Mutualisé ou Isolé ? On choisit l'isolation pour le métier SaaS.
ALTER TABLE cache_prix ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);

-- 2. Indexation pour la performance multi-tenant
CREATE INDEX IF NOT EXISTS idx_activities_store_id ON historique_activites(store_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_store_id ON support_conversations(store_id);
CREATE INDEX IF NOT EXISTS idx_cache_prix_store_id ON cache_prix(store_id);

-- 3. Migration initiale des données vers le store par défaut (C030)
DO $$ 
DECLARE
    v_store_id uuid;
BEGIN
    SELECT id INTO v_store_id FROM stores WHERE code_magasin = 'C030';
    
    UPDATE historique_activites SET store_id = v_store_id WHERE store_id IS NULL;
    UPDATE support_conversations SET store_id = v_store_id WHERE store_id IS NULL;
    UPDATE cache_prix SET store_id = v_store_id WHERE store_id IS NULL;
END $$;

-- 4. Mise à jour de la RPC get_dashboard_stats pour le filtrage SaaS
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_store_id uuid DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Si p_store_id est fourni, on filtre. Sinon (Platform Admin), on agrège tout.
  SELECT json_build_object(
    'total_produits', (
        SELECT count(*) FROM produits 
        WHERE (p_store_id IS NULL OR store_id = p_store_id)
    ),
    'total_releves', (
        SELECT count(*) FROM releves_prix 
        WHERE (p_store_id IS NULL OR store_id = p_store_id)
    ),
    'total_rayons', (
        SELECT count(DISTINCT rayon) FROM produits 
        WHERE rayon IS NOT NULL 
        AND (p_store_id IS NULL OR store_id = p_store_id)
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
