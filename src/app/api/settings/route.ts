import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Setting } from "@/types/database";

/**
 * GET /api/settings
 * Récupère tous les paramètres
 */
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("key, value");

    if (error) throw error;

    // Convertir en objet simple { [key]: value }
    const settings = (data as Setting[]).reduce<Record<string, string>>((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    console.log("[SETTINGS LOADED]", settings);
    return NextResponse.json(settings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/settings
 * Sauvegarde un paramètre
 * Body: { key: string, value: string }
 */
export async function POST(request: Request) {
  try {
    const { key, value } = await request.json();

    if (!key) {
      return NextResponse.json({ error: "Clé manquante" }, { status: 400 });
    }

    const { error } = await supabase
      .from("settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) throw error;

    console.log(`[SETTINGS SAVED] ${key} = ${value}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
