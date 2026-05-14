"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Package, 
  X, 
  Save, 
  Loader2, 
  Tag, 
  Layers, 
  Info, 
  CheckCircle2, 
  Database,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RayonRow, GroupeRow, Product } from "@/types/database";

interface Props {
  produit: Product;
  onClose: () => void;
}

export default function EditProductModal({ produit, onClose }: Props) {
  const [formData, setFormData] = useState({
    marque: produit.marque || "",
    description_produit: produit.description_produit || "",
    reference_fabricant: produit.reference_fabricant || "",
    rayon: produit.rayon || "",
    groupe_produit: produit.groupe_produit || "",
    prix_vente: produit.prix_vente ? produit.prix_vente.toString() : "",
    code_interne: produit.code_interne || ""
  });

  const [loading, setLoading] = useState(false);
  const [rayons, setRayons] = useState<string[]>([]);
  const [groupes, setGroupes] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchMeta = async () => {
      const { data } = await supabase.from("produits").select("rayon, groupe_produit");
      if (data) {
        const rows = data as (RayonRow & GroupeRow)[];
        setRayons(Array.from(new Set(rows.map(r => r.rayon).filter((r): r is string => !!r))));
        setGroupes(Array.from(new Set(rows.map(r => r.groupe_produit).filter((r): r is string => !!r))));
      }
    };
    fetchMeta();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const priceValue = parseFloat(formData.prix_vente.replace(',', '.'));

    const payload = {
      marque: formData.marque || null,
      description_produit: formData.description_produit,
      reference_fabricant: formData.reference_fabricant || null,
      rayon: formData.rayon || null,
      groupe_produit: formData.groupe_produit || null,
      prix_vente: isNaN(priceValue) ? null : priceValue,
      code_interne: formData.code_interne || null,
      updated_at: new Date().toISOString()
    };

    console.log("[PRODUCT SAVE PAYLOAD] Update:", payload);

    try {
      const { error } = await supabase
        .from("produits")
        .update(payload)
        .eq("numero_ean", produit.numero_ean);

      if (error) throw error;
      
      // Log activité
      await fetch("/api/activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_action: "modification_produit",
          ean: produit.numero_ean,
          details: { ...payload }
        })
      });

      onClose();
      window.location.reload();
    } catch (err: any) {
      console.error("Erreur Supabase:", err);
      alert(`Erreur: ${err.message}`);
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-neutral-950 border-t sm:border border-neutral-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b border-neutral-900 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/10 border border-red-600/20 rounded-xl flex items-center justify-center text-red-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">Édition Produit</h2>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mise à jour fiche métier</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-900 rounded-full text-neutral-500 hover:text-white transition-all active:scale-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* IDENTIFIANTS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Tag className="w-3 h-3 text-neutral-600" />
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">EAN (Fixe)</span>
              </div>
              <span className="text-xs font-mono font-bold text-white tracking-tighter">
                {produit.numero_ean}
              </span>
            </div>

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-3 flex flex-col gap-1 focus-within:border-red-600 transition-all">
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-neutral-600" />
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Code Interne</span>
              </div>
              <input
                type="text"
                value={formData.code_interne}
                onChange={(e) => setFormData({...formData, code_interne: e.target.value})}
                placeholder="Identifiant..."
                className="bg-transparent border-none p-0 text-xs font-mono font-bold text-red-500 focus:ring-0 outline-none uppercase placeholder:text-neutral-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Désignation */}
            <div className="sm:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Tag className="w-3 h-3" /> Désignation Commerciale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.description_produit}
                onChange={(e) => setFormData({...formData, description_produit: e.target.value})}
                placeholder="Ex: Interrupteur Va-et-Vient"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none placeholder:text-neutral-800"
              />
            </div>

            {/* Marque */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <CheckCircle2 className="w-3 h-3" /> Marque <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.marque}
                onChange={(e) => setFormData({...formData, marque: e.target.value})}
                placeholder="Ex: Legrand"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none placeholder:text-neutral-800"
              />
            </div>

            {/* Prix */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Database className="w-3 h-3" /> Prix Vente Magasin (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formData.prix_vente}
                onChange={(e) => setFormData({...formData, prix_vente: e.target.value})}
                placeholder="0.00"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none font-black text-lg placeholder:text-neutral-800"
              />
            </div>

            {/* Rayon */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Layers className="w-3 h-3" /> Rayon Métier
              </label>
              <div className="relative">
                <select
                  value={formData.rayon}
                  onChange={(e) => setFormData({...formData, rayon: e.target.value})}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 outline-none appearance-none pr-10"
                >
                  <option value="">Sélectionner...</option>
                  {rayons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600">
                  <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
            </div>

            {/* Famille (Groupe) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                <Layers className="w-3 h-3" /> Famille Produit
              </label>
              <input
                type="text"
                value={formData.groupe_produit}
                onChange={(e) => setFormData({...formData, groupe_produit: e.target.value})}
                placeholder="Ex: Interrupteurs"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none placeholder:text-neutral-800"
              />
            </div>

            {/* Réf Fabricant */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Réf Fabricant</label>
              <input
                type="text"
                value={formData.reference_fabricant}
                onChange={(e) => setFormData({...formData, reference_fabricant: e.target.value})}
                placeholder="Ex: 077011"
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
              />
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-md flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-900 text-neutral-400 font-bold py-4 rounded-2xl hover:text-white transition-all active:scale-95"
          >
            ANNULER
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[2] bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                ENREGISTRER
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
