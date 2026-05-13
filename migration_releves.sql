-- ============================================================
-- Création de la table releves_prix
-- Pour l'assistant de veille concurrentielle semi-manuel
-- ============================================================

CREATE TABLE IF NOT EXISTS releves_prix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ean TEXT NOT NULL,
  designation_originale TEXT,
  designation_normalisee TEXT,
  enseigne TEXT NOT NULL,
  url TEXT NOT NULL,
  prix_constate NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer la récupération par produit
CREATE INDEX IF NOT EXISTS idx_releves_prix_ean ON releves_prix(ean);

-- Commentaire pour la table
COMMENT ON TABLE releves_prix IS 'Historique des relevés de prix concurrents saisis manuellement par les utilisateurs.';
