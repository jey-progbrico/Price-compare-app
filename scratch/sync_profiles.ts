import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncProfiles() {
  console.log("Démarrage de la synchronisation des profils...");

  // 1. Lister tous les utilisateurs auth
  const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  if (authError) {
    console.error("Erreur listage utilisateurs auth:", authError);
    return;
  }

  console.log(`${users.length} utilisateurs trouvés dans Auth.`);

  for (const user of users) {
    // 2. Vérifier si le profil existe
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(`Erreur vérification profil pour ${user.email}:`, profileError);
      continue;
    }

    const role = user.user_metadata?.role || "utilisateur";
    const displayName = user.user_metadata?.display_name || null;

    if (!profile) {
      console.log(`Profil manquant pour ${user.email}. Création...`);
      const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert([{
          id: user.id,
          email: user.email,
          role: role,
          display_name: displayName
        }]);
      
      if (insertError) {
        console.error(`Erreur création profil pour ${user.email}:`, insertError);
      } else {
        console.log(`Profil créé pour ${user.email}.`);
      }
    } else {
      // Optionnel: Mettre à jour si display_name est vide dans le profil mais présent dans metadata
      if (!profile.display_name && displayName) {
        console.log(`Mise à jour display_name pour ${user.email}: ${displayName}`);
        await supabaseAdmin
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", user.id);
      }
    }
  }

  console.log("Synchronisation terminée.");
}

syncProfiles();
