import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

export async function scrapeDuckDuckGoFallback(queryInput: string): Promise<ScraperResult[]> {
  const results: ScraperResult[] = [];
  
  try {
    const query = `${queryInput}`;
    const response = await fetchWithStealth(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    const html = await response.text();
    const $ = cheerio.load(html);

    $(".result").each((i, el) => {
      const title = $(el).find(".result__title").text().trim();
      const rawUrl = $(el).find(".result__url").attr("href") || "";
      const snippet = $(el).find(".result__snippet").text().trim();

      let finalUrl = rawUrl;
      try {
        if (rawUrl.includes("uddg=")) {
          const urlObj = new URL(rawUrl, "https://duckduckgo.com");
          const uddg = urlObj.searchParams.get("uddg");
          if (uddg) finalUrl = decodeURIComponent(uddg);
        } else if (rawUrl.startsWith("//")) {
          finalUrl = "https:" + rawUrl;
        }
      } catch (e) {}

      let enseigne = "Web";
      try {
        const hostname = new URL(finalUrl).hostname.replace("www.", "");
        enseigne = hostname.split('.')[0];
        enseigne = enseigne.charAt(0).toUpperCase() + enseigne.slice(1);
      } catch (e) {}

      const priceRegex = /(\d+[.,]?\d*)\s*(?:€|EUR)/i;
      const snippetMatch = snippet.match(priceRegex);
      const titleMatch = title.match(priceRegex);

      let price = titleMatch ? titleMatch[1] : snippetMatch ? snippetMatch[1] : null;
      if (price) price = price.replace(",", ".");

      if (title && finalUrl && price) {
        results.push({
          enseigne,
          titre: title,
          prix: price,
          lien: finalUrl,
          statut: "success",
          httpStatus: 200
        });
      }
    });

  } catch (error: any) {
    console.error("DuckDuckGo Fallback Error", error);
  }

  return results.slice(0, 3); // Retourner max 3 résultats du web
}
