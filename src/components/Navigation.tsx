"use client";

import Link from "next/link";
import { Search, ScanBarcode, Package, LayoutGrid, Tag } from "lucide-react";
import { useState } from "react";
import BarcodeScanner from "./BarcodeScanner";

export default function Navigation() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-black border-b border-red-900 shadow-[0_4px_20px_rgba(220,38,38,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                  <Search className="text-white w-5 h-5" />
                </div>
                <span className="text-2xl font-extrabold text-white tracking-tight">Vigi<span className="text-red-600">prix</span></span>
              </Link>
              
              <div className="hidden md:flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 text-neutral-300 hover:text-white transition-colors text-sm font-medium">
                  <Package className="w-4 h-4 text-red-500" />
                  Produits
                </Link>
                <Link href="#" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium">
                  <Tag className="w-4 h-4" />
                  Marques
                </Link>
                <Link href="#" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium">
                  <LayoutGrid className="w-4 h-4" />
                  Groupes
                </Link>
              </div>
            </div>

            <div className="flex items-center">
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-[0_0_10px_rgba(220,38,38,0.4)]"
              >
                <ScanBarcode className="w-5 h-5" />
                <span className="hidden sm:inline">Scanner</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu (Bottom Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-black border-t border-neutral-800 z-40 flex justify-around items-center p-3">
        <Link href="/" className="flex flex-col items-center text-red-500">
          <Package className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold">Produits</span>
        </Link>
        <Link href="#" className="flex flex-col items-center text-neutral-500">
          <Tag className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold">Marques</span>
        </Link>
        <button 
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center text-white -mt-6 bg-red-600 p-3 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] border-4 border-black"
        >
          <ScanBarcode className="w-6 h-6" />
        </button>
      </div>

      {isScannerOpen && (
        <BarcodeScanner onClose={() => setIsScannerOpen(false)} />
      )}
    </>
  );
}
