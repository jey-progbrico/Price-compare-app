import { NextResponse } from "next/server";
import { isGoogleCSEConfigured, searchGoogleCSE } from "@/lib/search/googleCustomSearch";
import { checkCache } from "@/lib/search/cacheManager";
import { buildSearchQueries } from "@/lib/search/queryBuilder";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug?ean=XXX
 *
 * Endpoint de diagnostic pour vérifier la configuration et tester la recherche.
 * À utiliser uniquement en développement / debug — ne pas exposer en production permanente.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean") || "3253282005048"; // EAN test par défaut

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    ean_tested: ean,
  };

  // ── 1. Vérification variables d'environnement ────────────────────────────
  report.env = {
    GOOGLE_CSE_KEY: process.env.GOOGLE_CSE_KEY
      ? `✅ Présente (${process.env.GOOGLE_CSE_KEY.slice(0, 8)}...)`
      : "❌ MANQUANTE",
    GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID
      ? `✅ Présente (${process.env.GOOGLE_CSE_ID.slice(0, 8)}...)`
      : "❌ MANQUANTE",
    CACHE_TTL_HOURS: process.env.CACHE_TTL_HOURS || "168 (défaut)",
    FALLBACK_THRESHOLD: process.env.FALLBACK_THRESHOLD || "3 (défaut)",
    MIN_RELEVANCE_SCORE: process.env.MIN_RELEVANCE_SCORE || "35 (défaut)",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "✅ Présente"
      : "❌ MANQUANTE",
    google_cse_configured: isGoogleCSEConfigured(),
  };

  // ── 2. Test requêtes générées ────────────────────────────────────────────
  const product = { ean, marque: "Test", designation: "Produit test", reference_fabricant: null };
  report.queries_generated = buildSearchQueries(product);

  // ── 3. Test cache Supabase ───────────────────────────────────────────────
  try {
    const cached = await checkCache(ean, 168);
    report.cache = {
      status: "✅ Supabase OK",
      results_count: cached.length,
      results: cached.slice(0, 3),
    };
  } catch (err: any) {
    report.cache = {
      status: "❌ Erreur Supabase",
      error: err.message,
    };
  }

  // ── 4. Test Google CSE (si configuré) ────────────────────────────────────
  if (isGoogleCSEConfigured()) {
    try {
      const startMs = Date.now();
      const results = await searchGoogleCSE(ean, product);
      report.google_cse = {
        status: "✅ Requête exécutée",
        duration_ms: Date.now() - startMs,
        results_count: results.length,
        results: results.slice(0, 3).map(r => ({
          enseigne: r.enseigne,
          prix: r.prix,
          titre: r.titre?.slice(0, 60),
          score: r.relevance_score,
        })),
      };
    } catch (err: any) {
      report.google_cse = {
        status: "❌ Erreur",
        error: err.message,
      };
    }
  } else {
    report.google_cse = {
      status: "⚠️ Non configuré — GOOGLE_CSE_KEY ou GOOGLE_CSE_ID manquant",
    };
  }

  return NextResponse.json(report, {
    headers: { "Content-Type": "application/json" },
  });
}
