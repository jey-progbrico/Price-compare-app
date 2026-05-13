import * as cheerio from "cheerio";
import { fetchStealth, scrapeUrl } from "./fallbackScrapers";
import { ProductInfo, SearchResult, ResultSource } from "./types";
import { estimateProductPageProbability, calculateRelevanceScore } from "./queryBuilder";

/**
 * Moteur DuckDuckGo HTML — Vigiprix
 * Utilise l'interface HTML légère pour la découverte produit.
 */

interface DdgOrganicResult {
  title: string;
  url: string;
}

/**
 * Effectue une recherche sur DuckDuckGo HTML et extrait les résultats organiques.
 */
async function rechercherDuckDuckGo(requete: string): Promise<DdgOrganicResult[]> {
  const urlRecherche = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(requete)}`;
  
  try {
    const response = await fetchStealth(urlRecherche);
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

    return resultats;
  } catch (err: any) {
    console.error(`[DDG] Erreur de recherche : ${err.message}`);
    return [];
  }
}

/**
 * Extrait l'URL réelle du marchand à partir du lien de redirection DuckDuckGo.
 */
function extraireUrlDdg(hrefDdg: string): string | null {
  try {
    if (hrefDdg.startsWith('http')) {
      const urlObj = new URL(hrefDdg);
      const uddg = urlObj.searchParams.get('uddg');
      if (uddg) return decodeURIComponent(uddg);
      return hrefDdg;
    }
    // Parfois les liens sont relatifs ou bizarres
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
  
  // Rejet explicite des pages indésirables
  const exclusions = [
    '/recherche', '/search', '/catalogsearch',
    '/categorie', '/category', '/cat/',
    '/mon-compte', '/account', '/login', '/panier', '/cart',
    '/univers', '/gamme', '/rayon', '/listing'
  ];

  if (exclusions.some(p => urlLower.includes(p))) return false;

  // Utilisation de l'heuristique existante
  const proba = estimateProductPageProbability(url);
  return proba.probability > 0.5;
}

/**
 * Découvre un produit sur un site spécifique via DuckDuckGo.
 */
export async function decouvrirProduitViaDDG(
  produit: ProductInfo,
  site: string,
  requeteSpecifique?: string
): Promise<SearchResult | null> {
  const debut = Date.now();
  const requete = requeteSpecifique || `${produit.ean} site:${site}`;
  
  console.log(`[DDG] Recherche : "${requete}"`);
  
  const resultatsDdg = await rechercherDuckDuckGo(requete);
  console.log(`[DDG] URLs trouvées pour ${site} : ${resultatsDdg.length}`);
  resultatsDdg.forEach(r => console.log(`  -> ${r.url}`));

  // On prend le premier résultat qui ressemble à une page produit
  const candidat = resultatsDdg.find(r => estUnePageProduitValide(r.url));

  if (!candidat) {
    console.log(`[DDG] Aucun lien produit valide trouvé pour ${site}`);
    return null;
  }

  console.log(`[DDG] URL sélectionnée : ${candidat.url}`);
  
  // Extraction des données sur la page produit
  const nomEnseigne = site.split('.')[0].charAt(0).toUpperCase() + site.split('.')[0].slice(1);
  const extraction = await scrapeUrl(candidat.url, nomEnseigne, produit);

  if (extraction.success && extraction.result) {
    console.log(`[DDG] Succès extraction ${nomEnseigne} : ${extraction.result.prix}€`);
    return {
      ...extraction.result,
      source: "scraper_duckduckgo" as ResultSource
    };
  }

  console.log(`[DDG] Échec extraction sur la page produit : ${candidat.url}`);
  return null;
}
