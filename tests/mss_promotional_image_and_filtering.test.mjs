import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('COMPU MSS — PROMOTIONAL IMAGE GENERATOR & ADVANCED EXCEL FILTERING & INVOICE PREVIEW FIXES', () => {

  // =========================================================================
  // 1. INVOICE PREVIEW CROPPING FIXES
  // =========================================================================
  describe('1. MSSPrintableInvoice Preview Cropping & Wrapping Fixes', () => {
    test('1.1 Table includes minimum widths and prevents column squeezing', () => {
      const invoiceSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(invoiceSrc.includes('min-w-[690px]'), 'Table must have min-w-[690px] to prevent horizontal crushing');
      assert.ok(invoiceSrc.includes('min-w-[155px]'), 'Serial number column must have min-w-[155px]');
      assert.ok(invoiceSrc.includes('min-w-[190px]'), 'Model specifications column must have min-w-[190px]');
    });

    test('1.2 Serial numbers prevent hyphen breaking via word-break: keep-all and break-keep', () => {
      const invoiceSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(
        invoiceSrc.includes('break-keep') && invoiceSrc.includes("wordBreak: 'keep-all'"),
        'Serial badge must enforce break-keep and wordBreak: keep-all to stop wrapping at hyphens'
      );
      assert.ok(invoiceSrc.includes('whitespace-nowrap'), 'Serial badge must enforce whitespace-nowrap');
    });

    test('1.3 Prices and currency never wrap across lines', () => {
      const invoiceSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(
        invoiceSrc.includes('whitespace-nowrap inline-block tabular-nums'),
        'Price values must be wrapped in whitespace-nowrap inline-block to prevent EGP from wrapping below numbers'
      );
    });

    test('1.4 Zoom controls and paper preview scaling', () => {
      const invoiceSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPrintableInvoice.tsx'), 'utf-8');
      assert.ok(invoiceSrc.includes('zoomScale'), 'Must provide zoomScale state');
      assert.ok(invoiceSrc.includes('ملائمة العرض (85%)'), 'Must provide 85% fit width button');
      assert.ok(invoiceSrc.includes('100%'), 'Must provide 100% original size button');
      assert.ok(invoiceSrc.includes('ZoomIn') && invoiceSrc.includes('ZoomOut'), 'Must provide ZoomIn and ZoomOut buttons');
    });
  });

  // =========================================================================
  // 2. PROMOTIONAL SERVICE & ARABIC FILENAMES
  // =========================================================================
  describe('2. MSS Promotional Service & Dynamic Arabic Filename Generation', () => {
    test('2.1 Sanitize Arabic filenames removes illegal Windows characters', async () => {
      const { sanitizeArabicFilename } = await import('../src/services/mssPromotionalService.ts');
      const unsafe = 'عروض_أجهزة/لابتوب:ديل*2026?|test"<>name';
      const safe = sanitizeArabicFilename(unsafe);
      assert.ok(!/[\\/:*?"<>|]/.test(safe), 'Filename must not contain any forbidden Windows characters');
      assert.ok(safe.includes('عروض_أجهزة'), 'Must preserve safe Arabic text');
    });

    test('2.2 Generates brand-specific Arabic filenames when single brand is selected', async () => {
      const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');
      const items = [
        { brand: 'Dell', model_name: 'Latitude 5420' },
        { brand: 'Dell', model_name: 'XPS 13' },
      ];
      const fn = generatePromotionalArabicFilename(items, 'png');
      assert.ok(fn.endsWith('.png'), 'Must have .png extension');
      assert.ok(fn.includes('عروض_لابتوبات_Dell') || fn.includes('Dell'), 'Must include brand name in Arabic filename');
    });

    test('2.3 Generates generic Arabic filename for mixed brand items', async () => {
      const { generatePromotionalArabicFilename } = await import('../src/services/mssPromotionalService.ts');
      const items = [
        { brand: 'Dell', model_name: 'Latitude 5420' },
        { brand: 'Apple', model_name: 'MacBook Air' },
        { brand: 'HP', model_name: 'EliteBook' },
      ];
      const fn = generatePromotionalArabicFilename(items, 'pdf');
      assert.ok(fn.endsWith('.pdf'), 'Must have .pdf extension');
      assert.ok(fn.includes('عروض_لابتوبات_مختارة_Compu_MSS'), 'Must generate descriptive Arabic title');
    });
  });

  // =========================================================================
  // 3. PROMOTIONAL ITEM PREPARATION & FILTERING
  // =========================================================================
  describe('3. Promotional Items Preparation and Advanced Filtering', () => {
    const mockDevices = [
      {
        id: 'dev-1',
        model_id: 'mod-1',
        brand: 'Dell',
        model_name: 'Latitude 5420',
        serial_number: 'SN-DELL-1',
        is_serialized: true,
        list_price: 12000,
        status: 'AVAILABLE',
        model: { processor: 'Core i5 11th', ram: '16GB', storage: '512GB SSD', gpu: 'Intel Iris Xe', screen_size: '14" FHD' },
      },
      {
        id: 'dev-2',
        model_id: 'mod-1',
        brand: 'Dell',
        model_name: 'Latitude 5420',
        serial_number: 'SN-DELL-2',
        is_serialized: true,
        list_price: 12000,
        status: 'AVAILABLE',
        model: { processor: 'Core i5 11th', ram: '16GB', storage: '512GB SSD', gpu: 'Intel Iris Xe', screen_size: '14" FHD' },
      },
      {
        id: 'dev-3',
        model_id: 'mod-2',
        brand: 'Apple',
        model_name: 'MacBook Air M2',
        serial_number: 'SN-APPLE-1',
        is_serialized: true,
        list_price: 35000,
        status: 'AVAILABLE',
        model: { processor: 'Apple M2 8-core', ram: '16GB', storage: '512GB SSD', gpu: '10-core GPU', screen_size: '13.6" Liquid Retina' },
      },
      {
        id: 'dev-4',
        model_id: 'mod-3',
        brand: 'HP',
        model_name: 'Victus 16',
        serial_number: null,
        is_serialized: false,
        quantity: 5,
        list_price: 24000,
        status: 'AVAILABLE',
        model: { processor: 'Core i7 13th', ram: '32GB', storage: '1TB SSD', gpu: 'RTX 4060', screen_size: '16.1" 144Hz' },
      },
    ];

    test('3.1 preparePromotionalItems aggregates inventory by model with total available counts', async () => {
      const { preparePromotionalItems } = await import('../src/services/mssPromotionalService.ts');
      const promoItems = preparePromotionalItems(mockDevices);

      assert.strictEqual(promoItems.length, 3, 'Should produce 3 distinct promo models');
      const dell = promoItems.find(p => p.brand === 'Dell');
      assert.ok(dell, 'Must find Dell model');
      assert.strictEqual(dell.available_quantity, 2, 'Dell available units should sum to 2');

      const hp = promoItems.find(p => p.brand === 'HP');
      assert.ok(hp, 'Must find HP model');
      assert.strictEqual(hp.available_quantity, 5, 'HP bulk quantity should be 5');
    });

    test('3.2 filterPromotionalItems by Brand', async () => {
      const { preparePromotionalItems, filterPromotionalItems } = await import('../src/services/mssPromotionalService.ts');
      const promoItems = preparePromotionalItems(mockDevices);
      const filtered = filterPromotionalItems(promoItems, { brand: 'Apple' });

      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].brand, 'Apple');
    });

    test('3.3 filterPromotionalItems by Price Range', async () => {
      const { preparePromotionalItems, filterPromotionalItems } = await import('../src/services/mssPromotionalService.ts');
      const promoItems = preparePromotionalItems(mockDevices);

      // Price range 10,000 to 25,000 should include Dell (12,000) and HP (24,000), but NOT Apple (35,000)
      const filtered = filterPromotionalItems(promoItems, { minPrice: 10000, maxPrice: 25000 });
      assert.strictEqual(filtered.length, 2, 'Should match Dell and HP');
      assert.ok(!filtered.some(p => p.brand === 'Apple'), 'Apple MacBook (35000) must be excluded');
    });
  });

  // =========================================================================
  // 4. IN-MEMORY PREVIEW EDITS NEVER MUTATE INVENTORY
  // =========================================================================
  describe('4. In-Memory Preview Edits (Zero Database Mutation Guarantee)', () => {
    test('4.1 MSSPromotionalGenerator edits operate purely on local state clone', () => {
      const promoGenSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'), 'utf-8');
      assert.ok(
        promoGenSrc.includes('JSON.parse(JSON.stringify'),
        'Preview items must be deep-cloned to isolate all visual edits from real inventory records'
      );
      assert.ok(
        !promoGenSrc.includes('mssInventoryService.updateDevice'),
        'Promotional generator must NEVER call updateDevice during preview editing'
      );
      assert.ok(
        !promoGenSrc.includes('mssCatalogService.updateModel'),
        'Promotional generator must NEVER call updateModel during preview editing'
      );
    });
  });

  // =========================================================================
  // 5. WHOLESALE EXPORT ADVANCED FILTERING & ARABIC FILENAMES
  // =========================================================================
  describe('5. Wholesale Export Advanced Filtering & Arabic Filename Generation', () => {
    const mockInventoryDevices = [
      {
        id: 'dev-10',
        model_id: 'm-1',
        brand: 'Lenovo',
        model_name: 'ThinkPad T14',
        serial_number: 'SN-LEN-10',
        is_serialized: true,
        list_price: 18000,
        status: 'AVAILABLE',
        stock_location: 'محل 1',
        model: { processor: 'Ryzen 7 Pro', ram: '16GB', storage: '512GB SSD', gpu: 'Radeon 680M', screen_size: '14" WUXGA' },
      },
      {
        id: 'dev-11',
        model_id: 'm-2',
        brand: 'Dell',
        model_name: 'Precision 5550',
        serial_number: 'SN-DELL-11',
        is_serialized: true,
        list_price: 32000,
        status: 'AVAILABLE',
        stock_location: 'محل 1',
        model: { processor: 'Core i7 10th', ram: '32GB', storage: '1TB SSD', gpu: 'Quadro T2000', screen_size: '15.6" 4K UHD' },
      },
      {
        id: 'dev-12',
        model_id: 'm-3',
        brand: 'Dell',
        model_name: 'Inspiron 3520',
        serial_number: null,
        is_serialized: false,
        quantity: 10,
        list_price: 13500,
        status: 'AVAILABLE',
        stock_location: 'محل 2',
        model: { processor: 'Core i3 12th', ram: '8GB', storage: '256GB SSD', gpu: 'Intel UHD', screen_size: '15.6" FHD 120Hz' },
      },
    ];

    test('5.1 buildWholesaleData filters by selectedBrands in Mode A', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
      const { rows } = await mssWholesaleExportService.buildWholesaleData(
        { includePrices: true, includeQuantity: true, selectedBrands: ['Lenovo'] },
        mockInventoryDevices
      );
      assert.strictEqual(rows.length, 1);
      assert.ok(rows[0]['الماركة والموديل (Brand & Model)'].includes('Lenovo ThinkPad T14'));
    });

    test('5.2 buildWholesaleData filters by price range (minPrice, maxPrice)', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
      const { rows } = await mssWholesaleExportService.buildWholesaleData(
        { includePrices: true, includeQuantity: true, minPrice: 15000, maxPrice: 20000 },
        mockInventoryDevices
      );
      assert.strictEqual(rows.length, 1);
      assert.ok(rows[0]['الماركة والموديل (Brand & Model)'].includes('ThinkPad T14'));
    });

    test('5.3 buildWholesaleWorkbook generates Arabic filename for Mode A & Mode B', async () => {
      const { mssWholesaleExportService } = await import('../src/services/mssWholesaleExportService.ts');
      const wbA = await mssWholesaleExportService.buildWholesaleWorkbook(
        { includePrices: true, includeQuantity: true, branchFilter: 'محل 1' },
        mockInventoryDevices
      );
      assert.ok(wbA.filename.endsWith('.xlsx'), 'Filename must end in .xlsx');
      assert.ok(wbA.filename.includes('تقرير_مخزون_الأجهزة_المتاحة_للجملة'), 'Mode A must have Arabic filename');
      assert.ok(wbA.filename.includes('محل_1'), 'Must include branch in Arabic filename');

      const wbB = await mssWholesaleExportService.buildWholesaleWorkbook(
        { includePrices: true, includeSerialNumbers: true },
        mockInventoryDevices
      );
      assert.ok(wbB.filename.includes('تقرير_الأجهزة_المسلسلة_المتاحة_للجملة'), 'Mode B must have Arabic filename');
    });
  });

  // =========================================================================
  // 6. DEVICE REPORTS VIEW INTEGRATION
  // =========================================================================
  describe('6. MSSDeviceReportsView Integration', () => {
    test('6.1 Contains promotional-image sub-tab and renders MSSPromotionalGenerator', () => {
      const viewSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx'), 'utf-8');
      assert.ok(viewSrc.includes("activeTab === 'promotional-image'"), 'Must handle promotional-image active tab');
      assert.ok(viewSrc.includes('<MSSPromotionalGenerator'), 'Must render MSSPromotionalGenerator');
      assert.ok(viewSrc.includes('تصميم عروض السوشيال ميديا'), 'Must label promotional tab clearly in Arabic');
    });

    test('6.2 Wholesale tab contains advanced filtering UI and table checkboxes', () => {
      const viewSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSDeviceReportsView.tsx'), 'utf-8');
      assert.ok(viewSrc.includes('تصفية حسب الماركة'), 'Must have brand filter');
      assert.ok(viewSrc.includes('نطاق السعر'), 'Must have price range filter');
      assert.ok(viewSrc.includes('selectedRowKeys'), 'Must support checkbox selection of individual rows');
    });
  });
});
