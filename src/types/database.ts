/**
 * Types de données centraux pour VigiPrix
 * Reflet de la structure Supabase et des objets métier
 */

export interface Product {
  numero_ean: string;
  marque: string | null;
  description_produit: string;
  reference_fabricant: string | null;
  rayon: string | null;
  groupe_produit: string | null;
  prix_vente: number | null;
  devise: string | null;
  categorie: string | null;
  image_url: string | null;
  code_interne: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Activity {
  id: string;
  type_action: "import_produit" | "modification_produit" | "suppression_produit" | "scan_produit" | "creation_manuelle";
  ean?: string;
  details?: any; // Les détails varient trop pour être strictement typés ici
  created_at: string;
  user_id?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  role: "admin" | "adherant" | "manager" | "utilisateur";
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at?: string;
}

export interface PriceCache {
  ean: string;
  enseigne: string;
  prix: number;
  titre: string;
  url: string | null;
  updated_at: string;
}

export interface PriceLog {
  id: string;
  ean: string;
  prix_constate: number;
  enseigne: string;
  url: string | null;
  designation_originale: string | null;
  match_type?: "exact" | "equivalent" | null;
  created_by?: string | null;
  created_at: string;
}

// Types utilitaires pour les retours Supabase partiels
export interface RayonRow { 
  rayon: string | null; 
}

export interface GroupeRow { 
  groupe_produit: string | null; 
}

export interface ConcurrentRow { 
  enseigne: string; 
}

export interface ConsultationRow {
  id: string;
  ean: string;
  created_at: string;
}
