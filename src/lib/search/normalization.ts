/**
 * Normalisation des désignations produits — Vigiprix
 * Expansion des abréviations métier du bricolage en termes commerciaux.
 */

// Dictionnaire des abréviations courantes
const DICTIONNAIRE_ABREVIATIONS: Record<string, string[]> = {
  "VV": ["va et vient", "va-et-vient"],
  "BLC": ["blanc"],
  "COMPO": ["composable"],
  "INT": ["interrupteur"],
  "MOD": ["module"],
  "PC": ["prise"],
  "ENC": ["encastré"],
  "SAI": ["saillie"],
  "VAETV": ["va et vient", "va-et-vient"],
  "EXT": ["extérieur"],
  "BT": ["bouton"],
  "POUS": ["poussoir"],
  "LUM": ["luminaire"],
  "SPEC": ["spécial"],
};

/**
 * Normalise une désignation en remplaçant les abréviations par leurs variantes.
 * Génère toutes les combinaisons possibles (produit cartésien).
 */
export function normaliserDesignation(designation: string): string[] {
  if (!designation) return [];

  console.log(`[NORMALISATION] Désignation originale : "${designation}"`);

  const mots = designation.split(/\s+/);
  const segments: string[][] = mots.map(mot => {
    const motNettoye = mot.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (DICTIONNAIRE_ABREVIATIONS[motNettoye]) {
      return DICTIONNAIRE_ABREVIATIONS[motNettoye];
    }
    return [mot];
  });

  // Génération des combinaisons par produit cartésien
  const combinaisons = genererCombinaisons(segments);
  const resultats = combinaisons.map(c => c.join(" "));

  console.log(`[NORMALISATION] Variantes générées (${resultats.length}) :`);
  resultats.forEach(r => console.log(`  -> "${r}"`));

  return resultats;
}

/**
 * Fonction récursive pour générer toutes les combinaisons de variantes.
 */
function genererCombinaisons(listes: string[][]): string[][] {
  if (listes.length === 0) return [[]];
  
  const premier = listes[0];
  const reste = genererCombinaisons(listes.slice(1));
  
  const resultats: string[][] = [];
  for (const v of premier) {
    for (const r of reste) {
      resultats.push([v, ...r]);
    }
  }
  return resultats;
}
