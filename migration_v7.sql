-- ============================================================
-- Migration V7 — Refactor Moteur Recherche Vigiprix
-- Date : 2026-05-10
-- Description : Ajout des nouvelles colonnes au cache_prix
--               pour supporter l'architecture Google CSE +
--               historique prix + monitoring sources.
-- ============================================================
-- IMPORTANT : À exécuter dans l'éditeur SQL Supabase
-- ou via psql. Script idempotent (safe à re-exécuter).
-- ============================================================

-- 1. Nouvelles colonnes cache_prix
-- ─────────────────────────────────────────────────────────────
ALTER TABLE cache_prix
  ADD COLUMN IF NOT EXISTS last_searched_at  TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_success_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source            VARCHAR(50) DEFAULT 'scraper',
  ADD COLUMN IF NOT EXISTS image_url         TEXT,
  ADD COLUMN IF NOT EXISTS reliability_score FLOAT      DEFAULT 1.0;

-- Initialiser last_success_at pour les entrées existantes
UPDATE cache_prix
  SET last_success_at = updated_at
  WHERE last_success_at IS NULL AND prix IS NOT NULL;

-- 2. Index pour les requêtes fréquentes
-- ─────────────────────────────────────────────────────────────
-- Index principal pour la vérification cache (ean + fraîcheur)
CREATE INDEX IF NOT EXISTS idx_cache_prix_ean_updated
  ON cache_prix(ean, updated_at DESC);

-- Index pour le monitoring par source
CREATE INDEX IF NOT EXISTS idx_cache_prix_source
  ON cache_prix(source);

-- 3. Vérification de la contrainte unique existante
-- ─────────────────────────────────────────────────────────────
-- La contrainte (ean, enseigne) doit exister pour les upserts
-- Si elle n'existe pas encore, la créer :
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cache_prix_ean_enseigne_key'
      AND conrelid = 'cache_prix'::regclass
  ) THEN
    ALTER TABLE cache_prix
      ADD CONSTRAINT cache_prix_ean_enseigne_key UNIQUE (ean, enseigne);
  END IF;
END $$;

-- 4. Vue utilitaire pour le monitoring
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_cache_monitoring AS
SELECT
  source,
  COUNT(*)                          AS total_entries,
  COUNT(CASE WHEN prix IS NOT NULL THEN 1 END) AS entries_with_price,
  AVG(prix)                         AS avg_price,
  MAX(updated_at)                   AS last_updated,
  AVG(reliability_score)            AS avg_reliability,
  -- Entrées fraîches (< 7 jours)
  COUNT(CASE WHEN updated_at > NOW() - INTERVAL '7 days' THEN 1 END) AS fresh_entries,
  -- Entrées stales (7–30 jours)
  COUNT(CASE WHEN updated_at BETWEEN NOW() - INTERVAL '30 days'
                                  AND NOW() - INTERVAL '7 days' THEN 1 END) AS stale_entries
FROM cache_prix
GROUP BY source
ORDER BY total_entries DESC;

-- 5. Nettoyage des anciennes entrées (> 30 jours, sans prix)
-- ─────────────────────────────────────────────────────────────
DELETE FROM cache_prix
  WHERE updated_at < NOW() - INTERVAL '30 days'
    AND prix IS NULL;

-- ============================================================
-- Vérification finale
-- ============================================================
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'cache_prix'
ORDER BY ordinal_position;
