import fs from 'node:fs';

const brandDir = 'public/assets/promotional/brands';
const files = fs.readdirSync(brandDir);

for (const f of files) {
  if (f.endsWith('.svg')) {
    const content = fs.readFileSync(brandDir + '/' + f, 'utf8');
    // Extract paths and numbers to find Y min and Y max
    const numbers = content.match(/[-+]?\d*\.?\d+/g)?.map(Number) || [];
    console.log(f.padEnd(16), 'content sample:', content.slice(0, 120));
  }
}
