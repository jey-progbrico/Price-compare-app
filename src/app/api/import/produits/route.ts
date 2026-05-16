import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/auth-utils";
import * as XLSX from "xlsx";

import { Product } from "@/types/database";

interface RawRow {
  description_produit?: string;
  numero_ean?: string | number;
  groupe_produit?: string;
  marque?: string;
  prix_vente?: string | number;
  rayon?: string;
  code_interne?: string | number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
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
    const rawData = XLSX.utils.sheet_to_json(ws) as RawRow[];

    if (rawData.length === 0) {
      return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 });
    }

    // 2. Validation des colonnes (Basée sur le nom de colonne)
    const requiredCols: (keyof RawRow)[] = [
      "description_produit",
      "numero_ean",
      "groupe_produit",
      "marque",
      "prix_vente",
      "rayon"
    ];

    const firstRowKeys = Object.keys(rawData[0]) as (keyof RawRow)[];
    const missingCols = requiredCols.filter(col => !firstRowKeys.includes(col));

    if (missingCols.length > 0) {
      return NextResponse.json({ 
        error: `Structure incorrecte. Colonnes manquantes : ${missingCols.join(", ")}` 
      }, { status: 400 });
    }

    // 3. Validation des données ligne par ligne
    const cleanData: Partial<Product>[] = [];
    const errors: string[] = [];

    rawData.forEach((row, index) => {
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
        code_interne: row.code_interne ? String(row.code_interne).trim() : null,
        updated_at: new Date().toISOString()
      });
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation échouée", details: errors }, { status: 400 });
    }

    // 4. Récupérer le store_id de l'utilisateur
    const { profile } = await getServerProfile(supabase);
    if (!profile) {
      return NextResponse.json({ error: "Profil utilisateur non trouvé." }, { status: 401 });
    }

    // 5. Préparation finale des données avec store_id
    const finalData = cleanData.map(p => ({
      ...p,
      store_id: profile.store_id
    }));

    // 6. Upsert massif (basé sur EAN + Store pour le multi-tenant)
    const { error: upsertError } = await supabase
      .from("produits")
      .upsert(finalData, { onConflict: "numero_ean,store_id" });

    if (upsertError) throw upsertError;

    // 7. Journaliser l'activité
    await supabase.from("historique_activites").insert([
      {
        type_action: "import_produits",
        store_id: profile.store_id,
        user_id: profile.id,
        details: {
          count: finalData.length,
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
