import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import CompareButton from "@/components/CompareButton";
import InitialProductForm from "./InitialProductForm";
import ProductHeader from "./ProductHeader";
import ProductSearchSection from "./ProductSearchSection";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ ean: string }>;
}) {
  const resolvedParams = await params;
  const ean = resolvedParams.ean;

  // Fetch product from supabase
  const { data: produit, error } = await supabase
    .from("produits")
    .select("description_produit, numero_ean, groupe_produit, marque, prix_vente, devise, reference_fabricant, categorie")
    .eq("numero_ean", ean)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
  }

  const isUnknown = !produit;
  const internalPrice = produit?.prix_vente ? Number(produit.prix_vente) : null;

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-6 font-sans text-white animate-in fade-in">
      <ProductHeader ean={ean} produit={produit} isUnknown={isUnknown} />

      {isUnknown ? (
        <InitialProductForm ean={ean} />
      ) : (
        // ProductSearchSection est un Client Component qui gère :
        // - CompareButton (SSE)
        // - ManualPriceModal (saisie manuelle depuis les liens sans prix)
        // - Bouton "Ajouter un prix manuellement" (saisie directe)
        <ProductSearchSection 
          ean={ean} 
          internalPrice={internalPrice} 
          produit={produit}
        />
      )}
    </main>
  );
}
