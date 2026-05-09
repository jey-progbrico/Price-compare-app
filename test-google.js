const cheerio = require('cheerio');

async function scrapeGoogle(ean) {
  try {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.google.com/search?q=' + ean + '+prix')}`;
    const res = await fetch(url);
    const data = await res.json();
    const html = data.contents;
    const $ = cheerio.load(html);

    console.log("Google Results:");
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text();
      if(href && href.startsWith('/url?q=')) {
         console.log(text.trim() + " -> " + href);
      }
    });
  } catch(e) {
    console.log("Error:", e);
  }
}

scrapeGoogle("3103220009574");
