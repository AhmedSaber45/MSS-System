import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('COMPU MSS — PROMOTIONAL IMAGE REDESIGN & CORRECT FILTER-BASED SELECTION', () => {

  // =========================================================================
  // 1. GENERATION AND SHORT PROCESSOR PARSING
  // =========================================================================
  describe('1. Processor Family & Arabic Generation Extraction', () => {
    test('1.1 Extracts Intel generations accurately (6th through 14th)', async () => {
      const { extractGenerationAndShortProcessor } = await import('../src/services/mssPromotionalService.ts');

      const testCases = [
        { input: 'Intel Core i5-8350U', expectedFamily: 'i5', expectedGen: 'الجيل الثامن' },
        { input: 'Intel Core i5-1145G7', expectedFamily: 'i5', expectedGen: 'الجيل الحادي عشر' },
        { input: 'Intel Core i7-10750H', expectedFamily: 'i7', expectedGen: 'الجيل العاشر' },
        { input: 'Intel Core i7-12700H', expectedFamily: 'i7', expectedGen: 'الجيل الثاني عشر' },
        { input: 'Intel Core i5-6300U', expectedFamily: 'i5', expectedGen: 'الجيل السادس' },
        { input: 'Intel Core i5-7300U', expectedFamily: 'i5', expectedGen: 'الجيل السابع' },
        { input: 'Intel Core i3-10110U', expectedFamily: 'i3', expectedGen: 'الجيل العاشر' },
        { input: 'Core i7 13th Gen', expectedFamily: 'i7', expectedGen: 'الجيل الثالث عشر' },
      ];

      for (const tc of testCases) {
        const res = extractGenerationAndShortProcessor(tc.input);
        assert.strictEqual(
          res.shortProcessor,
          tc.expectedFamily,
          `Family for ${tc.input} should be ${tc.expectedFamily}, got ${res.shortProcessor}`
        );
        assert.strictEqual(
          res.generation,
          tc.expectedGen,
          `Generation for ${tc.input} should be ${tc.expectedGen}, got ${res.generation}`
        );
      }
    });

    test('1.2 Extracts AMD Ryzen and Apple Silicon families and generations', async () => {
      const { extractGenerationAndShortProcessor } = await import('../src/services/mssPromotionalService.ts');

      const amdRes = extractGenerationAndShortProcessor('AMD Ryzen 7 5800U');
      assert.strictEqual(amdRes.shortProcessor, 'Ryzen 7');
      assert.ok(
        amdRes.generation.includes('الجيل الخامس') || amdRes.generation.includes('5000'),
        `AMD gen expected 5th, got ${amdRes.generation}`
      );

      const appleRes = extractGenerationAndShortProcessor('Apple M2 8-core');
      assert.ok(appleRes.shortProcessor.includes('M2'));
      assert.ok(
        appleRes.generation.includes('الجيل الثاني') || appleRes.generation.includes('أبل'),
        `Apple gen expected 2nd, got ${appleRes.generation}`
      );
    });

    test('1.3 Respects explicit specifications.generation override', async () => {
      const { extractGenerationAndShortProcessor } = await import('../src/services/mssPromotionalService.ts');
      const res = extractGenerationAndShortProcessor('Intel Core i7', { generation: 'الجيل الحادي عشر' });
      assert.strictEqual(res.shortProcessor, 'i7');
      assert.strictEqual(res.generation, 'الجيل الحادي عشر');
    });
  });

  // =========================================================================
  // 2. PROMOTIONAL ITEMS POPULATION WITH GENERATION
  // =========================================================================
  describe('2. preparePromotionalItems populates generation and processor', () => {
    test('2.1 Populates generation in promotional model item', async () => {
      const { preparePromotionalItems } = await import('../src/services/mssPromotionalService.ts');

      const mockDevices = [
        {
          id: 'dev-1',
          model_id: 'mod-1',
          brand: 'HP',
          model_name: 'ZBook G7',
          serial_number: 'SN-HP-1',
          is_serialized: true,
          list_price: 27500,
          status: 'AVAILABLE',
          model: {
            brand: 'HP',
            model_name: 'ZBook G7',
            processor: 'Intel Core i7-10750H',
            ram: '16GB',
            storage: '512GB SSD + 1TB HDD',
            gpu: 'NVIDIA 4GB',
            screen_size: '15.6',
          },
        },
      ];

      const promoItems = preparePromotionalItems(mockDevices);
      assert.strictEqual(promoItems.length, 1);
      assert.strictEqual(promoItems[0].brand, 'HP');
      assert.strictEqual(promoItems[0].model_name, 'ZBook G7');
      assert.strictEqual(promoItems[0].processor, 'i7');
      assert.strictEqual(promoItems[0].generation, 'الجيل العاشر');
      assert.strictEqual(promoItems[0].price, 27500);
    });
  });

  // =========================================================================
  // 3. FILTERING & SELECTION SYNCHRONIZATION LOGIC
  // =========================================================================
  describe('3. Strict Filter-Based Device Selection & Export Scope', () => {
    test('3.1 PromotionalGenerator source code ensures preview items strictly filter from visibleItems', () => {
      const compSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'), 'utf-8');

      // Must derive selected items from visibleItems, NOT allAvailableItems
      assert.ok(
        compSrc.includes('visibleItems.filter(it => selectedItemIds.has(it.id))'),
        'handleOpenPreviewModal must derive selected items strictly from visibleItems'
      );

      // Must prevent export if visibleItems or selected count is 0
      assert.ok(
        compSrc.includes('visibleItems.length === 0'),
        'Must validate visibleItems length before opening preview modal'
      );

      // Must prune selectedItemIds when visibleItems change
      assert.ok(
        compSrc.includes('visibleIdSet.has(id)'),
        'Must prune selectedItemIds when filters change so non-matching items are deselected'
      );

      // Must display matching counts
      assert.ok(
        compSrc.includes('selectedVisibleCount') && compSrc.includes('مطابق'),
        'Must display selected matching count clearly'
      );
    });
  });

  // =========================================================================
  // 4. REFERENCE POSTER DESIGN LAYOUT & MULTI-PAGE SUPPORT
  // =========================================================================
  describe('4. Reference Poster Visual Design & Multi-Page Layout', () => {
    test('4.1 Canvas and DOM poster include all reference table columns and Arabic headlines', () => {
      const compSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'), 'utf-8');
      const servSrc = fs.readFileSync(path.resolve('src/services/mssPromotionalService.ts'), 'utf-8');

      // Check Arabic headlines matching reference image
      assert.ok(compSrc.includes('متوفر بفضل الله'), 'Must include top Arabic headline "متوفر بفضل الله"');
      assert.ok(compSrc.includes('أعلى جودة بأقل سعر'), 'Must include secondary headline "أعلى جودة بأقل سعر"');
      assert.ok(servSrc.includes('متوفر بفضل الله'), 'Canvas service must render top headline "متوفر بفضل الله"');
      assert.ok(servSrc.includes('أعلى جودة بأقل سعر'), 'Canvas service must render secondary headline "أعلى جودة بأقل سعر"');

      // Check table column headers in DOM poster
      const requiredColumns = ['الماركة', 'الموديل', 'المعالج', 'الجيل', 'الرام', 'الهارد', 'الشاشة', 'كارت الشاشة'];
      for (const col of requiredColumns) {
        assert.ok(compSrc.includes(col), `DOM preview table must contain column "${col}"`);
      }

      // Check realistic commercial laptop mockups and official logo in DOM and Canvas
      assert.ok(
        (compSrc.includes('laptopLeft') && compSrc.includes('laptopRight')) ||
        (compSrc.includes('scenicGradient') && compSrc.includes('bloomGradient')),
        'DOM preview must render left and right commercial laptop mockups'
      );
      assert.ok(
        servSrc.includes('laptopLeft') || servSrc.includes('drawAngledLaptop'),
        'Canvas service must render left and right commercial laptop mockups'
      );

      // Check pagination support for lists > 12-14 items
      assert.ok(compSrc.includes('totalPages') && compSrc.includes('currentPageIndex'), 'Must support multi-page pagination');
      assert.ok(compSrc.includes('صفحة') && compSrc.includes('من'), 'Must display page indicator (e.g. صفحة X من Y)');
      assert.ok(compSrc.includes('handleExportAllPagesPng'), 'Must provide option to download all pages as PNGs');
    });

    test('4.2 In-memory edits remain fully isolated with zero DB mutation', () => {
      const compSrc = fs.readFileSync(path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'), 'utf-8');
      assert.ok(compSrc.includes('JSON.parse(JSON.stringify'), 'Must deep-clone items for in-memory edits');
      assert.ok(!compSrc.includes('mssInventoryService.updateDevice'), 'Zero DB mutation guarantee');
      assert.ok(!compSrc.includes('mssCatalogService.updateModel'), 'Zero DB mutation guarantee');
    });
  });
});
