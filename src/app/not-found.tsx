import Link from "next/link";
import { Search, Home, FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main className="p-4 sm:p-6 min-h-[80vh] flex flex-col items-center justify-center text-center animate-in fade-in">
      <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center mb-6 shadow-xl">
        <FileQuestion className="w-10 h-10 text-neutral-500" />
      </div>
      
      <h1 className="text-3xl font-black text-white mb-2">Oups... 404</h1>
      <p className="text-neutral-400 mb-8 max-w-xs">
        La page ou le produit que vous cherchez n'existe pas ou a été déplacé.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link 
          href="/" 
          className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Retour à l'accueil
        </Link>
        <Link 
          href="/produits" 
          className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3 px-6 border border-neutral-800 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Search className="w-5 h-5" />
          Chercher un produit
        </Link>
      </div>
    </main>
  );
}
