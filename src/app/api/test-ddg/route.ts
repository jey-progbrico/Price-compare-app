import { NextRequest, NextResponse } from "next/server";
import { rechercherDuckDuckGo } from "@/lib/search/duckDuckGoEngine";

export const dynamic = "force-dynamic";

/**
 * GET /api/test-ddg?q=requete
 * 
 * Route de debug utilisant le MOTEUR PARTAGÉ ET VALIDÉ.
 * Objectif : garantir que si ça marche ici, ça marche dans le pipeline.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Paramètre 'q' manquant" }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    // Utilisation du moteur partagé pour obtenir les liens bruts
    const rawResults = await rechercherDuckDuckGo(q);
    
    // Transformation en SearchResult compatibles frontend
    const results = rawResults.map(r => {
      // Déduction simple de l'enseigne pour le frontend
      const domain = new URL(r.url).hostname.replace('www.', '');
      const parts = domain.split('.');
      let enseigne = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      
      if (domain.includes("leroymerlin")) enseigne = "Leroy Merlin";
      if (domain.includes("bricodepot")) enseigne = "Brico Dépôt";
      if (domain.includes("manomano")) enseigne = "ManoMano";
      if (domain.includes("castorama")) enseigne = "Castorama";
      
      return {
        enseigne,
        titre: r.title,
        lien: r.url,
        prix: null,
        prix_status: "not_found",
        source: "duckduckgo_direct"
      };
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      query: q,
      success: true,
      results_count: results.length,
      results: results,
      duration_ms: duration
    });

  } catch (error: any) {
    console.error(`[DEBUG-DDG] Erreur moteur partagé : ${error.message}`);
    return NextResponse.json({
      query: q,
      error: error.message
    }, { status: 500 });
  }
}
