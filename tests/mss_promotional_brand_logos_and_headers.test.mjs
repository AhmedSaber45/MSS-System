import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PROMOTIONAL_HEADER_ICONS,
  PROMOTIONAL_BRAND_LOGOS,
  getBrandLogoConfig,
} from '../src/assets/promotional/promotionalAssets.ts';

test('1. Lenovo Logo Verification: Valid SVG with explicit dimensions, red background, white wordmark', () => {
  const lenovo = PROMOTIONAL_BRAND_LOGOS.lenovo;
  assert.ok(lenovo, 'Lenovo logo configuration must exist');
  assert.equal(lenovo.key, 'lenovo');
  assert.equal(lenovo.name, 'Lenovo');
  assert.equal(lenovo.type, 'svg');

  // Verify explicit dimensions
  assert.ok(lenovo.dimensions, 'Must have explicit dimensions');
  assert.equal(lenovo.dimensions.width, 66);
  assert.equal(lenovo.dimensions.height, 22);

  // Verify rawSvg structure
  const rawSvg = lenovo.rawSvg || '';
  assert.ok(rawSvg.includes('viewBox="0 7.997 24 8.006"'), 'Must have tight crop viewBox');
  assert.ok(rawSvg.includes('width="66"'), 'Must have explicit width attribute');
  assert.ok(rawSvg.includes('height="22"'), 'Must have explicit height attribute');
  assert.ok(rawSvg.includes('fill="#E2231A"'), 'Must have Lenovo brand red background');
  assert.ok(rawSvg.includes('fill="#FFFFFF"'), 'Must have pure white text fill');
  assert.ok(rawSvg.includes('fill-rule="evenodd"'), 'Must have evenodd fill-rule');

  // Ensure dataUri is non-empty and starts with data:image/svg+xml
  assert.ok(lenovo.dataUri.startsWith('data:image/svg+xml'), 'Must be a valid SVG data URI');
  assert.ok(lenovo.dataUri.length > 100, 'Data URI must contain complete vector data');

  // Verify brand matching for Lenovo and ThinkPad devices
  assert.equal(getBrandLogoConfig('Lenovo')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('lenovo')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('LENOVO')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('ThinkPad')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('ThinkPad T480')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig(' Lenovo ThinkPad X1 ')?.key, 'lenovo');
});

test('2. Audit All 17 Supported Brands: Exact mapping, valid dimensions, no broken assets', () => {
  const brandAuditList = [
    { brand: 'Apple', key: 'apple', expectedName: 'Apple' },
    { brand: 'Dell', key: 'dell', expectedName: 'Dell' },
    { brand: 'HP', key: 'hp', expectedName: 'HP' },
    { brand: 'Lenovo', key: 'lenovo', expectedName: 'Lenovo' },
    { brand: 'Asus', key: 'asus', expectedName: 'ASUS' },
    { brand: 'Acer', key: 'acer', expectedName: 'Acer' },
    { brand: 'Microsoft', key: 'microsoft', expectedName: 'Microsoft' },
    { brand: 'MSI', key: 'msi', expectedName: 'MSI' },
    { brand: 'Samsung', key: 'samsung', expectedName: 'Samsung' },
    { brand: 'Toshiba', key: 'toshiba', expectedName: 'Toshiba' },
    { brand: 'Huawei', key: 'huawei', expectedName: 'Huawei' },
    { brand: 'LG', key: 'lg', expectedName: 'LG' },
    { brand: 'Sony', key: 'sony', expectedName: 'Sony' },
    { brand: 'Fujitsu', key: 'fujitsu', expectedName: 'Fujitsu' },
    { brand: 'Alienware', key: 'alienware', expectedName: 'Alienware' },
    { brand: 'Razer', key: 'razer', expectedName: 'Razer' },
    { brand: 'Google', key: 'google', expectedName: 'Google' },
  ];

  for (const item of brandAuditList) {
    const config = getBrandLogoConfig(item.brand);
    assert.ok(config, `Brand "${item.brand}" must resolve to a valid logo config`);
    assert.equal(config.key, item.key, `Brand "${item.brand}" key must match "${item.key}"`);
    assert.equal(config.name, item.expectedName, `Brand "${item.brand}" name must match "${item.expectedName}"`);
    assert.ok(config.dataUri.startsWith('data:image/svg+xml'), `Brand "${item.brand}" must use local SVG data URI`);
    assert.ok(config.dimensions && config.dimensions.width > 0 && config.dimensions.height > 0, `Brand "${item.brand}" must have positive dimensions`);
    assert.ok(!config.dataUri.startsWith('http'), `Brand "${item.brand}" must not rely on external URLs at runtime`);
  }
});

