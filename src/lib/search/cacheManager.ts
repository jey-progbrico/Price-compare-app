import { supabase } from "@/lib/supabase";
import type { CacheEntry, SearchResult, ResultSource, PrixStatus } from "./types";

/**
 * CacheManager — Vigiprix (v2)
 *
 * Changements v2 :
 * - Stocke les résultats AVEC et SANS prix (prix_status: "not_found")
 * - checkCache / getStaleResults retournent aussi les liens sans prix
 * - saveResults ne filtre plus sur prix !== null
 * - Gestion du champ prix_status en base
 *
 * TTL par défaut : 168h (7 jours) via CACHE_TTL_HOURS
 */

const DEFAULT_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "168");
const STALE_TTL_HOURS = parseInt(process.env.CACHE_STALE_HOURS || "720"); // 30 jours avant suppression

// ─── Lecture cache ────────────────────────────────────────────────────────────

/**
 * Retourne les entrées de cache valides (non expirées) pour un EAN.
 * Inclut les résultats avec et sans prix.
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
        // On garde les entrées dans le TTL, qu'elles aient un prix ou non
        return updatedAt >= cutoff;
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
        const updatedAt = new Date(entry.updated_at).getTime();
        return updatedAt >= staleCutoff;
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
 * Stocke les résultats avec ET sans prix (prix_status: "not_found").
 * Gère automatiquement l'historique des prix (prix_precedent).
 * Déduplication par enseigne : un seul enregistrement par (ean, enseigne).
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

  // Déduplication par enseigne avant sauvegarde
  // Si plusieurs résultats pour la même enseigne, on garde celui avec prix en priorité
  const byEnseigne = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = byEnseigne.get(result.enseigne);
    if (!existing || (result.prix !== null && existing.prix === null)) {
      byEnseigne.set(result.enseigne, result);
    }
  }

  const upserts = Array.from(byEnseigne.values()).map(result => {
    const existing = existingCache[result.enseigne];
    const existingPrix = existing?.prix ?? null;
    const newPrix = result.prix;

    let prix_precedent = existing?.prix_precedent ?? null;
    let date_changement_prix = existing?.date_changement_prix ?? null;

    // Détecter un changement de prix (uniquement si les deux sont non-null)
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
      prix_status: result.prix_status ?? (newPrix !== null ? "detected" : "not_found"),
      lien: result.lien,
      image_url: result.image_url ?? null,
      source: result.source,
      prix_precedent,
      date_changement_prix,
      last_success_at: newPrix !== null ? now : (existing?.last_success_at ?? null),
      last_searched_at: now,
      reliability_score: newPrix !== null ? 1.0 : 0.5,
      updated_at: now,
    };
  });

  for (const upsert of upserts) {
    try {
      const { error } = await supabase
        .from("cache_prix")
        .upsert(upsert, { onConflict: "ean,enseigne" });

      if (error) {
        // Si la colonne prix_status n'existe pas encore, retry sans elle
        if (error.message?.includes("prix_status")) {
          const { prix_status, ...upsertWithoutStatus } = upsert;
          const { error: retryError } = await supabase
            .from("cache_prix")
            .upsert(upsertWithoutStatus, { onConflict: "ean,enseigne" });
          if (retryError) {
            console.error(
              `[CacheManager] upsert retry error for ${upsert.enseigne}:`,
              retryError.message
            );
          }
        } else {
          console.error(
            `[CacheManager] upsert error for ${upsert.enseigne}:`,
            error.message
          );
        }
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
 * Upsert un prix manuel dans le cache.
 * Source = "manual", prix_status = "manual".
 */
export async function saveManualPrice(
  ean: string,
  enseigne: string,
  lien: string,
  prix: number,
  titre?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Vérifier si une entrée existe déjà pour cette enseigne
  let existingPrix: number | null = null;
  try {
    const { data } = await supabase
      .from("cache_prix")
      .select("prix")
      .eq("ean", ean)
      .eq("enseigne", enseigne)
      .single();
    existingPrix = data?.prix ?? null;
  } catch {}

  const upsert: Record<string, unknown> = {
    ean,
    enseigne,
    titre: titre || `${enseigne} (prix manuel)`,
    prix,
    lien,
    source: "manual",
    last_searched_at: now,
    last_success_at: now,
    reliability_score: 1.0,
    updated_at: now,
  };

  // Ajouter prix_status si colonne disponible
  upsert["prix_status"] = "manual";

  // Historique prix si changement
  if (existingPrix !== null && Math.abs(existingPrix - prix) > 0.01) {
    upsert["prix_precedent"] = existingPrix;
    upsert["date_changement_prix"] = now;
  }

  try {
    const { error } = await supabase
      .from("cache_prix")
      .upsert(upsert, { onConflict: "ean,enseigne" });

    if (error) {
      // Retry sans prix_status si colonne manquante
      if (error.message?.includes("prix_status")) {
        const { prix_status, ...withoutStatus } = upsert as Record<string, unknown> & { prix_status?: string };
        const { error: retryError } = await supabase
          .from("cache_prix")
          .upsert(withoutStatus, { onConflict: "ean,enseigne" });
        if (retryError) throw new Error(retryError.message);
      } else {
        throw new Error(error.message);
      }
    }
  } catch (err: any) {
    console.error("[CacheManager] saveManualPrice error:", err.message);
    throw err;
  }
}

/**
 * Invalide le cache pour un EAN (force refresh).
 */
export async function invalidateCache(ean: string): Promise<void> {
  try {
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
    prix_status: (entry.prix_status as PrixStatus) ?? (entry.prix !== null ? "detected" : "not_found"),
    lien: entry.lien || "",
    source: (entry.source as ResultSource) || "cache",
    image_url: entry.image_url ?? null,
    prix_precedent: entry.prix_precedent ?? null,
    date_changement_prix: entry.date_changement_prix ?? null,
    retrieved_at: entry.updated_at,
  };
}
