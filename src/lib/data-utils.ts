import { Product } from "@/types/database";
import { supabase } from "./supabase";

/**
 * Enrichit une liste d'objets (relevés, activités, etc.) avec les données des produits correspondants.
 * Utilisé car il n'y a pas de relations SQL explicites (Foreign Keys) dans la base.
 * 
 * @param items Liste d'objets contenant potentiellement une propriété 'ean'
 * @returns La liste enrichie avec une propriété 'produit'
 */
export async function enrichWithProducts<T extends { ean?: string | null }>(items: T[]): Promise<(T & { produit: Product | null })[]> {
  if (!items || items.length === 0) return [];

  // 1. Extraire les EAN uniques (seulement ceux présents)
  const eans = Array.from(new Set(items.map(item => item.ean).filter((ean): ean is string => !!ean)));
  
  if (eans.length === 0) return items.map(item => ({ ...item, produit: null }));

  // 2. Récupérer les produits correspondants
  const { data: produits, error } = await supabase
    .from("produits")
    .select("numero_ean, description_produit, marque, rayon, groupe_produit, prix_vente")
    .in("numero_ean", eans);

  if (error) {
    console.error("[ENRICH ERROR] Erreur lors de la récupération des produits:", error);
    return items.map(item => ({ ...item, produit: null }));
  }

  // 3. Créer un Map pour accès rapide
  const produitMap = new Map((produits as Product[] | null)?.map(p => [p.numero_ean, p]) || []);

  // 4. Fusionner les données
  return items.map(item => ({
    ...item,
    produit: item.ean ? (produitMap.get(item.ean) || null) : null
  }));
}
