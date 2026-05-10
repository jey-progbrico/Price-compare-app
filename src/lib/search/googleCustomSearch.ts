import type { SearchResult, ProductInfo } from "./types";
import { buildSearchQueries, buildGoogleShoppingQuery, calculateRelevanceScore } from "./queryBuilder";

/**
 * Google Custom Search Engine — Vigiprix
 *
 * Utilise l'API Google Custom Search JSON (Option B).
 * Documentation : https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 *
 * Configuration requise (variables d'environnement) :
 *   GOOGLE_CSE_KEY  = votre clé API Google Cloud
 *   GOOGLE_CSE_ID   = votre Search Engine ID (cx)
 *
 * IMPORTANT : Le moteur CSE doit être configuré pour chercher sur des sites
 * marchands (Amazon.fr, manomano.fr, 123elec.com, bricozor.com, etc.)
 * OU configuré en mode "Search the entire web" pour des résultats plus larges.
 *
 * Quota gratuit : 100 requêtes/jour
 * Quota payant  : ~5€/1000 requêtes
 */

const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || "35");
const MAX_RESULTS = 10; // Max autorisé par l'API Google CSE

// ─── Types Google CSE API ─────────────────────────────────────────────────────

interface GoogleCSEItem {
  title: string;
  link: string;
  displayLink: string;
  snippet?: string;
  pagemap?: {
    offer?: Array<{
      price?: string;
      pricecurrency?: string;
      seller?: string;
    }>;
    product?: Array<{
      name?: string;
      description?: string;
    }>;
    cse_image?: Array<{ src?: string }>;
    metatags?: Array<{
      "og:price:amount"?: string;
      "og:title"?: string;
      "product:price:amount"?: string;
      "twitter:data1"?: string;
    }>;
  };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

// ─── Extraction prix ──────────────────────────────────────────────────────────

/**
 * Tente d'extraire un prix numérique depuis les données structurées CSE.
 * Ordre de priorité : pagemap.offer > metatags > snippet/title regex.
 */
function extractPrice(item: GoogleCSEItem): number | null {
  // 1. Schema.org Offer (le plus fiable)
  if (item.pagemap?.offer?.length) {
    for (const offer of item.pagemap.offer) {
      if (offer.price) {
        const price = parseFloat(offer.price.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return price;
      }
    }
  }

  // 2. Open Graph price meta tags
  if (item.pagemap?.metatags?.length) {
    for (const meta of item.pagemap.metatags) {
      const rawPrice =
        meta["og:price:amount"] ||
        meta["product:price:amount"] ||
        meta["twitter:data1"];
      if (rawPrice) {
        const price = parseFloat(rawPrice.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return price;
      }
    }
  }

  // 3. Regex sur le snippet et le titre
  const textToSearch = [item.snippet || "", item.title || ""].join(" ");
  const euroPatterns = [
    /(\d{1,5}[,.]?\d{0,2})\s*€/,
    /€\s*(\d{1,5}[,.]?\d{0,2})/,
    /(\d{1,5}[,.]?\d{0,2})\s*EUR/i,
  ];

  for (const pattern of euroPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(",", "."));
      if (price > 0 && price < 50000) return price;
    }
  }

  return null;
}

/**
 * Détermine le nom de l'enseigne depuis le displayLink de l'item CSE.
 */
function extractEnseigne(displayLink: string): string {
  const knownEnseignes: Record<string, string> = {
    "amazon.fr": "Amazon",
    "amazon.com": "Amazon",
    "manomano.fr": "ManoMano",
    "manomano.com": "ManoMano",
    "123elec.com": "123elec",
    "bricozor.com": "Bricozor",
    "leroymerlin.fr": "Leroy Merlin",
    "castorama.fr": "Castorama",
    "bricodepot.fr": "Brico Dépôt",
    "bricomarche.com": "Bricomarché",
    "bricoman.fr": "Bricoman",
    "cdiscount.com": "Cdiscount",
    "darty.com": "Darty",
    "fnac.com": "Fnac",
    "rue-du-commerce.fr": "Rue du Commerce",
    "auchan.fr": "Auchan",
    "boulanger.com": "Boulanger",
    "lesbricoleurs.fr": "Les Bricoleurs",
    "weldom.fr": "Weldom",
    "tools.fr": "Tools",
    "elektro.fr": "Elektro",
    "outillage.fr": "Outillage.fr",
    "entrepot-du-bricolage.fr": "L'Entrepôt du Bricolage",
  };

  const hostname = displayLink
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

  if (knownEnseignes[hostname]) return knownEnseignes[hostname];

  // Capitaliser le premier domaine
  const domain = hostname.split(".")[0];
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// ─── Moteur principal ─────────────────────────────────────────────────────────

/**
 * Lance une recherche Google CSE et retourne les résultats normalisés.
 *
 * @param query - Requête de recherche
 * @param product - Informations produit pour filtrage de pertinence
 * @returns Liste de SearchResult avec prix, enseigne, lien, image
 */
export async function searchGoogleCSE(
  query: string,
  product: ProductInfo
): Promise<SearchResult[]> {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_ID) {
    console.error("[GoogleCSE] Clés API manquantes (GOOGLE_CSE_KEY, GOOGLE_CSE_ID)");
    return [];
  }

  const googleQuery = buildGoogleShoppingQuery(query);
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GOOGLE_CSE_KEY);
  url.searchParams.set("cx", GOOGLE_CSE_ID);
  url.searchParams.set("q", googleQuery);
  url.searchParams.set("num", String(MAX_RESULTS));
  url.searchParams.set("gl", "fr");    // Géolocalisation France
  url.searchParams.set("hl", "fr");    // Langue interface française

