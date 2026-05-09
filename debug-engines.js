const cheerio = require('cheerio');

async function test123elec(ean) {
  try {
    const res = await fetch(`https://www.123elec.com/catalogsearch/result/?q=${ean}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log("123elec HTML snippet:", html.substring(0, 200));
    const productItem = $('.product-item').first();
    console.log("123elec item length:", productItem.length);
    if(productItem.length) {
      console.log("123elec title:", productItem.find('.product-item-link').text().trim());
      console.log("123elec price text:", productItem.find('.price').text());
    }
  } catch(e) {
    console.log("123elec err:", e);
  }
}

async function testCastorama(ean) {
  try {
    const res = await fetch(`https://www.castorama.fr/search?term=${ean}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log("Castorama HTML snippet:", html.substring(0, 200));
    console.log("Castorama items:", $('[data-test-id="product-card"]').length);
  } catch(e) {
    console.log("Castorama err:", e);
  }
}

test123elec("3103220009574").then(() => testCastorama("3103220009574"));
