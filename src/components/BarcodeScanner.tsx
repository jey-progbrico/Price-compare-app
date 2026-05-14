"use client";

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
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
  Save
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { RayonRow } from "@/types/database";

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"scan" | "create">("scan");
  const [ean, setEan] = useState("");
  const [formData, setFormData] = useState({
    description_produit: "",
    marque: "",
    rayon: "",
    groupe_produit: "",
    prix_vente: ""
  });
  
  const [rayons, setRayons] = useState<string[]>([]);
  const qrCodeInstanceRef = useRef<Html5Qrcode | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const barcodeBuffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    // Support Douchette USB (Lecture clavier rapide)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== "scan") return;
      
      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = ""; // Reset si trop lent
      }
      
      if (e.key === "Enter") {
        if (barcodeBuffer.current.length >= 8) {
          handleScanSuccess(barcodeBuffer.current);
          barcodeBuffer.current = "";
        }
      } else if (/^\d$/.test(e.key)) {
        barcodeBuffer.current += e.key;
      }
      
      lastKeyTime.current = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown);
    
    // Récupérer les rayons pour le formulaire
    const fetchRayons = async () => {
      try {
        const { data } = await supabase.from("produits").select("rayon").not("rayon", "is", null);
        const unique = Array.from(new Set((data as RayonRow[] | null)?.map(r => r.rayon).filter((r): r is string => !!r) || []));
        setRayons(unique);
      } catch (err) {
        console.error("Error fetching rayons:", err);
      }
    };
    fetchRayons();

    // Focus auto sur desktop pour douchette
    if (mode === "scan" && window.innerWidth > 1024) {
      setTimeout(() => inputRef.current?.focus(), 500);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      stopCamera();
    };
  }, [mode]);

  const startCamera = async () => {
    setError("");
    setLoading(true);
    
    // S'assurer que l'élément est prêt
    const readerElement = document.getElementById("reader");
    if (!readerElement) {
      setError("Erreur interne : Zone de rendu absente.");
      setLoading(false);
      return;
    }

    try {
      // Création instance si nécessaire
      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new Html5Qrcode("reader");
      }

      const config = { 
        fps: 20, 
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0
      };

      await qrCodeInstanceRef.current.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => handleScanSuccess(decodedText),
        () => {} // Ignorer les erreurs de frame non reconnue
      );
      
      setIsCameraActive(true);
      console.log("🟢 Caméra démarrée");
    } catch (err: any) {
      console.error("🔴 Erreur démarrage caméra:", err);
      
      if (err.includes("NotAllowedError") || err.includes("Permission denied")) {
        setError("Accès caméra refusé. Veuillez l'autoriser dans vos réglages.");
      } else if (err.includes("NotFoundError")) {
        setError("Aucune caméra détectée sur votre appareil.");
      } else if (err.includes("NotReadableError")) {
        setError("Caméra déjà utilisée par une autre application.");
      } else {
        setError("Erreur caméra : Impossible d'ouvrir le flux vidéo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = async () => {
    if (qrCodeInstanceRef.current && qrCodeInstanceRef.current.isScanning) {
      try {
        await qrCodeInstanceRef.current.stop();
        setIsCameraActive(false);
        console.log("🔴 Caméra arrêtée");
      } catch (err) {
        console.error("Erreur arrêt caméra:", err);
      }
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
        await stopCamera();
        router.push(`/produit/${decodedText}`);
        onClose();
      } else {
        // Inconnu : Mode création
        await stopCamera();
        setMode("create");
      }
    } catch (err) {
      // Erreur de fetch ou produit absent
      await stopCamera();
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
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-start sm:justify-center p-0 sm:p-8 backdrop-blur-md overflow-y-auto"
    >
      <motion.div 
        initial={{ y: 50, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-xl lg:max-w-4xl bg-neutral-950 sm:rounded-[3rem] border-x sm:border border-neutral-800 shadow-[0_0_100px_rgba(0,0,0,0.8)] relative min-h-screen sm:min-h-0"
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
                <div className="relative group max-w-sm mx-auto w-full">
                  {/* Cadre Stylisé */}
                  <div className={`absolute -inset-2 border-2 rounded-[2rem] pointer-events-none transition-colors ${isCameraActive ? 'border-red-600/40' : 'border-neutral-800'}`} />
                  
                  {/* Coins Visuels */}
                  <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl z-10 transition-colors ${isCameraActive ? 'border-red-600' : 'border-neutral-800'}`} />
                  <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl z-10 transition-colors ${isCameraActive ? 'border-red-600' : 'border-neutral-800'}`} />
                  <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl z-10 transition-colors ${isCameraActive ? 'border-red-600' : 'border-neutral-800'}`} />
                  <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl z-10 transition-colors ${isCameraActive ? 'border-red-600' : 'border-neutral-800'}`} />
                  
                  {/* Ligne de scan animée */}
                  {isCameraActive && (
                    <motion.div 
                      animate={{ y: [0, 200, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-x-4 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent z-10 opacity-50 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    />
                  )}

                  <div className="relative aspect-square w-full bg-black rounded-[1.5rem] overflow-hidden border border-neutral-900 shadow-inner">
                    <div id="reader" className="w-full h-full" />
                    
                    {!isCameraActive && !loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 opacity-20 pointer-events-none">
                        <Camera className="w-12 h-12 mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Caméra en attente</p>
                      </div>
                    )}

                    {loading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                        <div className="text-center space-y-4">
                          <Loader2 className="w-10 h-10 animate-spin text-red-500 mx-auto" />
                          <p className="text-xs font-black text-white uppercase tracking-widest animate-pulse">
                            {isCameraActive ? 'Analyse en cours...' : 'Initialisation...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="absolute inset-x-0 -bottom-12 flex justify-center z-30">
                      <div className="bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-full shadow-lg animate-bounce flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {error}
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions & Saisie */}
                <div className="space-y-6 pt-4">
                  {!isCameraActive && (
                    <div className="text-center">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest leading-relaxed max-w-[250px] mx-auto">
                        Pour scanner, autorisez l'accès à votre caméra arrière.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
                    {!isCameraActive ? (
                      <button 
                        onClick={startCamera}
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                      >
                        <Camera className="w-5 h-5" />
                        AUTORISER LA CAMÉRA
                      </button>
                    ) : (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl py-4 flex items-center justify-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-black text-green-500 uppercase tracking-widest">Scanner Actif</span>
                      </div>
                    )}
                    
                    <button className="w-full bg-neutral-900 text-neutral-400 font-bold py-3 text-[10px] rounded-xl hover:text-white transition-colors flex items-center justify-center gap-2 uppercase tracking-widest">
                      <ImageIcon className="w-4 h-4" />
                      Scanner depuis une image
                    </button>
                  </div>

                  <div className="pt-8 border-t border-neutral-900 max-w-sm mx-auto w-full">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3 block px-1">Saisie Manuelle</label>
                    <div className="relative">
                      <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Entrez un EAN manuellement..."
                        value={ean}
                        onChange={(e) => setEan(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleScanSuccess(ean);
                        }}
                        className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl px-5 py-4 text-white font-mono focus:border-red-600 outline-none transition-all placeholder:text-neutral-700"
                      />
                      <button 
                        onClick={() => handleScanSuccess(ean)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors"
                      >
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
        #reader video { 
          object-fit: cover !important; 
          width: 100% !important; 
          height: 100% !important; 
          border-radius: 1.5rem !important;
        }
        #reader { border: none !important; }
      `}} />
    </motion.div>
  );
}
