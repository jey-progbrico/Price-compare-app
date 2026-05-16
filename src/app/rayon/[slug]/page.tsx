import { supabase } from "@/lib/supabase";
import { Package, ChevronLeft, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import { RayonRow, GroupeRow } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function RayonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  console.log(`[NAV DEBUG] Slug rayon reçu : ${slug}`);

  // 1. Récupérer l'arbre de navigation complet via RPC (Résolution 1 étape)
  const { data: treeData } = await supabase.rpc('get_navigation_tree');
  const tree = (treeData as { rayon_name: string, group_name: string }[] | null) || [];
  
  // Fonction de normalisation pour comparaison (CONSERVÉE À 100%)
  const normalize = (str: string) => 
    decodeURIComponent(str)
      .toLowerCase()
      .replace(/[\s-]/g, '')
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Trouver le rayon qui correspond au slug
  const rayonsUniques = Array.from(new Set(tree.map(t => t.rayon_name)));
  const rayonName = rayonsUniques.find(r => 
    normalize(r) === normalize(slug)
  ) || decodeURIComponent(slug).replace(/-/g, ' ');

  console.log(`[NAV DEBUG] Rayon converti : "${rayonName}"`);

  // 2. Extraire les groupes produits pour ce rayon depuis l'arbre déjà chargé
  const uniqueGroupes = tree
    .filter(t => t.rayon_name === rayonName)
    .map(t => ({
      name: t.group_name,
      slug: encodeURIComponent(t.group_name.toLowerCase().replace(/\s+/g, '-'))
    }));

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-24 space-y-8 animate-in slide-in-from-right-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link 
          href="/produits"
          className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-all active:scale-90 shadow-lg"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-white leading-tight tracking-tighter uppercase">{rayonName}</h1>
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Choisissez un groupe de produits</p>
        </div>
      </div>

      {/* Liste des groupes produits */}
      <div className="space-y-3">
        {uniqueGroupes.map((groupe) => (
          <Link 
            key={groupe.name}
            href={`/rayon/${slug}/${groupe.slug}`}
            className="flex items-center justify-between p-5 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-red-600/50 transition-all active:scale-[0.98] group shadow-xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-neutral-950 rounded-xl flex items-center justify-center text-neutral-700 group-hover:text-red-500 transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-neutral-300 group-hover:text-white uppercase tracking-tight">
                {groupe.name}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-700 group-hover:text-red-500 transition-all transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      {uniqueGroupes.length === 0 && (
        <div className="text-center py-20 text-neutral-600">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun groupe trouvé</p>
        </div>
      )}
    </main>
  );
}
