import type { SearchResult, ProductInfo, PrixStatus } from "./types";
import { 
  buildSearchQueries, 
  calculateRelevanceScore, 
  estimateProductPageProbability,
  detectHtmlProductSignals
} from "./queryBuilder";

/**
 * Google Custom Search Engine — Vigiprix (v6)
 * 
 * Améliorations v6 :
 * - Récupère plus de résultats (pagination 2 pages)
 * - Validation HTML légère pour les liens prometteurs
 * - Scoring probabiliste priorisant les fiches produits
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
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s max
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" }
    });
    const text = await response.text();
    clearTimeout(timeout);
    return detectHtmlProductSignals(text.substring(0, 10000)); // Analyser les 10 premiers ko
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
  return { prix: null, status: "not_found" };
}

export async function searchGoogleCSE(
  query: string,
  product: ProductInfo,
  numResults = 10
): Promise<SearchResult[]> {
  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_ID) return [];

  const results: SearchResult[] = [];
  
  // On peut faire jusqu'à 2 requêtes pour avoir 20 résultats bruts
  const pages = numResults > 10 ? [0, 10] : [0];

  for (const start of pages) {
    const url = new URL("https://www.googleapis.com/customsearch/v1");
    url.searchParams.set("key", GOOGLE_CSE_KEY);
    url.searchParams.set("cx", GOOGLE_CSE_ID);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("num", "10");
    url.searchParams.set("start", String(start + 1));
    url.searchParams.set("gl", "fr");

    try {
      const response = await fetch(url.toString());
      if (!response.ok) break;
      const data: GoogleCSEResponse = await response.json();
      if (!data.items) break;

      for (const item of data.items) {
        const urlProb = estimateProductPageProbability(item.link, product);
        
        // Validation HTML légère pour les liens très probables
        let htmlScore = 0;
        let htmlSignals: string[] = [];
        if (urlProb.probability > 0.6) {
          const validation = await quickValidateHTML(item.link);
          htmlScore = validation.score;
          htmlSignals = validation.signals;
        }

        const score = calculateRelevanceScore(item.title, item.link, product, htmlScore);
        
        console.log(`[GoogleCSE] ${extractEnseigne(item.displayLink)} | ProbURL: ${Math.round(urlProb.probability*100)}% | Type: ${urlProb.type} | Score: ${score}% | Signals: ${htmlSignals.join(",")}`);

        // Rejet si c'est quasi-certainement une page search/listing
        if (urlProb.type === 'search' || urlProb.type === 'category') {
           if (score < 40) {
             console.log(`[GoogleCSE] Reject (Type: ${urlProb.type}): ${item.link.substring(0, 50)}...`);
             continue;
           }
        }

        if (score < 15) continue;

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
    } catch (err) {
      console.error("[GoogleCSE] Page error:", err);
    }
  }

  return results;
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
    const { query, description } = queries[i];
    console.log(`[GoogleCSE] Cascade Q${i + 1}/${queries.length}: ${description}`);

    // On demande 20 résultats pour la première requête (la plus précise)
    const results = await searchGoogleCSE(query, product, i === 0 ? 20 : 10);

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
    if (i < queries.length - 1) await new Promise(r => setTimeout(r, 400));
  }

  return allResults;
}

export function isGoogleCSEConfigured(): boolean {
  return Boolean(GOOGLE_CSE_KEY && GOOGLE_CSE_ID);
}
