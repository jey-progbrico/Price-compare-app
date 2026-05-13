/**
 * Script de test pour la découverte DuckDuckGo et la normalisation
 * Lancer avec : node src/lib/search/test-discovery.js
 */

const { normaliserDesignation } = require('./normalization');
const { buildSearchQueries } = require('./queryBuilder');
const { decouvrirProduitViaDDG } = require('./duckDuckGoEngine');

async function testNormalization() {
  console.log("=== TEST NORMALISATION ===");
  const titre = "VV 10A 1 MOD COMPO BLC MOSAIC";
  const variantes = normaliserDesignation(titre);
  console.log("Variantes attendues : 'va et vient blanc...', 'va-et-vient blanc...'");
  console.log("Variantes obtenues :", variantes.length);
}

async function testDiscovery() {
  console.log("\n=== TEST DÉCOUVERTE DDG ===");
  const produit = {
    ean: "3414971679726",
    marque: "Legrand",
    designation: "VV 10A 1 MOD COMPO BLC MOSAIC"
  };

  const site = "manomano.fr";
  console.log(`Test de découverte pour ${produit.ean} sur ${site}...`);
  
  try {
    const resultat = await decouvrirProduitViaDDG(produit, site);
    if (resultat) {
      console.log("RÉSULTAT TROUVÉ :");
      console.log(`  Enseigne : ${resultat.enseigne}`);
      console.log(`  Titre : ${resultat.titre}`);
      console.log(`  Prix : ${resultat.prix}€`);
      console.log(`  Lien : ${resultat.lien}`);
    } else {
      console.log("Aucun résultat trouvé.");
    }
  } catch (err) {
    console.error("Erreur pendant le test :", err.message);
  }
}

// Note : Pour lancer ce script tel quel, il faudrait que les fichiers soient compilés ou en format CJS.
// Comme le projet est en TS, ce script sert de base pour un test manuel ou via un lanceur TS.
console.log("Script chargé. Prêt pour les tests.");
// testNormalization();
// testDiscovery();
