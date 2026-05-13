"use client";

import { useState, useEffect } from "react";
import { 
  Zap, 
  Trash2, 
  Settings, 
  ExternalLink, 
  Copy, 
  Database, 
  FileText, 
  ChevronRight,
  Shield,
  Gauge
} from "lucide-react";

export default function ParametresPage() {
  const [cacheDuration, setCacheDuration] = useState("7");
  const [priceThreshold, setPriceThreshold] = useState("0.50");
  const [loading, setLoading] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);

  useEffect(() => {
    // Simulation de récupération des stats
    setCacheCount(124);
  }, []);

  const bookmarkletCode = `javascript:(function(){var ean=document.body.innerText.match(/\\b\\d{13}\\b/)?.[0]||'';var url=encodeURIComponent(location.href);var title=encodeURIComponent(document.title);window.open('${typeof window !== 'undefined' ? window.location.origin : ''}/import?ean='+ean+'&url='+url+'&title='+title,'_blank');})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    alert("Code du bookmarklet copié !");
  };

  const clearCache = async () => {
    if (!confirm("Voulez-vous vider le cache automatique ?")) return;
    setLoading(true);
    // Logique de nettoyage
    setTimeout(() => {
      setLoading(false);
      alert("Cache vidé.");
    }, 1000);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-24 space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800">
          <Settings className="w-6 h-6 text-neutral-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white leading-tight">Outils Terrain</h1>
          <p className="text-xs text-neutral-500 font-medium">Configuration et maintenance</p>
        </div>
      </div>

      {/* 1. SECTION IMPORT RAPIDE PC */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Zap className="w-4 h-4 text-yellow-500" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Import PC (Bookmarklet)</h2>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4 shadow-xl">
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Utilisez le bookmarklet pour importer n'importe quelle page produit concurrente d'un seul clic vers VigiPrix depuis votre ordinateur.
          </p>
          <button 
            onClick={copyBookmarklet}
            className="w-full bg-white text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Copy className="w-4 h-4" />
            Copier le Bookmarklet
          </button>
          <p className="text-[9px] text-neutral-600 text-center italic">
            Collez ce code dans l'adresse d'un favori nommé "VigiPrix Import".
          </p>
        </div>
      </section>

      {/* 1bis. SECTION IMPORT MOBILE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Import Mobile (Partage)</h2>
        </div>
        <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-3xl p-5 space-y-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
             <Zap className="w-16 h-16 text-emerald-500" />
          </div>

          <div className="space-y-4 relative z-10">
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">1</div>
              <p className="text-xs text-neutral-300 leading-tight">Ouvrez une fiche concurrente (Chrome/Safari)</p>
            </div>
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">2</div>
              <p className="text-xs text-neutral-300 leading-tight">Cliquez sur <span className="font-black text-white uppercase px-1">Partager</span> dans votre navigateur</p>
            </div>
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">3</div>
              <p className="text-xs text-neutral-300 leading-tight">Choisissez <span className="font-black text-white uppercase px-1">VigiPrix</span> dans la liste des apps</p>
            </div>
            <div className="flex gap-4">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">4</div>
              <p className="text-xs text-neutral-300 leading-tight italic opacity-60">L'import se pré-remplit automatiquement !</p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest text-center">
              Recommandé pour le terrain
            </p>
          </div>
        </div>
      </section>

      {/* 2. SECTION CACHE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Database className="w-4 h-4 text-blue-500" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Gestion du Cache</h2>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden divide-y divide-neutral-800/50 shadow-xl">
          <div className="p-5 flex justify-between items-center">
            <div>
              <div className="text-sm font-bold text-white">Éléments en cache</div>
              <div className="text-[10px] text-neutral-500">Suggestions DuckDuckGo mémorisées</div>
            </div>
            <span className="text-lg font-black text-white">{cacheCount}</span>
          </div>

          <div className="p-5 space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase block">Durée de conservation</label>
            <div className="grid grid-cols-3 gap-2">
              {["7", "14", "30"].map(d => (
                <button
                  key={d}
                  onClick={() => setCacheDuration(d)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    cacheDuration === d 
                      ? "bg-blue-600 border-blue-500 text-white" 
                      : "bg-black border-neutral-800 text-neutral-500"
                  }`}
                >
                  {d} jours
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            <button 
              onClick={clearCache}
              disabled={loading}
              className="w-full bg-neutral-950 border border-red-900/30 text-red-500 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Vider le cache automatique
            </button>
          </div>
        </div>
      </section>

      {/* 3. SECTION VEILLE */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Gauge className="w-4 h-4 text-violet-500" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Veille Concurrentielle</h2>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-5 shadow-xl">
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-neutral-500 uppercase block">Seuil d'alignement prix (€)</label>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(e.target.value)}
                className="w-20 bg-black border border-neutral-800 rounded-xl px-3 py-2 text-white font-bold text-sm outline-none focus:border-violet-600 transition-all"
              />
              <span className="text-[10px] text-neutral-500 leading-tight">
                Écart maximum pour considérer qu'un prix est "aligné" (Badge jaune).
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800/50">
            <div className="flex justify-between items-center opacity-50">
              <div className="text-sm font-bold text-white">Enseignes favorites</div>
              <ChevronRight className="w-4 h-4" />
            </div>
            <p className="text-[9px] text-neutral-600 mt-1 uppercase tracking-tighter">Bientôt disponible</p>
          </div>
        </div>
      </section>

      {/* 4. SECTION DONNÉES */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <FileText className="w-4 h-4 text-neutral-500" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Données & Export</h2>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden divide-y divide-neutral-800/50 shadow-xl">
          <button className="w-full p-5 flex justify-between items-center hover:bg-neutral-800/30 transition-all opacity-40 grayscale cursor-not-allowed">
            <div className="text-left">
              <div className="text-sm font-bold text-white">Exporter en CSV</div>
              <div className="text-[10px] text-neutral-500">Extraire tous les relevés terrain</div>
            </div>
            <ExternalLink className="w-5 h-5 text-neutral-700" />
          </button>
          
          <button className="w-full p-5 flex justify-between items-center hover:bg-red-950/20 transition-all group">
            <div className="text-left">
              <div className="text-sm font-bold text-red-500">Vider les relevés terrain</div>
              <div className="text-[10px] text-neutral-700">Suppression définitive de l'historique</div>
            </div>
            <Trash2 className="w-5 h-5 text-red-900 group-hover:text-red-500" />
          </button>
        </div>
      </section>

      {/* 5. VERSION */}
      <div className="pt-4 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-neutral-700 uppercase tracking-widest">
          <Shield className="w-3 h-3" />
          Vigiprix System v7.6 — Stable
        </div>
      </div>
    </main>
  );
}
