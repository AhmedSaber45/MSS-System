import fs from 'node:fs';
import path from 'node:path';

const BRAND_URLS = {
  dell: 'https://cdn.simpleicons.org/dell/0076CE',
  hp: 'https://cdn.simpleicons.org/hp/0096D6',
  lenovo: 'https://cdn.simpleicons.org/lenovo/E2231A',
  asus: 'https://cdn.simpleicons.org/asus/00539B',
  acer: 'https://cdn.simpleicons.org/acer/83B81A',
  microsoft: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
  msi: 'https://cdn.simpleicons.org/msi/FF0000',
  samsung: 'https://cdn.simpleicons.org/samsung/1428A0',
  toshiba: 'https://cdn.simpleicons.org/toshiba/FF0000',
  huawei: 'https://cdn.simpleicons.org/huawei/FF0000',
  lg: 'https://cdn.simpleicons.org/lg/A50034',
  sony: 'https://cdn.simpleicons.org/sony/000000',
  fujitsu: 'https://cdn.simpleicons.org/fujitsu/FF0000',
  alienware: 'https://cdn.simpleicons.org/alienware/000000',
  razer: 'https://cdn.simpleicons.org/razer/00FF00',
  google: 'https://cdn.simpleicons.org/google/4285F4',
};

const dirs = [
  'public/assets/promotional/brands',
  'src/assets/promotional/brands',
];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadBrands() {
  for (const [name, url] of Object.entries(BRAND_URLS)) {
    console.log(`Downloading ${name} from ${url}...`);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      console.error(`Failed ${name}: ${res.status}`);
      continue;
    }
    const text = await res.text();
    for (const dir of dirs) {
      const dest = path.join(dir, `${name}.svg`);
      fs.writeFileSync(dest, text, 'utf8');
      console.log(`Saved ${dest} (${text.length} chars)`);
    }
  }

  // Also copy apple.png into brands folder
  const appleSrc = 'public/assets/promotional/icons/apple.png';
  if (fs.existsSync(appleSrc)) {
    const appleBuf = fs.readFileSync(appleSrc);
    for (const dir of dirs) {
      fs.writeFileSync(path.join(dir, 'apple.png'), appleBuf);
      console.log(`Copied apple.png to ${dir}`);
    }
  }
  console.log('All brand logos processed successfully!');
}

downloadBrands().catch(console.error);
