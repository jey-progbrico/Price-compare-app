import { NextResponse } from "next/server";
import { isGoogleCSEConfigured } from "@/lib/search/googleCustomSearch";
import { checkCache } from "@/lib/search/cacheManager";
import { buildSearchQueries } from "@/lib/search/queryBuilder";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug?ean=XXX
 * Diagnostic complet : env, Supabase, requêtes générées, réponse brute Google CSE.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean") || "3253282005048";

  const report: Record<string, any> = {
    timestamp: new Date().toISOString(),
    ean_tested: ean,
  };

  // ── 1. Vérification variables d'environnement ────────────────────────────
  const cseKey = process.env.GOOGLE_CSE_KEY || "";
  const cseId = process.env.GOOGLE_CSE_ID || "";

  report.env = {
    GOOGLE_CSE_KEY: cseKey ? `✅ (${cseKey.slice(0, 10)}...)` : "❌ MANQUANTE",
    GOOGLE_CSE_ID: cseId ? `✅ (${cseId.slice(0, 12)}...)` : "❌ MANQUANTE",
    CACHE_TTL_HOURS: process.env.CACHE_TTL_HOURS || "168 (défaut)",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅" : "❌",
    google_cse_configured: isGoogleCSEConfigured(),
  };

  // ── 2. Infos produit réelles depuis Supabase ─────────────────────────────
  let productInfo: Record<string, any> = { ean, note: "Produit non trouvé dans Supabase" };
  try {
    const { data: produit } = await supabase
      .from("produits")
      .select("marque, description_produit, reference_fabricant")
      .eq("numero_ean", ean)
      .single();

    if (produit) {
      productInfo = {
        ean,
        marque: produit.marque,
        designation: produit.description_produit,
        reference_fabricant: produit.reference_fabricant,
      };
    }
  } catch (err: any) {
    productInfo = { ean, error: err.message };
  }
  report.product_from_supabase = productInfo;

  // ── 3. Requêtes générées ─────────────────────────────────────────────────
  const product = {
    ean,
    marque: productInfo.marque ?? null,
    designation: productInfo.designation ?? null,
    reference_fabricant: productInfo.reference_fabricant ?? null,
  };
  report.queries_generated = buildSearchQueries(product);

  // ── 4. Cache Supabase ────────────────────────────────────────────────────
  try {
    const cached = await checkCache(ean, 168);
    report.cache = {
      status: "✅ Supabase OK",
      results_count: cached.length,
      results: cached.slice(0, 3),
    };
  } catch (err: any) {
    report.cache = { status: "❌ Erreur Supabase", error: err.message };
  }

  // ── 5. Test Google CSE — réponse BRUTE ───────────────────────────────────
  if (!isGoogleCSEConfigured()) {
    report.google_cse_raw = { status: "⚠️ Non configuré" };
  } else {
    // Tester les 2 premières requêtes générées et montrer la réponse brute
    const rawTests: any[] = [];

    const queriesToTest = report.queries_generated.slice(0, 3);

    for (const q of queriesToTest) {
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", cseKey);
      url.searchParams.set("cx", cseId);
      url.searchParams.set("q", q.query);
      url.searchParams.set("num", "5");
      url.searchParams.set("gl", "fr");
      url.searchParams.set("hl", "fr");

      try {
        const startMs = Date.now();
        const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
        const duration = Date.now() - startMs;
        const data = await res.json();

        const rawItems = data.items?.map((item: any) => ({
          title: item.title,
          displayLink: item.displayLink,
          link: item.link?.slice(0, 80),
          snippet: item.snippet?.slice(0, 120),
          has_offer_pagemap: !!item.pagemap?.offer?.length,
          has_price_metatag: !!(item.pagemap?.metatags?.[0]?.["og:price:amount"] || item.pagemap?.metatags?.[0]?.["product:price:amount"]),
          snippet_has_euro: /\d+[,.]?\d*\s*€/.test(item.snippet || ""),
          cse_image: item.pagemap?.cse_image?.[0]?.src?.slice(0, 60) || null,
        })) || [];

        rawTests.push({
          query: q.query,
          description: q.description,
          http_status: res.status,
          duration_ms: duration,
          total_results_google: data.searchInformation?.totalResults || "0",
          items_returned: rawItems.length,
          api_error: data.error || null,
          items_raw: rawItems,
        });
      } catch (err: any) {
        rawTests.push({
          query: q.query,
          error: err.message,
        });
      }

      // Pause entre les requêtes pour ne pas griller le quota
      await new Promise(r => setTimeout(r, 300));
    }

    report.google_cse_raw = rawTests;
  }

  return NextResponse.json(report, {
    headers: { "Content-Type": "application/json" },
  });
}
