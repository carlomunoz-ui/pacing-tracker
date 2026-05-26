const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes("activeTab === 'op-analysis' && ("));
let d = 0;
for (let i = startIdx; i < lines.findIndex(l => l.includes("CAMPAIGN DRAWER")); i++) {
   const l = lines[i];
   if (l.includes('//')) continue;
   let opMatch = l.match(/<div[ \n>]/g) || [];
   let clMatch = l.match(/<\/div>/g) || [];
   if (opMatch.length > 0 || clMatch.length > 0) {
      d += opMatch.length;
      d -= clMatch.length;
      console.log(`${i+1}: +${opMatch.length} -${clMatch.length} (d=${d})`);
   }
}



