"use client";

import { useState } from "react";
import { 
  AlertTriangle, 
  X, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  Database,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { showToast } from "@/components/Toast";

interface CatalogResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CatalogResetModal({ isOpen, onClose, onSuccess }: CatalogResetModalProps) {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Warning, 2: Final Confirmation

  const CONFIRM_TEXT = "RÉINITIALISER LE CATALOGUE";

  const handleReset = async () => {
    if (confirmation !== CONFIRM_TEXT) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/catalog/reset", {
        method: "DELETE"
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Catalogue réinitialisé avec succès", "success");
        if (onSuccess) onSuccess();
        onClose();
        // Reset state for next time
        setConfirmation("");
        setStep(1);
      } else {
        showToast(data.error || "Erreur lors de la réinitialisation", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion au serveur", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-neutral-950 border border-red-900/30 rounded-[3rem] shadow-2xl overflow-hidden"
          >
            {/* Header / Banner */}
            <div className="bg-red-600 p-6 flex items-center justify-center gap-4">
              <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Action Haute Sécurité</h2>
            </div>

            <div className="p-8 sm:p-12 space-y-8">
              {step === 1 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="space-y-4 text-center sm:text-left">
                    <h3 className="text-2xl font-black text-white leading-tight">
                      Réinitialiser le catalogue complet ?
                    </h3>
                    <p className="text-sm text-neutral-400 font-medium leading-relaxed">
                      Cette action supprimera <span className="text-red-500 font-bold">DÉFINITIVEMENT</span> tous les produits, relevés de prix et historiques de recherche.
                    </p>
                  </div>

                  <div className="bg-red-950/20 border border-red-900/20 rounded-2xl p-6 space-y-4">
                    <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Éléments supprimés :</h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-400 font-medium">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> Tous les produits</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> Relevés de prix terrain</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> Cache prix concurrents</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-red-600" /> Historique recherches</li>
                    </ul>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button 
                      onClick={onClose}
                      className="flex-1 py-4 bg-neutral-900 text-neutral-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-neutral-800 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={() => setStep(2)}
                      className="flex-1 py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all shadow-xl"
                    >
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-black text-white">Confirmation Finale</h3>
                    <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Veuillez recopier la phrase ci-dessous :</p>
                  </div>

                  <div className="p-4 bg-black border border-neutral-900 rounded-xl text-center select-none">
                    <code className="text-red-500 font-black text-sm tracking-wider">{CONFIRM_TEXT}</code>
                  </div>

                  <div className="space-y-4">
                    <input 
                      type="text"
                      autoFocus
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      placeholder="Saisissez la phrase de confirmation..."
                      className="w-full bg-black border border-red-900/20 rounded-2xl px-6 py-5 text-sm text-white text-center focus:border-red-600 outline-none transition-all placeholder-neutral-800 font-bold"
                    />

                    <div className="flex gap-4 pt-4">
                      <button 
                        onClick={() => setStep(1)}
                        className="flex-1 py-4 bg-neutral-900 text-neutral-500 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-neutral-800 transition-all"
                      >
                        Retour
                      </button>
                      <button 
                        onClick={handleReset}
                        disabled={confirmation !== CONFIRM_TEXT || loading}
                        className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                          confirmation === CONFIRM_TEXT && !loading
                            ? "bg-red-600 text-white shadow-2xl shadow-red-600/40 hover:bg-red-500" 
                            : "bg-neutral-900 text-neutral-700 cursor-not-allowed"
                        }`}
                      >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-5 h-5" /> EXÉCUTER LA RÉINITIALISATION</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Close Button Top Right */}
            <button 
              onClick={onClose}
              className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
