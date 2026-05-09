const cheerio = require('cheerio');

async function testBing(ean) {
  try {
    const response = await fetch(`https://www.bing.com/search?q=${ean}+prix`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log("Bing Results for: " + ean);
    $('.b_algo').each((i, el) => {
      const title = $(el).find('h2 a').text().trim();
      const rawUrl = $(el).find('h2 a').attr('href');
      console.log("- " + title);
      console.log("  " + rawUrl);
    });
  } catch(e) {
    console.error(e);
  }
}

async function testDDG(ean) {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${ean}+prix`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log("DDG Results for: " + ean);
    $('.result').each((i, el) => {
      const title = $(el).find('.result__title').text().trim();
      const rawUrl = $(el).find('.result__url').attr('href');
      console.log("- " + title);
      console.log("  " + rawUrl);
    });
  } catch(e) {
    console.error(e);
  }
}

testBing("3103220009574").then(() => testDDG("3103220009574"));
