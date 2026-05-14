"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Trash2,
  Clock,
  ArrowRight,
  ScanBarcode,
  Package,
  Store,
  ChevronDown,
  X,
} from "lucide-react";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { showToast } from "@/components/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProduitHistorique {
  numero_ean: string;
  description_produit: string | null;
  marque: string | null;
  prix_vente: number | null;
  devise: string | null;
  created_at: string | null;
  // Données jointes depuis cache_prix
  meilleur_prix_concurrent: number | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Date inconnue";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Date invalide";
  }
}

function PriceComparison({
  monPrix,
  meilleurConcurrent,
  devise,
}: {
  monPrix: number | null;
  meilleurConcurrent: number | null;
  devise: string | null;
}) {
  if (!monPrix && !meilleurConcurrent) {
    return <span className="text-xs text-neutral-600 italic">Aucun prix</span>;
  }

  const d = devise || "€";
  const diff =
    monPrix && meilleurConcurrent ? monPrix - meilleurConcurrent : null;
  const isCheaperElsewhere = diff !== null && diff > 0;

  return (
    <div className="flex items-end gap-3 flex-wrap">
      {monPrix ? (
        <div className="text-right">
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
            Mon Prix
          </span>
          <span className="text-lg font-black text-white leading-none">
            {Number(monPrix).toFixed(2)}{d}
          </span>
        </div>
      ) : null}

      {meilleurConcurrent ? (
        <div className="text-right">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
            Concurrent
          </span>
          <span
            className={`text-lg font-black leading-none ${
              isCheaperElsewhere ? "text-emerald-400" : "text-neutral-300"
            }`}
          >
            {Number(meilleurConcurrent).toFixed(2)}{d}
          </span>
        </div>
      ) : null}

      {isCheaperElsewhere && diff !== null && (
        <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded-lg font-bold">
          -{diff.toFixed(2)}{d}
        </span>
      )}
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800/50 rounded-2xl p-4 animate-pulse">
      <div className="flex justify-between items-start mb-3">
        <div className="h-3 bg-neutral-800 rounded w-28" />
        <div className="h-3 bg-neutral-800 rounded w-16" />
      </div>
      <div className="h-4 bg-neutral-800 rounded w-3/4 mb-2" />
      <div className="h-3 bg-neutral-800 rounded w-24 mb-3" />
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-800/50">
        <div className="h-3 bg-neutral-800 rounded w-20" />
        <div className="h-7 bg-neutral-800 rounded w-20" />
      </div>
    </div>
  );
}

// ─── Composant Principal ──────────────────────────────────────────────────────

interface Props {
  initialProduits: ProduitHistorique[];
}

