-- Fix RLS for profiles table
-- Date: 2026-05-15
-- Description: Allows authenticated users to read display names and emails of other users.
-- This is essential for the collaborative nature of VigiPrix (KPIs, Activity Logs).

-- 1. Enable RLS on profiles (just in case)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Authenticated users can read ALL profiles
-- This allows managers and adherents to see who made a relevé or an activity.
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. Policy: Users can only update their own profile (except for display_name/role which are handled by Admin API)
-- We keep this restrictive for security.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- 4. Ensure RLS on other related tables
-- historisque_activites should be readable by all managers/adherents/admins
ALTER TABLE public.historique_activites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can view all activities" ON public.historique_activites;
CREATE POLICY "Management can view all activities" 
ON public.historique_activites 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'adherant', 'manager')
  )
);

-- Note: utilisateur can also see activities? 
-- The user said "Ne rien afficher pour les utilisateurs standards" for KPI, 
-- but maybe they can see the flux d'activité? 
-- In page.tsx: {isManagement && kpiData.length > 0 && ...}
-- So for now we only allow management to read activities to be safe.
-- Wait, the standard user should see THEIR OWN activities? 
-- Let's add a policy for standard users to see their own.

DROP POLICY IF EXISTS "Users can view own activities" ON public.historique_activites;
CREATE POLICY "Users can view own activities" 
ON public.historique_activites 
FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());
