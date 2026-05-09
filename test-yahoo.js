const cheerio = require('cheerio');

async function testYahoo(ean) {
  try {
    const response = await fetch(`https://fr.search.yahoo.com/search?p=${ean}+prix`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9",
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log("Yahoo Results for: " + ean);
    $('.algo').each((i, el) => {
       const title = $(el).find('h3.title a').text().trim();
       const rawUrl = $(el).find('h3.title a').attr('href');
       console.log("- " + title);
       console.log("  " + rawUrl);
    });
  } catch(e) {
    console.error(e);
  }
}

testYahoo("3103220009574");
