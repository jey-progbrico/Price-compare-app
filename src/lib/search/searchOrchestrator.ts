import { checkCache, getStaleResults, saveResults } from "./cacheManager";
import { runFallbackScrapers } from "./fallbackScrapers";
import type {
  SearchResult,
  ProductInfo,
  SearchOptions,
  SearchEvent,
  SearchStats,
} from "./types";

/**
 * SearchOrchestrator — Vigiprix (Simplified v1)
 *
 * Mode minimal pour restaurer la stabilité :
 * 1. Cache Supabase
 * 2. Scraper ManoMano direct (pas de Google CSE, pas de scoring complexe)
 */

const DEFAULT_TTL_HOURS = 168;

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
      stats.sources_tried.push("cache");
      stats.sources_success.push("cache");
    }

    const staleResults = await getStaleResults(product.ean);
    if (staleResults.length > 0) {
      const withStaleSource = staleResults.map(r => ({ ...r, source: "cache" as const }));
      emit({ type: "cache_hit", results: withStaleSource, source: "cache" });
    }
  }

  // ─── ÉTAPE 2 : Recherche Live (Simplified Mode - ManoMano Only) ───────────
  
  const query = product.ean || product.designation || "";
  console.log(`[PIPELINE] Minimal Search for: "${query}"`);
  
  emit({ type: "source_start", source: "scraper_manomano", status: "running" });
  stats.sources_tried.push("scraper_manomano");

  try {
    const { results: fallbackResults } = await runFallbackScrapers(
      query, 
      product, 
      new Set(), 
      (result) => {
        emit({ type: "source_result", source: "scraper_manomano", result });
      }
    );

    if (fallbackResults.length > 0) {
      allResults.push(...fallbackResults);
      stats.from_scrapers = fallbackResults.length;
      stats.sources_success.push("scraper_manomano");
      emit({ type: "source_end", source: "scraper_manomano", status: "success" });
    } else {
      emit({ type: "source_end", source: "scraper_manomano", status: "not_found" });
    }
  } catch (err: any) {
    console.log(`[PIPELINE] Error during minimal search: ${err.message}`);
    emit({ type: "source_end", source: "scraper_manomano", status: "error" });
  }

  // ─── ÉTAPE 3 : Sauvegarde cache ──────────────────────────────────────────

  const liveResults = allResults.filter(r => r.source !== "cache");
  if (liveResults.length > 0) {
    saveResults(product.ean, liveResults).catch(err => console.error("[PIPELINE] Cache save error:", err.message));
  }

  // ─── ÉTAPE 4 : Fin ───────────────────────────────────────────────────────

  stats.total_results = allResults.length;
  stats.with_price = allResults.filter(r => r.prix !== null).length;
  stats.without_price = allResults.filter(r => r.prix === null).length;
  stats.duration_ms = Date.now() - startTime;

  console.log(`[PIPELINE] COMPLETE | Total results: ${stats.total_results} | Duration: ${stats.duration_ms}ms`);
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
