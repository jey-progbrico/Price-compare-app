-- Migration: Ajouter le champ match_type à la table releves_prix
-- Objectif : Distinguer les produits exacts des produits équivalents

-- 1. Ajout de la colonne avec valeur par défaut 'exact'
ALTER TABLE public.releves_prix 
ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'exact';

-- 2. Ajout de la contrainte de validation
ALTER TABLE public.releves_prix
DROP CONSTRAINT IF EXISTS check_match_type;

ALTER TABLE public.releves_prix
ADD CONSTRAINT check_match_type 
CHECK (match_type IN ('exact', 'equivalent'));

-- 3. Indexation pour optimiser les filtres futurs
CREATE INDEX IF NOT EXISTS idx_releves_prix_match_type ON public.releves_prix(match_type);

-- 4. Commentaire de documentation
COMMENT ON COLUMN public.releves_prix.match_type IS 'Qualification du relevé : exact (EAN identique) ou equivalent (produit approchant)';
