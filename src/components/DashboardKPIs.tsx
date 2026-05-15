"use client";

import { useMemo } from "react";
import { 
  PieChart, 
  TrendingDown, 
  TrendingUp, 
  Users, 
  Target,
  BarChart2,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";

interface KpiData {
  enseigne: string;
  prix_constate: number;
  prix_vente: number | null;
  user_email: string;
}

interface Props {
  data: KpiData[];
}

export default function DashboardKPIs({ data }: Props) {
  // 1. Répartition par enseigne
  const enseigneDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(d => {
      counts[d.enseigne] = (counts[d.enseigne] || 0) + 1;
    });
    
    const total = data.length;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  // 2. Écart prix moyen par enseigne
  const priceGaps = useMemo(() => {
    const gaps: Record<string, { totalDiff: number; count: number; totalPercent: number }> = {};
    
    data.forEach(d => {
      if (d.prix_vente && d.prix_constate) {
        const diff = d.prix_constate - d.prix_vente;
        const percent = (diff / d.prix_vente) * 100;
        
        if (!gaps[d.enseigne]) {
          gaps[d.enseigne] = { totalDiff: 0, count: 0, totalPercent: 0 };
        }
        gaps[d.enseigne].totalDiff += diff;
        gaps[d.enseigne].totalPercent += percent;
        gaps[d.enseigne].count += 1;
      }
    });

    return Object.entries(gaps)
      .map(([name, stats]) => ({
        name,
        avgGap: stats.totalDiff / stats.count,
        avgPercent: stats.totalPercent / stats.count,
        count: stats.count
      }))
      .sort((a, b) => Math.abs(b.avgPercent) - Math.abs(a.avgPercent))
      .slice(0, 5);
  }, [data]);

  // 3. Activité par utilisateur
  const userActivity = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach(d => {
      const email = d.user_email || "Inconnu";
      counts[email] = (counts[email] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([email, count]) => ({
        email: email.split("@")[0], // On cache la fin pour la confidentialité
        fullEmail: email,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* CARD 1: RÉPARTITION ENSEIGNES */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6 hover:border-neutral-700 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Répartition Terrain</h3>
        </div>

        <div className="space-y-4">
          {enseigneDistribution.map((item, i) => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                <span className="text-neutral-400">{item.name}</span>
                <span className="text-white">{item.percentage.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-neutral-950 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARD 2: ÉCART PRIX MOYEN */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6 hover:border-neutral-700 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <BarChart2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Positionnement Prix</h3>
        </div>

        <div className="space-y-5">
          {priceGaps.map((item, i) => (
            <div key={item.name} className="flex items-center justify-between group">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest truncate">{item.name}</p>
                <p className="text-xs font-bold text-white">Écart moyen : {item.avgGap > 0 ? "+" : ""}{item.avgGap.toFixed(2)}€</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black border flex items-center gap-1.5 ${
                item.avgPercent > 0 
                  ? "bg-red-500/10 border-red-500/20 text-red-500" 
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              }`}>
                {item.avgPercent > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(item.avgPercent).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARD 3: ACTIVITÉ UTILISATEURS */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-[2.5rem] p-8 space-y-6 hover:border-neutral-700 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-600/10 flex items-center justify-center text-red-600">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Activité Terrain</h3>
        </div>

        <div className="divide-y divide-neutral-800/50">
          {userActivity.map((user, i) => (
            <div key={user.fullEmail} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-[10px] font-black text-neutral-500 group-hover:border-red-600/30 transition-all">
                  {i + 1}
                </div>
                <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{user.count}</span>
                <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Relevés</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
