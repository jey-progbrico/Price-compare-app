"use client";

import { useState, useEffect } from "react";
import { Database, HardDrive, Trash2, ShieldCheck, Activity, Bug, Paintbrush, Loader2, CheckCircle2 } from "lucide-react";

interface ScraperStatus {
  enseigne: string;
  statut: string;
  score_fiabilite: number;
  consecutive_403: number;
}

export default function ParametresPage() {
  const [loadingCache, setLoadingCache] = useState(false);
  const [scrapers, setScrapers] = useState<ScraperStatus[] | null>(null);
  const [loadingScrapers, setLoadingScrapers] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [supabaseOk, setSupabaseOk] = useState(true); // Simplified check based on env variables availability
  
  useEffect(() => {
    // Verifier la présence des variables d'environnement Supabase
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setSupabaseOk(false);
    }

    const fetchScrapers = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.success) {
          setScrapers(data.statuses);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingScrapers(false);
      }
    };

    fetchScrapers();
  }, []);

  const handleClearCache = async () => {
    if (!confirm("Êtes-vous sûr de vouloir vider tout l'historique des prix en cache ? Les prochaines recherches prendront plus de temps.")) {
      return;
    }

    setLoadingCache(true);
    try {
      const res = await fetch('/api/cache/clear-all', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert("Le cache a été vidé avec succès !");
      } else {
        alert("Erreur: " + data.error);
      }
    } catch (err) {
      alert("Erreur lors de la communication avec le serveur.");
    } finally {
      setLoadingCache(false);
    }
  };

  return (
    <main className="min-h-full p-4 sm:p-6 pt-6 font-sans text-white animate-in fade-in pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Paramètres</h1>
        <p className="text-sm text-neutral-400">Configuration et état du système</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Section Infos Système */}
        <section>
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Système</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Version Application</div>
                  <div className="text-xs text-neutral-500">Vigiprix v6.1</div>
                </div>
              </div>
              <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2 py-1 rounded">À jour</span>
            </div>
            
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Connexion Supabase</div>
                  <div className="text-xs text-neutral-500">Base de données</div>
                </div>
              </div>
              {supabaseOk ? (
                <span className="flex items-center gap-1 text-xs font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded border border-green-900/50">
                  <CheckCircle2 className="w-3 h-3" /> Connecté
                </span>
              ) : (
                <span className="text-xs font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded border border-red-900/50">
                  Non configuré
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Section Cache */}
        <section>
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Stockage & Cache</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Durée de vie du cache</div>
                  <div className="text-xs text-neutral-500">Expiration des prix</div>
                </div>
              </div>
              <span className="text-sm font-bold">24 heures</span>
            </div>

            <div className="p-4">
              <button 
                onClick={handleClearCache}
                disabled={loadingCache}
                className="w-full py-3 px-4 bg-red-900/20 border border-red-900/50 hover:bg-red-900/40 text-red-500 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loadingCache ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loadingCache ? "Nettoyage en cours..." : "Vider intégralement le cache"}
              </button>
              <p className="text-[10px] text-neutral-500 text-center mt-2">
                Attention : Cette action forcera le re-scraping complet de tous les produits.
              </p>
            </div>
          </div>
        </section>

        {/* Section Scrapers */}
        <section>
          <div className="flex justify-between items-end mb-3 px-1">
            <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Santé des Scrapers</h2>
            {loadingScrapers && <Loader2 className="w-3 h-3 text-neutral-500 animate-spin" />}
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            {scrapers ? (
              <div className="divide-y divide-neutral-800">
                {scrapers.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${s.statut === 'actif' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-medium text-sm">{s.enseigne}</div>
                        {s.statut !== 'actif' && <div className="text-[10px] text-red-400">Blocage détecté</div>}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div className="text-xs">
                        <div className="text-neutral-500">Fiabilité</div>
                        <div className={`font-mono font-bold ${s.score_fiabilite > 80 ? 'text-green-500' : s.score_fiabilite > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {s.score_fiabilite.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center justify-center text-neutral-500">
                <Activity className="w-6 h-6 mb-2 opacity-50" />
                <p className="text-sm">Données indisponibles</p>
              </div>
            )}
          </div>
        </section>

        {/* Section Interface & Dev */}
        <section>
          <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-3 px-1">Développeur</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400">
                  <Paintbrush className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Thème de l'interface</div>
                  <div className="text-xs text-neutral-500">Apparence de l'application</div>
                </div>
              </div>
              <span className="text-xs font-medium bg-neutral-800 px-2 py-1 rounded">Sombre</span>
            </div>

            <div className="flex justify-between items-center p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-800 rounded-lg text-neutral-400">
                  <Bug className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium">Mode Debug API</div>
                  <div className="text-xs text-neutral-500">Affiche les logs d'erreurs</div>
                </div>
              </div>
              <button 
                onClick={() => setDebugMode(!debugMode)}
                className={`w-12 h-6 rounded-full transition-colors relative ${debugMode ? 'bg-red-500' : 'bg-neutral-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${debugMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
