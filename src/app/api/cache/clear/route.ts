import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ean = searchParams.get("ean");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (ean) {
      const { error } = await supabase.from("cache_prix").delete().eq("ean", ean);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Cache purgé pour l'EAN ${ean}` });
    } else {
      const { error } = await supabase.from("cache_prix").delete().neq("ean", "");
      if (error) throw error;
      return NextResponse.json({ success: true, message: "Tout le cache a été purgé" });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