  console.log(`[GoogleCSE] Recherche: "${googleQuery}"`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[GoogleCSE] Timeout (10s)");
    } else {
      console.error("[GoogleCSE] Fetch error:", err.message);
    }
    return [];
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[GoogleCSE] HTTP ${response.status}: ${errorText}`);
    return [];
  }

  let data: GoogleCSEResponse;
  try {
    data = await response.json();
  } catch (err: any) {
    console.error("[GoogleCSE] Parse error:", err.message);
    return [];
  }

  if (data.error) {
    console.error(`[GoogleCSE] API error ${data.error.code}: ${data.error.message}`);
    return [];
  }

  if (!data.items || data.items.length === 0) {
    console.log(`[GoogleCSE] Aucun résultat pour "${googleQuery}"`);
    return [];
  }

  // ─── Traitement des résultats ──────────────────────────────────────────────
  const results: SearchResult[] = [];

  for (const item of data.items) {
    const prix = extractPrice(item);

    // Filtrer les items sans prix (pages catégories, blog, etc.)
    if (prix === null) continue;

    const enseigne = extractEnseigne(item.displayLink);
    const titre = item.title || "";

    // Calcul du score de pertinence
    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE) {
      console.log(`[GoogleCSE] Rejeté (score ${score}%): ${titre.substring(0, 60)}`);
      continue;
    }

    // Image produit (si disponible via CSE)
    const image_url = item.pagemap?.cse_image?.[0]?.src || null;

    results.push({
      enseigne,
      titre,
      prix,
      lien: item.link,
      source: "google_cse",
      image_url,
      relevance_score: score,
      retrieved_at: new Date().toISOString(),
    });
  }

  console.log(`[GoogleCSE] ${results.length} résultats valides sur ${data.items.length} items`);
  return results;
}

/**
 * Lance une recherche en cascade sur plusieurs requêtes.
 * S'arrête dès qu'on obtient suffisamment de résultats.
 *
 * @param product - Infos produit pour générer les requêtes
 * @param minResults - Nombre minimum de résultats souhaités (défaut: 2)
 */
export async function searchGoogleCSECascade(
  product: ProductInfo,
  minResults = 2,
  onProgress?: (results: SearchResult[], queryIndex: number) => void
): Promise<SearchResult[]> {
  const queries = buildSearchQueries(product);
  const allResults: SearchResult[] = [];
  const seenEnseignes = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const { query, description } = queries[i];
    console.log(`[GoogleCSE] Cascade Q${i + 1}/${queries.length}: ${description}`);

    const results = await searchGoogleCSE(query, product);

    // Dédupliquer par enseigne (garder le prix le plus récent)
    for (const r of results) {
      if (!seenEnseignes.has(r.enseigne)) {
        seenEnseignes.add(r.enseigne);
        allResults.push(r);
      }
    }

    if (onProgress) onProgress([...allResults], i);

    // Arrêt anticipé si on a assez de résultats
    if (allResults.length >= minResults) {
      console.log(`[GoogleCSE] ${allResults.length} résultats — arrêt cascade`);
      break;
    }

    // Petite pause entre les requêtes (respecter les quotas)
    if (i < queries.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return allResults;
}

/**
 * Vérifie si la configuration Google CSE est disponible.
 */
export function isGoogleCSEConfigured(): boolean {
  return Boolean(GOOGLE_CSE_KEY && GOOGLE_CSE_ID);
}
