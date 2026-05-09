"use client";

import { useState } from "react";
import { Package, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  produit: {
    numero_ean: string;
    marque: string | null;
    description_produit: string | null;
    reference_fabricant?: string | null;
    categorie?: string | null;
    prix_vente: number | null;
  };
  onClose: () => void;
}

export default function EditProductModal({ produit, onClose }: Props) {
  const [marque, setMarque] = useState(produit.marque || "");
  const [designation, setDesignation] = useState(produit.description_produit || "");
  const [reference, setReference] = useState(produit.reference_fabricant || "");
  const [categorie, setCategorie] = useState(produit.categorie || "");
  const [prix, setPrix] = useState(produit.prix_vente ? produit.prix_vente.toString() : "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const priceValue = parseFloat(prix.replace(',', '.'));

    try {
      const { error } = await supabase.from("produits").update({
        marque: marque || null,
        description_produit: designation,
        reference_fabricant: reference || null,
        categorie: categorie || null,
        prix_vente: isNaN(priceValue) ? null : priceValue,
      }).eq("numero_ean", produit.numero_ean);

      if (error) throw error;
      
      alert("Fiche produit mise à jour !");
      window.location.reload();
    } catch (err: any) {
      console.error("Erreur Supabase:", err);
      alert(`Erreur lors de la mise à jour: ${err.message || JSON.stringify(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
        <div className="p-4 flex justify-between items-center border-b border-neutral-800 bg-black/50">
          <div className="flex items-center gap-2 text-white font-bold">
            <Package className="w-5 h-5 text-blue-500" />
            Modifier le produit
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          <div className="text-xs text-neutral-500 font-mono mb-2 bg-black/50 p-2 rounded-lg text-center border border-neutral-800/50">
            EAN : {produit.numero_ean}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-400 mb-1 block">Désignation <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-400 mb-1 block">Marque <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-400 mb-1 block">Réf Fabricant</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-neutral-400 mb-1 block">Catégorie</label>
              <input
                type="text"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-neutral-400 mb-1 block">Prix Local (€)</label>
              <input
                type="text"
                inputMode="decimal"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? "Sauvegarde..." : "Enregistrer les modifications"}
          </button>
        </form>
      </div>
    </div>
  );
}
