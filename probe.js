

async function probeSite(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      }
    });
    console.log(`\n=== PROBING ${url} ===`);
    console.log(`Status: ${response.status}`);
    const text = await response.text();
    
    // Check for SSR Hydration
    if (text.includes('__NEXT_DATA__')) {
       console.log("-> Uses Next.js SSR (__NEXT_DATA__ found)");
    }
    if (text.includes('window.__INITIAL_STATE__')) {
       console.log("-> Uses Redux/Vue SSR (__INITIAL_STATE__ found)");
    }
    if (text.includes('__APOLLO_STATE__')) {
       console.log("-> Uses Apollo GraphQL (__APOLLO_STATE__ found)");
    }
    
    // Check for common API endpoints in script tags
    const apiMatches = text.match(/https:\/\/[a-zA-Z0-9.-]*api[a-zA-Z0-9.-]*\.[a-z]{2,3}/g);
    if (apiMatches) {
       console.log("-> Potential API domains found:", [...new Set(apiMatches)]);
    }
    
    const algoliaMatches = text.match(/Algolia/i);
    if (algoliaMatches) {
       console.log("-> Algolia traces found");
    }

  } catch(e) {
    console.log(`Error probing ${url}: ${e.message}`);
  }
}

async function run() {
  await probeSite("https://www.manomano.fr/recherche/3103220009574");
  await probeSite("https://www.castorama.fr/search?term=3103220009574");
  await probeSite("https://www.leroymerlin.fr/v3/search/search.do?keyword=3103220009574");
  await probeSite("https://www.bricoman.fr/recherche?q=3103220009574");
}

run();
