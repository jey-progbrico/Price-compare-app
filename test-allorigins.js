const cheerio = require('cheerio');

async function testAllOrigins(ean) {
  try {
    const targetUrl = `https://html.duckduckgo.com/html/?q=${ean}+prix`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl);
    const data = await response.json();
    const html = data.contents;
    
    const $ = cheerio.load(html);
    
    console.log("AllOrigins Results for: " + ean);
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

testAllOrigins("3103220009574");
