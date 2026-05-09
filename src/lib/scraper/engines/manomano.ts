import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeManoMano(query: string): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "ManoMano",
    titre: "",
    prix: null,
    lien: `https://www.manomano.fr/recherche/${encodeURIComponent(query)}`,
    statut: "error"
  };

  try {
    const response = await fetchWithStealth(result.lien);
    result.httpStatus = response.status;
    

    

    const html = await response.text();
    
    // Extraction simplifiée pour l'exemple
    const priceMatch = html.match(/"price"\s*:\s*(\d+[.,]\d*)/);
    
    if (priceMatch) {
      result.prix = priceMatch[1].replace(',', '.');
      result.titre = "Produit ManoMano";
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
