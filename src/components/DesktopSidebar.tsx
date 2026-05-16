"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Activity, 
  FileSpreadsheet, 
  Settings, 
  Zap,
  MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { profile, canAccessAdmin, canManageStore } = useProfile();
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!canManageStore) return;

    const fetchUnread = async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select("unread_count_admin")
        .gt("unread_count_admin", 0);
      
      if (!error) {
        const total = data.reduce((acc, conv) => acc + (conv.unread_count_admin || 0), 0);
        setUnreadCount(total);
      }
    };

    let channel: any = null;

    // OPTIMISATION : Délai d'initialisation pour libérer le chargement principal
    const timer = setTimeout(() => {
      fetchUnread();

      channel = supabase
        .channel("sidebar_support_sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "support_conversations" },
          () => fetchUnread()
        )
        .subscribe();
    }, 2000);

    return () => {
      clearTimeout(timer);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [canManageStore, supabase]);

  const baseMenu = [
    { href: "/vigiprix/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vigiprix/produits", label: "Catalogue", icon: Package },
    { href: "/vigiprix/historique", label: "Historique", icon: History },
    { href: "/vigiprix/activites", label: "Activités", icon: Activity },
  ];

  const adminMenu = [
    { href: "/vigiprix/import-produits", label: "Import Excel", icon: FileSpreadsheet },
    { href: "/vigiprix/support", label: "Support Admin", icon: MessageSquare },
  ];

  const storeManagerMenu = [
    { href: "/vigiprix/import-produits", label: "Import Excel", icon: FileSpreadsheet },
    { href: "/vigiprix/support", label: "Support", icon: MessageSquare },
  ];

  const settingsMenu = [
    { href: "/vigiprix/parametres", label: "Paramètres", icon: Settings },
  ];

  // Construction dynamique du menu selon les capacités
  let displayItems = [...baseMenu];
  
  if (canAccessAdmin) {
    displayItems = [...displayItems, ...adminMenu];
  } else if (canManageStore) {
    displayItems = [...displayItems, ...storeManagerMenu];
  }

  displayItems = [...displayItems, ...settingsMenu];

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
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Module Actif</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {displayItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/vigiprix/dashboard" && pathname.startsWith(item.href));
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
              
              {/* Badge Support Admin */}
              {item.href === "/vigiprix/support" && unreadCount > 0 && (
                <div className="ml-auto bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-600/20">
                  {unreadCount}
                </div>
              )}

              {isActive && item.href !== "/vigiprix/support" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info & Retour Hub */}
      <div className="p-6 border-t border-neutral-900 space-y-4">
        <Link href="/modules" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-neutral-800 text-xs font-bold text-neutral-400 hover:bg-white/5 hover:text-white transition-colors">
          Retour Hub VigiSuite
        </Link>
        <div className="bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Système Live</span>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Données synchronisées avec Supabase.
          </p>
        </div>
      </div>
    </aside>
  );
}
