import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Load promotional assets module
import { PROMOTIONAL_HEADER_ASSETS } from '../src/assets/promotional/promotionalAssets.ts';

test('1. PROMOTIONAL_HEADER_ASSETS: All commercial header assets exist with valid data URIs', () => {
  assert.ok(PROMOTIONAL_HEADER_ASSETS, 'PROMOTIONAL_HEADER_ASSETS must exist');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.logo, 'Official COMPU MSS logo must exist');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.laptopLeft, 'Left commercial laptop asset must exist');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.laptopRight, 'Right commercial laptop asset must exist');

  assert.ok(
    PROMOTIONAL_HEADER_ASSETS.logo.startsWith('data:image/png;base64,'),
    'Official logo must be a base64 PNG data URI'
  );
  assert.ok(
    PROMOTIONAL_HEADER_ASSETS.laptopLeft.startsWith('data:image/png;base64,'),
    'Left laptop must be a base64 PNG data URI'
  );
  assert.ok(
    PROMOTIONAL_HEADER_ASSETS.laptopRight.startsWith('data:image/png;base64,'),
    'Right laptop must be a base64 PNG data URI'
  );

  assert.ok(PROMOTIONAL_HEADER_ASSETS.logo.length > 1000, 'Official logo data URI must not be empty');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.laptopLeft.length > 1000, 'Left laptop data URI must not be empty');
  assert.ok(PROMOTIONAL_HEADER_ASSETS.laptopRight.length > 1000, 'Right laptop data URI must not be empty');
});

test('2. Local Image Files Verification: Public and src header asset files exist and are non-empty', () => {
  const requiredFiles = [
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
});

test('3. MSSPromotionalGenerator Component: Uses realistic header composition and official logo', () => {
  const componentSource = fs.readFileSync(
    'src/components/placeholders/mss/MSSPromotionalGenerator.tsx',
    'utf8'
  );

  // Must import PROMOTIONAL_HEADER_ASSETS
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS'),
    'MSSPromotionalGenerator must import and use PROMOTIONAL_HEADER_ASSETS'
  );

  // Must render official logo
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS.logo'),
    'MSSPromotionalGenerator must render official COMPU MSS logo'
  );

  // Must render photorealistic laptops
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS.laptopLeft'),
    'MSSPromotionalGenerator must render photorealistic left laptop'
  );
  assert.ok(
    componentSource.includes('PROMOTIONAL_HEADER_ASSETS.laptopRight'),
    'MSSPromotionalGenerator must render photorealistic right laptop'
  );

  // Preserves original COMPU MSS brand colors
  assert.ok(
    componentSource.includes('#04102e') && componentSource.includes('#0c3582'),
    'MSSPromotionalGenerator must preserve royal navy blue brand gradient'
  );
  assert.ok(
    componentSource.includes('#facc15'),
    'MSSPromotionalGenerator must preserve warm commercial gold headline color'
  );

  // Cartoonish vector gradients should be removed from header
  assert.ok(!componentSource.includes('scenicGradient'), 'Cartoonish scenicGradient must be removed');
  assert.ok(!componentSource.includes('bloomGradient'), 'Cartoonish bloomGradient must be removed');
});

test('4. mssPromotionalService Canvas: Uses realistic laptops, official logo, and royal navy colors', () => {
  const serviceSource = fs.readFileSync(
    'src/services/mssPromotionalService.ts',
    'utf8'
  );

  // Must use PROMOTIONAL_HEADER_ASSETS
  assert.ok(
    serviceSource.includes('PROMOTIONAL_HEADER_ASSETS.logo'),
    'Canvas service must render official logo'
  );
  assert.ok(
    serviceSource.includes('PROMOTIONAL_HEADER_ASSETS.laptopLeft'),
    'Canvas service must render photorealistic left laptop'
  );
  assert.ok(
    serviceSource.includes('PROMOTIONAL_HEADER_ASSETS.laptopRight'),
    'Canvas service must render photorealistic right laptop'
  );

  // Preserves original brand colors
  assert.ok(
    serviceSource.includes('#04102e') && serviceSource.includes('#0c3582'),
    'Canvas service must preserve royal navy blue brand gradient'
  );
  assert.ok(
    serviceSource.includes('#facc15'),
    'Canvas service must preserve warm commercial gold headline color'
  );
  assert.ok(
    serviceSource.includes('#38bdf8'),
    'Canvas service must preserve sky blue branding color'
  );
});
