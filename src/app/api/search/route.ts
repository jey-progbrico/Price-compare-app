import { NextResponse } from "next/server";
import { runSearch } from "@/lib/search/searchOrchestrator";
import { supabase } from "@/lib/supabase";
import type { ProductInfo } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?ean=XXX
 *
 * Endpoint REST (non-SSE) pour les cas où EventSource n'est pas disponible.
 * Retourne TOUS les résultats : avec prix et sans prix (liens seuls).
 * Le client décide comment afficher les résultats sans prix.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");
  const forceRefresh = searchParams.get("force") === "1";

  if (!ean) {
    return NextResponse.json({ error: "EAN manquant" }, { status: 400 });
  }

  try {
    // 1. Récupérer les infos produit
    let product: ProductInfo = { ean };

    try {
      const { data: produit } = await supabase
        .from("produits")
        .select("marque, description_produit, reference_fabricant")
        .eq("numero_ean", ean)
        .single();

      if (produit) {
        product = {
          ean,
          marque: produit.marque ?? null,
          designation: produit.description_produit ?? null,
          reference_fabricant: produit.reference_fabricant ?? null,
        };
      }
    } catch (dbErr: any) {
      console.warn("[Search] Impossible de charger les infos produit:", dbErr.message);
    }

    // 2. Recherche complète
    const { results, stats } = await runSearch(product, {
      force_refresh: forceRefresh,
    });

    // 3. Formater la réponse — TOUS les résultats (avec et sans prix)
    const finalResults = results.map(r => ({
      enseigne: r.enseigne,
      titre: r.titre,
      prix: r.prix,
      prix_status: r.prix_status ?? (r.prix !== null ? "detected" : "not_found"),
      lien: r.lien,
      source: r.source,
      image_url: r.image_url ?? null,
      isCached: r.source === "cache",
      prix_precedent: r.prix_precedent ?? null,
      date_changement_prix: r.date_changement_prix ?? null,
      relevance_score: r.relevance_score ?? null,
    }));

    return NextResponse.json({ results: finalResults, stats });
  } catch (error: any) {
    console.error("[Search] Erreur:", error.message);
    return NextResponse.json(
      { error: "Impossible de récupérer les prix concurrents" },
      { status: 500 }
    );
  }
}
