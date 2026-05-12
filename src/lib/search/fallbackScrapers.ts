import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore, estimateProductPageProbability } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v6)
 * 
 * Améliorations v6 :
 * - Découverte par recherche interne marchands (Discovery)
 * - Extraction de liens produits probables depuis les listings
 * - Logging détaillé de la phase de découverte
 * - Tolérance accrue aux variations d'URLs
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = 3;
const MIN_DELAY_MS = 400;
const MAX_DELAY_MS = 1200;
const MAX_CONSECUTIVE_403 = 3;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0];
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Logging Helpers ──────────────────────────────────────────────────────────

function logDiscovery(source: string, message: string) {
  console.log(`[Discovery][${source}] ${message}`);
}

function logScraper(enseigne: string, message: string) {
  console.log(`[Scraper][${enseigne}] ${message}`);
}

function logExtraction(enseigne: string, strategy: string, success: boolean, error?: string) {
  const status = success ? "SUCCESS" : "FAILURE";
  console.log(`[Extraction][${enseigne}] ${status} | Strategy: ${strategy}${error ? ` | Error: ${error}` : ""}`);
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
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
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

function parsePriceText(text: string | null | undefined): number | null {
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
        const text = $(el).text();
        if (!text) return;
        const json = JSON.parse(text);
        
        const findProduct = (obj: any) => {
          if (!obj) return;
          if (Array.isArray(obj)) { obj.forEach(findProduct); return; }
          if (obj["@type"] === "Product" || obj["@type"]?.includes("Product")) {
            if (!titre && obj.name) titre = String(obj.name);
            if (!image) {
              const img = Array.isArray(obj.image) ? obj.image[0] : (obj.image?.url || obj.image);
              if (img) image = String(img);
            }
            if (obj.offers?.price) { 
              prix = parsePriceText(String(obj.offers.price)); 
              strategy = "json-ld"; 
            }
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

  if (!titre) titre = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || null;
  if (!image) image = $('meta[property="og:image"]').attr('content') || null;

  if (prix) return { prix, titre, image, strategy };

  // 3. Selectors
  const selectors = ['.price', '.product-price', '#priceblock_ourprice', '.current-price', '.amount', '.value'];
  for (const s of selectors) {
    const text = $(s).first().text().trim();
    const p = parsePriceText(text);
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

    const sourceName = ("scraper_" + enseigne.toLowerCase().replace(/\s+/g, "_")) as ResultSource;

    logExtraction(enseigne, extraction.strategy, !!extraction.prix);

    return {
      success: true,
      result: {
        enseigne,
        titre: extraction.titre || `Produit ${enseigne}`,
        prix: extraction.prix,
        prix_status: (extraction.prix ? "detected" : "not_found") as PrixStatus,
        lien: url,
        source: sourceName,
        image_url: extraction.image,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      }
    };
  } catch (err: any) {
    logExtraction(enseigne, "none", false, err.message);
    return { success: false, error: err.message, blocked: err.message.includes("BLOCKED") };
  }
}

// ─── Discovery Helpers ───────────────────────────────────────────────────────

function extractProbableProductLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;

  $('a').each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;
    
    if (href.startsWith('/')) href = origin + href;
    if (!href.startsWith('http')) return;

    // Patterns de fiches produits
    const isProbable = (
      href.includes('/p/') || 
      href.includes('/produit/') || 
      href.includes('/product/') ||
      href.includes('-p-') ||
      /\d{8,13}/.test(href) ||
      href.endsWith('.html')
    );
    
    const isSearch = href.includes('recherche') || href.includes('search') || href.includes('category') || href.includes('?q=');

    if (isProbable && !isSearch) {
      links.push(href);
    }
  });

  return Array.from(new Set(links)).slice(0, 5);
}

// ─── Discovery Fallback ──────────────────────────────────────────────────────

export async function discoverViaMerchantSearch(
  name: string,
  searchPattern: string,
  product: ProductInfo
): Promise<SearchResult[]> {
  const url = searchPattern.replace("{{query}}", encodeURIComponent(product.ean || product.designation || ""));
  logDiscovery(name, `Searching internal: ${url.substring(0, 60)}...`);

  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Est-ce une redirection directe vers un produit ?
    const extraction = extractGenericHTML(html, $);
    if (extraction.prix) {
      logDiscovery(name, "Direct product page hit!");
      const res = await scrapeUrl(response.url, name, product);
      return res.result ? [res.result] : [];
    }

    // Sinon, extraire les liens des résultats
    const candidateLinks = extractProbableProductLinks($, url);
    logDiscovery(name, `Found ${candidateLinks.length} candidate URLs`);

    const results: SearchResult[] = [];
    for (const link of candidateLinks) {
      // On ne scrape pas tout de suite, on garde le lien
      results.push({
        enseigne: name,
        titre: `Découverte ${name}`,
        prix: null,
        prix_status: "not_found",
        lien: link,
        source: ("scraper_" + name.toLowerCase().replace(/\s+/g, "_")) as ResultSource,
        relevance_score: 40, // Score arbitraire pour discovery
        retrieved_at: new Date().toISOString(),
      });
    }
    return results;
  } catch (err: any) {
    logDiscovery(name, `Discovery failed: ${err.message}`);
    return [];
  }
}

