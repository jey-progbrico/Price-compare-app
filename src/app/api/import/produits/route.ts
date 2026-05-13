import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Format non supporté. Utilisez uniquement .xlsx" }, { status: 400 });
    }

    // 1. Lire le fichier Excel
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws);

    if (rawData.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
    }

    // 2. Validation des colonnes (Basée sur le nom de colonne)
    const requiredCols = [
      "description_produit",
      "numero_ean",
      "groupe_produit",
      "marque",
      "prix_vente",
      "rayon"
    ];

    const firstRowKeys = Object.keys(rawData[0] as any);
    const missingCols = requiredCols.filter(col => !firstRowKeys.includes(col));

    if (missingCols.length > 0) {
      return NextResponse.json({ 
        error: `Structure incorrecte. Colonnes manquantes : ${missingCols.join(", ")}` 
      }, { status: 400 });
    }

    // 3. Validation des données ligne par ligne
    const cleanData: any[] = [];
    const errors: string[] = [];

    rawData.forEach((row: any, index) => {
      const lineNum = index + 2; // +1 header +1 index
      
      // Nettoyage EAN (string)
      const ean = String(row.numero_ean || "").trim();
      if (!ean || ean.length < 8) {
        errors.push(`Ligne ${lineNum}: EAN invalide ou manquant.`);
        return;
      }

      // Nettoyage Prix (num)
      const prix = parseFloat(String(row.prix_vente).replace(',', '.'));
      if (isNaN(prix)) {
        errors.push(`Ligne ${lineNum}: Prix vente invalide.`);
        return;
      }

      // Autres champs obligatoires
      if (!row.description_produit) errors.push(`Ligne ${lineNum}: Désignation manquante.`);
      if (!row.marque) errors.push(`Ligne ${lineNum}: Marque manquante.`);
      if (!row.rayon) errors.push(`Ligne ${lineNum}: Rayon manquant.`);
      if (!row.groupe_produit) errors.push(`Ligne ${lineNum}: Famille produit manquante.`);

      cleanData.push({
        numero_ean: ean,
        description_produit: String(row.description_produit).trim(),
        marque: String(row.marque).trim(),
        rayon: String(row.rayon).trim(),
        groupe_produit: String(row.groupe_produit).trim(),
        prix_vente: prix,
        updated_at: new Date().toISOString()
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
    }

    // 4. Upsert massif (basé sur numero_ean)
    const { error: upsertError } = await supabase
      .from("produits")
      .upsert(cleanData, { onConflict: "numero_ean" });

    if (upsertError) throw upsertError;

    // 5. Journaliser l'activité
    await supabase.from("historique_activites").insert([
      {
        type_action: "import_produits",
        details: {
          count: cleanData.length,
          fileName: file.name
        }
      }
    ]);

    return NextResponse.json({ 
      success: true, 
      count: cleanData.length 
    });

  } catch (err: any) {
    console.error("[IMPORT ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
