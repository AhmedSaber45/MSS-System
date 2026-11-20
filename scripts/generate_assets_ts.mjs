import fs from 'node:fs';
import path from 'node:path';

function toBase64Png(relPath) {
  const full = path.resolve(relPath);
  const buf = fs.readFileSync(full);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function toBase64Svg(relPath) {
  const full = path.resolve(relPath);
  const str = fs.readFileSync(full, 'utf8');
  return `data:image/svg+xml;utf8,${encodeURIComponent(str)}`;
}

const headerIcons = {
  brand: toBase64Png('public/assets/promotional/icons/brand_blue.png'),
  price: toBase64Png('public/assets/promotional/icons/price_amber.png'),
  model: toBase64Png('public/assets/promotional/icons/model_blue.png'),
  processor: toBase64Png('public/assets/promotional/icons/cpu_blue.png'),
  generation: toBase64Png('public/assets/promotional/icons/cpu_blue.png'),
  ram: toBase64Png('public/assets/promotional/icons/ram_blue.png'),
  storage: toBase64Png('public/assets/promotional/icons/storage_blue.png'),
  screen: toBase64Png('public/assets/promotional/icons/screen_blue.png'),
  gpu: toBase64Png('public/assets/promotional/icons/gpu_blue.png'),
};

const brandFiles = fs.readdirSync('public/assets/promotional/brands');
const brandLogos = {};

for (const file of brandFiles) {
  const key = file.replace(/\.(svg|png)$/, '').toLowerCase();
  if (file.endsWith('.svg')) {
    brandLogos[key] = {
      type: 'svg',
      dataUri: toBase64Svg(`public/assets/promotional/brands/${file}`),
      rawSvg: fs.readFileSync(`public/assets/promotional/brands/${file}`, 'utf8'),
    };
  } else if (file.endsWith('.png')) {
    brandLogos[key] = {
      type: 'png',
      dataUri: toBase64Png(`public/assets/promotional/brands/${file}`),
    };
  }
}

const tsSource = `/**
 * COMPU MSS — Promotional Image Generator Local Assets
 * 
 * Contains locally embedded base64 data URIs for all Flaticon table header icons
 * and authentic brand logos.
 * 
 * Guaranteeing 100% offline availability, zero CORS issues, and synchronous
 * rendering in DOM preview, html-to-image PNG export, and PDF export.
 */

export interface BrandLogoConfig {
  key: string;
  name: string;
  type: 'png' | 'svg' | 'fallback';
  dataUri: string;
  rawSvg?: string;
  dimensions?: { width: number; height: number };
}

// 1. Table Header Icons (from Flaticon exact links)
export const PROMOTIONAL_HEADER_ICONS = {
  brand: ${JSON.stringify(headerIcons.brand)},
  price: ${JSON.stringify(headerIcons.price)},
  model: ${JSON.stringify(headerIcons.model)},
  processor: ${JSON.stringify(headerIcons.processor)},
  generation: ${JSON.stringify(headerIcons.generation)},
  ram: ${JSON.stringify(headerIcons.ram)},
  storage: ${JSON.stringify(headerIcons.storage)},
  screen: ${JSON.stringify(headerIcons.screen)},
  gpu: ${JSON.stringify(headerIcons.gpu)},
} as const;

// 2. Authentic Brand Logos
export const PROMOTIONAL_BRAND_LOGOS: Record<string, BrandLogoConfig> = {
  apple: {
    key: 'apple',
    name: 'Apple',
    type: 'png',
    dataUri: ${JSON.stringify(brandLogos.apple.dataUri)},
    dimensions: { width: 28, height: 28 },
  },
  dell: {
    key: 'dell',
    name: 'Dell',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.dell.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.dell.rawSvg)},
    dimensions: { width: 55, height: 22 },
  },
  hp: {
    key: 'hp',
    name: 'HP',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.hp.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.hp.rawSvg)},
    dimensions: { width: 30, height: 30 },
  },
  lenovo: {
    key: 'lenovo',
    name: 'Lenovo',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.lenovo.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.lenovo.rawSvg)},
    dimensions: { width: 62, height: 20 },
  },
  asus: {
    key: 'asus',
    name: 'ASUS',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.asus.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.asus.rawSvg)},
    dimensions: { width: 60, height: 18 },
  },
  acer: {
    key: 'acer',
    name: 'Acer',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.acer.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.acer.rawSvg)},
    dimensions: { width: 56, height: 18 },
  },
  microsoft: {
    key: 'microsoft',
    name: 'Microsoft',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.microsoft.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.microsoft.rawSvg)},
    dimensions: { width: 24, height: 24 },
  },
  msi: {
    key: 'msi',
    name: 'MSI',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.msi.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.msi.rawSvg)},
    dimensions: { width: 56, height: 20 },
  },
  samsung: {
    key: 'samsung',
    name: 'Samsung',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.samsung.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.samsung.rawSvg)},
    dimensions: { width: 65, height: 18 },
  },
  toshiba: {
    key: 'toshiba',
    name: 'Toshiba',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.toshiba.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.toshiba.rawSvg)},
    dimensions: { width: 62, height: 18 },
  },
  huawei: {
    key: 'huawei',
    name: 'Huawei',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.huawei.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.huawei.rawSvg)},
    dimensions: { width: 28, height: 28 },
  },
  lg: {
    key: 'lg',
    name: 'LG',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.lg.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.lg.rawSvg)},
    dimensions: { width: 28, height: 28 },
  },
  sony: {
    key: 'sony',
    name: 'Sony',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.sony.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.sony.rawSvg)},
    dimensions: { width: 56, height: 18 },
  },
  fujitsu: {
    key: 'fujitsu',
    name: 'Fujitsu',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.fujitsu.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.fujitsu.rawSvg)},
    dimensions: { width: 34, height: 26 },
  },
  alienware: {
    key: 'alienware',
    name: 'Alienware',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.alienware.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.alienware.rawSvg)},
    dimensions: { width: 26, height: 26 },
  },
  razer: {
    key: 'razer',
    name: 'Razer',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.razer.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.razer.rawSvg)},
    dimensions: { width: 28, height: 28 },
  },
  google: {
    key: 'google',
    name: 'Google',
    type: 'svg',
    dataUri: ${JSON.stringify(brandLogos.google.dataUri)},
    rawSvg: ${JSON.stringify(brandLogos.google.rawSvg)},
    dimensions: { width: 26, height: 26 },
  },
};

/**
 * Resolves authentic brand logo configuration for any brand name string.
 * Supports case-insensitivity, trimming, and common brand aliases.
 */
export function getBrandLogoConfig(brandRaw?: string | null): BrandLogoConfig | null {
  if (!brandRaw) return null;
  const b = brandRaw.trim().toLowerCase();

  if (b.includes('apple') || b.includes('macbook') || b.includes('mac')) {
    return PROMOTIONAL_BRAND_LOGOS.apple;
  }
  if (b.includes('dell')) {
    return PROMOTIONAL_BRAND_LOGOS.dell;
  }
  if (b.includes('hp') || b.includes('hewlett')) {
    return PROMOTIONAL_BRAND_LOGOS.hp;
  }
  if (b.includes('lenovo') || b.includes('thinkpad')) {
    return PROMOTIONAL_BRAND_LOGOS.lenovo;
  }
  if (b.includes('asus') || b.includes('rog')) {
    return PROMOTIONAL_BRAND_LOGOS.asus;
  }
  if (b.includes('acer') || b.includes('predator')) {
    return PROMOTIONAL_BRAND_LOGOS.acer;
  }
  if (b.includes('microsoft') || b.includes('surface')) {
    return PROMOTIONAL_BRAND_LOGOS.microsoft;
  }
  if (b.includes('msi')) {
    return PROMOTIONAL_BRAND_LOGOS.msi;
  }
  if (b.includes('samsung')) {
    return PROMOTIONAL_BRAND_LOGOS.samsung;
  }
  if (b.includes('toshiba') || b.includes('dynabook')) {
    return PROMOTIONAL_BRAND_LOGOS.toshiba;
  }
  if (b.includes('huawei')) {
    return PROMOTIONAL_BRAND_LOGOS.huawei;
  }
  if (b.includes('lg')) {
    return PROMOTIONAL_BRAND_LOGOS.lg;
  }
  if (b.includes('sony') || b.includes('vaio')) {
    return PROMOTIONAL_BRAND_LOGOS.sony;
  }
  if (b.includes('fujitsu')) {
    return PROMOTIONAL_BRAND_LOGOS.fujitsu;
  }
  if (b.includes('alienware')) {
    return PROMOTIONAL_BRAND_LOGOS.alienware;
  }
  if (b.includes('razer')) {
    return PROMOTIONAL_BRAND_LOGOS.razer;
  }
  if (b.includes('google') || b.includes('pixelbook') || b.includes('chromebook')) {
    return PROMOTIONAL_BRAND_LOGOS.google;
  }

  return null;
}
`;

fs.writeFileSync('src/assets/promotional/promotionalAssets.ts', tsSource, 'utf8');
console.log('Generated src/assets/promotional/promotionalAssets.ts successfully!');
