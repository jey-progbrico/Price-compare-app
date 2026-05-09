import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");

  if (!ean) {
    return NextResponse.json({ error: "EAN manquant" }, { status: 400 });
  }

  try {
    const { data: cached } = await supabase.from('cache_prix').select('*').eq('ean', ean);
    
    if (!cached || cached.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const results = cached.map(c => ({
      enseigne: c.enseigne,
      titre: c.titre,
      prix: c.prix,
      lien: c.lien,
      isCached: true,
      statut: "success",
      prix_precedent: c.prix_precedent,
      date_changement_prix: c.date_changement_prix
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Erreur Cache:", error);
    return NextResponse.json({ error: "Impossible de récupérer le cache" }, { status: 500 });
  }
}
