-- Migration: Ajouter le champ code_interne à la table produits
-- Objectif : Identifiant magasin unique (optionnel)

-- 1. Ajout de la colonne
ALTER TABLE public.produits 
ADD COLUMN IF NOT EXISTS code_interne text;

-- 2. Indexation pour la recherche rapide
CREATE INDEX IF NOT EXISTS idx_produits_code_interne ON public.produits(code_interne);

-- 3. Contrainte d'unicité (uniquement pour les valeurs non nulles)
-- Note : Plusieurs produits peuvent avoir code_interne = NULL, mais pas deux fois 'A123'
CREATE UNIQUE INDEX IF NOT EXISTS unique_code_interne_not_null 
ON public.produits (code_interne) 
WHERE code_interne IS NOT NULL;

-- 4. Commentaire de documentation
COMMENT ON COLUMN public.produits.code_interne IS 'Identifiant produit interne magasin (unique si renseigné)';
