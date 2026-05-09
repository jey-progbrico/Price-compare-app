"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, RefreshCcw, Home } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // On pourrait logguer l'erreur vers un service externe ici
    console.error("Erreur Application:", error);
  }, [error]);

  return (
    <main className="p-4 sm:p-6 min-h-[80vh] flex flex-col items-center justify-center text-center animate-in fade-in">
      <div className="w-20 h-20 bg-red-900/20 border border-red-900/50 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
        <AlertOctagon className="w-10 h-10 text-red-500" />
      </div>
      
      <h1 className="text-2xl font-black text-white mb-2">Un problème est survenu</h1>
      <p className="text-neutral-400 mb-2 max-w-xs text-sm">
        Une erreur inattendue empêche l'affichage de cette page.
      </p>
      
      {/* Code d'erreur optionnel caché derrière un detail pour ne pas effrayer */}
      <details className="mb-8 text-[10px] text-neutral-600 font-mono text-left max-w-xs mx-auto">
        <summary className="cursor-pointer hover:text-neutral-400">Voir les détails de l'erreur</summary>
        <p className="mt-2 p-2 bg-black border border-neutral-800 rounded-lg whitespace-pre-wrap">
          {error.message || "Erreur inconnue"}
        </p>
      </details>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button 
          onClick={() => reset()}
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCcw className="w-5 h-5" />
          Réessayer
        </button>
        <Link 
          href="/" 
          className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3 px-6 border border-neutral-800 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
