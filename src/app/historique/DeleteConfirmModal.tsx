"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";

interface Props {
  ean: string;
  productName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  ean,
  productName,
  isDeleting,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus sur le bouton Annuler à l'ouverture (accessibility)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel, isDeleting]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={isDeleting ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {/* Icône */}
        <div className="w-14 h-14 bg-red-900/20 border border-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>

        {/* Titre */}
        <h2
          id="delete-dialog-title"
          className="text-white font-bold text-lg text-center mb-2"
        >
          Supprimer ce produit ?
        </h2>

        {/* Produit concerné */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 mb-4">
          <p className="text-white text-sm font-medium line-clamp-2 mb-1">
            {productName || "Produit sans désignation"}
          </p>
          <p className="text-neutral-500 text-xs font-mono">EAN : {ean}</p>
        </div>

        <p className="text-neutral-400 text-sm text-center mb-6 leading-relaxed">
          Le produit et tous ses prix comparatifs seront définitivement supprimés.
          <span className="text-red-400 font-semibold"> Cette action est irréversible.</span>
        </p>

        {/* Boutons */}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3.5 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 font-bold
                       hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-40 active:scale-95"
          >
            Annuler
          </button>

          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-bold
                       hover:bg-red-500 transition-all disabled:opacity-60 active:scale-95
                       flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Supprimer
              </>
            )}
          </button>
        </div>

        {/* Bouton fermer (coin) */}
        {!isDeleting && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-neutral-600 hover:text-neutral-300 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
