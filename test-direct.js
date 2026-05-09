const cheerio = require('cheerio');

async function testDirect(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      }
    });
    console.log(url + " => Status: " + response.status);
    const text = await response.text();
    if (text.includes("Cloudflare") || text.includes("DataDome") || text.includes("captcha")) {
       console.log("=> BLOCKED by bot protection.");
    } else {
       console.log("=> HTML received (" + text.length + " chars)");
    }
  } catch(e) {
    console.error(url + " => Error: " + e.message);
  }
}

async function run() {
  await testDirect("https://www.bricoman.fr/recherche?q=3103220009574");
  await testDirect("https://www.leroymerlin.fr/v3/search/search.do?keyword=3103220009574");
  await testDirect("https://www.123elec.com/catalogsearch/result/?q=3103220009574");
}

run();
