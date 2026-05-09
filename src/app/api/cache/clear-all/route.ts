import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function DELETE() {
  try {
    // Supprimer toutes les entrées où l'ID n'est pas nul (c'est-à-dire toute la table)
    const { error } = await supabase
      .from("cache_prix")
      .delete()
      .neq('id', 0); // Hack pour supprimer toutes les lignes dans Supabase RLS

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Cache entièrement vidé" });
  } catch (error: any) {
    console.error("Erreur lors de la suppression totale du cache:", error);
    return NextResponse.json(
      { success: false, error: "Impossible de vider le cache complet" },
      { status: 500 }
    );
  }
}
