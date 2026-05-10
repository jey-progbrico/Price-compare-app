import { supabase } from "@/lib/supabase";
import type { CacheEntry, SearchResult, ResultSource } from "./types";

/**
 * CacheManager — Vigiprix
 *
 * Gère le cache Supabase (table cache_prix).
 * Architecture : cache central = réduction drastique des appels externes.
 *
 * TTL par défaut : 168h (7 jours) via CACHE_TTL_HOURS
 */

const DEFAULT_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "168");
const STALE_TTL_HOURS = parseInt(process.env.CACHE_STALE_HOURS || "720"); // 30 jours avant suppression

// ─── Lecture cache ────────────────────────────────────────────────────────────

/**
 * Retourne les entrées de cache valides (non expirées) pour un EAN.
 * Une entrée valide = updated_at < TTL_HOURS.
 */
export async function checkCache(
  ean: string,
  ttlHours: number = DEFAULT_TTL_HOURS
): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from("cache_prix")
      .select("*")
      .eq("ean", ean)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[CacheManager] checkCache error:", error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const cutoff = Date.now() - ttlHours * 60 * 60 * 1000;

    return data
      .filter((entry: CacheEntry) => {
        const updatedAt = new Date(entry.updated_at).getTime();
        return updatedAt >= cutoff && entry.prix !== null;
      })
      .map(entryToSearchResult);
  } catch (err: any) {
    console.error("[CacheManager] checkCache exception:", err.message);
    return [];
  }
}

/**
 * Retourne TOUTES les entrées pour un EAN, même expirées (stale).
 * Utilisé pour l'affichage immédiat "anciens résultats" pendant la recherche live.
 */
export async function getStaleResults(ean: string): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from("cache_prix")
      .select("*")
      .eq("ean", ean)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];

    const staleCutoff = Date.now() - STALE_TTL_HOURS * 60 * 60 * 1000;

    return data
      .filter((entry: CacheEntry) => {
        // Exclure les entrées vraiment trop vieilles (> 30 jours)
        const updatedAt = new Date(entry.updated_at).getTime();
        return updatedAt >= staleCutoff && entry.prix !== null;
      })
      .map(entryToSearchResult);
  } catch (err: any) {
    console.error("[CacheManager] getStaleResults exception:", err.message);
    return [];
  }
}

/**
 * Vérifie si un EAN a des résultats en cache (même expirés).
 */
export async function hasCachedResults(ean: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("cache_prix")
      .select("ean", { count: "exact", head: true })
      .eq("ean", ean);

    return !error && (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Écriture cache ───────────────────────────────────────────────────────────

/**
 * Sauvegarde les résultats dans le cache Supabase.
 * Gère automatiquement l'historique des prix (prix_precedent).
 */
export async function saveResults(
  ean: string,
  results: SearchResult[]
): Promise<void> {
  if (results.length === 0) return;

  // Charger le cache existant pour comparaison des prix
  let existingCache: Record<string, CacheEntry> = {};
  try {
    const { data } = await supabase
      .from("cache_prix")
      .select("*")
      .eq("ean", ean);

    if (data) {
      existingCache = Object.fromEntries(
        data.map((e: CacheEntry) => [e.enseigne, e])
      );
    }
  } catch (err: any) {
    console.error("[CacheManager] saveResults load existing:", err.message);
  }

  const now = new Date().toISOString();

  const upserts = results
    .filter(r => r.prix !== null)
    .map(result => {
      const existing = existingCache[result.enseigne];
      const existingPrix = existing?.prix ?? null;
      const newPrix = result.prix;

      let prix_precedent = existing?.prix_precedent ?? null;
      let date_changement_prix = existing?.date_changement_prix ?? null;

      // Détecter un changement de prix
      if (
        existing &&
        existingPrix !== null &&
        newPrix !== null &&
        Math.abs(existingPrix - newPrix) > 0.01
      ) {
        prix_precedent = existingPrix;
        date_changement_prix = now;
      }

      return {
        ean,
        enseigne: result.enseigne,
        titre: result.titre,
        prix: newPrix,
        lien: result.lien,
        image_url: result.image_url ?? null,
        source: result.source,
        prix_precedent,
        date_changement_prix,
        last_success_at: now,
        last_searched_at: now,
        reliability_score: 1.0,
        updated_at: now,
      };
    });

  for (const upsert of upserts) {
    try {
      const { error } = await supabase
        .from("cache_prix")
        .upsert(upsert, { onConflict: "ean,enseigne" });

      if (error) {
        console.error(
          `[CacheManager] upsert error for ${upsert.enseigne}:`,
          error.message
        );
      }
    } catch (err: any) {
      console.error(
        `[CacheManager] upsert exception for ${upsert.enseigne}:`,
        err.message
      );
    }
  }

  // Mettre à jour last_searched_at pour les enseignes sans résultat
  try {
    await supabase
      .from("cache_prix")
      .update({ last_searched_at: now })
      .eq("ean", ean);
  } catch {
    // Non-bloquant
  }
}

/**
 * Invalide le cache pour un EAN (force refresh).
 * Met updated_at à une date ancienne pour que le prochain checkCache retourne [].
 */
export async function invalidateCache(ean: string): Promise<void> {
  try {
    // On met updated_at à epoch 0 pour que TTL expire immédiatement
    const { error } = await supabase
      .from("cache_prix")
      .update({ updated_at: new Date(0).toISOString() })
      .eq("ean", ean);

    if (error) console.error("[CacheManager] invalidateCache error:", error.message);
  } catch (err: any) {
    console.error("[CacheManager] invalidateCache exception:", err.message);
  }
}

// ─── Utilitaire interne ───────────────────────────────────────────────────────

function entryToSearchResult(entry: CacheEntry): SearchResult {
  return {
    enseigne: entry.enseigne,
    titre: entry.titre || "",
    prix: entry.prix,
    lien: entry.lien || "",
    source: (entry.source as ResultSource) || "cache",
    image_url: entry.image_url ?? null,
    prix_precedent: entry.prix_precedent ?? null,
    date_changement_prix: entry.date_changement_prix ?? null,
    retrieved_at: entry.updated_at,
  };
}
