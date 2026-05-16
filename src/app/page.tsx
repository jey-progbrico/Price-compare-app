import Link from "next/link";
import { Zap, ShieldCheck, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function VigiSuiteLanding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-2xl shadow-red-600/30">
        <Zap className="w-8 h-8" />
      </div>
      
      <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4">
        Vigi<span className="text-red-500">Suite</span>
      </h1>
      
      <p className="text-lg md:text-xl text-neutral-400 mb-12 max-w-2xl font-medium leading-relaxed">
        La plateforme retail tout-en-un pour centraliser votre veille tarifaire, optimiser vos marges et sécuriser vos données métier en temps réel.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-16">
        {user ? (
          <Link 
            href="/modules"
            className="bg-red-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-red-500 transition-colors flex items-center gap-2 shadow-lg shadow-red-600/20"
          >
            Ouvrir les modules
            <Zap className="w-4 h-4" />
          </Link>
        ) : (
          <Link 
            href="/login"
            className="bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
          >
            Connexion Espace Client
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl w-full">
        <div className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
          <TrendingUp className="w-8 h-8 text-red-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Haute Performance</h3>
          <p className="text-neutral-400 text-sm">Synchronisation en temps réel et interface mobile-first pensée pour le terrain.</p>
        </div>
        <div className="bg-neutral-900/40 p-6 rounded-2xl border border-neutral-800/50">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Sécurité SaaS</h3>
          <p className="text-neutral-400 text-sm">Isolation stricte des données par magasin et politique d'accès granulaire RBAC.</p>
        </div>
      </div>
    </div>
  );
}
