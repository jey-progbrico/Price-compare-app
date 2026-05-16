import Link from "next/link";
import { Zap, Tag, LineChart, CalendarDays, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ModulesHub() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-6 lg:p-12 text-white">
      {/* Header */}
      <div className="flex justify-between items-center max-w-5xl mx-auto mb-16">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">VigiSuite</h1>
          <p className="text-neutral-500 font-medium mt-1">Sélectionnez un module pour continuer</p>
        </div>
        
        <form action="/auth/signout" method="post">
          <button type="submit" className="flex items-center gap-2 text-sm font-bold text-neutral-400 hover:text-white transition-colors bg-neutral-900/50 hover:bg-neutral-800 px-4 py-2 rounded-lg border border-neutral-800/50">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </form>
      </div>

      {/* Grid Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        
        {/* Module Actif: VigiPrix */}
        <Link href="/vigiprix/dashboard" className="group relative bg-neutral-900/40 rounded-3xl p-8 border border-neutral-800/50 hover:bg-neutral-900 hover:border-red-500/30 transition-all overflow-hidden block">
          <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-red-600/20 group-hover:scale-110 transition-transform">
            <Zap className="w-7 h-7" />
          </div>
          
          <h2 className="text-2xl font-black mb-2 tracking-tight group-hover:text-red-400 transition-colors">VigiPrix</h2>
          <p className="text-neutral-400 text-sm leading-relaxed mb-6">
            Module de veille tarifaire terrain. Relevés concurrentiels, historique des prix et gestion du catalogue magasin.
          </p>
          
          <div className="inline-flex items-center text-xs font-black uppercase tracking-widest text-red-500 bg-red-500/10 px-3 py-1.5 rounded-full">
            Accéder
          </div>
        </Link>

        {/* Module Inactif: VigiPromo */}
        <div className="relative bg-neutral-900/20 rounded-3xl p-8 border border-neutral-900/50 opacity-60">
          <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-500 mb-6">
            <Tag className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-neutral-300">VigiPromo</h2>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Gestion centralisée des promotions, suivi des catalogues de la concurrence et analyse d'impact.
          </p>
          <div className="inline-flex items-center text-xs font-black uppercase tracking-widest text-neutral-500 bg-neutral-800 px-3 py-1.5 rounded-full">
            Bientôt disponible
          </div>
        </div>

        {/* Module Inactif: VigiPulse */}
        <div className="relative bg-neutral-900/20 rounded-3xl p-8 border border-neutral-900/50 opacity-60">
          <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-500 mb-6">
            <LineChart className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-neutral-300">VigiPulse</h2>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Business Intelligence, KPIs de démarque, rentabilité rayons et alertes de performance.
          </p>
          <div className="inline-flex items-center text-xs font-black uppercase tracking-widest text-neutral-500 bg-neutral-800 px-3 py-1.5 rounded-full">
            Bientôt disponible
          </div>
        </div>
        
        {/* Module Inactif: VigiCalendar */}
        <div className="relative bg-neutral-900/20 rounded-3xl p-8 border border-neutral-900/50 opacity-60">
          <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center text-neutral-500 mb-6">
            <CalendarDays className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight text-neutral-300">VigiCalendar</h2>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Planification des opérations commerciales, gestion des temps forts et synchronisation des équipes.
          </p>
          <div className="inline-flex items-center text-xs font-black uppercase tracking-widest text-neutral-500 bg-neutral-800 px-3 py-1.5 rounded-full">
            Bientôt disponible
          </div>
        </div>

      </div>
    </div>
  );
}
