import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore, calculateUrlQuality } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v3)
 * 
 * Améliorations v3 :
 * - Extraction générique (JSON-LD, Meta tags, Sélecteurs communs)
 * - Support étendu : Leroy Merlin, Brico Dépôt, Bricomarché, Entrepôt, Gedimat
 * - Logging amélioré (stratégie, succès/échec)
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL_SCRAPERS || "2");
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || "800");
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || "2500");
const MAX_CONSECUTIVE_403 = parseInt(process.env.MAX_CONSECUTIVE_403 || "2");
const SCRAPER_TIMEOUT_MS = 15000; // 15s max par scraper
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || "20");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Logging Helpers ──────────────────────────────────────────────────────────

function logScraper(enseigne: string, message: string) {
  console.log(`[Scraper][${enseigne}] ${message}`);
}

function logExtraction(enseigne: string, strategy: string, success: boolean, error?: string) {
  const status = success ? "SUCCESS" : "FAILURE";
  console.log(`[Extraction][${enseigne}] ${status} | Strategy: ${strategy}${error ? ` | Error: ${error}` : ""}`);
}

// ─── Fetch stealth ────────────────────────────────────────────────────────────

async function fetchStealth(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
      cache: "no-store",
    });
    clearTimeout(timeout);

    if (response.status === 403 || response.status === 429 || response.status === 503) {
      throw new Error(`BLOCKED_${response.status}`);
    }
    return response;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("TIMEOUT");
    throw err;
  }
}

// ─── Extraction Générique ──────────────────────────────────────────────────────

function parsePriceText(text: string): number | null {
  if (!text) return null;
  // Nettoyer le texte (espaces insécables, devises, etc.)
  const cleanText = text.replace(/\s/g, "").replace(",", ".");
  const match = cleanText.match(/(\d+\.?\d*)/);
  if (!match) return null;
  const price = parseFloat(match[1]);
  return !isNaN(price) && price > 0 && price < 50000 ? price : null;
}

/**
 * Extrait les données d'un produit depuis du HTML de manière générique.
 * Stratégies : JSON-LD > Meta Tags > Common Selectors
 */
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

  // 1. JSON-LD (le plus fiable)
  try {
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((_, el) => {
      try {
        const content = $(el).text().trim();
        if (!content) return;
        const json = JSON.parse(content);
        
        const processObject = (obj: any) => {
          if (!obj) return;
          if (Array.isArray(obj)) {
            obj.forEach(processObject);
            return;
          }
          if (obj["@graph"] && Array.isArray(obj["@graph"])) {
            obj["@graph"].forEach(processObject);
            return;
          }
          
          if (obj["@type"] === "Product" || obj["@type"]?.includes("Product")) {
            if (!titre) titre = obj.name;
            if (!image) image = Array.isArray(obj.image) ? obj.image[0] : (typeof obj.image === 'string' ? obj.image : obj.image?.url);
            
            const offers = Array.isArray(obj.offers) ? obj.offers : (obj.offers ? [obj.offers] : []);
            for (const offer of offers) {
              if (offer.price) {
                const p = parsePriceText(offer.price.toString());
                if (p) {
                  prix = p;
                  strategy = "json-ld";
                }
              }
            }
          }
        };
        processObject(json);
      } catch (e) {}
    });
  } catch (e) {}

  if (prix) return { prix, titre, image, strategy };

  // 2. Meta Tags (OpenGraph / Product)
  const ogPrice = $('meta[property="og:price:amount"]').attr('content') || 
                  $('meta[property="product:price:amount"]').attr('content') ||
                  $('meta[name="twitter:data1"]').attr('content') ||
                  $('meta[property="og:price"]').attr('content');
  
  if (ogPrice) {
    prix = parsePriceText(ogPrice);
    if (prix) strategy = "meta-tags";
  }

  if (!titre) {
    titre = $('meta[property="og:title"]').attr('content') || 
            $('meta[name="twitter:title"]').attr('content') || 
            $('h1').first().text().trim() || 
            $('title').text().trim();
  }

  if (!image) {
  image = $('meta[property="og:image"]').attr('content') || 
          $('meta[name="twitter:image"]').attr('content') ||
          $('meta[property="product:image:url"]').attr('content') ||
          null;
}

  if (prix) return { prix, titre, image, strategy };

  // 3. Common Selectors (Fallbacks)
  const priceSelectors = [
    '.price', '[class*="price"]:not([class*="strike"])', 
    '.product-price', '.current-price', '#priceblock_ourprice',
    '.price-value', '.amount'
  ];
  for (const sel of priceSelectors) {
    const text = $(sel).first().text().trim();
    if (text) {
      const p = parsePriceText(text);
      if (p) {
        prix = p;
        strategy = "selectors";
        break;
      }
    }
  }

  return { prix, titre, image, strategy };
}

