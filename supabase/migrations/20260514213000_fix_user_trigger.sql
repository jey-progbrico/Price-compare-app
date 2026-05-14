-- Fix for VigiPrix User Role System
-- Date: 2026-05-14
-- Description: Corrects the trigger handle_new_user and profiles table constraints
-- to support the new roles: admin, adherant, manager, utilisateur.

-- 1. Nettoyage de l'existant pour éviter les conflits
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Mise à jour de la table profiles
-- On s'assure que la colonne role a les bonnes contraintes
DO $$ 
BEGIN
    -- Supprimer l'ancienne contrainte si elle existe
    -- (On tente plusieurs noms possibles au cas où elle aurait été nommée différemment)
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;
    
    -- S'assurer que la colonne existe (normalement oui)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'utilisateur';
    END IF;

    -- Ajouter la nouvelle contrainte avec les rôles valides
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('admin', 'adherant', 'manager', 'utilisateur'));
    
    -- Mettre à jour la valeur par défaut
    ALTER TABLE public.profiles 
    ALTER COLUMN role SET DEFAULT 'utilisateur';
END $$;

-- 3. Création de la fonction de trigger améliorée
-- Cette version récupère le rôle depuis metadata si présent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role TEXT := 'utilisateur';
    user_role TEXT;
BEGIN
    -- 1. Extraire le rôle depuis les métadonnées (passé par supabaseAdmin.auth.admin.createUser)
    user_role := COALESCE(new.raw_user_meta_data->>'role', default_role);
    
    -- 2. Validation de sécurité : si le rôle est invalide ou égal à 'user', on force 'utilisateur'
    IF user_role NOT IN ('admin', 'adherant', 'manager', 'utilisateur') THEN
        user_role := default_role;
    END IF;

    -- 3. Insertion dans profiles
    -- On utilise ON CONFLICT pour éviter de planter si le profil existe déjà
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        new.id,
        new.email,
        user_role
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        role = EXCLUDED.role;

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- On lève une exception claire pour faciliter le debuggage côté backend
    RAISE EXCEPTION 'VigiPrix Trigger Error (handle_new_user): % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-création du trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Remplissage des emails manquants pour les profils existants (optionnel mais utile)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
