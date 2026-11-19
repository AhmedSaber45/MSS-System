import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('COMPU MSS — FIX EXCEL FILTERING, MULTI-BRAND/MODEL SELECTION & MULTI-PAGE PROMOTIONAL EXPORTS', () => {

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
      default_list_price: 13500,
    },
    {
      id: 'mod-dell-7490',
      brand: 'Dell',
      model_name: 'Latitude 7490',
      category: 'لابتوب',
      processor: 'Intel Core i7-8650U',
      ram: '16GB',
      storage: '256GB SSD',
      gpu: 'Intel UHD 620',
      screen_size: '14.0',
      specifications: 'FHD IPS Touch',
      default_list_price: 9800,
    },
    {
      id: 'mod-hp-840g8',
      brand: 'HP',
      model_name: 'EliteBook 840 G8',
      category: 'لابتوب',
      processor: 'Intel Core i5-1135G7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Intel Iris Xe',
      screen_size: '14.0',
      specifications: 'FHD IPS',
      default_list_price: 14200,
    },
    {
      id: 'mod-lenovo-t14',
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 2',
      category: 'لابتوب',
      processor: 'AMD Ryzen 7 5800U',
      ram: '32GB',
      storage: '1TB SSD',
      gpu: 'AMD Radeon Graphics',
      screen_size: '14.0',
      specifications: '4K UHD IPS',
      default_list_price: 18500,
    },
  ];

  const sampleDevices = [
    {
      id: 'dev-d5420-1',
      model_id: 'mod-dell-5420',
      brand: 'Dell',
      model_name: 'Latitude 5420',
      serial_number: 'SN-DELL-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 13500,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
    },
    {
      id: 'dev-d5420-2',
      model_id: 'mod-dell-5420',
      brand: 'dell ', // testing casing and trimming
      model_name: 'Latitude 5420',
      serial_number: 'SN-DELL-002',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 13900,
      stock_location: 'محل 2',
      physical_condition: 'جيدة جداً',
    },
    {
      id: 'dev-d7490-1',
      model_id: 'mod-dell-7490',
      brand: 'DELL',
      model_name: 'Latitude 7490',
      serial_number: 'SN-DELL-003',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 9800,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
    },
    {
      id: 'dev-hp840-1',
      model_id: 'mod-hp-840g8',
      brand: 'HP',
      model_name: 'EliteBook 840 G8',
      serial_number: 'SN-HP-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 14200,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
    },
    {
      id: 'dev-len-1',
      model_id: 'mod-lenovo-t14',
      brand: 'Lenovo',
      model_name: 'ThinkPad T14 Gen 2',
      serial_number: 'SN-LEN-001',
      status: 'AVAILABLE',
      is_serialized: true,
      quantity: 1,
      list_price: 18500,
      stock_location: 'محل 2',
      physical_condition: 'ممتازة',
    },
  ];

  // =========================================================================
  // 1. EXCEL EXPORT FILTERING & DATA CONSISTENCY
  // =========================================================================
  describe('1. Excel Export Advanced Filtering Fix', () => {
    test('1.1 Handles case-insensitive and trimmed multi-brand matching (OR logic across brands)', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      // Filter by Dell and HP (multiple brands)
      const res = await mssWholesaleExportService.buildWholesaleData(
        {
          includeSerialNumbers: true,
          includePrices: true,
          selectedBrands: ['dell', ' HP '],
        },
        sampleDevices
      );

      assert.strictEqual(res.rows.length, 4, 'Should match all 3 Dell and 1 HP device');
      assert.strictEqual(res.totalUnits, 4);
      // Lenovo must NOT be included
      assert.ok(res.rows.every(r => !r['الماركة والموديل (Brand & Model)'].includes('Lenovo')));
    });

    test('1.2 Handles multi-model matching (OR logic across models)', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const res = await mssWholesaleExportService.buildWholesaleData(
        {
          includeSerialNumbers: true,
          includePrices: true,
          selectedModelIds: ['mod-dell-7490', 'mod-lenovo-t14'],
        },
        sampleDevices
      );

      assert.strictEqual(res.rows.length, 2, 'Should match 1 Dell 7490 and 1 Lenovo T14');
      const serials = res.rows.map(r => r['السيريال (Serial Number)']);
      assert.ok(serials.includes('SN-DELL-003'));
      assert.ok(serials.includes('SN-LEN-001'));
    });

    test('1.3 When brands are selected without specific models, all models of selected brands are included (not zero)', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      const res = await mssWholesaleExportService.buildWholesaleData(
        {
          includeSerialNumbers: true,
          includePrices: true,
          selectedBrands: ['Dell'],
          selectedModelIds: undefined, // no models explicitly checked
        },
        sampleDevices
      );

      assert.strictEqual(res.rows.length, 3, 'Should include all 3 Dell devices across all Dell models');
    });

    test('1.4 Combined filter logic: AND across Brand, Model, and Price Range categories', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      // Dell devices with price >= 13000
      const res = await mssWholesaleExportService.buildWholesaleData(
        {
          includeSerialNumbers: true,
          includePrices: true,
          selectedBrands: ['Dell'],
          minPrice: 13000,
        },
        sampleDevices
      );

      // Should include only dev-d5420-1 (13500) and dev-d5420-2 (13900), excluding dev-d7490-1 (9800)
      assert.strictEqual(res.rows.length, 2);
      assert.ok(res.rows.every(r => r['السعر (EGP)'] >= 13000));
    });

    test('1.5 Assigns non-enumerable _rowKey for stable selection tracking in both Mode A and Mode B', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      // Mode B
      const resB = await mssWholesaleExportService.buildWholesaleData(
        { includeSerialNumbers: true },
        sampleDevices
      );
      assert.ok(resB.rows[0]._rowKey, 'Mode B row must have _rowKey');
      assert.ok(!Object.keys(resB.rows[0]).includes('_rowKey'), '_rowKey must be non-enumerable');

      // Mode A
      const resA = await mssWholesaleExportService.buildWholesaleData(
        { includeSerialNumbers: false },
        sampleDevices
      );
      assert.ok(resA.rows[0]._rowKey, 'Mode A row must have _rowKey');
      assert.ok(!Object.keys(resA.rows[0]).includes('_rowKey'), '_rowKey must be non-enumerable');
    });

    test('1.6 Prevents silent empty Excel exports: throws error when 0 matching devices exist', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');

      await assert.rejects(
        async () => {
          await mssWholesaleExportService.buildWholesaleWorkbook(
            {
              includeSerialNumbers: true,
              selectedBrands: ['NonExistentBrand'],
            },
            sampleDevices
          );
        },
        {
          message: /لا توجد أجهزة مطابقة لمعايير الفلترة المحددة لتصديرها/i,
        }
      );
    });
  });

  // =========================================================================
  // 2. PROMOTIONAL MULTI-BRAND/MODEL FILTERING & PRUNING
  // =========================================================================
  describe('2. Promotional Generator Multi-Filter & Synchronization', () => {
    test('2.1 filterPromotionalItems supports multi-brand (OR) and multi-model (OR)', async () => {
      const { preparePromotionalItems, filterPromotionalItems } = await import('../src/services/mssPromotionalService.ts');

      const promoItems = preparePromotionalItems(sampleDevices, sampleModels);

      // Multi-brand: Dell or Lenovo
      const filteredBrands = filterPromotionalItems(promoItems, {
        selectedBrands: ['Dell', 'Lenovo'],
      });
      assert.ok(filteredBrands.every(it => ['dell', 'lenovo'].includes(it.brand.trim().toLowerCase())));
      assert.ok(!filteredBrands.some(it => it.brand.trim().toLowerCase() === 'hp'));

      // Multi-model: Dell 5420 or HP 840 G8
      const filteredModels = filterPromotionalItems(promoItems, {
        selectedModelIds: ['mod-dell-5420', 'mod-hp-840g8'],
      });
      assert.strictEqual(filteredModels.length, 2);
    });

    test('2.2 filterPromotionalItems combined: Brand AND Model AND Price Range', async () => {
      const { preparePromotionalItems, filterPromotionalItems } = await import('../src/services/mssPromotionalService.ts');

      const promoItems = preparePromotionalItems(sampleDevices, sampleModels);

      const filtered = filterPromotionalItems(promoItems, {
        selectedBrands: ['Dell'],
        minPrice: 10000,
      });

      // Dell 5420 has price ~13900 (>= 10000), Dell 7490 has price 9800 (< 10000)
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].model_name, 'Latitude 5420');
    });
  });

  // =========================================================================
  // 3. MULTI-PAGE PROMOTIONAL EXPORTS & DATED ARABIC FILENAMES
  // =========================================================================
  describe('3. Multi-Page Promotional Exports & PDF Recommendation', () => {
    test('3.1 PNG filename formats: single page vs sequential numbered pages (_1.png, _2.png)', async () => {
      const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');

      const items = [{ brand: 'Dell', model_name: 'Latitude 5420', id: '1', processor: 'i5', ram: '16GB', storage: '512GB', gpu: 'Intel', screen: '14' }];

      // Single page
      const singleName = generatePromotionalArabicFilename(items, 'png');
      assert.match(singleName, /عرض_Dell_Latitude_5420_\d{4}-\d{2}-\d{2}\.png/);

      // Multi-page: Page 1 and Page 2
      const page1Name = generatePromotionalArabicFilename(items, 'png', 1);
      const page2Name = generatePromotionalArabicFilename(items, 'png', 2);

      assert.match(page1Name, /عرض_Dell_Latitude_5420_\d{4}-\d{2}-\d{2}_1\.png/);
      assert.match(page2Name, /عرض_Dell_Latitude_5420_\d{4}-\d{2}-\d{2}_2\.png/);
    });

    test('3.2 PDF filename format: valid Arabic dated filename with .pdf extension', async () => {
      const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');

      const items = [{ brand: 'Dell', model_name: 'Latitude 5420', id: '1', processor: 'i5', ram: '16GB', storage: '512GB', gpu: 'Intel', screen: '14' }];
      const pdfName = generatePromotionalArabicFilename(items, 'pdf');

      assert.ok(pdfName.endsWith('.pdf'), 'Must end with .pdf');
      assert.match(pdfName, /_\d{4}-\d{2}-\d{2}\.pdf$/, 'Must contain YYYY-MM-DD date stamp');
      assert.ok(pdfName.includes('عروض_لابتوبات_Dell') || pdfName.includes('تقرير_دعائي_للأجهزة'));
    });

    test('3.3 Multi-page container #mss-promotional-pdf-export-container is properly wired for export', () => {
      const promoGenPath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');
      const content = fs.readFileSync(promoGenPath, 'utf-8');

      // Must include multi-page export container
      assert.ok(content.includes('id="mss-promotional-pdf-export-container"'));
      // Must call exportPromotionalAsPdf with the multi-page container ID
      assert.ok(content.includes("exportPromotionalAsPdf('mss-promotional-pdf-export-container'"));
      // Must contain PDF Recommendation Warning message in Arabic
      assert.ok(content.includes('لقد قمت بتحديد عدد كبير من الأجهزة. يُنصح بالتصدير بصيغة PDF لتجربة عرض ومشاركة أفضل.'));
      // Must contain PromotionalPosterPage component
      assert.ok(content.includes('PromotionalPosterPage'));
    });

    test('3.4 MSSDeviceReportsView has multi-brand, multi-model checkboxes and live device counter', () => {
      const deviceReportsPath = path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx');
      const content = fs.readFileSync(deviceReportsPath, 'utf-8');

      // Multi-brand and multi-model checkboxes
      assert.ok(content.includes('availableBrands.map'));
      assert.ok(content.includes('availableModels.map'));
      // Live device counter
      assert.ok(content.includes('جهاز مطابق'));
      assert.ok(content.includes('إجمالي المخزون'));
      // Warning banner on 0 matching devices
      assert.ok(content.includes('لا توجد أجهزة مطابقة لمعايير الفلترة المحددة حالياً'));
      // Row key fix (no index string UUID bug)
      assert.ok(content.includes('r._rowKey'));
      assert.ok(!content.includes('selectedRowKeys.has(String(globalIdx - 1))'));
    });
  });
});
