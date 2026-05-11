import type { ProductInfo } from "./types";

/**
 * QueryBuilder — Vigiprix
 *
 * Construit des requêtes de recherche optimisées selon la priorité :
 * 1. Référence fabricant + marque  (ex: "Ryobi R18PD3-215G")
 * 2. EAN seul
 * 3. Marque + désignation enrichie
 *
 * Les requêtes sont optimisées pour Google Custom Search (résultats shopping).
 */

// ─── Nettoyage texte ─────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/["""'']/g, "");
}

/**
 * Extrait les N premiers mots significatifs d'une désignation.
 * Supprime les stop words, unités de mesure, etc.
 */
function extractKeywords(designation: string, maxWords = 5): string {
  const stopWords = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "en", "pour",
    "avec", "sans", "et", "ou", "à", "au", "aux", "par", "sur", "sous"
  ]);

  const normalized = designation
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")           // Enlever accents
    .replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, " ") // Ponctuation → espace
    .replace(/\b\d+\s*(l|kg|g|mm|cm|m|v|ah|w|kw|ml|cl)\b/gi, ""); // Unités

  const words = normalized
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));

  return words.slice(0, maxWords).join(" ");
}

// ─── Interface publique ──────────────────────────────────────────────────────

export interface SearchQuery {
  query: string;          // Texte de la requête
  priority: number;       // 1 = plus haute priorité
  type: "ref_fabricant" | "ean" | "designation" | "mixed";
  description: string;   // Pour les logs debug
}

/**
 * Génère la liste ordonnée des requêtes à tester.
 * Retourne toujours au moins une requête (EAN).
 */
export function buildSearchQueries(product: ProductInfo): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const { ean, marque, designation, reference_fabricant } = product;

  const cleanMarque = marque ? cleanText(marque) : null;
  const cleanRef = reference_fabricant ? cleanText(reference_fabricant) : null;
  const cleanDesig = designation ? cleanText(designation) : null;

  // ─── PRIORITÉ 1 : Référence fabricant + marque ───────────────────────────
  // Ex: "Ryobi R18PD3-215G" → résultat Google le plus précis possible
  if (cleanRef && cleanMarque) {
    queries.push({
      query: `${cleanMarque} ${cleanRef}`,
      priority: 1,
      type: "ref_fabricant",
      description: `Marque + Référence: ${cleanMarque} ${cleanRef}`
    });
  } else if (cleanRef) {
    queries.push({
      query: cleanRef,
      priority: 1,
      type: "ref_fabricant",
      description: `Référence seule: ${cleanRef}`
    });
  }

  // ─── PRIORITÉ 2 : EAN seul ───────────────────────────────────────────────
  // L'EAN est le plus unique et précis pour identifier un produit exact
  queries.push({
    query: `"${ean}" -inurl:search -inurl:recherche -inurl:catalogsearch`,
    priority: 2,
    type: "ean",
    description: `EAN: ${ean}`
  });

  // ─── PRIORITÉ 2B : EAN + prix ───────────────────────────────

queries.push({
  query: `"${ean}" prix -inurl:search -inurl:recherche`,
  priority: 2,
  type: "ean",
  description: `EAN + prix: ${ean}`
});

  // ─── PRIORITÉ 3 : Marque + Désignation simplifiée ────────────────────────
  if (cleanMarque && cleanDesig) {
    const keywords = extractKeywords(cleanDesig);
    if (keywords) {
      queries.push({
        query: `${cleanMarque} ${keywords} -inurl:search -inurl:recherche`,
        priority: 3,
        type: "mixed",
        description: `Marque + Mots-clés: ${cleanMarque} ${keywords}`
      });
    }
  }

  // ─── PRIORITÉ 4 : Désignation seule (dernier recours) ───────────────────
  if (cleanDesig) {
    const keywords = extractKeywords(cleanDesig, 4);
    if (keywords && !queries.some(q => q.query === keywords)) {
      queries.push({
        query: `${keywords} -inurl:search -inurl:recherche`,
        priority: 4,
        type: "designation",
        description: `Mots-clés désignation: ${keywords}`
      });
    }
  }

  // Dédupliquer et trier par priorité
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
 * Construit la requête optimisée pour Google Custom Search Shopping.
 * Ajoute "prix" pour biaiser vers les pages produits avec tarif.
 */
export function buildGoogleShoppingQuery(baseQuery: string): string {
  // Google CSE: la requête doit rester concise pour des résultats shopping
  // On n'ajoute PAS "prix" car le CSE est configuré pour cibler des sites marchands
  return baseQuery.trim();
}

/**
 * Vérifie si un titre trouvé correspond bien au produit recherché.
 * Score 0–100.
 */
export function calculateRelevanceScore(
  foundTitle: string,
  product: ProductInfo
): number {
  if (!foundTitle) return 0;

  const titleLower = foundTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // L'EAN dans le titre → correspondance quasi-certaine
  if (titleLower.includes(product.ean)) return 100;

  // La référence fabricant → très fort signal
  if (product.reference_fabricant) {
    const refClean = product.reference_fabricant.toLowerCase();
    if (titleLower.includes(refClean)) return 95;
  }

  let score = 0;
  let maxScore = 0;

  // Marque (30 pts)
  if (product.marque) {
    maxScore += 30;
    const brandLower = product.marque.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (titleLower.includes(brandLower)) score += 30;
  }

  // Désignation (70 pts — répartis sur les mots-clés)
  if (product.designation) {
    maxScore += 70;
    const keywords = extractKeywords(product.designation, 6).split(" ");
    const matchCount = keywords.filter(k => k && titleLower.includes(k)).length;
    score += (matchCount / Math.max(keywords.length, 1)) * 70;
  }

  if (maxScore === 0) return 50; // Pas d'info → score neutre (on accepte)
  return Math.round((score / maxScore) * 100);
}
