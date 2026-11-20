import fs from 'node:fs';

const names = ['brand', 'price', 'model', 'cpu', 'ram', 'storage', 'screen', 'gpu', 'apple'];
for (const n of names) {
  const p = `public/assets/promotional/icons/${n}.png`;
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    console.log(`${n}.png: ${stat.size} bytes`);
  } else {
    console.log(`${n}.png: NOT FOUND`);
  }
}
