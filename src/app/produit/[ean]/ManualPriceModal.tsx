"use client";

import { useState } from "react";
import { X, PenLine, ExternalLink, Check, Loader2, AlertTriangle } from "lucide-react";

interface ManualPriceModalProps {
  ean: string;
  isOpen: boolean;
  initialEnseigne?: string;
  initialLien?: string;
  initialTitre?: string;
  onClose: () => void;
  onSuccess: (enseigne: string, prix: number) => void;
}

export default function ManualPriceModal({
  ean,
  isOpen,
  initialEnseigne = "",
  initialLien = "",
  initialTitre = "",
  onClose,
  onSuccess,
}: ManualPriceModalProps) {
  const [enseigne, setEnseigne] = useState(initialEnseigne);
  const [lien, setLien] = useState(initialLien);
  const [titre, setTitre] = useState(initialTitre);
  const [prixStr, setPrixStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens with new data
  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const prix = parseFloat(prixStr.replace(",", "."));
    if (!enseigne.trim()) {
      setError("Veuillez saisir le nom du marchand.");
      return;
    }
    if (!lien.trim() || !lien.startsWith("http")) {
      setError("Veuillez saisir une URL valide (commençant par http).");
      return;
    }
    if (isNaN(prix) || prix <= 0) {
      setError("Veuillez saisir un prix valide.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/price-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ean, enseigne: enseigne.trim(), lien: lien.trim(), prix, titre: titre.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        return;
      }

      setSuccess(true);
      onSuccess(enseigne.trim(), prix);
      setTimeout(() => {
        setSuccess(false);
        setPrixStr("");
        onClose();
      }, 1200);
    } catch (err: any) {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#111] border border-neutral-800 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-950/60 border border-violet-800/50 flex items-center justify-center">
              <PenLine className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Ajouter un prix</h2>
              <p className="text-[10px] text-neutral-500">Saisie manuelle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-600 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Nom du marchand */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Nom du marchand *
            </label>
            <input
              type="text"
              value={enseigne}
              onChange={(e) => setEnseigne(e.target.value)}
              placeholder="ex : Leroy Merlin"
              className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl px-3 py-2.5
                         placeholder:text-neutral-600 focus:outline-none focus:border-violet-700 transition-colors"
              required
            />
          </div>

          {/* Lien produit */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Lien produit *
            </label>
            <div className="relative">
              <input
                type="url"
                value={lien}
                onChange={(e) => setLien(e.target.value)}
                placeholder="https://..."
                className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl px-3 py-2.5 pr-8
                           placeholder:text-neutral-600 focus:outline-none focus:border-violet-700 transition-colors"
                required
              />
              {lien.startsWith("http") && (
                <a
                  href={lien}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Prix */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Prix (€) *
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={prixStr}
                onChange={(e) => setPrixStr(e.target.value)}
                placeholder="0.00"
                className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl px-3 py-2.5 pr-8
                           placeholder:text-neutral-600 focus:outline-none focus:border-violet-700 transition-colors tabular-nums"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-bold">€</span>
            </div>
          </div>

          {/* Titre (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5">
              Désignation produit <span className="text-neutral-600 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="ex : Perceuse visseuse 18V..."
              className="w-full bg-neutral-900 border border-neutral-800 text-white text-sm rounded-xl px-3 py-2.5
                         placeholder:text-neutral-600 focus:outline-none focus:border-violet-700 transition-colors"
            />
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Bouton submit */}
          <button
            type="submit"
            disabled={loading || success}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
              success
                ? "bg-emerald-600 text-white"
                : "bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60"
            }`}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
            ) : success ? (
              <><Check className="w-4 h-4" /> Prix enregistré !</>
            ) : (
              <><PenLine className="w-4 h-4" /> Enregistrer le prix</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
