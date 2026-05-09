import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeEntrepot(query: string): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "Entrepôt Bricolage",
    titre: "",
    prix: null,
    lien: `https://www.entrepot-du-bricolage.fr/recherche/${encodeURIComponent(query)}`,
    statut: "error"
  };

  try {
    const response = await fetchWithStealth(result.lien);
    result.httpStatus = response.status;
    
    const html = await response.text();
    
    if (html.includes("Incapsula") || html.includes("incap_ses")) {
      result.statut = "403_proxy_needed";
      result.erreur = "Bloqué par anti-bot (Incapsula)";
      return result;
    }

    const $ = cheerio.load(html);
    
    // Essayer de trouver un produit dans la liste de résultats
    // Sélecteurs génériques au cas où l'on n'a pas accès au vrai DOM
    const firstProduct = $('.product-item, .card-product, article').first();
    
    if (firstProduct.length > 0 || html.includes('"price"')) {
      // Extraction basique du prix via regex sur tout le html si le DOM est trop complexe
      const priceMatch = html.match(/"price"\s*:\s*(\d+[.,]\d*)/) || html.match(/data-price="(\d+[.,]\d*)"/) || html.match(/class="[^"]*price[^"]*".*?(\d+[.,]\d*)/i);
      const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/) || html.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/);
      
      if (priceMatch) {
        result.prix = priceMatch[1].replace(',', '.');
        result.titre = titleMatch ? titleMatch[1].trim() : "Produit Entrepôt Bricolage";
        result.statut = "success";
      } else {
        result.statut = "not_found";
      }
    } else {
      result.statut = "not_found";
    }
  } catch (error: any) {
    const match = error.message.match(/_(4\d\d|5\d\d)/);
    if (match) result.httpStatus = parseInt(match[1]);
    else result.httpStatus = 500;
    if (error.message.includes("BLOCKED")) result.statut = "403_proxy_needed";
    result.erreur = error.message;
  }

  return result;
}
