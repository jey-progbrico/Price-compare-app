import { createClient } from "@/lib/supabase/server";
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
  FileSpreadsheet,
  Info,
  Zap
} from "lucide-react";
import { 
  RayonRow, 
  ConcurrentRow, 
  PriceCache as RecentProduct, 
  Activity as ActivityRow,
  PriceLog
} from "@/types/database";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import GlobalSearchBar from "@/components/GlobalSearchBar";
import DashboardKPIs from "@/components/DashboardKPIs";

export default async function Home() {
  const supabase = await createClient();
  
  // 1. Récupérer l'utilisateur et son profil complet
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user?.id) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, store_id")
      .eq("id", user.id)
      .single();
    profile = profileData;
  }

  const isPlatformAdmin = profile?.role === 'platform_admin';
  const storeId = isPlatformAdmin ? null : profile?.store_id;

  // 2. Requêtes parallélisées et isolées par store
  let statsQuery = supabase.rpc("get_dashboard_stats", { p_store_id: storeId });
  
  let activitiesQuery = supabase.from("historique_activites")
    .select("*, profiles(display_name, email)")
    .order("created_at", { ascending: false })
    .limit(8);

  let relevesQuery = supabase.from("releves_prix")
    .select("enseigne, prix_constate, created_by, ean");

  let supportQuery = supabase.from("support_conversations")
    .select("unread_count_admin, unread_count_user");

  // Appliquer le filtre store_id uniquement si on n'est pas platform_admin
  if (!isPlatformAdmin && storeId) {
    activitiesQuery = activitiesQuery.eq("store_id", storeId);
    relevesQuery = relevesQuery.eq("store_id", storeId);
    supportQuery = supportQuery.eq("store_id", storeId);
  }

  const [
    { data: stats },
    { data: activities },
    { data: rawReleves },
    { data: convs }
  ] = await Promise.all([
    statsQuery,
    activitiesQuery,
    relevesQuery,
    supportQuery
  ]);

  const totalProduits = stats?.total_produits || 0;
  const totalReleves = stats?.total_releves || 0;
  const totalRayons = stats?.total_rayons || 0;
  const typedActivities = (activities as ActivityRow[] | null) || [];

  const isAdmin = profile?.role === 'admin' || isPlatformAdmin;
  const isAdherant = profile?.role === 'adherant';
  const isManager = profile?.role === 'manager';
  const canImport = isAdmin || isAdherant;
  const canExport = isAdmin || isAdherant || isManager;
  const isManagement = isAdmin || isAdherant || isManager || isPlatformAdmin;

  // 3. Calcul des KPIs (si Management)
  let kpiData: any[] = [];
  if (isManagement && rawReleves && rawReleves.length > 0) {
    const eans = Array.from(new Set(rawReleves.map(r => r.ean).filter(ean => !!ean)));
    const userIds = Array.from(new Set(rawReleves.map(r => r.created_by).filter(id => !!id)));

    const { createClient: createSupabaseAdmin } = await import("@supabase/supabase-js");
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let productsQuery = supabase.from("produits")
      .select("numero_ean, prix_vente")
      .in("numero_ean", eans);

    if (!isPlatformAdmin && storeId) {
      productsQuery = productsQuery.eq("store_id", storeId);
    }

    const [{ data: products }, { data: profiles }] = await Promise.all([
      productsQuery,
      supabaseAdmin.from("profiles")
        .select("id, email, display_name")
        .in("id", userIds)
    ]);

    const productMap = new Map((products as any[] | null)?.map(p => [p.numero_ean, p.prix_vente]) || []);
    const profileMap = new Map((profiles as any[] | null)?.map(p => [p.id, p.display_name || p.email]) || []);

    kpiData = (rawReleves as PriceLog[]).map((r: PriceLog) => ({
      enseigne: r.enseigne,
      prix_constate: r.prix_constate,
      prix_vente: productMap.get(r.ean) || null,
      user_email: profileMap.get(r.created_by || "") || (r.created_by ? "Utilisateur" : "Système")
    }));
  }
  
  const unreadCount = (convs as { unread_count_admin: number; unread_count_user: number; }[] | null)?.reduce((acc, c) => acc + (c.unread_count_admin || 0) + (c.unread_count_user || 0), 0) || 0;

  return (
    <main className="min-h-full bg-[#0a0a0c] selection:bg-red-500/30">
      {/* ---------------------------------------------------------
          VIEW DESKTOP (lg+) - INCHANGÉE
      --------------------------------------------------------- */}
      <div className="hidden lg:flex flex-col p-12 space-y-12 animate-in fade-in duration-700">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Tableau de bord</h1>
              <p className="text-neutral-500 font-medium uppercase tracking-[0.2em] text-xs mt-2">Pilotage & Intelligence Tarifaire ({profile?.role || 'utilisateur'})</p>
            </div>
            <Link 
              href="/parametres#updates" 
              className="px-5 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-3 group hover:bg-emerald-500/10 transition-all"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-tight">Mise à jour</p>
                <p className="text-[9px] font-bold text-neutral-600 uppercase tracking-tighter">Découvrir v7.22</p>
              </div>
            </Link>
          </div>

        {/* Grille KPI */}
        <div className="grid grid-cols-3 gap-6">
          <StatCard title="Produits" value={totalProduits || 0} icon={<Package className="w-5 h-5" />} trend="+12% ce mois" />
          <StatCard title="Relevés Prix" value={totalReleves || 0} icon={<BarChart3 className="w-5 h-5" />} trend="Activité forte" />
          <StatCard title="Rayons" value={totalRayons} icon={<Layers className="w-5 h-5" />} color="red" />
        </div>

        {/* Barre de Recherche Globale */}
        <div className="max-w-4xl">
          <GlobalSearchBar placeholder="Chercher un produit, une marque ou un EAN..." />
        </div>

        {/* DASHBOARD MANAGEMENT */}
        {isManagement && kpiData.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Analyse Métier & Performance</h2>
            </div>
            <DashboardKPIs data={kpiData} />
          </section>
        )}

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
              {typedActivities.map((act, i) => (
                <div key={i} className="flex items-start gap-5 group">
                  <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center shrink-0 group-hover:border-red-600/50 transition-all">
                    {act.type_action === 'import_produit' ? <Plus className="w-4 h-4 text-red-500" /> : <Tag className="w-4 h-4 text-neutral-600" />}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-bold text-white uppercase tracking-tight leading-none mb-1">
                      {act.type_action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-600">
                      {act.ean ? `EAN: ${act.ean}` : 'Action Système'} • {act.profiles?.display_name || act.profiles?.email || 'Système'} • {new Date(act.created_at).toLocaleTimeString()}
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
              {canImport && <ActionLink href="/import-produits" icon={<Upload className="w-5 h-5" />} label="Import Catalogue" sub="Fichier Excel / XLSX" />}
              {canExport && <ActionLink href="/historique" icon={<FileSpreadsheet className="w-5 h-5" />} label="Export Relevés" sub="Génération rapports" />}
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

          {/* RECHERCHE GLOBALE */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] px-1">Recherche Rapide</h2>
            <GlobalSearchBar />
          </section>

          {/* ACTIONS RAPIDES - GRILLE TACTILE */}
          <section className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em]">Centre d'action</h2>
              <Link href="/parametres#updates" className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full active:scale-95 transition-all">
                <Zap className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Nouveautés</span>
              </Link>
            </div>
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
                href={canImport ? "/import-produits" : "/produits?create=true"} 
                icon={<Plus className="w-6 h-6 text-neutral-400" />} 
                label="Nouveau" 
                sub={canImport ? "Import Excel" : "Produit rapide"} 
              />
              <MobileActionBtn 
                href={isAdmin ? "/support" : "/parametres"} 
                icon={<Activity className="w-6 h-6 text-neutral-400" />} 
                label={isAdmin ? "Support" : "Session"} 
                sub={isAdmin ? "Dashboard" : "Mon compte"} 
              />
            </div>
          </section>


          {/* ACTIVITÉ TERRAIN */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] px-1">Activité Terrain</h2>
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-6 space-y-6">
              {typedActivities.slice(0, 4).map((act, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-xl bg-black border border-neutral-800 flex items-center justify-center shrink-0">
                    {act.type_action === 'import_produit' ? <Plus className="w-3 h-3 text-red-500" /> : <Tag className="w-3 h-3 text-neutral-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate leading-none mb-1">
                      {act.type_action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {act.ean || 'Système'} • {act.profiles?.display_name || act.profiles?.email || 'Système'}
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

interface MobileActionBtnProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  color?: string;
  main?: boolean;
}

function MobileActionBtn({ href, icon, label, sub, color = "bg-neutral-900/50", main = false }: MobileActionBtnProps) {
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

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

function StatCard({ title, value, icon, trend }: StatCardProps) {
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

interface ActionLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}

function ActionLink({ href, icon, label, sub }: ActionLinkProps) {
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
