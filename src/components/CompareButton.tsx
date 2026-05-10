"use client";

import { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Search,
  Database,
  Zap,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  enseigne: string;
  titre: string;
  prix: number | null;
  lien: string;
  source?: string;
  image_url?: string | null;
  isCached?: boolean;
  isStale?: boolean;
  prix_precedent?: number | null;
  date_changement_prix?: string | null;
  relevance_score?: number | null;
}

type SourceStatus = "pending" | "running" | "success" | "not_found" | "blocked" | "error" | "skipped";

interface SourceState {
  id: string;
  label: string;
  status: SourceStatus;
  count: number;
}

// ─── Config sources ───────────────────────────────────────────────────────────

const SOURCES_CONFIG: Record<string, { label: string; icon: "google" | "scraper" | "cache" }> = {
  cache: { label: "Cache", icon: "cache" },
  google_cse: { label: "Google Shopping", icon: "google" },
  scraper_123elec: { label: "123elec", icon: "scraper" },
  scraper_manomano: { label: "ManoMano", icon: "scraper" },
  scraper_bricozor: { label: "Bricozor", icon: "scraper" },
  scraper_amazon: { label: "Amazon", icon: "scraper" },
};

// ─── Couleurs par enseigne ────────────────────────────────────────────────────

const ENSEIGNE_COLORS: Record<string, string> = {
  "Amazon": "#FF9900",
  "ManoMano": "#00A88F",
  "123elec": "#E63946",
  "Bricozor": "#2563EB",
  "Leroy Merlin": "#78AF00",
  "Castorama": "#FF6B00",
  "Google": "#4285F4",
};

function getEnseigneColor(enseigne: string): string {
  return ENSEIGNE_COLORS[enseigne] || "#6B7280";
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#111] rounded-2xl p-4 border border-neutral-800/60 flex gap-3 items-center animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-neutral-800 rounded w-20" />
        <div className="h-4 bg-neutral-800 rounded w-full" />
        <div className="h-3 bg-neutral-800 rounded w-2/3" />
        <div className="h-6 bg-neutral-800 rounded w-24 mt-1" />
      </div>
    </div>
  );
}