// ─── Scraper Interface ────────────────────────────────────────────────────────

interface ScraperResult {
  success: boolean;
  result?: SearchResult;
  error?: string;
  blocked?: boolean;
}

/**
 * Tente d'extraire des infos depuis une URL spécifique (ex: trouvée par Google)
 */
export async function scrapeUrl(
  url: string,
  enseigne: string,
  product: ProductInfo
): Promise<ScraperResult> {
  // Mapping enseigne vers source
  const sourceMap: Record<string, ResultSource> = {
    "Leroy Merlin": "scraper_leroymerlin",
    "Brico Dépôt": "scraper_bricodepot",
    "Bricomarché": "scraper_bricomarche",
    "L'Entrepôt du Bricolage": "scraper_entrepot_du_bricolage",
    "Gedimat": "scraper_gedimat",
    "123elec": "scraper_123elec",
    "ManoMano": "scraper_manomano",
    "Bricozor": "scraper_bricozor",
    "Amazon": "scraper_amazon",
  };

  const source = sourceMap[enseigne] || "scraper_leroymerlin";

  try {
    const urlQuality = calculateUrlQuality(url);
    // On ne rejette que si le score de qualité est extrêmement bas (page search évidente)
    if (urlQuality < 0.4) {
      logScraper(enseigne, `SKIP: Qualité URL trop faible (${urlQuality}), probablement une page listing.`);
      return { success: false, error: "low_url_quality" };
    }

    logScraper(enseigne, `Fetch URL: ${url.substring(0, 80)}...`);
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const extraction = extractGenericHTML(html, $);
    logExtraction(enseigne, extraction.strategy, !!extraction.prix, extraction.prix ? undefined : "price_not_found");

    const score = extraction.titre ? calculateRelevanceScore(extraction.titre, url, product) : 30;

    return {
      success: true,
      result: {
        enseigne,
        titre: extraction.titre || `Produit ${enseigne}`,
        prix: extraction.prix,
        prix_status: extraction.prix ? "detected" : "not_found",
        lien: url,
        source,
        image_url: extraction.image,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      }
    };
  } catch (err: any) {
    logExtraction(enseigne, "none", false, err.message);
    return { 
      success: false, 
      error: err.message, 
      blocked: err.message.includes("BLOCKED") 
    };
  }
}

// ─── Scrapers Spécifiques (Wrappers) ──────────────────────────────────────────

async function scrapeSearchGeneric(
  name: string,
  searchPattern: string,
  source: ResultSource,
  query: string,
  product: ProductInfo
): Promise<ScraperResult> {
  const url = searchPattern.replace("{{query}}", encodeURIComponent(query));
  return scrapeUrl(url, name, product);
}

