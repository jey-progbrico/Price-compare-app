import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function checkRLS() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Checking profiles table with anon client...");
  const { data, error } = await supabase.from("profiles").select("*").limit(5);
  
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profiles data:", data);
  }

  console.log("Checking historique_activites with anon client...");
  const { data: act, error: errAct } = await supabase.from("historique_activites").select("*").limit(5);
  if (errAct) {
    console.error("Error fetching activities:", errAct);
  } else {
    console.log("Activities data:", act);
  }
}

checkRLS();
