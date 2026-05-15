-- Ajout de la traçabilité dans l'historique d'activités
-- Date: 2026-05-15

ALTER TABLE public.historique_activites 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Index pour les performances des jointures profiles
CREATE INDEX IF NOT EXISTS idx_activites_user_id ON public.historique_activites(user_id);

-- Commentaire pour la documentation
COMMENT ON COLUMN public.historique_activites.user_id IS 'ID de l utilisateur ayant effectué l action (lié à auth.users)';
