import { supabase } from "./src/lib/supabase";

async function checkColumns() {
  const { data, error } = await supabase.from("produits").select("*").limit(1);
  if (data && data.length > 0) {
    console.log("COLUMNS:", Object.keys(data[0]));
  } else {
    console.log("No data or error:", error);
  }
}

checkColumns();
