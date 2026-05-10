import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource } from "./types";
import { calculateRelevanceScore } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix
 *
 * Scrapers secondaires fiables, utilisés uniquement quand Google CSE
 * retourne peu de résultats (< FALLBACK_THRESHOLD).
 *
 * Sites autorisés :
 *   - 123elec.com   (électricité, faible anti-bot)
 *   - ManoMano.fr   (général bricolage, modéré)
 *   - Bricozor.com  (bricolage spécialisé, léger)
 *   - Amazon.fr     (conditionnel, souvent bloqué)
 *
 * Sites EXCLUS (anti-bot agressif) :
 *   - Leroy Merlin, Castorama, Brico Dépôt, Bricomarché, Bricoman, Entrepôt
 *
 * Anti-bot : délais aléatoires, rotation UA, limite parallélisme, stop auto sur 403.
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL_SCRAPERS || "2");
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || "800");
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || "2500");
const MAX_CONSECUTIVE_403 = parseInt(process.env.MAX_CONSECUTIVE_403 || "2");
const SCRAPER_TIMEOUT_MS = 12000; // 12s max par scraper
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || "35");

// ─── User-Agents rotatifs ─────────────────────────────────────────────────────

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

// ─── Fetch stealth ────────────────────────────────────────────────────────────

async function fetchStealth(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

// ─── Type résultat interne ────────────────────────────────────────────────────

interface ScraperResult {
  success: boolean;
  result?: SearchResult;
  error?: string;
  blocked?: boolean;
}

// ─── Scraper 123elec ──────────────────────────────────────────────────────────

async function scrape123elec(
  query: string,
  product: ProductInfo
): Promise<ScraperResult> {
  const searchUrl = `https://www.123elec.com/catalogsearch/result/?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetchStealth(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const productItem = $(".product-item").first();
    if (!productItem.length) return { success: false, error: "no_results" };

    const titre = productItem.find(".product-item-link").text().trim();
    const priceText = productItem.find(".price").text();
    const priceMatch = priceText.match(/(\d+[,.]?\d*)/);

    if (!priceMatch) return { success: false, error: "no_price" };

    const prix = parseFloat(priceMatch[1].replace(",", "."));
    if (isNaN(prix) || prix <= 0) return { success: false, error: "invalid_price" };

    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE) {
      return { success: false, error: `relevance_too_low_${score}` };
    }

    const lien = productItem.find("a.product-item-link").attr("href") || searchUrl;

    return {
      success: true,
      result: {
        enseigne: "123elec",
        titre,
        prix,
        lien,
        source: "scraper_123elec",
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      blocked: err.message.includes("BLOCKED"),
    };
  }
}

// ─── Scraper ManoMano ─────────────────────────────────────────────────────────

async function scrapeManoMano(
  query: string,
  product: ProductInfo
): Promise<ScraperResult> {
  const searchUrl = `https://www.manomano.fr/recherche/${encodeURIComponent(query)}`;

  try {
    const response = await fetchStealth(searchUrl);
    const html = await response.text();

    // ManoMano charge ses prix via JSON-LD ou injection script
    // On cherche en priorité dans les structured data
    const jsonLdMatch = html.match(/"price"\s*:\s*"?(\d+[.,]?\d*)"?/);
    const nameMatch = html.match(/"name"\s*:\s*"([^"]{5,150})"/);

    if (!jsonLdMatch) {
      // Essai avec cheerio (parfois rendu côté serveur)
      const $ = cheerio.load(html);
      const priceEl = $("[class*='price']:not([class*='strike'])").first().text();
      const priceFromHtml = priceEl.match(/(\d+[,.]?\d*)/);
      if (!priceFromHtml) return { success: false, error: "no_price" };

      const prix = parseFloat(priceFromHtml[1].replace(",", "."));
      if (isNaN(prix) || prix <= 0) return { success: false, error: "invalid_price" };

      const titre = $("h1, [class*='title']").first().text().trim() || "Produit ManoMano";
      const score = calculateRelevanceScore(titre, product);
      if (score < MIN_RELEVANCE_SCORE) return { success: false, error: `relevance_too_low_${score}` };

      return {
        success: true,
        result: {
          enseigne: "ManoMano",
          titre,
          prix,
          lien: searchUrl,
          source: "scraper_manomano",
          relevance_score: score,
          retrieved_at: new Date().toISOString(),
        },
      };
    }

    const prix = parseFloat(jsonLdMatch[1].replace(",", "."));
    if (isNaN(prix) || prix <= 0) return { success: false, error: "invalid_price" };

    const titre = nameMatch ? nameMatch[1] : "Produit ManoMano";
    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE) return { success: false, error: `relevance_too_low_${score}` };

    return {
      success: true,
      result: {
        enseigne: "ManoMano",
        titre,
        prix,
        lien: searchUrl,
        source: "scraper_manomano",
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      blocked: err.message.includes("BLOCKED"),
    };
  }
}

// ─── Scraper Bricozor ─────────────────────────────────────────────────────────

async function scrapeBricozor(
  query: string,
  product: ProductInfo
): Promise<ScraperResult> {
  const searchUrl = `https://www.bricozor.com/recherche?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetchStealth(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Bricozor : structure produit classique Prestashop
    const productItem = $(".product-miniature, .product-container, .ajax_block_product").first();
    if (!productItem.length) return { success: false, error: "no_results" };

    const titre =
      productItem.find(".product-title, .product_name, h3, h2").first().text().trim();
    const priceText = productItem.find(".price, .product-price, .product_price").first().text();
    const priceMatch = priceText.match(/(\d+[,.]?\d*)/);

    if (!priceMatch) return { success: false, error: "no_price" };

    const prix = parseFloat(priceMatch[1].replace(",", "."));
    if (isNaN(prix) || prix <= 0) return { success: false, error: "invalid_price" };

    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE) return { success: false, error: `relevance_too_low_${score}` };

    const lienEl = productItem.find("a").first().attr("href") || "";
    const lien = lienEl.startsWith("http") ? lienEl : `https://www.bricozor.com${lienEl}`;

    return {
      success: true,
      result: {
        enseigne: "Bricozor",
        titre,
        prix,
        lien,
        source: "scraper_bricozor" as ResultSource,
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      blocked: err.message.includes("BLOCKED"),
    };
  }
}

