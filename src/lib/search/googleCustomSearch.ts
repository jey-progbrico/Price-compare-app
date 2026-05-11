import type { SearchResult, ProductInfo, PrixStatus } from "./types";
import { buildSearchQueries, calculateRelevanceScore } from "./queryBuilder";

/**
 * Google Custom Search Engine — Vigiprix (v2)
 *
 * Changements v2 :
 * - Conserve TOUS les résultats, même sans prix détecté
 * - Prix non trouvé → prix_status: "not_found" (lien conservé quand même)
 * - Cascade complète : toutes les requêtes sont exécutées (pas d'arrêt anticipé)
 * - Déduplication par enseigne (un seul lien par marchand)
 * - Score de pertinence MIN abaissé à 20 pour maximiser les résultats
 *
 * Documentation : https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 *
 * Variables d'environnement :
 *   GOOGLE_CSE_KEY  = clé API Google Cloud
 *   GOOGLE_CSE_ID   = Search Engine ID (cx) — configuré en mode "Search the entire web"
 */

const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || "";
const MIN_RELEVANCE_SCORE = parseInt(process.env.MIN_RELEVANCE_SCORE || "20");
const MAX_RESULTS_PER_QUERY = 10; // Max autorisé par l'API Google CSE

// ─── Types Google CSE API ─────────────────────────────────────────────────────

