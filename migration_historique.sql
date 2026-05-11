-- ============================================================
-- Migration Historique — Vigiprix
-- Date : 2026-05-11
-- Description : Colonnes et index pour la page /historique
-- À exécuter dans l'éditeur SQL Supabase (idempotent).
-- ============================================================

-- 1. Ajouter created_at sur produits si absent
-- ─────────────────────────────────────────────────────────────
ALTER TABLE produits
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Remplir created_at pour les produits existants (approx)
UPDATE produits
  SET created_at = NOW()
  WHERE created_at IS NULL;

-- 2. Index pour la page historique
-- ─────────────────────────────────────────────────────────────

-- Tri du plus récent au plus ancien
CREATE INDEX IF NOT EXISTS idx_produits_created_at
  ON produits(created_at DESC);

-- Recherche par EAN (déjà PK probable, mais au cas où)
CREATE INDEX IF NOT EXISTS idx_produits_numero_ean
  ON produits(numero_ean);

-- Index pour le join produits ← cache_prix
CREATE INDEX IF NOT EXISTS idx_cache_prix_ean
  ON cache_prix(ean);

-- Index pour trier les prix concurrents par fraîcheur
CREATE INDEX IF NOT EXISTS idx_cache_prix_ean_updated
  ON cache_prix(ean, updated_at DESC);

-- 3. Vérification
-- ─────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'produits'
ORDER BY ordinal_position;
