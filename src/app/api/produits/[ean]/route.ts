import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/produits/[ean]
 *
 * Supprime un produit et toutes ses données liées :
 *   1. cache_prix WHERE ean = ?
 *   2. produits WHERE numero_ean = ?
 *
 * Retourne 204 en succès, 400 si EAN manquant, 500 en erreur.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ ean: string }> }
) {
  const { ean } = await params;

  if (!ean || ean.trim() === "") {
    console.warn("[DELETE /api/produits] EAN manquant dans l'URL");
    return NextResponse.json({ error: "EAN manquant" }, { status: 400 });
  }

  const eanClean = ean.trim();
  console.log(`\n🗑️  [DELETE /api/produits] Suppression produit EAN: ${eanClean}`);

  try {
    // ── 1. Supprimer d'abord le cache (contrainte FK éventuelle) ────────────
    const { error: cacheError } = await supabase
      .from("cache_prix")
      .delete()
      .eq("ean", eanClean);

    if (cacheError) {
      console.error(`[DELETE /api/produits] Erreur suppression cache_prix:`, cacheError);
      return NextResponse.json(
        { error: `Impossible de supprimer le cache: ${cacheError.message}` },
        { status: 500 }
      );
    }
    console.log(`   ✅ cache_prix: lignes supprimées`);

    // ── 2. Supprimer le produit ─────────────────────────────────────────────
    // Vérifier si le produit existe avant de supprimer
    const { data: existing } = await supabase
      .from("produits")
      .select("numero_ean")
      .eq("numero_ean", eanClean)
      .maybeSingle();

    if (!existing) {
      console.warn(`[DELETE /api/produits] Aucun produit trouvé pour EAN: ${eanClean}`);
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const { error: produitError } = await supabase
      .from("produits")
      .delete()
      .eq("numero_ean", eanClean);

    if (produitError) {
      console.error(`[DELETE /api/produits] Erreur suppression produits:`, produitError);
      return NextResponse.json(
        { error: `Impossible de supprimer le produit: ${produitError.message}` },
        { status: 500 }
      );
    }
    console.log(`   ✅ produits: ligne supprimée`);

    console.log(`🟢 [DELETE /api/produits] Suppression complète pour EAN: ${eanClean}`);
    return new NextResponse(null, { status: 204 });

  } catch (err: any) {
    console.error(`🔴 [DELETE /api/produits] Exception inattendue:`, err);
    return NextResponse.json(
      { error: err.message || "Erreur technique inconnue" },
      { status: 500 }
    );
  }
}
