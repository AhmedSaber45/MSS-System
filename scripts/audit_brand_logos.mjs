import fs from 'node:fs';
import path from 'node:path';

const brandDir = 'public/assets/promotional/brands';
const files = fs.readdirSync(brandDir);

console.log('--- Brand Assets Audit ---');
for (const f of files) {
  const full = path.join(brandDir, f);
  const stat = fs.statSync(full);
  if (f.endsWith('.svg')) {
    const content = fs.readFileSync(full, 'utf8');
    const vb = content.match(/viewBox=["']([^"']+)["']/)?.[1] || 'none';
    const hasWidth = content.includes('width=');
    const hasHeight = content.includes('height=');
    console.log(`${f.padEnd(16)} | size: ${stat.size}B | viewBox: ${vb} | width: ${hasWidth} | height: ${hasHeight}`);
  } else if (f.endsWith('.png')) {
    const buf = fs.readFileSync(full);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    console.log(`${f.padEnd(16)} | size: ${stat.size}B | PNG: ${w}x${h}`);
  }
}