export async function discoverViaDuckDuckGo(query: string, product: ProductInfo): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  logDiscovery("DuckDuckGo", `Searching DDG: ${url}`);

  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result__body').slice(0, 10).each((_, el) => {
      const link = $(el).find('.result__a').attr('href');
      const title = $(el).find('.result__a').text().trim();
      if (link && !link.includes('duckduckgo.com')) {
        results.push({
          enseigne: "Discovery",
          titre: title,
          prix: null,
          prix_status: "not_found",
          lien: link,
          source: "scraper_duckduckgo" as ResultSource,
          relevance_score: calculateRelevanceScore(title, link, product),
          retrieved_at: new Date().toISOString(),
        });
      }
    });
    logDiscovery("DuckDuckGo", `Found ${results.length} links`);
    return results;
  } catch {
    return [];
  }
}

// ─── Scrapers & Discovery List ───────────────────────────────────────────────

interface MerchantConfig {
  name: string;
  searchPattern: string;
}

const MERCHANTS: MerchantConfig[] = [
  { name: "Leroy Merlin", searchPattern: "https://www.leroymerlin.fr/recherche?q={{query}}" },
  { name: "Brico Dépôt", searchPattern: "https://www.bricodepot.fr/recherche/search.jsp?query={{query}}" },
  { name: "ManoMano", searchPattern: "https://www.manomano.fr/recherche/{{query}}" },
  { name: "Bricomarché", searchPattern: "https://www.bricomarche.com/recherche?text={{query}}" },
  { name: "Gedimat", searchPattern: "https://www.gedimat.fr/recherche.php?q={{query}}" },
  { name: "123elec", searchPattern: "https://www.123elec.com/catalogsearch/result/?q={{query}}" },
];

export interface FallbackScraper {
  name: string;
  source: ResultSource;
  fn: (query: string, product: ProductInfo) => Promise<ScraperResult>;
  enabled: boolean;
}

export const FALLBACK_SCRAPERS: FallbackScraper[] = MERCHANTS.map(m => ({
  name: m.name,
  source: ("scraper_" + m.name.toLowerCase().replace(/\s+/g, "_")) as ResultSource,
  fn: (q, p) => scrapeUrl(m.searchPattern.replace("{{query}}", encodeURIComponent(q)), m.name, p),
  enabled: true,
}));

// ─── Orchestration ───────────────────────────────────────────────────────────

export async function runFallbackScrapers(
  query: string,
  product: ProductInfo,
  existingEnseignes: Set<string> = new Set(),
  onResult?: (result: SearchResult, scraperName: string) => void
): Promise<{ results: SearchResult[]; stats: { success: string[]; blocked: string[] } }> {
  const allResults: SearchResult[] = [];
  const stats = { success: [] as string[], blocked: [] as string[] };

  // 1. Discovery Fallback (DDG)
  logDiscovery("System", "Starting fallback discovery...");
  const discoveryResults = await discoverViaDuckDuckGo(query, product);
  for (const r of discoveryResults) {
    if (r.relevance_score && r.relevance_score > 25) {
      allResults.push(r);
      if (onResult) onResult(r, "DuckDuckGo");
    }
  }

  // 2. Merchant Internal Search Discovery
  for (const merchant of MERCHANTS) {
    if (existingEnseignes.has(merchant.name)) continue;
    
    const results = await discoverViaMerchantSearch(merchant.name, merchant.searchPattern, product);
    for (const r of results) {
      allResults.push(r);
      if (onResult) onResult(r, merchant.name);
      if (r.prix !== null) stats.success.push(merchant.name);
    }
    await randomDelay();
  }

  // 3. Final Scrape for links without prices
  const missingPrice = allResults.filter(r => r.prix === null).slice(0, 5);
  if (missingPrice.length > 0) {
    logScraper("System", `Extracting prices for ${missingPrice.length} discovered links...`);
    await Promise.all(missingPrice.map(async (r) => {
      const res = await scrapeUrl(r.lien, r.enseigne, product);
      if (res.success && res.result?.prix) {
        r.prix = res.result.prix;
        r.prix_status = "detected";
        r.titre = res.result.titre;
        r.image_url = res.result.image_url;
        if (onResult) onResult(r, r.enseigne);
      }
    }));
  }

  return { results: allResults, stats };
}
