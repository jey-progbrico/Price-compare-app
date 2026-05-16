"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Package, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import CreateProductModal from "@/components/CreateProductModal";
import GlobalSearchBar from "@/components/GlobalSearchBar";
import ProductListClient from "./ProductListClient";
import { useSearchParams } from "next/navigation";
import { RayonRow, Product } from "@/types/database";

function ProduitsPageContent() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [rayons, setRayons] = useState<{name: string, slug: string}[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setShowCreateModal(true);
    }
  }, [searchParams]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      if (query) {
        // Recherche globale
        const { data, error } = await supabase
          .from("produits")
          .select("numero_ean, description_produit, marque, prix_vente, code_interne, categorie, rayon")
          .or(`description_produit.ilike.%${query}%,numero_ean.ilike.%${query}%,marque.ilike.%${query}%,groupe_produit.ilike.%${query}%,rayon.ilike.%${query}%,code_interne.ilike.%${query}%`)
          .limit(100);
        
        if (data) setProducts(data as Product[]);
      } else {
        // Liste des rayons optimisée via RPC
        const { data, error } = await supabase.rpc('get_unique_rayons');
        
        if (data && !error) {
          const unique = (data as { rayon_name: string }[]).map(row => ({
            name: row.rayon_name,
            slug: encodeURIComponent(row.rayon_name.toLowerCase().replace(/\s+/g, '-'))
          }));
          setRayons(unique);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [query]);

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 lg:p-12 pt-12 pb-24 space-y-10 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-white leading-tight tracking-tighter">Catalogue</h1>
          <p className="text-sm text-neutral-500 font-medium uppercase tracking-widest">Gérez vos univers produits</p>
        </div>

        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 lg:gap-3 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 lg:px-6 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-sm transition-all shadow-lg shadow-red-600/20 active:scale-95 shrink-0 uppercase tracking-widest"
        >
          <Plus className="w-3.5 h-3.5 lg:w-5 lg:h-5" />
          NOUVEAU
        </button>
      </div>

      <GlobalSearchBar initialValue={query} />

      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Recherche en cours...</p>
        </div>
      ) : query ? (
        <div className="space-y-6">
          <div className="flex justify-between items-end px-1">
            <h2 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Résultats de recherche</h2>
            <Link href="/produits" className="text-[10px] font-black text-red-500 uppercase tracking-widest">Voir tous les rayons</Link>
          </div>
          <ProductListClient initialProducts={products} hideSearch={true} isHierarchicalView={false} />
          {products.length === 0 && (
            <div className="text-center py-20 text-neutral-600">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun produit ne correspond à "{query}"</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-3">
            {rayons.map((rayon) => (
              <Link 
                key={rayon.name}
                href={`/rayon/${rayon.slug}`}
                className="group relative aspect-square lg:aspect-auto lg:h-32 bg-neutral-900 border border-neutral-800 rounded-3xl lg:rounded-2xl p-6 lg:p-4 flex flex-col justify-end overflow-hidden hover:border-red-600/50 transition-all active:scale-[0.98] shadow-xl"
              >
                <div className="absolute top-0 right-0 p-4 lg:p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Package className="w-16 h-16 lg:w-10 lg:h-10 text-white" />
                </div>
                
                <div className="relative z-10">
                  <div className="w-8 h-1 lg:h-0.5 rounded-full bg-red-600 mb-3 lg:mb-2 group-hover:w-12 transition-all" />
                  <h2 className="text-base lg:text-xs font-black text-white leading-tight uppercase tracking-tight line-clamp-2">
                    {rayon.name}
                  </h2>
                  <div className="flex items-center gap-1 mt-2 lg:mt-1 text-[9px] lg:text-[7px] font-bold text-neutral-500 group-hover:text-red-500 transition-colors uppercase tracking-widest">
                    Explorer <ArrowRight className="w-3 h-3 lg:w-2 lg:h-2" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {rayons.length === 0 && (
            <div className="text-center py-20 text-neutral-600">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun rayon trouvé</p>
            </div>
          )}
        </>
      )}

      <CreateProductModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
        }}
      />
    </main>
  );
}

export default function ProduitsPage() {
  return (
    <Suspense fallback={<div className="p-12 animate-pulse text-neutral-500 uppercase font-black text-xs">Chargement catalogue...</div>}>
      <ProduitsPageContent />
    </Suspense>
  );
}