test('3. Brand Aliases: Sub-brands and series resolve to correct brand logos', () => {
  const aliasMappings = [
    { input: 'MacBook Air M2', expectedKey: 'apple' },
    { input: 'MacBook Pro 16', expectedKey: 'apple' },
    { input: 'Hewlett-Packard ProBook', expectedKey: 'hp' },
    { input: 'ThinkPad T480', expectedKey: 'lenovo' },
    { input: 'ROG Zephyrus G14', expectedKey: 'asus' },
    { input: 'Predator Helios 300', expectedKey: 'acer' },
    { input: 'Surface Laptop 5', expectedKey: 'microsoft' },
    { input: 'Dynabook Satellite Pro', expectedKey: 'toshiba' },
    { input: 'VAIO SX14', expectedKey: 'sony' },
    { input: 'Pixelbook Go', expectedKey: 'google' },
    { input: 'Chromebook 14', expectedKey: 'google' },
  ];

  for (const mapping of aliasMappings) {
    const resolved = getBrandLogoConfig(mapping.input);
    assert.ok(resolved, `Series/Alias "${mapping.input}" must resolve to a logo`);
    assert.equal(resolved?.key, mapping.expectedKey, `Series/Alias "${mapping.input}" must map to key "${mapping.expectedKey}"`);
  }
});

test('4. Table Header Icons: Uniform #38bdf8 monochrome visual style across all columns', () => {
  const headers = [
    'brand',
    'price',
    'model',
    'processor',
    'generation',
    'ram',
    'storage',
    'screen',
    'gpu',
    'quantity',
  ];

  for (const h of headers) {
    const iconUri = PROMOTIONAL_HEADER_ICONS[h];
    assert.ok(iconUri, `Header icon "${h}" must exist`);
    assert.ok(iconUri.startsWith('data:image/svg+xml'), `Header icon "${h}" must be SVG data URI`);
    
    const decoded = decodeURIComponent(iconUri);
    // 1. All icons must use exactly #38bdf8 stroke color
    assert.ok(decoded.includes('stroke="#38bdf8"'), `Header icon "${h}" must use stroke="#38bdf8"`);
    // 2. Consistent stroke-width 1.8
    assert.ok(decoded.includes('stroke-width="1.8"'), `Header icon "${h}" must have stroke-width="1.8"`);
    // 3. Transparent background/no fill
    assert.ok(decoded.includes('fill="none"'), `Header icon "${h}" must have fill="none"`);
    // 4. Uniform 24x24 viewBox
    assert.ok(decoded.includes('viewBox="0 0 24 24"'), `Header icon "${h}" must have 24x24 viewBox`);
    // 5. No multicolored or filled inconsistencies
    assert.ok(!decoded.includes('#f59e0b'), `Header icon "${h}" must not contain amber/gold fill`);
    assert.ok(!decoded.includes('#ef4444'), `Header icon "${h}" must not contain red fill`);
    assert.ok(!decoded.includes('#8b5cf6'), `Header icon "${h}" must not contain purple fill`);
  }
});

test('5. Local Image Files Verification: Public and src brand files exist and are valid SVGs', () => {
  const brands = [
    'apple', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'microsoft',
    'msi', 'samsung', 'toshiba', 'huawei', 'lg', 'sony', 'fujitsu',
    'alienware', 'razer', 'google',
  ];

  for (const b of brands) {
    const pubPath = `public/assets/promotional/brands/${b}.svg`;
    const srcPath = `src/assets/promotional/brands/${b}.svg`;

    assert.ok(fs.existsSync(pubPath), `Public file ${pubPath} must exist`);
    assert.ok(fs.existsSync(srcPath), `Src file ${srcPath} must exist`);

    const pubContent = fs.readFileSync(pubPath, 'utf8');
    const srcContent = fs.readFileSync(srcPath, 'utf8');

    assert.ok(pubContent.startsWith('<svg'), `${pubPath} must be valid SVG`);
    assert.ok(srcContent.startsWith('<svg'), `${srcPath} must be valid SVG`);
    assert.ok(pubContent.includes('viewBox'), `${pubPath} must have viewBox`);
    assert.ok(pubContent.includes('width=') && pubContent.includes('height='), `${pubPath} must have width and height`);
  }
});
