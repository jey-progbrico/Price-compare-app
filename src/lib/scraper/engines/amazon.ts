import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeAmazon(query: string): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "Amazon",
    titre: "",
    prix: null,
    lien: `https://www.amazon.fr/s?k=${encodeURIComponent(query)}`,
    statut: "error"
  };

  try {
    const response = await fetchWithStealth(result.lien);
    result.httpStatus = response.status;
    

    

    const html = await response.text();
    
    // Extraction très simplifiée pour Amazon (qui bloque souvent)
    const priceMatch = html.match(/<span class="a-price-whole">(\d+)[.,]/);
    const fractionMatch = html.match(/<span class="a-price-fraction">(\d+)<\/span>/);
    
    if (priceMatch) {
      result.prix = `${priceMatch[1]}.${fractionMatch ? fractionMatch[1] : '00'}`;
      result.titre = "Produit Amazon";
      result.statut = "success";
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
