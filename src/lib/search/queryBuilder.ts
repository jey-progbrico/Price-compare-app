import type { ProductInfo } from "./types";

/**
 * QueryBuilder — Vigiprix (v5)
 *
 * Améliorations v5 (Équilibrage) :
 * - Pénalité URL assouplie (score modéré plutôt que rejet massif)
 * - Pondération rééquilibrée : plus de poids sur le titre et la marque
 * - Support des recherches larges si nécessaire
 */

// ─── Nettoyage texte ─────────────────────────────────────────────────────────

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/["'']/g, "");
}

/**
 * Extrait les mots-clés les plus importants d'une désignation.
 */
function extractKeywords(designation: string, maxWords = 5): string {
  const stopWords = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "en", "pour",
    "avec", "sans", "et", "ou", "à", "au", "aux", "par", "sur", "sous",
    "neuf", "occasion", "pas", "cher"
  ]);

  const normalized = designation
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")           // Accents
    .replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, " ") // Ponctuation
    .replace(/\b\d+\s*(l|kg|g|mm|cm|m|v|ah|w|kw|ml|cl)\b/gi, ""); // Unités

  const words = normalized
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  return words.slice(0, maxWords).join(" ");
}

// ─── Interface publique ──────────────────────────────────────────────────────

export interface SearchQuery {
  query: string;
  priority: number;
  type: "ref_fabricant" | "ean" | "designation" | "mixed";
  description: string;
}

/**
 * Génère la liste ordonnée des requêtes à tester.
 */
export function buildSearchQueries(product: ProductInfo): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const { ean, marque, designation, reference_fabricant, categorie } = product;

  const cleanMarque = marque ? cleanText(marque) : null;
  const cleanRef = reference_fabricant ? cleanText(reference_fabricant) : null;
  const cleanDesig = designation ? cleanText(designation) : null;
  const cleanCat = categorie ? cleanText(categorie) : null;

  // On réduit les patterns négatifs pour ne pas brider Google outre mesure
  const searchNegativePatterns = "-inurl:catalogsearch -inurl:searchresults";

  // 1. EAN Exact
  queries.push({
    query: `"${ean}"`,
    priority: 1,
    type: "ean",
    description: `EAN exact: ${ean}`
  });

  // 2. Marque + Référence Fabricant
  if (cleanRef && cleanMarque) {
    queries.push({
      query: `"${cleanMarque}" "${cleanRef}"`,
      priority: 2,
      type: "ref_fabricant",
      description: `Marque + Référence: ${cleanMarque} ${cleanRef}`
    });
  }

  // 3. Référence seule
  if (cleanRef && cleanRef.length > 3) {
    queries.push({
      query: `"${cleanRef}"`,
      priority: 3,
      type: "ref_fabricant",
      description: `Référence seule: ${cleanRef}`
    });
  }

  // 4. Marque + Mots-clés désignation (Plus large)
  if (cleanMarque && cleanDesig) {
    const keywords = extractKeywords(cleanDesig, 4);
    if (keywords) {
      queries.push({
        query: `${cleanMarque} ${keywords} ${cleanCat || ""} ${searchNegativePatterns}`,
        priority: 4,
        type: "mixed",
        description: `Marque + Mots-clés: ${cleanMarque} ${keywords}`
      });
    }
  }

  // 5. Fallback large si nécessaire
  if (cleanMarque && !cleanRef) {
     queries.push({
        query: `${cleanMarque} ${ean}`,
        priority: 5,
        type: "mixed",
        description: `Marque + EAN fallback`
      });
  }

  // Dédupliquer et trier
  const seen = new Set<string>();
  return queries
    .filter(q => {
      if (!q.query || seen.has(q.query)) return false;
      seen.add(q.query);
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Calcule un score de qualité pour une URL (0.5 à 1.0).
 * Assoupli : plus de rejet automatique, juste une pénalité.
 */
export function calculateUrlQuality(url: string): number {
  const urlLower = url.toLowerCase();
  
  // Patterns de pages de résultats (souvent suspects mais parfois valides)
  const suspiciousPatterns = [
    "/search", "/recherche", "/catalogsearch", "/search?", "/s?", 
    "?q=", "results", "listing", "filter", "tri=", "sort="
  ];
  
  const isSuspicious = suspiciousPatterns.some(p => urlLower.includes(p));
  
  // Patterns de catégories (souvent moins pertinents pour une fiche)
  const categoryPatterns = ["/c/", "/categorie", "/rayon", "/category/"];
  const isCategory = categoryPatterns.some(p => urlLower.includes(p));

  let penalty = 1.0;
  if (isSuspicious) penalty -= 0.3; // Pénalité modérée
  if (isCategory) penalty -= 0.1;

  // Patterns indiquant une fiche produit (bonus)
  const productPatterns = [
    /\d{8,13}/, 
    /\.html$/, 
    /\b(p|prod|product|article|ref)\b/i,
    /p-/, /pr\d+/
  ];
  
  const isLikelyProduct = productPatterns.some(p => p.test(urlLower));
  if (isLikelyProduct) penalty += 0.1;

  return Math.min(1.0, Math.max(0.5, penalty)); // Score entre 0.5 et 1.0
}

/**
 * Score de pertinence global (0-100).
 * Pondération rééquilibrée.
 */
export function calculateRelevanceScore(
  foundTitle: string,
  url: string,
  product: ProductInfo
): number {
  if (!foundTitle) return 0;

  const titleLower = foundTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlLower = url.toLowerCase();
  const urlQuality = calculateUrlQuality(url);

  let score = 0;
  let maxPossible = 0;

  // 1. EAN (Match parfait) - 100%
  if (titleLower.includes(product.ean) || urlLower.includes(product.ean)) {
    return Math.round(100 * urlQuality);
  }

  // 2. Marque (30 pts)
  if (product.marque) {
    maxPossible += 30;
    const brand = product.marque.toLowerCase();
    if (titleLower.includes(brand)) {
      score += 30;
    }
  }

  // 3. Référence fabricant (30 pts)
  if (product.reference_fabricant) {
    maxPossible += 30;
    const ref = product.reference_fabricant.toLowerCase();
    if (titleLower.includes(ref) || urlLower.includes(ref)) {
      score += 30;
    }
  }

  // 4. Désignation technique (40 pts)
  if (product.designation) {
    maxPossible += 40;
    const keywords = extractKeywords(product.designation, 6).split(" ");
    const matchCount = keywords.filter(k => k && titleLower.includes(k)).length;
    score += (matchCount / Math.max(keywords.length, 1)) * 40;
  }

  const baseScore = maxPossible > 0 ? Math.round((score / maxPossible) * 100) : 50;
  
  // Appliquer la qualité de l'URL comme facteur modérateur
  const finalScore = Math.round(baseScore * urlQuality);

  // Debug logs (interne)
  // console.log(`[Score] Base: ${baseScore} | Quality: ${urlQuality} | Final: ${finalScore}`);

  return finalScore;
}
