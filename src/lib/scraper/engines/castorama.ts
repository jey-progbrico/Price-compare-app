import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeCastorama(query: string): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "Castorama",
    titre: "",
    prix: null,
    lien: `https://www.castorama.fr/search?term=${encodeURIComponent(query)}`,
    statut: "error"
  };

  try {
    const response = await fetchWithStealth(result.lien);
    result.httpStatus = response.status;
    

    

    const html = await response.text();
    const $ = cheerio.load(html);

    // Castorama utilise souvent des listes de produits avec des attributs data ou des balises sémantiques
    const productElement = $('[data-test-id="product-card"]').first();
    
    if (productElement.length > 0) {
      result.titre = productElement.find('h3').text().trim() || "Produit Castorama";
      
      const priceText = productElement.find('[data-test-id="price"]').text() || productElement.find('.price').text();
      const priceMatch = priceText.match(/(\d+[.,]?\d*)/);
      if (priceMatch) {
        result.prix = priceMatch[1].replace(',', '.');
      }
      
      result.statut = result.prix ? "success" : "not_found";
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
