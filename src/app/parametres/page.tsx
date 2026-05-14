"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Zap, 
  Trash2, 
  Settings, 
  Copy, 
  Database, 
  FileText, 
  ChevronRight,
  Shield,
  Gauge,
  FileSpreadsheet,
  Upload,
  History,
  User,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Loader2,
  AlertCircle
} from "lucide-react";
import ExportModal from "./ExportModal";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { useProfile } from "@/hooks/useProfile";

import { RayonRow } from "@/types/database";

export default function ParametresPage() {
  const router = useRouter();
  const supabase = createClient();
  const { profile, loading: profileLoading, isAdmin, isAdherant, isManager, isStandardUser } = useProfile();
  const canImport = isAdmin || isAdherant;
  const canExport = true; // Tout le monde peut exporter (ses propres données ou tout)
  const canSeeCache = isAdmin || isAdherant; // Cache et outils techniques réservés Admin/Adh
  
  const [cacheDuration, setCacheDuration] = useState("7");
  const [priceThreshold, setPriceThreshold] = useState("0.50");
  const [loading, setLoading] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [rayons, setRayons] = useState<string[]>([]);
  const [relevesCount, setRelevesCount] = useState(0);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [updatingPass, setUpdatingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      let query = supabase.from("releves_prix").select("*", { count: 'exact', head: true });
      
      if (profile?.role === "utilisateur") {
        query = query.eq("created_by", profile.id);
      }

      const { count } = await query;
      setRelevesCount(count || 0);

      const { data: rayonsData } = await supabase.from("produits").select("rayon").not("rayon", "is", null);
      const uniqueRayons = Array.from(new Set((rayonsData as RayonRow[] | null)?.map(r => r.rayon).filter((r): r is string => !!r) || []));
      setRayons(uniqueRayons);
    };

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.cache_duration) setCacheDuration(data.cache_duration);
          if (data.price_threshold) setPriceThreshold(data.price_threshold);
        }
      } catch (err) {
        console.error("Erreur chargement settings:", err);
      }
    };

    fetchStats();
    fetchSettings();
    setCacheCount(124);
  }, [profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showToast("Déconnexion réussie", "success");
    router.push("/login");
    router.refresh();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    // Validations
    if (newPassword !== confirmPassword) {
      setPassError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (newPassword.length < 6) {
      setPassError("Le nouveau mot de passe doit faire au moins 6 caractères.");
      return;
    }

    setUpdatingPass(true);

    try {
      // 1. Vérifier l'ancien mot de passe (via re-login silencieux)
      if (!profile?.email) throw new Error("Session utilisateur introuvable.");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword,
      });

      if (signInError) {
        throw new Error("L'ancien mot de passe est incorrect.");
      }

      // 2. Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      showToast("Mot de passe mis à jour !", "success");
      setShowPasswordForm(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassError(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setUpdatingPass(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    } catch (err) {
      console.error(`Erreur sauvegarde ${key}:`, err);
    }
  };

  const handleCacheDurationChange = (d: string) => {
    setCacheDuration(d);
    saveSetting("cache_duration", d);
  };

  const handlePriceThresholdChange = (val: string) => {
    setPriceThreshold(val);
    saveSetting("price_threshold", val);
  };

  const bookmarkletCode = `javascript:(function(){var ean=document.body.innerText.match(/\\b\\d{13}\\b/)?.[0]||'';var url=encodeURIComponent(location.href);var title=encodeURIComponent(document.title);window.open('${typeof window !== 'undefined' ? window.location.origin : ''}/import?ean='+ean+'&url='+url+'&title='+title,'_blank');})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    showToast("Bookmarklet copié !", "success");
  };

  const clearCache = async () => {
    if (!confirm("Voulez-vous vider le cache automatique ?")) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      showToast("Cache vidé", "success");
    }, 1000);
  };

  const handlePurgeReleves = async () => {
    if (!confirm("ATTENTION : Cette action supprimera DÉFINITIVEMENT tous les relevés de prix de la base de données. Continuer ?")) return;
    
    const confirmation = prompt("Tapez 'SUPPRIMER' pour confirmer la suppression totale.");
    if (confirmation !== "SUPPRIMER") return;

    setLoading(true);
    try {
      const res = await fetch("/api/releves/purge", { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setRelevesCount(0);
        showToast("Tous les relevés ont été supprimés", "success");
      } else {
        showToast(data.error || "Erreur lors de la purge", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion au serveur", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-32 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800 shadow-lg">
          <Settings className="w-6 h-6 text-neutral-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white leading-tight">Outils Terrain</h1>
          <p className="text-xs text-neutral-500 font-medium tracking-wide">Configuration et maintenance</p>
        </div>
      </div>

      {/* 1. PARAMÈTRES MÉTIER */}
      <div className="space-y-8">
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Gauge className="w-4 h-4 text-violet-500" />
            <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Veille Concurrentielle</h2>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-5 shadow-xl">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-neutral-500 uppercase block tracking-widest">Seuil d'alignement prix (€)</label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  step="0.01"
                  value={priceThreshold}
                  onChange={(e) => handlePriceThresholdChange(e.target.value)}
                  className="w-24 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white font-black text-sm outline-none focus:border-violet-600 transition-all shadow-inner"
                />
                <span className="text-[10px] text-neutral-600 leading-tight font-medium">
                  Écart maximum pour considérer qu'un prix est "aligné" (Badge jaune).
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800/50">
              <div className="flex justify-between items-center opacity-50 group">
                <div className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors">Enseignes favorites</div>
                <ChevronRight className="w-4 h-4" />
              </div>
              <p className="text-[9px] text-neutral-600 mt-1 uppercase tracking-[0.2em] font-black">Bientôt disponible</p>
            </div>
          </div>
        </section>

        {canSeeCache && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Database className="w-4 h-4 text-blue-500" />
              <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Gestion du Cache</h2>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden divide-y divide-neutral-800/50 shadow-xl">
              <div className="p-5 flex justify-between items-center bg-blue-950/5">
                <div>
                  <div className="text-sm font-bold text-white">Éléments en cache</div>
                  <div className="text-[10px] text-neutral-500 uppercase tracking-tighter">Suggestions DuckDuckGo mémorisées</div>
                </div>
                <span className="text-lg font-black text-white">{cacheCount}</span>
              </div>

              <div className="p-5 space-y-3">
                <label className="text-[10px] font-bold text-neutral-500 uppercase block tracking-widest">Durée de conservation</label>
                <div className="grid grid-cols-3 gap-2">
                  {["7", "14", "30"].map(d => (
                    <button
                      key={d}
                      onClick={() => handleCacheDurationChange(d)}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        cacheDuration === d 
                          ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20" 
                          : "bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700"
                      }`}
                    >
                      {d} jours
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <button 
                  onClick={clearCache}
                  disabled={loading}
                  className="w-full bg-neutral-950 border border-red-900/30 text-red-500 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-red-950/10"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Vider le cache automatique
                </button>
              </div>

              <div className="p-5 bg-red-950/10 border-t border-red-900/20">
                <button 
                  onClick={handlePurgeReleves}
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-red-600/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-5 h-5" />}
                  VIDER TOUS LES RELEVÉS
                </button>
                <p className="text-[9px] text-red-500 font-black uppercase tracking-[0.1em] text-center mt-3 animate-pulse">
                  Action irréversible • Zone de danger
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 2. OUTILS TERRAIN */}
      {canSeeCache && (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Import PC (Bookmarklet)</h2>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-4 shadow-xl">
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Utilisez le bookmarklet pour importer n'importe quelle page produit concurrente d'un seul clic vers VigiPrix depuis votre ordinateur.
              </p>
              <button 
                onClick={copyBookmarklet}
                className="w-full bg-white text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-white/5"
              >
                <Copy className="w-4 h-4" />
                Copier le Bookmarklet
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Import Mobile (Partage)</h2>
            </div>
            <div className="bg-emerald-950/10 border border-emerald-900/20 rounded-3xl p-5 space-y-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Zap className="w-16 h-16 text-emerald-500" />
              </div>

              <div className="space-y-4 relative z-10">
                {[
                  { n: 1, t: "Ouvrez une fiche concurrente (Chrome/Safari)" },
                  { n: 2, t: "Cliquez sur PARTAGER dans votre navigateur" },
                  { n: 3, t: "Choisissez VigiPrix dans la liste des apps" },
                  { n: 4, t: "L'import se pré-remplit automatiquement !", i: true }
                ].map((step) => (
                  <div key={step.n} className="flex gap-4">
                    <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg shadow-emerald-600/20">{step.n}</div>
                    <p className={`text-xs text-neutral-300 leading-tight ${step.i ? 'italic opacity-60' : ''}`}>{step.t}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest text-center">
                  Recommandé pour le terrain
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {canImport && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Gestion Catalogue</h2>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl group">
            <Link 
              href="/import-produits"
              className="p-6 flex justify-between items-center hover:bg-emerald-950/10 transition-all"
            >
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">Importation Massive Excel</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-tighter mt-0.5">Mise à jour globale du catalogue (.xlsx)</div>
              </div>
              <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-600/5">
                <Upload className="w-6 h-6" />
              </div>
            </Link>
          </div>
        </section>
      )}

      {canExport && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FileText className="w-4 h-4 text-emerald-500" />
            <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Export des relevés</h2>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden divide-y divide-neutral-800/50 shadow-xl">
            <div className="p-6 flex justify-between items-center bg-emerald-950/5">
              <div>
                <div className="text-sm font-bold text-white">Relevés exportables</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] mt-0.5">
                  {isStandardUser ? "Mes relevés personnels" : "Veille concurrentielle terrain"}
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-500">{relevesCount}</span>
                <p className="text-[9px] text-neutral-600 font-black uppercase tracking-tighter">Lignes</p>
              </div>
            </div>

            <button 
              onClick={() => setShowExportModal(true)}
              className="w-full p-6 flex justify-between items-center hover:bg-emerald-950/10 transition-all group"
            >
              <div className="text-left">
                <div className="text-sm font-bold text-white group-hover:text-emerald-500 transition-colors">Générer l'export Excel</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-tighter mt-0.5">Filtrage par date, concurrent et rayon</div>
              </div>
              <div className="w-10 h-10 bg-neutral-950 rounded-xl flex items-center justify-center text-neutral-700 group-hover:text-emerald-500 group-hover:bg-neutral-900 transition-all">
                <FileText className="w-5 h-5" />
              </div>
            </button>
          </div>
        </section>
      )}

      {/* 5. TOUT EN BAS : COMPTE UTILISATEUR */}
      <section className="pt-24 space-y-6">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />
          <div className="flex items-center gap-2 px-1 opacity-40">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <h2 className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Zone Sécurité</h2>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 via-neutral-800 to-transparent" />
        </div>

        <div className="bg-neutral-950/30 border border-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all duration-500 hover:border-neutral-800/50">
          <div className="p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-20 h-20 rounded-3xl bg-neutral-900 flex items-center justify-center text-neutral-600 border border-neutral-800 shadow-inner">
              <User className="w-10 h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-1">Session Active</p>
              <h3 className="text-xl font-black text-white truncate mb-2">
                {profileLoading ? (
                  <span className="opacity-20 animate-pulse">Chargement...</span>
                ) : (
                  profile?.email
                )}
              </h3>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                  {profile?.role || 'Utilisateur'} Authentifié
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="px-8 py-4 bg-red-600/5 hover:bg-red-600/10 border border-red-900/20 text-red-500 font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center gap-3"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>

          <div className="p-8 bg-neutral-900/20 border-t border-neutral-900/50">
            {/* Password Change Toggle */}
            {!showPasswordForm ? (
              <button 
                onClick={() => setShowPasswordForm(true)}
                className="w-full py-4 px-6 bg-neutral-950 border border-neutral-800/50 rounded-2xl flex items-center justify-between hover:bg-neutral-900 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Lock className="w-5 h-5 text-neutral-500" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-neutral-400 group-hover:text-white transition-colors">Changer le mot de passe</div>
                    <div className="text-[10px] text-neutral-600">Dernière étape de sécurité</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-700" />
              </button>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-center mb-4">
                   <h4 className="text-xs font-black text-white uppercase tracking-widest">Mise à jour sécurité</h4>
                   <button type="button" onClick={() => setShowPasswordForm(false)} className="text-[10px] font-bold text-neutral-500 hover:text-white uppercase tracking-tighter">Annuler</button>
                </div>

                {passError && (
                  <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-400 font-bold leading-tight">{passError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <input 
                      type={showOldPass ? "text" : "password"}
                      required
                      placeholder="Ancien mot de passe"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-sm text-white placeholder-neutral-800 outline-none focus:border-neutral-600 transition-all"
                    />
                    <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-800">
                      {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type={showNewPass ? "text" : "password"}
                      required
                      placeholder="Nouveau mot de passe"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-sm text-white placeholder-neutral-800 outline-none focus:border-neutral-600 transition-all"
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-800">
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <input 
                    type={showNewPass ? "text" : "password"}
                    required
                    placeholder="Confirmer nouveau mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-4 text-sm text-white placeholder-neutral-800 outline-none focus:border-neutral-600 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={updatingPass}
                    className="px-8 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl"
                  >
                    {updatingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 6. VERSION (FOOTER) */}
      <div className="pt-16 pb-8 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-neutral-800 uppercase tracking-[0.4em]">
          <Shield className="w-3 h-3 opacity-30" />
          Vigiprix System v7.22 — Build Stable
        </div>
      </div>

      {/* Modals */}
      <ExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        rayons={rayons} 
      />
    </main>
  );
}
