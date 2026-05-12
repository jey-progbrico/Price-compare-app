import { checkCache, getStaleResults, saveResults } from "./cacheManager";
import { searchGoogleCSECascade, isGoogleCSEConfigured } from "./googleCustomSearch";
import { runFallbackScrapers, FALLBACK_SCRAPERS, scrapeUrl } from "./fallbackScrapers";
import { buildSearchQueries } from "./queryBuilder";
import type {
  SearchResult,
  ProductInfo,
  SearchOptions,
  SearchEvent,
  SearchStats,
} from "./types";

/**
 * SearchOrchestrator — Vigiprix (v3)
 *
 * Orchestre la recherche de prix :
 * 1. Cache Supabase
 * 2. Google Custom Search + Extraction live pour liens sans prix
 * 3. Fallback scrapers dynamiques (Leroy Merlin, Brico Dépôt, etc.)
 */

const DEFAULT_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "168");

export interface OrchestratorCallbacks {
  onEvent: (event: SearchEvent) => void;
}

export async function runSearch(
  product: ProductInfo,
  options: SearchOptions = {},
  callbacks?: OrchestratorCallbacks
): Promise<{ results: SearchResult[]; stats: SearchStats }> {
  const startTime = Date.now();
  const ttlHours = options.ttl_hours ?? DEFAULT_TTL_HOURS;
  const forceRefresh = options.force_refresh ?? false;

  const emit = (event: SearchEvent) => {
    callbacks?.onEvent(event);
  };

  const allResults: SearchResult[] = [];
  const stats: SearchStats = {
    total_results: 0,
    with_price: 0,
    without_price: 0,
    from_cache: 0,
    from_google: 0,
    from_scrapers: 0,
    duration_ms: 0,
    sources_tried: [],
    sources_success: [],
  };

  // ─── ÉTAPE 1 : Cache Supabase ────────────────────────────────────────────

  if (!forceRefresh) {
    const cachedResults = await checkCache(product.ean, ttlHours);
    if (cachedResults.length > 0) {
      const withCacheSource = cachedResults.map(r => ({ ...r, source: "cache" as const }));
      emit({ type: "cache_hit", results: withCacheSource, source: "cache" });
      allResults.push(...withCacheSource);
      stats.from_cache = cachedResults.length;
      stats.total_results = allResults.length;
      stats.with_price = allResults.filter(r => r.prix !== null).length;
      stats.without_price = allResults.filter(r => r.prix === null).length;
      stats.duration_ms = Date.now() - startTime;
      stats.sources_tried.push("cache");
      stats.sources_success.push("cache");
    }

    const staleResults = await getStaleResults(product.ean);
    if (staleResults.length > 0) {
      const withStaleSource = staleResults.map(r => ({ ...r, source: "cache" as const }));
      emit({ type: "cache_hit", results: withStaleSource, source: "cache" });
    }
  }

  // ─── ÉTAPE 2 : Google Custom Search ──────────────────────────────────────

  emit({ type: "source_start", source: "google_cse", status: "running" });
  stats.sources_tried.push("google_cse");

  let googleResults: SearchResult[] = [];
  if (isGoogleCSEConfigured()) {
    try {
      googleResults = await searchGoogleCSECascade(
        product,
        (partialResults) => {
          const newResults = partialResults.slice(googleResults.length);
          for (const r of newResults) {
            emit({ type: "source_result", source: "google_cse", result: r });
          }
        }
      );

      // --- ENHANCEMENT: Scrape missing prices for Google results ---
      const missingPrice = googleResults.filter(r => r.prix === null);
      if (missingPrice.length > 0) {
        console.log(`[Orchestrator] Attempting to scrape ${missingPrice.length} Google links without price`);
        // Limit to 2 parallel scrapes to preserve performance
        const toScrape = missingPrice.slice(0, 2);
        await Promise.all(toScrape.map(async (r) => {
          const res = await scrapeUrl(r.lien, r.enseigne, product);
          if (res.success && res.result?.prix) {
            r.prix = res.result.prix;
            r.prix_status = "detected";
            r.image_url = res.result.image_url || r.image_url;
            emit({ type: "source_result", source: "google_cse", result: r });
          }
        }));
      }

      if (googleResults.length > 0) {
        stats.from_google = googleResults.length;
        stats.sources_success.push("google_cse");
      }
      emit({ type: "source_end", source: "google_cse", status: googleResults.length > 0 ? "success" : "not_found" });
    } catch (err: any) {
      console.error(`[Orchestrator] Google CSE error: ${err.message}`);
      emit({ type: "source_end", source: "google_cse", status: "error" });
    }
  }

  allResults.push(...googleResults);

  // ─── ÉTAPE 3 : Scrapers fallback ─────────────────────────────────────────

  const existingEnseignes = new Set(allResults.map(r => r.enseigne));
  const queries = buildSearchQueries(product);
  const bestQuery = (
    queries.find(q => q.type === "ref_fabricant")?.query ||
    queries.find(q => q.type === "mixed")?.query ||
    queries.find(q => q.type === "designation")?.query ||
    product.ean
  );

  const scraperSources = FALLBACK_SCRAPERS.map(s => s.source);
  for (const src of scraperSources) {
    emit({ type: "source_start", source: src, status: "running" });
    stats.sources_tried.push(src);
  }

  try {
    const { results: fallbackResults, stats: fallbackStats } =
      await runFallbackScrapers(bestQuery, product, existingEnseignes, (result) => {
        emit({ type: "source_result", source: result.source, result });
      });

    for (const src of scraperSources) {
      const scraperName = FALLBACK_SCRAPERS.find(s => s.source === src)?.name || "";
      const succeeded = fallbackStats.success.includes(scraperName);
      const blocked = fallbackStats.blocked.includes(scraperName);
      emit({ type: "source_end", source: src, status: succeeded ? "success" : blocked ? "blocked" : "not_found" });
      if (succeeded) stats.sources_success.push(src);
    }

    allResults.push(...fallbackResults);
    stats.from_scrapers = fallbackResults.length;
  } catch (err: any) {
    console.error("[Orchestrator] Fallback scrapers error:", err.message);
  }

  // ─── ÉTAPE 4 : Sauvegarde cache ──────────────────────────────────────────

  const liveResults = allResults.filter(r => r.source !== "cache");
  if (liveResults.length > 0) {
    saveResults(product.ean, liveResults).catch(err => console.error("[Orchestrator] saveResults error:", err.message));
  }

  // ─── ÉTAPE 5 : Fin ───────────────────────────────────────────────────────

  stats.total_results = allResults.length;
  stats.with_price = allResults.filter(r => r.prix !== null).length;
  stats.without_price = allResults.filter(r => r.prix === null).length;
  stats.duration_ms = Date.now() - startTime;

  emit({ type: "done", results: allResults, stats });
  return { results: allResults, stats };
}

