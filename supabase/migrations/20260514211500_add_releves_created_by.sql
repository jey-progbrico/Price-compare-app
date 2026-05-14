-- Ajout de la traçabilité des relevés
-- Permet de savoir quel utilisateur a effectué quel relevé prix

ALTER TABLE releves_prix 
ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Commentaire pour la documentation Supabase
COMMENT ON COLUMN releves_prix.created_by IS 'ID de l utilisateur ayant créé le relevé (lié à auth.users)';
