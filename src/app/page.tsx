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

  // 2. Historique pour le mobile (reprise rapide)
  const { data: recents } = await supabase
    .from("cache_prix")
    .select("ean, titre, prix, enseigne, updated_at")
    .order("updated_at", { ascending: false })
    .limit(10);
  
  const uniqueRecents = Array.from(new Map(recents?.map(item => [item.ean, item]) || []).values()).slice(0, 5);

  // 3. Récupérer le rôle de l'utilisateur
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user?.id) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = profileData;
  }

  const isAdmin = profile?.role === 'admin';

  // 4. Alertes Support (pour badge mobile)
  const { data: convs } = await supabase
    .from("support_conversations")
    .select("unread_count_admin, unread_count_user");
  
  const unreadCount = convs?.reduce((acc, c) => acc + (c.unread_count_admin || 0) + (c.unread_count_user || 0), 0) || 0;

  return (
    <main className="min-h-full bg-[#0a0a0c] selection:bg-red-500/30">
      {/* ---------------------------------------------------------
          VIEW DESKTOP (lg+) - INCHANGÉE
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
          VIEW MOBILE (Terrain Action Center)
      --------------------------------------------------------- */}
      <div className="lg:hidden flex flex-col min-h-screen bg-[#070708]">
        {/* Top Header - Mobile Center */}
        <header className="px-6 pt-8 pb-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent sticky top-0 z-30 backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">Vigi<span className="text-red-600">prix</span></h1>
            <p className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.4em] mt-1">Action Terrain v2</p>
          </div>
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Activity className="w-5 h-5 text-neutral-500" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 border-2 border-black rounded-full flex items-center justify-center text-[8px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </div>
        </header>

        <div className="flex-1 px-6 pb-24 space-y-10">
          
          {/* ALERTES IMPORTANTES */}
          {unreadCount > 0 && (
            <Link href="/support" className="flex items-center gap-4 p-4 bg-red-600/10 border border-red-600/20 rounded-2xl animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Nouveau message support</p>
                <p className="text-xs font-bold text-white">L'administrateur a répondu à votre demande.</p>
              </div>
            </Link>
          )}

          {/* ACTIONS RAPIDES - GRILLE TACTILE */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] px-1">Centre d'action</h2>
            <div className="grid grid-cols-2 gap-4">
              <MobileActionBtn 
                href="/produits" 
                icon={<ScanBarcode className="w-7 h-7 text-white" />} 
                label="Scanner" 
                sub="Code-barres" 
                color="bg-red-600" 
                main
              />
              <MobileActionBtn 
                href="/produits" 
                icon={<Search className="w-6 h-6 text-neutral-400" />} 
                label="Chercher" 
                sub="Catalogue" 
              />
              <MobileActionBtn 
                href={isAdmin ? "/import-produits" : "/produits?create=true"} 
                icon={<Plus className="w-6 h-6 text-neutral-400" />} 
                label="Nouveau" 
                sub={isAdmin ? "Import Excel" : "Produit rapide"} 
              />
              <MobileActionBtn 
                href={isAdmin ? "/support" : "?support=open"} 
                icon={<Activity className="w-6 h-6 text-neutral-400" />} 
                label="Support" 
                sub={isAdmin ? "Dashboard" : "Chat direct"} 
              />
            </div>
          </section>

          {/* REPRENDRE RAPIDEMENT */}
          <section className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Reprendre</h2>
              <Link href="/historique" className="text-[10px] font-black text-red-500 uppercase tracking-widest">Voir tout</Link>
            </div>
            
            <div className="flex overflow-x-auto gap-4 scrollbar-hide pb-2 -mx-6 px-6">
              {uniqueRecents.map((item, i) => (
                <Link key={i} href={`/produit/${item.ean}`} className="w-64 bg-neutral-900/50 border border-neutral-800 rounded-3xl p-5 shrink-0 flex flex-col gap-3 group active:scale-95 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center">
                      <Package className="w-5 h-5 text-neutral-600" />
                    </div>
                    <span className="text-white font-black text-lg">{item.prix}€</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">{item.titre}</h4>
                    <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest truncate mt-1">{item.enseigne}</p>
                  </div>
                </Link>
              ))}
              {uniqueRecents.length === 0 && (
                <div className="w-full py-12 text-center border-2 border-dashed border-neutral-900 rounded-[2.5rem]">
                  <p className="text-[10px] font-black text-neutral-700 uppercase tracking-widest">Aucun produit récent</p>
                </div>
              )}
            </div>
          </section>

          {/* ACTIVITÉ TERRAIN */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] px-1">Activité Terrain</h2>
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-6 space-y-6">
              {activities?.slice(0, 4).map((act, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-black border border-neutral-800 flex items-center justify-center shrink-0">
                    {act.type_action === 'import_produit' ? <Plus className="w-3 h-3 text-red-500" /> : <Tag className="w-3 h-3 text-neutral-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate leading-none mb-1">
                      {act.type_action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.ean || 'Système'}
                    </p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-neutral-800" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------

function MobileActionBtn({ href, icon, label, sub, color = "bg-neutral-900/50", main = false }: any) {
  return (
    <Link href={href} className={`${color} border border-white/5 rounded-[2.2rem] p-6 flex flex-col gap-3 group active:scale-95 transition-all shadow-xl`}>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${main ? "bg-white/20" : "bg-black/40 border border-white/5"}`}>
        {icon}
      </div>
      <div>
        <p className={`text-sm font-black uppercase tracking-tight ${main ? "text-white" : "text-neutral-300"}`}>{label}</p>
        <p className={`text-[9px] font-black uppercase tracking-widest ${main ? "text-red-100/60" : "text-neutral-600"}`}>{sub}</p>
      </div>
    </Link>
  );
}

function ChevronRight(props: any) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className={props.className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
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
