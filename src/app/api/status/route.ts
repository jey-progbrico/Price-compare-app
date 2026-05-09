import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('statut_concurrents')
      .select('*')
      .order('score_fiabilite', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, statuses: data || [] });
  } catch (error: any) {
    console.error("Erreur récupération statut:", error);
    return NextResponse.json(
      { success: false, error: "Impossible de récupérer les statuts" },
      { status: 500 }
    );
  }
}