// ─── Scraper Amazon (optionnel, souvent bloqué) ───────────────────────────────

async function scrapeAmazon(
  query: string,
  product: ProductInfo
): Promise<ScraperResult> {
  const searchUrl = `https://www.amazon.fr/s?k=${encodeURIComponent(query)}`;

  try {
    const response = await fetchStealth(searchUrl);
    const html = await response.text();

    // Amazon utilise un HTML très spécifique
    const wholeMatch = html.match(/<span class="a-price-whole">(\d+)[,.]?/);
    const fractionMatch = html.match(/<span class="a-price-fraction">(\d+)<\/span>/);
    const titleMatch = html.match(/<span class="a-size-medium a-color-base a-text-normal">([^<]{5,200})<\/span>/);

    if (!wholeMatch) return { success: false, error: "no_price" };

    const prix = parseFloat(`${wholeMatch[1]}.${fractionMatch ? fractionMatch[1] : "00"}`);
    if (isNaN(prix) || prix <= 0) return { success: false, error: "invalid_price" };

    const titre = titleMatch ? titleMatch[1].trim() : "Produit Amazon";
    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE) return { success: false, error: `relevance_too_low_${score}` };

    return {
      success: true,
      result: {
        enseigne: "Amazon",
        titre,
        prix,
        lien: searchUrl,
        source: "scraper_amazon",
        relevance_score: score,
        retrieved_at: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      blocked: err.message.includes("BLOCKED"),
    };
  }
}

// ─── Définition des scrapers disponibles ─────────────────────────────────────

interface FallbackScraper {
  name: string;
  source: ResultSource;
  fn: (query: string, product: ProductInfo) => Promise<ScraperResult>;
  enabled: boolean;
}

const FALLBACK_SCRAPERS: FallbackScraper[] = [
  {
    name: "123elec",
    source: "scraper_123elec",
    fn: scrape123elec,
    enabled: true,
  },
  {
    name: "ManoMano",
    source: "scraper_manomano",
    fn: scrapeManoMano,
    enabled: true,
  },
  {
    name: "Bricozor",
    source: "scraper_bricozor",
    fn: scrapeBricozor,
    enabled: true,
  },
  {
    name: "Amazon",
    source: "scraper_amazon",
    fn: scrapeAmazon,
    enabled: true, // Peut être désactivé si trop de 403
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

/**
 * Lance les scrapers fallback avec limitation du parallélisme et anti-403.
 *
 * @param query - Requête de recherche (prioritairement ref fabricant ou EAN)
 * @param product - Infos produit pour scoring pertinence
 * @param onResult - Callback appelé dès qu'un résultat est disponible
 */
export async function runFallbackScrapers(
  query: string,
  product: ProductInfo,
  onResult?: (result: SearchResult, scraperName: string) => void
): Promise<FallbackResult> {
  const activeScrapers = FALLBACK_SCRAPERS.filter(s => s.enabled);
  const allResults: SearchResult[] = [];
  const stats = { tried: [] as string[], success: [] as string[], blocked: [] as string[], errors: [] as string[] };

  let consecutiveBlocked = 0;

  // Traitement séquentiel avec délai (plus stable que parallèle pour les scrapers)
  for (let i = 0; i < activeScrapers.length; i++) {
    // Arrêt automatique si trop de blocages consécutifs
    if (consecutiveBlocked >= MAX_CONSECUTIVE_403) {
      console.log(`[FallbackScrapers] Stop auto: ${consecutiveBlocked} blocages consécutifs`);
      break;
    }

    // Limite le nombre de scrapers en parallèle (traitement par batch)
    const batch = activeScrapers.slice(i, i + MAX_PARALLEL);

    const batchPromises = batch.map(async (scraper) => {
      stats.tried.push(scraper.name);
      console.log(`[FallbackScrapers] Démarrage: ${scraper.name}`);

      const scraperResult = await scraper.fn(query, product);

      if (scraperResult.blocked) {
        consecutiveBlocked++;
        stats.blocked.push(scraper.name);
        console.log(`[FallbackScrapers] BLOQUÉ: ${scraper.name}`);
      } else if (scraperResult.success && scraperResult.result) {
        consecutiveBlocked = 0; // Reset si succès
        stats.success.push(scraper.name);
        allResults.push(scraperResult.result);
        if (onResult) onResult(scraperResult.result, scraper.name);
        console.log(`[FallbackScrapers] Succès: ${scraper.name} — ${scraperResult.result.prix}€`);
      } else {
        consecutiveBlocked = Math.max(0, consecutiveBlocked - 1);
        stats.errors.push(scraper.name);
        console.log(`[FallbackScrapers] Échec: ${scraper.name} — ${scraperResult.error}`);
      }
    });

    await Promise.all(batchPromises);
    i += MAX_PARALLEL - 1; // Avancer dans la boucle de la taille du batch

    // Délai entre les batches
    if (i < activeScrapers.length - 1 && consecutiveBlocked < MAX_CONSECUTIVE_403) {
      await randomDelay();
    }
  }

  return { results: allResults, stats };
}
