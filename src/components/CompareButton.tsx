"use client";

import { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Search,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  TrendingDown,
  TrendingUp,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronUp,
  Tag,
  Link2,
  PenLine,
  Trash2,
} from "lucide-react";

import { Product, PriceLog } from "@/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  enseigne: string;
  titre: string;
  prix: number | null;
  prix_status?: "detected" | "not_found" | "manual";
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

const SOURCES_CONFIG: Record<string, { label: string }> = {
  cache: { label: "Cache" },
  google_cse: { label: "Google Web" },
  scraper_123elec: { label: "123elec" },
  scraper_manomano: { label: "ManoMano" },
  scraper_bricozor: { label: "Bricozor" },
  scraper_amazon: { label: "Amazon" },
};

// ─── Couleurs par enseigne ────────────────────────────────────────────────────

const ENSEIGNE_COLORS: Record<string, string> = {
  "Amazon": "#FF9900",
  "ManoMano": "#00A88F",
  "123elec": "#E63946",
  "Bricozor": "#2563EB",
  "Leroy Merlin": "#78AF00",
  "Castorama": "#FF6B00",
  "Brico Dépôt": "#FFA500",
  "Cdiscount": "#E2001A",
  "Darty": "#E3001B",
  "Fnac": "#F7941D",
};

