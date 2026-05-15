-- Ajout du nom d'affichage pour les profils utilisateurs
-- Permet une identification plus humaine dans les rapports et le dashboard

-- 1. Ajout de la colonne display_name
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2. Commentaire pour la documentation
COMMENT ON COLUMN public.profiles.display_name IS 'Nom d''affichage personnalisé utilisé dans l''interface (Dashboard, Exports, etc.)';

-- 3. Mise à jour de la fonction trigger pour supporter le display_name à la création (si passé en metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role TEXT := 'utilisateur';
    user_role TEXT;
    user_display_name TEXT;
BEGIN
    -- 1. Extraire les infos depuis les métadonnées
    user_role := COALESCE(new.raw_user_meta_data->>'role', default_role);
    user_display_name := new.raw_user_meta_data->>'display_name';
    
    -- 2. Validation de sécurité : si le rôle est invalide ou égal à 'user', on force 'utilisateur'
    IF user_role NOT IN ('admin', 'adherant', 'manager', 'utilisateur') THEN
        user_role := default_role;
    END IF;

    -- 3. Insertion dans profiles
    INSERT INTO public.profiles (id, email, role, display_name)
    VALUES (
        new.id,
        new.email,
        user_role,
        user_display_name
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        role = EXCLUDED.role,
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name);

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'VigiPrix Trigger Error (handle_new_user): % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
