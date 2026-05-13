"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner, Html5Qrcode } from "html5-qrcode";
import { 
  X, 
  Camera, 
  Image as ImageIcon, 
  Plus, 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Maximize2,
  Package,
  Tag,
  Layers,
  Save,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"scan" | "create" | "searching">("scan");
  const [ean, setEan] = useState("");
  const [formData, setFormData] = useState({
    description_produit: "",
    marque: "",
    rayon: "",
    groupe_produit: "",
    contenance: "",
    unite: "",
    prix_vente: ""
  });
  
  const [rayons, setRayons] = useState<string[]>([]);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Récupérer les rayons pour le formulaire
    const fetchRayons = async () => {
      const { data } = await supabase.from("produits").select("rayon").not("rayon", "is", null);
      const unique = Array.from(new Set(data?.map(r => r.rayon) || []));
      setRayons(unique as string[]);
    };
    fetchRayons();

    // Init scanner
    const timeout = setTimeout(() => {
      initScanner();
    }, 300);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const initScanner = () => {
    try {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 15, 
          qrbox: { width: 280, height: 180 }, 
          formatsToSupport: [8, 1, 0, 14], // EAN_13, EAN_8, CODE_128, etc.
          aspectRatio: 1.0
        }, 
        false
      );

      scanner.render(
        (decodedText) => handleScanSuccess(decodedText),
        (err) => {}
      );
      scannerRef.current = scanner;
    } catch (err) {
      setError("Caméra inaccessible. Vérifiez les permissions.");
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (loading) return;
    setLoading(true);
    setEan(decodedText);
    
    // Vibration (si supporté)
    if (navigator.vibrate) navigator.vibrate(50);

    try {
      // Vérifier si le produit existe
      const { data: produit } = await supabase
        .from("produits")
        .select("numero_ean")
        .eq("numero_ean", decodedText)
        .single();

      if (produit) {
        // Succès : Redirection
        router.push(`/produit/${decodedText}`);
        onClose();
      } else {
        // Inconnu : Mode création
        if (scannerRef.current) await scannerRef.current.clear();
        setMode("create");
      }
    } catch (err) {
      setMode("create");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.from("produits").insert([{
        numero_ean: ean,
        description_produit: formData.description_produit,
        marque: formData.marque,
        rayon: formData.rayon,
        groupe_produit: formData.groupe_produit,
        contenance: formData.contenance,
        unite: formData.unite,
        prix_vente: parseFloat(formData.prix_vente) || 0,
        updated_at: new Date().toISOString()
      }]);

      if (error) throw error;

      // Log activité
      await fetch("/api/activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_action: "import_produit",
          ean,
          details: { ...formData }
        })
      });

      router.push(`/produit/${ean}`);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4 backdrop-blur-md overflow-y-auto"
    >
      <motion.div 
        initial={{ y: 50, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-xl bg-neutral-950/50 sm:rounded-[2.5rem] border-x sm:border border-neutral-800 shadow-2xl relative min-h-screen sm:min-h-0"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-neutral-900 sticky top-0 bg-neutral-950/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${mode === 'create' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-red-600/10 border-red-600/20 text-red-600'}`}>
              {mode === 'create' ? <Plus className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {mode === 'create' ? "Nouveau Produit" : "Scanner EAN"}
              </h2>
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {mode === 'create' ? "Fiche catalogue à compléter" : "Vigiprix Intelligent Scan"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-neutral-900 rounded-full text-neutral-500 hover:text-white transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {mode === 'scan' ? (
              <motion.div 
                key="scan-view"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-8"
              >
                {/* Scanner Zone */}
                <div className="relative group">
                  {/* Cadre Stylisé */}
                  <div className="absolute -inset-2 border-2 border-red-600/20 rounded-[2rem] pointer-events-none group-hover:border-red-600/40 transition-colors" />
                  
                  {/* Coins Visuels */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-red-600 rounded-tl-2xl z-10" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-red-600 rounded-tr-2xl z-10" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-red-600 rounded-bl-2xl z-10" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-red-600 rounded-br-2xl z-10" />
                  
                  {/* Ligne de scan animée */}
                  <motion.div 
                    animate={{ y: [0, 200, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-x-4 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent z-10 opacity-50 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                  />

                  <div id="reader" className="w-full aspect-[4/3] bg-black rounded-[1.5rem] overflow-hidden border border-neutral-900 shadow-inner">
                    {/* HTML5 QR Code injectera ici */}
                  </div>

                  {loading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-[1.5rem] z-20">
                      <div className="text-center space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-red-500 mx-auto" />
                        <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">Vérification...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions & Saisie */}
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-[250px] mx-auto">
                      Alignez le code-barres dans le cadre. <br/>Le scan est automatique et instantané.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-[0.98]">
                      <Camera className="w-5 h-5" />
                      AUTORISER LA CAMÉRA
                    </button>
                    
                    <button className="w-full bg-neutral-900 text-neutral-400 font-bold py-3 text-xs rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Scanner depuis une image
                    </button>
                  </div>

                  <div className="pt-6 border-t border-neutral-900">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3 block px-1">Saisie Manuelle</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        placeholder="Entrez un EAN manuellement..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleScanSuccess((e.target as HTMLInputElement).value);
                        }}
                        className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl px-5 py-4 text-white font-mono focus:border-red-600 outline-none transition-all placeholder:text-neutral-700"
                      />
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-neutral-800 rounded-xl text-neutral-400 hover:text-white">
                        <Search className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.form 
                key="create-view"
                onSubmit={handleCreate}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Badge Status */}
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl w-fit">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Produit inconnu au catalogue</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* EAN (Lecture seule) */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Tag className="w-3 h-3" /> Code EAN
                    </label>
                    <input 
                      type="text" 
                      value={ean}
                      readOnly
                      className="w-full bg-neutral-900/30 border border-neutral-800 rounded-xl px-4 py-3.5 text-neutral-400 font-mono text-sm cursor-not-allowed"
                    />
                  </div>

                  {/* Désignation */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Package className="w-3 h-3" /> Désignation Produit
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Interrupteur va-et-vient Mosaic"
                      value={formData.description_produit}
                      onChange={e => setFormData({...formData, description_produit: e.target.value})}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
                    />
                  </div>

                  {/* Marque */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <CheckCircle2 className="w-3 h-3" /> Marque
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Legrand"
                      value={formData.marque}
                      onChange={e => setFormData({...formData, marque: e.target.value})}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
                    />
                  </div>

                  {/* Prix */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Tag className="w-3 h-3" /> Prix Vente (€)
                    </label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={formData.prix_vente}
                      onChange={e => setFormData({...formData, prix_vente: e.target.value})}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
                    />
                  </div>

                  {/* Rayon */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Layers className="w-3 h-3" /> Rayon
                    </label>
                    <select 
                      required
                      value={formData.rayon}
                      onChange={e => setFormData({...formData, rayon: e.target.value})}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 outline-none appearance-none"
                    >
                      <option value="">Sélectionner...</option>
                      {rayons.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value="Autre">Autre (Nouveau)</option>
                    </select>
                  </div>

                  {/* Groupe */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
                      <Layers className="w-3 h-3" /> Famille / Groupe
                    </label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Appareillage"
                      value={formData.groupe_produit}
                      onChange={e => setFormData({...formData, groupe_produit: e.target.value})}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-white focus:border-red-600 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Actions Form */}
                <div className="flex gap-4 pt-6 border-t border-neutral-900">
                  <button 
                    type="button"
                    onClick={() => setMode("scan")}
                    className="flex-1 bg-neutral-900 text-neutral-400 font-bold py-4 rounded-2xl hover:text-white transition-all active:scale-95"
                  >
                    ANNULER
                  </button>
                  <button 
                    type="submit"
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
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Global Style pour injecter les styles html5-qrcode */}
      <style dangerouslySetInnerHTML={{__html: `
        #reader__dashboard_section_csr { display: none !important; }
        #reader__camera_selection { display: none !important; }
        #reader video { 
          object-fit: cover !important; 
          width: 100% !important; 
          height: 100% !important; 
          border-radius: 1.5rem !important;
        }
        #reader { border: none !important; }
        #reader img { display: none !important; }
        #reader__status_span { display: none !important; }
        #reader__header_message { display: none !important; }
      `}} />
    </motion.div>
  );
}
