import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditTables() {
  console.log("--- AUDIT DES TABLES ---");
  
  // Requête pour lister les tables publiques, si RLS est activé, et si store_id est présent
  const query = `
    SELECT 
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      (SELECT count(*) > 0 FROM information_schema.columns col WHERE col.table_name = c.relname AND col.column_name = 'store_id') as has_store_id
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `;

  // Since we cannot run raw SQL easily via JS client, we'll use a postgrest rpc if available, or just fetch via REST.
  // Wait, the easiest way to run SQL locally without RPC is via `npx supabase db psql` or directly using the pg library.
  // But wait! `supabase` client can't execute raw SQL directly unless we use an RPC.
  console.log("Use npx supabase db psql to run this query instead.");
}

auditTables().catch(console.error);
