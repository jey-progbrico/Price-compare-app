/**
 * queue.ts — Façade de compatibilité
 *
 * Ce fichier est une façade vers le nouveau searchOrchestrator.
 * Il est conservé pour compatibilité avec tout code externe qui
 * importerait encore directement depuis ce chemin.
 *
 * @deprecated Utiliser directement `@/lib/search/searchOrchestrator`
 */
export { processScrapingQueue } from "@/lib/search/searchOrchestrator";
