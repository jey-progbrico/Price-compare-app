import { createClient } from '@supabase/supabase-js'

// 1. Nettoyage et Sanitarisation stricte de l'URL
let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Retrait des espaces avant/après
rawUrl = rawUrl.trim();
// Retrait des guillemets accidentels
rawUrl = rawUrl.replace(/"/g, '').replace(/'/g, '');
// Retrait du slash de fin qui pourrait casser la concaténation
if (rawUrl.endsWith('/')) {
  rawUrl = rawUrl.slice(0, -1);
}

const supabaseUrl = rawUrl;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().replace(/"/g, '').replace(/'/g, '') : "";

// Si URL vide après nettoyage, on le signale clairement
if (!supabaseUrl || !supabaseKey) {
  console.error("⚠️ ERREUR CRITIQUE: NEXT_PUBLIC_SUPABASE_URL ou ANON_KEY manquant ou vide après nettoyage !");
  console.error("URL nettoyée:", supabaseUrl ? "[MASQUÉE]" : "VIDE");
} else {
  console.log("✅ Supabase URL Initialized:", supabaseUrl);
}

// 2. Intercepteur Fetch personnalisé pour logger TOUTES les requêtes Supabase
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
  const urlString = url.toString();
  const method = options?.method || "GET";
  
  // Extraire le nom de la table de l'URL si c'est du REST
  let targetTable = "inconnue";
  const restMatch = urlString.match(/\/rest\/v1\/([^?]+)/);
  if (restMatch && restMatch[1]) {
    targetTable = restMatch[1];
  }

  console.log(`\n🔵 [Supabase Request] ${method} -> ${targetTable}`);
  console.log(`   URL Complète: ${urlString}`);
  
  if (options?.body) {
    try {
      console.log(`   Payload:`, JSON.parse(options.body as string));
    } catch {
      console.log(`   Payload:`, options.body);
    }
  }

  try {
    const response = await fetch(url, options);
    console.log(`🟢 [Supabase Response] HTTP ${response.status} | URL: ${urlString}`);
    if (!response.ok) {
      console.error(`🔴 [Supabase Error] HTTP ${response.status} | URL: ${urlString}`);
      // Clone response to read text without consuming the stream for Supabase SDK
      const clone = response.clone();
      const text = await clone.text();
      console.error(`   Error details:`, text);
    }
    return response;
  } catch (err: any) {
    console.error(`🔴 [Supabase Fetch Crash] ${method} -> ${urlString}`);
    console.error(`   Exception Technique:`, err.message || err);
    throw err;
  }
};

export const supabase = createClient(supabaseUrl || "https://invalid.supabase.co", supabaseKey || "invalid_key", {
  global: {
    fetch: customFetch,
  }
})
