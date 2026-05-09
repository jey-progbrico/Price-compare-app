const cheerio = require('cheerio');

async function testQwant(ean) {
  try {
    const response = await fetch(`https://lite.qwant.com/?q=${ean}+prix`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log("Qwant Results for: " + ean);
    $('.result-item').each((i, el) => {
       const title = $(el).find('h2 a').text().trim();
       const rawUrl = $(el).find('h2 a').attr('href');
       console.log("- " + title);
       console.log("  " + rawUrl);
    });
  } catch(e) {
    console.error(e);
  }
}

testQwant("3103220009574");
