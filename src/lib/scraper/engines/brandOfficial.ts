import { fetchWithStealth, ScraperResult } from "../core";
import * as cheerio from "cheerio";

// Mapping des marques vers leurs domaines officiels
const BRAND_DOMAINS: Record<string, string> = {
  "ryobi": "ryobitools.fr",
  "bosch": "bosch-professional.com",
  "makita": "makita.fr",
  "dewalt": "dewalt.fr",
  "festool": "festool.fr",
  "milwaukee": "milwaukeetool.fr",
  "metabo": "metabo.com",
  "karcher": "kaercher.com",
  "honda": "honda.fr",
  "stihl": "stihl.fr"
};

export async function scrapeBrandOfficial(query: string, marque?: string | null): Promise<ScraperResult> {
  const result: ScraperResult = {
    enseigne: "Site Officiel",
    titre: "",
    prix: null,
    lien: "",
    statut: "error"
  };

  if (!marque) {
    result.statut = "not_found";
    return result;
  }
  
  const normalizedBrand = marque.toLowerCase().trim();
  const domain = BRAND_DOMAINS[normalizedBrand];
  
  if (!domain) {
    result.statut = "not_found";
    return result;
  }

  try {
    // 1. Utiliser DuckDuckGo pour trouver la page produit sur le site officiel
    const ddgSearchUrl = `https://html.duckduckgo.com/html/?q=site:${domain} ${encodeURIComponent(query)}`;
    const ddgResponse = await fetchWithStealth(ddgSearchUrl);
    
    if (ddgResponse.status !== 200) {
      result.statut = "error";
      result.erreur = `DDG HTTP ${ddgResponse.status}`;
      return result;
    }

    const ddgHtml = await ddgResponse.text();
    const $ddg = cheerio.load(ddgHtml);
    
    // Récupérer le premier vrai lien
    const firstLink = $ddg('.result__url').first().attr('href');
    
    if (!firstLink) {
      result.statut = "not_found";
      return result;
    }

    // DuckDuckGo redirige parfois via ses propres liens, on le nettoie si nécessaire
    // Mais dans la version html simple, result__url contient souvent le vrai lien en texte
    const actualUrl = $ddg('.result__url').first().text().trim();
    const finalUrl = actualUrl.startsWith('http') ? actualUrl : `https://${actualUrl}`;
    
    result.lien = finalUrl;

    // 2. Fetch du site officiel pour récupérer les métadonnées (OG:image, OG:title)
    const siteResponse = await fetchWithStealth(finalUrl);
    result.httpStatus = siteResponse.status;
    
    if (siteResponse.status === 200) {
      const siteHtml = await siteResponse.text();
      const $site = cheerio.load(siteHtml);
      
      const ogTitle = $site('meta[property="og:title"]').attr('content');
      const title = $site('title').text();
      result.titre = (ogTitle || title || "Produit Officiel").trim();
      
      const ogImage = $site('meta[property="og:image"]').attr('content');
      
      // On peut stocker l'image dans une propriété personnalisée si besoin
      if (ogImage) {
        (result as any).image = ogImage;
      }
      
      result.statut = "success";
    } else {
      // Si on n'arrive pas à fetcher le site officiel, on garde au moins le titre depuis DDG
      result.titre = $ddg('.result__title').first().text().trim() || "Lien Site Officiel";
      result.statut = "success"; // On considère success car on a le lien
    }

  } catch (error: any) {
    result.statut = "error";
    result.erreur = error.message;
  }

  return result;
}
