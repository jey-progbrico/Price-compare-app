import { NextResponse } from "next/server";
import { saveManualPrice } from "@/lib/search/cacheManager";

export const dynamic = "force-dynamic";

/**
 * POST /api/price-manual
 *
 * Permet de saisir manuellement le prix d'un produit chez un marchand.
 * Utilisé depuis la fiche produit quand le prix n'a pas pu être détecté automatiquement.
 *
 * Body JSON :
 * {
 *   ean: string,          // EAN du produit
 *   enseigne: string,     // Nom du marchand
 *   lien: string,         // URL de la fiche produit chez ce marchand
 *   prix: number,         // Prix saisi manuellement
 *   titre?: string        // Titre du produit (optionnel)
 * }
 */
export async function POST(request: Request) {
  let body: {
    ean?: string;
    enseigne?: string;
    lien?: string;
    prix?: number;
    titre?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { ean, enseigne, lien, prix, titre } = body;

  // Validation
  if (!ean || typeof ean !== "string" || ean.trim().length === 0) {
    return NextResponse.json({ error: "EAN manquant ou invalide" }, { status: 400 });
  }
  if (!enseigne || typeof enseigne !== "string" || enseigne.trim().length === 0) {
    return NextResponse.json({ error: "Nom de l'enseigne manquant" }, { status: 400 });
  }
  if (!lien || typeof lien !== "string" || !lien.startsWith("http")) {
    return NextResponse.json({ error: "Lien produit invalide (doit commencer par http)" }, { status: 400 });
  }
  if (prix === undefined || prix === null || typeof prix !== "number" || isNaN(prix) || prix <= 0 || prix > 99999) {
    return NextResponse.json({ error: "Prix invalide (doit être un nombre positif < 100 000)" }, { status: 400 });
  }

  try {
    await saveManualPrice(
      ean.trim(),
      enseigne.trim(),
      lien.trim(),
      prix,
      titre?.trim()
    );

    return NextResponse.json({
      success: true,
      message: `Prix ${prix}€ enregistré pour ${enseigne}`,
      data: {
        ean: ean.trim(),
        enseigne: enseigne.trim(),
        lien: lien.trim(),
        prix,
        prix_status: "manual",
        source: "manual",
      },
    });
  } catch (error: any) {
    console.error("[ManualPrice] Erreur:", error.message);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le prix", details: error.message },
      { status: 500 }
    );
  }
}
