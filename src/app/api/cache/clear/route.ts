import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ean = searchParams.get("ean");

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
