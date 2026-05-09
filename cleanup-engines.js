const fs = require('fs');
const path = require('path');

const dir = './src/lib/scraper/engines';
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.ts')) {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    
    // Remove duplicate cheerio imports
    const lines = content.split('\n');
    const newLines = [];
    let cheerioImported = false;
    for (const line of lines) {
      if (line.includes('import * as cheerio from "cheerio"')) {
        if (cheerioImported) continue;
        cheerioImported = true;
      }
      newLines.push(line);
    }
    
    content = newLines.join('\n');
    fs.writeFileSync(path.join(dir, f), content);
  }
});
console.log("Cleanup done");