// ─── Définition des scrapers disponibles ─────────────────────────────────────

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
    fn: (q, p) => scrapeSearchGeneric("123elec", "https://www.123elec.com/catalogsearch/result/?q={{query}}", "scraper_123elec", q, p),
    enabled: true,
  },
  {
    name: "ManoMano",
    source: "scraper_manomano",
    fn: (q, p) => scrapeSearchGeneric("ManoMano", "https://www.manomano.fr/recherche/{{query}}", "scraper_manomano", q, p),
    enabled: true,
  },
  {
    name: "Bricozor",
    source: "scraper_bricozor",
    fn: (q, p) => scrapeSearchGeneric("Bricozor", "https://www.bricozor.com/recherche?q={{query}}", "scraper_bricozor", q, p),
    enabled: true,
  },
  {
    name: "Leroy Merlin",
    source: "scraper_leroymerlin",
    fn: (q, p) => scrapeSearchGeneric("Leroy Merlin", "https://www.leroymerlin.fr/recherche?q={{query}}", "scraper_leroymerlin", q, p),
    enabled: true,
  },
  {
    name: "Brico Dépôt",
    source: "scraper_bricodepot",
    fn: (q, p) => scrapeSearchGeneric("Brico Dépôt", "https://www.bricodepot.fr/recherche/search.jsp?query={{query}}", "scraper_bricodepot", q, p),
    enabled: true,
  },
  {
    name: "Bricomarché",
    source: "scraper_bricomarche",
    fn: (q, p) => scrapeSearchGeneric("Bricomarché", "https://www.bricomarche.com/recherche?text={{query}}", "scraper_bricomarche", q, p),
    enabled: true,
  },
  {
    name: "L'Entrepôt du Bricolage",
    source: "scraper_entrepot_du_bricolage",
    fn: (q, p) => scrapeSearchGeneric("L'Entrepôt du Bricolage", "https://www.entrepot-du-bricolage.fr/recherche?q={{query}}", "scraper_entrepot_du_bricolage", q, p),
    enabled: true,
  },
  {
    name: "Gedimat",
    source: "scraper_gedimat",
    fn: (q, p) => scrapeSearchGeneric("Gedimat", "https://www.gedimat.fr/recherche.php?q={{query}}", "scraper_gedimat", q, p),
    enabled: true,
  },
  {
    name: "Amazon",
    source: "scraper_amazon",
    fn: (q, p) => scrapeSearchGeneric("Amazon", "https://www.amazon.fr/s?k={{query}}", "scraper_amazon", q, p),
    enabled: true,
  },
];

// ─── Orchestration fallback ───────────────────────────────────────────────────

export interface FallbackResult {
  results: SearchResult[];
  stats: {
    tried: string[];
    success: string[];
    blocked: string[];
    errors: string[];
  };
}

export async function runFallbackScrapers(
  query: string,
  product: ProductInfo,
  existingEnseignes: Set<string> = new Set(),
  onResult?: (result: SearchResult, scraperName: string) => void
): Promise<FallbackResult> {
  const activeScrapers = FALLBACK_SCRAPERS.filter(s => s.enabled);
  const allResults: SearchResult[] = [];
  const stats = { tried: [] as string[], success: [] as string[], blocked: [] as string[], errors: [] as string[] };

  let consecutiveBlocked = 0;

  for (let i = 0; i < activeScrapers.length; i++) {
    if (consecutiveBlocked >= MAX_CONSECUTIVE_403) {
      console.log(`[FallbackScrapers] STOP: ${consecutiveBlocked} blocages consécutifs`);
      break;
    }

    const batch = activeScrapers.slice(i, i + MAX_PARALLEL);

    const batchPromises = batch.map(async (scraper) => {
      stats.tried.push(scraper.name);
      
      // Ne pas lancer si l'enseigne est déjà présente avec un prix
      if (existingEnseignes.has(scraper.name)) {
        logScraper(scraper.name, "Déjà trouvé, skip");
        return;
      }

      logScraper(scraper.name, "START");
      const scraperResult = await scraper.fn(query, product);

      if (scraperResult.blocked) {
        consecutiveBlocked++;
        stats.blocked.push(scraper.name);
      } else if (scraperResult.success && scraperResult.result) {
        consecutiveBlocked = 0;
        const result = scraperResult.result;

        stats.success.push(scraper.name);
        allResults.push(result);
        if (onResult) onResult(result, scraper.name);
        logScraper(scraper.name, `FIN: ${result.prix ? result.prix + "€" : "pas de prix"}`);
      } else {
        consecutiveBlocked = Math.max(0, consecutiveBlocked - 1);
        stats.errors.push(scraper.name);
        logScraper(scraper.name, `ECHEC: ${scraperResult.error}`);
      }
    });

    await Promise.all(batchPromises);
    i += MAX_PARALLEL - 1;

    if (i < activeScrapers.length - 1 && consecutiveBlocked < MAX_CONSECUTIVE_403) {
      await randomDelay();
    }
  }

  return { results: allResults, stats };
}
