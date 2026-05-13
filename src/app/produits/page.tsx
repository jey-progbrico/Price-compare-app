import { supabase } from "@/lib/supabase";
import { Package, ArrowRight, ChevronLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProduitsPage() {
  // Récupérer les rayons uniques
  const { data: rayons, error } = await supabase
    .from("produits")
    .select("rayon")
    .not("rayon", "is", null)
    .order("rayon", { ascending: true });

  if (error) {
    console.error(error);
  }

  // Extraire les rayons uniques
  const uniqueRayons = Array.from(new Set(rayons?.map(r => r.rayon) || [])).map(name => ({
    name,
    slug: encodeURIComponent(name!.toLowerCase().replace(/\s+/g, '-'))
  }));

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-24 space-y-8 animate-in fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white leading-tight tracking-tighter">Catalogue</h1>
        <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Sélectionnez un univers</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {uniqueRayons.map((rayon) => (
          <Link 
            key={rayon.name}
            href={`/rayon/${rayon.slug}`}
            className="group relative aspect-square bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-end overflow-hidden hover:border-red-600/50 transition-all active:scale-[0.98] shadow-xl"
          >
            {/* Décoration de fond */}
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Package className="w-16 h-16 text-white" />
            </div>
            
            <div className="relative z-10">
              <div className="w-8 h-1 rounded-full bg-red-600 mb-3 group-hover:w-12 transition-all" />
              <h2 className="text-base font-black text-white leading-tight uppercase">
                {rayon.name}
              </h2>
              <div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-neutral-500 group-hover:text-red-500 transition-colors uppercase tracking-widest">
                Découvrir <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {uniqueRayons.length === 0 && (
        <div className="text-center py-20 text-neutral-600">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucun rayon trouvé</p>
        </div>
      )}
    </main>
  );
}
