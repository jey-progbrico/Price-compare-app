"use client";

import { useState, useEffect } from "react";
import { 
  UserPlus, 
  Users, 
  Shield, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  User,
  ShieldCheck,
  UserCheck,
  UserCog,
  KeyRound,
  X
} from "lucide-react";
import { showToast } from "@/components/Toast";
import { UserProfile, UserRole } from "@/hooks/useProfile";
import { motion, AnimatePresence } from "framer-motion";

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("utilisateur");

  // Edit profile state
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("utilisateur");
  const [updating, setUpdating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.results || []);
      }
    } catch (err) {
      showToast("Erreur lors du chargement des utilisateurs", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !role) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, display_name: displayName }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast("Utilisateur créé avec succès", "success");
        setEmail("");
        setPassword("");
        setDisplayName("");
        setRole("utilisateur");
        setShowAddForm(false);
        fetchUsers();
      } else {
        showToast(data.error || "Erreur lors de la création", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion au serveur", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword) return;

    if (newPassword.length < 6) {
      showToast("Le mot de passe doit faire au moins 6 caractères", "error");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget.id, password: newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(`Mot de passe de ${resetTarget.email} réinitialisé`, "success");
        setResetTarget(null);
        setNewPassword("");
      } else {
        showToast(data.error || "Erreur lors de la réinitialisation", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion au serveur", "error");
    } finally {
      setResetting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: editTarget.id, 
          display_name: editDisplayName,
          role: editRole
        }),
      });

      if (res.ok) {
        showToast("Profil mis à jour", "success");
        setEditTarget(null);
        fetchUsers();
      } else {
        const data = await res.json();
        showToast(data.error || "Erreur lors de la mise à jour", "error");
      }
    } catch (err) {
      showToast("Erreur de connexion", "error");
    } finally {
      setUpdating(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const configs: Record<UserRole, { label: string; color: string; icon: any }> = {
      admin: { label: "Administrateur", color: "text-red-500 bg-red-500/10 border-red-500/20", icon: ShieldCheck },
      adherant: { label: "Adhérent", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", icon: UserCheck },
      manager: { label: "Manager", color: "text-blue-500 bg-blue-500/10 border-blue-500/20", icon: UserCog },
      utilisateur: { label: "Utilisateur", color: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20", icon: User },
    };

    const config = configs[role] || configs.utilisateur;
    const Icon = config.icon;

    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. HEADER & ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-3">
            <Users className="w-6 h-6 text-red-600" />
            Gestion des Utilisateurs
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-1">Créez et administrez les accès de votre équipe.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl ${
            showAddForm 
              ? "bg-neutral-800 text-neutral-400 border border-neutral-700" 
              : "bg-white text-black hover:bg-neutral-200"
          }`}
        >
          {showAddForm ? "Annuler" : <><UserPlus className="w-4 h-4" /> Nouvel Utilisateur</>}
        </button>
      </div>

      {/* 2. FORMULAIRE DE CRÉATION */}
      {showAddForm && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-[2rem] p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-300">
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Email professionnel</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-red-500 transition-colors" />
                  <input 
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex: jean.dupont@enseigne.fr"
                    className="w-full bg-black border border-neutral-800 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-red-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Mot de passe temporaire</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-red-500 transition-colors" />
                  <input 
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-neutral-800 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-red-600 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Rôle & Permissions</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(["admin", "adherant", "manager", "utilisateur"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                      role === r 
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20" 
                        : "bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-neutral-600 px-1 italic">
                {role === "admin" && "• Accès complet, gestion des utilisateurs et outils critiques."}
                {role === "adherant" && "• Accès total aux relevés et purges, sans gestion utilisateur."}
                {role === "manager" && "• Accès aux relevés de son périmètre et exports avancés."}
                {role === "utilisateur" && "• Accès limité à ses propres relevés et à la veille terrain."}
              </p>
            </div>

            <div className="pt-4">
              <button 
                type="submit"
                disabled={creating}
                className="w-full bg-white hover:bg-neutral-200 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserCheck className="w-5 h-5" /> Valider la création</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. LISTE DES UTILISATEURS */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 bg-neutral-950/50 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-neutral-500" />
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-[0.2em]">Équipe VigiPrix</h3>
          </div>
          <span className="text-[10px] font-black text-neutral-600 uppercase tracking-tighter">{users.length} Utilisateurs</span>
        </div>

        <div className="divide-y divide-neutral-800/50">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Synchronisation...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-neutral-800 mx-auto" />
              <p className="text-sm text-neutral-500 font-medium">Aucun utilisateur trouvé.</p>
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-950/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-neutral-700 group-hover:border-red-900/30 transition-all">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-red-500 transition-colors">
                      {user.display_name || user.email}
                    </div>
                    {user.display_name && (
                      <div className="text-[10px] text-neutral-500 font-medium">{user.email}</div>
                    )}
                    <div className="text-[10px] text-neutral-600 mt-0.5 font-medium">Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6">
                  {getRoleBadge(user.role)}
                   <button
                    onClick={() => {
                      setEditTarget(user);
                      setEditDisplayName(user.display_name || "");
                      setEditRole(user.role);
                    }}
                    className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all active:scale-90"
                    title="Modifier le profil"
                  >
                    <UserCog className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setResetTarget(user);
                      setNewPassword("");
                    }}
                    className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all active:scale-90"
                    title="Réinitialiser le mot de passe"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-neutral-800 group-hover:text-neutral-600 transition-all hidden sm:block" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>


      {/* 4. MODAL RESET PASSWORD */}
      <AnimatePresence>
        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetTarget(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={() => setResetTarget(null)}
                    className="p-2 rounded-full hover:bg-neutral-800 text-neutral-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white">Réinitialisation</h3>
                  <p className="text-xs text-neutral-500 font-medium">Définir un nouveau mot de passe pour <span className="text-neutral-300">{resetTarget.email}</span></p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Nouveau mot de passe temporaire</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-red-500 transition-colors" />
                      <input 
                        type="text" 
                        required
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nouveau mot de passe"
                        className="w-full bg-black border border-neutral-800 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-red-600 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setResetTarget(null)}
                      className="flex-1 py-4 rounded-2xl bg-neutral-800 text-neutral-400 font-black text-xs uppercase tracking-widest hover:bg-neutral-700 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={resetting}
                      className="flex-[2] py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                    >
                      {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirmer</>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL EDIT PROFILE */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditTarget(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-500">
                    <UserCog className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={() => setEditTarget(null)}
                    className="p-2 rounded-full hover:bg-neutral-800 text-neutral-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white">Modifier le profil</h3>
                  <p className="text-xs text-neutral-500 font-medium">Gestion de <span className="text-neutral-300">{editTarget.email}</span></p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Nom d'affichage</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-600 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text" 
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="Nom d'affichage"
                        className="w-full bg-black border border-neutral-800 rounded-2xl pl-11 pr-4 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">Rôle</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["admin", "adherant", "manager", "utilisateur"] as UserRole[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditRole(r)}
                          className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                            editRole === r 
                              ? "bg-blue-600 border-blue-500 text-white" 
                              : "bg-black border-neutral-800 text-neutral-500"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setEditTarget(null)}
                      className="flex-1 py-4 rounded-2xl bg-neutral-800 text-neutral-400 font-black text-xs uppercase tracking-widest hover:bg-neutral-700 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl"
                    >
                      {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Enregistrer</>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
