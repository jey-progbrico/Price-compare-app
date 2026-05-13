"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowRight, ScanBarcode, ChevronRight, Package } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProductListClient({ 
  initialProducts, 
  isHierarchicalView = true 
}: { 
  initialProducts: any[],
  isHierarchicalView?: boolean 
}) {
  const [query, setQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const router = useRouter();

  // Filter products based on search query
  const filteredProducts = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    return initialProducts.filter((p) => {
      return !lowerQuery || 
        (p.description_produit && p.description_produit.toLowerCase().includes(lowerQuery)) ||
        (p.numero_ean && p.numero_ean.includes(lowerQuery)) ||
        (p.marque && p.marque.toLowerCase().includes(lowerQuery));
    });
  }, [initialProducts, query]);

  // Group products hierarchically: Category -> Brand -> Products
  const hierarchicalProducts = useMemo(() => {
    const tree: Record<string, Record<string, any[]>> = {};
    
    filteredProducts.forEach(p => {
      const cat = p.categorie || "Sans catégorie";
      const brand = p.marque || "Sans marque";
      
      if (!tree[cat]) tree[cat] = {};
      if (!tree[cat][brand]) tree[cat][brand] = [];
      
      tree[cat][brand].push(p);
    });

    return Object.entries(tree)
      .sort(([a], [b]) => {
        if (a === "Sans catégorie") return 1;
        if (b === "Sans catégorie") return -1;
        return a.localeCompare(b);
      })
      .map(([catName, brands]) => ({
        name: catName,
        count: Object.values(brands).reduce((acc, b) => acc + b.length, 0),
        brands: Object.entries(brands)
          .sort(([a], [b]) => {
            if (a === "Sans marque") return 1;
            if (b === "Sans marque") return -1;
            return a.localeCompare(b);
          })
          .map(([brandName, prods]) => ({
            name: brandName,
            count: prods.length,
            products: prods
          }))
      }));
  }, [filteredProducts]);

  const handleSearchExactEAN = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().match(/^\d{8,13}$/)) {
      router.push(`/produit/${query.trim()}`);
    }
  };

  const toggleCategory = (cat: string) => {
    setOpenCategory(openCategory === cat ? null : cat);
    setOpenBrand(null);
  };

  const toggleBrand = (brand: string) => {
    setOpenBrand(openBrand === brand ? null : brand);
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearchExactEAN} className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit ou EAN..."
          className="block w-full pl-12 pr-12 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder-neutral-600 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none shadow-xl"
        />
        {query.trim().match(/^\d{8,13}$/) && (
          <button 
            type="submit"
            className="absolute inset-y-0 right-2 my-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-xl flex items-center justify-center transition-colors shadow-lg"
          >
            <ScanBarcode className="w-5 h-5" />
          </button>
        )}
      </form>

      {/* Results Meta */}
      <div className="px-1 flex justify-between items-center">
        <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
          {filteredProducts.length} articles disponibles
        </div>
        {query && (
          <button onClick={() => setQuery("")} className="text-[10px] font-black text-red-500 uppercase tracking-widest">Effacer</button>
        )}
      </div>

      {/* Rendu dynamique : Hiérarchique ou Liste Plate */}
      {!isHierarchicalView || query ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-2 pb-24">
          {filteredProducts.map((p) => (
            <Link 
              key={p.numero_ean}
              href={`/produit/${p.numero_ean}`}
              className="flex items-center justify-between p-4 lg:p-2 lg:py-1.5 bg-neutral-900 border border-neutral-800 rounded-2xl lg:rounded-lg hover:border-red-600/50 transition-all active:scale-[0.98] group shadow-xl"
            >
              <div className="flex items-center gap-4 lg:gap-2.5 min-w-0">
                <div className="w-10 h-10 lg:w-7 lg:h-7 bg-neutral-950 rounded-xl lg:rounded-md flex items-center justify-center text-neutral-700 group-hover:text-red-500 transition-colors shrink-0">
                  <Package className="w-5 h-5 lg:w-3.5 lg:h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 lg:gap-1.5 mb-0.5">
                    <span className="text-[9px] lg:text-[7px] font-black text-neutral-500 uppercase bg-neutral-800 px-1.5 py-0.5 lg:py-0 rounded tracking-tighter">
                      {p.marque || "Sans marque"}
                    </span>
                  </div>
                  <h4 className="text-[13px] lg:text-[11px] font-bold text-white lg:text-neutral-300 line-clamp-1 group-hover:text-red-500 transition-colors leading-tight">
                    {p.description_produit}
                  </h4>
                  <p className="text-[9px] lg:text-[7px] font-mono text-neutral-600 mt-0">EAN: {p.numero_ean}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4 lg:ml-2 border-l border-neutral-800/50 lg:pl-3">
                <div className="text-sm lg:text-[11px] font-black text-white">{Number(p.prix_vente).toFixed(2)}€</div>
                <div className="text-[8px] lg:text-[7px] font-bold text-neutral-600 uppercase tracking-tighter">Prix</div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          {hierarchicalProducts.map((cat) => (
            <div key={cat.name} className="space-y-2 lg:space-y-1">
              <button
                onClick={() => toggleCategory(cat.name)}
                className={`w-full flex items-center justify-between p-5 lg:p-3 rounded-2xl lg:rounded-lg border transition-all ${
                  openCategory === cat.name 
                    ? "bg-neutral-900 border-neutral-700 shadow-lg" 
                    : "bg-neutral-950 border-neutral-900 hover:border-neutral-800"
                }`}
              >
                <div className="flex items-center gap-4 lg:gap-2">
                  <div className={`w-2 lg:w-0.5 h-8 lg:h-5 rounded-full transition-all ${openCategory === cat.name ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]" : "bg-neutral-800"}`} />
                  <div className="text-left">
                    <h3 className={`font-black text-sm lg:text-[10px] uppercase tracking-widest lg:tracking-[0.15em] ${openCategory === cat.name ? "text-white" : "text-neutral-500"}`}>
                      {cat.name}
                    </h3>
                    <span className="text-[10px] lg:text-[8px] font-bold text-neutral-700 font-mono">{cat.count} PRODUITS</span>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 lg:w-3.5 lg:h-3.5 text-neutral-700 transition-transform duration-300 ${openCategory === cat.name ? "rotate-90 text-red-600" : ""}`} />
              </button>

              {openCategory === cat.name && (
                <div className="mt-3 lg:mt-1 ml-4 lg:ml-2 pl-4 lg:pl-2 border-l-2 lg:border-l border-neutral-900 space-y-2 lg:space-y-0.5 animate-in slide-in-from-top-2 duration-300">
                  {cat.brands.map((brand) => (
                    <div key={brand.name}>
                      <button
                        onClick={() => toggleBrand(brand.name)}
                        className={`w-full flex items-center justify-between p-4 lg:p-2 rounded-xl lg:rounded-md border transition-all ${
                          openBrand === brand.name 
                            ? "bg-neutral-900 border-neutral-800" 
                            : "bg-black border-transparent hover:bg-neutral-900/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 lg:gap-2">
                          <div className={`w-1.5 h-1.5 lg:w-1 lg:h-1 rounded-full ${openBrand === brand.name ? "bg-red-600" : "bg-neutral-700"}`} />
                          <span className={`text-xs lg:text-[10px] font-bold uppercase tracking-wider ${openBrand === brand.name ? "text-white" : "text-neutral-500"}`}>
                            {brand.name}
                          </span>
                          <span className="text-[9px] lg:text-[8px] font-mono text-neutral-800">({brand.count})</span>
                        </div>
                        <ChevronRight className={`w-4 h-4 lg:w-3 lg:h-3 text-neutral-800 transition-transform ${openBrand === brand.name ? "rotate-90 text-red-600" : ""}`} />
                      </button>

                      {openBrand === brand.name && (
                        <div className="mt-2 lg:mt-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 lg:gap-1.5 animate-in slide-in-from-top-1 duration-200">
                          {brand.products.map((p) => (
                            <Link 
                              key={p.numero_ean} 
                              href={`/produit/${p.numero_ean}`}
                              className="flex items-center justify-between p-4 lg:p-2 lg:py-1 bg-neutral-900/40 border border-neutral-800/50 rounded-xl lg:rounded-md hover:bg-neutral-800 transition-all group"
                            >
                              <div className="min-w-0 pr-4 lg:pr-2">
                                <h4 className="text-[13px] lg:text-[10px] font-medium text-neutral-400 line-clamp-1 group-hover:text-white leading-tight">
                                  {p.description_produit}
                                </h4>
                                <p className="text-[9px] lg:text-[7px] font-mono text-neutral-700 mt-0 tracking-tighter">EAN: {p.numero_ean}</p>
                              </div>
                              <div className="flex items-center gap-2 lg:gap-1.5 shrink-0 pl-2 lg:border-l lg:border-neutral-800/30">
                                <span className="text-sm lg:text-[10px] font-black text-white">{Number(p.prix_vente).toFixed(2)}€</span>
                                <ArrowRight className="w-4 h-4 lg:w-3 lg:h-3 text-neutral-800 group-hover:text-red-600" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-20 text-neutral-600">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun produit trouvé</p>
        </div>
      )}
    </div>
  );
}
