import * as cheerio from "cheerio";
import { fetchStealth } from "./fallbackScrapers";
import { ProductInfo, SearchResult, ResultSource } from "./types";
import { estimateProductPageProbability } from "./queryBuilder";

/**
 * Moteur DuckDuckGo HTML — Vigiprix (v3 - Découverte Pure)
 * Se concentre uniquement sur la découverte d'URLs sans extraction de prix.
 */

interface DdgOrganicResult {
  title: string;
  url: string;
}

/**
 * Effectue une recherche sur DuckDuckGo HTML et extrait les résultats organiques.
 * MOTEUR PARTAGÉ ET VALIDÉ (Utilisé par le pipeline et la route debug).
 */
export async function rechercherDuckDuckGo(requete: string): Promise<DdgOrganicResult[]> {
  const urlDdg = `https://html.duckduckgo.com/html/`;
  
  console.log(`[DDG SHARED ENGINE USED] Requête : "${requete}"`);
  
  try {
    const response = await fetch(urlDdg, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9",
        "Cache-Control": "no-cache",
        "Origin": "https://html.duckduckgo.com",
        "Referer": "https://html.duckduckgo.com/",
      },
      body: `q=${encodeURIComponent(requete)}&b=`,
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const resultats: DdgOrganicResult[] = [];

    $('.result__body').each((_, el) => {
      const lienBrut = $(el).find('.result__a').attr('href');
      const titre = $(el).find('.result__a').text().trim();
      
      if (lienBrut && titre) {
        const urlReelle = extraireUrlDdg(lienBrut);
        if (urlReelle && !urlReelle.includes('duckduckgo.com')) {
          resultats.push({ title: titre, url: urlReelle });
        }
      }
    });

    console.log(`[DDG RAW RESULTS COUNT: ${resultats.length}] pour "${requete}"`);
    
    // Log des 3 premiers résultats bruts pour inspection
    resultats.slice(0, 3).forEach((r, i) => {
      console.log(`  [RAW #${i+1}] ${r.title.substring(0, 30)}... | ${r.url}`);
    });

    return resultats;
  } catch (err: any) {
    console.error(`[DDG] Erreur de recherche POST : ${err.message}`);
    return [];
  }
}

/**
 * Extrait l'URL réelle du marchand à partir du lien de redirection DuckDuckGo.
 */
export function extraireUrlDdg(hrefDdg: string): string | null {
  try {
    if (hrefDdg.startsWith('http')) {
      const urlObj = new URL(hrefDdg);
      const uddg = urlObj.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
      return hrefDdg;
    }
    if (hrefDdg.includes('uddg=')) {
      const match = hrefDdg.match(/uddg=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Filtre les URLs pour rejeter les pages non-produit (catégories, recherche, compte).
 */
function estUnePageProduitValide(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  const exclusions = [
    '/recherche', '/search', '/catalogsearch',
    '/categorie', '/category', '/cat/',
    '/mon-compte', '/account', '/login', '/panier', '/cart',
    '/univers', '/gamme', '/rayon', '/listing'
  ];

  if (exclusions.some(p => urlLower.includes(p))) return false;

  const proba = estimateProductPageProbability(url);
  return proba.probability > 0.5;
}

import { extractKeywords } from "./queryBuilder";

/**
 * Déduit le nom de l'enseigne à partir de l'URL du résultat.
 */
function deduireEnseigneDepuisUrl(url: string): string {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    let name = parts[0];
    
    // Cas particuliers
    if (name === "leroymerlin") return "Leroy Merlin";
    if (name === "bricodepot") return "Brico Dépôt";
    if (name === "manomano") return "ManoMano";
    if (name === "bricomarche") return "Bricomarché";
    if (name === "castorama") return "Castorama";
    if (name === "amazon") return "Amazon";
    if (name === "bricoprive") return "Brico Privé";
    
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Marchand";
  }
}

/**
 * Découvre des produits via une recherche globale DuckDuckGo.
 * Version ULTRA-SIMPLIFIÉE (basée sur /api/test-ddg).
 */
export async function decouvrirProduitsGlobale(
  produit: ProductInfo
): Promise<SearchResult[]> {
  const ean = produit.ean;
  if (!ean) return [];

  // TENTATIVE : EAN Seul (suffisant dans 90% des cas e-commerce)
  const resultatsDdg = await rechercherDuckDuckGo(ean);

  const searchResults: SearchResult[] = [];

  for (const r of resultatsDdg) {
    // Déduction simple de l'enseigne
    const enseigne = deduireEnseigneDepuisUrl(r.url);
    
    searchResults.push({
      enseigne: enseigne,
      titre: r.title,
      prix: null,
      prix_status: "not_found",
      lien: r.url,
      source: "scraper_duckduckgo" as ResultSource,
      retrieved_at: new Date().toISOString()
    });
  }

  console.log(`[DDG MAIN ENGINE SUCCESS] ${searchResults.length} liens trouvés pour l'EAN ${ean}`);
  return searchResults;
}
