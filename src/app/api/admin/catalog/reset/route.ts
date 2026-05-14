import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/admin/catalog/reset
 * Réinitialise complètement le catalogue produits et les données liées.
 * Sécurité : Admin et Adhérents uniquement.
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 1. Vérification du rôle
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "adherant") {
    return NextResponse.json({ 
      error: "Accès refusé. Seuls les Administrateurs et Adhérents peuvent réinitialiser le catalogue." 
    }, { status: 403 });
  }

  try {
    console.log(`[CATALOG RESET] Démarrage par ${user.email}`);

    // 2. Suppression des données liées (ordre pour respecter les PK/FK implicites)
    
    // a. Suppression du cache des prix concurrents
    const { error: errCache } = await supabase
      .from("cache_prix")
      .delete()
      .neq("ean", "0000000000000");
    if (errCache) console.error("Erreur suppression cache_prix:", errCache);

    // b. Suppression des relevés de prix manuels
    const { error: errReleves } = await supabase
      .from("releves_prix")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (errReleves) console.error("Erreur suppression releves_prix:", errReleves);

    // c. Suppression de l'historique des recherches
    const { error: errHist } = await supabase
      .from("historique_recherches")
      .delete()
      .neq("ean", "0000000000000");
    if (errHist) console.error("Erreur suppression historique_recherches:", errHist);

    // d. Suppression finale des produits
    const { error: errProd } = await supabase
      .from("produits")
      .delete()
      .neq("numero_ean", "0000000000000");
    
    if (errProd) {
      console.error("Erreur critique suppression produits:", errProd);
      throw errProd;
    }

    // 3. Log de l'activité majeure
    await supabase.from("historique_activites").insert({
      type_action: "reset_catalog",
      details: { 
        user: user.email,
        timestamp: new Date().toISOString(),
        message: "Réinitialisation complète du catalogue produits effectuée."
      }
    });

    console.log(`[CATALOG RESET] Succès pour ${user.email}`);

    return NextResponse.json({ 
      success: true, 
      message: "Le catalogue a été réinitialisé avec succès." 
    });

  } catch (err: any) {
    console.error("[CATALOG RESET ERROR]", err);
    return NextResponse.json({ 
      error: err.message || "Une erreur est survenue lors de la réinitialisation." 
    }, { status: 500 });
  }
}