interface GoogleCSEItem {
  title: string;
  link: string;
  displayLink: string;
  snippet?: string;
  pagemap?: {
    offer?: Array<{
      price?: string;
      pricecurrency?: string;
      seller?: string;
    }>;
    product?: Array<{
      name?: string;
      description?: string;
    }>;
    cse_image?: Array<{ src?: string }>;
    metatags?: Array<{
      "og:price:amount"?: string;
      "og:title"?: string;
      "product:price:amount"?: string;
      "twitter:data1"?: string;
    }>;
  };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

// ─── Extraction prix ──────────────────────────────────────────────────────────

/**
 * Tente d'extraire un prix numérique depuis les données structurées CSE.
 * Ordre de priorité : pagemap.offer > metatags > snippet/title regex.
 * Retourne null si aucun prix n'est trouvable — le lien est conservé malgré tout.
 */
function extractPrice(item: GoogleCSEItem): { prix: number | null; status: PrixStatus } {
  // 1. Schema.org Offer (le plus fiable)
  if (item.pagemap?.offer?.length) {
    for (const offer of item.pagemap.offer) {
      if (offer.price) {
        const price = parseFloat(offer.price.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return { prix: price, status: "detected" };
      }
    }
  }

  // 2. Open Graph price meta tags
  if (item.pagemap?.metatags?.length) {
    for (const meta of item.pagemap.metatags) {
      const rawPrice =
        meta["og:price:amount"] ||
        meta["product:price:amount"] ||
        meta["twitter:data1"];
      if (rawPrice) {
        const price = parseFloat(rawPrice.replace(",", ".").replace(/[^\d.]/g, ""));
        if (price > 0 && price < 50000) return { prix: price, status: "detected" };
      }
    }
  }

  // 3. Regex sur le snippet et le titre
  const textToSearch = [item.snippet || "", item.title || ""].join(" ");
  const euroPatterns = [
    /(\d{1,5}[,.]?\d{0,2})\s*€/,
    /€\s*(\d{1,5}[,.]?\d{0,2})/,
    /(\d{1,5}[,.]?\d{0,2})\s*EUR/i,
  ];

  for (const pattern of euroPatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      const price = parseFloat(match[1].replace(",", "."));
      if (price > 0 && price < 50000) return { prix: price, status: "detected" };
    }
  }

  // Aucun prix trouvé — on retourne le lien quand même
  return { prix: null, status: "not_found" };
}

/**
 * Détermine le nom de l'enseigne depuis le displayLink de l'item CSE.
 */
function extractEnseigne(displayLink: string): string {
  const knownEnseignes: Record<string, string> = {
    "amazon.fr": "Amazon",
    "amazon.com": "Amazon",
    "manomano.fr": "ManoMano",
    "manomano.com": "ManoMano",
    "123elec.com": "123elec",
    "bricozor.com": "Bricozor",
    "leroymerlin.fr": "Leroy Merlin",
    "castorama.fr": "Castorama",
    "bricodepot.fr": "Brico Dépôt",
    "bricomarche.com": "Bricomarché",
    "bricoman.fr": "Bricoman",
    "cdiscount.com": "Cdiscount",
    "darty.com": "Darty",
    "fnac.com": "Fnac",
    "rue-du-commerce.fr": "Rue du Commerce",
    "auchan.fr": "Auchan",
    "boulanger.com": "Boulanger",
    "lesbricoleurs.fr": "Les Bricoleurs",
    "weldom.fr": "Weldom",
    "tools.fr": "Tools",
    "elektro.fr": "Elektro",
    "outillage.fr": "Outillage.fr",
    "entrepot-du-bricolage.fr": "L'Entrepôt du Bricolage",
    "rexel.fr": "Rexel",
    "grdf.fr": "GRDF",
    "conrad.fr": "Conrad",
    "adeo.com": "Adeo",
    "bricorama.fr": "Bricorama",
    "pointp.fr": "Point P",
    "mr-bricolage.fr": "Mr Bricolage",
    "mcm-electromenager.fr": "MCM",
    "ubaldi.com": "Ubaldi",
    "mega.fr": "Mega",
    "maisondunet.com": "Maison du Net",
    "electricite-pro.fr": "Electricité Pro",
    "proelec.fr": "Proelec",
    "direct-electricite.fr": "Direct Electricité",
    "elekta.fr": "Elekta",
    "sosntools.com": "SOS N'Tools",
    "probateco.fr": "Probateco",
    "toolstation.fr": "Toolstation",
    "screwfix.fr": "Screwfix",
    "hornbach.fr": "Hornbach",
    "obi.fr": "OBI",
    "espace-bricolage.fr": "Espace Bricolage",
    "bricoled.fr": "Bricoled",
    "sparkler-led.fr": "Sparkler LED",
    "neo-neon.com": "Neo-Neon",
    "materielelectrique.com": "Matériel Électrique",
    "debflex.fr": "Debflex",
    "legrand.fr": "Legrand",
    "schneider-electric.fr": "Schneider Electric",
    "hager.fr": "Hager",
    "acova.fr": "Acova",
    "thermor.fr": "Thermor",
    "atlantic.fr": "Atlantic",
    "domomat.com": "Domomat",
    "domomat.com": "Domomat",
    "materielelectrique.com": "Materiel Electrique",
    "toolstation.fr": "Toolstation",
    "legallais.com": "Legallais",
    "maxoutil.com": "Maxoutil",
    "quincaillerie.pro": "Quincaillerie Pro",
    "racetools.fr": "Racetools",
    "champion-direct.com": "Champion Direct",
    "manutan.fr": "Manutan",
    "setin.fr": "Setin",
    "prolians.fr": "Prolians",
    "foussier.fr": "Foussier",
    "otelo.fr": "Otelo",
    "batiramax.com": "Batiramax",
    "elec44.fr": "Elec44",
    "bis-electric.com": "BIS Electric",
    "elecdirect.fr": "ElecDirect",
    "cdiscount.com": "Cdiscount",
    "rakuten.fr": "Rakuten",
    "baudelet-materiels.fr": "Baudelet Materiels",
    "cazabox.com": "Cazabox",
    "clickoutil.com": "ClickOutil",
    "cotebrico.fr": "Cote Brico",
    "debonix.fr": "Debonix",
    "directomat.com": "Directomat",
    "edisline.com": "Edisline",
    "espinosa.fr": "Espinosa",
    "fixami.fr": "Fixami",
    "guedo-outillage.fr": "Guedo Outillage",
    "master-outillage.com": "Master Outillage",
    "monmagasingeneral.com": "Mon Magasin General",
    "motoblouz.com": "Motoblouz",
    "mytoolstore.fr": "MyToolStore",
    "quofi.fr": "Quofi",
    "servitech.fr": "Servitech",
    "sobrico.com": "Sobrico",
    "univers-du-pro.com": "Univers du Pro",
    "u-power.fr": "U Power",
    "worken.fr": "Worken",
    "comptoirdespros.com": "Comptoir des Pros",
    "allo-reseau.com": "Allo Reseau",
    "cablematic.fr": "Cablematic",
    "eplanetelec.fr": "E Planetelec",
    "electissime.fr": "Electissime",
    "one-elec.com": "One Elec",
    "red-distribution.fr": "Red Distribution",
    "vente-unique.com": "Vente Unique",
    "bricoprive.com": "Brico Prive",
    "discountandquality.com": "Discount and Quality",
    "kamody.fr": "Kamody",
    "ubuy.fr": "UBuy",
    "manubricole.com": "Manubricole",
    "mesmateriaux.com": "Mes Materiaux",
    "idf-materiaux.com": "IDF Materiaux",
    "bati-avenue.com": "Bati Avenue",
    "monbatiment.fr": "Mon Batiment",
    "afdb.fr": "AFDB",
    "afz-outillage.fr": "AFZ Outillage",
    "entrepot-du-bricolage.fr": "Entrepôt du Bricolage",
    "gedimat.fr": "Gedimat"
  };

  const hostname = displayLink
    .replace(/^www\./, "")
    .toLowerCase()
    .trim();

  if (knownEnseignes[hostname]) return knownEnseignes[hostname];

  // Capitaliser le premier segment du domaine
  const domain = hostname.split(".")[0];
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

// ─── Moteur principal ─────────────────────────────────────────────────────────

/**
 * Lance une recherche Google CSE et retourne les résultats normalisés.
 * Conserve TOUS les résultats, même ceux sans prix détecté.
 *
 * @param query - Requête de recherche
 * @param product - Informations produit pour filtrage de pertinence
 * @returns Liste de SearchResult avec ou sans prix, mais toujours avec le lien
 */
export async function searchGoogleCSE(
  query: string,
  product: ProductInfo
): Promise<SearchResult[]> {

console.log("[GoogleCSE] START");
console.log("[GoogleCSE] KEY:", GOOGLE_CSE_KEY?.slice(0, 10));
console.log("[GoogleCSE] CX:", GOOGLE_CSE_ID);

  if (!GOOGLE_CSE_KEY || !GOOGLE_CSE_ID) {
    console.error("[GoogleCSE] Clés API manquantes (GOOGLE_CSE_KEY, GOOGLE_CSE_ID)");
    return [];
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", GOOGLE_CSE_KEY);
  url.searchParams.set("cx", GOOGLE_CSE_ID);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("num", String(MAX_RESULTS_PER_QUERY));
  url.searchParams.set("gl", "fr");    // Géolocalisation France
  url.searchParams.set("hl", "fr");    // Langue interface française

  console.log(`[GoogleCSE] Recherche: "${query}"`);
  console.log("[GoogleCSE] URL:", url.toString());

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[GoogleCSE] Timeout (10s)");
    } else {
      console.error("[GoogleCSE] Fetch error:", err.message);
    }
    return [];
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[GoogleCSE] HTTP ${response.status}: ${errorText}`);
    if (response.status === 403) throw new Error(`403 PERMISSION_DENIED: ${errorText}`);
    return [];
  }

  let data: GoogleCSEResponse;
  try {
    data = await response.json();
  } catch (err: any) {
    console.error("[GoogleCSE] Parse error:", err.message);
    return [];
  }

  if (data.error) {
    const msg = `API error ${data.error.code}: ${data.error.message}`;
    console.error(`[GoogleCSE] ${msg}`);
    if (data.error.code === 403) throw new Error(`403 ${msg}`);
    return [];
  }

  if (!data.items || data.items.length === 0) {
    console.log(`[GoogleCSE] Aucun résultat pour "${query}"`);
    return [];
  }

  // ─── Traitement des résultats ──────────────────────────────────────────────
  const results: SearchResult[] = [];

  for (const item of data.items) {
    const { prix, status: prix_status } = extractPrice(item);
    const enseigne = extractEnseigne(item.displayLink);
    const titre = item.title || "";

    const link = item.link?.toLowerCase() || "";

const badPatterns = [
  "/search",
  "?q=",
  "/recherche",
  "/catalogsearch",
  "/search?",
  "/s?",
  "results",
];

const isSearchPage = badPatterns.some(pattern =>
  link.includes(pattern)
);

if (isSearchPage) {
  console.log("[GoogleCSE] Search page ignored:", link);
  continue;
}

    // Calcul du score de pertinence
    const score = calculateRelevanceScore(titre, product);

    // Rejeter uniquement les résultats vraiment hors-sujet (score très bas)
    // On est plus permissif sur les résultats sans prix (score min = 15)
    const minScore = 5
 
     console.log(
  `[GoogleCSE] ${enseigne} | score=${score} | prix=${prix} | ${titre}`
);
    if (score < minScore && prix !== null) {
      console.log(`[GoogleCSE] Rejeté (score ${score}%, min ${minScore}%): ${titre.substring(0, 60)}`);
      continue;
    }

    // Image produit (si disponible via CSE)
    const image_url = item.pagemap?.cse_image?.[0]?.src || null;

    results.push({
      enseigne,
      titre,
      prix,
      prix_status,
      lien: item.link,
      source: "google_cse",
      image_url,
      relevance_score: score,
      retrieved_at: new Date().toISOString(),
    });
  }

  const withPrice = results.filter(r => r.prix !== null).length;
  const withoutPrice = results.length - withPrice;
  console.log(
    `[GoogleCSE] ${results.length}/${data.items.length} résultats ` +
    `(${withPrice} avec prix, ${withoutPrice} liens seuls)`
  );
  return results;
}

/**
 * Lance une recherche en cascade sur TOUTES les requêtes générées.
 * Ne s'arrête PAS dès qu'on a assez de résultats — exploite toutes les requêtes.
 * Déduplication par enseigne (un seul lien par marchand).
 *
 * @param product - Infos produit pour générer les requêtes
 */
export async function searchGoogleCSECascade(
  product: ProductInfo,
  onProgress?: (results: SearchResult[], queryIndex: number) => void
): Promise<SearchResult[]> {
  const queries = buildSearchQueries(product);
  const allResults: SearchResult[] = [];
  const seenEnseignes = new Set<string>();

  for (let i = 0; i < queries.length; i++) {
    const { query, description } = queries[i];
    console.log(`[GoogleCSE] Cascade Q${i + 1}/${queries.length}: ${description}`);

    const results = await searchGoogleCSE(query, product);

    // Déduplication par enseigne : on garde le premier résultat trouvé par enseigne
    // Priorité aux résultats avec prix sur ceux sans prix
    for (const r of results) {
      if (!seenEnseignes.has(r.enseigne)) {
        seenEnseignes.add(r.enseigne);
        allResults.push(r);
      } else if (r.prix !== null) {
        // Si on avait un lien sans prix pour cette enseigne, on le remplace par un résultat avec prix
        const existingIdx = allResults.findIndex(
          existing => existing.enseigne === r.enseigne && existing.prix === null
        );
        if (existingIdx !== -1) {
          allResults[existingIdx] = r;
        }
      }
    }

    if (onProgress) onProgress([...allResults], i);

    // Petite pause entre les requêtes (respecter les quotas)
    if (i < queries.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`[GoogleCSE] Cascade terminée: ${allResults.length} enseignes uniques`);
  return allResults;
}

/**
 * Vérifie si la configuration Google CSE est disponible.
 */
export function isGoogleCSEConfigured(): boolean {
  return Boolean(GOOGLE_CSE_KEY && GOOGLE_CSE_ID);
}
