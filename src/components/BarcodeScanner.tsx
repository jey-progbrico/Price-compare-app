"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BarcodeScanner({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    // Timeout pour laisser le composant HTML s'afficher
    const timeout = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: [0, 1, 8, 14] }, // EAN_13 = 8
          false
        );

        scanner.render(
          (decodedText) => {
            scanner.clear();
            router.push(`/produit/${decodedText}`);
            onClose();
          },
          (errorMessage) => {
            // Beaucoup d'erreurs en continu pendant le scan, on les ignore
          }
        );

        return () => {
          scanner.clear().catch(e => console.error("Failed to clear scanner", e));
        };
      } catch (err) {
        setError("Erreur de la caméra. Assurez-vous d'avoir donné la permission.");
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [router, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 rounded-2xl overflow-hidden border border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
        <div className="flex justify-between items-center p-4 border-b border-neutral-800">
          <h2 className="text-xl font-bold text-white">Scanner un EAN</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white hover:bg-red-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4">
          {error ? (
            <div className="text-red-500 text-center p-4">{error}</div>
          ) : (
            <div id="reader" className="w-full bg-black rounded-lg overflow-hidden border border-neutral-800"></div>
          )}
          <p className="text-center text-neutral-500 text-sm mt-4">
            Placez le code-barres du produit au centre du cadre.
          </p>

          <div className="mt-6 pt-6 border-t border-neutral-800">
            <p className="text-white font-bold mb-3">Saisie Manuelle</p>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const ean = new FormData(e.currentTarget).get("ean") as string;
                if (ean) {
                  router.push(`/produit/${ean}`);
                  onClose();
                }
              }}
              className="flex gap-2"
            >
              <input 
                type="text" 
                name="ean"
                placeholder="Ex: 3103220009574" 
                className="flex-1 bg-black border border-neutral-700 rounded-lg px-3 py-2 text-white focus:border-red-500 focus:outline-none"
              />
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition-colors">
                Chercher
              </button>
            </form>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        #reader__dashboard_section_csr span { color: white !important; }
        #reader button { background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; margin-top: 10px; cursor: pointer; }
        #reader select { background: #171717; color: white; border: 1px solid #dc2626; padding: 8px; border-radius: 8px; margin-bottom: 10px; }
      `}} />
    </div>
  );
}
