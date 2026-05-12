/**
 * Types partagés — Moteur de recherche Vigiprix
 * Architecture : Cache → Google CSE (toutes requêtes) → Fallback Scrapers (toujours)
 */

// ─── Source d'un résultat ────────────────────────────────────────────────────
export type ResultSource =
  | "cache"          // Résultat issu du cache Supabase
  | "google_cse"     // Google Custom Search Engine
  | "scraper_123elec"
  | "scraper_manomano"
  | "scraper_bricozor"
  | "scraper_amazon"
  | "scraper_leroymerlin"
  | "scraper_bricodepot"
  | "scraper_bricomarche"
  | "scraper_entrepot_du_bricolage"
  | "scraper_gedimat"
  | "scraper_duckduckgo"
  | "manual";        // Prix saisi manuellement dans la fiche produit

// ─── Statut du prix pour un résultat ────────────────────────────────────────
export type PrixStatus =
  | "detected"   // Prix extrait automatiquement
  | "not_found"  // Lien trouvé mais prix non détectable
  | "manual";    // Prix saisi manuellement

// ─── Statut d'une source pendant la recherche ────────────────────────────────
export type SourceStatus =
  | "pending"     // Pas encore démarré
  | "running"     // En cours
  | "success"     // Résultat(s) trouvé(s)
  | "not_found"   // Aucun résultat
  | "blocked"     // 403 / 429
  | "error"       // Erreur technique
  | "skipped";    // Ignoré (quota, désactivé)

// ─── Résultat de recherche normalisé ─────────────────────────────────────────
export interface SearchResult {
  enseigne: string;
  titre: string;
  prix: number | null;          // null si prix non détecté
  prix_status: PrixStatus;      // statut de l'extraction du prix
  lien: string;
  source: ResultSource;
  image_url?: string | null;
  // Historique prix
  prix_precedent?: number | null;
  date_changement_prix?: string | null;
  // Méta
  relevance_score?: number;     // 0–100
  retrieved_at?: string;        // ISO date
}

// ─── Informations produit depuis Supabase ────────────────────────────────────
export interface ProductInfo {
  ean: string;
  marque?: string | null;
  designation?: string | null;       // description_produit dans la DB
  reference_fabricant?: string | null;
  categorie?: string | null;
}

// ─── Entrée de cache Supabase ────────────────────────────────────────────────
export interface CacheEntry {
  ean: string;
  enseigne: string;
  titre: string;
  prix: number | null;
  prix_status?: PrixStatus;
  lien: string;
  image_url?: string | null;
  source?: ResultSource;
  prix_precedent?: number | null;
  date_changement_prix?: string | null;
  updated_at: string;
  last_searched_at?: string | null;
  last_success_at?: string | null;
  reliability_score?: number;
}

// ─── Payload saisie manuelle du prix ────────────────────────────────────────
export interface ManualPricePayload {
  ean: string;
  enseigne: string;
  lien: string;
  prix: number;
  titre?: string;
}

// ─── Événements SSE émis vers le client ─────────────────────────────────────
export type SearchEventType =
  | "cache_hit"         // Résultats cache disponibles immédiatement
  | "source_start"      // Une source démarre
  | "source_result"     // Un résultat live arrive
  | "source_end"        // Une source termine
  | "done"              // Recherche complète terminée
  | "error";            // Erreur fatale

export interface SearchEvent {
  type: SearchEventType;
  source?: ResultSource | string;
  status?: SourceStatus;
  result?: SearchResult;
  results?: SearchResult[];
  stats?: SearchStats;
  message?: string;
}

// ─── Statistiques de recherche ───────────────────────────────────────────────
export interface SearchStats {
  total_results: number;
  with_price: number;          // résultats avec prix détecté
  without_price: number;       // résultats sans prix (liens seuls)
  from_cache: number;
  from_google: number;
  from_scrapers: number;
  duration_ms: number;
  sources_tried: string[];
  sources_success: string[];
}

// ─── Options de recherche ────────────────────────────────────────────────────
export interface SearchOptions {
  ttl_hours?: number;     // Durée validité cache (défaut: CACHE_TTL_HOURS env)
  force_refresh?: boolean; // Ignorer le cache existant
  max_results?: number;   // Nombre max de résultats à retourner
  min_score?: number;     // Score de pertinence minimum (0–100, défaut: 20)
}
