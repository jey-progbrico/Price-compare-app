import { checkCache, getStaleResults, saveResults } from "./cacheManager";
import { searchGoogleCSECascade, isGoogleCSEConfigured } from "./googleCustomSearch";
import { runFallbackScrapers } from "./fallbackScrapers";
import { buildSearchQueries } from "./queryBuilder";
import type {
  SearchResult,
  ProductInfo,
  SearchOptions,
  SearchEvent,
  SearchStats,
  SourceStatus,
} from "./types";

/**
 * SearchOrchestrator — Vigiprix
 *
 * Orchestre la recherche de prix en 5 étapes :
 *
 * ÉTAPE 1 — Cache Supabase (instantané)
 *   └─ Résultats valides → emit cache_hit → fin
 *   └─ Résultats stale  → emit cache_hit (stale) → continuer live
 *
 * ÉTAPE 2 — Requêtes Google Custom Search
 *   └─ Résultats progressifs via callback
 *   └─ Sauvegarde cache en arrière-plan
 *
 * ÉTAPE 3 — Fallback scrapers (si < FALLBACK_THRESHOLD résultats)
 *   └─ 123elec, ManoMano, Bricozor, Amazon
 *   └─ Queue limitée, anti-bot
 *
 * ÉTAPE 4 — Sauvegarde finale cache Supabase
 *
 * ÉTAPE 5 — Émission événement done avec stats complètes
 */

const FALLBACK_THRESHOLD = parseInt(process.env.FALLBACK_THRESHOLD || "3");
const DEFAULT_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "168");

// ─── Interface publique ───────────────────────────────────────────────────────

export interface OrchestratorCallbacks {
  /** Appelé pour chaque événement SSE à envoyer au client */
  onEvent: (event: SearchEvent) => void;
}

/**
 * Lance la recherche de prix complète pour un EAN.
 * Compatible avec un transport SSE (Server-Sent Events).
 *
 * @param product - Informations produit (EAN, marque, désignation, ref fabricant)
 * @param options - Options de recherche (TTL cache, force refresh, etc.)
 * @param callbacks - Callbacks pour les événements SSE
 * @returns Tous les résultats trouvés + statistiques
 */
