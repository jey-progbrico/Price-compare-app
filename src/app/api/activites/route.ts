import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichWithProducts } from "@/lib/data-utils";
import { Activity } from "@/types/database";

/**
 * GET /api/activites
 * Récupère les dernières activités chronologiquement, isolées par store_id
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    // 1. Authentification et Profil
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, store_id")
      .eq("id", user.id)
      .single();

    const isPlatformAdmin = profile?.role === "platform_admin";
    const storeId = profile?.store_id;

    // 2. Client Admin pour l'historique (accès aux profils tiers pour display_name)
    const { createClient: createSupabaseAdmin } = await import("@supabase/supabase-js");
    const supabaseAdmin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabaseAdmin
      .from("historique_activites")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit);

    // 3. Isolation SaaS : Filtrage par store (sauf Platform Admin)
    if (!isPlatformAdmin && storeId) {
      query = query.eq("store_id", storeId);
    }

    const { data: rawActivities, error } = await query;
    if (error) throw error;

    // 4. Jointure manuelle via le helper pour les produits
    const activities = await enrichWithProducts((rawActivities as Activity[]) || []);

    return NextResponse.json(activities);
  } catch (err: any) {
    console.error("[ACTIVITES GET ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/activites
 * Enregistre une nouvelle activité isolée par store_id
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
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    // Récupérer le store_id de l'auteur pour l'isolation
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();

    const { data, error } = await supabase
      .from("historique_activites")
      .insert([
        { 
          type_action, 
          ean, 
          details,
          user_id: user.id,
          store_id: profile?.store_id,
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
