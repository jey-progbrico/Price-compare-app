import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Récupère le profil complet de l'utilisateur authentifié côté serveur.
 * Utile pour obtenir le store_id et le rôle de manière sécurisée dans les routes d'API.
 */
export async function getServerProfile(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, stores(*)")
    .eq("id", user.id)
    .single();

  return { user, profile };
}
