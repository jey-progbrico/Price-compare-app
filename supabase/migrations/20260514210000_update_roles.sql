-- Mise à jour du système de rôles VigiPrix
-- Niveaux : admin, adherant, manager, utilisateur

-- 1. Mise à jour du rôle admin principal
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jeycourjeau@hotmail.fr';

-- 2. Assignation du rôle ADHERANT
UPDATE profiles 
SET role = 'adherant' 
WHERE email = 'arnauld.delpierre-adh@mousquetaires.com';

-- 3. Assignation du rôle MANAGER
UPDATE profiles 
SET role = 'manager' 
WHERE email IN (
    'patricia.allizan-pdv09512@mousquetaires.com',
    'laurent.brulfert-pdv09512@mousquetaires.com'
);

-- 4. Par défaut, tous les autres sont 'utilisateur'
-- On s'assure que personne n'a un rôle invalide si on change la contrainte plus tard
UPDATE profiles 
SET role = 'utilisateur' 
WHERE role NOT IN ('admin', 'adherant', 'manager');
