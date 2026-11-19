import { test, describe } from 'node:test';
import assert from 'node:assert';
import XLSXStyle from 'xlsx-js-style';
const XLSX = XLSXStyle.default || XLSXStyle;

describe('COMPU MSS — EXCEL EXPORT VISUAL FORMATTING ENHANCEMENTS', () => {

  // Mock sample devices and models dataset
  const sampleModels = [
    {
      id: 'mod-dell-5420',
      brand: 'Dell',
      model_name: 'Latitude 5420',
      category: 'لابتوب',
      processor: 'Intel Core i5-1145G7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Intel Iris Xe',
      screen_size: '14.0',
      specifications: 'FHD IPS Anti-Glare',
      default_list_price: 12800,
    },
    {
      id: 'mod-hp-840g7',
      brand: 'HP',
      model_name: 'EliteBook 840 G7',
      category: 'لابتوب',
      processor: 'Intel Core i5-10310U',
      ram: '8GB',
      storage: '256GB SSD',
      gpu: 'Intel UHD Graphics',
      screen_size: '14.0',
      specifications: 'FHD IPS',
      default_list_price: 10000,
    },
    {
      id: 'mod-hp-zbook',
      brand: 'HP',
      model_name: 'ZBook Fury 15 G7',
      category: 'لابتوب',
      processor: 'Intel Core i7-10850H',
      ram: '32GB',
      storage: '512GB SSD',
      gpu: 'NVIDIA Quadro T2000 4GB',
      screen_size: '15.6',
      specifications: 'FHD IPS 144Hz',
      default_list_price: 26000,
    },
    {
      id: 'mod-lenovo-t14',
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 2',
      category: 'لابتوب',
      processor: 'AMD Ryzen 7 5800U',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'AMD Radeon Graphics',
      screen_size: '14.0',
      specifications: 'FHD IPS Touch',
      default_list_price: 16500,
    },
  ];

  const sampleDevices = [
    {
      id: 'dev-d5420-1',
      model_id: 'mod-dell-5420',
      brand: 'Dell',
      model_name: 'Latitude 5420',
      serial_number: 'SN-DELL-5420-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 12800,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
    },
    {
      id: 'dev-hp840-1',
      model_id: 'mod-hp-840g7',
      brand: 'HP',
      model_name: 'EliteBook 840 G7',
      serial_number: 'SN-HP-840-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 10000,
      stock_location: 'محل 2',
      physical_condition: 'جيدة جداً',
    },
    {
      id: 'dev-hpzbook-1',
      model_id: 'mod-hp-zbook',
      brand: 'HP',
      model_name: 'ZBook Fury 15 G7',
      serial_number: 'SN-HP-ZBOOK-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 26000,
      stock_location: 'مخزن رئيسي',
      physical_condition: 'جديد بالكرتونة',
    },
    {
      id: 'dev-len-1',
      model_id: 'mod-lenovo-t14',
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 2',
      serial_number: 'SN-LEN-T14-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 16500,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
    },
  ];

  // =========================================================================
  // 1. COLORED TABLE HEADERS
  // =========================================================================
  describe('1. Colored Table Headers', () => {
    test('1.1 Applies dark blue / navy background (#0C3582) to header row', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        includeBranch: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      assert.ok(ws, 'Worksheet must exist');

      // Check header cells: A1, B1, C1, etc.
      const cellA1 = ws['A1'];
      assert.ok(cellA1, 'Cell A1 must exist');
      assert.ok(cellA1.s, 'Cell A1 must have styling object');
      assert.ok(cellA1.s.fill, 'Cell A1 must have fill styling');

      // The color should contain 0C3582 (or FF0C3582 in ARGB)
      const fgRgb = cellA1.s.fill.fgColor?.rgb || '';
      assert.ok(fgRgb.includes('0C3582'), `Header background color must be #0C3582, got ${fgRgb}`);
    });

    test('1.2 Sets bold white high-contrast text and centered alignment for header cells', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: false,
        includeSerialNumbers: true,
        includeBranch: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];

      // Verify every column header cell has bold white text and centered alignment
      columns.forEach((col, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        const cell = ws[cellRef];
        assert.ok(cell, `Header cell ${cellRef} must exist for ${col.header}`);
        assert.strictEqual(cell.s.font.bold, true, `Header ${cellRef} font must be bold`);
        assert.strictEqual(cell.s.font.color.rgb, 'FFFFFF', `Header ${cellRef} text must be white`);
        assert.strictEqual(cell.s.alignment.horizontal, 'center', `Header ${cellRef} horizontal alignment must be center`);
        assert.strictEqual(cell.s.alignment.vertical, 'center', `Header ${cellRef} vertical alignment must be center`);
        assert.strictEqual(cell.s.alignment.wrapText, true, `Header ${cellRef} must have text wrapping enabled`);
      });
    });

    test('1.3 Applies distinct header height (26pt) and distinct borders', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      assert.ok(ws['!rows'], '!rows property must be set on worksheet');
      assert.strictEqual(ws['!rows'][0]?.hpt, 26, 'Header row height should be 26pt for comfortable breathing room');

      const cellA1 = ws['A1'];
      assert.ok(cellA1.s.border, 'Header cell must have border styling');
      assert.ok(cellA1.s.border.bottom, 'Header cell must have bottom border');
    });
  });

  // =========================================================================
  // 2. ALTERNATING ROW COLORS (ZEBRA STRIPING)
  // =========================================================================
  describe('2. Alternating Row Colors (Zebra Striping)', () => {
    test('2.1 Alternates between white (#FFFFFF) and light subtle gray (#F1F5F9) consistently', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, rows, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      assert.ok(rows.length >= 3, 'Must have at least 3 rows to test alternating zebra striping');

      // Check each data row (Row 1 to rows.length in 0-indexed worksheet)
      for (let r = 1; r <= rows.length; r++) {
        const isEven = (r - 1) % 2 === 0;
        const expectedColorPart = isEven ? 'FFFFFF' : 'F1F5F9';

        for (let c = 0; c < columns.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellRef];
          assert.ok(cell, `Data cell ${cellRef} must exist`);
          assert.ok(cell.s?.fill?.fgColor?.rgb, `Data cell ${cellRef} must have fill color`);

          const rgb = cell.s.fill.fgColor.rgb;
          assert.ok(
            rgb.includes(expectedColorPart),
            `Row ${r} (data row index ${r - 1}) cell ${cellRef} should have color ${expectedColorPart}, but got ${rgb}`
          );
        }
      }
    });

    test('2.2 Sets comfortable data row heights (22pt) across all data rows', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      for (let i = 1; i <= rows.length; i++) {
        assert.strictEqual(ws['!rows'][i]?.hpt, 22, `Data row ${i} height must be 22pt`);
      }
    });
  });

  // =========================================================================
  // 3. TABLE BORDERS AND CELL FORMATTING
  // =========================================================================
  describe('3. Table Borders and Cell Formatting', () => {
    test('3.1 Applies thin borders (#CBD5E1) around all data cells', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: false,
        includeSerialNumbers: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      const cellA2 = ws['A2']; // First data row, first column
      assert.ok(cellA2.s.border, 'Data cell must have border object');
      assert.strictEqual(cellA2.s.border.top.style, 'thin');
      assert.strictEqual(cellA2.s.border.bottom.style, 'thin');
      assert.strictEqual(cellA2.s.border.left.style, 'thin');
      assert.strictEqual(cellA2.s.border.right.style, 'thin');
      assert.strictEqual(cellA2.s.border.top.color.rgb, 'CBD5E1');
    });

    test('3.2 Right-aligns Brand & Model and center-aligns specifications and short values', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];

      // Row 1 (first data row)
      columns.forEach((col, cIdx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 1, c: cIdx });
        const cell = ws[cellRef];
        assert.ok(cell, `Cell ${cellRef} must exist`);

        if (col.key === 'brand_and_model') {
          assert.strictEqual(
            cell.s.alignment.horizontal,
            'right',
            `Brand & Model cell ${cellRef} must be right-aligned for Arabic RTL readability`
          );
        } else {
          assert.strictEqual(
            cell.s.alignment.horizontal,
            'center',
            `Column ${col.header} cell ${cellRef} must be center-aligned`
          );
        }
        assert.strictEqual(cell.s.alignment.wrapText, true, `Cell ${cellRef} must have text wrapping enabled`);
      });
    });

    test('3.3 Formats Prices with EGP currency format and Quantities as formatted integers', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      const priceColIdx = columns.findIndex(c => c.key === 'price');
      const qtyColIdx = columns.findIndex(c => c.key === 'quantity');

      assert.ok(priceColIdx >= 0, 'Price column must exist');
      assert.ok(qtyColIdx >= 0, 'Quantity column must exist');

      const priceCellRef = XLSX.utils.encode_cell({ r: 1, c: priceColIdx });
      const qtyCellRef = XLSX.utils.encode_cell({ r: 1, c: qtyColIdx });

      const priceCell = ws[priceCellRef];
      const qtyCell = ws[qtyCellRef];

      assert.strictEqual(priceCell.t, 'n', 'Price cell type must be numeric');
      assert.strictEqual(priceCell.s.numFmt, '#,##0 "EGP"', 'Price cell must have EGP number format');

      assert.strictEqual(qtyCell.t, 'n', 'Quantity cell type must be numeric');
      assert.strictEqual(qtyCell.s.numFmt, '#,##0', 'Quantity cell must have integer number format');
    });

    test('3.4 Sets dynamic column widths with padding to prevent truncation', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      assert.ok(ws['!cols'], 'Worksheet must have !cols defined');
      assert.strictEqual(ws['!cols'].length, columns.length);

      // Verify each column has a reasonable width (>= 14)
      ws['!cols'].forEach((colDef, idx) => {
        assert.ok(colDef.wch >= 14, `Column ${columns[idx].header} width (${colDef.wch}) should be >= 14`);
      });
    });
  });

  // =========================================================================
  // 4. REMOVE UNNECESSARY TITLE ROWS
  // =========================================================================
  describe('4. Remove Unnecessary Title Rows', () => {
    test('4.1 Table starts directly at Row 1 with column headers without merged title banners', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];

      // Row 1 (r = 0) must contain the exact column headers directly
      columns.forEach((col, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        const cell = ws[cellRef];
        assert.ok(cell, `Header cell ${cellRef} must exist`);
        assert.strictEqual(cell.v, col.header, `Row 1 must directly be column header ${col.header}`);
      });

      // No title rows above row 1: cell A1 is the first column header
      assert.strictEqual(ws['A1'].v, columns[0].header);

      // No title banners or merged title rows
      assert.ok(!ws['!merges'] || ws['!merges'].length === 0, 'Should not have merged banner rows above table');
    });
  });

  // =========================================================================
  // 5. DYNAMIC FORMATTING & EXPORT MODES
  // =========================================================================
  describe('5. Dynamic Formatting Across Modes & Filters', () => {
    test('5.1 Mode B (Serial Numbers ON) works cleanly with styling', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { wb, rows, columns } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: false,
        includeSerialNumbers: true,
        includeBranch: true,
      }, sampleDevices);

      const ws = wb.Sheets['المخزون المتاح للجملة'];
      assert.strictEqual(rows.length, sampleDevices.length);

      const serialColIdx = columns.findIndex(c => c.key === 'serial_number');
      assert.ok(serialColIdx >= 0, 'Serial number column must exist in Mode B');

      const firstSerialCell = ws[XLSX.utils.encode_cell({ r: 1, c: serialColIdx })];
      assert.ok(firstSerialCell.s, 'Serial number cell must be styled');
      assert.strictEqual(firstSerialCell.s.alignment.horizontal, 'center');
    });

    test('5.2 Generates valid binary buffer with exportWholesaleInventoryToExcel', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const result = await mssWholesaleExportService.exportWholesaleInventoryToExcel({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
      }, sampleDevices);

      assert.ok(result.buffer, 'Result must contain binary buffer');
      assert.ok(result.buffer.length > 1000, 'Buffer must be non-trivial');
      assert.ok(result.filename.endsWith('.xlsx'), 'Filename must end with .xlsx');
      assert.ok(result.filename.includes('2026-'), 'Filename must include generation date');
    });

    test('5.3 Zero-device validation throws descriptive Arabic error', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      await assert.rejects(
        async () => {
          await mssWholesaleExportService.buildWholesaleWorkbook({
            includePrices: true,
            includeQuantity: true,
            includeSerialNumbers: false,
            selectedBrands: ['BRAND_DOES_NOT_EXIST_XYZ_123'],
          }, sampleDevices);
        },
        /لا توجد أجهزة مطابقة لمعايير الفلترة المحددة لتصديرها/
      );
    });
  });

  // =========================================================================
  // 6. INDEPENDENT STATUS & BRANCH/WAREHOUSE SHOW/HIDE OPTIONS
  // =========================================================================
  describe('6. Independent Status & Branch/Warehouse Show/Hide Options', () => {
    test('6.1 Mode B: includeStatus: false completely omits the Status column', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { columns, rows, wb } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: false,
        includeSerialNumbers: true,
        includeStatus: false, // Omit Status
        includeBranch: true,
      }, sampleDevices);

      // Verify columns definition
      assert.ok(!columns.some(c => c.key === 'physical_condition'), 'physical_condition must not be in columns');
      assert.ok(!columns.some(c => c.header === 'الحالة'), 'Header الحالة must not be in columns');

      // Verify row objects
      rows.forEach(r => {
        assert.strictEqual(r['الحالة'], undefined, 'Row must not have الحالة property');
      });

      // Verify worksheet header cells
      const ws = wb.Sheets['المخزون المتاح للجملة'];
      columns.forEach((col, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        assert.notStrictEqual(ws[cellRef]?.v, 'الحالة');
      });
    });

    test('6.2 Mode A: includeStatus: false completely omits the Status column', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        includeStatus: false, // Omit Status
        includeBranch: true,
      }, sampleDevices);

      assert.ok(!columns.some(c => c.key === 'physical_condition'));
      assert.ok(!columns.some(c => c.header === 'الحالة'));

      rows.forEach(r => {
        assert.strictEqual(r['الحالة'], undefined);
      });
    });

    test('6.3 includeBranch: false completely omits the Branch / Warehouse column', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        includeStatus: true,
        includeBranch: false, // Omit Branch
      }, sampleDevices);

      assert.ok(!columns.some(c => c.key === 'stock_location'));
      assert.ok(!columns.some(c => c.header === 'الفرع / المخزن'));

      rows.forEach(r => {
        assert.strictEqual(r['الفرع / المخزن'], undefined);
      });
    });

    test('6.4 Both includeStatus: false and includeBranch: false completely omit both columns', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { columns, rows, wb } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: false,
        includeStatus: false, // Omit Status
        includeBranch: false, // Omit Branch
      }, sampleDevices);

      assert.ok(!columns.some(c => c.key === 'physical_condition'));
      assert.ok(!columns.some(c => c.header === 'الحالة'));
      assert.ok(!columns.some(c => c.key === 'stock_location'));
      assert.ok(!columns.some(c => c.header === 'الفرع / المخزن'));

      rows.forEach(r => {
        assert.strictEqual(r['الحالة'], undefined);
        assert.strictEqual(r['الفرع / المخزن'], undefined);
      });

      // Verify worksheet styles still apply cleanly
      const ws = wb.Sheets['المخزون المتاح للجملة'];
      const cellA1 = ws['A1'];
      assert.ok(cellA1.s?.fill?.fgColor?.rgb?.includes('0C3582'), 'Header style must still apply');
    });

    test('6.5 Both includeStatus: true and includeBranch: true include both columns with proper styling', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const { columns, rows } = await mssWholesaleExportService.buildWholesaleWorkbook({
        includePrices: true,
        includeQuantity: true,
        includeSerialNumbers: true,
        includeStatus: true,
        includeBranch: true,
      }, sampleDevices);

      const statusCol = columns.find(c => c.key === 'physical_condition');
      const branchCol = columns.find(c => c.key === 'stock_location');

      assert.ok(statusCol, 'Status column must exist');
      assert.ok(branchCol, 'Branch column must exist');

      rows.forEach(r => {
        assert.ok(r['الحالة'] !== undefined, 'Row must have الحالة');
        assert.ok(r['الفرع / المخزن'] !== undefined, 'Row must have الفرع / المخزن');
      });
    });
  });
});