function getEnseigneColor(enseigne: string): string {
  return ENSEIGNE_COLORS[enseigne] || "#6B7280";
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#111] rounded-2xl p-4 border border-neutral-800/60 flex gap-3 items-center animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-neutral-800 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-neutral-800 rounded w-20" />
        <div className="h-4 bg-neutral-800 rounded w-full" />
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

function PriceDisplay({ prix, prix_precedent, internalPrice }: {
  prix: number;
  prix_precedent?: number | null;
  internalPrice?: number | null;
}) {
  const hasDropped = prix_precedent && prix < prix_precedent;
  const isCheaper = internalPrice && prix > 0 && prix < internalPrice;

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className="text-xl font-black text-white leading-none tabular-nums">
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

// ─── Carte de veille manuelle (Remplace LinkOnlyCard et PriceResultCard) ──────

function ManualVeilleCard({ res, index, ean, internalPrice, releveId, onDelete }: {
  res: SearchResult;
  index: number;
  ean: string;
  internalPrice?: number | null;
  releveId?: string;
  onDelete?: (id: string) => void;
}) {
  // Initialiser avec le prix existant si présent (conversion string pour l'input)
  const [prix, setPrix] = useState<string>(res.prix != null ? res.prix.toString() : "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const color = getEnseigneColor(res.enseigne);

  // Log d'affichage initial
  if (res.prix) {
    console.log(`[RELEVE DISPLAY DATA] ${res.enseigne}: ${res.prix}€`);
  }

  const handleSave = async () => {
    if (!prix || isNaN(parseFloat(prix))) return;
    const payload = {
      ean,
      enseigne: res.enseigne,
      url: res.lien,
      prix_constate: prix,
      designation_originale: res.titre
    };

    console.log("[RELEVE SAVE PAYLOAD] Sending:", payload);

    try {
      const response = await fetch("/api/releves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[RELEVE SAVED] Succès pour ${res.enseigne} (${prix}€)`);
        
        // Journaliser l'activité
        await fetch("/api/activites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type_action: releveId ? "modification_releve" : "ajout_releve",
            ean,
            details: {
              enseigne: res.enseigne,
              prix: parseFloat(prix),
              designation: res.titre
            }
          }),
        }).catch(err => console.error("Erreur log activite:", err));

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error("Erreur sauvegarde relevé:", err);
    } finally {
      setLoading(false);
    }
  };

    const currentConcurrentPrice = parseFloat(prix);
    const hasPrice = !isNaN(currentConcurrentPrice) && currentConcurrentPrice > 0;
    const diff = internalPrice && hasPrice ? internalPrice - currentConcurrentPrice : null;
    const isAligned = diff !== null && Math.abs(diff) < 0.5;

    return (
    <div
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
      className="bg-[#0e0e0e] rounded-2xl p-4 border border-neutral-800/70
                 animate-in fade-in slide-in-from-bottom-2 space-y-4"
    >
      {/* Positionnement Prix (Si prix saisi) */}
      {hasPrice && internalPrice && (
        <div className="animate-in zoom-in-95 duration-300">
          {isAligned ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-[11px] font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Prix aligné (écart {Math.abs(diff!).toFixed(2)}€)
            </div>
          ) : diff! < 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-500 text-[11px] font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              🟢 {Math.abs(diff!).toFixed(2)}€ moins cher
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[11px] font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              🔴 {Math.abs(diff!).toFixed(2)}€ plus cher
            </div>
          )}
        </div>
      )}
      {/* En-tête : Enseigne et Titre */}
      <div className="flex gap-3 items-start">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black border"
          style={{
            backgroundColor: `${color}18`,
            borderColor: `${color}35`,
            color,
          }}
        >
          {res.enseigne.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider block mb-0.5" style={{ color }}>
            {res.enseigne}
          </span>
          <p className="text-white/80 text-xs leading-snug line-clamp-2">
            {res.titre || "Produit"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={res.lien}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500
                       hover:text-white hover:border-neutral-700 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {releveId && onDelete && (
            <button
              onClick={() => {
                if (confirm("Supprimer ce relevé ?")) {
                  onDelete(releveId);
                }
              }}
              className="p-2 bg-red-900/10 border border-red-900/20 rounded-xl text-red-500/60
                         hover:text-red-500 hover:bg-red-900/20 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Zone d'action : Saisie du prix */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            step="0.01"
            placeholder="Prix constaté..."
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm
                       focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none
                       transition-all text-white placeholder:text-neutral-700"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 text-xs font-bold">
            €
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading || !prix}
          className={`px-5 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2
                     ${saved 
                       ? "bg-emerald-600 text-white" 
                       : "bg-white text-black hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white"}`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            "Enregistrer"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CompareButton({
  ean,
  internalPrice,
  isUnknown,
  onManualPriceClick,
  produit,
}: {
  ean: string;
  internalPrice?: number | null;
  isUnknown: boolean;
  onManualPriceClick?: (enseigne: string, lien: string, titre: string) => void;
  produit?: Product | null;
}) {
  const [phase, setPhase] = useState<"idle" | "cache_check" | "done">("cache_check");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [releves, setReleves] = useState<PriceLog[]>([]);
  
  // ─── Initialisation : chargement des données ────────────────────────────

  useEffect(() => {
    if (ean) {
      localStorage.setItem("vigi_current_ean", ean);
    }

    const fetchData = async () => {
      setPhase("cache_check");
      try {
        const [resCache, resReleves] = await Promise.all([
          fetch(`/api/cache?ean=${encodeURIComponent(ean)}&stale=1`),
          fetch(`/api/releves?ean=${encodeURIComponent(ean)}`)
        ]);

        if (resCache.ok) {
          const data = await resCache.json();
          if (data.results) setResults(data.results);
        }

        if (resReleves.ok) {
          const data = await resReleves.json();
          if (data.results) setReleves(data.results);
        }
      } catch (err) {
        console.error("Erreur chargement données initiales:", err);
      } finally {
        setPhase("done");
      }
    };

    fetchData();
  }, [ean]);

  const searchDesignation = `${produit?.description_produit || ""} ${produit?.marque || ""}`.trim();

  const handleDeleteReleve = async (id: string) => {
    try {
      const res = await fetch(`/api/releves?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        // Récupérer le relevé avant de le supprimer pour le log (optionnel, ici on a l'EAN dans les props du parent)
        await fetch("/api/activites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type_action: "suppression_releve",
            ean,
            details: { id }
          }),
        }).catch(err => console.error("Erreur log activite:", err));

        setReleves(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error("Erreur suppression relevé:", err);
    }
  };

  return (
    <div className="w-full space-y-6">

      {/* ── Actions de Recherche Google ────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(ean)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl 
                     transition-all duration-200 flex items-center justify-center gap-3
                     shadow-[0_4px_20px_rgba(220,38,38,0.3)] active:scale-[0.98]"
        >
          <Search className="w-5 h-5" />
          RECHERCHE GOOGLE EAN
        </a>

        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(searchDesignation)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-neutral-900 border border-neutral-800 hover:border-red-600/50 
                     text-white font-black py-4 rounded-2xl transition-all duration-200
                     flex items-center justify-center gap-3 active:scale-[0.98]"
        >
          <Search className="w-5 h-5 text-red-600" />
          RECHERCHE GOOGLE DÉSIGNATION
        </a>
      </div>

      {/* ── Relevés Manuels (Historique Terrain) ─────────────────────────── */}
      {releves.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1 px-1">
            <h3 className="text-sm font-black text-emerald-500 uppercase tracking-wider">Relevés Terrain</h3>
            <span className="text-[10px] bg-emerald-900/30 text-emerald-500 px-1.5 py-0.5 rounded-md border border-emerald-800/50 font-mono">
              {releves.length}
            </span>
          </div>
          
          <div className="space-y-3">
            {releves.map((rel, i) => (
              <ManualVeilleCard
                key={rel.id}
                res={{
                  enseigne: rel.enseigne,
                  titre: rel.designation_originale,
                  lien: rel.url,
                  prix: rel.prix_constate,
                  source: "releve_manuel"
                }}
                index={i}
                ean={ean}
                internalPrice={internalPrice}
                releveId={rel.id}
                onDelete={handleDeleteReleve}
              />
            ))}
          </div>
          <div className="h-px bg-neutral-900 my-6" />
        </div>
      )}

      {/* ── Résultats de discovery (Cache existant) ────────────────────────── */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1 px-1">
            <h3 className="text-sm font-bold text-white opacity-60">Liens suggérés (Historique web)</h3>
            <span className="text-[10px] bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded font-mono">
              {results.length}
            </span>
          </div>
          
          <div className="space-y-3">
            {results.map((res, i) => (
              <ManualVeilleCard
                key={res.lien}
                res={res}
                index={i}
                ean={ean}
                internalPrice={internalPrice}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
