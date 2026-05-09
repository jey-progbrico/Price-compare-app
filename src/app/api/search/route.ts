import { NextResponse } from "next/server";
import { processScrapingQueue } from "@/lib/scraper/queue";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");

  if (!ean) {
    return NextResponse.json({ error: "EAN manquant" }, { status: 400 });
  }

  try {
    // 1. Récupérer les infos du produit pour la recherche sémantique
    const { data: produit } = await supabase
      .from("produits")
      .select("marque, description_produit")
      .eq("numero_ean", ean)
      .single();

    const productInfos = produit ? {
      marque: produit.marque,
      designation: produit.description_produit
    } : undefined;

    // 2. Exécution de la file d'attente intelligente (Parallèle + Cascade)
    const { results, debugLogs } = await processScrapingQueue(ean, productInfos);

    // On ne renvoie que les résultats pertinents au frontend
    const finalResults = results
      .filter(r => r.statut === "success" && r.prix !== null)
      .map(r => ({
        enseigne: r.enseigne,
        titre: r.titre,
        prix: r.prix,
        lien: r.lien,
        isCached: (r as any).isCached || false, // Info pour l'UI
        prix_precedent: (r as any).prix_precedent || null,
        date_changement_prix: (r as any).date_changement_prix || null
      }));

    // S'il n'y a aucun succès mais qu'il y a des erreurs de proxy
    if (finalResults.length === 0) {
      const proxyNeeded = results.some(r => r.statut === "403_proxy_needed");
      if (proxyNeeded) {
        return NextResponse.json(
          { 
            results: [], 
            warning: "Certains sites (Leroy Merlin, Bricoman) bloquent l'accès sans Proxy.",
            debugLogs
          }
        );
      }
    }

    return NextResponse.json({ results: finalResults, debugLogs });
  } catch (error: any) {
    console.error("Erreur Scraping:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les prix concurrents" },
      { status: 500 }
    );
  }
}
