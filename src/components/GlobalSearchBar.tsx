"use client";

import { useState } from "react";
import { Search, ScanBarcode } from "lucide-react";
import { useRouter } from "next/navigation";

interface GlobalSearchBarProps {
  placeholder?: string;
  className?: string;
  initialValue?: string;
}

export default function GlobalSearchBar({ 
  placeholder = "Chercher EAN, nom, marque...", 
  className = "",
  initialValue = ""
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    // Détection EAN (8 à 14 chiffres)
    if (trimmed.match(/^\d{8,14}$/)) {
      router.push(`/produit/${trimmed}`);
    } else {
      // Recherche textuelle globale
      router.push(`/produits?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative w-full ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-neutral-500" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="block w-full pl-14 pr-16 py-5 bg-neutral-900/50 border border-neutral-800 rounded-[2rem] text-white placeholder-neutral-600 focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all outline-none shadow-2xl backdrop-blur-sm"
      />
      <div className="absolute inset-y-0 right-2 my-2 flex items-center gap-2">
        {query.trim().match(/^\d{8,14}$/) && (
          <button 
            type="submit"
            className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95"
          >
            <ScanBarcode className="w-5 h-5" />
          </button>
        )}
      </div>
    </form>
  );
}
