import { ScraperResult, delay } from "./core";
import { scrapeCastorama } from "./engines/castorama";
import { scrapeLeroyMerlin } from "./engines/leroymerlin";
import { scrapeManoMano } from "./engines/manomano";
import { scrapeBricoman } from "./engines/bricoman";
import { scrapeAmazon } from "./engines/amazon";
import { scrape123elec } from "./engines/123elec";
import { scrapeBricomarche } from "./engines/bricomarche";
import { scrapeEntrepot } from "./engines/entrepot";
import { scrapeDuckDuckGoFallback } from "./engines/duckduckgo";
import { scrapeBrandOfficial } from "./engines/brandOfficial";
import { generateSearchQueries, calculateRelevanceScore } from "./searchLogic";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CACHE_TTL_HOURS = parseInt(process.env.CACHE_TTL_HOURS || "24");

export async function processScrapingQueue(
  ean: string, 
  productInfos?: { marque?: string | null, designation?: string | null, reference_fabricant?: string | null },
  onProgress?: (event: string, data: any) => void
): Promise<{results: ScraperResult[], debugLogs: any[]}> {
  const results: ScraperResult[] = [];
  const debugLogs: any[] = [];

  // 1. Récupération du cache
  const { data: allCached } = await supabase.from('cache_prix').select('*').eq('ean', ean);
  const validCached = (allCached || []).filter(c => {
    return (Date.now() - new Date(c.updated_at).getTime()) <= (CACHE_TTL_HOURS * 60 * 60 * 1000);
  });

  if (validCached.length > 0) {
    debugLogs.push({ step: `Cache Initial (${CACHE_TTL_HOURS}h)`, status: "Found", count: validCached.length });
    
    const cachedResults = validCached.map(c => ({
      enseigne: c.enseigne, titre: c.titre, prix: c.prix, lien: c.lien, statut: "success", httpStatus: 200, 
      isCached: true, prix_precedent: c.prix_precedent, date_changement_prix: c.date_changement_prix
    }) as any);
    
    if (onProgress) {
      cachedResults.forEach(r => onProgress('scraper_result', { scraper: r.enseigne, status: 'success', result: r }));
    }

    return {
      results: cachedResults,
      debugLogs
    };
  }

  // 2. Génération des requêtes en cascade
  const searchQueries = generateSearchQueries(ean, productInfos?.marque, productInfos?.designation);
  debugLogs.push({ step: "Queries Générées", status: JSON.stringify(searchQueries) });

  const scrapers: Array<{fn: Function, name: string}> = [
    { fn: scrape123elec, name: '123elec' },
    { fn: scrapeCastorama, name: 'Castorama' },
    { fn: scrapeLeroyMerlin, name: 'Leroy Merlin' },
    { fn: scrapeBricoman, name: 'Bricoman' },
    { fn: scrapeBricomarche, name: 'Bricomarché' },
    { fn: scrapeManoMano, name: 'ManoMano' },
    { fn: scrapeAmazon, name: 'Amazon' },
    { fn: scrapeEntrepot, name: "L'Entrepôt du Bricolage" }
  ];

  if (productInfos?.marque) {
    scrapers.push({
      fn: (q: string) => scrapeBrandOfficial(q, productInfos.marque),
      name: "Site Officiel"
    });
  }

  const { data: statusData } = await supabase.from('statut_concurrents').select('*');
  const scraperStatusMap = new Map(statusData?.map(s => [s.enseigne, s]) || []);

  let successCount = 0;

  // Fonction pour exécuter la cascade sur un scraper donné
  const runScraperCascade = async (scraperInfo: {fn: Function, name: string}) => {
    if (onProgress) onProgress('scraper_start', { scraper: scraperInfo.name });
    const currentStatus = scraperStatusMap.get(scraperInfo.name);
    
    if (currentStatus && (currentStatus.statut === 'desactive_auto' || currentStatus.statut === 'desactive_manuel')) {
      debugLogs.push({ step: "Scraping", enseigne: scraperInfo.name, status: `Ignoré (${currentStatus.statut})` });
      if (onProgress) onProgress('scraper_result', { scraper: scraperInfo.name, status: 'ignored' });
      return;
    }

    let stats = currentStatus || {
      enseigne: scraperInfo.name, statut: 'actif', total_requetes: 0, total_succes: 0, total_403: 0, consecutive_403: 0, score_fiabilite: 100.0
    };

    let bestResult: ScraperResult | null = null;
    let found = false;

    // Boucle sur les requêtes générées (cascade)
    for (let i = 0; i < searchQueries.length; i++) {
      const query = searchQueries[i];
      if (i > 0) {
        // Délai court entre deux tentatives sur le MÊME site
        await delay(1500, 3500); 
      }
      
      try {
        const result: ScraperResult = await scraperInfo.fn(query);
        stats.total_requetes++;

        const isSuccess = result.statut === "success";
        const is403 = result.statut === "403_proxy_needed" || result.httpStatus === 403 || result.httpStatus === 429;

        if (isSuccess && result.titre) {
          // Vérification du score de pertinence
          const score = calculateRelevanceScore(result.titre, productInfos?.marque, productInfos?.designation, ean);
          
          if (score >= 40) { // Seuil d'acceptation
            bestResult = result;
            found = true;
            debugLogs.push({ enseigne: result.enseigne, statut: `success (Q${i+1}, Score: ${score}%)`, httpStatus: result.httpStatus });
            
            stats.total_succes++;
            stats.consecutive_403 = 0;
            stats.statut = 'actif';
            stats.dernier_succes = new Date().toISOString();
            break; // On arrête la cascade pour ce site !
          } else {
            debugLogs.push({ enseigne: result.enseigne, statut: `Rejeté (Score trop bas: ${score}%)`, httpStatus: result.httpStatus });
            // On continue la cascade car ce résultat n'est pas bon
          }
        } else if (is403) {
          stats.total_403++;
          stats.consecutive_403++;
          stats.dernier_echec = new Date().toISOString();
          if (stats.consecutive_403 >= 3) stats.statut = 'desactive_auto';
          debugLogs.push({ enseigne: result.enseigne, statut: "403_proxy_needed", httpStatus: result.httpStatus });
          break; // Si on se prend un 403, on arrête la cascade pour ce site immédiatement
        } else {
          // not_found ou erreur diverse
          debugLogs.push({ enseigne: scraperInfo.name, statut: result.statut, httpStatus: result.httpStatus, erreur: result.erreur });
        }
      } catch (e: any) {
         debugLogs.push({ enseigne: scraperInfo.name, statut: "error", erreur: e.message });
      }
    } // fin de la boucle for (queries)

    stats.score_fiabilite = stats.total_requetes > 0 ? (stats.total_succes / stats.total_requetes) * 100.0 : 100.0;
    
    // Mise à jour de la santé (en background, pas besoin d'await strict ici mais on le fait proprement)
    await supabase.from('statut_concurrents').upsert({...stats}, { onConflict: 'enseigne' });

    if (found && bestResult) {
      successCount++;
      results.push(bestResult);

      const prixValue = parseFloat(bestResult.prix || "0");
      
      const existingCache = (allCached || []).find(c => c.enseigne === bestResult!.enseigne);
      let prix_precedent = existingCache ? existingCache.prix_precedent : null;
      let date_changement_prix = existingCache ? existingCache.date_changement_prix : null;

      if (existingCache && existingCache.prix && existingCache.prix !== prixValue) {
        prix_precedent = existingCache.prix;
        date_changement_prix = new Date().toISOString();
      }

      await supabase.from('cache_prix').upsert({
        ean,
        enseigne: bestResult.enseigne,
        titre: bestResult.titre,
        prix: prixValue,
        lien: bestResult.lien,
        prix_precedent,
        date_changement_prix
      }, { onConflict: 'ean, enseigne' });

      (bestResult as any).prix_precedent = prix_precedent;
      (bestResult as any).date_changement_prix = date_changement_prix;

      const { error: histError } = await supabase.from('historique_recherches').insert({
        ean, enseigne: bestResult.enseigne, statut: 'success'
      });
      if (histError) debugLogs.push({ step: "Historique", enseigne: bestResult.enseigne, statut: "Erreur DB", erreur: histError.message });
    } else {
      await supabase.from('cache_prix').delete().match({ ean, enseigne: scraperInfo.name });
      const { error: histError } = await supabase.from('historique_recherches').insert({
        ean, enseigne: scraperInfo.name, statut: 'not_found'
      });
      if (histError) debugLogs.push({ step: "Historique", enseigne: scraperInfo.name, statut: "Erreur DB", erreur: histError.message });
    }
  };

  // Exécution PARALLÈLE de tous les scrapers
  await Promise.all(scrapers.map(runScraperCascade));

  // 3. Fallback DuckDuckGo si RIEN trouvé
  if (successCount === 0) {
    debugLogs.push({ step: "Fallback DuckDuckGo", status: "Triggered" });
    
    // Cascade aussi sur DDG
    let ddgFound = false;
    for (let i = 0; i < searchQueries.length; i++) {
      const fbResults = await scrapeDuckDuckGoFallback(searchQueries[i]);
      
      const validFbResults = fbResults.filter(fb => {
        const score = calculateRelevanceScore(fb.titre, productInfos?.marque, productInfos?.designation, ean);
        if (score >= 40) return true;
        debugLogs.push({ enseigne: fb.enseigne, statut: `DDG Rejeté (Score: ${score}%)` });
        return false;
      });

      if (validFbResults.length > 0) {
        ddgFound = true;
        for (const fb of validFbResults) {
          results.push(fb);
          await supabase.from('cache_prix').upsert({
            ean, enseigne: fb.enseigne, titre: fb.titre, prix: parseFloat(fb.prix || "0"), lien: fb.lien
          }, { onConflict: 'ean, enseigne' });
        }
        break; // On arrête la cascade DDG si on a des résultats
      }
      
      if (i < searchQueries.length - 1) await delay(1000, 2000);
    }
  }

  return { results, debugLogs };
}
