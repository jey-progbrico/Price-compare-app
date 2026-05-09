const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) process.env[k.trim()] = v.trim();
});

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  console.log("Testing INSERT into produits...");
  const { data: pData, error: pError } = await supabase.from("produits").insert({
    numero_ean: "1234567890123",
    marque: "Test Marque",
    description_produit: "Test Desc",
    prix_vente: 10,
    devise: "€"
  }).select();
  console.log("Result produits:", { pData, pError });

  console.log("\nTesting INSERT into historique_recherches...");
  const { data: hData, error: hError } = await supabase.from("historique_recherches").insert({
    ean: "1234567890123",
    enseigne: "Test",
    statut: "success"
  }).select();
  console.log("Result historique:", { hData, hError });
}

test();
