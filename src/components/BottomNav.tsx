"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, ScanBarcode, Clock, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import BarcodeScanner from "./BarcodeScanner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Produits", href: "/produits", icon: Package },
    { name: "Scan", href: "#", icon: ScanBarcode, isAction: true },
    { name: "Historique", href: "/historique", icon: Clock },
    { name: "Sortie", href: "#", icon: LogOut, isLogout: true },
  ];

  return (
    <>
      <div className="fixed bottom-0 left-0 w-full bg-[#0a0a0c] border-t border-neutral-800 z-40 pb-safe">
        <div className="flex justify-around items-center px-2 py-3 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.isAction) {
              return (
                <button
                  key={item.name}
                  onClick={() => setIsScannerOpen(true)}
                  className="flex flex-col items-center text-white -mt-8 bg-red-600 hover:bg-red-500 p-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)] border-4 border-[#0a0a0c] transition-transform active:scale-95"
                >
                  <Icon className="w-7 h-7" />
                </button>
              );
            }

            if (item.isLogout) {
              return (
                <button
                  key={item.name}
                  onClick={handleLogout}
                  className="flex flex-col items-center text-neutral-500 hover:text-red-400 transition-colors"
                >
                  <Icon className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold">{item.name}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center transition-colors ${
                  isActive ? "text-red-500" : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? "fill-red-500/20" : ""}`} />
                <span className="text-[10px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {isScannerOpen && (
        <BarcodeScanner onClose={() => setIsScannerOpen(false)} />
      )}
    </>
  );
}
