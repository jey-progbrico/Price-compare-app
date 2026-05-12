import type { ProductInfo } from "./types";

/**
 * QueryBuilder — Vigiprix (v6)
 *
 * Améliorations v6 :
 * - Détection probabiliste de fiche produit (URL + HTML signals)
 * - Scoring de confiance combiné
 * - Logs détaillés pour la détection de type de page
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
    "avec", "sans", "et", "ou", "à", "au", "aux", "par", "sur", "sous",
    "neuf", "occasion", "pas", "cher"
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

// ─── Détection Probabiliste de Fiche Produit ─────────────────────────────────

/**
 * Évalue la probabilité qu'une URL soit une vraie fiche produit.
 */
export function estimateProductPageProbability(url: string, product?: ProductInfo): { 
  probability: number, 
  type: 'product' | 'category' | 'search' | 'unknown',
  reason: string 
} {
  const urlLower = url.toLowerCase();
  let score = 0.5;
  let type: 'product' | 'category' | 'search' | 'unknown' = 'unknown';
  let reason = "neutre";

  // 1. Patterns POSITIFS
  const positive = [
    { p: /\/p\//i, w: 0.3, n: "/p/" },
    { p: /\/produit\//i, w: 0.3, n: "/produit/" },
    { p: /\/product\//i, w: 0.3, n: "/product/" },
    { p: /\/article\//i, w: 0.2, n: "/article/" },
    { p: /\.html$/i, w: 0.1, n: ".html" },
    { p: /\d{8,13}/i, w: 0.2, n: "id_long" },
    { p: /p-/i, w: 0.1, n: "p-slug" }
  ];

  positive.forEach(item => {
    if (item.p.test(urlLower)) {
      score += item.w;
      type = 'product';
      reason = `pattern_positif(${item.n})`;
    }
  });

  // 2. Patterns NÉGATIFS
  const negative = [
    { p: /\/search/i, w: 0.7, t: 'search' as const },
    { p: /\/recherche/i, w: 0.7, t: 'search' as const },
    { p: /\/catalogsearch/i, w: 0.7, t: 'search' as const },
    { p: /\?q=/i, w: 0.6, t: 'search' as const },
    { p: /\/s\?/i, w: 0.6, t: 'search' as const },
    { p: /\/categorie/i, w: 0.5, t: 'category' as const },
    { p: /\/rayon/i, w: 0.5, t: 'category' as const },
    { p: /\/listing/i, w: 0.5, t: 'category' as const },
    { p: /\/marque/i, w: 0.3, t: 'category' as const }
  ];

  negative.forEach(item => {
    if (item.p.test(urlLower)) {
      score -= item.w;
      type = item.t;
      reason = `pattern_negatif(${item.t})`;
    }
  });

  // 3. Match EAN/Ref dans URL
  if (product?.ean && urlLower.includes(product.ean)) {
    score += 0.4;
    reason = "ean_in_url";
  }
  if (product?.reference_fabricant && urlLower.includes(product.reference_fabricant.toLowerCase())) {
    score += 0.3;
    reason = "ref_in_url";
  }

  const probability = Math.min(1.0, Math.max(0.0, score));
  if (probability > 0.7) type = 'product';
  else if (probability < 0.3 && type === 'unknown') type = 'search';

  return { probability, type, reason };
}

/**
 * Détecte des signaux de fiche produit dans du HTML.
 */
export function detectHtmlProductSignals(html: string): { 
  score: number, 
  signals: string[] 
} {
  const signals: string[] = [];
  let score = 0;

  const htmlLower = html.toLowerCase();

  if (html.includes('application/ld+json') && html.includes('"@type": "Product"')) {
    score += 0.6;
    signals.push("json-ld-product");
  }
  if (html.includes('og:type" content="product"') || html.includes('og:type" content="og:product"')) {
    score += 0.4;
    signals.push("og-type-product");
  }
  if (html.includes('product:price:amount') || html.includes('og:price:amount') || html.includes('"price":')) {
    score += 0.2;
    signals.push("price-meta");
  }
  if (htmlLower.includes('ajouter au panier') || htmlLower.includes('add to cart') || htmlLower.includes('panier-add')) {
    score += 0.3;
    signals.push("add-to-cart");
  }
  if (htmlLower.includes('en stock') || htmlLower.includes('in stock') || htmlLower.includes('disponible')) {
    score += 0.1;
    signals.push("stock-info");
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
  if (!foundTitle) return 0;

  const titleLower = foundTitle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlProb = estimateProductPageProbability(url, product);

  let score = 0;
  let maxPossible = 0;

  // 1. EAN Match (100% direct si présent)
  if (titleLower.includes(product.ean) || url.includes(product.ean)) {
    return Math.round(100 * (0.6 + urlProb.probability * 0.4));
  }

  // 2. Marque (30 pts)
  if (product.marque) {
    maxPossible += 30;
    if (titleLower.includes(product.marque.toLowerCase())) score += 30;
  }

  // 3. Référence (30 pts)
  if (product.reference_fabricant) {
    maxPossible += 30;
    const ref = product.reference_fabricant.toLowerCase();
    if (titleLower.includes(ref) || url.toLowerCase().includes(ref)) score += 30;
  }

  // 4. Désignation (40 pts)
  if (product.designation) {
    maxPossible += 40;
    const keywords = extractKeywords(product.designation, 6).split(" ");
    const matchCount = keywords.filter(k => k && titleLower.includes(k)).length;
    score += (matchCount / Math.max(keywords.length, 1)) * 40;
  }

  const baseScore = maxPossible > 0 ? (score / maxPossible) : 0.5;
  
  // Combinaison : Base Score (Texte) + Probabilité URL + Signaux HTML
  // On donne un gros bonus si l'URL crie "PRODUIT"
  const finalScore = Math.round(
    (baseScore * 60) + 
    (urlProb.probability * 30) + 
    (htmlSignalsScore * 10)
  );

  return Math.min(100, finalScore);
}
