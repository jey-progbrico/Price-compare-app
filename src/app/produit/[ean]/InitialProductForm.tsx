"use client";

import { useState } from "react";
import { Package, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
  ean: string;
}

export default function InitialProductForm({ ean }: Props) {
  const [marque, setMarque] = useState("");
  const [designation, setDesignation] = useState("");
  const [reference, setReference] = useState("");
  const [categorie, setCategorie] = useState("");
  const [prix, setPrix] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const priceValue = parseFloat(prix.replace(',', '.'));

    const payload = {
      numero_ean: ean,
      marque: marque || null,
      description_produit: designation,
      reference_fabricant: reference || null,
      categorie: categorie || null,
      prix_vente: isNaN(priceValue) ? null : priceValue,
      devise: "€"
    };

    console.log("[PRODUCT SAVE PAYLOAD] Creation:", payload);

    try {
      const { error } = await supabase.from("produits").insert(payload);
      if (error) throw error;
      
      alert("Produit sauvegardé ! La recherche va commencer.");
      window.location.reload(); // Force full reload to become 'known'
    } catch (err: any) {
      console.error("Erreur Supabase:", err);
      alert(`Erreur lors de l'enregistrement: ${err.message || JSON.stringify(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-neutral-900 border border-red-900/50 rounded-3xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-3 mb-4 text-red-400">
        <ShieldAlert className="w-6 h-6" />
        <h2 className="text-lg font-bold">Produit Inconnu</h2>
      </div>
      <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
        Ce code-barres n'existe pas dans votre base. Pour lancer une recherche intelligente (qui interrogera aussi le site officiel de la marque), vous devez le référencer.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-400 mb-1 block">EAN</label>
          <input type="text" value={ean} disabled className="w-full bg-black/50 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-500 font-mono outline-none" />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-400 mb-1 block">Désignation <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="Ex: Perceuse visseuse 18V"
            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-400 mb-1 block">Marque <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={marque}
              onChange={(e) => setMarque(e.target.value)}
              placeholder="Ex: Bosch"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-400 mb-1 block">Réf Fabricant</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: GSB 18V-55"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-400 mb-1 block">Catégorie</label>
            <input
              type="text"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              placeholder="Ex: Outillage"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-400 mb-1 block">Mon Prix Local (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="Ex: 49.90"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all font-bold"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Package className="w-5 h-5" />
          {loading ? "Création en cours..." : "Créer et Lancer la Recherche"}
        </button>
      </form>
    </div>
  );
}
