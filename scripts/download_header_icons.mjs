import fs from 'node:fs';
import path from 'node:path';

const ICONS = {
  brand: 'https://cdn-icons-png.flaticon.com/512/3642/3642114.png',
  price: 'https://cdn-icons-png.flaticon.com/512/2178/2178801.png',
  model: 'https://cdn-icons-png.flaticon.com/512/99/99488.png',
  cpu: 'https://cdn-icons-png.flaticon.com/512/2432/2432574.png',
  ram: 'https://cdn-icons-png.flaticon.com/512/7814/7814952.png',
  storage: 'https://cdn-icons-png.flaticon.com/512/542/542646.png',
  screen: 'https://cdn-icons-png.flaticon.com/512/11536/11536844.png',
  gpu: 'https://cdn-icons-png.flaticon.com/512/4617/4617745.png',
  apple: 'https://cdn-icons-png.flaticon.com/512/0/747.png',
};

const dirs = [
  'public/assets/promotional/icons',
  'src/assets/promotional/icons',
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadAll() {
  for (const [name, url] of Object.entries(ICONS)) {
    console.log(`Downloading ${name} from ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${name}: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    for (const dir of dirs) {
      const dest = path.join(dir, `${name}.png`);
      fs.writeFileSync(dest, buffer);
      console.log(`Saved ${dest} (${buffer.length} bytes)`);
    }
  }
  console.log('All icons successfully downloaded!');
}

downloadAll().catch(console.error);
