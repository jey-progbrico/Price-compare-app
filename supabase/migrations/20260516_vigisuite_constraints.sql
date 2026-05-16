-- Migration : Sécurisation des Contraintes Multi-Tenant
-- Date : 2026-05-16
-- Objectif : Garantir que les doublons d'EAN sont autorisés entre magasins différents 
-- mais interdits au sein d'un même magasin.

-- 1. Table PRODUITS
-- Suppression de l'ancienne contrainte d'unicité sur numero_ean seul (si elle existe)
-- Note : Dans Supabase/PostgreSQL, numero_ean peut être UNIQUE via un index ou une contrainte.
DO $$ 
BEGIN
    -- On cherche l'index unique standard sur numero_ean pour le remplacer
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'produits' AND indexname = 'produits_numero_ean_key') THEN
        ALTER TABLE produits DROP CONSTRAINT produits_numero_ean_key;
    END IF;
END $$;

-- Création de la nouvelle contrainte composite (EAN + Store)
-- On utilise un index UNIQUE qui gère aussi le cas où store_id est NULL (vue globale plateforme)
CREATE UNIQUE INDEX IF NOT EXISTS idx_produits_ean_store ON produits (numero_ean, (COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)));


-- 2. Table CACHE_PRIX
-- La table cache_prix a souvent une contrainte sur (ean, enseigne). 
-- Pour le multi-tenant, on doit ajouter store_id dans l'équation.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'cache_prix' AND indexname = 'cache_prix_ean_enseigne_key') THEN
        ALTER TABLE cache_prix DROP CONSTRAINT cache_prix_ean_enseigne_key;
    END IF;
END $$;

-- Nouvelle contrainte composite pour le cache (EAN + Enseigne + Store)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_prix_ean_enseigne_store ON cache_prix (ean, enseigne, (COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)));


-- 3. Documentation
COMMENT ON INDEX idx_produits_ean_store IS 'Garantit l''unicité de l''EAN par magasin pour le multi-tenant.';
COMMENT ON INDEX idx_cache_prix_ean_enseigne_store IS 'Isole le cache des prix par magasin pour éviter les fuites de données concurrentielles.';
