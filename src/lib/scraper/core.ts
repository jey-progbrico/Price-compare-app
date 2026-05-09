export type ScraperResult = {
  enseigne: string;
  titre: string;
  prix: string | null;
  lien: string;
  statut: "success" | "not_found" | "403_proxy_needed" | "error";
  erreur?: string;
  httpStatus?: number;
};

// Fonction de délai aléatoire pour humaniser les requêtes
export const delay = (min: number, max: number) => {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, ms));
};

export async function fetchWithStealth(url: string, options: RequestInit = {}): Promise<Response> {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
  ];
  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Timeout 15s

    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": randomUA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "max-age=0",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        ...options.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // On ne fait AUCUN retry automatique si on tombe sur un blocage (Furtivité absolue)
    if (response.status === 403 || response.status === 429 || response.status === 503) {
      throw new Error(`BLOCKED_${response.status}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("TIMEOUT");
    }
    throw error;
  }
}
