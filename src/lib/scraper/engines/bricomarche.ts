import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeBricomarche(query: string): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "Bricomarché",
    titre: "",
    prix: null,
    lien: `https://www.bricomarche.com/recherche?q=${encodeURIComponent(query)}`,
    statut: "error"
  };

  try {
    const response = await fetchWithStealth(result.lien);
    result.httpStatus = response.status;
    

    

    const html = await response.text();
    
    // Bricomarché utilise DataDome/Cloudflare mais au cas où le proxy passe
    const priceMatch = html.match(/"price"\s*:\s*(\d+[.,]\d*)/);
    const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
    
    if (priceMatch) {
      result.prix = priceMatch[1].replace(',', '.');
      result.titre = titleMatch ? titleMatch[1] : "Produit Bricomarché";
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
