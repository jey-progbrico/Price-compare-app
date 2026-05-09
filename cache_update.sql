-- Requête à exécuter dans Supabase pour ajouter l'historique des prix
ALTER TABLE public.cache_prix
ADD COLUMN IF NOT EXISTS prix_precedent DECIMAL(10, 2) NULL,
ADD COLUMN IF NOT EXISTS date_changement_prix TIMESTAMP WITH TIME ZONE NULL;
