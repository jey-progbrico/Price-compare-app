-- VigiPrix Identity & Data Access Fix
-- Date: 2026-05-15
-- Objective: Restore data visibility for Management and fix display names.

-- 1. Table profiles : Accessibilité
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);


-- 2. Table historique_activites : Traçabilité et Accès
ALTER TABLE public.historique_activites 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_activites_user_id ON public.historique_activites(user_id);
ALTER TABLE public.historique_activites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can view all activities" ON public.historique_activites;
CREATE POLICY "Management can view all activities" 
ON public.historique_activites FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'adherant', 'manager')
  )
);

DROP POLICY IF EXISTS "Users can view own activities" ON public.historique_activites;
CREATE POLICY "Users can view own activities" 
ON public.historique_activites FOR SELECT TO authenticated 
USING (user_id = auth.uid());


-- 3. Table releves_prix : Accès et Jointure explicite
-- On s'assure que created_by pointe vers profiles pour faciliter les jointures Supabase
ALTER TABLE public.releves_prix 
DROP CONSTRAINT IF EXISTS releves_prix_created_by_fkey;

ALTER TABLE public.releves_prix 
ADD CONSTRAINT releves_prix_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id);


-- 4. Table historique_consultations : Accessibilité (Conditionnel)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'historique_consultations') THEN
        ALTER TABLE public.historique_consultations ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Authenticated users can view all consultations" ON public.historique_consultations;
        CREATE POLICY "Authenticated users can view all consultations" 
        ON public.historique_consultations FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