export default function HistoriqueClient({ initialProduits }: Props) {
  const [produits, setProduits] = useState<ProduitHistorique[]>(initialProduits);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [toDelete, setToDelete] = useState<ProduitHistorique | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return produits;
    return produits.filter(
      (p) =>
        (p.description_produit?.toLowerCase().includes(q)) ||
        (p.numero_ean?.includes(q)) ||
        (p.marque?.toLowerCase().includes(q))
    );
  }, [produits, query]);

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const hasMore = filtered.length > visibleCount;

  // ── Suppression ───────────────────────────────────────────────────────────

  const handleDeleteConfirm = useCallback(async () => {
    if (!toDelete) return;
    setIsDeleting(true);

    // Optimistic update
    const previousProduits = produits;
    setProduits((prev) =>
      prev.filter((p) => p.numero_ean !== toDelete.numero_ean)
    );
    setToDelete(null);

    try {
      const res = await fetch(
        `/api/produits/${encodeURIComponent(toDelete.numero_ean)}`,
        { method: "DELETE" }
      );

      if (res.status === 204 || res.ok) {
        showToast(`"${toDelete.description_produit || toDelete.numero_ean}" supprimé.`, "success");
      } else {
        // Rollback
        let errMsg = "Erreur lors de la suppression";
        try {
          const body = await res.json();
          if (body.error) errMsg = body.error;
        } catch {}
        setProduits(previousProduits);
        showToast(errMsg, "error");
      }
    } catch (err: any) {
      // Rollback réseau
      setProduits(previousProduits);
      showToast(err.message || "Erreur réseau", "error");
      console.error("[HistoriqueClient] Erreur suppression:", err);
    } finally {
      setIsDeleting(false);
    }
  }, [toDelete, produits]);

  const handleDeleteCancel = useCallback(() => {
    if (!isDeleting) setToDelete(null);
  }, [isDeleting]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Barre de recherche ──────────────────────────────────────────── */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-neutral-500" />
        </div>
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(PAGE_SIZE); // Reset pagination on search
          }}
          placeholder="Rechercher par nom, marque ou EAN…"
          autoComplete="off"
          className="w-full pl-12 pr-10 py-3.5 bg-neutral-900 border border-neutral-800
                     rounded-2xl text-white placeholder-neutral-600 text-sm
                     focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50
                     transition-all"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setVisibleCount(PAGE_SIZE); searchRef.current?.focus(); }}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-500 hover:text-white transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Compteur ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-500">
          {filtered.length} produit{filtered.length !== 1 ? "s" : ""}
          {query && ` pour "${query}"`}
        </p>
      </div>

      {/* ── Liste vide ──────────────────────────────────────────────────── */}
      {produits.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center mb-5">
            <ScanBarcode className="w-10 h-10 text-neutral-600" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Aucun produit scanné</h3>
          <p className="text-neutral-500 text-sm max-w-xs leading-relaxed">
            Scannez votre premier code-barres pour commencer votre veille tarifaire.
          </p>
        </div>
      )}

      {/* ── Aucun résultat de recherche ──────────────────────────────────── */}
      {produits.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center">
          <Package className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">
            Aucun résultat pour <span className="font-bold text-white">"{query}"</span>
          </p>
          <button
            onClick={() => setQuery("")}
            className="mt-3 text-red-500 text-sm hover:text-red-400 underline"
          >
            Effacer la recherche
          </button>
        </div>
      )}

      {/* ── Cartes produits ─────────────────────────────────────────────── */}
      {visible.length > 0 && (
        <div className="flex flex-col gap-3">
          {visible.map((produit) => (
            <ProductCard
              key={produit.numero_ean}
              produit={produit}
              onDeleteRequest={() => setToDelete(produit)}
            />
          ))}

          {/* ── Bouton "Voir plus" ──────────────────────────────────────── */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="w-full py-4 mt-1 bg-neutral-900 border border-neutral-800 rounded-2xl
                         text-neutral-400 text-sm font-medium hover:bg-neutral-800 hover:text-white
                         transition-all flex items-center justify-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              Voir plus ({filtered.length - visibleCount} restant{filtered.length - visibleCount > 1 ? "s" : ""})
            </button>
          )}
        </div>
      )}

      {/* ── Modal de confirmation ────────────────────────────────────────── */}
      {toDelete && (
        <DeleteConfirmModal
          ean={toDelete.numero_ean}
          productName={toDelete.description_produit || toDelete.numero_ean}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  );
}

// ─── Carte Produit ────────────────────────────────────────────────────────────

function ProductCard({
  produit,
  onDeleteRequest,
}: {
  produit: ProduitHistorique;
  onDeleteRequest: () => void;
}) {
  return (
    <div
      className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4
                 hover:border-neutral-700 transition-all duration-200 group"
    >
      {/* ── Ligne 1 : date + bouton supprimer ──────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-neutral-600">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium">
            {formatDate(produit.created_at)}
          </span>
        </div>
        <button
          onClick={onDeleteRequest}
          className="p-2 rounded-xl text-neutral-600 hover:text-red-500 hover:bg-red-900/20
                     transition-all active:scale-95"
          title="Supprimer ce produit"
          aria-label={`Supprimer ${produit.description_produit || produit.numero_ean}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── Ligne 2 : nom produit ──────────────────────────────────────── */}
      <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-1.5">
        {produit.description_produit || (
          <span className="text-neutral-500 italic">Sans désignation</span>
        )}
      </h3>

      {/* ── Ligne 3 : marque + EAN ────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        {produit.marque && (
          <span className="text-[10px] font-bold bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-lg uppercase tracking-wider">
            {produit.marque}
          </span>
        )}
        <span className="text-[10px] text-neutral-600 font-mono">
          {produit.numero_ean}
        </span>
      </div>

      {/* ── Séparateur ────────────────────────────────────────────────── */}
      <div className="border-t border-neutral-800/70 pt-3 mt-1">
        <div className="flex items-end justify-between gap-2">
          {/* Enseignes trouvées */}
          <div className="flex-1 min-w-0">
            {!produit.meilleur_prix_concurrent && (
              <span className="text-[10px] text-neutral-700 italic">
                Aucun relevé concurrent
              </span>
            )}
          </div>

          {/* Prix */}
          <div className="flex-shrink-0">
            <PriceComparison
              monPrix={produit.prix_vente}
              meilleurConcurrent={produit.meilleur_prix_concurrent}
              devise={produit.devise}
            />
          </div>
        </div>

        {/* Lien vers la page produit */}
        <Link
          href={`/produit/${produit.numero_ean}`}
          className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                     bg-neutral-800/60 border border-neutral-700/50 text-neutral-400 text-xs font-medium
                     hover:bg-neutral-800 hover:text-white hover:border-neutral-600 transition-all"
        >
          Voir le produit
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
