"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Filter, SortAsc, SortDesc, ChevronDown } from "lucide-react";

type Product = {
  description_produit: string;
  numero_ean: string;
  groupe_produit: string;
  marque: string;
  prix_vente: number | null;
  devise: string;
};

export default function ProductDashboard({ initialProducts }: { initialProducts: Product[] }) {
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("Toutes");
  const [selectedGroup, setSelectedGroup] = useState<string>("Tous");
  const [sortOrder, setSortOrder] = useState<"name_asc" | "name_desc" | "price_asc" | "price_desc" | "">("");

  const brands = ["Toutes", ...Array.from(new Set(initialProducts.map(p => p.marque).filter(Boolean)))];
  const groups = ["Tous", ...Array.from(new Set(initialProducts.map(p => p.groupe_produit).filter(Boolean)))];

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...initialProducts];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.description_produit || "").toLowerCase().includes(q) ||
          (p.numero_ean || "").includes(q) ||
          (p.marque || "").toLowerCase().includes(q)
      );
    }

    // Filter Brand
    if (selectedBrand !== "Toutes") {
      result = result.filter((p) => p.marque === selectedBrand);
    }

    // Filter Group
    if (selectedGroup !== "Tous") {
      result = result.filter((p) => p.groupe_produit === selectedGroup);
    }

    // Sort
    if (sortOrder === "name_asc") {
      result.sort((a, b) => (a.description_produit || "").localeCompare(b.description_produit || ""));
    } else if (sortOrder === "name_desc") {
      result.sort((a, b) => (b.description_produit || "").localeCompare(a.description_produit || ""));
    } else if (sortOrder === "price_asc") {
      result.sort((a, b) => (a.prix_vente || 0) - (b.prix_vente || 0));
    } else if (sortOrder === "price_desc") {
      result.sort((a, b) => (b.prix_vente || 0) - (a.prix_vente || 0));
    }

    return result;
  }, [initialProducts, search, selectedBrand, selectedGroup, sortOrder]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 flex-shrink-0 bg-neutral-900 rounded-xl p-5 border border-neutral-800 h-fit sticky top-24">
        <div className="mb-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-red-500" />
            Rechercher
          </h3>
          <input
            type="text"
            placeholder="EAN, Nom, Marque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        <div className="mb-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-red-500" />
            Marque
          </h3>
          <div className="relative">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-red-500"
            >
              {brands.map((brand, i) => (
                <option key={i} value={brand}>{brand}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-red-500" />
            Groupe Produit
          </h3>
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-red-500"
            >
              {groups.map((group, i) => (
                <option key={i} value={group}>{group}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <SortAsc className="w-4 h-4 text-red-500" />
            Trier par
          </h3>
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full bg-black border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-red-500"
            >
              <option value="">Par défaut</option>
              <option value="name_asc">Nom (A-Z)</option>
              <option value="name_desc">Nom (Z-A)</option>
              <option value="price_asc">Prix (Croissant)</option>
              <option value="price_desc">Prix (Décroissant)</option>
            </select>
            <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>
      </aside>

      {/* Main Content Grid */}
      <div className="flex-1">
        <div className="mb-4 flex justify-between items-end">
          <h2 className="text-xl font-bold text-white">
            Catalogue ({filteredAndSortedProducts.length})
          </h2>
        </div>

        {filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-xl border border-neutral-800">
            <p className="text-neutral-400">Aucun produit ne correspond à vos critères.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAndSortedProducts.map((produit, index) => (
              <Link
                href={`/produit/${produit.numero_ean}`}
                key={produit.numero_ean || index}
                className="group flex flex-col bg-neutral-900 rounded-xl overflow-hidden shadow-sm hover:shadow-[0_0_15px_rgba(220,38,38,0.15)] transition-all duration-200 border border-neutral-800 hover:border-red-600/50"
              >
                <div className="p-4 flex-grow flex flex-col">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 group-hover:bg-red-600 group-hover:text-white transition-colors">
                      {produit.groupe_produit || "ND"}
                    </span>
                    {produit.marque && (
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider truncate">
                        {produit.marque}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-sm font-bold mb-2 line-clamp-3 text-white leading-tight group-hover:text-red-400 transition-colors flex-grow">
                    {produit.description_produit || "Sans description"}
                  </h3>
                  
                  <div className="text-[10px] text-neutral-500 font-mono mt-1">
                    EAN: {produit.numero_ean || "N/A"}
                  </div>
                </div>
                
                <div className="bg-black/80 px-4 py-3 border-t border-neutral-800 flex justify-between items-end mt-auto group-hover:border-red-900/30 transition-colors">
                  <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider mb-0.5">Prix Magasin</span>
                  <div className="text-lg font-black text-white group-hover:text-red-500 transition-colors leading-none">
                    {produit.prix_vente !== null ? (
                      <>
                        {Number(produit.prix_vente).toFixed(2)}
                        <span className="text-xs ml-1 font-bold text-red-600">{produit.devise || "€"}</span>
                      </>
                    ) : (
                      <span className="text-sm italic font-normal text-neutral-600">--</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
