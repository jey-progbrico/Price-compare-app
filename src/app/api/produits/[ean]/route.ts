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
    // ── 0. Récupérer les infos du produit pour le log avant suppression ──────
    const { data: produit, error: fetchError } = await supabase
      .from("produits")
      .select("description_produit, rayon, groupe_produit")
      .eq("numero_ean", eanClean)
      .maybeSingle();

    if (fetchError) {
      console.error(`[DELETE /api/produits] Erreur fetch produit:`, fetchError);
    }

    if (!produit) {
      console.warn(`[DELETE /api/produits] Aucun produit trouvé pour EAN: ${eanClean}`);
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    // ── 1. Supprimer le cache (search results) ───────────────────────────────
    const { error: cacheError } = await supabase
      .from("cache_prix")
      .delete()
      .eq("ean", eanClean);

    if (cacheError) {
      console.error(`[DELETE /api/produits] Erreur suppression cache_prix:`, cacheError);
      // On continue quand même, le cache n'est pas critique
    } else {
      console.log(`   ✅ cache_prix: lignes supprimées`);
    }

    // ── 2. Supprimer le produit ─────────────────────────────────────────────
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

    // ── 3. Logger l'activité ───────────────────────────────────────────────
    try {
      await supabase
        .from("historique_activites")
        .insert([{
          type_action: "suppression_produit",
          ean: eanClean,
          details: {
            nom: produit.description_produit,
            rayon: produit.rayon,
            famille: produit.groupe_produit,
            date_suppression: new Date().toISOString()
          },
          created_at: new Date().toISOString()
        }]);
      console.log(`   ✅ historique_activites: log ajouté`);
    } catch (logErr) {
      console.error(`[DELETE /api/produits] Erreur logging activité:`, logErr);
    }

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
