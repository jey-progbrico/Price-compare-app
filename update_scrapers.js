const fs = require('fs');
const path = './src/lib/scraper/engines';
const files = fs.readdirSync(path);

files.forEach(f => {
  if (f.endsWith('.ts')) {
    let c = fs.readFileSync(path + '/' + f, 'utf8');
    c = c.replace(/ean: string/g, 'query: string');
    c = c.split('${ean}').join('${encodeURIComponent(query)}');
    
    // Pour duckduckgo, s'il y a un paramètre ean utilisé comme titre, on peut le garder, mais changeons tout en query
    c = c.split('ean').join('query');
    c = c.split('Query').join('Ean'); // revert duckduckgo's "query" if any

    fs.writeFileSync(path + '/' + f, c);
  }
});
console.log('Done');
