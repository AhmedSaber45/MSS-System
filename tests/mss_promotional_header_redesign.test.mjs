import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Load promotional assets module
import { PROMOTIONAL_HEADER_ASSETS } from '../src/assets/promotional/promotionalAssets.ts';

test('1. PROMOTIONAL_HEADER_ASSETS: Static header banner and commercial assets exist with valid data URIs', () => {
  assert.ok(PROMOTIONAL_HEADER_ASSETS, 'PROMOTIONAL_HEADER_ASSETS must exist');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.banner, 'Static COMPU MSS header banner must exist');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.logo, 'Official COMPU MSS logo must exist');

  assert.ok(
    PROMOTIONAL_HEADER_ASSETS.banner.startsWith('data:image/jpeg;base64,'),
    'Static banner must be a base64 JPEG data URI'
  );
  assert.ok(
    PROMOTIONAL_HEADER_ASSETS.logo.startsWith('data:image/png;base64,'),
    'Official logo must be a base64 PNG data URI'
  );

  assert.ok(PROMOTIONAL_HEADER_ASSETS.banner.length > 10000, 'Header banner data URI must not be empty');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.logo.length > 1000, 'Official logo data URI must not be empty');
});

test('2. Local Image Files Verification: Public and src header asset files exist and are non-empty', () => {
  const requiredFiles = [
    'public/assets/promotional/compu_mss_header_banner.jpg',
    'src/assets/promotional/compu_mss_header_banner.jpg',
    'public/assets/promotional/compu_mss_logo.png',
    'public/assets/promotional/compu_mss_logo_256.png',
    'public/assets/promotional/header_laptop_left.png',
    'public/assets/promotional/header_laptop_right.png',
    'src/assets/promotional/compu_mss_logo.png',
    'src/assets/promotional/compu_mss_logo_256.png',
    'src/assets/promotional/header_laptop_left.png',
    'src/assets/promotional/header_laptop_right.png',
  ];

  for (const f of requiredFiles) {
    assert.ok(fs.existsSync(f), `Asset file must exist: ${f}`);
    const stat = fs.statSync(f);
    assert.ok(stat.size > 1000, `Asset file must have valid size: ${f}`);
  }

  // Verify banner dimensions (1024 x 317)
  const buf = fs.readFileSync('public/assets/promotional/compu_mss_header_banner.jpg');
  let idx = 0;
  let dims = null;
  while (idx < buf.length) {
    if (buf[idx] === 0xFF && (buf[idx + 1] === 0xC0 || buf[idx + 1] === 0xC2)) {
      dims = {
        height: buf.readUInt16BE(idx + 5),
        width: buf.readUInt16BE(idx + 7),
      };
      break;
    }
    idx++;
  }
  assert.ok(dims, 'Must extract JPEG dimensions');
  assert.equal(dims.width, 1024, 'Banner width must be 1024px');
  assert.equal(dims.height, 317, 'Banner height must be 317px');
});

test('3. MSSPromotionalGenerator Component: Uses new static header banner with object-contain', () => {
  const componentSource = fs.readFileSync(
    'src/components/placeholders/mss/MSSPromotionalGenerator.tsx',
    'utf8'
  );

  // Must import PROMOTIONAL_HEADER_ASSETS
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS'),
    'MSSPromotionalGenerator must import and use PROMOTIONAL_HEADER_ASSETS'
  );

  // Must render static header banner
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS.banner'),
    'MSSPromotionalGenerator must render static COMPU MSS header banner'
  );

  // Must use object-contain and horizontal centering
  assert.ok(
    componentSource.includes('object-contain'),
    'MSSPromotionalGenerator must use object-contain to preserve aspect ratio'
  );
  assert.ok(
    componentSource.includes('mx-auto'),
    'MSSPromotionalGenerator must center banner horizontally'
  );

  // Background must match banner dark navy edge
  assert.ok(
    componentSource.includes('#040e24') || componentSource.includes('#04102e'),
    'MSSPromotionalGenerator must use matching dark navy background'
  );

  // Cartoonish vector gradients should be removed from header
  assert.ok(!componentSource.includes('scenicGradient'), 'Cartoonish scenicGradient must be removed');
  assert.ok(!componentSource.includes('bloomGradient'), 'Cartoonish bloomGradient must be removed');
});

test('4. mssPromotionalService Canvas: Draws static header banner with preserved aspect ratio', () => {
  const serviceSource = fs.readFileSync(
    'src/services/mssPromotionalService.ts',
    'utf8'
  );

  // Must use PROMOTIONAL_HEADER_ASSETS.banner
  assert.ok(
    serviceSource.includes('PROMOTIONAL_HEADER_ASSETS.banner'),
    'Canvas service must render static COMPU MSS header banner'
  );

  // Must calculate aspect ratio and drawImage centered
  assert.ok(
    serviceSource.includes('ctx.drawImage(bannerImg'),
    'Canvas service must draw banner with ctx.drawImage'
  );
  assert.ok(
    serviceSource.includes('imgAspect'),
    'Canvas service must preserve banner aspect ratio'
  );
  assert.ok(
    serviceSource.includes('(width - bannerW) / 2'),
    'Canvas service must center banner horizontally'
  );
  assert.ok(
    serviceSource.includes('#040e24'),
    'Canvas service must fill header background with matching dark navy'
  );
});
