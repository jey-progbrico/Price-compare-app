-- Migration : Fondation Structurelle VigiSuite (Phase 1 Finalisée)
-- Date : 2026-05-16
-- Objectif : Mise en place des tables de stores et préparation SaaS multi-magasins.

-- 1. Création de la table des Magasins (Stores)
CREATE TABLE IF NOT EXISTS stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code_magasin text UNIQUE NOT NULL, -- Identifiant métier (ex: C030)
    nom text NOT NULL,
    enseigne text,
    store_type text DEFAULT 'magasin', -- magasin, demo, test, sandbox, plateforme
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(), -- Préparation évolutions SaaS
    
    CONSTRAINT check_store_type CHECK (store_type IN ('magasin', 'demo', 'test', 'sandbox', 'plateforme'))
);

-- Commentaire de documentation
COMMENT ON COLUMN stores.updated_at IS 'Date de dernière modification de la configuration du store ou des modules.';

-- 2. Création du premier Store (C030)
INSERT INTO stores (code_magasin, nom, enseigne, store_type)
VALUES ('C030', 'VigiPrix Centre C030', 'E.Leclerc', 'magasin')
ON CONFLICT (code_magasin) DO NOTHING;

-- 3. Mise à jour des Rôles (Gestion Platform Admin)
-- On conserve temporairement 'admin' pour éviter les régressions frontend.
-- 'admin' sera déprécié et supprimé au profit de 'platform_admin' dans une phase ultérieure.
DO $$ 
BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('utilisateur', 'adherant', 'admin', 'platform_admin'));
EXCEPTION
    WHEN undefined_table THEN 
        RAISE NOTICE 'Table profiles non trouvée, étape ignorée';
END $$;

-- 4. Ajout des colonnes store_id (NULLABLE pour ne pas casser l'existant)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE produits ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE releves_prix ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);

-- 5. Migration des données existantes et Promotion de l'utilisateur principal
DO $$ 
DECLARE
    v_store_id uuid;
BEGIN
    -- Récupération de l'ID technique du store C030
    SELECT id INTO v_store_id FROM stores WHERE code_magasin = 'C030';

    -- Lier toutes les données existantes au magasin C030
    UPDATE produits SET store_id = v_store_id WHERE store_id IS NULL;
    UPDATE profiles SET store_id = v_store_id WHERE store_id IS NULL;
    UPDATE releves_prix SET store_id = v_store_id WHERE store_id IS NULL;

    -- Promotion de l'utilisateur principal en Platform Admin (Super-Admin plateforme)
    UPDATE profiles 
    SET role = 'platform_admin'
    WHERE email = 'jeycourjeau@hotmail.fr';
END $$;

-- 6. Création d'index pour les futures requêtes filtrées par store
CREATE INDEX IF NOT EXISTS idx_produits_store_id ON produits(store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_releves_prix_store_id ON releves_prix(store_id);

-- 7. Trigger pour la mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
    BEFORE UPDATE ON stores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
