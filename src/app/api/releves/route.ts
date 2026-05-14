import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

import { PriceLog } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * GET /api/releves?ean=...
 * Récupère l'historique des relevés manuels pour un produit donné.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");

  if (!ean) {
    return NextResponse.json({ error: "Paramètre 'ean' manquant" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("releves_prix")
      .select("*")
      .eq("ean", ean)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data as PriceLog[] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/releves
 * Enregistre un nouveau relevé de prix manuel.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ean, enseigne, url, prix_constate, designation_originale, designation_normalisee, match_type } = body;

    if (!ean || !enseigne || !url || prix_constate === undefined) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("releves_prix")
      .insert([
        {
          ean,
          enseigne,
          url,
          prix_constate: parseFloat(prix_constate),
          designation_originale,
          designation_normalisee,
          match_type,
          created_by: user.id
        },
      ])
      .select();

    if (error) {
      console.error("[API-RELEVES] Erreur Supabase :", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error("[API-RELEVES] Erreur fatale :", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/releves?id=...
 * Supprime un relevé de prix spécifique.
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("releves_prix")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
