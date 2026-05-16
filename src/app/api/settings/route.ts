import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/settings
 * Récupère tous les paramètres du magasin de l'utilisateur connecté
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le store_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();

    if (!profile?.store_id) {
      // Cas platform_admin sans store spécifique
      return NextResponse.json({}, { status: 200 });
    }

    // Récupérer les settings JSONB du store
    const { data: store, error } = await supabase
      .from("stores")
      .select("settings")
      .eq("id", profile.store_id)
      .single();

    if (error) throw error;

    const settings = store?.settings || {};
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Sauvegarde un ou plusieurs paramètres dans le magasin
 * Body: { [key: string]: any }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer les droits
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, store_id")
      .eq("id", user.id)
      .single();

    if (!profile || !profile.store_id) {
      return NextResponse.json({ error: "Aucun magasin associé" }, { status: 403 });
    }

    if (profile.role !== "admin" && profile.role !== "platform_admin" && profile.role !== "adherant") {
       return NextResponse.json({ error: "Droits insuffisants" }, { status: 403 });
    }

    // On accepte { key, value } (legacy) ou un objet complet
    const body = await request.json();
    let updates: Record<string, any> = {};

    if (body.key !== undefined && body.value !== undefined) {
      updates[body.key] = body.value;
    } else {
      updates = body;
    }

    // 1. Lire les anciens settings
    const { data: store } = await supabase
      .from("stores")
      .select("settings")
      .eq("id", profile.store_id)
      .single();

    const currentSettings = store?.settings || {};
    const newSettings = { ...currentSettings, ...updates };

    // 2. Sauvegarder
    const { error } = await supabase
      .from("stores")
      .update({ settings: newSettings })
      .eq("id", profile.store_id);

    if (error) throw error;

    return NextResponse.json({ success: true, settings: newSettings });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
