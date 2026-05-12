import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v7)
 * 
 * Améliorations v7 :
 * - Restauration complète du flux de découverte (DEBUG logs à chaque étape)
 * - Isolation des erreurs DDG/Marchands pour éviter tout blocage
 * - Compteurs de debug pour le monitoring
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = 3;
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
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
  const selectors = ['.price', '.product-price', '#priceblock_ourprice', '.current-price', '.amount'];
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

    const isProbable = (
      href.includes('/p/') || 
      href.includes('/produit/') || 
      href.includes('/product/') ||
      /\d{8,13}/.test(href) ||
      href.endsWith('.html')
    );
    
    const isSearch = href.includes('recherche') || href.includes('search') || href.includes('?q=');

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
  const query = product.ean || product.designation || "";
  const url = searchPattern.replace("{{query}}", encodeURIComponent(query));
  logDiscovery(name, `START: ${url.substring(0, 80)}...`);

  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const extraction = extractGenericHTML(html, $);
    if (extraction.prix) {
      logDiscovery(name, "SUCCESS: Direct product hit");
      const res = await scrapeUrl(response.url, name, product);
      return res.result ? [res.result] : [];
    }

    const candidateLinks = extractProbableProductLinks($, url);
    logDiscovery(name, `SUCCESS: Found ${candidateLinks.length} candidate links`);

    return candidateLinks.map(link => ({
      enseigne: name,
      titre: `Découverte ${name}`,
      prix: null,
      prix_status: "not_found",
      lien: link,
      source: ("scraper_" + name.toLowerCase().replace(/\s+/g, "_")) as ResultSource,
      relevance_score: 40,
      retrieved_at: new Date().toISOString(),
    }));
  } catch (err: any) {
    logDiscovery(name, `ERROR: ${err.message}`);
    return [];
  }
}

export async function discoverViaDuckDuckGo(query: string, product: ProductInfo): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  logDiscovery("DuckDuckGo", `START: ${url}`);

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
    logDiscovery("DuckDuckGo", `SUCCESS: Found ${results.length} links`);
    return results;
  } catch (err: any) {
    logDiscovery("DuckDuckGo", `ERROR: ${err.message}`);
    return [];
  }
}

// ─── Scrapers & Discovery List ───────────────────────────────────────────────

const MERCHANTS = [
  { name: "Leroy Merlin", searchPattern: "https://www.leroymerlin.fr/recherche?q={{query}}" },
  { name: "Brico Dépôt", searchPattern: "https://www.bricodepot.fr/recherche/search.jsp?query={{query}}" },
  { name: "ManoMano", searchPattern: "https://www.manomano.fr/recherche/{{query}}" },
  { name: "Bricomarché", searchPattern: "https://www.bricomarche.com/recherche?text={{query}}" },
  { name: "Gedimat", searchPattern: "https://www.gedimat.fr/recherche.php?q={{query}}" },
  { name: "123elec", searchPattern: "https://www.123elec.com/catalogsearch/result/?q={{query}}" },
];

export const FALLBACK_SCRAPERS = MERCHANTS.map(m => ({
  name: m.name,
  source: ("scraper_" + m.name.toLowerCase().replace(/\s+/g, "_")) as ResultSource,
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
  let candidateCount = 0;

  logDiscovery("System", `--- START FALLBACK PIPELINE (Query: ${query}) ---`);

  // 1. DuckDuckGo Discovery
  try {
    const ddgResults = await discoverViaDuckDuckGo(query, product);
    for (const r of ddgResults) {
      if (r.relevance_score && r.relevance_score > 25) {
        allResults.push(r);
        candidateCount++;
        if (onResult) onResult(r, "DuckDuckGo");
      }
    }
  } catch (e: any) { logDiscovery("System", `DDG Step failed: ${e.message}`); }

  // 2. Merchant Internal Discovery
  for (const merchant of MERCHANTS) {
    if (existingEnseignes.has(merchant.name)) continue;
    try {
      const results = await discoverViaMerchantSearch(merchant.name, merchant.searchPattern, product);
      for (const r of results) {
        allResults.push(r);
        candidateCount++;
        if (onResult) onResult(r, merchant.name);
        if (r.prix !== null) stats.success.push(merchant.name);
      }
    } catch (e: any) { logDiscovery(merchant.name, `Discovery failed: ${e.message}`); }
    await randomDelay();
  }

  logDiscovery("System", `Total candidates found: ${candidateCount}`);

  // 3. Extraction des prix pour les liens découverts
  const toScrape = allResults.filter(r => r.prix === null).slice(0, 6);
  if (toScrape.length > 0) {
    logScraper("System", `Extracting prices for ${toScrape.length} links...`);
    await Promise.all(toScrape.map(async (r) => {
      try {
        const res = await scrapeUrl(r.lien, r.enseigne, product);
        if (res.success && res.result?.prix) {
          r.prix = res.result.prix;
          r.prix_status = "detected";
          r.titre = res.result.titre;
          r.image_url = res.result.image_url;
          if (onResult) onResult(r, r.enseigne);
          stats.success.push(r.enseigne);
        } else if (res.blocked) {
          stats.blocked.push(r.enseigne);
        }
      } catch (e) {}
    }));
  }

  logDiscovery("System", `--- END FALLBACK PIPELINE (Success: ${stats.success.length}) ---`);
  return { results: allResults, stats };
}
