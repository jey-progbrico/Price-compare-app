import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { enrichWithProducts } from "@/lib/data-utils";

import { PriceLog } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStart = searchParams.get("dateStart");
  const dateEnd = searchParams.get("dateEnd");
  const concurrent = searchParams.get("concurrent");
  const rayon = searchParams.get("rayon");

  try {
    // 1. Récupération des relevés avec filtres
    let relQuery = supabase
      .from("releves_prix")
      .select("*")
      .order("created_at", { ascending: false });

    if (dateStart) relQuery = relQuery.gte("created_at", `${dateStart}T00:00:00`);
    if (dateEnd) relQuery = relQuery.lte("created_at", `${dateEnd}T23:59:59`);
    if (concurrent) relQuery = relQuery.ilike("enseigne", `%${concurrent}%`);

    const { data: rawReleves, error: relError } = await relQuery;
    if (relError) throw relError;
    if (!rawReleves || rawReleves.length === 0) {
      return NextResponse.json({ error: "Aucun relevé trouvé pour ces critères." }, { status: 404 });
    }

    // 2. Enrichissement manuel via le helper centralisé
    const releves = await enrichWithProducts(rawReleves as PriceLog[]);

    // 3. Filtrage par rayon et formatage
    const excelData = releves
      .filter(rel => {
        if (!rayon) return true;
        return rel.produit?.rayon === rayon;
      })
      .map(rel => {
        const p = rel.produit;
        const prixMagasin = Number(p?.prix_vente || 0);
        const prixConcurrent = Number(rel.prix_constate || 0);
        const ecart = prixConcurrent - prixMagasin;

        return {
          "Date relevé": new Date(rel.created_at).toLocaleDateString("fr-FR"),
          "Rayon": p?.rayon || "N/A",
          "Groupe produit": p?.groupe_produit || "N/A",
          "Produit": p?.description_produit || rel.designation_originale || "N/A",
          "Marque": p?.marque || "N/A",
          "EAN": rel.ean,
          "Prix magasin (€)": prixMagasin,
          "Concurrent": rel.enseigne,
          "Prix concurrent (€)": prixConcurrent,
          \"Écart prix (€)\": Number(ecart.toFixed(2)),
          \"URL concurrent\": rel.url || \"\"
        };
      });

    if (excelData.length === 0) {
      return NextResponse.json({ error: "Aucun relevé ne correspond au rayon sélectionné." }, { status: 404 });
    }

    // 4. Génération du fichier Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData as any[]);

    // Style minimal : Largeur colonnes auto
    const colWidths = [
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 50 }
    ];
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Relevés");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const fileName = `releves-prix-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`
      }
    });

  } catch (err: any) {
    console.error("[EXPORT ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
