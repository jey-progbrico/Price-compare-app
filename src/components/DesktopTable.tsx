"use client";

import { ReactNode } from "react";

interface Column {
  header: string;
  key: string;
  className?: string;
}

interface Props<T> {
  columns: Column[];
  data: T[];
  renderRow: (item: T) => ReactNode;
  onRowClick?: (item: T) => void;
}

export default function DesktopTable<T>({ columns, data, renderRow, onRowClick }: Props<T>) {
  return (
    <div className="hidden lg:block w-full overflow-hidden bg-neutral-900/30 border border-neutral-800/50 rounded-[2rem] shadow-2xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-neutral-800/50 bg-neutral-900/50">
            {columns.map((col) => (
              <th 
                key={col.key} 
                className={`px-6 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800/30">
          {data.map((item, index) => (
            <tr 
              key={index}
              onClick={() => onRowClick?.(item)}
              className={`group transition-all ${onRowClick ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
            >
              {renderRow(item)}
            </tr>
          ))}
        </tbody>
      </table>
      
      {data.length === 0 && (
        <div className="p-20 text-center">
          <p className="text-neutral-500 font-medium italic">Aucune donnée à afficher.</p>
        </div>
      )}
    </div>
  );
}
