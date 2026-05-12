import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v8 - Vercel Optimized)
 * 
 * Améliorations v8 :
 * - Timeouts explicites sur TOUS les fetchs (évite de pendre sur Vercel)
 * - Logs console.log inévitables pour le monitoring
 * - Chronométrage des étapes
 * - Isolation totale des erreurs de découverte
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = 3;
const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 8000; // 8s max par requête

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0];
}

function randomDelay(): Promise<void> {
  const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS) + MIN_DELAY_MS);
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Fetch stealth avec Timeout ───────────────────────────────────────────────

async function fetchStealth(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);

    if (response.status === 403 || response.status === 429) {
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
            if (obj.offers?.price) { prix = parsePriceText(String(obj.offers.price)); strategy = "json-ld"; }
          }
          if (obj["@graph"]) findProduct(obj["@graph"]);
        };
        findProduct(json);
      } catch {}
    });
  } catch {}

  if (!prix) {
    prix = parsePriceText($('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content'));
    if (prix) strategy = "meta-tags";
  }

  if (!titre) titre = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || null;
  if (!image) image = $('meta[property="og:image"]').attr('content') || null;

  if (!prix) {
    const selectors = ['.price', '.product-price', '#priceblock_ourprice', '.current-price', '.amount'];
    for (const s of selectors) {
      const text = $(s).first().text().trim();
      const p = parsePriceText(text);
      if (p) { prix = p; strategy = "selectors"; break; }
    }
  }

  // Fallback: Extraction via JSON __NEXT_DATA__ ou similar
  if (!prix && html.includes("__NEXT_DATA__")) {
    try {
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match && match[1]) {
        const data = JSON.parse(match[1]);
        // Tentative d'extraction récursive simple
        const findPrice = (obj: any): any => {
          if (!obj || typeof obj !== "object") return;
          if (obj.price && typeof obj.price === "number") return obj.price;
          if (obj.priceValue && typeof obj.priceValue === "number") return obj.priceValue;
          for (const k in obj) {
            const res = findPrice(obj[k]);
            if (res) return res;
          }
        };
        const p = findPrice(data);
        if (p) { prix = p; strategy = "next-data"; }
      }
    } catch {}
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
  const start = Date.now();
  try {
    console.log(`[SCRAPER START] ${enseigne} | ${url.substring(0, 50)}...`);
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const extraction = extractGenericHTML(html, $);
    const score = calculateRelevanceScore(extraction.titre || "", url, product);
    const sourceName = ("scraper_" + enseigne.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")) as ResultSource;

    console.log(`[SCRAPER SUCCESS] ${enseigne} | Price: ${extraction.prix}€ | Strategy: ${extraction.strategy} | Score: ${score}% | ${Date.now() - start}ms`);

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
    console.log(`[SCRAPER FAILURE] ${enseigne} | Error: ${err.message} | ${Date.now() - start}ms`);
    return { success: false, error: err.message, blocked: err.message.includes("BLOCKED") };
  }
}

// ─── Discovery Fallback ──────────────────────────────────────────────────────

