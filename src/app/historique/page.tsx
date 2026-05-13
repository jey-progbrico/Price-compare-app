import { supabase } from "@/lib/supabase";
import { Zap, Package, Tag, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getActivites() {
  // 1. Charger les 15 derniers relevés
  const { data: releves } = await supabase
    .from("releves_prix")
    .select("*, produits(description_produit, marque)")
    .order("created_at", { ascending: false })
    .limit(15);

  // 2. Charger les 10 derniers produits
  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(10);

  // 3. Fusionner et typer
  const activites: any[] = [];

  releves?.forEach(r => {
    activites.push({
      id: `rel-${r.id}`,
      type: "releve",
      date: new Date(r.created_at),
      ean: r.ean,
      enseigne: r.enseigne,
      prix: r.prix_constate,
      titre: r.designation_originale || r.produits?.description_produit || "Produit",
      marque: r.produits?.marque
    });
  });

  produits?.forEach(p => {
    activites.push({
      id: `prod-${p.numero_ean}`,
      type: "produit",
      date: new Date(p.updated_at || p.created_at),
      ean: p.numero_ean,
      titre: p.description_produit,
      marque: p.marque,
      prix: p.prix_vente
    });
  });

  return activites.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default async function HistoriquePage() {
  const activites = await getActivites();

  return (
    <div className="p-4 sm:p-6 min-h-screen flex flex-col pt-8 animate-in fade-in bg-[#0a0a0c] pb-24">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-violet-600/20 text-violet-500 rounded-xl flex items-center justify-center">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Activités</h1>
          <p className="text-neutral-500 text-xs mt-0.5">Suivi en temps réel du terrain</p>
        </div>
      </div>

      <div className="space-y-4">
        {activites.map((act) => (
          <Link 
            key={act.id} 
            href={`/produit/${act.ean}`}
            className="block bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-neutral-700 transition-all active:scale-[0.98]"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                {act.type === "releve" ? (
                  <div className="px-2 py-0.5 bg-emerald-900/30 text-emerald-500 text-[10px] font-bold rounded border border-emerald-800/50 uppercase tracking-widest">
                    Nouveau Relevé
                  </div>
                ) : (
                  <div className="px-2 py-0.5 bg-blue-900/30 text-blue-500 text-[10px] font-bold rounded border border-blue-800/50 uppercase tracking-widest">
                    Fiche Modifiée
                  </div>
                )}
                <span className="text-[10px] text-neutral-600 font-mono">
                  {act.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 font-medium bg-black/40 px-1.5 py-0.5 rounded">
                {act.date.toLocaleDateString()}
              </span>
            </div>

            <div className="flex gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                act.type === "releve" ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-500" : "bg-blue-950/20 border-blue-900/30 text-blue-500"
              }`}>
                {act.type === "releve" ? <Tag className="w-6 h-6" /> : <Package className="w-6 h-6" />}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-white text-sm font-bold truncate">{act.titre}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {act.marque && <span className="text-[10px] text-neutral-400 font-bold uppercase">{act.marque}</span>}
                  <span className="text-[10px] text-neutral-600 font-mono">EAN: {act.ean}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-lg font-black text-white leading-none">
                  {act.prix?.toFixed(2)}€
                </div>
                <div className="text-[9px] font-bold uppercase tracking-tighter mt-1 text-neutral-500">
                  {act.type === "releve" ? act.enseigne : "Mon Magasin"}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-neutral-800/50 flex justify-end">
              <div className="text-[10px] font-bold text-neutral-600 flex items-center gap-1">
                VOIR LA FICHE <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Link>
        ))}

        {activites.length === 0 && (
          <div className="text-center py-20 text-neutral-600">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Aucune activité récente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
