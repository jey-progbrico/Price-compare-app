"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import EditProductModal from "./EditProductModal";
import DeleteProductModal from "./DeleteProductModal";

import { Product } from "@/types/database";

interface Props {
  ean: string;
  produit: Product | null;
  isUnknown: boolean;
}

export default function ProductHeader({ ean, produit, isUnknown }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const router = useRouter();

  return (
    <>
      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-colors border border-neutral-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div className="flex-1 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <p className="text-xs text-neutral-500 font-mono tracking-wider">EAN: {ean}</p>
            {produit?.code_interne && (
              <p className="text-[10px] font-black text-red-500 uppercase bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded tracking-widest">
                Code: {produit.code_interne}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold truncate">
              {isUnknown ? "Produit non référencé" : (produit?.description_produit || "Produit sans description")}
            </h1>
            {!isUnknown && (
              <button 
                onClick={() => setShowEdit(true)} 
                className="p-1.5 bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors shrink-0"
                title="Modifier le produit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {!isUnknown && produit?.groupe_produit && (
              <span className="px-2 py-0.5 bg-blue-900/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded border border-blue-900/30">
                {produit?.groupe_produit}
              </span>
            )}
            {!isUnknown && produit?.rayon && (
              <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[10px] font-bold uppercase tracking-widest rounded border border-neutral-700">
                Rayon : {produit?.rayon}
              </span>
            )}
          </div>
        </div>

        {/* Action de suppression isolée */}
        {!isUnknown && (
          <button 
            onClick={() => setShowDelete(true)}
            className="w-10 h-10 bg-red-600/10 hover:bg-red-600 border border-red-600/20 hover:border-red-600 rounded-xl flex items-center justify-center text-red-500 hover:text-white transition-all active:scale-90 shrink-0"
            title="Supprimer le produit"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Internal Price Card */}
      <div className="bg-gradient-to-r from-red-900/20 to-neutral-900 rounded-2xl p-5 border border-red-900/30 mb-6 flex justify-between items-center">
        <div>
          <span className="text-xs text-red-400 font-bold uppercase tracking-wider block mb-1">Mon Magasin</span>
          {isUnknown ? (
            <span className="text-sm text-neutral-400">Prix inconnu</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{Number(produit?.prix_vente || 0).toFixed(2)}</span>
              <span className="text-red-500 font-bold">{produit?.devise || "€"}</span>
            </div>
          )}
        </div>
        {!isUnknown && produit?.marque && (
          <div className="text-right">
            <span className="text-xs text-neutral-500 block mb-1">Marque</span>
            <span className="text-sm font-bold text-white bg-black/50 px-2 py-1 rounded-lg">{produit?.marque}</span>
          </div>
        )}
      </div>

      {showEdit && produit && (
        <EditProductModal produit={produit} onClose={() => setShowEdit(false)} />
      )}

      {showDelete && produit && (
        <DeleteProductModal produit={produit} onClose={() => setShowDelete(false)} />
      )}
    </>
  );
}
