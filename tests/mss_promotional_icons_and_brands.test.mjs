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

test('1. Flaticon Table Header Icons: All 8 required icons are present and valid base64 PNGs', () => {
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
  ];

  for (const key of expectedKeys) {
    const dataUri = PROMOTIONAL_HEADER_ICONS[key];
    assert.ok(dataUri, `Header icon "${key}" should be defined`);
    assert.ok(
      dataUri.startsWith('data:image/png;base64,'),
      `Header icon "${key}" should be a base64 PNG data URI`
    );
    assert.ok(dataUri.length > 100, `Header icon "${key}" dataUri should not be empty`);
  }
});

test('2. Apple Brand Logo: Flaticon 747 logo is configured and resolves properly', () => {
  const appleConfig = PROMOTIONAL_BRAND_LOGOS.apple;
  assert.ok(appleConfig, 'Apple logo config should exist');
  assert.equal(appleConfig.key, 'apple');
  assert.equal(appleConfig.name, 'Apple');
  assert.equal(appleConfig.type, 'png');
  assert.ok(
    appleConfig.dataUri.startsWith('data:image/png;base64,'),
    'Apple logo should be a base64 PNG data URI'
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

test('3. Complete Brand Logo Coverage: Every supported Compu MSS brand has authentic logo', () => {
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

test('4. Graceful fallback for unrecognized/test brand names', () => {
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

test('5. Local File System Verification: All asset files exist in public/ and src/', () => {
  const publicIcons = [
    'public/assets/promotional/icons/brand.png',
    'public/assets/promotional/icons/price.png',
    'public/assets/promotional/icons/model.png',
    'public/assets/promotional/icons/cpu.png',
    'public/assets/promotional/icons/ram.png',
    'public/assets/promotional/icons/storage.png',
    'public/assets/promotional/icons/screen.png',
    'public/assets/promotional/icons/gpu.png',
    'public/assets/promotional/icons/apple.png',
    'public/assets/promotional/icons/apple_white.png',
  ];

  for (const p of publicIcons) {
    assert.ok(fs.existsSync(p), `Asset file should exist locally: ${p}`);
    const stat = fs.statSync(p);
    assert.ok(stat.size > 0, `Asset file should not be empty: ${p}`);
  }

  const publicBrands = [
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
