"use client";

import { useState } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  Info,
  Layers,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { useEffect } from "react";

export default function ImportProduitsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, isAdmin, isAdherant } = useProfile();
  
  useEffect(() => {
    if (!profileLoading && !isAdmin && !isAdherant) {
      router.push("/produits");
    }
  }, [profileLoading, isAdmin, isAdherant, router]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
          <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">Vérification des accès...</p>
        </div>
      </div>
    );
  }
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string; details?: string[] } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/import/produits", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: "Erreur de connexion serveur" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-4 sm:p-8 pt-16 pb-32 max-w-5xl mx-auto space-y-12">
      {/* 1. HEADER PROFESSIONNEL */}
      <header className="space-y-4 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 bg-emerald-600/10 border border-emerald-600/20 rounded-[2rem] flex items-center justify-center text-emerald-500 shadow-2xl">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl font-black text-white leading-none tracking-tighter">
              Import Catalogue
            </h1>
            <p className="text-sm sm:text-lg text-neutral-500 font-medium max-w-xl">
              Ajoutez ou mettez à jour vos produits en masse via un fichier Excel sécurisé.
            </p>
          </div>
        </div>
      </header>

      {/* 2. ÉTAPES VERTICALES */}
      <div className="flex flex-col gap-8 max-w-3xl mx-auto w-full">
        {/* CARD CONSIGNES */}
        <section className="bg-neutral-900/40 border border-neutral-800/60 rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-[10px] font-black border border-emerald-500/20">1</div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">Consignes de formatage</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Validation Strictes
              </h3>
              <ul className="space-y-2.5 text-[13px] text-neutral-400 font-medium">
                <li className="flex items-center gap-3"><div className="w-1 h-1 rounded-full bg-emerald-500" /> Format .xlsx uniquement</li>
                <li className="flex items-center gap-3"><div className="w-1 h-1 rounded-full bg-emerald-500" /> EAN valide (8-13 chiffres)</li>
                <li className="flex items-center gap-3"><div className="w-1 h-1 rounded-full bg-emerald-500" /> Prix numérique obligatoire</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Layers className="w-3 h-3 text-blue-500" /> Colonnes Requises
              </h3>
              <div className="grid grid-cols-1 gap-1 text-[11px] font-mono text-neutral-500 bg-black/30 p-3 rounded-xl border border-neutral-800/50">
                <div className="flex justify-between"><span>description_produit</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>numero_ean</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>groupe_produit</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>marque</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>prix_vente</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>rayon</span> <span className="text-emerald-500/50">OK</span></div>
                <div className="flex justify-between"><span>code_interne</span> <span className="text-blue-400/50">FACULTATIF</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* CARD MODÈLE - PLUS COMPACTE */}
        <section className="bg-emerald-600/5 border border-emerald-600/20 rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 group hover:bg-emerald-600/10 transition-all shadow-lg">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-base font-black text-white">Modèle Excel Prêt</h3>
              <p className="text-[11px] text-neutral-500 font-medium uppercase tracking-widest mt-1">Garantit la structure 100% compatible</p>
            </div>
          </div>

          <a 
            href="/api/import/template"
            className="w-full sm:w-auto bg-emerald-600 text-white font-black px-8 py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-500 transition-all active:scale-95 shadow-xl shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            TÉLÉCHARGER LE MODÈLE
          </a>
        </section>
      </div>

      {/* 3. ÉTAPE 2 : UPLOAD & VALIDATION */}
      <section className="space-y-8">
        <div className="flex items-center gap-3 px-4">
          <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center text-red-500 text-xs font-black">2</div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Déposer votre fichier</h2>
        </div>

        <div className="max-w-3xl mx-auto w-full space-y-6">
          <label 
            className={`relative block group cursor-pointer border-2 border-dashed rounded-[3rem] p-16 sm:p-24 transition-all duration-500 ${
              dragActive 
                ? "border-emerald-500 bg-emerald-500/5 scale-[1.02]" 
                : file 
                  ? "border-emerald-600/50 bg-emerald-600/5" 
                  : "border-neutral-800 hover:border-neutral-700 bg-black/40"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if(e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
          >
            <input type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} />
            
            <div className="flex flex-col items-center text-center gap-6">
              <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all duration-700 ${
                file 
                  ? "bg-emerald-600 text-white rotate-12 shadow-2xl shadow-emerald-600/40" 
                  : "bg-neutral-900 text-neutral-700 group-hover:scale-110 group-hover:rotate-3"
              }`}>
                {loading ? <Loader2 className="w-12 h-12 animate-spin" /> : <Upload className="w-12 h-12" />}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {file ? file.name : "Sélectionner votre fichier Excel"}
                </h3>
                <p className="text-sm text-neutral-500 font-bold uppercase tracking-widest">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Glissez-déposez ou cliquez ici"}
                </p>
              </div>
            </div>
          </label>

          <AnimatePresence>
            {file && !loading && !result?.success && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="pt-4"
              >
                <button
                  onClick={handleUpload}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-6 rounded-[2rem] transition-all shadow-2xl shadow-red-600/30 flex items-center justify-center gap-4 text-xl active:scale-[0.98]"
                >
                  <ArrowRight className="w-6 h-6" />
                  LANCER L'IMPORTATION
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* RÉSULTATS DÉTAILLÉS */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-[3rem] border overflow-hidden shadow-2xl ${
                  result.success 
                    ? "bg-emerald-950/10 border-emerald-900/30" 
                    : "bg-red-950/10 border-red-900/30"
                }`}
              >
                <div className={`p-8 sm:p-12 flex items-center gap-6 ${result.success ? "bg-emerald-600/10" : "bg-red-600/10"}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${result.success ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                    {result.success ? <CheckCircle2 className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                  </div>
                  <div>
                    <h4 className={`text-3xl font-black ${result.success ? "text-emerald-500" : "text-red-500"}`}>
                      {result.success ? "Importation Réussie" : "Anomalie détectée"}
                    </h4>
                    <p className="text-sm text-neutral-400 font-bold uppercase tracking-widest mt-1">
                      {result.success ? `${result.count} produits synchronisés avec succès` : result.error}
                    </p>
                  </div>
                </div>

                {result.details && result.details.length > 0 && (
                  <div className="p-8 sm:p-12 bg-black/60 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-xs font-black text-white uppercase tracking-widest">Détails des erreurs (Fichier non traité)</p>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-4">
                      {result.details.map((err, i) => (
                        <div key={i} className="flex items-center gap-4 text-xs text-red-400 font-mono bg-red-950/20 p-4 rounded-2xl border border-red-900/20">
                          <span className="opacity-40 text-[10px]">{i + 1}</span>
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.success && (
                  <div className="p-8 sm:p-12">
                    <button 
                      onClick={() => router.push("/produits")}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                    >
                      ACCÉDER AU CATALOGUE À JOUR
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-12 border-t border-neutral-900 text-center">
        <p className="text-[10px] font-bold text-neutral-700 uppercase tracking-[0.3em]">
          Vigiprix Security — Secure Data Injection System v7.20
        </p>
      </footer>
    </main>
  );
}
