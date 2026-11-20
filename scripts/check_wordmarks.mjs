import fs from 'node:fs';

const wordmarks = ['lenovo', 'asus', 'acer', 'msi', 'samsung', 'toshiba', 'sony', 'fujitsu'];

for (const name of wordmarks) {
  const p = `public/assets/promotional/brands/${name}.svg`;
  const content = fs.readFileSync(p, 'utf8');
  console.log(`=== ${name} ===`);
  console.log(content.slice(0, 300));
}
