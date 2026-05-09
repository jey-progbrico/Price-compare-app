"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, ScanBarcode } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProductListClient({ initialProducts }: { initialProducts: any[] }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const filteredProducts = initialProducts.filter(p => 
    (p.description_produit && p.description_produit.toLowerCase().includes(query.toLowerCase())) ||
    (p.numero_ean && p.numero_ean.includes(query)) ||
    (p.marque && p.marque.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSearchExactEAN = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().match(/^\d{8,13}$/)) {
      router.push(`/produit/${query.trim()}`);
    }
  };

  return (
    <>
      <form onSubmit={handleSearchExactEAN} className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (Nom, Marque, EAN)..."
          className="block w-full pl-12 pr-12 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none"
        />
        {query.trim().match(/^\d{8,13}$/) && (
          <button 
            type="submit"
            className="absolute inset-y-0 right-2 my-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <ScanBarcode className="w-5 h-5" />
          </button>
        )}
      </form>

      <div className="text-sm text-neutral-500 mb-4">{filteredProducts.length} produit(s)</div>

      <div className="flex flex-col gap-3">
        {filteredProducts.slice(0, 100).map((p, i) => (
          <Link key={i} href={`/produit/${p.numero_ean}`} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4 items-center hover:bg-neutral-800 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {p.marque && <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{p.marque}</span>}
              </div>
              <h4 className="text-white text-sm font-medium line-clamp-2 leading-snug mb-1">
                {p.description_produit || "Produit sans désignation"}
              </h4>
              <p className="text-xs text-neutral-500 font-mono mt-1">EAN: {p.numero_ean}</p>
            </div>
            
            <div className="flex flex-col items-end gap-1 flex-shrink-0 pl-2 border-l border-neutral-800">
              {p.prix_vente ? (
                <>
                  <span className="text-xl font-black text-white leading-none">{Number(p.prix_vente).toFixed(2)}€</span>
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mt-1">Mon Prix</span>
                </>
              ) : (
                <span className="text-xs text-neutral-500 italic">Prix N/A</span>
              )}
              <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-red-500 transition-colors mt-2" />
            </div>
          </Link>
        ))}
        {filteredProducts.length > 100 && (
          <div className="text-center py-4 text-neutral-500 text-sm">
            Utilisez la recherche pour voir plus de résultats.
          </div>
        )}
        {filteredProducts.length === 0 && (
          <div className="text-center py-12 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-neutral-400">
            Aucun produit trouvé.
            <br/>Si c'est un nouvel EAN, tapez-le et appuyez sur l'icône de code-barres !
          </div>
        )}
      </div>
    </>
  );
}
