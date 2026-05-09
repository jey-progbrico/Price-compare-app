"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldAlert, Code2, CheckCircle2, RefreshCw, Activity, Loader2, Info, Search } from "lucide-react";

interface SearchResult {
  enseigne: string;
  titre: string;
  prix: string | null;
  lien: string;
  isCached?: boolean;
  prix_precedent?: string | number | null;
  date_changement_prix?: string | null;
}

interface ScraperState {
  name: string;
  status: 'pending' | 'running' | 'success' | 'not_found' | 'error' | 'ignored';
}

export default function CompareButton({ ean, internalPrice, isUnknown }: { ean: string; internalPrice?: number | null; isUnknown: boolean }) {
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingCache, setCheckingCache] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<any[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const [scrapers, setScrapers] = useState<ScraperState[]>([
    { name: "123elec", status: "pending" },
    { name: "Castorama", status: "pending" },
    { name: "Leroy Merlin", status: "pending" },
    { name: "Bricoman", status: "pending" },
    { name: "Bricomarché", status: "pending" },
    { name: "ManoMano", status: "pending" },
    { name: "Amazon", status: "pending" },
    { name: "L'Entrepôt du Bricolage", status: "pending" },
    { name: "Site Officiel", status: "pending" },
  ]);

  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Vérifier le cache au montage
    const checkCache = async () => {
      try {
        const res = await fetch(`/api/cache?ean=${encodeURIComponent(ean)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            setResults(data.results);
          }
        }
      } catch (err) {
        console.error("Erreur lecture cache:", err);
      } finally {
        setCheckingCache(false);
      }
    };
    checkCache();
    
    return () => {
      if (streamRef.current) streamRef.current.close();
    };
  }, [ean]);

  const startSearch = () => {
    setHasStarted(true);
    setLoading(true);
    setError(null);
    setResults([]);
    setDebugLogs([]);
    setScrapers(s => s.map(x => ({ ...x, status: 'pending' })));

    if (streamRef.current) {
      streamRef.current.close();
    }

    const eventSource = new EventSource(`/api/search/stream?ean=${encodeURIComponent(ean)}`);
    streamRef.current = eventSource;

    eventSource.addEventListener('scraper_start', (e: any) => {
      const data = JSON.parse(e.data);
      setScrapers(prev => prev.map(s => s.name === data.scraper ? { ...s, status: 'running' } : s));
    });

    eventSource.addEventListener('scraper_result', (e: any) => {
      const data = JSON.parse(e.data);
      setScrapers(prev => prev.map(s => s.name === data.scraper ? { ...s, status: data.status } : s));
      
      if (data.status === 'success' && data.result) {
        setResults(prev => {
          if (prev.some(r => r.enseigne === data.result.enseigne)) return prev;
          return [...prev, data.result];
        });
      }
    });

    eventSource.addEventListener('done', (e: any) => {
      const data = JSON.parse(e.data);
      if (data.debugLogs) setDebugLogs(data.debugLogs);
      setLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', (e: any) => {
      let msg = "Erreur de connexion au flux de recherche.";
      try {
        const data = JSON.parse(e.data);
        if (data.message) msg = data.message;
      } catch (err) {}
      setError(msg);
      setLoading(false);
      eventSource.close();
    });
  };

  const handleForceRefresh = async () => {
    setClearing(true);
    try {
      await fetch(`/api/cache/clear?ean=${encodeURIComponent(ean)}`, { method: "DELETE" });
      startSearch();
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-900 rounded-xl text-red-500 text-sm text-center">
          {error}
        </div>
      )}

      {/* Manual Search Button (visible if not checking cache, not loading, and not started) */}
      {!loading && !hasStarted && !checkingCache && (
        <button 
          onClick={startSearch}
          className="w-full mb-6 bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)]"
        >
          <Search className="w-5 h-5" />
          {results.length > 0 ? "Actualiser les prix (Recherche Live)" : "Rechercher les prix concurrents"}
        </button>
      )}

      {/* Loading Progress UI */}
      {loading && (
        <div className="mb-6 bg-neutral-900/80 border border-neutral-800 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
              Recherche en cours...
            </h3>
            <span className="text-xs font-mono text-neutral-500 bg-black px-2 py-1 rounded-md">
              {scrapers.filter(s => s.status !== 'pending' && s.status !== 'running').length} / {scrapers.length}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {scrapers.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded-lg border ${
                s.status === 'running' ? 'bg-blue-900/20 border-blue-900/50 text-blue-400' :
                s.status === 'success' ? 'bg-green-900/20 border-green-900/50 text-green-400' :
                s.status === 'not_found' ? 'bg-neutral-800 border-neutral-700 text-neutral-500' :
                s.status === 'error' ? 'bg-red-900/20 border-red-900/50 text-red-400' :
                s.status === 'ignored' ? 'bg-purple-900/20 border-purple-900/50 text-purple-400' :
                'bg-black border-neutral-900 text-neutral-600'
              }`}>
                {s.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                {s.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                {s.status === 'not_found' && <Info className="w-3 h-3" />}
                {s.status === 'error' && <ShieldAlert className="w-3 h-3" />}
                {s.status === 'ignored' && <Activity className="w-3 h-3" />}
                {s.status === 'pending' && <div className="w-3 h-3 rounded-full border border-neutral-700" />}
                <span className="truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results UI */}
      {(!loading && results.length > 0) && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end mb-4">
            <h3 className="text-lg font-bold text-white flex items-center">
              {hasStarted ? 'Résultats web' : 'Résultats en cache'} ({results.length})
            </h3>
            
            <div className="flex gap-2">
              <button onClick={() => setShowDebug(!showDebug)} className={`p-2 rounded-xl transition-colors ${showDebug ? 'bg-neutral-800 text-white' : 'bg-neutral-900 text-neutral-400'}`}>
                <Code2 className="w-4 h-4" />
              </button>
              <button onClick={handleForceRefresh} disabled={clearing || loading} className="p-2 bg-neutral-900 text-neutral-400 hover:text-white rounded-xl transition-colors" title="Forcer l'actualisation">
                <RefreshCw className={`w-4 h-4 ${clearing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {showDebug && debugLogs.length > 0 && (
            <div className="mb-4 p-3 bg-black border border-neutral-800 rounded-xl font-mono text-[10px] text-neutral-400 overflow-x-auto max-h-64 overflow-y-auto">
              <ul className="space-y-1">
                {debugLogs.map((log, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-neutral-500">[{i+1}]</span>
                    {log.step ? (
                      <span className={log.status?.includes('Ignoré') ? "text-purple-400" : "text-blue-400"}>
                        {log.step}: {log.enseigne ? `${log.enseigne} - ` : ''}{log.status}
                      </span>
                    ) : (
                      <>
                        <span className={log.statut?.includes("success") ? "text-green-500" : "text-yellow-500"}>{log.enseigne}</span>
                        <span>{log.statut} HTTP {log.httpStatus}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            {results.map((res, i) => {
              const currentPrice = res.prix ? parseFloat(res.prix) : 0;
              const previousPrice = res.prix_precedent ? parseFloat(res.prix_precedent.toString()) : null;
              const hasDropped = previousPrice && currentPrice < previousPrice;
              const isCheaperThanInternal = internalPrice && currentPrice > 0 && currentPrice < internalPrice;

              return (
                <a key={i} href={res.lien} target="_blank" rel="noopener noreferrer" className="bg-[#111] rounded-2xl p-3 border border-neutral-800/80 flex gap-4 items-center hover:border-neutral-700 transition-colors">
                  <div className={`w-16 h-16 rounded-xl border flex items-center justify-center flex-shrink-0 text-2xl font-black ${res.enseigne === 'Site Officiel' ? 'bg-blue-900/20 border-blue-900/50 text-blue-500' : 'bg-neutral-900 border-neutral-800 text-neutral-700'}`}>
                    {res.enseigne === 'Site Officiel' ? '⭐' : res.enseigne.charAt(0)}
                  </div>
                  
                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${res.enseigne === 'Site Officiel' ? 'text-blue-400' : 'text-neutral-400'}`}>
                        {res.enseigne}
                      </span>
                      {res.isCached && <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded uppercase">Cache</span>}
                    </div>
                    <h4 className="text-white text-sm font-medium line-clamp-2 leading-snug mb-1">
                      {res.titre}
                    </h4>
                    {currentPrice > 0 ? (
                      <div className="flex items-end gap-2 mt-2">
                        <span className="text-xl font-black text-white leading-none">{currentPrice.toFixed(2)}€</span>
                        {previousPrice && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${hasDropped ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>
                            {hasDropped ? '📉' : '📈'} {previousPrice.toFixed(2)}€
                          </span>
                        )}
                        {isCheaperThanInternal && (
                          <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-md ml-auto">
                            Moins cher
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-neutral-500">Prix non affiché</div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {hasStarted && !loading && results.length === 0 && (
        <div className="p-6 bg-neutral-900/50 rounded-2xl border border-neutral-800 text-center mt-4">
          <ShieldAlert className="w-8 h-8 text-yellow-500/50 mx-auto mb-2" />
          <p className="text-white text-sm font-medium">Aucun résultat trouvé sur le web</p>
        </div>
      )}
    </div>
  );
}
