import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompareButton from "@/components/CompareButton";
import InitialProductForm from "./InitialProductForm";
import ProductHeader from "./ProductHeader";

export const revalidate = 0;

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
    .select("description_produit, numero_ean, groupe_produit, marque, prix_vente, devise")
    .eq("numero_ean", ean)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
  }

  const isUnknown = !produit;

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-6 font-sans text-white animate-in fade-in">
      <ProductHeader ean={ean} produit={produit} isUnknown={isUnknown} />
      {/* Résultats concurrents */}
      {isUnknown ? (
        <InitialProductForm ean={ean} />
      ) : (
        <CompareButton ean={ean} internalPrice={produit.prix_vente ? Number(produit.prix_vente) : null} isUnknown={false} />
      )}
    </main>
  );
}
