import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
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
    .select("description_produit, numero_ean, groupe_produit, marque, prix_vente, devise, reference_fabricant, categorie, rayon")
    .eq("numero_ean", ean)
    .single();

  // Log de la consultation (Async/Non-bloquant)
  supabase
    .from("historique_consultations")
    .insert([{ ean, created_at: new Date().toISOString() }])
    .then(({ error }) => {
      if (error) console.error("[LOG ERROR] Erreur tracking consultation:", error);
    });

  if (error && error.code !== "PGRST116") {
    console.error(error);
  }

  const isUnknown = !produit;
  const internalPrice = produit?.prix_vente ? Number(produit.prix_vente) : null;

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 lg:p-12 pt-6 font-sans text-white animate-in fade-in max-w-7xl mx-auto lg:mx-0 lg:max-w-none">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
        {/* Colonne Gauche : Identité Produit */}
        <div className="lg:sticky lg:top-8 space-y-8">
          <ProductHeader ean={ean} produit={produit} isUnknown={isUnknown} />
          
          {isUnknown && <InitialProductForm ean={ean} />}

          {/* Section Info Supplémentaire Desktop */}
          {!isUnknown && (
            <div className="hidden lg:block bg-neutral-900/40 border border-neutral-800/50 rounded-[2rem] p-8 space-y-6">
              <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest">Spécifications Métier</h3>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-neutral-800/30 pb-3">
                  <span className="text-xs text-neutral-500">Référence interne</span>
                  <span className="text-xs font-mono font-bold">{produit.reference_fabricant || "N/A"}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800/30 pb-3">
                  <span className="text-xs text-neutral-500">Classification</span>
                  <span className="text-xs font-bold">{produit.rayon || "Divers"}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-800/30 pb-3">
                  <span className="text-xs text-neutral-500">Dernière Mise à jour</span>
                  <span className="text-xs font-bold text-neutral-600">Aujourd'hui</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Colonne Droite : Intelligence Prix & Veille */}
        <div className="space-y-8">
          {!isUnknown && (
            <>
              <div className="hidden lg:flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                  <Search className="w-4 h-4" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Intelligence Prix & Veille</h2>
              </div>
              
              <ProductSearchSection 
                ean={ean} 
                internalPrice={internalPrice} 
                produit={produit}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
