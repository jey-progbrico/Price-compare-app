"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, ArrowRight, ScanBarcode, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 100;

export default function ProductListClient({ initialProducts }: { initialProducts: any[] }) {
  const [query, setQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();

  // Extract unique brands with useMemo for performance
  const uniqueBrands = useMemo(() => {
    const brands = initialProducts
      .map((p) => p.marque)
      .filter((m): m is string => typeof m === "string" && m.trim() !== "")
      .map((m) => m.trim());
    return Array.from(new Set(brands)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [initialProducts]);

  // Filter products based on search query and selected brand with useMemo
  const filteredProducts = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    return initialProducts.filter((p) => {
      const matchesQuery = !lowerQuery || 
        (p.description_produit && p.description_produit.toLowerCase().includes(lowerQuery)) ||
        (p.numero_ean && p.numero_ean.includes(lowerQuery)) ||
        (p.marque && p.marque.toLowerCase().includes(lowerQuery));
      
      const matchesBrand = !selectedBrand || p.marque === selectedBrand;
      
      return matchesQuery && matchesBrand;
    });
  }, [initialProducts, query, selectedBrand]);

  // Automatically reset to page 1 when search or brand filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedBrand]);

  // Pagination logic with useMemo
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handleSearchExactEAN = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().match(/^\d{8,13}$/)) {
      router.push(`/produit/${query.trim()}`);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      if (end === totalPages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  return (
    <>
      {/* Search and Brand Filter Container */}
      <div className="flex flex-col gap-3 mb-6">
        <form onSubmit={handleSearchExactEAN} className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-neutral-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (Nom, Marque, EAN)..."
            className="block w-full pl-12 pr-12 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none shadow-xl"
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

        <div className="relative">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-600 outline-none appearance-none cursor-pointer hover:bg-neutral-800 transition-colors shadow-md"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23737373'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 1rem center",
              backgroundSize: "1.25rem"
            }}
          >
            <option value="">Toutes les marques</option>
            {uniqueBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Meta Info */}
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="text-sm font-medium text-neutral-500">
          <span className="text-white font-bold">{filteredProducts.length}</span> produit(s) trouvé(s)
        </div>
        {totalPages > 1 && (
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold bg-neutral-900 px-2 py-1 rounded-md border border-neutral-800">
            Page {currentPage} / {totalPages}
          </div>
        )}
      </div>

      {/* Product List */}
      <div className="flex flex-col gap-3 min-h-[400px]">
        {paginatedProducts.map((p, i) => (
          <Link 
            key={`${p.numero_ean}-${i}`} 
            href={`/produit/${p.numero_ean}`} 
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4 items-center hover:bg-neutral-800 hover:border-neutral-700 transition-all group active:scale-[0.98] shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {p.marque && (
                  <span className="text-[10px] font-bold text-red-500/90 uppercase tracking-widest truncate max-w-[180px]">
                    {p.marque}
                  </span>
                )}
              </div>
              <h4 className="text-white text-sm font-medium line-clamp-2 leading-snug mb-1 group-hover:text-red-50 transition-colors">
                {p.description_produit || "Produit sans désignation"}
              </h4>
              <p className="text-xs text-neutral-500 font-mono mt-1 opacity-80">EAN: {p.numero_ean}</p>
            </div>
            
            <div className="flex flex-col items-end gap-1 flex-shrink-0 pl-4 border-l border-neutral-800/50">
              {p.prix_vente ? (
                <>
                  <span className="text-xl font-black text-white leading-none">
                    {Number(p.prix_vente).toFixed(2)}€
                  </span>
                  <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block mt-1">Mon Prix</span>
                </>
              ) : (
                <span className="text-xs text-neutral-500 italic">Prix N/A</span>
              )}
              <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-red-500 transform group-hover:translate-x-1 transition-all mt-2" />
            </div>
          </Link>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-20 bg-neutral-900/40 rounded-3xl border border-neutral-800 border-dashed text-neutral-400">
            <Search className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
            <p className="text-lg font-semibold text-neutral-300">Aucun résultat</p>
            <p className="text-sm mt-2 px-8 text-neutral-500">
              Ajustez vos filtres ou essayez une recherche plus large.
              <br/>Si c'est un nouvel EAN, tapez-le et scannez-le !
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center gap-6 pb-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-neutral-800 active:scale-95 transition-all shadow-md"
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5">
              {getPageNumbers().map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[44px] h-11 rounded-xl text-sm font-bold transition-all shadow-md ${
                    currentPage === pageNum 
                      ? "bg-red-600 text-white shadow-red-600/20" 
                      : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-neutral-800 active:scale-95 transition-all shadow-md"
              aria-label="Page suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          {totalPages > 5 && (
            <div className="flex items-center gap-4">
               <button
                  onClick={() => setCurrentPage(1)}
                  className={`text-[10px] uppercase tracking-widest font-black transition-colors ${
                    currentPage === 1 ? "text-red-500" : "text-neutral-600 hover:text-neutral-400"
                  }`}
                >
                  Début
                </button>
                <div className="w-1 h-1 rounded-full bg-neutral-800"></div>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`text-[10px] uppercase tracking-widest font-black transition-colors ${
                    currentPage === totalPages ? "text-red-500" : "text-neutral-600 hover:text-neutral-400"
                  }`}
                >
                  Fin ({totalPages})
                </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
