import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore, estimateProductPageProbability, detectHtmlProductSignals } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v5)
 * 
 * Améliorations v5 :
 * - Découverte alternative via DuckDuckGo HTML
 * - Extraction ultra-tolérante (JSON-LD, Meta, Sélecteurs)
 * - Gestion robuste des blocages
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = 3;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 1500;
const MAX_CONSECUTIVE_403 = 3;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Fetch stealth ────────────────────────────────────────────────────────────

async function fetchStealth(url: string): Promise<Response> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    if (response.status === 403 || response.status === 429) {
      throw new Error(`BLOCKED_${response.status}`);
    }
    return response;
  } catch (err: any) {
    throw err;
  }
}

// ─── Extraction Générique ──────────────────────────────────────────────────────

function parsePriceText(text: string): number | null {
  if (!text) return null;
  const cleanText = text.replace(/\s/g, "").replace(",", ".");
  const match = cleanText.match(/(\d+\.?\d*)/);
  if (!match) return null;
  const price = parseFloat(match[1]);
  return !isNaN(price) && price > 0 && price < 50000 ? price : null;
}

function extractGenericHTML(html: string, $: cheerio.CheerioAPI): { 
  prix: number | null; 
  titre: string | null; 
  image: string | null;
  strategy: string;
} {
  let prix: number | null = null;
  let titre: string | null = null;
  let image: string | null = null;
  let strategy = "none";

  // 1. JSON-LD
  try {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).text());
        const findProduct = (obj: any) => {
          if (!obj) return;
          if (Array.isArray(obj)) { obj.forEach(findProduct); return; }
          if (obj["@type"] === "Product" || obj["@type"]?.includes("Product")) {
            if (!titre) titre = obj.name;
            if (!image) image = Array.isArray(obj.image) ? obj.image[0] : (obj.image?.url || obj.image);
            if (obj.offers?.price) { prix = parsePriceText(obj.offers.price.toString()); strategy = "json-ld"; }
          }
          if (obj["@graph"]) findProduct(obj["@graph"]);
        };
        findProduct(json);
      } catch {}
    });
  } catch {}

  if (prix) return { prix, titre, image, strategy };

  // 2. Meta Tags
  prix = parsePriceText($('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content'));
  if (prix) strategy = "meta-tags";

  if (!titre) titre = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();
  if (!image) image = $('meta[property="og:image"]').attr('content');

  if (prix) return { prix, titre, image, strategy };

  // 3. Selectors
  const selectors = ['.price', '.product-price', '#priceblock_ourprice', '.current-price'];
  for (const s of selectors) {
    const p = parsePriceText($(s).first().text().trim());
    if (p) { prix = p; strategy = "selectors"; break; }
  }

  return { prix, titre, image, strategy };
}

// ─── Scraper Interface ────────────────────────────────────────────────────────

interface ScraperResult {
  success: boolean;
  result?: SearchResult;
  results?: SearchResult[];
  error?: string;
  blocked?: boolean;
}

export async function scrapeUrl(
  url: string,
  enseigne: string,
  product: ProductInfo
): Promise<ScraperResult> {
  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const extraction = extractGenericHTML(html, $);
    const score = calculateRelevanceScore(extraction.titre || "", url, product);

    return {
      success: true,
      result: {
        enseigne,
        titre: extraction.titre || `Produit ${enseigne}`,
        prix: extraction.prix,
        prix_status: extraction.prix ? "detected" : "not_found",
        lien: url,
        source: "scraper_" + enseigne.toLowerCase().replace(/\s+/g, "_") as any,
        image_url: extraction.image,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message, blocked: err.message.includes("BLOCKED") };
  }
}

// ─── Discovery Fallback (DuckDuckGo HTML) ───────────────────────────────────

export async function discoverViaDuckDuckGo(query: string, product: ProductInfo): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result__body').slice(0, 5).each((_, el) => {
      const link = $(el).find('.result__a').attr('href');
      const title = $(el).find('.result__a').text().trim();
      if (link && !link.includes('duckduckgo.com')) {
        results.push({
          enseigne: "Discovery",
          titre: title,
          prix: null,
          prix_status: "not_found",
          lien: link,
          source: "scraper_duckduckgo" as any,
          relevance_score: calculateRelevanceScore(title, link, product),
          retrieved_at: new Date().toISOString(),
        });
      }
    });
    return results;
  } catch {
    return [];
  }
}

// ─── Scrapers List ───────────────────────────────────────────────────────────

export interface FallbackScraper {
  name: string;
  source: ResultSource;
  fn: (query: string, product: ProductInfo) => Promise<ScraperResult>;
  enabled: boolean;
}

export const FALLBACK_SCRAPERS: FallbackScraper[] = [
  {
    name: "123elec",
    source: "scraper_123elec",
    fn: (q, p) => scrapeUrl(`https://www.123elec.com/catalogsearch/result/?q=${encodeURIComponent(q)}`, "123elec", p),
    enabled: true,
  },
  {
    name: "ManoMano",
    source: "scraper_manomano",
    fn: (q, p) => scrapeUrl(`https://www.manomano.fr/recherche/${encodeURIComponent(q)}`, "ManoMano", p),
    enabled: true,
  },
  {
    name: "Leroy Merlin",
    source: "scraper_leroymerlin",
    fn: (q, p) => scrapeUrl(`https://www.leroymerlin.fr/recherche?q=${encodeURIComponent(q)}`, "Leroy Merlin", p),
    enabled: true,
  },
  {
    name: "Bricozor",
    source: "scraper_bricozor",
    fn: (q, p) => scrapeUrl(`https://www.bricozor.com/recherche?q=${encodeURIComponent(q)}`, "Bricozor", p),
    enabled: true,
  },
];

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function runFallbackScrapers(
  query: string,
  product: ProductInfo,
  existingEnseignes: Set<string> = new Set(),
  onResult?: (result: SearchResult, scraperName: string) => void
): Promise<{ results: SearchResult[]; stats: any }> {
  const allResults: SearchResult[] = [];
  const stats = { success: [] as string[], blocked: [] as string[] };

  // 1. Discovery Fallback
  console.log("[FallbackScrapers] Tentative de découverte via DuckDuckGo...");
  const discoveryResults = await discoverViaDuckDuckGo(query, product);
  for (const r of discoveryResults) {
    if (r.relevance_score > 30) {
      allResults.push(r);
      if (onResult) onResult(r, "DuckDuckGo");
    }
  }

  // 2. Scrapers Internes
  for (const scraper of FALLBACK_SCRAPERS) {
    if (existingEnseignes.has(scraper.name)) continue;
    console.log(`[FallbackScrapers] START: ${scraper.name}`);
    const res = await scraper.fn(query, product);
    if (res.success && res.result) {
      allResults.push(res.result);
      if (onResult) onResult(res.result, scraper.name);
      stats.success.push(scraper.name);
    } else if (res.blocked) {
      stats.blocked.push(scraper.name);
    }
    await randomDelay();
  }

  return { results: allResults, stats };
}
