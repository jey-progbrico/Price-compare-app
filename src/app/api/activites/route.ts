import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { enrichWithProducts } from "@/lib/data-utils";

/**
 * GET /api/activites
 * Récupère les dernières activités chronologiquement
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const { data: rawActivities, error } = await supabase
      .from("historique_activites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Jointure manuelle via le helper
    const activities = await enrichWithProducts(rawActivities || []);

    return NextResponse.json(activities);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/activites
 * Enregistre une nouvelle activité
 * Body: { type_action: string, ean?: string, details?: object }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type_action, ean, details } = body;

    if (!type_action) {
      return NextResponse.json({ error: "Type d'action manquant" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("historique_activites")
      .insert([
        { 
          type_action, 
          ean, 
          details,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(data[0]);
  } catch (err: any) {
    console.error("[ACTIVITY LOG ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