export async function processScrapingQueue(
  ean: string,
  productInfos?: {
    marque?: string | null;
    designation?: string | null;
    reference_fabricant?: string | null;
  },
  onProgress?: (event: string, data: unknown) => void
): Promise<{ results: SearchResult[]; debugLogs: unknown[] }> {
  const product: ProductInfo = {
    ean,
    marque: productInfos?.marque,
    designation: productInfos?.designation,
    reference_fabricant: productInfos?.reference_fabricant,
  };

  const legacyEvents: unknown[] = [];
  const { results, stats } = await runSearch(product, {}, {
    onEvent: (event) => {
      legacyEvents.push(event);
      if (!onProgress) return;
      if (event.type === "cache_hit") {
        event.results?.forEach(r => onProgress("scraper_result", { scraper: r.enseigne, status: "success", result: { ...r, isCached: true } }));
      } else if (event.type === "source_start") {
        onProgress("scraper_start", { scraper: event.source });
      } else if (event.type === "source_result" && event.result) {
        onProgress("scraper_result", { scraper: event.result.enseigne, status: "success", result: event.result });
      } else if (event.type === "source_end" && event.status !== "success") {
        onProgress("scraper_result", { scraper: event.source, status: event.status });
      }
    },
  });

  return { results, debugLogs: [stats] };
}
