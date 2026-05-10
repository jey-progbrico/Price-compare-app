import { NextResponse } from "next/server";
import { checkCache, getStaleResults } from "@/lib/search/cacheManager";

export const dynamic = "force-dynamic";

const DEFAULT_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "168");

/**
 * GET /api/cache?ean=XXX
 *
 * Retourne les résultats en cache pour un EAN.
 * Utilisé par le composant CompareButton au montage pour l'affichage immédiat.
 *
 * Query params :
 *   ean    - EAN du produit (obligatoire)
 *   stale  - "1" pour inclure les résultats expirés (affichage immédiat)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");
  const includeStale = searchParams.get("stale") === "1";

  if (!ean) {
    return NextResponse.json({ error: "EAN manquant" }, { status: 400 });
  }

  try {
    // D'abord les résultats valides
    const validResults = await checkCache(ean, DEFAULT_TTL_HOURS);

    if (validResults.length > 0) {
      const results = validResults.map(r => ({
        enseigne: r.enseigne,
        titre: r.titre,
        prix: r.prix,
        lien: r.lien,
        source: r.source,
        image_url: r.image_url ?? null,
        isCached: true,
        isStale: false,
        prix_precedent: r.prix_precedent ?? null,
        date_changement_prix: r.date_changement_prix ?? null,
        retrieved_at: r.retrieved_at,
      }));

      return NextResponse.json({ results, ttl_hours: DEFAULT_TTL_HOURS });
    }

    // Si demandé, inclure les résultats expirés (stale)
    if (includeStale) {
      const staleResults = await getStaleResults(ean);
      const results = staleResults.map(r => ({
        enseigne: r.enseigne,
        titre: r.titre,
        prix: r.prix,
        lien: r.lien,
        source: r.source,
        image_url: r.image_url ?? null,
        isCached: true,
        isStale: true,
        prix_precedent: r.prix_precedent ?? null,
        date_changement_prix: r.date_changement_prix ?? null,
        retrieved_at: r.retrieved_at,
      }));

      return NextResponse.json({ results, ttl_hours: DEFAULT_TTL_HOURS });
    }

    return NextResponse.json({ results: [], ttl_hours: DEFAULT_TTL_HOURS });
  } catch (error: any) {
    console.error("[Cache] Erreur:", error.message);
    return NextResponse.json(
      { error: "Impossible de récupérer le cache" },
      { status: 500 }
    );
  }
}
