import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

// Pattern singleton robuste pour survivre au Hot Reload / Turbopack
const globalForSupabase = globalThis as unknown as {
  supabaseBrowserClient: SupabaseClient | undefined
}

export function createClient() {
  // SSR : Toujours créer une nouvelle instance pour l'isolation
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // Browser : Singleton persistant (même après HMR)
  if (!globalForSupabase.supabaseBrowserClient) {
    globalForSupabase.supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return globalForSupabase.supabaseBrowserClient;
}