export async function discoverViaMerchantSearch(
  name: string,
  searchPattern: string,
  product: ProductInfo,
  onDebug?: (category: string, message: string) => void
): Promise<SearchResult[]> {
  const start = Date.now();
  const query = product.ean || product.designation || "";
  const url = searchPattern.replace("{{query}}", encodeURIComponent(query));
  
  if (onDebug) onDebug("merchant_search", `Starting ${name} search: ${url}`);

  try {
    const response = await fetchStealth(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    if (onDebug) {
      onDebug("merchant_html", `${name} | Status: ${response.status} | Length: ${html.length}`);
      if (html.includes("id=\"__NEXT_DATA__\"")) onDebug("merchant_html", `${name} | JS-only detected (__NEXT_DATA__)`);
      if (html.includes("application/ld+json")) onDebug("merchant_html", `${name} | JSON-LD found`);
    }

    // Direct hit?
    const extraction = extractGenericHTML(html, $);
    if (extraction.prix && extraction.titre && !html.includes("recherche") && !html.includes("search")) {
      console.log(`[MERCHANT SEARCH SUCCESS] ${name} | DIRECT HIT detected | ${Date.now() - start}ms`);
      const res = await scrapeUrl(response.url, name, product);
      return res.result ? [res.result] : [];
    }

    // Extraction des liens via sélecteurs spécifiques
    const links: string[] = [];
    const origin = new URL(url).origin;

    const selectors = [
      '.product-list__item a', '.prd__link', // Leroy Merlin
      '.product-card a', '.product-link',     // Brico Dépôt
      '[data-test="product-card"] a',         // ManoMano / Castorama
      '.product-item-link', '.product-title a', // Bricomarché / Generic
      'a[href*="/p/"]', 'a[href*="/pr/"]',    // Patterns profonds
      'a[href*="/produits/"]',                // Castorama products
      'a[href*="/produit/"]', 'a[href*="/article/"]'
    ];

    selectors.forEach(sel => {
      const matches = $(sel).length;
      if (matches > 0 && onDebug) onDebug("selector", `${name} | Selector "${sel}" matched ${matches}`);
    });

    let anchorCount = 0;
    $(selectors.join(', ')).each((_, el) => {
      let href = $(el).attr('href');
      if (!href) return;
      if (href.startsWith('/')) href = origin + href;
      if (!href.startsWith('http')) return;
      
      const cleanUrl = href.split('?')[0].split('#')[0].toLowerCase();
      anchorCount++;

      // Heuristiques de validation de lien produit
      const isNeg = [
        '/search', '/recherche', '/categorie', '/univers', '/gamme', 
        '/collection', '/rayon', '/listing', '?q=', 'filter='
      ].some(p => cleanUrl.includes(p));

      const posStrings = ['/p/', '/pr/', '/produit/', '/product/', '/article/'];
      const posRegexes = [/\d{6,13}/, /\.html$/, /\/[a-z0-9-]+-[0-9]{5,}/];

      const isPos = posStrings.some(p => cleanUrl.includes(p)) || 
                    posRegexes.some(r => r.test(cleanUrl));

      if (isPos && !isNeg) {
        links.push(href.split('?')[0]);
      }
    });

    // Fallback: si rien trouvé via sélecteurs, on check TOUS les liens
    if (links.length === 0) {
      console.log(`[MERCHANT SEARCH DEBUG] ${name} | No results via selectors, falling back to all anchors...`);
      $('a').each((_, el) => {
        let href = $(el).attr('href');
        if (!href || href.length < 10) return;
        if (href.startsWith('/')) href = origin + href;
        if (!href.startsWith('http') || href.includes(origin + '/#')) return;

        const cleanUrl = href.split('?')[0].split('#')[0].toLowerCase();
        const isNeg = ['/search', '/recherche', '/categorie', '/univers', '/gamme'].some(p => cleanUrl.includes(p));
        const isPos = ['/p/', '/pr/', '/produit/'].some(p => cleanUrl.includes(p)) || /\.html$/.test(cleanUrl);
        
        if (isPos && !isNeg) links.push(href.split('?')[0]);
      });
    }

    const uniqueLinks = Array.from(new Set(links));
    console.log(`[MERCHANT SEARCH DEBUG] ${name} | Anchors checked: ${anchorCount} | Candidates found: ${uniqueLinks.length}`);
    
    const candidateLinks = uniqueLinks.slice(0, 4);
    if (candidateLinks.length > 0) {
      console.log(`[MERCHANT SEARCH SUCCESS] ${name} | Found ${candidateLinks.length} valid candidates | ${Date.now() - start}ms`);
      candidateLinks.forEach(l => console.log(`   -> ${l.substring(0, 80)}`));
    } else {
      console.log(`[MERCHANT SEARCH SUCCESS] ${name} | NO candidates found | ${Date.now() - start}ms`);
    }

    return candidateLinks.map(link => ({
      enseigne: name,
      titre: `Découverte ${name}`,
      prix: null,
      prix_status: "not_found",
      lien: link,
      source: ("scraper_" + name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")) as ResultSource,
      relevance_score: 40,
      retrieved_at: new Date().toISOString(),
    }));
  } catch (err: any) {
    console.log(`[MERCHANT SEARCH FAILURE] ${name} | Error: ${err.message} | ${Date.now() - start}ms`);
    return [];
  }
}

export async function discoverViaDuckDuckGo(query: string, product: ProductInfo): Promise<SearchResult[]> {
  const start = Date.now();
  console.log(`[DDG START] Query: ${query}`);
  try {
    const response = await fetchStealth(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $('.result__body').slice(0, 8).each((_, el) => {
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
    console.log(`[DDG SUCCESS] Found ${results.length} links | ${Date.now() - start}ms`);
    return results;
  } catch (err: any) {
    console.log(`[DDG FAILURE] Error: ${err.message} | ${Date.now() - start}ms`);
    return [];
  }
}

// ─── Orchestration Fallback ───────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10000;

async function fetchMinimal(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    clearTimeout(timeout);
    return await res.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const MERCHANTS = [
  { name: "ManoMano", searchPattern: "https://www.manomano.fr/recherche/{{query}}" },
];

export const FALLBACK_SCRAPERS = [
  { name: "ManoMano", source: "scraper_manomano" as ResultSource }
];

export async function runFallbackScrapers(
  query: string,
  product: ProductInfo,
  existingEnseignes: Set<string> = new Set(),
  onResult?: (result: SearchResult, scraperName: string) => void,
  onDebug?: (category: string, message: string) => void
): Promise<{ results: SearchResult[]; stats: { success: string[]; blocked: string[] } }> {
  
  const searchUrl = `https://www.manomano.fr/recherche/${encodeURIComponent(query)}`;
  console.log(`[MINIMAL] Searching ManoMano: ${searchUrl}`);
  
  try {
    const html = await fetchMinimal(searchUrl);
    const $ = cheerio.load(html);
    
    // On cherche le premier lien qui ressemble à un produit
    let productUrl: string | null = null;
    $('a[href*="/p/"]').each((_, el) => {
      if (productUrl) return;
      let href = $(el).attr('href');
      if (href && !href.includes('recherche')) {
        productUrl = href.startsWith('http') ? href : `https://www.manomano.fr${href}`;
      }
    });

    if (!productUrl) {
      console.log("[MINIMAL] No product link found on ManoMano");
      return { results: [], stats: { success: [], blocked: [] } };
    }

    console.log(`[MINIMAL] Product found: ${productUrl}`);
    const productHtml = await fetchMinimal(productUrl);
    const $p = cheerio.load(productHtml);
    
    const extraction = extractGenericHTML(productHtml, $p);
    
    if (extraction.prix) {
      const result: SearchResult = {
        enseigne: "ManoMano",
        titre: extraction.titre || "Produit ManoMano",
        prix: extraction.prix,
        prix_status: "detected",
        lien: productUrl,
        source: "scraper_manomano",
        image_url: extraction.image,
        retrieved_at: new Date().toISOString(),
      };
      
      console.log(`[MINIMAL] SUCCESS: ${extraction.prix}€`);
      if (onResult) onResult(result, "ManoMano");
      return { results: [result], stats: { success: ["ManoMano"], blocked: [] } };
    }

    console.log("[MINIMAL] Price extraction failed on product page");
    return { results: [], stats: { success: [], blocked: [] } };

  } catch (err: any) {
    console.log(`[MINIMAL] Error: ${err.message}`);
    return { results: [], stats: { success: [], blocked: [] } };
  }
}
