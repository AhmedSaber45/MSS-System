import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load promotional assets module
import {
  PROMOTIONAL_HEADER_ICONS,
  PROMOTIONAL_BRAND_LOGOS,
  getBrandLogoConfig,
} from '../src/assets/promotional/promotionalAssets.ts';

test('1. Unified Table Header Icons: All 10 headers share consistent monochrome #38bdf8 style', () => {
  const expectedKeys = [
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

  for (const key of expectedKeys) {
    const dataUri = PROMOTIONAL_HEADER_ICONS[key];
    assert.ok(dataUri, `Header icon "${key}" should be defined`);
    assert.ok(
      dataUri.startsWith('data:image/svg+xml'),
      `Header icon "${key}" should be a valid SVG data URI`
    );
    assert.ok(dataUri.length > 50, `Header icon "${key}" dataUri should not be empty`);
    
    // Decode and verify stroke color is unified #38bdf8
    const decoded = decodeURIComponent(dataUri);
    assert.ok(
      decoded.includes('#38bdf8') || decoded.includes('%2338bdf8'),
      `Header icon "${key}" should use unified monochrome Sky-Blue #38bdf8 color`
    );
    assert.ok(
      decoded.includes('width="24"') && decoded.includes('height="24"'),
      `Header icon "${key}" should have consistent 24x24 dimensions`
    );
    // Ensure no yellow/red or purple filled styles remain
    assert.ok(!decoded.includes('#f59e0b'), `Header icon "${key}" must not use amber/gold`);
    assert.ok(!decoded.includes('#8b5cf6'), `Header icon "${key}" must not use purple`);
  }
});

test('2. Apple Brand Logo: White Apple vector logo for dark circle badge', () => {
  const appleConfig = PROMOTIONAL_BRAND_LOGOS.apple;
  assert.ok(appleConfig, 'Apple logo config should exist');
  assert.equal(appleConfig.key, 'apple');
  assert.equal(appleConfig.name, 'Apple');
  assert.equal(appleConfig.type, 'svg');
  assert.ok(
    appleConfig.dataUri.startsWith('data:image/svg+xml'),
    'Apple logo should be an SVG data URI'
  );
  assert.ok(
    appleConfig.rawSvg?.includes('fill="#FFFFFF"') || appleConfig.dataUri.includes('%23FFFFFF'),
    'Apple logo should have white fill for high-contrast rendering on dark circle badge'
  );

  // Test resolution with various Apple device brand strings
  const testStrings = [
    'Apple',
    'apple',
    'APPLE',
    'Apple Inc.',
    'MacBook',
    'MacBook Air M2',
    'mac',
  ];

  for (const str of testStrings) {
    const resolved = getBrandLogoConfig(str);
    assert.ok(resolved, `Should resolve Apple logo config for "${str}"`);
    assert.equal(resolved?.key, 'apple');
  }
});

test('3. Lenovo Brand Logo: Red rectangular badge with white wordmark', () => {
  const lenovoConfig = PROMOTIONAL_BRAND_LOGOS.lenovo;
  assert.ok(lenovoConfig, 'Lenovo logo config should exist');
  assert.equal(lenovoConfig.key, 'lenovo');
  assert.equal(lenovoConfig.name, 'Lenovo');
  assert.equal(lenovoConfig.type, 'svg');
  assert.ok(
    lenovoConfig.dataUri.startsWith('data:image/svg+xml'),
    'Lenovo logo should be an SVG data URI'
  );
  
  // Ensure it has explicit width and height so canvas and DOM don't collapse
  assert.ok(lenovoConfig.dimensions, 'Lenovo logo should have explicit dimensions');
  assert.ok(lenovoConfig.dimensions.width > 0 && lenovoConfig.dimensions.height > 0);

  // Verify red background rect and white text path
  assert.ok(lenovoConfig.rawSvg?.includes('fill="#E2231A"'), 'Lenovo SVG must have red #E2231A background');
  assert.ok(lenovoConfig.rawSvg?.includes('fill="#FFFFFF"'), 'Lenovo SVG must have white #FFFFFF wordmark text');
  // Ensure the full-box mask is removed so letters are crisp white
  assert.ok(!lenovoConfig.rawSvg?.includes('M24 7.997v8.006H0V7.997h24z'), 'Lenovo SVG should not have inverted box path');

  // Test aliases
  assert.equal(getBrandLogoConfig('Lenovo')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('lenovo')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('ThinkPad T480')?.key, 'lenovo');
  assert.equal(getBrandLogoConfig('thinkpad')?.key, 'lenovo');
});

test('4. Complete Brand Logo Coverage: Every supported Compu MSS brand has authentic logo', () => {
  const supportedBrands = [
    'Apple',
    'Dell',
    'HP',
    'Hewlett-Packard',
    'Lenovo',
    'ThinkPad',
    'Asus',
    'ROG',
    'Acer',
    'Predator',
    'Microsoft',
    'Surface',
    'MSI',
    'Samsung',
    'Toshiba',
    'Dynabook',
    'Huawei',
    'LG',
    'Sony',
    'VAIO',
    'Fujitsu',
    'Alienware',
    'Razer',
    'Google',
    'Pixelbook',
  ];

  for (const brand of supportedBrands) {
    const resolved = getBrandLogoConfig(brand);
    assert.ok(resolved, `Should resolve authentic logo for brand "${brand}"`);
    assert.ok(resolved.dataUri, `Brand "${brand}" should have valid dataUri`);
    assert.ok(resolved.dimensions, `Brand "${brand}" should have specified dimensions`);
  }
});

test('5. Graceful fallback for unrecognized/test brand names', () => {
  const unrecognized = ['LAptop tets', 'Unknown Brand', 'CustomDIY', ''];
  for (const str of unrecognized) {
    const resolved = getBrandLogoConfig(str);
    assert.equal(
      resolved,
      null,
      `Unrecognized brand "${str}" should safely return null for fallback handling`
    );
  }
});

test('6. Local File System Verification: All asset files exist in public/ and src/', () => {
  const publicBrands = [
    'public/assets/promotional/brands/apple.svg',
    'public/assets/promotional/brands/dell.svg',
    'public/assets/promotional/brands/hp.svg',
    'public/assets/promotional/brands/lenovo.svg',
    'public/assets/promotional/brands/asus.svg',
    'public/assets/promotional/brands/acer.svg',
    'public/assets/promotional/brands/microsoft.svg',
    'public/assets/promotional/brands/msi.svg',
    'public/assets/promotional/brands/samsung.svg',
    'public/assets/promotional/brands/toshiba.svg',
    'public/assets/promotional/brands/huawei.svg',
    'public/assets/promotional/brands/lg.svg',
    'public/assets/promotional/brands/sony.svg',
    'public/assets/promotional/brands/fujitsu.svg',
    'public/assets/promotional/brands/alienware.svg',
    'public/assets/promotional/brands/razer.svg',
    'public/assets/promotional/brands/google.svg',
  ];

  for (const p of publicBrands) {
    assert.ok(fs.existsSync(p), `Brand SVG file should exist locally: ${p}`);
    const stat = fs.statSync(p);
    assert.ok(stat.size > 0, `Brand SVG file should not be empty: ${p}`);
  }
});
