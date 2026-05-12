import type { SearchResult, ProductInfo, PrixStatus } from "./types";
import { buildSearchQueries, calculateRelevanceScore, calculateUrlQuality } from "./queryBuilder";

/**
 * Google Custom Search Engine — Vigiprix (v5)
 * 
 * Améliorations v5 :
 * - Filtrage plus permissif pour éviter de perdre de vraies fiches produits
 * - Pénalité URL appliquée au score global au lieu de rejet binaire
 * - Logs debug enrichis avec les facteurs de score
 */

const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";
const MAX_RESULTS_PER_QUERY = 10;

interface GoogleCSEItem {
  title: string;
  link: string;
  displayLink: string;
  snippet?: string;
  pagemap?: {
    offer?: Array<{ price?: string; pricecurrency?: string; seller?: string; }>;
    product?: Array<{ name?: string; description?: string; }>;
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
  error?: { code: number; message: string; status: string; };
}

function extractPrice(item: GoogleCSEItem): { prix: number | null; status: PrixStatus } {
  if (item.pagemap?.offer?.length) {
    for (const offer of item.pagemap.offer) {
      if (offer.price) {
        const price = parseFloat(offer.price.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return { prix: price, status: "detected" };
      }
    }
  }

  if (item.pagemap?.metatags?.length) {
    for (const meta of item.pagemap.metatags) {
      const rawPrice = meta["og:price:amount"] || meta["product:price:amount"] || meta["twitter:data1"];
      if (rawPrice) {
        const price = parseFloat(rawPrice.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return { prix: price, status: "detected" };
      }
    }
  }

  const textToSearch = [item.snippet || "", item.title || ""].join(" ");
  const euroPatterns = [/(\d{1,5}[,.]?\d{0,2})\s*€/, /€\s*(\d{1,5}[,.]?\d{0,2})/, /(\d{1,5}[,.]?\d{0,2})\s*EUR/i];

  for (const pattern of euroPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(",", "."));
      if (price > 0 && price < 50000) return { prix: price, status: "detected" };
    }
  }

  return { prix: null, status: "not_found" };
}

function extractEnseigne(displayLink: string): string {
  const hostname = displayLink.replace(/^www\./, "").toLowerCase().trim();
  const domain = hostname.split(".")[0];
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export async function searchGoogleCSE(
  query: string,
  product: ProductInfo
): Promise<SearchResult[]> {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_ID) return [];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GOOGLE_CSE_KEY);
  url.searchParams.set("cx", GOOGLE_CSE_ID);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("num", String(MAX_RESULTS_PER_QUERY));
  url.searchParams.set("gl", "fr");
  url.searchParams.set("hl", "fr");

  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const data: GoogleCSEResponse = await response.json();
    if (!data.items) return [];

    const results: SearchResult[] = [];

    for (const item of data.items) {
      const urlQuality = calculateUrlQuality(item.link);
      const score = calculateRelevanceScore(item.title, item.link, product);
      const enseigne = extractEnseigne(item.displayLink);

      // Logging détaillé pour l'équilibrage
      console.log(`[GoogleCSE] Result: ${enseigne} | Final Score: ${score}% | URL Penalty: ${Math.round((1-urlQuality)*100)}% | Link: ${item.link.substring(0, 40)}...`);

      // Seuil minimal très bas pour ne rien rater d'essentiel
      // On laisse le score final décider plutôt qu'un rejet binaire sur l'URL
      if (score < 10) {
        console.log(`[GoogleCSE] Reject (score < 10%): ${item.title}`);
        continue;
      }
      
      const { prix, status: prix_status } = extractPrice(item);
      const image_url = item.pagemap?.cse_image?.[0]?.src || null;

      results.push({
        enseigne,
        titre: item.title,
        prix,
        prix_status,
        lien: item.link,
        source: "google_cse",
        image_url,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      });
    }

    return results;
  } catch (err) {
    console.error("[GoogleCSE] Error:", err);
    return [];
  }
}

export async function searchGoogleCSECascade(
  product: ProductInfo,
  onProgress?: (results: SearchResult[], queryIndex: number) => void
): Promise<SearchResult[]> {
  const queries = buildSearchQueries(product);
  const allResults: SearchResult[] = [];
  const seenEnseignes = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const { query, description } = queries[i];
    console.log(`[GoogleCSE] Cascade Q${i + 1}/${queries.length}: ${description}`);

    const results = await searchGoogleCSE(query, product);

    for (const r of results) {
      if (!seenEnseignes.has(r.enseigne)) {
        seenEnseignes.add(r.enseigne);
        allResults.push(r);
      } else if (r.prix !== null) {
        const idx = allResults.findIndex(ex => ex.enseigne === r.enseigne && ex.prix === null);
        if (idx !== -1) allResults[idx] = r;
      }
    }

    if (onProgress) onProgress([...allResults], i);
    if (i < queries.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  return allResults;
}

export function isGoogleCSEConfigured(): boolean {
  return Boolean(GOOGLE_CSE_KEY && GOOGLE_CSE_ID);
}
