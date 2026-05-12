import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v8)
 * 
 * Améliorations v8 :
 * - Filtrage strict des URLs (exclusion des gammes/catégories)
 * - Sélecteurs spécifiques par marchand pour extraire les vraies fiches produits
 * - Logging détaillé des URLs acceptées/rejetées
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = 3;
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;

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
    return await fetch(url, {
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
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

    const sourceName = ("scraper_" + enseigne.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")) as ResultSource;

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
    return { success: false, error: err.message, blocked: err.message.includes("BLOCKED") };
  }
}

interface ScraperResult {
  success: boolean;
  result?: SearchResult;
  results?: SearchResult[];
  error?: string;
  blocked?: boolean;
}

// ─── Discovery Helpers ───────────────────────────────────────────────────────

function extractProbableProductLinks($: cheerio.CheerioAPI, baseUrl: string, merchantName: string): string[] {
  const links: string[] = [];
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;

  // Sélecteurs spécifiques pour cibler les grilles de produits
  const productSelectors = [
    '.product-list__item a', '.product-card a', '.product-item a', 
    '.product-item-link', '.thumb-link', '.product-anchor',
    '.s-item__link', '.a-link-normal.s-no-outline'
  ];

  const targetElements = productSelectors.length > 0 ? $(productSelectors.join(',')) : $('a');

  targetElements.each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;
    
    if (href.startsWith('/')) href = origin + href;
    if (!href.startsWith('http')) return;

    // Nettoyage des paramètres de tracking
    const cleanUrl = href.split('?')[0].split('#')[0];

    // Patterns EXCLUSIFS (Pages de navigation/listing)
    const negativePatterns = [
      '/search', '/recherche', '/catalogsearch', '/categorie', '/category', 
      '/rayon', '/univers', '/gamme', '/collection', '/listing', '/marque',
      '/univers-', '/rayon-', '/collections-', '/marques-'
    ];

    const isNegative = negativePatterns.some(p => cleanUrl.toLowerCase().includes(p));
    
    // Patterns POSITIFS (Vraies fiches produits)
    const positivePatterns = [
      '/p/', '/produit/', '/product/', '/article/', '/item/', 
      /\d{8,13}/, // EAN ou ID long
      /\.html$/
    ];

    const isPositive = positivePatterns.some(p => {
      if (p instanceof RegExp) return p.test(cleanUrl);
      return cleanUrl.toLowerCase().includes(p);
    });

    if (isPositive && !isNegative) {
      links.push(cleanUrl);
    } else if (isNegative) {
      // Log optionnel pour le debug
      // logDiscovery(merchantName, `REJECT (Category/Gamme): ${cleanUrl.substring(0, 50)}...`);
    }
  });

  const uniqueLinks = Array.from(new Set(links)).slice(0, 5);
  logDiscovery(merchantName, `Extracted ${uniqueLinks.length} product-only URLs (Rejected obvious categories)`);
  return uniqueLinks;
}

// ─── Discovery Fallback ──────────────────────────────────────────────────────

export async function discoverViaMerchantSearch(
  name: string,
  searchPattern: string,
  product: ProductInfo
): Promise<SearchResult[]> {
  const query = product.ean || product.designation || "";
  const url = searchPattern.replace("{{query}}", encodeURIComponent(query));
  logDiscovery(name, `Searching internal: ${url.substring(0, 80)}...`);

  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 1. Direct hit?
    const extraction = extractGenericHTML(html, $);
    if (extraction.prix && extraction.titre) {
      logDiscovery(name, "SUCCESS: Direct product hit detected");
      return [{
        enseigne: name,
        titre: extraction.titre,
        prix: extraction.prix,
        prix_status: "detected",
        lien: response.url,
        source: ("scraper_" + name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")) as ResultSource,
        relevance_score: calculateRelevanceScore(extraction.titre, response.url, product),
        retrieved_at: new Date().toISOString(),
      }];
    }

    // 2. Extract probable links
    const productLinks = extractProbableProductLinks($, url, name);

    return productLinks.map(link => ({
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
    logDiscovery(name, `Discovery error: ${err.message}`);
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
    return results;
  } catch {
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

  logDiscovery("System", `--- START FALLBACK PIPELINE ---`);

  // 1. DuckDuckGo
  try {
    const ddg = await discoverViaDuckDuckGo(query, product);
    ddg.forEach(r => { 
      if ((r.relevance_score ?? 0) > 25) { 
        allResults.push(r); 
        candidateCount++; 
        if (onResult) onResult(r, "DuckDuckGo"); 
      } 
    });
  } catch {}

  // 2. Merchants
  for (const merchant of MERCHANTS) {
    if (existingEnseignes.has(merchant.name)) continue;
    try {
      const merchantResults = await discoverViaMerchantSearch(merchant.name, merchant.searchPattern, product);
      merchantResults.forEach(r => { 
        allResults.push(r); 
        candidateCount++; 
        if (onResult) onResult(r, merchant.name);
        if (r.prix !== null) stats.success.push(merchant.name);
      });
    } catch {}
    await randomDelay();
  }

  // 3. Final Scrape
  const toScrape = allResults.filter(r => r.prix === null).slice(0, 6);
  if (toScrape.length > 0) {
    logScraper("System", `Validating ${toScrape.length} product candidates...`);
    await Promise.all(toScrape.map(async (r) => {
      const res = await scrapeUrl(r.lien, r.enseigne, product);
      if (res.success && res.result?.prix) {
        r.prix = res.result.prix;
        r.prix_status = "detected";
        r.titre = res.result.titre;
        r.image_url = res.result.image_url;
        if (onResult) onResult(r, r.enseigne);
        stats.success.push(r.enseigne);
      }
    }));
  }

  logDiscovery("System", `--- END FALLBACK PIPELINE (Found ${candidateCount} candidates) ---`);
  return { results: allResults, stats };
}
