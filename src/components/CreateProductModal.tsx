"use client";

import { useState, useEffect, useRef } from "react";
import { 
  X, 
  Save, 
  Package, 
  Tag, 
  Layers, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRayon?: string;
  onSuccess?: (newProduct: any) => void;
}

export default function CreateProductModal({ isOpen, onClose, initialRayon, onSuccess }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rayons, setRayons] = useState<string[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    description_produit: "",
    numero_ean: "",
    marque: "",
    rayon: initialRayon || "",
    groupe_produit: "",
    prix_vente: ""
  });

  useEffect(() => {
    if (isOpen) {
      fetchRayons();
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const fetchRayons = async () => {
    const { data } = await supabase.from("produits").select("rayon").not("rayon", "is", null);
    const unique = Array.from(new Set(data?.map(r => r.rayon) || []));
    setRayons(unique as string[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Vérification EAN
      if (!formData.numero_ean.match(/^\d{8,14}$/)) {
        throw new Error("Format EAN invalide (8 à 14 chiffres)");
      }

      // 2. Insertion
      const { data, error: insertError } = await supabase.from("produits").insert([{
        description_produit: formData.description_produit,
        numero_ean: formData.numero_ean,
        marque: formData.marque,
        rayon: formData.rayon,
        groupe_produit: formData.groupe_produit,
        prix_vente: parseFloat(formData.prix_vente) || 0,
        updated_at: new Date().toISOString()
      }]).select().single();

      if (insertError) {
        if (insertError.code === "23505") throw new Error("Ce code EAN existe déjà dans le catalogue.");
        throw insertError;
      }

      // 3. Log Activité
      await fetch("/api/activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_action: "import_produit",
          ean: formData.numero_ean,
          details: { ...formData }
        })
      });

      if (onSuccess) onSuccess(data);
      onClose();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/60">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-neutral-900 flex justify-between items-center bg-neutral-900/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center justify-center text-red-500 shadow-lg shadow-red-600/5">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">Nouveau Produit</h2>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ajout rapide au catalogue</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-neutral-900 rounded-full text-neutral-500 hover:text-white transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-wide"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* EAN */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Code EAN (Obligatoire)</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700" />
                <input 
                  ref={firstInputRef}
                  required
                  type="text" 
                  placeholder="Ex: 3254560412345"
                  value={formData.numero_ean}
                  onChange={e => setFormData({...formData, numero_ean: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white font-mono text-sm focus:border-red-600 outline-none transition-all"
                />
              </div>
            </div>

            {/* Marque */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Marque</label>
              <div className="relative">
                <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700" />
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Legrand"
                  value={formData.marque}
                  onChange={e => setFormData({...formData, marque: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:border-red-600 outline-none transition-all"
                />
              </div>
            </div>

            {/* Désignation */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Désignation Produit</label>
              <div className="relative">
                <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700" />
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Interrupteur Va-et-Vient Mosaic Blanc"
                  value={formData.description_produit}
                  onChange={e => setFormData({...formData, description_produit: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:border-red-600 outline-none transition-all font-bold"
                />
              </div>
            </div>

            {/* Prix */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Prix Vente (€)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700 font-bold">€</span>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  value={formData.prix_vente}
                  onChange={e => setFormData({...formData, prix_vente: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:border-red-600 outline-none transition-all font-mono"
                />
              </div>
            </div>

            {/* Rayon */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Rayon</label>
              <div className="relative">
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700" />
                <select 
                  required
                  value={formData.rayon}
                  onChange={e => setFormData({...formData, rayon: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:border-red-600 outline-none transition-all appearance-none"
                >
                  <option value="">Sélectionner...</option>
                  {rayons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            {/* Famille */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Famille / Groupe Produit</label>
              <div className="relative">
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700" />
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Appareillage Résidentiel"
                  value={formData.groupe_produit}
                  onChange={e => setFormData({...formData, groupe_produit: e.target.value})}
                  className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl pl-12 pr-4 py-3.5 text-white text-sm focus:border-red-600 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-neutral-900 text-neutral-400 font-bold rounded-2xl hover:text-white transition-all active:scale-95"
            >
              ANNULER
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-[2] px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              ENREGISTRER LE PRODUIT
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
