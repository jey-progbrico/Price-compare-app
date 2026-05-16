-- Migration : Sécurisation des Contraintes Multi-Tenant (Correction Upsert)
-- Date : 2026-05-16
-- Objectif : Remplacer les index expressionnels par des contraintes UNIQUE strictes
-- requises par PostgREST pour le fonctionnement des ON CONFLICT (upsert).

-- 1. Table PRODUITS
DO $$ 
BEGIN
    -- Suppression de l'ancienne contrainte simple (si existante)
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'produits' AND indexname = 'produits_numero_ean_key') THEN
        ALTER TABLE produits DROP CONSTRAINT produits_numero_ean_key;
    END IF;

    -- Suppression de l'index expressionnel défaillant (s'il avait été créé)
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_produits_ean_store' AND n.nspname = 'public') THEN
        DROP INDEX public.idx_produits_ean_store;
    END IF;
END $$;

-- Création de la contrainte UNIQUE stricte
ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_numero_ean_store_id_key;
ALTER TABLE produits ADD CONSTRAINT produits_numero_ean_store_id_key UNIQUE (numero_ean, store_id);


-- 2. Table CACHE_PRIX
DO $$ 
BEGIN
    -- Suppression de l'ancienne contrainte simple
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'cache_prix' AND indexname = 'cache_prix_ean_enseigne_key') THEN
        ALTER TABLE cache_prix DROP CONSTRAINT cache_prix_ean_enseigne_key;
    END IF;

    -- Suppression de l'index expressionnel défaillant (s'il avait été créé)
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_cache_prix_ean_enseigne_store' AND n.nspname = 'public') THEN
        DROP INDEX public.idx_cache_prix_ean_enseigne_store;
    END IF;
END $$;

-- Création de la contrainte UNIQUE stricte
ALTER TABLE cache_prix DROP CONSTRAINT IF EXISTS cache_prix_ean_enseigne_store_id_key;
ALTER TABLE cache_prix ADD CONSTRAINT cache_prix_ean_enseigne_store_id_key UNIQUE (ean, enseigne, store_id);

-- Documentation
COMMENT ON CONSTRAINT produits_numero_ean_store_id_key ON produits IS 'Contrainte multi-tenant : Un EAN est unique au sein d''un même magasin.';
COMMENT ON CONSTRAINT cache_prix_ean_enseigne_store_id_key ON cache_prix IS 'Contrainte multi-tenant : L''historique de recherche (cache) est propre à chaque magasin.';
