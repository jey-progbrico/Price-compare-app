import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { 
  Search, 
  ScanBarcode, 
  Clock, 
  ArrowRight, 
  Package, 
  BarChart3, 
  Activity, 
  Layers, 
  Tag, 
  Plus, 
  Upload,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Home() {
  // 1. Récupérer les Stats (KPIs)
  const [
    { count: totalProduits },
    { count: totalReleves },
    { data: rawRayons },
    { data: rawConcurrents },
    { data: activities }
  ] = await Promise.all([
    supabase.from("produits").select("*", { count: "exact", head: true }),
    supabase.from("releves_prix").select("*", { count: "exact", head: true }),
    supabase.from("produits").select("rayon").not("rayon", "is", null),
    supabase.from("cache_prix").select("enseigne").not("enseigne", "is", null),
    supabase.from("historique_activites").select("*").order("created_at", { ascending: false }).limit(8)
  ]);

  const totalRayons = new Set(rawRayons?.map(r => r.rayon)).size;
  const totalConcurrents = new Set(rawConcurrents?.map(c => c.enseigne)).size;

  // 2. Historique pour le mobile (on garde la logique précédente)
  const { data: recents } = await supabase
    .from("cache_prix")
    .select("ean, titre, prix, enseigne, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);
  
  const uniqueRecents = Array.from(new Map(recents?.map(item => [item.ean, item]) || []).values()).slice(0, 3);

  return (
    <main className="min-h-full bg-[#0a0a0c]">
      {/* ---------------------------------------------------------
          VIEW DESKTOP (lg+)
      --------------------------------------------------------- */}
      <div className="hidden lg:flex flex-col p-12 space-y-12 animate-in fade-in duration-700">
        <header>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Tableau de bord</h1>
          <p className="text-neutral-500 font-medium uppercase tracking-[0.2em] text-xs mt-2">Pilotage & Intelligence Tarifaire</p>
        </header>

        {/* Grille KPI */}
        <div className="grid grid-cols-4 gap-6">
          <StatCard title="Produits" value={totalProduits || 0} icon={<Package className="w-5 h-5" />} trend="+12% ce mois" />
          <StatCard title="Relevés Prix" value={totalReleves || 0} icon={<BarChart3 className="w-5 h-5" />} trend="Activité forte" />
          <StatCard title="Rayons" value={totalRayons} icon={<Layers className="w-5 h-5" />} color="red" />
          <StatCard title="Enseignes" value={totalConcurrents} icon={<TrendingUp className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-3 gap-10">
          {/* Activités Récentes */}
          <div className="col-span-2 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-3">
                <Activity className="w-5 h-5 text-red-600" /> Flux d'activité récent
              </h3>
              <Link href="/activites" className="text-xs font-bold text-neutral-500 hover:text-red-500 transition-colors uppercase tracking-widest">Voir tout le journal</Link>
            </div>
            
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6">
              {activities?.map((act, i) => (
                <div key={i} className="flex items-start gap-5 group">
                  <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center shrink-0 group-hover:border-red-600/50 transition-all">
                    {act.type_action === 'import_produit' ? <Plus className="w-4 h-4 text-red-500" /> : <Tag className="w-4 h-4 text-neutral-600" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold text-white uppercase tracking-tight leading-none mb-1">
                      {act.type_action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-600">
                      {act.ean ? `EAN: ${act.ean}` : 'Action Système'} • {new Date(act.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions Rapides */}
          <div className="space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Actions Rapides</h3>
            <div className="flex flex-col gap-3">
              <ActionLink href="/produits" icon={<Plus className="w-5 h-5" />} label="Créer un produit" sub="Ajout manuel catalogue" />
              <ActionLink href="/import-produits" icon={<Upload className="w-5 h-5" />} label="Import Catalogue" sub="Fichier Excel / XLSX" />
              <ActionLink href="/historique" icon={<FileSpreadsheet className="w-5 h-5" />} label="Export Relevés" sub="Génération rapports" />
              <ActionLink href="/produits" icon={<Search className="w-5 h-5" />} label="Consulter Catalogue" sub="Navigation par rayons" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------
          VIEW MOBILE (Default)
      --------------------------------------------------------- */}
      <div className="lg:hidden p-4 sm:p-6 flex flex-col min-h-screen pb-24">
        <header className="mb-8 pt-4">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2 uppercase">
            Vigi<span className="text-red-600">prix</span>
          </h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Veille concurrentielle terrain</p>
        </header>

        <Link href="/produits" className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-3 mb-8 hover:bg-neutral-800 transition-colors shadow-xl">
          <Search className="w-6 h-6 text-neutral-600" />
          <span className="text-neutral-500 text-base font-bold uppercase tracking-tight">Chercher un produit...</span>
        </Link>

        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-gradient-to-b from-red-900/10 to-transparent rounded-[3rem] border border-red-900/20 mb-10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(220,38,38,0.4)]">
              <ScanBarcode className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Scanner un produit</h2>
            <p className="text-neutral-500 px-8 text-xs font-bold uppercase tracking-wide leading-relaxed">
              Détectez immédiatement les prix concurrents en magasin.
            </p>
          </div>
          <p className="mt-8 text-[10px] font-black text-red-500 uppercase tracking-[0.3em] animate-pulse">↓ Bouton Central ↓</p>
        </div>

        {/* Scans récents Mobile */}
        <div className="space-y-4">
          <div className="flex justify-between items-end px-1">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-600" /> Récents
            </h3>
            <Link href="/historique" className="text-[10px] font-black text-red-500 uppercase tracking-widest">Voir tout</Link>
          </div>
          
          <div className="flex flex-col gap-3">
            {uniqueRecents.map((item, i) => (
              <Link key={i} href={`/produit/${item.ean}`} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4 items-center shadow-lg">
                <div className="w-10 h-10 bg-black rounded-xl border border-neutral-800 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-neutral-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-sm font-bold truncate uppercase tracking-tight">{item.titre}</h4>
                  <p className="text-[9px] font-mono text-neutral-600 truncate uppercase mt-0.5">{item.enseigne}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-white font-black block text-sm">{item.prix}€</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon, trend, color = "white" }: any) {
  return (
    <div className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6 hover:border-neutral-700 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-black rounded-2xl border border-neutral-800 text-neutral-500 group-hover:text-white transition-colors">
          {icon}
        </div>
        {trend && <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">{trend}</span>}
      </div>
      <div>
        <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">{title}</p>
        <h4 className="text-3xl font-black text-white tracking-tighter">{value}</h4>
      </div>
    </div>
  );
}

function ActionLink({ href, icon, label, sub }: any) {
  return (
    <Link href={href} className="flex items-center gap-5 p-5 bg-neutral-900/30 border border-neutral-800 rounded-2xl hover:border-red-600/50 hover:bg-neutral-900/50 transition-all group shadow-xl">
      <div className="w-12 h-12 bg-black rounded-xl border border-neutral-800 flex items-center justify-center text-neutral-600 group-hover:text-red-500 transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-black text-white uppercase tracking-tight group-hover:text-red-500 transition-colors">{label}</p>
        <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{sub}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-neutral-800 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
