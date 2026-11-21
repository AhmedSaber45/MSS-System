import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const { getWholesaleColumns } = await import('../src/services/mssWholesaleExportService.ts');

describe('COMPU MSS — EXCEL EXPORT SETTINGS DEFAULT CONFIGURATION VERIFICATION', () => {

  test('1. Source file verification: MSSDeviceReportsView initial wholesaleOptions match reference screenshot exactly', () => {
    const viewSrc = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx'),
      'utf-8'
    );

    // Extract wholesaleOptions default object definition
    const match = viewSrc.match(/const\s+\[wholesaleOptions,\s*setWholesaleOptions\]\s*=\s*useState<WholesaleExportOptions>\(\{([\s\S]*?)\}\);/);
    assert.ok(match, 'wholesaleOptions useState must be found in MSSDeviceReportsView');

    const optionsBody = match[1];

    // 1. Every option selected/enabled in reference screenshot:
    // - includePrices: true
    assert.match(optionsBody, /includePrices:\s*true/, 'includePrices must be true by default');
    // - includeQuantity: true
    assert.match(optionsBody, /includeQuantity:\s*true/, 'includeQuantity must be true by default');

    // 2. Every option unselected/disabled in reference screenshot:
    // - includeSerialNumbers: false
    assert.match(optionsBody, /includeSerialNumbers:\s*false/, 'includeSerialNumbers must be false by default');
    // - includeCategory: false
    assert.match(optionsBody, /includeCategory:\s*false/, 'includeCategory must be false by default');
    // - includeScreen: false
    assert.match(optionsBody, /includeScreen:\s*false/, 'includeScreen must be false by default');
    // - includeStatus: false
    assert.match(optionsBody, /includeStatus:\s*false/, 'includeStatus must be false by default');
    // - includeBranch: false
    assert.match(optionsBody, /includeBranch:\s*false/, 'includeBranch must be false by default');

    // 3. Dropdowns matching screenshot:
    // - branchFilter: 'ALL'
    assert.match(optionsBody, /branchFilter:\s*['"]ALL['"]/, "branchFilter must be 'ALL' by default");
    // - priceSortOrder: 'asc'
    assert.match(optionsBody, /priceSortOrder:\s*['"]asc['"]/, "priceSortOrder must be 'asc' by default");
  });

  test('2. Default columns resolution: Only enabled default columns are exported', () => {
    const defaultOptions = {
      includePrices: true,
      includeQuantity: true,
      includeSerialNumbers: false,
      includeStatus: false,
      includeBranch: false,
      includeCategory: false,
      includeScreen: false,
      branchFilter: 'ALL',
      priceSortOrder: 'asc',
    };

    const columns = getWholesaleColumns(defaultOptions);
    const columnKeys = columns.map(c => c.key);
    const columnHeaders = columns.map(c => c.header);

    // Expected enabled columns by default:
    // Model, Processor, RAM, Storage, GPU, Quantity, Price
    assert.ok(columnKeys.includes('brand_and_model'), 'Model must be included');
    assert.ok(columnKeys.includes('processor'), 'Processor must be included');
    assert.ok(columnKeys.includes('ram'), 'RAM must be included');
    assert.ok(columnKeys.includes('storage'), 'Storage must be included');
    assert.ok(columnKeys.includes('gpu'), 'GPU must be included');
    assert.ok(columnKeys.includes('quantity'), 'Quantity must be included by default');
    assert.ok(columnKeys.includes('price'), 'Price must be included by default');

    // Must NOT be included by default (unselected in screenshot):
    assert.strictEqual(columnKeys.includes('serial_number'), false, 'Serial Number must NOT be included by default');
    assert.strictEqual(columnKeys.includes('category'), false, 'Category must NOT be included by default');
    assert.strictEqual(columnKeys.includes('screen'), false, 'Screen must NOT be included by default');
    assert.strictEqual(columnKeys.includes('physical_condition'), false, 'Status must NOT be included by default');
    assert.strictEqual(columnKeys.includes('stock_location'), false, 'Branch must NOT be included by default');

    // Exactly 7 columns must be present with default settings
    assert.strictEqual(columns.length, 7, `Expected exactly 7 columns with default settings, got ${columns.length}: ${columnHeaders.join(', ')}`);
  });

  test('3. Manual toggling capability preserved: Users can selectively enable disabled options', () => {
    // User manually enables Category and Screen
    const modifiedOptions = {
      includePrices: true,
      includeQuantity: true,
      includeSerialNumbers: false,
      includeStatus: false,
      includeBranch: false,
      includeCategory: true, // manually enabled
      includeScreen: true,   // manually enabled
      branchFilter: 'ALL',
      priceSortOrder: 'asc',
    };

    const columns = getWholesaleColumns(modifiedOptions);
    const columnKeys = columns.map(c => c.key);

    assert.ok(columnKeys.includes('category'), 'Category column must appear when manually enabled');
    assert.ok(columnKeys.includes('screen'), 'Screen column must appear when manually enabled');
    assert.strictEqual(columnKeys.includes('physical_condition'), false, 'Status must remain excluded');
    assert.strictEqual(columnKeys.includes('stock_location'), false, 'Branch must remain excluded');
    assert.strictEqual(columns.length, 9, 'Expected 9 columns with Category and Screen enabled');
  });

  test('4. Manual Mode B toggle preserved: Users can switch to serial numbers mode', () => {
    const serialModeOptions = {
      includePrices: true,
      includeQuantity: false,
      includeSerialNumbers: true, // manually switched to Mode B
      includeStatus: true,
      includeBranch: true,
      includeCategory: true,
      includeScreen: true,
      branchFilter: 'ALL',
      priceSortOrder: 'asc',
    };

    const columns = getWholesaleColumns(serialModeOptions);
    const columnKeys = columns.map(c => c.key);

    assert.ok(columnKeys.includes('serial_number'), 'Serial Number column must appear in Mode B');
    assert.strictEqual(columnKeys.includes('quantity'), false, 'Quantity column must be excluded in Mode B');
    assert.ok(columnKeys.includes('brand_and_model'), 'Model must appear');
    assert.ok(columnKeys.includes('category'), 'Category must appear');
    assert.ok(columnKeys.includes('stock_location'), 'Branch must appear');
    assert.ok(columnKeys.includes('physical_condition'), 'Status must appear');
  });

});
