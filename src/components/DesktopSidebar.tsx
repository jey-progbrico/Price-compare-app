"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Activity, 
  FileSpreadsheet, 
  Settings, 
  Search,
  ScanLine,
  Zap,
  LogOut,
  User
} from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/produits", label: "Catalogue", icon: Package },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/activites", label: "Activités", icon: Activity },
  { href: "/import-produits", label: "Import Excel", icon: FileSpreadsheet },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

export default function DesktopSidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-[#0d0d0f] border-r border-neutral-800/50 h-screen sticky top-0 z-50">
      {/* Brand */}
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-600/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter">VigiPrix</h1>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Enterprise v7.22</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative ${
                isActive 
                  ? "bg-red-600/10 text-white" 
                  : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-red-600/10 rounded-2xl border border-red-600/20"
                />
              )}
              <item.icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? "text-red-500" : "text-neutral-500"}`} />
              <span className="text-sm font-bold tracking-tight relative z-10">{item.label}</span>
              {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-neutral-900 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 bg-neutral-900/30 rounded-2xl border border-neutral-800/20">
          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Utilisateur</p>
            <p className="text-xs font-bold text-white truncate">{user?.email}</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-neutral-500 hover:bg-red-500/10 hover:text-red-400 transition-all group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm font-bold tracking-tight">Déconnexion</span>
        </button>

        <div className="bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800/30 mt-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Système Live</span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Connecté en tant que<br/>{user?.role || 'Opérateur'}
          </p>
        </div>
      </div>
    </aside>
  );
}
