import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Setup Mock localStorage for Node.js test environment
if (!global.localStorage) {
  const storage = new Map();
  global.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
}

const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');
const { mssCommerceService } = await import('../src/services/mssCommerceService.ts');

describe('COMPU MSS — DEVICE REPORTS PAGE & WHOLESALE EXCEL EXPORT', () => {
  let modelDell;
  let modelHp;
  let modelMac;
  let uid = 0;
  const getSerial = (p) => `SN-${p}-${Date.now()}-${++uid}`;

  beforeEach(async () => {
    localStorage.clear();

    // 1. Create Distinct Models with various specs
    modelDell = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: 'Latitude 5400 ' + Date.now().toString(36),
      category: 'Laptop',
      processor: 'Intel Core i5-8265U',
      gpu: 'Intel UHD 620',
      ram: '8GB DDR4',
      storage: '256GB SSD',
      screen_size: '14.0" FHD IPS 1920x1080',
    });

    modelHp = await mssCatalogService.createModel({
      brand: 'HP',
      model_name: 'EliteBook 840 G6 ' + Date.now().toString(36),
      category: 'Laptop',
      processor: 'Intel Core i7-8565U',
      gpu: 'Intel UHD 620',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD',
      screen_size: '14.0 Inch 1920x1080 FHD IPS',
    });

    modelMac = await mssCatalogService.createModel({
      brand: 'Apple',
      model_name: 'MacBook Pro 16 M1 Max ' + Date.now().toString(36),
      category: 'Laptop',
      processor: 'Apple M1 Max 10-core',
      gpu: '32-core GPU',
      ram: '32GB Unified',
      storage: '1TB SSD',
      screen_size: '16.2" Liquid Retina XDR 3456x2234',
    });
  });

  // ============================================================================
  // 1. NAVIGATION & ROUTING SEPARATION
  // ============================================================================
  describe('1. Navigation & Routing Separation', () => {
    test('1.1 Navigation configuration separates Sales Reports and Device Reports', () => {
      const navSrc = fs.readFileSync(path.resolve('src/config/navigationConfig.ts'), 'utf-8');
      
      // Check reports is now Sales Reports
      assert.ok(navSrc.includes("id: 'reports'"), 'Must contain reports item');
      assert.ok(navSrc.includes("label: 'تقارير المبيعات'"), 'reports must be labeled تقارير المبيعات');
      
      // Check device-reports is added as Device Reports
      assert.ok(navSrc.includes("id: 'device-reports'"), 'Must contain device-reports item');
      assert.ok(navSrc.includes("label: 'تقارير الأجهزة'"), 'device-reports must be labeled تقارير الأجهزة');
      assert.ok(navSrc.includes('FileSpreadsheet'), 'device-reports must use FileSpreadsheet icon');
    });

    test('1.2 MSSRoute type includes device-reports', () => {
      const typeSrc = fs.readFileSync(path.resolve('src/types/navigation.ts'), 'utf-8');
      assert.ok(typeSrc.includes("'device-reports'"), 'MSSRoute type must accept device-reports');
    });

    test('1.3 AppShell routes device-reports to MSSDeviceReportsView', () => {
      const shellSrc = fs.readFileSync(path.resolve('src/components/layout/AppShell.tsx'), 'utf-8');
      assert.ok(shellSrc.includes("import { MSSDeviceReportsView }"), 'Must import MSSDeviceReportsView');
      assert.ok(shellSrc.includes("case 'device-reports':"), 'Must route case device-reports');
      assert.ok(shellSrc.includes("<MSSDeviceReportsView />"), 'Must render MSSDeviceReportsView');
    });

    test('1.4 MSSReportsView title is renamed to Sales Reports and contains shortcut to Device Reports', () => {
      const reportsSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSReportsView.tsx'), 'utf-8');
      assert.ok(
        reportsSrc.includes('تقارير المبيعات والأرباح — Compu MSS'),
        'MSSReportsView must have title تقارير المبيعات والأرباح'
      );
      assert.ok(
        reportsSrc.includes("setRoute('device-reports')"),
        'MSSReportsView must include quick navigation to device-reports'
      );
    });

    test('1.5 MSSDeviceReportsView component exists and renders properly', () => {
      const devReportsSrc = fs.readFileSync(
        path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx'),
        'utf-8'
      );
      assert.ok(devReportsSrc.includes('تقارير الأجهزة ومخزون الجملة — Compu MSS'), 'Must have correct page title');
      assert.ok(devReportsSrc.includes('تصدير مخزون الجملة (Excel)'), 'Must have wholesale export tab');
      assert.ok(devReportsSrc.includes('ملخص كميات الموديلات'), 'Must have model quantity summary tab');
      assert.ok(devReportsSrc.includes('تقرير الأجهزة المباعة'), 'Must have sold devices report tab');
    });
  });

  // ============================================================================
  // 2. WHOLESALE EXCEL EXPORT — SPECIFICATIONS EXTRACTION & MISSING HANDLING
  // ============================================================================
  describe('2. Wholesale Specifications Extraction & Missing Handling', () => {
    test('2.1 CleanSpec replaces null, undefined, empty strings, and whitespace with "---"', () => {
      assert.strictEqual(mssWholesaleExportService.cleanSpec(null), '---');
      assert.strictEqual(mssWholesaleExportService.cleanSpec(undefined), '---');
      assert.strictEqual(mssWholesaleExportService.cleanSpec(''), '---');
      assert.strictEqual(mssWholesaleExportService.cleanSpec('   '), '---');
      assert.strictEqual(mssWholesaleExportService.cleanSpec('Intel i7'), 'Intel i7');
    });

    test('2.2 Screen details extraction parses size, resolution, and type into separate columns', () => {
      const details = mssWholesaleExportService.extractScreenDetails(
        '14.0" FHD IPS 1920x1080',
        '14 Inch FHD IPS'
      );
      assert.strictEqual(details.size, '14.0"');
      assert.strictEqual(details.resolution, 'FHD (1920×1080)');
      assert.strictEqual(details.type, 'IPS');
    });

    test('2.3 Screen details extraction gracefully falls back to "---" for missing attributes', () => {
      const details = mssWholesaleExportService.extractScreenDetails('', '');
      assert.strictEqual(details.size, '---');
      assert.strictEqual(details.resolution, '---');
      assert.strictEqual(details.type, '---');
    });

    test('2.4 formatBrandAndModel merges brand and model, deduplicating if model already starts with brand', () => {
      // Normal merge
      assert.strictEqual(
        mssWholesaleExportService.formatBrandAndModel('Apple', 'MacBook Pro 16'),
        'Apple MacBook Pro 16'
      );
      assert.strictEqual(
        mssWholesaleExportService.formatBrandAndModel('Dell', 'Latitude 5400'),
        'Dell Latitude 5400'
      );

      // Model already starts with brand (case-insensitive deduplication)
      assert.strictEqual(
        mssWholesaleExportService.formatBrandAndModel('Apple', 'Apple MacBook Air M2'),
        'Apple MacBook Air M2'
      );

      // Missing values fallback
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel('Dell', null), 'Dell');
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel('Dell', ''), 'Dell');
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel(null, 'ThinkPad T480'), 'ThinkPad T480');
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel('', 'ThinkPad T480'), 'ThinkPad T480');
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel(null, null), '---');
      assert.strictEqual(mssWholesaleExportService.formatBrandAndModel('', ''), '---');
    });

    test('2.5 formatScreenSummary merges screen type, size, and resolution in strict order with " - "', () => {
      // Full specs: Type - Size - Resolution
      const fullScreen = mssWholesaleExportService.formatScreenSummary(
        '15.6" FHD IPS',
        '15.6 Inch IPS FHD 1920x1080'
      );
      assert.strictEqual(fullScreen, 'IPS - 15.6" - FHD (1920×1080)');

      // Missing resolution
      const noRes = mssWholesaleExportService.formatScreenSummary('14.0" IPS', '14.0" IPS');
      assert.strictEqual(noRes, 'IPS - 14.0"');

      // Missing type
      const noType = mssWholesaleExportService.formatScreenSummary('13.3" FHD', '13.3" 1920x1080');
      assert.strictEqual(noType, '13.3" - FHD (1920×1080)');

      // All missing
      const allMissing = mssWholesaleExportService.formatScreenSummary(null, null);
      assert.strictEqual(allMissing, '---');
    });
  });

  // ============================================================================
  // 3. WHOLESALE EXPORT — MODE A: GROUPED BY MODEL (SERIAL NUMBERS OFF)
  // ============================================================================
  describe('3. Wholesale Export — Mode A: Grouped by Model (Serial Numbers OFF)', () => {
    beforeEach(async () => {
      // Create stock:
      // Model Dell: 2 serialized devices at محل 1, 3 bulk units at محل 1 = 5 available units
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: getSerial('DELL-A1'),
        stock_location: 'محل 1',
        list_price: 12000,
        purchase_cost: 9000,
        status: 'AVAILABLE',
      });
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: getSerial('DELL-A2'),
        stock_location: 'محل 1',
        list_price: 12000,
        purchase_cost: 9000,
        status: 'AVAILABLE',
      });
      await mssInventoryService.createBulkStock({
        model_id: modelDell.id,
        stock_location: 'محل 1',
        quantity: 3,
        list_price: 12000,
        purchase_cost: 9000,
      });

      // Model HP: 4 bulk units at محل 2
      await mssInventoryService.createBulkStock({
        model_id: modelHp.id,
        stock_location: 'محل 2',
        quantity: 4,
        list_price: 15000,
        purchase_cost: 11000,
      });

      // Model Mac: 1 serialized at محل 1, 1 SOLD unit (must be excluded)
      await mssInventoryService.createDevice({
        model_id: modelMac.id,
        serial_number: getSerial('MAC-AVAIL'),
        stock_location: 'محل 1',
        list_price: 45000,
        purchase_cost: 38000,
        status: 'AVAILABLE',
      });
      await mssInventoryService.createDevice({
        model_id: modelMac.id,
        serial_number: getSerial('MAC-SOLD'),
        stock_location: 'محل 1',
        list_price: 45000,
        purchase_cost: 38000,
        status: 'SOLD',
      });
    });

    test('3.1 Mode A groups stock by model and combines serialized and non-serialized quantities with merged columns', async () => {
      const { rows, columns } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        includeBranch: true,
        branchFilter: 'ALL',
      });

      // Verify merged column headers exist
      const headerNames = columns.map(c => c.header);
      assert.ok(headerNames.includes('الماركة والموديل (Brand & Model)'), 'Must include merged Brand & Model header');
      assert.ok(headerNames.includes('الشاشة (Screen)'), 'Must include merged Screen header');
      assert.ok(!headerNames.includes('الماركة'), 'Separate Brand header must not exist');
      assert.ok(!headerNames.includes('الموديل'), 'Separate Model header must not exist');
      assert.ok(!headerNames.includes('حجم الشاشة'), 'Separate Screen Size header must not exist');
      assert.ok(!headerNames.includes('دقة الشاشة'), 'Separate Resolution header must not exist');
      assert.ok(!headerNames.includes('نوع الشاشة'), 'Separate Screen Type header must not exist');

      const targetModels = [modelDell.model_name, modelHp.model_name, modelMac.model_name];
      const targetRows = rows.filter(r =>
        targetModels.some(m => (r['الماركة والموديل (Brand & Model)'] || '').includes(m))
      );
      assert.strictEqual(targetRows.length, 3, 'Must find our 3 target models in Mode A');

      const dellRow = targetRows.find(r => r['الماركة والموديل (Brand & Model)'].includes(modelDell.model_name));
      assert.ok(dellRow, 'Dell row must be present');
      assert.strictEqual(dellRow['الكمية المتاحة'], 5, 'Dell quantity must be 2 serial + 3 bulk = 5');
      assert.strictEqual(dellRow['السعر (EGP)'], 12000);
      assert.strictEqual(dellRow['المعالج (Processor)'], 'Intel Core i5-8265U');
      assert.strictEqual(dellRow['الرام (RAM)'], '8GB DDR4');
      assert.strictEqual(dellRow['سعة التخزين (Storage)'], '256GB SSD');
      assert.strictEqual(dellRow['كارت الشاشة (GPU)'], 'Intel UHD 620');
      assert.strictEqual(dellRow['الشاشة (Screen)'], 'IPS - 14.0" - FHD (1920×1080)');
      assert.strictEqual(dellRow['السيريال (Serial Number)'], undefined, 'Mode A must NOT include serial column');

      const macRow = targetRows.find(r => r['الماركة والموديل (Brand & Model)'].includes(modelMac.model_name));
      assert.ok(macRow);
      assert.strictEqual(macRow['الكمية المتاحة'], 1, 'Sold unit must be excluded');
    });

    test('3.2 Mode A with includeQuantity: false omits the quantity column', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: false,
        includeSerialNumbers: false,
        branchFilter: 'ALL',
      });

      const targetModels = [modelDell.model_name, modelHp.model_name, modelMac.model_name];
      const targetRows = rows.filter(r =>
        targetModels.some(m => (r['الماركة والموديل (Brand & Model)'] || '').includes(m))
      );
      assert.strictEqual(targetRows.length, 3);
      assert.strictEqual(
        targetRows[0]['الكمية المتاحة'],
        undefined,
        'Quantity column must be omitted when includeQuantity is false'
      );
    });

    test('3.3 Mode A with includePrices: false omits the price column', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: false,
        includeQuantity: true,
        includeSerialNumbers: false,
        branchFilter: 'ALL',
      });

      const targetModels = [modelDell.model_name, modelHp.model_name, modelMac.model_name];
      const targetRows = rows.filter(r =>
        targetModels.some(m => (r['الماركة والموديل (Brand & Model)'] || '').includes(m))
      );
      assert.strictEqual(targetRows.length, 3);
      assert.strictEqual(
        targetRows[0]['السعر (EGP)'],
        undefined,
        'Price column must be omitted when includePrices is false'
      );
      assert.ok(targetRows[0]['الكمية المتاحة'] !== undefined, 'Quantity should still be present');
    });
  });

  // ============================================================================
  // 4. WHOLESALE EXPORT — MODE B: SERIAL NUMBERS ON (INDIVIDUAL SERIALIZED ONLY)
  // ============================================================================
  describe('4. Wholesale Export — Mode B: Serial Numbers ON', () => {
    let sDell12, sMac45, sHp15, sDell8;

    beforeEach(async () => {
      sDell12 = getSerial('DELL-12K');
      sMac45 = getSerial('MAC-45K');
      sHp15 = getSerial('HP-15K');
      sDell8 = getSerial('DELL-8K');

      // Create serialized devices with varying prices:
      // Device 1: Dell (Price 12000)
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: sDell12,
        stock_location: 'محل 1',
        list_price: 12000,
        purchase_cost: 9000,
        status: 'AVAILABLE',
      });

      // Device 2: Mac (Price 45000)
      await mssInventoryService.createDevice({
        model_id: modelMac.id,
        serial_number: sMac45,
        stock_location: 'محل 1',
        list_price: 45000,
        purchase_cost: 38000,
        status: 'AVAILABLE',
      });

      // Device 3: HP (Price 15000)
      await mssInventoryService.createDevice({
        model_id: modelHp.id,
        serial_number: sHp15,
        stock_location: 'محل 2',
        list_price: 15000,
        purchase_cost: 11000,
        status: 'AVAILABLE',
      });

      // Device 4: Cheap Dell (Price 8000)
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: sDell8,
        stock_location: 'محل 1',
        list_price: 8000,
        purchase_cost: 6000,
        status: 'AVAILABLE',
      });

      // Non-serialized bulk stock (MUST BE EXCLUDED in Mode B — no fake serials!)
      await mssInventoryService.createBulkStock({
        model_id: modelDell.id,
        stock_location: 'محل 1',
        quantity: 10,
        list_price: 12000,
        purchase_cost: 9000,
      });

      // Reserved device (MUST BE EXCLUDED in wholesale export)
      await mssInventoryService.createDevice({
        model_id: modelMac.id,
        serial_number: getSerial('MAC-RESERVED'),
        stock_location: 'محل 1',
        list_price: 45000,
        purchase_cost: 38000,
        status: 'RESERVED',
      });
    });

    test('4.1 Mode B exports 1 row per physical device with serial number and excludes bulk stock', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        branchFilter: 'ALL',
      });

      const targetSerials = [sDell8, sDell12, sHp15, sMac45];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      // Exactly 4 available serialized devices
      assert.strictEqual(targetRows.length, 4, 'Must include the 4 available serialized devices');

      // Verify NO quantity column in Mode B
      assert.strictEqual(
        targetRows[0]['الكمية المتاحة'],
        undefined,
        'Mode B must not include quantity column'
      );
    });

    test('4.2 Mode B CRITICAL INVARIANT: Devices MUST be sorted by price ascending (lowest to highest)', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        branchFilter: 'ALL',
      });

      const targetSerials = [sDell8, sDell12, sHp15, sMac45];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      assert.strictEqual(targetRows.length, 4);
      assert.strictEqual(targetRows[0]['السيريال (Serial Number)'], sDell8, 'Lowest price device (8,000) first');
      assert.strictEqual(targetRows[0]['السعر (EGP)'], 8000);

      assert.strictEqual(targetRows[1]['السيريال (Serial Number)'], sDell12, 'Second device (12,000)');
      assert.strictEqual(targetRows[1]['السعر (EGP)'], 12000);

      assert.strictEqual(targetRows[2]['السيريال (Serial Number)'], sHp15, 'Third device (15,000)');
      assert.strictEqual(targetRows[2]['السعر (EGP)'], 15000);

      assert.strictEqual(targetRows[3]['السيريال (Serial Number)'], sMac45, 'Highest price device (45,000) last');
      assert.strictEqual(targetRows[3]['السعر (EGP)'], 45000);
    });

    test('4.3 Mode B CRITICAL INVARIANT: Price ascending sorting applies EVEN WHEN prices are hidden', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: false, // PRICES HIDDEN!
        includeQuantity: false,
        includeSerialNumbers: true,
        branchFilter: 'ALL',
      });

      const targetSerials = [sDell8, sDell12, sHp15, sMac45];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      assert.strictEqual(targetRows.length, 4);
      // Price column is not present
      assert.strictEqual(targetRows[0]['السعر (EGP)'], undefined);

      // BUT order MUST STILL BE strictly sorted by price ascending!
      assert.strictEqual(targetRows[0]['السيريال (Serial Number)'], sDell8);
      assert.strictEqual(targetRows[1]['السيريال (Serial Number)'], sDell12);
      assert.strictEqual(targetRows[2]['السيريال (Serial Number)'], sHp15);
      assert.strictEqual(targetRows[3]['السيريال (Serial Number)'], sMac45);
    });
  });

  // ============================================================================
  // 5. BRANCH FILTERING IN WHOLESALE EXPORT
  // ============================================================================
  describe('5. Branch Filtering in Wholesale Export', () => {
    let sB1, sB2;

    beforeEach(async () => {
      sB1 = getSerial('B1');
      sB2 = getSerial('B2');

      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: sB1,
        stock_location: 'محل 1',
        list_price: 10000,
        purchase_cost: 8000,
        status: 'AVAILABLE',
      });
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: sB2,
        stock_location: 'محل 2',
        list_price: 10000,
        purchase_cost: 8000,
        status: 'AVAILABLE',
      });
    });

    test('5.1 branchFilter: "محل 1" only includes items located in محل 1', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        branchFilter: 'محل 1',
      });

      const targetSerials = [sB1, sB2];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      assert.strictEqual(targetRows.length, 1);
      assert.strictEqual(targetRows[0]['السيريال (Serial Number)'], sB1);
      assert.strictEqual(targetRows[0]['الفرع / المخزن'], 'محل 1');
    });

    test('5.2 branchFilter: "محل 2" only includes items located in محل 2', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        branchFilter: 'محل 2',
      });

      const targetSerials = [sB1, sB2];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      assert.strictEqual(targetRows.length, 1);
      assert.strictEqual(targetRows[0]['السيريال (Serial Number)'], sB2);
      assert.strictEqual(targetRows[0]['الفرع / المخزن'], 'محل 2');
    });

    test('5.3 branchFilter: "ALL" includes items from all branches', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        branchFilter: 'ALL',
      });

      const targetSerials = [sB1, sB2];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));

      assert.strictEqual(targetRows.length, 2);
    });

    test('5.4 includeBranch: false completely omits the branch / warehouse column', async () => {
      const { rows, columns } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        includeBranch: false, // Branch column disabled
        branchFilter: 'ALL',
      });

      const headerKeys = columns.map(c => c.key);
      assert.ok(!headerKeys.includes('stock_location'), 'stock_location must not be in columns');
      assert.ok(!columns.some(c => c.header === 'الفرع / المخزن'), 'Header الفرع / المخزن must not exist');

      const targetSerials = [sB1, sB2];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));
      assert.strictEqual(targetRows.length, 2);
      assert.strictEqual(targetRows[0]['الفرع / المخزن'], undefined, 'Row must not have الفرع / المخزن property');
    });

    test('5.5 includeBranch: true (default) includes branch from recorded inventory location', async () => {
      const { rows, columns } = await mssWholesaleExportService.buildWholesaleData({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        includeBranch: true,
        branchFilter: 'ALL',
      });

      const headerKeys = columns.map(c => c.key);
      assert.ok(headerKeys.includes('stock_location'), 'stock_location must be in columns');
      assert.ok(columns.some(c => c.header === 'الفرع / المخزن'));

      const targetSerials = [sB1, sB2];
      const targetRows = rows.filter(r => targetSerials.includes(r['السيريال (Serial Number)']));
      assert.strictEqual(targetRows.length, 2);
      const row1 = targetRows.find(r => r['السيريال (Serial Number)'] === sB1);
      assert.strictEqual(row1['الفرع / المخزن'], 'محل 1');
    });
  });

  // ============================================================================
  // 6. EXCEL WORKBOOK GENERATION & RTL SHEET VIEW
  // ============================================================================
  describe('6. Excel Workbook Generation & RTL Sheet View', () => {
    test('6.1 buildWholesaleWorkbook creates workbook with correct sheet name and RTL configuration', async () => {
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: getSerial('WB'),
        stock_location: 'محل 1',
        list_price: 11000,
        purchase_cost: 8000,
        status: 'AVAILABLE',
      });

      const { workbook, filename } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        branchFilter: 'ALL',
      });

      assert.ok(workbook);
      assert.ok(workbook.SheetNames.includes('المخزون المتاح للجملة'), 'Must name sheet المخزون المتاح للجملة');
      assert.ok(filename.startsWith('تقرير_مخزون_الأجهزة_المتاحة'), 'Filename must follow Arabic naming requirement');
      assert.ok(filename.endsWith('.xlsx'), 'Filename must end with .xlsx');

      const sheet = workbook.Sheets['المخزون المتاح للجملة'];
      assert.ok(sheet['!cols'], 'Must configure column widths');
      assert.ok(sheet['!cols'].length > 0, 'Column widths array must be populated');
      assert.ok(workbook.Workbook?.Views?.[0]?.RTL, 'Workbook view must be set to RTL: true');
    });
  });

  // ============================================================================
  // 7. MODEL QUANTITY SUMMARY ACCOUNTING INVARIANT
  // ============================================================================
  describe('7. Model Quantity Summary Accounting Invariant', () => {
    test('7.1 Preserves Total = Existing + Sold invariant with serialized and bulk stock', async () => {
      const s1 = getSerial('INV-1');
      const s2 = getSerial('INV-2');

      // 2 available serialized
      const dev1 = await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: s1,
        stock_location: 'محل 1',
        list_price: 10000,
        purchase_cost: 8000,
        status: 'AVAILABLE',
      });
      await mssInventoryService.createDevice({
        model_id: modelDell.id,
        serial_number: s2,
        stock_location: 'محل 1',
        list_price: 10000,
        purchase_cost: 8000,
        status: 'AVAILABLE',
      });

      // 5 bulk units
      await mssInventoryService.createBulkStock({
        model_id: modelDell.id,
        stock_location: 'محل 1',
        quantity: 5,
        list_price: 10000,
        purchase_cost: 8000,
      });

      // Sell 1 serialized unit
      await mssCommerceService.confirmSale({
        selling_branch: 'محل 1',
        source_branch: 'محل 1',
        customer_name: 'عميل جملة تجريبي',
        items: [
          {
            device_id: dev1.id,
            model_id: modelDell.id,
            is_serialized: true,
            serial_number: s1,
            quantity: 1,
            unit_price: 10000,
            discount_amount: 0,
            actual_sale_price: 10000,
            source_branch: 'محل 1',
          },
        ],
      });

      const summaries = await mssInventoryService.getModelStockQuantitySummary();
      const dellSummary = summaries.find(s => s.model_id === modelDell.id);

      assert.ok(dellSummary);
      assert.strictEqual(dellSummary.sold_units, 1, 'Sold units must equal 1');
      assert.strictEqual(dellSummary.existing_units, 6, 'Existing units must equal 1 serial + 5 bulk = 6');
      assert.strictEqual(dellSummary.total_units, 7, 'Total units must equal 6 existing + 1 sold = 7');
      assert.strictEqual(
        dellSummary.total_units,
        dellSummary.existing_units + dellSummary.sold_units,
        'Accounting invariant Total = Existing + Sold must strictly hold'
      );
    });
  });
});
