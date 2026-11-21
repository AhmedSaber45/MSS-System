import test from 'node:test';
import assert from 'node:assert/strict';

test('1. Available Devices Excel File Naming Pattern Verification', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
  const today = new Date().toISOString().split('T')[0];

  // Test standard export with no branch/brand filters
  const mockRows = [
    {
      'الموديل': 'Dell Latitude 5420',
      'البراند': 'Dell',
      'الفئة': 'Laptops',
      'الكمية': 3,
      'السعر (EGP)': 15000,
    },
  ];

  const result1 = await mssWholesaleExportService.buildWholesaleWorkbook(
    { includeSerialNumbers: false },
    mockRows
  );

  const expectedFilename1 = `الاجهزة_المتاحة_${today}.xlsx`;
  assert.equal(
    result1.filename,
    expectedFilename1,
    `Standard export filename must be exact: "${expectedFilename1}"`
  );
  assert.ok(
    !result1.filename.includes('تقرير_مخزون_'),
    'Filename must completely remove the "تقرير_مخزون_" prefix'
  );
  assert.ok(
    result1.filename.startsWith('الاجهزة_المتاحة'),
    'Filename must start with "الاجهزة_المتاحة"'
  );
  assert.ok(
    result1.filename.endsWith(`_${today}.xlsx`),
    'Filename must end with "_YYYY-MM-DD.xlsx"'
  );

  // Test with branch filter preserving dynamic suffix
  const resultWithBranch = await mssWholesaleExportService.buildWholesaleWorkbook(
    { includeSerialNumbers: false, branchFilter: 'محل 1' },
    mockRows
  );
  const expectedFilenameWithBranch = `الاجهزة_المتاحة_محل_1_${today}.xlsx`;
  assert.equal(
    resultWithBranch.filename,
    expectedFilenameWithBranch,
    'Branch suffix must be preserved dynamically'
  );

  // Test with brand filter preserving dynamic suffix
  const resultWithBrand = await mssWholesaleExportService.buildWholesaleWorkbook(
    { includeSerialNumbers: false, selectedBrands: ['Dell'] },
    mockRows
  );
  const expectedFilenameWithBrand = `الاجهزة_المتاحة_Dell_${today}.xlsx`;
  assert.equal(
    resultWithBrand.filename,
    expectedFilenameWithBrand,
    'Brand suffix must be preserved dynamically'
  );
});

test('2. Compu MSS Devices PNG Files Naming Pattern Verification', async () => {
  const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');
  const today = new Date().toISOString().split('T')[0];

  // Mock multi-brand items list
  const multiBrandItems = [
    { brand: 'Dell', model_name: 'Latitude 5420', price: 15000 },
    { brand: 'HP', model_name: 'EliteBook 840 G8', price: 17000 },
    { brand: 'Lenovo', model_name: 'ThinkPad T14', price: 16500 },
  ];

  // Test multi-page PNG filenames (Page 1 of 3)
  const filenameP1 = generatePromotionalArabicFilename(multiBrandItems, 'png', 1, 3);
  const expectedP1 = `أجهزة_Compu_MSS_${today} - 01 من 03.png`;
  assert.equal(filenameP1, expectedP1, `Page 1 filename must match: "${expectedP1}"`);

  // Test Page 2 of 3
  const filenameP2 = generatePromotionalArabicFilename(multiBrandItems, 'png', 2, 3);
  const expectedP2 = `أجهزة_Compu_MSS_${today} - 02 من 03.png`;
  assert.equal(filenameP2, expectedP2, `Page 2 filename must match: "${expectedP2}"`);

  // Test Page 3 of 3
  const filenameP3 = generatePromotionalArabicFilename(multiBrandItems, 'png', 3, 3);
  const expectedP3 = `أجهزة_Compu_MSS_${today} - 03 من 03.png`;
  assert.equal(filenameP3, expectedP3, `Page 3 filename must match: "${expectedP3}"`);

  // Verify key requirements
  assert.ok(
    filenameP1.includes('Compu_MSS'),
    'Filename must contain "Compu_MSS"'
  );
  assert.ok(
    !filenameP1.includes('كومبي_ام_اس_اس'),
    'Filename must NOT contain old "كومبي_ام_اس_اس"'
  );
  assert.ok(
    filenameP1.startsWith('أجهزة_Compu_MSS'),
    'Arabic word "أجهزة" must be retained unchanged followed by "Compu_MSS"'
  );
  assert.ok(
    filenameP1.includes(' - 01 من 03.png'),
    'Page numbering, total count, separators, spacing, and .png must be preserved'
  );

  // Single-page export (totalPages <= 1 or omitted)
  const singlePageFilename = generatePromotionalArabicFilename(multiBrandItems, 'png');
  const expectedSingle = `أجهزة_Compu_MSS_${today}.png`;
  assert.equal(
    singlePageFilename,
    expectedSingle,
    `Single page multi-brand export must be "${expectedSingle}"`
  );

  // Single-brand preservation check
  const singleBrandItems = [
    { brand: 'Dell', model_name: 'Latitude 5420', price: 15000 },
    { brand: 'Dell', model_name: 'XPS 13', price: 25000 },
  ];
  const singleBrandP1 = generatePromotionalArabicFilename(singleBrandItems, 'png', 1, 2);
  const expectedSingleBrandP1 = `عروض_لابتوبات_Dell_${today} - 01 من 02.png`;
  assert.equal(
    singleBrandP1,
    expectedSingleBrandP1,
    'Single brand naming pattern must remain intact'
  );
});
