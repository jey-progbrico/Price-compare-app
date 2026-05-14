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
import { RayonRow, Product } from "@/types/database";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRayon?: string;
  onSuccess?: (newProduct: Product) => void;
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
    const unique = Array.from(new Set((data as RayonRow[] | null)?.map(r => r.rayon) || []));
    setRayons(unique);
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

      if (onSuccess) onSuccess(data as Product);
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
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md">
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="bg-neutral-950 border-t sm:border border-neutral-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 flex justify-between items-center border-b border-neutral-900 bg-neutral-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600/10 border border-red-600/20 rounded-xl flex items-center justify-center text-red-600">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Nouveau Produit</h2>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Ajout manuel catalogue</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 bg-neutral-900 rounded-full text-neutral-500 hover:text-white transition-all active:scale-90">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center gap-3 text-red-500"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* EAN */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Tag className="w-3 h-3" /> Code EAN <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  required
                  value={formData.numero_ean}
                  onChange={(e) => setFormData({...formData, numero_ean: e.target.value})}
                  placeholder="8 à 14 chiffres"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none font-mono tracking-widest placeholder:text-neutral-800"
                />
              </div>

              {/* Désignation */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Package className="w-3 h-3" /> Désignation <span className="text-red-500">*</span>
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
                  <Save className="w-3 h-3" /> Prix Vente (€)
                </label>
                <input
                  type="number"
                  step="0.01"
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
                    <option value="NOUVEAU">+ Créer un nouveau rayon</option>
                  </select>
                </div>
                {formData.rayon === 'NOUVEAU' && (
                  <input
                    type="text"
                    autoFocus
                    onChange={(e) => setFormData({...formData, rayon: e.target.value})}
                    placeholder="Nom du nouveau rayon"
                    className="w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-white focus:border-red-600 outline-none"
                  />
                )}
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
                  CRÉER LE PRODUIT
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
