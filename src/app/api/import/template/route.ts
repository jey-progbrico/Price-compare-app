import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const columns = [
      "description_produit",
      "numero_ean",
      "groupe_produit",
      "marque",
      "prix_vente",
      "rayon"
    ];

    const data = [
      {
        description_produit: "Exemple: Interrupteur Va-et-Vient",
        numero_ean: "3103220009574",
        groupe_produit: "Appareillage",
        marque: "Legrand",
        prix_vente: 12.90,
        rayon: "Électricité"
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: columns });

    // Largeur colonnes
    ws["!cols"] = [
      { wch: 40 }, // description_produit
      { wch: 20 }, // numero_ean
      { wch: 20 }, // groupe_produit
      { wch: 20 }, // marque
      { wch: 15 }, // prix_vente
      { wch: 20 }, // rayon
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Import Produits");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="modele-import-produits.xlsx"'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
