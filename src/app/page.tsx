import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Search, ScanBarcode, Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Home() {
  // Récupérer les derniers scans (historique)
  let uniqueRecents: any[] = [];
  
  try {
    const { data: recents, error } = await supabase
      .from("cache_prix")
      .select("ean, titre, prix, enseigne, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Erreur chargement historique:", error);
    } else if (recents) {
      // Dédupliquer par EAN pour n'afficher que les produits distincts
      uniqueRecents = Array.from(new Map(recents.map(item => [item.ean, item])).values()).slice(0, 3);
    }
  } catch (err) {
    console.error("Exception inattendue chargement historique:", err);
  }

  return (
    <main className="p-4 sm:p-6 min-h-full flex flex-col">
      {/* Header Mobile */}
      <header className="mb-8 pt-4">
        <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
          Vigi<span className="text-red-600">prix</span>
        </h1>
        <p className="text-neutral-400 text-sm mt-1">Veille concurrentielle en magasin</p>
      </header>

      {/* Barre de recherche (Fake, renvoie vers /produits) */}
      <Link href="/produits" className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3 mb-8 hover:bg-neutral-800 transition-colors">
        <Search className="w-6 h-6 text-neutral-500" />
        <span className="text-neutral-400 text-lg">Chercher dans mon catalogue...</span>
      </Link>

      {/* Raccourci Scan Principal */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-b from-red-900/10 to-transparent rounded-3xl border border-red-900/20 mb-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-4 shadow-[0_0_40px_rgba(220,38,38,0.4)] group-hover:scale-105 transition-transform duration-300">
            <ScanBarcode className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Scanner un produit</h2>
          <p className="text-neutral-400 text-center px-4 max-w-xs text-sm">
            Scannez le code-barres en rayon pour obtenir les prix concurrents immédiatement.
          </p>
        </div>
        {/* On peut mettre un link vers # car le scan est géré par la BottomNav, mais on pourrait aussi faire un state global ou juste indiquer de cliquer en bas */}
        <p className="mt-6 text-xs font-bold text-red-500 uppercase tracking-wider">↓ Utilisez le bouton central ↓</p>
      </div>

      {/* Historique Récent */}
      <div className="mb-4">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-500" /> Scans récents
          </h3>
          <Link href="/historique" className="text-sm font-bold text-red-500 hover:text-red-400 flex items-center">
            Voir tout <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        {uniqueRecents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {uniqueRecents.map((item, i) => (
              <Link key={i} href={`/produit/${item.ean}`} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4 items-center hover:bg-neutral-800 transition-colors">
                <div className="w-12 h-12 bg-black rounded-xl border border-neutral-800 flex items-center justify-center flex-shrink-0">
                  <PackageIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{item.titre}</h4>
                  <p className="text-xs text-neutral-500 truncate">EAN: {item.ean}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-white font-bold block">{item.prix} €</span>
                  <span className="text-[10px] text-neutral-500">{item.enseigne}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center">
            <p className="text-neutral-500 text-sm">Aucun scan récent pour le moment.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function PackageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
      <path d="M16.5 9.4 7.5 4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
