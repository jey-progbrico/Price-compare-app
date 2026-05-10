import { supabase } from "@/lib/supabase";
import ProductListClient from "./ProductListClient";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProduitsPage() {
  let produits: any[] = [];
  let supabaseError = null;

  try {
    const { data, error } = await supabase
      .from("produits")
      .select("numero_ean, description_produit, marque, prix_vente, devise")
      .order("numero_ean", { ascending: false });

    if (error) {
      console.error("Erreur produits:", error);
      supabaseError = error.message;
    } else if (data) {
      produits = data;
    }
  } catch (err: any) {
    console.error("Exception produits:", err);
    supabaseError = err.message || "Erreur technique Supabase";
  }

  return (
    <div className="p-4 sm:p-6 min-h-full flex flex-col pt-8 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-white">Mon Catalogue</h1>
      </div>
      
      {supabaseError && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-2xl">
          <h3 className="text-red-500 font-bold mb-1 text-sm">Erreur Supabase Critique</h3>
          <p className="text-xs text-red-400 font-mono break-all">{supabaseError}</p>
        </div>
      )}
      
      <ProductListClient initialProducts={produits || []} />
    </div>
  );
}
