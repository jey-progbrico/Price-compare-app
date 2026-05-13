import { checkCache, getStaleResults, saveResults } from "./cacheManager";
import { decouvrirProduitsGlobale } from "./duckDuckGoEngine";
import { buildSearchQueries } from "./queryBuilder";
import type {
  SearchResult,
  ProductInfo,
  SearchOptions,
  SearchEvent,
  SearchStats,
} from "./types";

/**
 * SearchOrchestrator — Vigiprix (v3 - Découverte Pure)
 *
 * Pipeline simplifié pour la veille semi-manuelle :
 * 1. Cache Supabase (URLs connues)
 * 2. Découverte DuckDuckGo (Nouvelles URLs)
 * 3. AUCUNE extraction de prix automatique
 */

const DEFAULT_TTL_HOURS = 168;

const MARCHANDS_CIBLES = [
  "manomano.fr",
  "bricodepot.fr",
  "leroymerlin.fr",
  "bricomarche.com",
  "castorama.fr"
];

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

  // ─── ÉTAPE 1 : Cache Supabase (URLs connues) ──────────────────────────────

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
  }

  // ─── ÉTAPE 2 : Découverte DuckDuckGo Globale (Nouveaux Liens) ─────────────
  
  emit({ type: "source_start", source: "duckduckgo", status: "running" });
  stats.sources_tried.push("duckduckgo");

  try {
    const nouveauxResultats = await decouvrirProduitsGlobale(product);
    
    for (const resultat of nouveauxResultats) {
      // Éviter les doublons avec le cache
      if (allResults.some(r => r.lien === resultat.lien)) continue;

      allResults.push(resultat);
      stats.from_scrapers++;
      emit({ type: "source_result", source: "duckduckgo", result: resultat });
    }

    if (nouveauxResultats.length > 0) {
      stats.sources_success.push("duckduckgo");
      emit({ type: "source_end", source: "duckduckgo", status: "success" });
    } else {
      emit({ type: "source_end", source: "duckduckgo", status: "not_found" });
    }
  } catch (err: any) {
    console.error(`[PIPELINE] Erreur DuckDuckGo : ${err.message}`);
    emit({ type: "source_end", source: "duckduckgo", status: "error" });
  }

  // ─── ÉTAPE 3 : Sauvegarde Cache ───────────────────────────────────────────

  const liveResults = allResults.filter(r => r.source !== "cache");
  if (liveResults.length > 0) {
    saveResults(product.ean, liveResults).catch(err => console.error("[PIPELINE] Erreur cache :", err.message));
  }

  // ─── ÉTAPE 4 : Fin ───────────────────────────────────────────────────────

  stats.total_results = allResults.length;
  stats.with_price = 0; // On ne détecte plus de prix
  stats.without_price = allResults.length;
  stats.duration_ms = Date.now() - startTime;

  console.log(`[PIPELINE] TERMINE | Liens trouvés : ${stats.total_results}`);
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

  const { results, stats } = await runSearch(product, {}, {
    onEvent: (event) => {
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
