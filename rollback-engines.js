const fs = require('fs');
const path = require('path');

const dir = './src/lib/scraper/engines';
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.ts')) {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    
    // Remplacement des imports
    content = content.replace(/import \{ fetchViaDecodo, ScraperResult \} from "\.\.\/decodo";/g, 'import { fetchWithStealth, ScraperResult } from "../core";\nimport * as cheerio from "cheerio";');
    content = content.replace(/import \{ fetchWithRetry, ScraperResult \} from "\.\.\/core";/g, 'import { fetchWithStealth, ScraperResult } from "../core";');
    
    // Remplacement de l'appel
    content = content.replace(/await fetchViaDecodo\(/g, 'await fetchWithStealth(');
    content = content.replace(/await fetchWithRetry\(/g, 'await fetchWithStealth(');
    
    // Remplacement extraction HTML
    content = content.replace(/const html = response\.html;/g, 'const html = await response.text();');
    
    // Suppression des references specifiques a Decodo
    content = content.replace(/result\.mode_utilise = response\.mode;/g, '');
    content = content.replace(/if \(response\.status === 403 \|\| response\.status === 503\) \{\s*result\.statut = "403_proxy_needed";\s*result\.erreur = "Protection anti-bot bloquante via Decodo\.";\s*return result;\s*\}/g, '');
    
    // Gestion erreurs spécifiques à core.ts
    content = content.replace(/catch \(error: any\) \{/g, 'catch (error: any) {');
    content = content.replace(/result\.httpStatus = 500;/g, 'const match = error.message.match(/_(4\\d\\d|5\\d\\d)/);\n    if (match) result.httpStatus = parseInt(match[1]);\n    else result.httpStatus = 500;\n    if (error.message.includes("BLOCKED")) result.statut = "403_proxy_needed";');
    
    fs.writeFileSync(path.join(dir, f), content);
  }
});
console.log("Engines rolled back");
