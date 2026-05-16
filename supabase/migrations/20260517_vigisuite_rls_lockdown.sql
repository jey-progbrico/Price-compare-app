-- ===================================================================================
-- VIGISUITE SAAS - LOCKDOWN FINAL RLS (Phases A, B, C)
-- Date: 2026-05-17
-- ===================================================================================

-- ===================================================================================
-- 0. HELPER FUNCTIONS (Anti-Récursion & Performances)
-- ===================================================================================
-- Ces fonctions SECURITY DEFINER permettent d'éviter les self-references (infinite recursion)
-- lors de la définition des politiques RLS, notamment sur la table `profiles`.

CREATE OR REPLACE FUNCTION get_my_store_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT store_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ===================================================================================
-- PHASE A : Gel des tables Legacy
-- ===================================================================================
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS statut_concurrents ENABLE ROW LEVEL SECURITY;

-- Suppression des éventuelles anciennes policies
DROP POLICY IF EXISTS "Settings access" ON settings;
DROP POLICY IF EXISTS "Status concurrence access" ON statut_concurrents;

-- Sans Policy = DENY ALL par défaut pour les clients. 
-- Les tables ne peuvent plus être accédées ni modifiées.


-- ===================================================================================
-- PHASE B : Sécurisation Plateforme (stores & profiles)
-- ===================================================================================
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ----- STORES -----
DROP POLICY IF EXISTS "Platform Admin full access stores" ON stores;
DROP POLICY IF EXISTS "Adherant view own store" ON stores;
DROP POLICY IF EXISTS "Adherant edit own store" ON stores;

-- Platform Admin (Tout)
CREATE POLICY "Platform Admin full access stores" ON stores FOR ALL TO authenticated USING (
    get_my_role() = 'platform_admin'
) WITH CHECK (
    get_my_role() = 'platform_admin'
);
-- Adhérent (Voir son store)
CREATE POLICY "Adherant view own store" ON stores FOR SELECT TO authenticated USING (
    id = get_my_store_id() AND get_my_role() = 'adherant'
);
-- Adhérent (Modifier son store - ex: settings JSONB)
CREATE POLICY "Adherant edit own store" ON stores FOR UPDATE TO authenticated USING (
    id = get_my_store_id() AND get_my_role() = 'adherant'
) WITH CHECK (
    id = get_my_store_id() AND get_my_role() = 'adherant'
);

-- ----- PROFILES -----
-- Suppression des éventuelles politiques conflictuelles (si existantes)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Platform Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Adherant select store profiles" ON profiles;
DROP POLICY IF EXISTS "Adherant update store profiles" ON profiles;
DROP POLICY IF EXISTS "Adherant delete store profiles" ON profiles;

-- Platform Admin (ALL)
CREATE POLICY "Platform Admin full access profiles" ON profiles FOR ALL TO authenticated USING (
    get_my_role() = 'platform_admin'
) WITH CHECK (
    get_my_role() = 'platform_admin'
);

-- Adhérent (SELECT) : voit son store
CREATE POLICY "Adherant select store profiles" ON profiles FOR SELECT TO authenticated USING (
    store_id = get_my_store_id() AND get_my_role() = 'adherant'
);

-- Adhérent (UPDATE) : modifie son store
CREATE POLICY "Adherant update store profiles" ON profiles FOR UPDATE TO authenticated USING (
    store_id = get_my_store_id() AND get_my_role() = 'adherant'
) WITH CHECK (
    store_id = get_my_store_id() AND get_my_role() = 'adherant'
);

-- Adhérent (DELETE) : supprime dans son store (sauf lui-même via trigger de sécu)
CREATE POLICY "Adherant delete store profiles" ON profiles FOR DELETE TO authenticated USING (
    store_id = get_my_store_id() AND get_my_role() = 'adherant'
);

-- PROTECTION MÉTIER DES RÔLES (TRIGGER)
CREATE OR REPLACE FUNCTION protect_profile_roles_and_escalation()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_role TEXT;
BEGIN
    -- Obtenir le rôle de la personne qui fait l'action
    SELECT role INTO v_actor_role FROM profiles WHERE id = auth.uid();
    
    -- Si ce n'est pas le platform_admin, on applique des restrictions
    IF v_actor_role != 'platform_admin' THEN
        
        -- UPDATE RESTRICTIONS
        IF TG_OP = 'UPDATE' THEN
            -- Interdire l'escalade de privilège
            IF NEW.role IN ('admin', 'platform_admin') AND OLD.role NOT IN ('admin', 'platform_admin') THEN
                 RAISE EXCEPTION 'Non autorisé : Escalade de privilèges interdite';
            END IF;
            -- Interdire la modification d'un admin
            IF OLD.role IN ('admin', 'platform_admin') THEN
                 RAISE EXCEPTION 'Non autorisé : Modification d''un profil administrateur interdite';
            END IF;
        END IF;

        -- DELETE RESTRICTIONS
        IF TG_OP = 'DELETE' THEN
            -- Interdire de supprimer un admin
            IF OLD.role IN ('admin', 'platform_admin') THEN
                 RAISE EXCEPTION 'Non autorisé : Suppression d''un profil administrateur interdite';
            END IF;
            -- Interdire l'auto-suppression pour éviter un compte orphelin
            IF OLD.id = auth.uid() THEN
                 RAISE EXCEPTION 'Non autorisé : Vous ne pouvez pas supprimer votre propre compte';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON profiles;
