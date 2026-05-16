"use client";

import { useState } from "react";
import { Package, ShieldAlert, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  ean: string;
}

export default function InitialProductForm({ ean }: Props) {
  const supabase = createClient();
  const [marque, setMarque] = useState("");
  const [designation, setDesignation] = useState("");
  const [rayon, setRayon] = useState("");
  const [famille, setFamille] = useState("");
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
      rayon: rayon || null,
      groupe_produit: famille || null,
      prix_vente: isNaN(priceValue) ? null : priceValue,
      devise: "€",
      updated_at: new Date().toISOString()
    };

    console.log("[PRODUCT SAVE PAYLOAD] Creation:", payload);

    try {
      const { error } = await supabase.from("produits").insert(payload);
      if (error) throw error;
      
      alert("Produit sauvegardé !");
      window.location.reload(); 
    } catch (err: any) {
      console.error("Erreur Supabase:", err);
      alert(`Erreur: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-neutral-900 border border-red-900/30 rounded-[2rem] p-6 mb-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-600/10 rounded-xl flex items-center justify-center text-red-500 border border-red-600/20">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Référencement Manuel</h2>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Produit inconnu au catalogue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Code EAN</label>
            <input type="text" value={ean} disabled className="w-full bg-black/50 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-500 font-mono text-sm outline-none cursor-not-allowed" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Désignation Commerciale <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Ex: Perceuse visseuse 18V"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Marque <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={marque}
              onChange={(e) => setMarque(e.target.value)}
              placeholder="Ex: Bosch"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Mon Prix Local (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="0.00"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none font-black text-lg"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Rayon</label>
            <input
              type="text"
              required
              value={rayon}
              onChange={(e) => setRayon(e.target.value)}
              placeholder="Ex: Outillage"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-2 px-1">Famille Produit</label>
            <input
              type="text"
              required
              value={famille}
              onChange={(e) => setFamille(e.target.value)}
              placeholder="Ex: Électroportatif"
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Package className="w-5 h-5" />
              CRÉER LA FICHE MÉTIER
            </>
          )}
        </button>
      </form>
    </div>
  );
}
