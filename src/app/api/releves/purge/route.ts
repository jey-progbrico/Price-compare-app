import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérification du rôle
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "adherant") {
    return NextResponse.json({ error: "Accès refusé. Seuls les Admins et Adhérents peuvent purger les relevés." }, { status: 403 });
  }

  try {
    const { error } = await supabase
      .from("releves_prix")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Astuce pour supprimer tout sans clause WHERE vide si configuré ainsi

    if (error) throw error;

    // Log de l'activité
    await supabase.from("historique_activites").insert({
      type_action: "purge_releves",
      details: { user: user.email }
    });

    return NextResponse.json({ success: true, message: "Tous les relevés ont été supprimés." });
  } catch (err: any) {
    console.error("[PURGE ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