CREATE TRIGGER trg_protect_profile_roles
BEFORE UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_roles_and_escalation();


-- PROTECTION IMMUTABILITÉ DU STORE_ID (TRIGGER)
CREATE OR REPLACE FUNCTION protect_immutable_store_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Si le store_id tente d'être modifié
    IF NEW.store_id IS DISTINCT FROM OLD.store_id THEN
        -- Seul le platform_admin a le droit de déplacer une donnée entre magasins
        IF get_my_role() != 'platform_admin' THEN
            RAISE EXCEPTION 'Non autorisé : Le store_id est immuable pour votre rôle.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===================================================================================
-- PHASE C : Verrouillage Métier Global Granulaire
-- ===================================================================================
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE releves_prix ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_activites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_prix ENABLE ROW LEVEL SECURITY;

-- Nettoyage global des anciennes policies et triggers
DO $$ 
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['produits', 'releves_prix', 'historique_activites', 'cache_prix'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Platform Admin access" ON %I', v_table);
        EXECUTE format('DROP POLICY IF EXISTS "Store Manager access" ON %I', v_table);
        EXECUTE format('DROP POLICY IF EXISTS "Store access SELECT" ON %I', v_table);
        EXECUTE format('DROP POLICY IF EXISTS "Store access INSERT" ON %I', v_table);
        EXECUTE format('DROP POLICY IF EXISTS "Store access UPDATE" ON %I', v_table);
        EXECUTE format('DROP POLICY IF EXISTS "Store access DELETE" ON %I', v_table);
        
        -- Attacher le trigger d'immutabilité
        EXECUTE format('DROP TRIGGER IF EXISTS trg_protect_immutable_store_id ON %I', v_table);
        EXECUTE format('CREATE TRIGGER trg_protect_immutable_store_id BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION protect_immutable_store_id()', v_table);
    END LOOP;
END $$;

-- 1. PRODUITS & CACHE_PRIX (Gestion Catalogue)
DO $$ 
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['produits', 'cache_prix'] LOOP
        -- Platform Admin
        EXECUTE format('CREATE POLICY "Platform Admin access" ON %I FOR ALL TO authenticated USING (get_my_role() = ''platform_admin'') WITH CHECK (get_my_role() = ''platform_admin'')', v_table);
        -- SELECT : Tous (adherant, manager, utilisateur)
        EXECUTE format('CREATE POLICY "Store access SELECT" ON %I FOR SELECT TO authenticated USING (store_id = get_my_store_id())', v_table);
        -- INSERT / UPDATE : Adherant, Manager
        EXECUTE format('CREATE POLICY "Store access INSERT" ON %I FOR INSERT TO authenticated WITH CHECK (store_id = get_my_store_id() AND get_my_role() IN (''adherant'', ''manager''))', v_table);
        EXECUTE format('CREATE POLICY "Store access UPDATE" ON %I FOR UPDATE TO authenticated USING (store_id = get_my_store_id() AND get_my_role() IN (''adherant'', ''manager'')) WITH CHECK (store_id = get_my_store_id() AND get_my_role() IN (''adherant'', ''manager''))', v_table);
        -- DELETE : Adherant uniquement
        EXECUTE format('CREATE POLICY "Store access DELETE" ON %I FOR DELETE TO authenticated USING (store_id = get_my_store_id() AND get_my_role() = ''adherant'')', v_table);
    END LOOP;
END $$;

-- 2. RELEVES_PRIX (Activité Terrain)
-- Platform Admin
CREATE POLICY "Platform Admin access" ON releves_prix FOR ALL TO authenticated USING (get_my_role() = 'platform_admin') WITH CHECK (get_my_role() = 'platform_admin');
-- SELECT : Tous
CREATE POLICY "Store access SELECT" ON releves_prix FOR SELECT TO authenticated USING (store_id = get_my_store_id());
-- INSERT : Tous (Tout le monde peut créer un relevé)
CREATE POLICY "Store access INSERT" ON releves_prix FOR INSERT TO authenticated WITH CHECK (store_id = get_my_store_id());
-- UPDATE : Adherant, Manager
CREATE POLICY "Store access UPDATE" ON releves_prix FOR UPDATE TO authenticated USING (store_id = get_my_store_id() AND get_my_role() IN ('adherant', 'manager')) WITH CHECK (store_id = get_my_store_id() AND get_my_role() IN ('adherant', 'manager'));
-- DELETE : Adherant (Ajustement métier exclusif)
CREATE POLICY "Store access DELETE" ON releves_prix FOR DELETE TO authenticated USING (store_id = get_my_store_id() AND get_my_role() = 'adherant');

-- 3. HISTORIQUE_ACTIVITES (Traçabilité)
-- Platform Admin
CREATE POLICY "Platform Admin access" ON historique_activites FOR ALL TO authenticated USING (get_my_role() = 'platform_admin') WITH CHECK (get_my_role() = 'platform_admin');
-- SELECT : Adherant, Manager (Les simples utilisateurs ne voient pas l'historique complet)
CREATE POLICY "Store access SELECT" ON historique_activites FOR SELECT TO authenticated USING (store_id = get_my_store_id() AND get_my_role() IN ('adherant', 'manager'));
-- INSERT : Tous (Tout le monde log ses actions)
CREATE POLICY "Store access INSERT" ON historique_activites FOR INSERT TO authenticated WITH CHECK (store_id = get_my_store_id());
-- UPDATE / DELETE : Personne. La table est append-only en RLS.
