import type { ProductInfo } from "./types";

/**
 * QueryBuilder — Vigiprix (v7)
 *
 * Améliorations v7 :
 * - Retour à un scoring plus tolérant pour éviter les faux-négatifs
 * - Ajout de heuristiques de découverte directe (Marque + Ref)
 * - Priorisation assouplie
 */

// ─── Nettoyage texte ─────────────────────────────────────────────────────────

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/["'']/g, "");
}

function extractKeywords(designation: string, maxWords = 5): string {
  const stopWords = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "en", "pour",
    "avec", "sans", "et", "ou", "à", "au", "aux", "par", "sur", "sous"
  ]);

  const normalized = designation
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\b\d+\s*(l|kg|g|mm|cm|m|v|ah|w|kw|ml|cl)\b/gi, "");

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

export function buildSearchQueries(product: ProductInfo): SearchQuery[] {
  const queries: SearchQuery[] = [];
  const { ean, marque, designation, reference_fabricant, categorie } = product;

  const cleanMarque = marque ? cleanText(marque) : null;
  const cleanRef = reference_fabricant ? cleanText(reference_fabricant) : null;
  const cleanDesig = designation ? cleanText(designation) : null;
  const cleanCat = categorie ? cleanText(categorie) : null;

  // 1. EAN Exact
  queries.push({
    query: `"${ean}"`,
    priority: 1,
    type: "ean",
    description: `EAN: ${ean}`
  });

  // 2. Marque + Référence
  if (cleanRef && cleanMarque) {
    queries.push({
      query: `${cleanMarque} ${cleanRef}`,
      priority: 2,
      type: "ref_fabricant",
      description: `Marque + Référence: ${cleanMarque} ${cleanRef}`
    });
  }

  // 3. Référence seule
  if (cleanRef && cleanRef.length > 3) {
    queries.push({
      query: cleanRef,
      priority: 3,
      type: "ref_fabricant",
      description: `Référence seule: ${cleanRef}`
    });
  }

  // 4. Marque + Désignation technique
  if (cleanMarque && cleanDesig) {
    const keywords = extractKeywords(cleanDesig, 4);
    if (keywords) {
      queries.push({
        query: `${cleanMarque} ${keywords} ${cleanCat || ""}`,
        priority: 4,
        type: "mixed",
        description: `Marque + Mots-clés: ${cleanMarque} ${keywords}`
      });
    }
  }

  const seen = new Set<string>();
  return queries
    .filter(q => {
      if (!q.query || seen.has(q.query)) return false;
      seen.add(q.query);
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

// ─── Détection Probabiliste de Fiche Produit (Tolérante) ─────────────────────

export function estimateProductPageProbability(url: string, product?: ProductInfo): { 
  probability: number, 
  type: 'product' | 'category' | 'search' | 'unknown',
  reason: string 
} {
  const urlLower = url.toLowerCase();
  let score = 0.6; // Plus tolérant par défaut
  let type: 'product' | 'category' | 'search' | 'unknown' = 'unknown';
  let reason = "neutre";

  // Patterns POSITIFS (Bonus)
  const positive = [
    { p: /\/p\//i, w: 0.2 },
    { p: /\/produit\//i, w: 0.2 },
    { p: /\/product\//i, w: 0.2 },
    { p: /\/article\//i, w: 0.1 },
    { p: /\.html$/i, w: 0.1 },
    { p: /\d{8,13}/i, w: 0.2 },
  ];

  positive.forEach(item => {
    if (item.p.test(urlLower)) score += item.w;
  });

  // Patterns NÉGATIFS (Malus plus léger)
  const negative = [
    { p: /\/search/i, w: 0.4 },
    { p: /\/recherche/i, w: 0.4 },
    { p: /\/catalogsearch/i, w: 0.4 },
    { p: /\?q=/i, w: 0.3 },
    { p: /\/s\?/i, w: 0.3 },
  ];

  negative.forEach(item => {
    if (item.p.test(urlLower)) {
      score -= item.w;
      type = 'search';
    }
  });

  const probability = Math.min(1.0, Math.max(0.1, score));
  if (probability > 0.6) type = 'product';

  return { probability, type, reason };
}

export function detectHtmlProductSignals(html: string): { 
  score: number, 
  signals: string[] 
} {
  const signals: string[] = [];
  let score = 0;

  if (html.includes('application/ld+json') && (html.includes('"@type": "Product"') || html.includes('"@type":"Product"'))) {
    score += 0.5;
    signals.push("json-ld-product");
  }
  if (html.includes('og:type" content="product"') || html.includes('og:type" content="og:product"')) {
    score += 0.3;
    signals.push("og-type-product");
  }
  if (html.includes('price') || html.includes('prix')) {
    score += 0.2;
    signals.push("price-signal");
  }

  return { score: Math.min(1.0, score), signals };
}

// ─── Scoring de Pertinence ───────────────────────────────────────────────────

export function calculateRelevanceScore(
  foundTitle: string,
  url: string,
  product: ProductInfo,
  htmlSignalsScore = 0
): number {
  if (!foundTitle) return 20; // Score minimal pour ne pas rejeter

  const titleLower = foundTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlProb = estimateProductPageProbability(url, product);

  let score = 0;
  let maxPossible = 0;

  // Match EAN ou Référence (Signal fort)
  if (product.ean && (titleLower.includes(product.ean) || url.includes(product.ean))) {
    score += 80;
    maxPossible += 80;
  }

  if (product.reference_fabricant) {
    maxPossible += 40;
    const ref = product.reference_fabricant.toLowerCase();
    if (titleLower.includes(ref) || url.toLowerCase().includes(ref)) score += 40;
  }

  // Marque (20 pts)
  if (product.marque) {
    maxPossible += 20;
    if (titleLower.includes(product.marque.toLowerCase())) score += 20;
  }

  // Désignation (20 pts)
  if (product.designation) {
    maxPossible += 20;
    const keywords = extractKeywords(product.designation, 5).split(" ");
    const matchCount = keywords.filter(k => k && titleLower.includes(k)).length;
    score += (matchCount / Math.max(keywords.length, 1)) * 20;
  }

  const baseScore = maxPossible > 0 ? (score / maxPossible) * 100 : 40;
  
  // Combinaison finale tolérante
  return Math.min(100, Math.round(baseScore * 0.7 + urlProb.probability * 20 + htmlSignalsScore * 10));
}
