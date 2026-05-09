/**
 * Nettoie et normalise un texte pour la comparaison sémantique
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  let normalized = text.toLowerCase();
  
  // Supprimer les accents
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Supprimer la ponctuation et caractères spéciaux
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
  
  // Supprimer les unités courantes et dimensions qui perturbent le match (L, kg, mm, cm, v, ah)
  // On utilise des expressions régulières avec des frontières de mots
  normalized = normalized.replace(/\b(\d+)\s*(l|kg|g|mm|cm|m|v|ah|w|kw|ml|cl)\b/g, "$1");
  
  // Retirer les mots vides (stop words)
  const stopWords = ['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'pour', 'avec', 'sans', 'et', 'ou'];
  const words = normalized.split(/\s+/).filter(w => w.length > 1 && !stopWords.includes(w));
  
  return words.join(" ");
}

/**
 * Extrait les mots-clés les plus importants d'une désignation
 * (ex: "Perceuse visseuse sans fil 18V Bosch Professional" -> "Perceuse visseuse sans fil")
 */
export function simplifyDesignation(designation: string): string {
  if (!designation) return "";
  // On prend les 4 premiers mots significatifs
  const words = normalizeText(designation).split(" ");
  return words.slice(0, 4).join(" ");
}

/**
 * Calcule un score de pertinence entre le titre trouvé et les infos attendues (0 à 100)
 */
export function calculateRelevanceScore(
  foundTitle: string, 
  expectedBrand: string | null | undefined, 
  expectedDesignation: string | null | undefined,
  expectedEan: string
): number {
  if (!foundTitle) return 0;
  
  // Si on trouve l'EAN exact dans le titre, c'est presque un 100% garanti (surtout pour les pièces détachées)
  if (foundTitle.includes(expectedEan)) return 100;
  
  const normFound = normalizeText(foundTitle);
  const wordsFound = new Set(normFound.split(" "));
  
  let score = 0;
  let maxPossibleScore = 0;

  // Critère 1: Marque (Bonus fort)
  if (expectedBrand) {
    const normBrand = normalizeText(expectedBrand);
    const brandWords = normBrand.split(" ");
    maxPossibleScore += 30; // La marque vaut 30 points
    
    let brandMatchCount = 0;
    brandWords.forEach(w => {
      if (wordsFound.has(w)) brandMatchCount++;
    });
    
    score += (brandMatchCount / brandWords.length) * 30;
  }

  // Critère 2: Désignation / Mots-clés (70 points)
  if (expectedDesignation) {
    const normDesc = normalizeText(expectedDesignation);
    const descWords = normDesc.split(" ");
    maxPossibleScore += 70;
    
    let descMatchCount = 0;
    descWords.forEach(w => {
      if (wordsFound.has(w)) descMatchCount++;
    });
    
    score += (descMatchCount / descWords.length) * 70;
  }

  if (maxPossibleScore === 0) return 100; // Si aucune info (produit inconnu par ex), on accepte

  return Math.round((score / maxPossibleScore) * 100);
}

/**
 * Génère la liste des requêtes de recherche en cascade selon les règles :
 * 1. EAN exact
 * 2. Marque + EAN
 * 3. Désignation simplifiée + EAN
 * 4. Marque + Désignation
 */
export function generateSearchQueries(
  ean: string, 
  marque?: string | null, 
  designation?: string | null
): string[] {
  const queries: string[] = [];
  
  // 1. EAN Strict
  queries.push(ean);

  // S'il n'y a pas de données locales, on ne peut chercher que par EAN
  if (!marque && !designation) {
    return queries;
  }

  const cleanBrand = marque ? marque.trim() : "";
  const cleanDesignation = designation ? designation.trim() : "";
  const simplifiedDesc = simplifyDesignation(cleanDesignation);

  // 2. Marque + EAN
  if (cleanBrand) {
    queries.push(`${cleanBrand} ${ean}`);
  }

  // 3. Désignation simplifiée + EAN
  if (simplifiedDesc) {
    queries.push(`${simplifiedDesc} ${ean}`);
  }

  // 4. Marque + Désignation
  if (cleanBrand && cleanDesignation) {
    queries.push(`${cleanBrand} ${simplifiedDesc}`);
  } else if (cleanDesignation) {
    queries.push(simplifiedDesc);
  }

  // On déduplique au cas où
  return Array.from(new Set(queries));
}
