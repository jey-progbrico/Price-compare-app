"use client";

import { useState, useEffect } from "react";
import { X, FileSpreadsheet, Calendar, Store, Filter, Download, Loader2 } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rayons: string[];
}

export default function ExportModal({ isOpen, onClose, rayons }: ExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateStart: "",
    dateEnd: "",
    concurrent: "",
    rayon: ""
  });

  if (!isOpen) return null;

  const handleDownload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateStart) params.append("dateStart", filters.dateStart);
      if (filters.dateEnd) params.append("dateEnd", filters.dateEnd);
      if (filters.concurrent) params.append("concurrent", filters.concurrent);
      if (filters.rayon) params.append("rayon", filters.rayon);

      const response = await fetch(`/api/export/releves?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'export");
      }

      // Déclenchement du téléchargement
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `releves-prix-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Journaliser l'activité
      await fetch("/api/activites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_action: "export_excel",
          details: { filters }
        }),
      }).catch(err => console.error("Erreur log activite:", err));

      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white leading-tight">Export Excel</h2>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Filtrez vos relevés</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtres */}
        <div className="space-y-5">
          {/* Période */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <Calendar className="w-3 h-3" /> Période
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filters.dateStart}
                onChange={(e) => setFilters(prev => ({ ...prev, dateStart: e.target.value }))}
                className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-3 text-xs text-white focus:border-emerald-500 transition-all outline-none"
              />
              <input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => setFilters(prev => ({ ...prev, dateEnd: e.target.value }))}
                className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-3 text-xs text-white focus:border-emerald-500 transition-all outline-none"
              />
            </div>
          </div>

          {/* Concurrent */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <Store className="w-3 h-3" /> Concurrent spécifique
            </label>
            <input
              type="text"
              placeholder="Ex: Leroy Merlin, Amazon..."
              value={filters.concurrent}
              onChange={(e) => setFilters(prev => ({ ...prev, concurrent: e.target.value }))}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 transition-all outline-none placeholder:text-neutral-700"
            />
          </div>

          {/* Rayon */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 px-1">
              <Filter className="w-3 h-3" /> Par Rayon
            </label>
            <select
              value={filters.rayon}
              onChange={(e) => setFilters(prev => ({ ...prev, rayon: e.target.value }))}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 transition-all outline-none appearance-none"
            >
              <option value="">Tous les rayons</option>
              {rayons.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl mt-10 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Download className="w-5 h-5" />
              TÉLÉCHARGER L'EXCEL
            </>
          )}
        </button>
      </div>
    </div>
  );
}
