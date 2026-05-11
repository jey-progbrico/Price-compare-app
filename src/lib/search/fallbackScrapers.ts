import * as cheerio from "cheerio";
import type { SearchResult, ProductInfo, ResultSource, PrixStatus } from "./types";
import { calculateRelevanceScore } from "./queryBuilder";

/**
 * Fallback Scrapers — Vigiprix (v2)
 *
 * Changements v2 :
 * - Conserve les résultats MÊME sans prix détecté (prix_status: "not_found")
 * - Les scrapers s'exécutent TOUJOURS (plus de seuil FALLBACK_THRESHOLD)
 * - Résultat minimum garanti : lien produit + nom enseigne
 *
 * Sites inclus :
 *   - 123elec.com   (électricité, faible anti-bot)
 *   - ManoMano.fr   (général bricolage, modéré)
 *   - Bricozor.com  (bricolage spécialisé, léger)
 *   - Amazon.fr     (conditionnel, souvent bloqué)
 *
 * Sites EXCLUS (anti-bot agressif) :
 *   - Leroy Merlin, Castorama, Brico Dépôt, Bricomarché, Bricoman, Entrepôt
 */

// ─── Configuration ─────────────────────────────────────────────────────────────

const MAX_PARALLEL = parseInt(process.env.MAX_PARALLEL_SCRAPERS || "2");
const MIN_DELAY_MS = parseInt(process.env.MIN_DELAY_MS || "800");
const MAX_DELAY_MS = parseInt(process.env.MAX_DELAY_MS || "2500");
const MAX_CONSECUTIVE_403 = parseInt(process.env.MAX_CONSECUTIVE_403 || "2");
const SCRAPER_TIMEOUT_MS = 12000; // 12s max par scraper
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || "20");

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

/**
 * Tente d'extraire un prix depuis un texte HTML.
 * Retourne null si non trouvé.
 */
function parsePriceText(text: string): number | null {
  const match = text.match(/(\d+[,.]?\d*)/);
  if (!match) return null;
  const price = parseFloat(match[1].replace(",", "."));
  return !isNaN(price) && price > 0 && price < 50000 ? price : null;
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
    if (!productItem.length) {
      // Retourner quand même l'URL de recherche comme lien de fallback
      return {
        success: true,
        result: {
          enseigne: "123elec",
          titre: `Recherche "${query}" sur 123elec`,
          prix: null,
          prix_status: "not_found" as PrixStatus,
          lien: searchUrl,
          source: "scraper_123elec" as ResultSource,
          relevance_score: 30,
          retrieved_at: new Date().toISOString(),
        },
      };
    }

    const titre = productItem.find(".product-item-link").text().trim() || `Produit 123elec`;
    const priceText = productItem.find(".price").text();
    const prix = parsePriceText(priceText);
    const score = calculateRelevanceScore(titre, product);

    if (score < MIN_RELEVANCE_SCORE - 10) {
      return { success: false, error: `relevance_too_low_${score}` };
    }

    const lien = productItem.find("a.product-item-link").attr("href") || searchUrl;

    return {
      success: true,
      result: {
        enseigne: "123elec",
        titre,
        prix,
        prix_status: prix !== null ? "detected" : "not_found",
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
    const jsonLdMatch = html.match(/"price"\s*:\s*"?(\d+[.,]?\d*)"?/);
    const nameMatch = html.match(/"name"\s*:\s*"([^"]{5,150})"/);

    let prix: number | null = null;
    let titre = nameMatch ? nameMatch[1] : `Recherche "${query}" sur ManoMano`;

    if (jsonLdMatch) {
      prix = parsePriceText(jsonLdMatch[1]);
    } else {
      // Essai avec cheerio (parfois rendu côté serveur)
      const $ = cheerio.load(html);
      const priceEl = $("[class*='price']:not([class*='strike'])").first().text();
      prix = parsePriceText(priceEl);
      const titleEl = $("h1, [class*='title']").first().text().trim();
      if (titleEl) titre = titleEl;
    }

    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE - 10) {
      return { success: false, error: `relevance_too_low_${score}` };
    }

    return {
      success: true,
      result: {
        enseigne: "ManoMano",
        titre,
        prix,
        prix_status: prix !== null ? "detected" : "not_found",
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

    let titre = `Recherche "${query}" sur Bricozor`;
    let lien = searchUrl;
    let prix: number | null = null;

    if (productItem.length) {
      const foundTitle = productItem.find(".product-title, .product_name, h3, h2").first().text().trim();
      if (foundTitle) titre = foundTitle;
      const priceText = productItem.find(".price, .product-price, .product_price").first().text();
      prix = parsePriceText(priceText);
      const lienEl = productItem.find("a").first().attr("href") || "";
      lien = lienEl.startsWith("http") ? lienEl : `https://www.bricozor.com${lienEl}`;
    }

    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE - 10) {
      return { success: false, error: `relevance_too_low_${score}` };
    }

    return {
      success: true,
      result: {
        enseigne: "Bricozor",
        titre,
        prix,
        prix_status: prix !== null ? "detected" : "not_found",
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

// ─── Scraper Amazon ───────────────────────────────────────────────────────────

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

    let prix: number | null = null;
    if (wholeMatch) {
      prix = parseFloat(`${wholeMatch[1]}.${fractionMatch ? fractionMatch[1] : "00"}`);
      if (isNaN(prix) || prix <= 0) prix = null;
    }

    const titre = titleMatch ? titleMatch[1].trim() : `Recherche "${query}" sur Amazon`;
    const score = calculateRelevanceScore(titre, product);
    if (score < MIN_RELEVANCE_SCORE - 10) {
      return { success: false, error: `relevance_too_low_${score}` };
    }

    return {
      success: true,
      result: {
        enseigne: "Amazon",
        titre,
        prix,
        prix_status: prix !== null ? "detected" : "not_found",
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

/**
 * Lance les scrapers fallback avec limitation du parallélisme et anti-403.
 * Retourne les résultats avec OU sans prix — un seul résultat par enseigne.
 *
 * @param query - Requête de recherche
 * @param product - Infos produit pour scoring pertinence
 * @param existingEnseignes - Enseignes déjà trouvées (pour ne pas dupliquer)
 * @param onResult - Callback appelé dès qu'un résultat est disponible
 */
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
        const result = scraperResult.result;

        // Ne pas dupliquer si l'enseigne a déjà été trouvée par Google CSE
        // Exception : si Google n'avait pas de prix mais le scraper en a un
        if (existingEnseignes.has(result.enseigne)) {
          console.log(`[FallbackScrapers] Enseigne déjà trouvée, ignoré: ${result.enseigne}`);
          return; // skip, enseigne déjà présente
        }

        stats.success.push(scraper.name);
        allResults.push(result);
        if (onResult) onResult(result, scraper.name);
        console.log(
          `[FallbackScrapers] Succès: ${scraper.name} — ` +
          (result.prix !== null ? `${result.prix}€` : "lien sans prix")
        );
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
