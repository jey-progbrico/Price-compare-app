"use client";

import { useState, useEffect } from "react";
import { 
  Trash2, 
  X, 
  AlertTriangle, 
  Loader2, 
  Info,
  ChevronRight,
  Database,
  History,
  Eye
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Props {
  produit: {
    numero_ean: string;
    description_produit: string | null;
    rayon?: string | null;
    groupe_produit?: string | null;
  };
  onClose: () => void;
}

export default function DeleteProductModal({ produit, onClose }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    releves: 0,
    activites: 0,
    consultations: 0,
    loading: true
  });
  const router = useRouter();

  // Fetch linked data counts
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [relevesRes, activitesRes, consultationsRes] = await Promise.all([
          supabase.from("releves_prix").select("id", { count: "exact", head: true }).eq("ean", produit.numero_ean),
          supabase.from("historique_activites").select("id", { count: "exact", head: true }).eq("ean", produit.numero_ean),
          supabase.from("historique_consultations").select("id", { count: "exact", head: true }).eq("ean", produit.numero_ean),
        ]);

        setStats({
          releves: relevesRes.count || 0,
          activites: activitesRes.count || 0,
          consultations: consultationsRes.count || 0,
          loading: false
        });
      } catch (err) {
        console.error("Error fetching product stats:", err);
        setStats(s => ({ ...s, loading: false }));
      }
    };

    fetchStats();
  }, [produit.numero_ean]);

  const hasLinkedData = stats.releves > 0 || stats.activites > 0 || stats.consultations > 0;

  const handleDelete = async () => {
    // Basic validation for desktop
    if (confirmText !== "SUPPRIMER") {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/produits/${produit.numero_ean}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      // Success
      // Redirect to rayon if available, otherwise to /produits
      const redirectPath = produit.rayon 
        ? `/rayon/${encodeURIComponent(produit.rayon.toLowerCase().replace(/\s+/g, '-'))}`
        : "/produits";
      
      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      alert(`Erreur: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0a0a0c] border-t sm:border border-red-900/30 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(220,38,38,0.15)] animate-in slide-in-from-bottom-10 duration-500">
        
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">Supprimer ce produit ?</h2>
              <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest">Cette action est irréversible</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Product Summary */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Désignation</span>
                <h3 className="text-lg font-bold text-white line-clamp-2">{produit.description_produit}</h3>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Code EAN</span>
                <span className="text-xs font-mono font-bold text-neutral-300 bg-black/40 px-2 py-1 rounded border border-white/5">{produit.numero_ean}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Rayon</span>
                <span className="text-xs font-bold text-neutral-300">{produit.rayon || "Non classé"}</span>
              </div>
            </div>
          </div>

          {/* Warning / Stats */}
          {stats.loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-600" />
            </div>
          ) : hasLinkedData ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-black uppercase tracking-tight">Données historiques détectées</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Ce produit possède des données historiques liées. Elles seront <span className="text-white font-bold underline">conservées</span> mais le produit disparaîtra du catalogue actif.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col items-center">
                  <Database className="w-3 h-3 text-neutral-600 mb-1" />
                  <span className="text-lg font-black text-white">{stats.releves}</span>
                  <span className="text-[8px] font-bold text-neutral-500 uppercase">Relevés</span>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col items-center">
                  <History className="w-3 h-3 text-neutral-600 mb-1" />
                  <span className="text-lg font-black text-white">{stats.activites}</span>
                  <span className="text-[8px] font-bold text-neutral-500 uppercase">Actions</span>
                </div>
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col items-center">
                  <Eye className="w-3 h-3 text-neutral-600 mb-1" />
                  <span className="text-lg font-black text-white">{stats.consultations}</span>
                  <span className="text-[8px] font-bold text-neutral-500 uppercase">Vues</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-6 flex gap-4 items-center">
              <Info className="w-6 h-6 text-blue-500 shrink-0" />
              <p className="text-xs text-neutral-400">Ce produit est orphelin (aucune donnée historique liée). Sa suppression sera totale et sans impact.</p>
            </div>
          )}

          {/* Validation Input */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block px-1">
              Tapez <span className="text-white">SUPPRIMER</span> pour confirmer
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="CONFIRMATION"
              className="w-full bg-black border-2 border-white/5 focus:border-red-600/50 rounded-2xl px-5 py-4 text-white font-black tracking-widest outline-none transition-all placeholder:text-neutral-800"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 text-neutral-400 font-bold py-4 rounded-2xl hover:text-white transition-all active:scale-95"
          >
            ANNULER
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || confirmText !== "SUPPRIMER"}
            className="flex-[2] bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-5 h-5" />
                CONFIRMER LA SUPPRESSION
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
