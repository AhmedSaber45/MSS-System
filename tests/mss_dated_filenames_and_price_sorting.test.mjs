import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock localStorage for node environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

// 1. Format Arabic Export Filename Tests
test('Format Arabic Export Filename: correctly appends YYYY-MM-DD date and extension', async () => {
  const { formatArabicExportFilename } = await import('../src/services/mssWholesaleExportService.ts');
  const today = new Date().toISOString().split('T')[0];

  const excelName = formatArabicExportFilename('تقرير_الأجهزة', 'xlsx');
  assert.equal(excelName, `تقرير_الأجهزة_${today}.xlsx`);

  const pngName = formatArabicExportFilename('أجهزة_لابتوب_متاحة', 'png');
  assert.equal(pngName, `أجهزة_لابتوب_متاحة_${today}.png`);

  const pdfName = formatArabicExportFilename('عروض_لابتوبات_ديل', 'pdf');
  assert.equal(pdfName, `عروض_لابتوبات_ديل_${today}.pdf`);
});

test('Format Arabic Export Filename: does NOT duplicate date when date is already present', async () => {
  const { formatArabicExportFilename } = await import('../src/services/mssWholesaleExportService.ts');
  const today = new Date().toISOString().split('T')[0];

  // Already has today's date
  const inputWithDate = `تقرير_المبيعات_${today}.xlsx`;
  const result = formatArabicExportFilename(inputWithDate, 'xlsx');
  assert.equal(result, `تقرير_المبيعات_${today}.xlsx`);

  // Multiple repetitive formatting calls must be idempotent
  const step1 = formatArabicExportFilename('عروض_الأجهزة', 'png');
  const step2 = formatArabicExportFilename(step1, 'png');
  const step3 = formatArabicExportFilename(step2, 'png');
  assert.equal(step3, `عروض_الأجهزة_${today}.png`);
  assert.ok(!step3.includes(`${today}_${today}`));
});

test('Format Arabic Export Filename: sanitizes illegal Windows characters', async () => {
  const { formatArabicExportFilename } = await import('../src/services/mssWholesaleExportService.ts');
  const today = new Date().toISOString().split('T')[0];

  const dirtyName = 'عرض: لابتوب / Dell * Core i7 ? "Special" <Best> | High';
  const clean = formatArabicExportFilename(dirtyName, 'xlsx');
  assert.ok(!/[/\\?%*:|"<>]/g.test(clean));
  assert.ok(clean.endsWith(`_${today}.xlsx`));
});

// 2. Custom Price Sorting in Wholesale Excel Data
test('Wholesale Excel Price Sorting: Mode B (Serialized devices) lowest to highest (asc)', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

  const { rows } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: true,
    includePrices: true,
    priceSortOrder: 'asc',
  });

  assert.ok(rows.length > 0, 'Rows should not be empty');
  const prices = rows.map(r => r['السعر (EGP)']);
  for (let i = 0; i < prices.length - 1; i++) {
    assert.ok(prices[i] <= prices[i + 1], `Ascending sort failed: ${prices[i]} should be <= ${prices[i + 1]}`);
  }
});

test('Wholesale Excel Price Sorting: Mode B (Serialized devices) highest to lowest (desc)', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

  const { rows } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: true,
    includePrices: true,
    priceSortOrder: 'desc',
  });

  assert.ok(rows.length > 0, 'Rows should not be empty');
  const prices = rows.map(r => r['السعر (EGP)']);
  for (let i = 0; i < prices.length - 1; i++) {
    assert.ok(prices[i] >= prices[i + 1], `Descending sort failed: ${prices[i]} should be >= ${prices[i + 1]}`);
  }
});

test('Wholesale Excel Price Sorting: Mode A (Aggregated models) lowest to highest (asc)', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

  const { rows } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: false,
    includePrices: true,
    priceSortOrder: 'asc',
  });

  assert.ok(rows.length > 0, 'Rows should not be empty');
  const prices = rows.map(r => r['السعر (EGP)']);
  for (let i = 0; i < prices.length - 1; i++) {
    assert.ok(prices[i] <= prices[i + 1], `Ascending sort failed: ${prices[i]} should be <= ${prices[i + 1]}`);
  }
});

test('Wholesale Excel Price Sorting: Mode A (Aggregated models) highest to lowest (desc)', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

  const { rows } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: false,
    includePrices: true,
    priceSortOrder: 'desc',
  });

  assert.ok(rows.length > 0, 'Rows should not be empty');
  const prices = rows.map(r => r['السعر (EGP)']);
  for (let i = 0; i < prices.length - 1; i++) {
    assert.ok(prices[i] >= prices[i + 1], `Descending sort failed: ${prices[i]} should be >= ${prices[i + 1]}`);
  }
});

