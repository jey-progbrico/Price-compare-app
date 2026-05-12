import { runSearch } from "@/lib/search/searchOrchestrator";
import { supabase } from "@/lib/supabase";
import type { SearchEvent, ProductInfo } from "@/lib/search/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/stream?ean=XXX
 *
 * Endpoint SSE (Server-Sent Events) pour la recherche de prix progressive.
 *
 * Événements émis :
 *   - cache_hit       : résultats cache disponibles immédiatement
 *   - source_start    : une source démarre (badge "running")
 *   - source_result   : un résultat live arrive (affichage progressif)
 *   - source_end      : une source termine (badge final)
 *   - done            : recherche terminée, stats complètes
 *   - error           : erreur fatale
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");
  const forceRefresh = searchParams.get("force") === "1";

  console.log(`[API] STREAM API CALLED | EAN: ${ean} | Force: ${forceRefresh}`);

  if (!ean) {
    return new Response("EAN manquant", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: SearchEvent) => {
        try {
          const sseData =
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          // Stream fermé côté client — ignorer
        }
      };

      try {
        // 1. Récupérer les infos produit depuis Supabase
        let product: ProductInfo = { ean };

        try {
          const { data: produit } = await supabase
            .from("produits")
            .select("marque, description_produit, reference_fabricant")
            .eq("numero_ean", ean)
            .single();

          if (produit) {
            product = {
              ean,
              marque: produit.marque ?? null,
              designation: produit.description_produit ?? null,
              reference_fabricant: produit.reference_fabricant ?? null,
            };
          }
        } catch (dbErr: any) {
          // Non bloquant : on peut chercher avec l'EAN seul
          console.warn("[Stream] Impossible de charger les infos produit:", dbErr.message);
        }

        // 2. Lancer la recherche via l'orchestrateur
        console.log(`[STREAM] Starting runSearch for EAN: ${ean}`);
        console.log("[STREAM RESPONSE START]");
        
        await runSearch(
          product,
          { force_refresh: forceRefresh },
          { 
            onEvent: (event) => {
              if (event.type === "source_result") {
                console.log(`[STREAM] Emitting result: ${event.result?.enseigne} | ${event.result?.prix}€`);
              }
              emit(event);
            }
          }
        );

        console.log("[STREAM RESPONSE END]");
      } catch (error: any) {
        console.log(`[STREAM] Fatal error: ${error.message}`);
        emit({ type: "error", message: error.message || "Erreur inconnue" });
      } finally {
        try {
          controller.close();
        } catch {
          // Déjà fermé
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Désactive le buffering Nginx/Vercel
    },
  });
}
