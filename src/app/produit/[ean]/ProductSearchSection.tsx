"use client";

import { useState, useCallback } from "react";
import CompareButton from "@/components/CompareButton";
import ManualPriceModal from "./ManualPriceModal";
import { PenLine } from "lucide-react";

interface ProductSearchSectionProps {
  ean: string;
  internalPrice?: number | null;
  produit: any;
}

/**
 * Section de recherche prix de la fiche produit.
 * Gère le CompareButton (SSE) + la modale de saisie manuelle.
 * Client component car il a besoin de l'état React.
 */
export default function ProductSearchSection({ ean, internalPrice, produit }: ProductSearchSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    enseigne: string;
    lien: string;
    titre: string;
  }>({ enseigne: "", lien: "", titre: "" });
  const [manualPrices, setManualPrices] = useState<{ enseigne: string; prix: number }[]>([]);

  const handleManualPriceClick = useCallback((enseigne: string, lien: string, titre: string) => {
    setModalData({ enseigne, lien, titre });
    setModalOpen(true);
  }, []);

  const handleManualPriceSuccess = useCallback((enseigne: string, prix: number) => {
    setManualPrices(prev => {
      const existing = prev.findIndex(p => p.enseigne === enseigne);
      if (existing !== -1) {
        const updated = [...prev];
        updated[existing] = { enseigne, prix };
        return updated;
      }
      return [...prev, { enseigne, prix }];
    });
  }, []);

  const openEmptyModal = () => {
    setModalData({ enseigne: "", lien: "", titre: "" });
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Composant de recherche principal */}

      {/* Composant de recherche principal */}
      <CompareButton
        ean={ean}
        internalPrice={internalPrice}
        isUnknown={false}
        onManualPriceClick={handleManualPriceClick}
        produit={produit}
      />

      {/* Modale saisie manuelle */}
      {modalOpen && (
        <ManualPriceModal
          ean={ean}
          isOpen={modalOpen}
          initialEnseigne={modalData.enseigne}
          initialLien={modalData.lien}
          initialTitre={modalData.titre}
          onClose={() => setModalOpen(false)}
          onSuccess={handleManualPriceSuccess}
        />
      )}
    </div>
  );
}
