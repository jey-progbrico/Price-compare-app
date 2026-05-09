const cheerio = require('cheerio');

async function testDDGLite(ean) {
  try {
    const response = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: `q=${ean}+prix`
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    console.log("DDG Lite Results for: " + ean);
    $('.result-snippet').each((i, el) => {
       console.log("- " + $(el).text().trim());
    });
    $('.result-url').each((i, el) => {
       console.log("  " + $(el).attr('href'));
    });
  } catch(e) {
    console.error(e);
  }
}

testDDGLite("3103220009574");
