import { supabase } from "@/lib/supabase";
import { Clock } from "lucide-react";
import HistoriqueClient, {
  type ProduitHistorique,
} from "./HistoriqueClient";
import ToastContainer from "@/components/Toast";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * Récupère les produits avec leurs données de cache agrégées.
 * Join : produits ← cache_prix (1:N)
 */
async function fetchHistorique(): Promise<{
  produits: ProduitHistorique[];
  error: string | null;
}> {
  try {
    // ── 1. Récupérer tous les produits, created_at optionnel ───────────────
    // On tente d'abord avec created_at (si la migration a été appliquée),
    // sinon on replie sur un tri par numero_ean.
    let rawProduits: any[] | null = null;
    let prodError: any = null;

    const withDate = await supabase
      .from("produits")
      .select(
        "numero_ean, description_produit, marque, prix_vente, devise, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (withDate.error?.code === "42703") {
      // Colonne created_at absente — migration pas encore appliquée
      console.warn(
        "[Historique] created_at absent sur produits — utilisez migration_historique.sql"
      );
      const fallback = await supabase
        .from("produits")
        .select(
          "numero_ean, description_produit, marque, prix_vente, devise"
        )
        .order("numero_ean", { ascending: false })
        .limit(500);
      rawProduits = fallback.data;
      prodError = fallback.error;
    } else {
      rawProduits = withDate.data;
      prodError = withDate.error;
    }

    if (prodError) {
      console.error("[Historique] Erreur fetch produits:", prodError);
      return { produits: [], error: prodError.message };
    }

    if (!rawProduits || rawProduits.length === 0) {
      return { produits: [], error: null };
    }

    // ── 2. Récupérer les données du cache pour tous ces EANs ───────────────
    const eans = rawProduits.map((p) => p.numero_ean);

    const { data: cacheData, error: cacheError } = await supabase
      .from("cache_prix")
      .select("ean, enseigne, prix, updated_at")
      .in("ean", eans);

    if (cacheError) {
      // Non bloquant : on continue sans les données de cache
      console.warn("[Historique] Avertissement fetch cache_prix:", cacheError.message);
    }

    // ── 3. Agréger les données de cache par EAN ────────────────────────────
    type CacheEntry = { ean: string; enseigne: string; prix: number | null; updated_at: string };
    
    const cacheByEan = new Map<string, CacheEntry[]>();
    if (cacheData) {
      for (const row of cacheData as CacheEntry[]) {
        if (!cacheByEan.has(row.ean)) cacheByEan.set(row.ean, []);
        cacheByEan.get(row.ean)!.push(row);
      }
    }

    // ── 4. Construire les objets ProduitHistorique ────────────────────────
    const produits: ProduitHistorique[] = rawProduits.map((p) => {
      const cacheEntries = cacheByEan.get(p.numero_ean) ?? [];

      const enseignes = [
        ...new Set(
          cacheEntries
            .filter((c) => c.enseigne)
            .map((c) => c.enseigne)
        ),
      ];

      const prixValides = cacheEntries
        .map((c) => c.prix)
        .filter((px): px is number => typeof px === "number" && px > 0);

      const meilleur_prix_concurrent =
        prixValides.length > 0 ? Math.min(...prixValides) : null;

      const derniere_maj_cache =
        cacheEntries.length > 0
          ? cacheEntries.reduce((latest, c) =>
              !latest.updated_at ||
              new Date(c.updated_at) > new Date(latest.updated_at)
                ? c
                : latest
            ).updated_at
          : null;

      return {
        numero_ean: p.numero_ean,
        description_produit: p.description_produit ?? null,
        marque: p.marque ?? null,
        prix_vente: p.prix_vente !== null && p.prix_vente !== undefined
          ? Number(p.prix_vente)
          : null,
        devise: p.devise ?? "€",
        created_at: p.created_at ?? null,
        enseignes,
        meilleur_prix_concurrent,
        derniere_maj_cache,
      };
    });

    console.log(`[Historique] ✅ ${produits.length} produits chargés`);
    return { produits, error: null };

  } catch (err: any) {
    console.error("[Historique] Exception inattendue:", err);
    return {
      produits: [],
      error: err.message || "Erreur technique inattendue",
    };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HistoriquePage() {
  const { produits, error } = await fetchHistorique();

  return (
    <div className="p-4 sm:p-6 min-h-screen flex flex-col pt-8 animate-in fade-in bg-[#0a0a0c]">
      {/* ── En-tête ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-none">
            Historique
          </h1>
          <p className="text-neutral-500 text-xs mt-0.5">
            Produits scannés récemment
          </p>
        </div>
      </div>

      {/* ── Erreur Supabase (non bloquant) ─────────────────────────────── */}
      {error && (
        <div className="mb-5 p-4 bg-red-950/40 border border-red-800/50 rounded-2xl">
          <p className="text-red-400 text-xs font-semibold mb-1">
            Impossible de charger l'historique
          </p>
          <p className="text-red-500/80 text-[11px] font-mono break-all">
            {error}
          </p>
        </div>
      )}

      {/* ── Client interactif ──────────────────────────────────────────── */}
      <HistoriqueClient initialProduits={produits} />

      {/* ── Toast container (portal) ───────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}
