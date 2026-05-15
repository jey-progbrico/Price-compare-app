import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichWithProducts } from "@/lib/data-utils";
import { Activity } from "@/types/database";

/**
 * GET /api/activites
 * Récupère les dernières activités chronologiquement
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const { createClient: createSupabaseAdmin } = await import("@supabase/supabase-js");
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rawActivities, error } = await supabaseAdmin
      .from("historique_activites")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Jointure manuelle via le helper
    const activities = await enrichWithProducts((rawActivities as Activity[]) || []);

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
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { type_action, ean, details } = body;

    if (!type_action) {
      return NextResponse.json({ error: "Type d'action manquant" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("historique_activites")
      .insert([
        { 
          type_action, 
          ean, 
          details,
          user_id: user?.id || null, // Ensure we track who did what if column exists
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
