import { checkCache, getStaleResults, saveResults } from "./cacheManager";
import { decouvrirProduitViaDDG } from "./duckDuckGoEngine";
import { buildSearchQueries } from "./queryBuilder";
import type {
  SearchResult,
  ProductInfo,
  SearchOptions,
  SearchEvent,
  SearchStats,
} from "./types";

/**
 * SearchOrchestrator — Vigiprix (v2 DuckDuckGo)
 *
 * Mode découverte externe via DuckDuckGo HTML :
 * 1. Cache Supabase
 * 2. Découverte DDG sur marchands cibles (ManoMano, Brico Dépôt, etc.)
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

  // ─── ÉTAPE 2 : Génération des requêtes (Normalisation incluse) ───────────
  
  const requetes = buildSearchQueries(product);
  console.log(`[PIPELINE] Requêtes générées : ${requetes.length}`);
  requetes.forEach(q => console.log(`  -> [${q.type}] ${q.query}`));

  // ─── ÉTAPE 3 : Recherche Live via DuckDuckGo ─────────────────────────────
  
  // On priorise la recherche par EAN pour la découverte initiale
  const requeteEAN = requetes.find(q => q.type === "ean")?.query || product.ean;

  for (const site of MARCHANDS_CIBLES) {
    const sourceId = `ddg_${site.split('.')[0]}`;
    emit({ type: "source_start", source: sourceId, status: "running" });
    stats.sources_tried.push(sourceId);

    try {
      // Tentative de découverte via DDG
      const resultat = await decouvrirProduitViaDDG(product, site, `${requeteEAN} site:${site}`);
      
      if (resultat) {
        allResults.push(resultat);
        stats.from_scrapers++;
        stats.sources_success.push(sourceId);
        emit({ type: "source_result", source: sourceId, result: resultat });
        emit({ type: "source_end", source: sourceId, status: "success" });
      } else {
        // Fallback optionnel : tenter avec une désignation normalisée si l'EAN n'a rien donné
        const requeteDesig = requetes.find(q => q.type === "mixed")?.query;
        if (requeteDesig) {
          console.log(`[PIPELINE] Tentative fallback désignation pour ${site}...`);
          const resultatFallback = await decouvrirProduitViaDDG(product, site, `${requeteDesig} site:${site}`);
          if (resultatFallback) {
            allResults.push(resultatFallback);
            stats.from_scrapers++;
            stats.sources_success.push(sourceId);
            emit({ type: "source_result", source: sourceId, result: resultatFallback });
            emit({ type: "source_end", source: sourceId, status: "success" });
            continue;
          }
        }
        emit({ type: "source_end", source: sourceId, status: "not_found" });
      }
    } catch (err: any) {
      console.log(`[PIPELINE] Erreur lors de la recherche ${site} : ${err.message}`);
      emit({ type: "source_end", source: sourceId, status: "error" });
    }
  }

  // ─── ÉTAPE 4 : Sauvegarde cache ──────────────────────────────────────────

  const liveResults = allResults.filter(r => r.source !== "cache");
  if (liveResults.length > 0) {
    saveResults(product.ean, liveResults).catch(err => console.error("[PIPELINE] Erreur sauvegarde cache :", err.message));
  }

  // ─── ÉTAPE 5 : Fin ───────────────────────────────────────────────────────

  stats.total_results = allResults.length;
  stats.with_price = allResults.filter(r => r.prix !== null).length;
  stats.without_price = allResults.filter(r => r.prix === null).length;
  stats.duration_ms = Date.now() - startTime;

  console.log(`[PIPELINE] TERMINE | Total résultats : ${stats.total_results} | Durée : ${stats.duration_ms}ms`);
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
