import { supabase } from "@/lib/supabase";
import { ChevronLeft, Package, Tag } from "lucide-react";
import Link from "next/link";
import ProductListClient from "../../../produits/ProductListClient";

import { RayonRow, GroupeRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function GroupeProduitsPage({ params }: { params: Promise<{ slug: string, groupeSlug: string }> }) {
  const { slug, groupeSlug } = await params;

  console.log(`[NAV DEBUG] Slug reçu : rayon=${slug}, groupe=${groupeSlug}`);

  // 1. Récupérer les noms exacts en base de données pour éviter les erreurs d'accents/casse
  const { data: allData } = await supabase
    .from("produits")
    .select("rayon, groupe_produit")
    .not("rayon", "is", null)
    .not("groupe_produit", "is", null);

  const rows = (allData as (RayonRow & GroupeRow)[]) || [];

  // Fonction de normalisation pour comparaison
  const normalize = (str: string) => 
    decodeURIComponent(str)
      .toLowerCase()
      .replace(/[\s-]/g, '')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Enlever accents

  const rayonName = Array.from(new Set(rows.map(r => r.rayon || ""))).find(r => 
    normalize(r) === normalize(slug)
  ) || decodeURIComponent(slug).replace(/-/g, ' ');

  const groupeName = Array.from(new Set(rows.filter(r => r.rayon === rayonName).map(r => r.groupe_produit || ""))).find(g => 
    normalize(g) === normalize(groupeSlug)
  ) || decodeURIComponent(groupeSlug).replace(/-/g, ' ');

  console.log(`[NAV DEBUG] Valeurs converties : rayon="${rayonName}", groupe="${groupeName}"`);

  // 2. Récupérer les produits pour ce groupe et ce rayon exacts
  const { data: produits, error } = await supabase
    .from("produits")
    .select("description_produit, numero_ean, marque, prix_vente, devise, reference_fabricant, groupe_produit, categorie, rayon")
    .eq("rayon", rayonName)
    .eq("groupe_produit", groupeName)
    .order("description_produit", { ascending: true });

  if (error) {
    console.error("[NAV ERROR]", error);
  }

  console.log(`[NAV DEBUG] Produits trouvés : ${produits?.length || 0}`);

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-24 space-y-8 animate-in slide-in-from-right-4 duration-500">
      {/* Header avec Fil d'ariane compact */}
      <div className="flex flex-col gap-4">
        <Link 
          href={`/rayon/${slug}`}
          className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90 shadow-lg"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{rayonName}</span>
            <span className="text-neutral-700">/</span>
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{groupeName}</span>
          </div>
          <h1 className="text-2xl font-black text-white leading-tight tracking-tighter uppercase">
            {produits?.length || 0} Produits
          </h1>
        </div>
      </div>

      {/* Liste des produits (Réutilisation du client component pour les vignettes) */}
      <div className="space-y-4">
        {produits && produits.length > 0 ? (
          <ProductListClient initialProducts={produits} isHierarchicalView={false} />
        ) : (
          <div className="text-center py-20 text-neutral-600">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun produit dans ce groupe</p>
          </div>
        )}
      </div>
    </main>
  );
}
