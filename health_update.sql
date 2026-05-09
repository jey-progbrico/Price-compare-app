-- Requête à exécuter dans Supabase pour ajouter la table de santé des concurrents
CREATE TABLE IF NOT EXISTS public.statut_concurrents (
    enseigne VARCHAR(255) PRIMARY KEY,
    statut VARCHAR(50) DEFAULT 'actif', -- 'actif', 'desactive_auto', 'desactive_manuel'
    score_fiabilite DECIMAL(5, 2) DEFAULT 100.00,
    total_requetes INT DEFAULT 0,
    total_succes INT DEFAULT 0,
    total_403 INT DEFAULT 0,
    consecutive_403 INT DEFAULT 0,
    dernier_succes TIMESTAMP WITH TIME ZONE NULL,
    dernier_echec TIMESTAMP WITH TIME ZONE NULL,
    derniere_erreur TEXT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Sécurité)
ALTER TABLE public.statut_concurrents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read statut_concurrents" ON public.statut_concurrents FOR SELECT USING (true);
CREATE POLICY "Allow anon insert statut_concurrents" ON public.statut_concurrents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update statut_concurrents" ON public.statut_concurrents FOR UPDATE USING (true);
