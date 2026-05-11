"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

// ─── Singleton store (event-based, no context needed) ────────────────────────

type ToastListener = (toasts: ToastMessage[]) => void;

let _toasts: ToastMessage[] = [];
const _listeners = new Set<ToastListener>();

function notify() {
  _listeners.forEach((l) => l([..._toasts]));
}

export function showToast(message: string, variant: ToastVariant = "info") {
  const id = `${Date.now()}-${Math.random()}`;
  _toasts = [..._toasts, { id, message, variant }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, 3500);
}

// ─── Toast Container ──────────────────────────────────────────────────────────

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener: ToastListener = (t) => setToasts(t);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl
            animate-in slide-in-from-bottom-4 fade-in duration-300
            ${
              toast.variant === "success"
                ? "bg-emerald-950 border-emerald-700/60 text-emerald-300"
                : toast.variant === "error"
                ? "bg-red-950 border-red-700/60 text-red-300"
                : "bg-neutral-900 border-neutral-700 text-neutral-300"
            }`}
        >
          {toast.variant === "success" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          )}
          {toast.variant === "error" && (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => dismiss(toast.id)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
