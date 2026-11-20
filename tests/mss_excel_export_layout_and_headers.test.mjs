import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSXStyle from 'xlsx-js-style';
const XLSX = (XLSXStyle && XLSXStyle.default) || XLSXStyle;

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

const { mssWholesaleExportService, WHOLESALE_HEADERS, matchesCategory } = await import('../src/services/mssWholesaleExportService.ts');
const { mssInventoryService } = await import('../src/services/mssInventoryService.ts');
const { mssCatalogService } = await import('../src/services/mssCatalogService.ts');

describe('COMPU MSS — EXCEL EXPORT LAYOUT, MOBILE READABILITY & CONCISE ARABIC HEADERS', () => {
  let modelLaptopDell;
  let modelLaptopMac;
  let modelMonitor;
  let devDell;
  let devMac;
  let devMon;
  let uid = 0;
  const getSerial = (p) => `SN-${p}-${Date.now()}-${++uid}`;

  beforeEach(async () => {
    // 1. Create a Dell Laptop model
    modelLaptopDell = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: 'Latitude 5420 ' + Date.now().toString(36),
      category: 'لابتوب',
      processor: 'Intel Core i5-1145G7',
      gpu: 'Intel Iris Xe Graphics',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD',
      screen_size: '14" FHD IPS Anti-Glare (1920x1080)',
      default_list_price: 14800,
    });

    // 2. Create an Apple MacBook model
    modelLaptopMac = await mssCatalogService.createModel({
      brand: 'Apple',
      model_name: 'MacBook Air M2 ' + Date.now().toString(36),
      category: 'لابتوب',
      processor: 'Apple M2 8-core',
      gpu: '10-core GPU',
      ram: '16GB Unified',
      storage: '512GB SSD',
      screen_size: '13.6" Liquid Retina Display',
      default_list_price: 13500,
    });

    // 3. Create a Dell Monitor model
    modelMonitor = await mssCatalogService.createModel({
      brand: 'Dell',
      model_name: 'UltraSharp U2419H ' + Date.now().toString(36),
      category: 'شاشة',
      processor: '---',
      gpu: '---',
      ram: '---',
      storage: '---',
      screen_size: '24" FHD IPS (1920x1080)',
      default_list_price: 4200,
    });

    // Create physical inventory devices
    devDell = await mssInventoryService.createDevice({
      model_id: modelLaptopDell.id,
      serial_number: getSerial('DELL-LAT'),
      stock_location: 'محل 1',
      list_price: 14800,
      purchase_cost: 11000,
      physical_condition: 'فرز أول نظيف جداً',
      status: 'AVAILABLE',
    });

    devMac = await mssInventoryService.createDevice({
      model_id: modelLaptopMac.id,
      serial_number: getSerial('MAC-AIR'),
      stock_location: 'محل 2',
      list_price: 13500,
      purchase_cost: 10500,
      physical_condition: 'فرز أول',
      status: 'AVAILABLE',
    });

    devMon = await mssInventoryService.createDevice({
      model_id: modelMonitor.id,
      serial_number: getSerial('DELL-MON'),
      stock_location: 'محل 1',
      list_price: 4200,
      purchase_cost: 3000,
      physical_condition: 'سليم تماماً',
      status: 'AVAILABLE',
    });
  });

  // ==========================================================================
  // 1. ALL OPTIONAL COLUMNS VISIBLE
  // ==========================================================================
  describe('1. All Optional Columns Visible', () => {
    test('1.1 Mode B (with Serial Numbers): exports all 11 columns in clean order with concise Arabic headers', async () => {
      const { wb, columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: true,
        includePrices: true,
        includeCategory: true,
        includeScreen: true,
        includeStatus: true,
        includeBranch: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'السيريال نمبر',
        'الموديل',
        'الفئة',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الشاشة',
        'الحالة',
        'الفرع / المخزن',
        'السعر',
      ];

      assert.equal(columns.length, expectedHeaders.length, 'Column count must exactly match 11');
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader, `Column ${c} header must be "${expectedHeader}"`);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader, `Cell ${cellRef} header in sheet must match "${expectedHeader}"`);
      });

      // Find our specific Dell Monitor row in the exported sheet
      const monRowIdx = rows.findIndex(r => r.serial_number === devMon.serial_number || r['السيريال نمبر'] === devMon.serial_number);
      assert.ok(monRowIdx >= 0, 'Dell Monitor row must be in rows array');
      const r = monRowIdx + 2; // +1 for 1-based, +1 for header row

      assert.equal(ws[`A${r}`]?.v, devMon.serial_number, 'Serial number must be in column A');
      assert.ok(ws[`B${r}`]?.v.includes('UltraSharp U2419H'), 'Model must be in column B');
      assert.equal(ws[`C${r}`]?.v, 'شاشة', 'Category must be in column C');
      assert.equal(ws[`D${r}`]?.v, '---', 'Processor placeholder in column D');
      assert.equal(ws[`E${r}`]?.v, '---', 'RAM placeholder in column E');
      assert.equal(ws[`F${r}`]?.v, '---', 'Storage placeholder in column F');
      assert.equal(ws[`G${r}`]?.v, '---', 'GPU placeholder in column G');
      assert.ok(ws[`H${r}`]?.v.includes('24"'), 'Screen must be in column H');
      assert.equal(ws[`I${r}`]?.v, 'سليم تماماً', 'Status must be in column I');
      assert.equal(ws[`J${r}`]?.v, 'محل 1', 'Branch must be in column J');
      assert.equal(ws[`K${r}`]?.v, 4200, 'Price must be in column K as number 4200');
      assert.equal(ws[`K${r}`]?.t, 'n', 'Price must be numeric cell type');

      // Verify no extra column L exists
      assert.equal(ws['L1'], undefined, 'No column L should exist in sheet');
    });

    test('1.2 Mode A (Grouped by Model): exports all 11 columns including Quantity and concise Arabic headers', async () => {
      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false,
        includeQuantity: true,
        includePrices: true,
        includeCategory: true,
        includeScreen: true,
        includeStatus: true,
        includeBranch: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'الموديل',
        'الفئة',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الشاشة',
        'الحالة',
        'الفرع / المخزن',
        'الكمية',
        'السعر',
      ];

      assert.equal(columns.length, expectedHeaders.length);
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader);
      });

      // No column L
      assert.equal(ws['L1'], undefined);
    });
  });

  // ==========================================================================
  // 2. ALL FIVE PROBLEMATIC COLUMNS HIDDEN (REPRODUCING USER SCREENSHOT)
  // ==========================================================================
  describe('2. All Five Problematic Columns Hidden (Fixing User Bug)', () => {
    test('2.1 When hiding Screen, Category, Status, Branch, Serial: exactly 7 columns are exported with zero misplaced data', async () => {
      const { wb, columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false, // Hidden 1: Serial
        includeCategory: false,      // Hidden 2: Category
        includeScreen: false,        // Hidden 3: Screen
        includeStatus: false,        // Hidden 4: Status
        includeBranch: false,        // Hidden 5: Branch
        includeQuantity: true,
        includePrices: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'الموديل',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الكمية',
        'السعر',
      ];

      assert.equal(columns.length, 7, 'Must have EXACTLY 7 columns');
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader, `Cell ${cellRef} must have header "${expectedHeader}"`);
      });

      // Crucial: In the user's broken screenshot, columns H, I, J, K, L appeared!
      // Here, columns H, I, J, K, L MUST NOT EXIST!
      assert.equal(ws['H1'], undefined, 'Column H (col 8) must NOT exist');
      assert.equal(ws['I1'], undefined, 'Column I (col 9) must NOT exist');
      assert.equal(ws['J1'], undefined, 'Column J (col 10) must NOT exist');
      assert.equal(ws['K1'], undefined, 'Column K (col 11) must NOT exist');
      assert.equal(ws['L1'], undefined, 'Column L (col 12) must NOT exist');

      // Verify Dell Latitude 5420 row
      const dellRowIdx = rows.findIndex(r => (r['الموديل'] || '').includes('Latitude 5420'));
      assert.ok(dellRowIdx >= 0);
      const r = dellRowIdx + 2; // +1 for 1-based, +1 for header row
      assert.ok(ws[`A${r}`]?.v.includes('Latitude 5420'), 'Col A must be Model');
      assert.equal(ws[`B${r}`]?.v, 'Intel Core i5-1145G7', 'Col B must be Processor');
      assert.ok(ws[`C${r}`]?.v.includes('16') && ws[`C${r}`]?.v.includes('DDR4'), 'Col C must be RAM');
      assert.ok(ws[`D${r}`]?.v.includes('512') && ws[`D${r}`]?.v.includes('SSD'), 'Col D must be Storage');
      assert.equal(ws[`E${r}`]?.v, 'Intel Iris Xe Graphics', 'Col E must be GPU');
      assert.equal(typeof ws[`F${r}`]?.v, 'number', 'Col F must be numeric Quantity');
      assert.equal(ws[`G${r}`]?.v, 14800, 'Col G must be numeric Price 14800');
      assert.equal(ws[`G${r}`]?.t, 'n');
    });
  });

  // ==========================================================================
  // 3. ONLY SCREEN AND CATEGORY HIDDEN
  // ==========================================================================
  describe('3. Only Screen Specifications and Category Hidden', () => {
    test('3.1 Screen and Category columns are completely omitted while others remain in exact alignment', async () => {
      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false,
        includeCategory: false,
        includeScreen: false,
        includeStatus: true,
        includeBranch: true,
        includeQuantity: true,
        includePrices: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'الموديل',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الحالة',
        'الفرع / المخزن',
        'الكمية',
        'السعر',
      ];

      assert.equal(columns.length, 9, 'Must have exactly 9 columns');
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader);
      });

      // Column J (col 10) must be undefined
      assert.equal(ws['J1'], undefined);
    });
  });

  // ==========================================================================
  // 4. ONLY SERIAL NUMBER AND BRANCH/WAREHOUSE HIDDEN
  // ==========================================================================
  describe('4. Only Serial Number and Branch/Warehouse Hidden', () => {
    test('4.1 Serial and Branch columns omitted while Category and Screen remain visible', async () => {
      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false,
        includeBranch: false,
        includeCategory: true,
        includeScreen: true,
        includeStatus: true,
        includeQuantity: true,
        includePrices: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'الموديل',
        'الفئة',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الشاشة',
        'الحالة',
        'الكمية',
        'السعر',
      ];

      assert.equal(columns.length, 10, 'Must have exactly 10 columns');
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader);
      });

      assert.equal(ws['K1'], undefined);
    });
  });

  // ==========================================================================
  // 5. COMBINATIONS OF VISIBLE AND HIDDEN COLUMNS
  // ==========================================================================
  describe('5. Arbitrary Combinations of Optional Columns', () => {
    test('5.1 Prices and Quantity hidden: columns are completely excluded from sheet', async () => {
      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false,
        includePrices: false,
        includeQuantity: false,
        includeCategory: true,
        includeScreen: true,
        includeStatus: false,
        includeBranch: false,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      const expectedHeaders = [
        'الموديل',
        'الفئة',
        'المعالج',
        'الرام',
        'الهارد',
        'كارت الشاشة',
        'الشاشة',
      ];

      assert.equal(columns.length, 7);
      expectedHeaders.forEach((expectedHeader, c) => {
        assert.equal(columns[c].header, expectedHeader);
        const cellRef = XLSX.utils.encode_cell({ r: 0, c });
        assert.equal(ws[cellRef]?.v, expectedHeader);
      });
      assert.equal(ws['H1'], undefined);
    });
  });

  // ==========================================================================
  // 6. CATEGORY FILTERING (LAPTOPS, MONITORS, MULTIPLE)
  // ==========================================================================
  describe('6. Dynamic Category Filtering', () => {
    test('6.1 Filter by Laptops only: exports only laptops and excludes monitors', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        selectedCategories: ['لابتوب'],
        includePrices: true,
      });

      assert.ok(rows.length > 0, 'Must have laptop rows');
      assert.ok(rows.every(r => matchesCategory(r['الفئة'] || r.category, ['لابتوب'])), 'All exported rows must be laptops');
    });

    test('6.2 Filter by Monitors only: exports only monitors and excludes laptops', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        selectedCategories: ['شاشة'],
        includePrices: true,
      });

      assert.ok(rows.length > 0, 'Must have monitor rows');
      assert.ok(rows.every(r => matchesCategory(r['الفئة'] || r.category, ['شاشة'])), 'All exported rows must be monitors');
    });

    test('6.3 Filter by both Laptops and Monitors: exports both categories', async () => {
      const { rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        selectedCategories: ['لابتوب', 'شاشة'],
        includePrices: true,
      });

      assert.ok(rows.length > 0);
      assert.ok(rows.some(r => matchesCategory(r['الفئة'] || r.category, ['لابتوب'])), 'Must contain laptops');
      assert.ok(rows.some(r => matchesCategory(r['الفئة'] || r.category, ['شاشة'])), 'Must contain monitors');
    });
  });

  // ==========================================================================
  // 7. DESKTOP & MOBILE READABILITY & COMPATIBILITY
  // ==========================================================================
  describe('7. Desktop & Mobile Compatibility', () => {
    test('7.1 Sheet has LTR direction, frozen header row, autofilter, and numeric formatting', async () => {
      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];

      // 1. LTR Direction
      assert.equal(wb.Workbook.Views[0].RTL, false, 'Workbook View must be LTR');
      assert.equal(ws['!views'][0].rightToLeft, false, 'Worksheet View must be LTR');

      // 2. Frozen Header Row
      assert.equal(ws['!views'][0].state, 'frozen', 'View must be frozen');
      assert.equal(ws['!views'][0].ySplit, 1, 'Freeze must be at row 1');
      assert.equal(ws['!freeze'].ySplit, 1, 'Freeze definition must be at row 1');

      // 3. AutoFilter
      assert.ok(ws['!autofilter'], 'Autofilter must be defined');
      assert.ok(ws['!autofilter'].ref.startsWith('A1:'), 'Autofilter range must start at A1');

      // 4. Practical Row Heights
      assert.equal(ws['!rows'][0].hpt, 26, 'Header row height should be 26pt');
      assert.equal(ws['!rows'][1].hpt, 22, 'Data row height should be 22pt');

      // 5. Practical Column Widths
      assert.ok(ws['!cols'].every(c => c.wch >= 14 && c.wch <= 50), 'All column widths must be between 14 and 50');

      // 6. Header Styling
      const headerCell = ws['A1'];
      assert.equal(headerCell.s.fill.fgColor.rgb, '0C3582', 'Header must be Navy Blue');
      assert.equal(headerCell.s.font.color.rgb, 'FFFFFF', 'Header text must be White');
      assert.equal(headerCell.s.font.bold, true, 'Header text must be Bold');
      assert.equal(headerCell.s.alignment.horizontal, 'center', 'Header text must be centered');

      // 7. Data Cell Styling
      const dataCell = ws['A2'];
      assert.ok(dataCell.s.alignment.horizontal === 'right' || dataCell.s.alignment.horizontal === 'left');
      assert.equal(dataCell.s.alignment.wrapText, true, 'Wrap text must be enabled');
    });
  });

  // ==========================================================================
  // 8. CONCISE ARABIC LABELS COMPLIANCE
  // ==========================================================================
  describe('8. Concise Arabic Column Labels Verification', () => {
    test('8.1 Headers have no English words and use concise Arabic labels', async () => {
      const { columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: true,
        includePrices: true,
        includeQuantity: true,
        includeCategory: true,
        includeScreen: true,
        includeStatus: true,
        includeBranch: true,
      });

      for (const col of columns) {
        // Must NOT contain English words like Brand, Model, Processor, Memory, GPU, etc.
        assert.ok(!/[a-zA-Z]/.test(col.header), `Header "${col.header}" should not contain English words`);
      }

      // Check specific Arabic naming table
      const headerMap = new Map(columns.map(c => [c.key, c.header]));
      assert.equal(headerMap.get('brand_and_model'), 'الموديل');
      assert.equal(headerMap.get('processor'), 'المعالج');
      assert.equal(headerMap.get('ram'), 'الرام');
      assert.equal(headerMap.get('storage'), 'الهارد');
      assert.equal(headerMap.get('screen'), 'الشاشة');
      assert.equal(headerMap.get('gpu'), 'كارت الشاشة');
      assert.equal(headerMap.get('serial_number'), 'السيريال نمبر');
      assert.equal(headerMap.get('price'), 'السعر');
      assert.equal(headerMap.get('category'), 'الفئة');
      assert.equal(headerMap.get('physical_condition'), 'الحالة');
      assert.equal(headerMap.get('stock_location'), 'الفرع / المخزن');
    });
  });

  // ==========================================================================
  // 9. ALTERNATING ROW COLORS (ZEBRA STRIPING) ACROSS ALL COLUMNS
  // ==========================================================================
  describe('9. Alternating Row Colors (Zebra Striping) Verification', () => {
    test('9.1 Alternates between white (#FFFFFF) and light gray (#F1F5F9) across all exported columns', async () => {
      const { wb, columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: true,
        includePrices: true,
        includeCategory: true,
        includeScreen: true,
        includeStatus: true,
        includeBranch: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      assert.ok(rows.length >= 2, 'Must have at least 2 rows for zebra striping verification');

      // Verify Header Row distinct styling
      for (let c = 0; c < columns.length; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: 0, c });
        const cell = ws[headerRef];
        assert.ok(cell, `Header cell ${headerRef} must exist`);
        assert.equal(cell.s.fill.patternType, 'solid');
        assert.equal(cell.s.fill.fgColor.rgb, '0C3582');
        assert.equal(cell.s.font.color.rgb, 'FFFFFF');
        assert.equal(cell.s.font.bold, true);
      }

      // Verify Data Rows alternating colors
      for (let r = 1; r <= rows.length; r++) {
        const isEven = (r - 1) % 2 === 0;
        const expectedColor = isEven ? 'FFFFFF' : 'F1F5F9';

        for (let c = 0; c < columns.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellRef];
          assert.ok(cell, `Data cell ${cellRef} must exist`);
          assert.equal(cell.s.fill.patternType, 'solid', `Cell ${cellRef} must have solid patternType`);
          assert.equal(cell.s.fill.fgColor.rgb, expectedColor, `Cell ${cellRef} row ${r} must have color ${expectedColor}`);
          assert.equal(cell.s.font.color.rgb, '0F172A', `Cell ${cellRef} must maintain high-contrast dark text`);
        }
      }
    });

    test('9.2 Alternating colors remain consistent when optional columns are hidden', async () => {
      const { wb, columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includeSerialNumbers: false,
        includeCategory: false,
        includeScreen: false,
        includeStatus: false,
        includeBranch: false,
        includeQuantity: true,
        includePrices: true,
      });

      const ws = wb.Sheets[wb.SheetNames[0]];
      assert.equal(columns.length, 7, 'Must have exactly 7 columns');

      for (let r = 1; r <= rows.length; r++) {
        const isEven = (r - 1) % 2 === 0;
        const expectedColor = isEven ? 'FFFFFF' : 'F1F5F9';

        for (let c = 0; c < columns.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellRef];
          assert.ok(cell, `Cell ${cellRef} must exist`);
          assert.equal(cell.s.fill.patternType, 'solid');
          assert.equal(cell.s.fill.fgColor.rgb, expectedColor);
        }
      }
    });
  });
});
