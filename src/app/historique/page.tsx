import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function HistoriquePage() {
  let uniqueRecents: any[] = [];
  let supabaseError = null;
  
  try {
    const { data: recents, error } = await supabase
      .from("cache_prix")
      .select("ean, titre, prix, enseigne, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erreur historique:", error);
      supabaseError = error.message;
    } else if (recents) {
      // Dédupliquer par EAN
      uniqueRecents = Array.from(new Map(recents.map(item => [item.ean, item])).values());
    }
  } catch (err: any) {
    console.error("Exception historique:", err);
    supabaseError = err.message || "Erreur technique Supabase";
  }

  return (
    <div className="p-4 sm:p-6 min-h-full flex flex-col pt-8 animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center">
          <Clock className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-white">Historique</h1>
      </div>
      
      {supabaseError && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-2xl">
          <h3 className="text-red-500 font-bold mb-1 text-sm">Erreur Supabase Critique</h3>
          <p className="text-xs text-red-400 font-mono break-all">{supabaseError}</p>
        </div>
      )}
      
      {uniqueRecents.length > 0 ? (
        <div className="flex flex-col gap-3">
          {uniqueRecents.map((item, i) => {
            const date = new Date(item.updated_at).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            return (
              <Link key={i} href={`/produit/${item.ean}`} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:bg-neutral-800 transition-colors group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">{date}</span>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-red-500 transition-colors" />
                </div>
                <h4 className="text-white font-medium mb-1 line-clamp-2 leading-tight">{item.titre}</h4>
                <div className="flex justify-between items-end mt-2">
                  <p className="text-xs text-neutral-500 font-mono">{item.ean}</p>
                  <div className="text-right">
                    <span className="text-white font-bold text-lg leading-none block">{item.prix} €</span>
                    <span className="text-[10px] text-red-400 uppercase tracking-wider">{item.enseigne}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Clock className="w-12 h-12 mb-4" />
          <p>Aucun historique disponible.</p>
        </div>
      )}
    </div>
  );
}