test('Wholesale Excel Price Sorting: sorts correctly even when prices are hidden (includePrices: false)', async () => {
  const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

  // Fetch with prices visible as reference
  const { rows: ascWithPrices } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: false,
    includePrices: true,
    priceSortOrder: 'asc',
  });

  // Fetch with prices hidden
  const { rows: ascWithoutPrices } = await mssWholesaleExportService.buildWholesaleData({
    includeSerialNumbers: false,
    includePrices: false,
    priceSortOrder: 'asc',
  });

  assert.equal(ascWithoutPrices.length, ascWithPrices.length);
  // Row models must match exact order
  for (let i = 0; i < ascWithPrices.length; i++) {
    assert.equal(ascWithoutPrices[i]['الماركة والموديل (Brand & Model)'], ascWithPrices[i]['الماركة والموديل (Brand & Model)']);
    assert.equal(ascWithoutPrices[i]['السعر (EGP)'], undefined, 'Price column must be hidden');
  }
});

// 3. Custom Price Sorting in Promotional Items
test('Promotional Items Price Sorting: sorts items asc and desc with tie-breaker', async () => {
  const { sortPromotionalItems } = await import('../src/services/mssPromotionalService.ts');

  const testItems = [
    { id: '1', brand: 'Dell', model_name: 'Latitude 5420', price: 15000 },
    { id: '2', brand: 'Apple', model_name: 'MacBook Air M2', price: 25000 },
    { id: '3', brand: 'HP', model_name: 'EliteBook 840', price: 12000 },
    { id: '4', brand: 'Lenovo', model_name: 'ThinkPad T14', price: 15000 },
  ];

  // Ascending
  const asc = sortPromotionalItems(testItems, 'asc');
  assert.equal(asc[0].price, 12000);
  assert.equal(asc[1].price, 15000);
  assert.equal(asc[2].price, 15000);
  assert.equal(asc[3].price, 25000);

  // Tie-breaker: Dell before Lenovo
  assert.equal(asc[1].brand, 'Dell');
  assert.equal(asc[2].brand, 'Lenovo');

  // Descending
  const desc = sortPromotionalItems(testItems, 'desc');
  assert.equal(desc[0].price, 25000);
  assert.equal(desc[1].price, 15000);
  assert.equal(desc[2].price, 15000);
  assert.equal(desc[3].price, 12000);
  assert.equal(desc[1].brand, 'Dell');
  assert.equal(desc[2].brand, 'Lenovo');
});

// 4. Promotional Dated Filenames
test('Promotional Arabic Filenames: includes date stamp YYYY-MM-DD for single and multi-brand', async () => {
  const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');
  const today = new Date().toISOString().split('T')[0];

  const singleBrandItems = [
    { id: '1', brand: 'Dell', model_name: 'Latitude 7420', price: 18000 },
  ];
  const singleName = generatePromotionalArabicFilename(singleBrandItems, 'png');
  assert.ok(singleName.includes('Dell'));
  assert.ok(singleName.endsWith(`_${today}.png`));

  const multiBrandItems = [
    { id: '1', brand: 'Dell', model_name: 'Latitude 7420', price: 18000 },
    { id: '2', brand: 'HP', model_name: 'EliteBook 840', price: 16000 },
  ];
  const multiPdf = generatePromotionalArabicFilename(multiBrandItems, 'pdf');
  assert.ok(multiPdf.includes('عروض_لابتوبات_مختارة_Compu_MSS'));
  assert.ok(multiPdf.endsWith(`_${today}.pdf`));
});

// 5. Invoice Modal & Table Layout Checks
test('Invoice Modal Layout: table has min-w-[690px] and badges prevent hyphen breaks', () => {
  const filePath = path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Has min-w-[690px] to prevent horizontal crushing
  assert.ok(content.includes('min-w-[690px]'), 'Table should have min-w-[690px] to prevent horizontal crushing');

  // Serial numbers must have hyphens: none and wordBreak: keep-all
  assert.ok(content.includes("hyphens: 'none'"), 'Serial badge must prevent hyphen breaks');
  assert.ok(content.includes("whiteSpace: 'nowrap'"), 'Serial badge must enforce nowrap');
  assert.ok(content.includes('break-keep'), 'Serial badge must enforce break-keep');

  // Numerical columns have whitespace-nowrap
  assert.ok(content.includes('tabular-nums whitespace-nowrap'), 'Numerical columns must have tabular-nums whitespace-nowrap');

  // Modal in Modal.tsx must have max-w-[calc(100vw-1rem)] and min-w-0
  const modalPath = path.resolve('src/components/common/Modal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  assert.ok(modalContent.includes('max-w-[calc(100vw-1rem)]'), 'Modal dialog must have viewport boundary constraint');
  assert.ok(modalContent.includes('min-w-0'), 'Modal dialog must have min-w-0');
});