export async function runSearch(
  product: ProductInfo,
  options: SearchOptions = {},
  callbacks?: OrchestratorCallbacks
): Promise<{ results: SearchResult[]; stats: SearchStats }> {
  const startTime = Date.now();
  const ttlHours = options.ttl_hours ?? DEFAULT_TTL_HOURS;
  const forceRefresh = options.force_refresh ?? false;
  const minScore = options.min_score ?? 35;

  const emit = (event: SearchEvent) => {
    callbacks?.onEvent(event);
  };

  const allResults: SearchResult[] = [];
  const stats: SearchStats = {
    total_results: 0,
    from_cache: 0,
    from_google: 0,
    from_scrapers: 0,
    duration_ms: 0,
    sources_tried: [],
    sources_success: [],
  };

  // ─── ÉTAPE 1 : Cache Supabase ────────────────────────────────────────────

  if (!forceRefresh) {
    console.log(`[Orchestrator] EAN ${product.ean} — Vérification cache (TTL: ${ttlHours}h)`);

    // Résultats valides (dans le TTL)
    const cachedResults = await checkCache(product.ean, ttlHours);

    if (cachedResults.length > 0) {
      console.log(`[Orchestrator] Cache HIT: ${cachedResults.length} résultats valides`);

      // Marquer comme "cache"
      const withCacheSource = cachedResults.map(r => ({ ...r, source: "cache" as const }));

      emit({ type: "cache_hit", results: withCacheSource, source: "cache" });

      allResults.push(...withCacheSource);
      stats.from_cache = cachedResults.length;

      // Cache valide → on retourne directement sans recherche live
      stats.total_results = allResults.length;
      stats.duration_ms = Date.now() - startTime;
      stats.sources_tried.push("cache");
      stats.sources_success.push("cache");

      emit({ type: "done", results: allResults, stats });
      return { results: allResults, stats };
    }

    // Résultats stale (expirés mais disponibles) → affichage immédiat + recherche live
    const staleResults = await getStaleResults(product.ean);
    if (staleResults.length > 0) {
      console.log(`[Orchestrator] Cache STALE: ${staleResults.length} anciens résultats`);
      const withStaleSource = staleResults.map(r => ({
        ...r,
        source: "cache" as const,
      }));
      emit({ type: "cache_hit", results: withStaleSource, source: "cache" });
      // On continue la recherche live (ne pas return)
    }
  } else {
    console.log(`[Orchestrator] Force refresh — cache ignoré`);
  }

  // ─── ÉTAPE 2 : Google Custom Search ─────────────────────────────────────

  emit({ type: "source_start", source: "google_cse", status: "running" });
  stats.sources_tried.push("google_cse");

  let googleResults: SearchResult[] = [];

  if (isGoogleCSEConfigured()) {
    try {
      googleResults = await searchGoogleCSECascade(
        product,
        FALLBACK_THRESHOLD,
        (partialResults, queryIndex) => {
          // Émettre les résultats progressivement
          const newResults = partialResults.slice(
            googleResults.length // Uniquement les nouveaux
          );
          for (const r of newResults) {
            emit({ type: "source_result", source: "google_cse", result: r });
          }
        }
      );

      // Émettre les résultats qui n'ont pas encore été émis via le callback
      for (const r of googleResults) {
        emit({ type: "source_result", source: "google_cse", result: r });
      }

      if (googleResults.length > 0) {
        stats.from_google = googleResults.length;
        stats.sources_success.push("google_cse");
      }

      emit({
        type: "source_end",
        source: "google_cse",
        status: googleResults.length > 0 ? "success" : "not_found",
      });
    } catch (err: any) {
      console.error("[Orchestrator] Google CSE error:", err.message);
      emit({ type: "source_end", source: "google_cse", status: "error" });
    }
  } else {
    console.warn("[Orchestrator] Google CSE non configuré — passage direct aux scrapers fallback");
    emit({ type: "source_end", source: "google_cse", status: "skipped" });
  }

  allResults.push(...googleResults);

  // ─── ÉTAPE 3 : Scrapers fallback (si peu de résultats) ──────────────────

  const needsFallback = allResults.length < FALLBACK_THRESHOLD;

  if (needsFallback) {
    console.log(
      `[Orchestrator] ${allResults.length} résultats — déclenchement fallback scrapers`
    );

    // Meilleure requête pour les scrapers : priorité à la ref fabricant
    const queries = buildSearchQueries(product);
    const bestQuery = queries[0]?.query || product.ean;

    const scraperSources = ["scraper_123elec", "scraper_manomano", "scraper_bricozor", "scraper_amazon"];
    for (const src of scraperSources) {
      emit({ type: "source_start", source: src, status: "running" });
      stats.sources_tried.push(src);
    }

    try {
      const { results: fallbackResults, stats: fallbackStats } =
        await runFallbackScrapers(bestQuery, product, (result, scraperName) => {
          emit({ type: "source_result", source: result.source, result });
        });

      // Émettre le statut final de chaque scraper
      for (const src of scraperSources) {
        const scraperName = src.replace("scraper_", "");
        const succeeded = fallbackStats.success.some(
          s => s.toLowerCase() === scraperName || s.toLowerCase().includes(scraperName)
        );
        const blocked = fallbackStats.blocked.some(
          s => s.toLowerCase().includes(scraperName)
        );

        emit({
          type: "source_end",
          source: src,
          status: succeeded ? "success" : blocked ? "blocked" : "not_found",
        });

        if (succeeded) stats.sources_success.push(src);
      }

      // Dédupliquer par enseigne
      const existingEnseignes = new Set(allResults.map(r => r.enseigne));
      const newFallback = fallbackResults.filter(r => !existingEnseignes.has(r.enseigne));
      allResults.push(...newFallback);
      stats.from_scrapers = newFallback.length;
    } catch (err: any) {
      console.error("[Orchestrator] Fallback scrapers error:", err.message);
      for (const src of scraperSources) {
        emit({ type: "source_end", source: src, status: "error" });
      }
    }
  } else {
    console.log(
      `[Orchestrator] ${allResults.length} résultats — scrapers fallback ignorés`
    );
  }

  // ─── ÉTAPE 4 : Sauvegarde cache Supabase ────────────────────────────────

  const liveResults = allResults.filter(r => r.source !== "cache");
  if (liveResults.length > 0) {
    // Non-bloquant : on ne wait pas la sauvegarde pour retourner les résultats
    saveResults(product.ean, liveResults).catch(err => {
      console.error("[Orchestrator] saveResults error:", err.message);
    });
  }

  // ─── ÉTAPE 5 : Fin ───────────────────────────────────────────────────────

  stats.total_results = allResults.length;
  stats.duration_ms = Date.now() - startTime;

  console.log(
    `[Orchestrator] Terminé en ${stats.duration_ms}ms — ${stats.total_results} résultats ` +
    `(cache: ${stats.from_cache}, google: ${stats.from_google}, scrapers: ${stats.from_scrapers})`
  );

  emit({ type: "done", results: allResults, stats });
  return { results: allResults, stats };
}

// ─── Compatibilité legacy (queue.ts) ─────────────────────────────────────────

/**
 * Interface de compatibilité avec l'ancien queue.ts.
 * Permet une migration progressive sans casser les routes existantes.
 */
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

  const { results, stats } = await runSearch(
    product,
    {},
    {
      onEvent: (event) => {
        legacyEvents.push(event);

        if (!onProgress) return;

        switch (event.type) {
          case "cache_hit":
            event.results?.forEach(r => {
              onProgress("scraper_result", {
                scraper: r.enseigne,
                status: "success",
                result: { ...r, isCached: true },
              });
            });
            break;
          case "source_start":
            onProgress("scraper_start", { scraper: event.source });
            break;
          case "source_result":
            if (event.result) {
              onProgress("scraper_result", {
                scraper: event.result.enseigne,
                status: "success",
                result: event.result,
              });
            }
            break;
          case "source_end":
            if (event.status !== "success") {
              onProgress("scraper_result", {
                scraper: event.source,
                status: event.status,
              });
            }
            break;
        }
      },
    }
  );

  return { results, debugLogs: [stats] };
}
