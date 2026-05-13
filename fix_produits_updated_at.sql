-- ============================================================
-- Correction Technique : Ajout de updated_at à la table produits
-- Résout l'erreur : record "new" has no field "updated_at"
-- ============================================================

-- 1. Ajout de la colonne manquante
ALTER TABLE produits 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Initialisation des données existantes
UPDATE produits 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Commentaire de sécurité
COMMENT ON COLUMN produits.updated_at IS 'Date de dernière modification, requise par les triggers de synchronisation.';
