"use client";

import { useState, useEffect } from "react";
import { 
  History, 
  Tag, 
  Trash2, 
  FileSpreadsheet, 
  Edit3, 
  PlusCircle, 
  Link2, 
  ArrowRight,
  Clock,
  Package,
  ChevronRight
} from "lucide-react";
import Link from "next/link";

interface Activity {
  id: string;
  created_at: string;
  type_action: string;
  ean: string;
  details: any;
  produits?: {
    description_produit: string;
    marque: string;
    rayon: string;
  };
}

const ACTION_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  ajout_releve: { label: "Nouveau relevé", color: "text-emerald-500 bg-emerald-500/10", icon: PlusCircle },
  suppression_releve: { label: "Relevé supprimé", color: "text-red-500 bg-red-500/10", icon: Trash2 },
  modification_releve: { label: "Relevé modifié", color: "text-blue-500 bg-blue-500/10", icon: Edit3 },
  export_excel: { label: "Export Excel", color: "text-violet-500 bg-violet-500/10", icon: FileSpreadsheet },
  import_produit: { label: "Import manuel", color: "text-orange-500 bg-orange-500/10", icon: Link2 },
  modification_produit: { label: "Fiche modifiée", color: "text-amber-500 bg-amber-500/10", icon: Edit3 },
};

export default function ActivitesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch("/api/activites?limit=50");
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error("Erreur chargement activités:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <main className="min-h-full bg-[#0a0a0c] p-4 sm:p-6 pt-12 pb-24 space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center border border-neutral-800">
          <History className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white leading-tight tracking-tighter">Activités Récentes</h1>
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Journal de bord terrain</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
          <History className="w-12 h-12 animate-spin text-neutral-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Chargement du journal...</p>
        </div>
      ) : (
        <div className="relative space-y-8 ml-2">
          {/* Ligne verticale de la timeline */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-neutral-800" />

          {activities.map((activity, i) => {
            const config = ACTION_CONFIG[activity.type_action] || { label: activity.type_action, color: "text-neutral-500 bg-neutral-900", icon: History };
            const Icon = config.icon;

            return (
              <div key={activity.id} className="relative pl-10 animate-in slide-in-from-left-4 fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                {/* Point de la timeline */}
                <div className={`absolute left-0 top-1 w-10 h-10 rounded-xl flex items-center justify-center border border-neutral-800/50 z-10 shadow-lg ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Contenu */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${config.color.split(' ')[0]}`}>
                      {config.label}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-600 flex items-center gap-1.5 uppercase">
                      <Clock className="w-3 h-3" />
                      {formatDate(activity.created_at)} • {formatTime(activity.created_at)}
                    </span>
                  </div>

                  <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-2xl p-4 space-y-3 hover:border-neutral-700 transition-all shadow-xl">
                    {/* Détails de l'action */}
                    <div className="text-sm text-neutral-300 leading-snug">
                      {activity.type_action === "ajout_releve" && (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white">{activity.details?.prix?.toFixed(2)}€</span>
                            <span className="text-neutral-500">chez</span>
                            <span className="font-bold text-emerald-500">{activity.details?.enseigne}</span>
                          </div>
                          <p className="text-[10px] text-neutral-500 line-clamp-1 italic">{activity.details?.designation}</p>
                        </div>
                      )}
                      {activity.type_action === "suppression_releve" && (
                        <p>Relevé supprimé pour l'article <span className="text-red-400 font-mono text-[10px]">{activity.ean}</span></p>
                      )}
                      {activity.type_action === "export_excel" && (
                        <p>Extraction Excel générée ({activity.details?.filters?.rayon || "Tous les rayons"})</p>
                      )}
                      {!["ajout_releve", "suppression_releve", "export_excel"].includes(activity.type_action) && (
                        <p>{activity.type_action.replace(/_/g, ' ')}</p>
                      )}
                    </div>

                    {/* Lien produit si EAN présent */}
                    {activity.ean && (
                      <Link 
                        href={`/produit/${activity.ean}`}
                        className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl group hover:bg-black transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="w-4 h-4 text-neutral-700 group-hover:text-red-500 transition-colors" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-neutral-400 truncate group-hover:text-white">
                              {activity.produits?.description_produit || "Voir le produit"}
                            </p>
                            <p className="text-[8px] font-mono text-neutral-600 uppercase tracking-tighter">EAN: {activity.ean}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-neutral-700 group-hover:text-red-500" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="text-center py-20 text-neutral-700 space-y-4">
              <History className="w-12 h-12 mx-auto opacity-10" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-30">Aucune activité enregistrée</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