function SourceBadge({ source, status }: { source: string; status: SourceStatus }) {
  const config = SOURCES_CONFIG[source];
  const label = config?.label || source;

  const styles: Record<SourceStatus, string> = {
    pending: "bg-neutral-900 border-neutral-800 text-neutral-600",
    running: "bg-blue-950/60 border-blue-800/60 text-blue-400",
    success: "bg-emerald-950/60 border-emerald-800/60 text-emerald-400",
    not_found: "bg-neutral-900 border-neutral-800 text-neutral-500",
    blocked: "bg-red-950/60 border-red-900/60 text-red-400",
    error: "bg-orange-950/60 border-orange-900/60 text-orange-400",
    skipped: "bg-neutral-900 border-neutral-800 text-neutral-600",
  };

  const icons: Record<SourceStatus, React.ReactNode> = {
    pending: <div className="w-2 h-2 rounded-full border border-neutral-700" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    success: <CheckCircle2 className="w-3 h-3" />,
    not_found: <div className="w-2 h-2 rounded-full bg-neutral-700" />,
    blocked: <AlertTriangle className="w-3 h-3" />,
    error: <AlertTriangle className="w-3 h-3" />,
    skipped: <div className="w-2 h-2 rounded-full bg-neutral-800" />,
  };

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all duration-300 ${styles[status]}`}>
      {icons[status]}
      <span>{label}</span>
    </div>
  );
}

function ResultBadge({ source, isStale }: { source?: string; isStale?: boolean }) {
  if (isStale) {
    return (
      <span className="text-[9px] bg-amber-900/40 text-amber-400 border border-amber-800/50 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        Expiré
      </span>
    );
  }
  if (source === "cache") {
    return (
      <span className="text-[9px] bg-neutral-800 text-neutral-400 border border-neutral-700 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
        <Database className="w-2.5 h-2.5" />
        Cache
      </span>
    );
  }
  if (source === "google_cse") {
    return (
      <span className="text-[9px] bg-blue-900/40 text-blue-400 border border-blue-800/50 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
        <Zap className="w-2.5 h-2.5" />
        Live
      </span>
    );
  }
  if (source?.startsWith("scraper_")) {
    return (
      <span className="text-[9px] bg-purple-900/40 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
        <Wrench className="w-2.5 h-2.5" />
        Scraping
      </span>
    );
  }
  return null;
}

function PriceDisplay({ prix, prix_precedent, internalPrice }: {
  prix: number;
  prix_precedent?: number | null;
  internalPrice?: number | null;
}) {
  const hasDropped = prix_precedent && prix < prix_precedent;
  const hasRisen = prix_precedent && prix > prix_precedent;
  const isCheaper = internalPrice && prix > 0 && prix < internalPrice;

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="text-2xl font-black text-white leading-none tabular-nums">
        {prix.toFixed(2)}€
      </span>

      {prix_precedent && (
        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
          hasDropped
            ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50"
            : "bg-red-900/30 text-red-400 border border-red-900/50"
        }`}>
          {hasDropped ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
          {prix_precedent.toFixed(2)}€
        </span>
      )}

      {isCheaper && (
        <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-md ml-auto animate-pulse">
          MOINS CHER
        </span>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CompareButton({
  ean,
  internalPrice,
  isUnknown,
}: {
  ean: string;
  internalPrice?: number | null;
  isUnknown: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "cache_check" | "searching" | "done">("cache_check");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasStale, setHasStale] = useState(false);
  const [sources, setSources] = useState<SourceState[]>(
    Object.entries(SOURCES_CONFIG).map(([id, c]) => ({
      id,
      label: c.label,
      status: "pending" as SourceStatus,
      count: 0,
    }))
  );
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [clearing, setClearing] = useState(false);
  const streamRef = useRef<EventSource | null>(null);

  // ─── Initialisation : lecture cache au montage ──────────────────────────

  useEffect(() => {
    const checkInitialCache = async () => {
      setPhase("cache_check");
      try {
        const res = await fetch(`/api/cache?ean=${encodeURIComponent(ean)}&stale=1`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            setResults(data.results);
            const anyStale = data.results.some((r: SearchResult) => r.isStale);
            setHasStale(anyStale);
          }
        }
      } catch (err) {
        console.error("Erreur lecture cache initial:", err);
      } finally {
        setPhase("idle");
      }
    };

    checkInitialCache();

    return () => {
      if (streamRef.current) streamRef.current.close();
    };
  }, [ean]);

  // ─── Mise à jour d'une source ────────────────────────────────────────────

  const updateSource = (sourceId: string, updates: Partial<SourceState>) => {
    setSources(prev =>
      prev.map(s => (s.id === sourceId ? { ...s, ...updates } : s))
    );
  };

  // ─── Démarrage de la recherche SSE ──────────────────────────────────────

  const startSearch = (force = false) => {
    setPhase("searching");
    setError(null);
    if (!force) {
      setResults([]);
      setHasStale(false);
    }

    // Reset sources
    setSources(prev => prev.map(s => ({ ...s, status: "pending", count: 0 })));

    if (streamRef.current) streamRef.current.close();

    const url = `/api/search/stream?ean=${encodeURIComponent(ean)}${force ? "&force=1" : ""}`;
    const eventSource = new EventSource(url);
    streamRef.current = eventSource;

    // ── Résultats cache immédiats ─────────────────────────────────────────
    eventSource.addEventListener("cache_hit", (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      if (event.results?.length > 0) {
        setResults(event.results.map((r: SearchResult) => ({
          ...r,
          source: "cache",
          isCached: true,
        })));
        setHasStale(false);
        updateSource("cache", { status: "success", count: event.results.length });
      }
    });

    // ── Source démarre ────────────────────────────────────────────────────
    eventSource.addEventListener("source_start", (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      if (event.source) updateSource(event.source, { status: "running" });
    });

    // ── Résultat live ─────────────────────────────────────────────────────
    eventSource.addEventListener("source_result", (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      if (event.result) {
        setResults(prev => {
          if (prev.some(r => r.enseigne === event.result.enseigne)) return prev;
          return [...prev, event.result];
        });
        if (event.source) {
          setSources(prev =>
            prev.map(s => s.id === event.source
              ? { ...s, count: s.count + 1 }
              : s
            )
          );
        }
      }
    });

    // ── Source terminée ───────────────────────────────────────────────────
    eventSource.addEventListener("source_end", (e: MessageEvent) => {
      const event = JSON.parse(e.data);
      if (event.source) {
        updateSource(event.source, {
          status: event.status as SourceStatus || "not_found",
        });
      }
    });

    // ── Recherche terminée ────────────────────────────────────────────────
    eventSource.addEventListener("done", () => {
      setPhase("done");
      eventSource.close();
    });

    // ── Erreur ───────────────────────────────────────────────────────────
    eventSource.addEventListener("error", (e: MessageEvent) => {
      let msg = "Erreur de connexion.";
      try {
        const data = JSON.parse((e as any).data);
        if (data.message) msg = data.message;
      } catch {}
      setError(msg);
      setPhase("done");
      eventSource.close();
    });
  };

  // ─── Force refresh ────────────────────────────────────────────────────────

  const handleForceRefresh = async () => {
    setClearing(true);
    try {
      await fetch(`/api/cache/clear?ean=${encodeURIComponent(ean)}`, { method: "DELETE" });
      startSearch(true);
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  // ─── Dérivations UI ──────────────────────────────────────────────────────

  const isSearching = phase === "searching";
  const isDone = phase === "done";
  const isIdle = phase === "idle";
  const isCheckingCache = phase === "cache_check";

  const activeSources = sources.filter(s => s.status !== "pending" && s.status !== "skipped");
  const doneSources = sources.filter(s =>
    ["success", "not_found", "blocked", "error", "skipped"].includes(s.status)
  );
  const successSources = sources.filter(s => s.status === "success");

  // ─── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">

      {/* ── Erreur ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-400 text-sm flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Bouton de recherche (idle, pas de résultats frais) ────────────── */}
      {(isIdle || isDone) && !isSearching && (
        <button
          onClick={() => startSearch(false)}
          className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400
                     text-white font-bold py-4 rounded-2xl transition-all duration-200
                     flex items-center justify-center gap-3
                     shadow-[0_0_30px_rgba(220,38,38,0.35)]
                     hover:shadow-[0_0_40px_rgba(220,38,38,0.5)]
                     hover:scale-[1.01] active:scale-[0.99]"
        >
          <Search className="w-5 h-5" />
          {results.length > 0 && !hasStale
            ? "Actualiser les prix"
            : "Rechercher les prix concurrents"}
        </button>
      )}

      {/* ── Skeleton + progression pendant la recherche ─────────────────── */}
      {isSearching && (
        <div className="space-y-3">

          {/* Barre de progression sources */}
          <div className="bg-neutral-950 border border-neutral-800/70 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                Recherche en cours
              </h3>
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                {showSources
                  ? <ChevronUp className="w-4 h-4" />
                  : <ChevronDown className="w-4 h-4" />
                }
              </button>
            </div>

            {/* Sources condensées */}
            <div className="flex flex-wrap gap-1.5">
              {sources.map(s => (
                <SourceBadge key={s.id} source={s.id} status={s.status} />
              ))}
            </div>

            {/* Compteur */}
            {results.length > 0 && (
              <p className="text-xs text-neutral-500 mt-3">
                {results.length} résultat{results.length > 1 ? "s" : ""} trouvé{results.length > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Skeletons si pas encore de résultats */}
          {results.length === 0 && (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}
        </div>
      )}

      {/* ── Résultats ────────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div>
          {/* Header résultats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">
                {results.length} prix trouvé{results.length > 1 ? "s" : ""}
              </h3>
              {hasStale && (
                <span className="text-[9px] bg-amber-900/30 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded-md font-bold uppercase">
                  Anciens résultats
                </span>
              )}
            </div>

            {/* Actions */}
            {(isDone || (!isSearching && results.length > 0)) && (
              <button
                onClick={handleForceRefresh}
                disabled={clearing || isSearching}
                className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400
                           hover:text-white hover:border-neutral-700 rounded-xl transition-all"
                title="Forcer l'actualisation"
              >
                <RefreshCw className={`w-4 h-4 ${clearing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {/* Cards résultats */}
          <div className="space-y-3">
            {results.map((res, i) => {
              const prix = res.prix ?? 0;
              const color = getEnseigneColor(res.enseigne);

              return (
                <a
                  key={`${res.enseigne}-${i}`}
                  href={res.lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    animationFillMode: "both",
                  }}
                  className="group bg-[#0e0e0e] rounded-2xl p-3.5 border border-neutral-800/70
                             flex gap-3.5 items-start
                             hover:border-neutral-700 hover:bg-[#141414]
                             transition-all duration-200
                             animate-in fade-in slide-in-from-bottom-3"
                >
                  {/* Logo enseigne */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0
                               text-xl font-black border"
                    style={{
                      backgroundColor: `${color}20`,
                      borderColor: `${color}40`,
                      color,
                    }}
                  >
                    {res.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={res.image_url}
                        alt={res.enseigne}
                        className="w-full h-full object-contain rounded-xl p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      res.enseigne.charAt(0)
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    {/* Enseigne + badges */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-bold uppercase tracking-wider"
                            style={{ color }}>
                        {res.enseigne}
                      </span>
                      <ResultBadge source={res.source} isStale={res.isStale} />
                    </div>

                    {/* Titre produit */}
                    <p className="text-white text-sm font-medium leading-snug line-clamp-2 mb-1">
                      {res.titre || "Produit"}
                    </p>

                    {/* Prix */}
                    {prix > 0 ? (
                      <PriceDisplay
                        prix={prix}
                        prix_precedent={res.prix_precedent}
                        internalPrice={internalPrice}
                      />
                    ) : (
                      <p className="text-sm text-neutral-500 mt-2">Prix non affiché</p>
                    )}
                  </div>

                  {/* Icône lien externe */}
                  <ExternalLink className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 transition-colors flex-shrink-0 mt-1" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Aucun résultat après recherche ─────────────────────────────── */}
      {isDone && results.length === 0 && !isSearching && (
        <div className="p-6 bg-neutral-950 rounded-2xl border border-neutral-800/50 text-center">
          <AlertTriangle className="w-8 h-8 text-yellow-500/50 mx-auto mb-3" />
          <p className="text-white text-sm font-semibold mb-1">Aucun prix trouvé</p>
          <p className="text-neutral-500 text-xs">
            Essayez d'actualiser ou vérifiez votre connexion.
          </p>
        </div>
      )}

      {/* ── Info résultats stale ─────────────────────────────────────────── */}
      {isIdle && hasStale && results.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-xs text-amber-400">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>Ces résultats sont anciens. Lancez une recherche pour les actualiser.</span>
        </div>
      )}
    </div>
  );
}
