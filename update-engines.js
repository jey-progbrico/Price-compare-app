const fs = require('fs');
const path = require('path');

const dir = './src/lib/scraper/engines';
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.ts') && f !== 'duckduckgo.ts' && f !== '123elec.ts') {
    let content = fs.readFileSync(path.join(dir, f), 'utf8');
    
    // Replace catch block
    content = content.replace(
      /catch \(error: any\) \{/g,
      `catch (error: any) {\n    const match = error.message.match(/_(4\\d\\d|5\\d\\d)/);\n    if (match) result.httpStatus = parseInt(match[1]);\n    else result.httpStatus = 500;`
    );

    // Replace success
    content = content.replace(/result\.statut = "success";/g, 'result.statut = "success";\n      result.httpStatus = 200;');
    
    // Replace not_found
    content = content.replace(/result\.statut = "not_found";/g, 'result.statut = "not_found";\n      if(!result.httpStatus) result.httpStatus = 200;');

    fs.writeFileSync(path.join(dir, f), content);
  }
});
console.log("Done");
