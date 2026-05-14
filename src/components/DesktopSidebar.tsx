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
  Search,
  ScanLine,
  Zap,
  MessageSquare
} from "lucide-react";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";

export default function DesktopSidebar() {
  const pathname = usePathname();
  const { isAdmin, isAdherant } = useProfile();
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (!isAdmin) return;

    const fetchUnread = async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select("unread_count_admin");
      
      if (!error) {
        const total = data.reduce((acc, conv) => acc + (conv.unread_count_admin || 0), 0);
        setUnreadCount(total);
      }
    };

    fetchUnread();

    const channel = supabase
      .channel("sidebar_support_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, supabase]);

  const baseMenu = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/produits", label: "Catalogue", icon: Package },
    { href: "/historique", label: "Historique", icon: History },
    { href: "/activites", label: "Activités", icon: Activity },
  ];

  const adminMenu = [
    { href: "/import-produits", label: "Import Excel", icon: FileSpreadsheet },
    { href: "/support", label: "Support Admin", icon: MessageSquare },
  ];

  const adherantMenu = [
    { href: "/import-produits", label: "Import Excel", icon: FileSpreadsheet },
  ];

  const settingsMenu = [
    { href: "/parametres", label: "Paramètres", icon: Settings },
  ];

  // Construction dynamique du menu selon le rôle
  let displayItems = [...baseMenu];
  
  if (isAdmin) {
    displayItems = [...displayItems, ...adminMenu];
  } else if (isAdherant) {
    displayItems = [...displayItems, ...adherantMenu];
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
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em]">Enterprise v7.22</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1">
        {displayItems.map((item) => {
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
              
              {/* Badge Support Admin */}
              {item.href === "/support" && unreadCount > 0 && (
                <div className="ml-auto bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-600/20">
                  {unreadCount}
                </div>
              )}

              {isActive && item.href !== "/support" && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-6 border-t border-neutral-900">
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
