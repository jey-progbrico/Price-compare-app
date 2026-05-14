import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsersManagement from "./UsersManagement";
import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Vérification de sécurité côté serveur (Admin seulement)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/parametres");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-32 space-y-8">
      {/* Fil d'ariane / Retour */}
      <div className="max-w-5xl mx-auto">
        <Link 
          href="/parametres" 
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group mb-8"
        >
          <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-neutral-700 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Retour Paramètres</span>
        </Link>

        <UsersManagement />
      </div>
    </main>
  );
}
