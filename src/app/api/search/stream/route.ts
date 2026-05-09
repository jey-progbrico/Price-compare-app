import { processScrapingQueue } from "@/lib/scraper/queue";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get("ean");

  if (!ean) {
    return new Response("EAN manquant", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. Récupérer les infos du produit
        const { data: produit } = await supabase
          .from("produits")
          .select("marque, description_produit, reference_fabricant")
          .eq("numero_ean", ean)
          .single();

        const productInfos = produit ? {
          marque: produit.marque,
          designation: produit.description_produit,
          reference_fabricant: produit.reference_fabricant
        } : undefined;

        // 2. Exécuter la file avec callbacks progress
        const { results, debugLogs } = await processScrapingQueue(ean, productInfos, (event, data) => {
          emit(event, data);
        });

        // 3. Envoyer le message de fin
        emit('done', { results, debugLogs });

      } catch (error: any) {
        console.error("Erreur SSE:", error);
        emit('error', { message: error.message || "Erreur inconnue" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
