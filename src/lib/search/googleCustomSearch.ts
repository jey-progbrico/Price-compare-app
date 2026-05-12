import type { SearchResult, ProductInfo, PrixStatus } from "./types";
import { 
  buildSearchQueries, 
  calculateRelevanceScore, 
  estimateProductPageProbability,
  detectHtmlProductSignals
} from "./queryBuilder";

/**
 * Google Custom Search Engine — Vigiprix (v7)
 * 
 * Améliorations v7 :
 * - Gestion gracieuse du 403 (switch vers fallback)
 * - Plus tolérant sur les résultats
 * - Extraction prix renforcée
 */

const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";

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
      "og:type"?: string;
    }>;
  };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  error?: { code: number; message: string; status: string; };
}

async function quickValidateHTML(url: string): Promise<{ score: number, signals: string[] }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" }
    });
    if (!response.ok) return { score: 0.1, signals: ["http_ok"] };
    const text = await response.text();
    clearTimeout(timeout);
    return detectHtmlProductSignals(text.substring(0, 15000));
  } catch {
    return { score: 0, signals: [] };
  }
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
  // Regex fallback sur snippet
  const match = item.snippet?.match(/(\d+[,.]\d{2})\s*€/);
  if (match) {
    const price = parseFloat(match[1].replace(",", "."));
    if (price > 0) return { prix: price, status: "detected" };
  }

  return { prix: null, status: "not_found" };
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
  url.searchParams.set("num", "10");
  url.searchParams.set("gl", "fr");

  try {
    const response = await fetch(url.toString());
    if (response.status === 403) {
      console.warn("[GoogleCSE] 403 Forbidden. Discovery will use fallbacks.");
      return [];
    }
    if (!response.ok) return [];
    const data: GoogleCSEResponse = await response.json();
    if (!data.items) return [];

    const results: SearchResult[] = [];
    for (const item of data.items) {
      const urlProb = estimateProductPageProbability(item.link, product);
      const score = calculateRelevanceScore(item.title, item.link, product);
      
      // Très tolérant : on garde presque tout si le score est correct
      if (score < 10) continue;

      const { prix, status: prix_status } = extractPrice(item);
      results.push({
        enseigne: extractEnseigne(item.displayLink),
        titre: item.title,
        prix,
        prix_status,
        lien: item.link,
        source: "google_cse",
        image_url: item.pagemap?.cse_image?.[0]?.src || null,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (err) {
    return [];
  }
}

function extractEnseigne(displayLink: string): string {
  const hostname = displayLink.replace(/^www\./, "").toLowerCase().trim();
  const domain = hostname.split(".")[0];
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export async function searchGoogleCSECascade(
  product: ProductInfo,
  onProgress?: (results: SearchResult[], queryIndex: number) => void
): Promise<SearchResult[]> {
  const queries = buildSearchQueries(product);
  const allResults: SearchResult[] = [];
  const seenEnseignes = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const results = await searchGoogleCSE(queries[i].query, product);
    if (results.length === 0 && i === 0) {
      // Si la première requête (précise) ne donne rien ou 403, on continue quand même
    }

    for (const r of results) {
      if (!seenEnseignes.has(r.enseigne)) {
        seenEnseignes.add(r.enseigne);
        allResults.push(r);
      }
    }

    if (onProgress) onProgress([...allResults], i);
    if (i < queries.length - 1) await new Promise(r => setTimeout(r, 200));
  }

  return allResults;
}

export function isGoogleCSEConfigured(): boolean {
  return Boolean(GOOGLE_CSE_KEY && GOOGLE_CSE_ID);
}
