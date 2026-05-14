import { createClient } from '@supabase/supabase-js'

// 1. Nettoyage et Sanitarisation stricte de l'URL
let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
rawUrl = rawUrl.trim().replace(/"/g, '').replace(/'/g, '');
if (rawUrl.endsWith('/')) rawUrl = rawUrl.slice(0, -1);

const supabaseUrl = rawUrl;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().replace(/"/g, '').replace(/'/g, '') : "";

// 2. Intercepteur Fetch personnalisé
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const urlString = url.toString();
  const method = options?.method || "GET";
  
  if (typeof window !== 'undefined') {
    // Logging uniquement côté client pour le debug
    let targetTable = "inconnue";
    const restMatch = urlString.match(/\/rest\/v1\/([^?]+)/);
    if (restMatch && restMatch[1]) targetTable = restMatch[1];
    
    console.log(`🔵 [Supabase Request] ${method} -> ${targetTable}`);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok && typeof window !== 'undefined') {
      console.error(`🔴 [Supabase Error] HTTP ${response.status} | URL: ${urlString}`);
    }
    return response;
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      console.error(`🔴 [Supabase Fetch Crash] ${method} -> ${urlString}`);
    }
    throw err;
  }
};

// 3. Singleton Robuste pour survivre au Hot Reload
const globalForSupabase = globalThis as unknown as {
  supabaseInstance: any | undefined
}

const getSupabase = () => {
  // SSR : Nouvelle instance
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl || "https://invalid.supabase.co", supabaseKey || "invalid_key", {
      global: { fetch: customFetch }
    });
  }

  // Client : Singleton persistant
  if (!globalForSupabase.supabaseInstance) {
    globalForSupabase.supabaseInstance = createClient(supabaseUrl || "https://invalid.supabase.co", supabaseKey || "invalid_key", {
      global: { fetch: customFetch }
    });
  }
  return globalForSupabase.supabaseInstance;
};

export const supabase = getSupabase();
