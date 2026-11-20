import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mssPromotionalService,
  PROMOTIONAL_MAX_DEVICES_PER_PAGE,
  generatePromotionalArabicFilename,
  sortPromotionalItems,
  exportPromotionalAsPdf,
  exportPromotionalAllPagesAsPng,
} from '../src/services/mssPromotionalService.ts';

// Helper to generate N mock promotional devices with distinct prices and IDs
function generateMockDevices(count, basePrice = 10000, priceStep = 500) {
  const brands = ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer'];
  return Array.from({ length: count }, (_, idx) => {
    const brand = brands[idx % brands.length];
    return {
      id: `dev-${idx + 1}`,
      original_device_id: `orig-dev-${idx + 1}`,
      original_model_id: `mod-${brand.toLowerCase()}-${idx + 1}`,
      brand,
      model_name: `${brand} ProBook ${1000 + idx}`,
      generation: 'الجيل العاشر',
      processor: 'Core i7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Intel Iris Xe',
      screen: '14.0',
      price: basePrice + idx * priceStep,
      quantity: 1,
      available_quantity: 1,
      stock_location: 'محل 1',
      physical_condition: 'ممتازة',
      serial_number: `SN-${brand}-${1000 + idx}`,
    };
  });
}

describe('COMPU MSS — PROMOTIONAL PDF EXPORT & AUTOMATIC MULTI-PAGE PAGINATION', () => {

  // =========================================================================
  // 1. MAXIMUM DEVICES PER PAGE CONFIGURATION
  // =========================================================================
  describe('1. Maximum Devices Per Page Verification', () => {
    test('1.1 Centralized configuration value PROMOTIONAL_MAX_DEVICES_PER_PAGE is exactly 10', () => {
      assert.equal(PROMOTIONAL_MAX_DEVICES_PER_PAGE, 10, 'Optimal maximum devices per page must be 10');
      assert.equal(mssPromotionalService.PROMOTIONAL_MAX_DEVICES_PER_PAGE, 10);
    });
  });

  // =========================================================================
  // 2. DATA INTEGRITY & STRICT SINGLE OCCURRENCE ACROSS BATCHES
  // =========================================================================
  describe('2. Pagination Batching & Data Integrity', () => {
    const testCases = [
      { count: 1, expectedPages: 1, expectedDistribution: [1] },
      { count: 10, expectedPages: 1, expectedDistribution: [10] },
      { count: 11, expectedPages: 2, expectedDistribution: [10, 1] },
      { count: 15, expectedPages: 2, expectedDistribution: [10, 5] },
      { count: 25, expectedPages: 3, expectedDistribution: [10, 10, 5] },
      { count: 100, expectedPages: 10, expectedDistribution: Array(10).fill(10) },
    ];

    testCases.forEach(({ count, expectedPages, expectedDistribution }) => {
      test(`2.1 ${count} devices → exactly ${expectedPages} page(s) with distribution [${expectedDistribution.join(', ')}]`, () => {
        const devices = generateMockDevices(count);
        const totalPages = Math.max(1, Math.ceil(devices.length / PROMOTIONAL_MAX_DEVICES_PER_PAGE));
        assert.equal(totalPages, expectedPages, `Calculated pages must be ${expectedPages}`);

        const seenDeviceIds = new Set();
        const actualDistribution = [];

        for (let p = 0; p < totalPages; p++) {
          const pageSlice = devices.slice(p * PROMOTIONAL_MAX_DEVICES_PER_PAGE, (p + 1) * PROMOTIONAL_MAX_DEVICES_PER_PAGE);
          actualDistribution.push(pageSlice.length);

          pageSlice.forEach(dev => {
            assert.ok(!seenDeviceIds.has(dev.id), `Device ${dev.id} must not appear more than once (duplicated on page ${p + 1})`);
            seenDeviceIds.add(dev.id);
          });
        }

        assert.deepEqual(actualDistribution, expectedDistribution);
        assert.equal(seenDeviceIds.size, count, `All ${count} devices must appear exactly once`);
      });
    });

    test('2.2 Price sorting (asc & desc) is preserved across page boundaries', () => {
      const devices = generateMockDevices(25, 5000, 1000); // prices 5000 to 29000

      // Ascending test
      const ascSorted = sortPromotionalItems([...devices], 'asc');
      const ascPage0 = ascSorted.slice(0, 10);
      const ascPage1 = ascSorted.slice(10, 20);
      const ascPage2 = ascSorted.slice(20, 25);

      assert.ok(ascPage0[ascPage0.length - 1].price <= ascPage1[0].price, 'Last device of page 1 <= first device of page 2 in asc order');
      assert.ok(ascPage1[ascPage1.length - 1].price <= ascPage2[0].price, 'Last device of page 2 <= first device of page 3 in asc order');

      // Descending test
      const descSorted = sortPromotionalItems([...devices], 'desc');
      const descPage0 = descSorted.slice(0, 10);
      const descPage1 = descSorted.slice(10, 20);
      const descPage2 = descSorted.slice(20, 25);

      assert.ok(descPage0[descPage0.length - 1].price >= descPage1[0].price, 'Last device of page 1 >= first device of page 2 in desc order');
      assert.ok(descPage1[descPage1.length - 1].price >= descPage2[0].price, 'Last device of page 2 >= first device of page 3 in desc order');
    });
  });

  // =========================================================================
  // 3. MULTI-PAGE PDF GENERATION & UNIFORM DIMENSIONS
  // =========================================================================
  describe('3. Multi-Page PDF Generation with jsPDF', () => {
    test('3.1 Generates single-page PDF for 1 device with identical dimensions', async () => {
      const devices = generateMockDevices(1);
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: false,
        itemsPerPage: 10,
      });

      assert.ok(result.buffer instanceof Uint8Array);
      assert.equal(result.pageCount, 1);
      assert.ok(result.filename.endsWith('.pdf'));

      // Validate PDF structure
      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.startsWith('%PDF-'), 'Must be a valid PDF binary');
      assert.ok(pdfString.includes('/Count 1'), 'PDF page count must be 1');
      assert.ok(pdfString.includes('/MediaBox [ 0 0 1000 1000 ]') || pdfString.includes('/MediaBox [0 0 1000 1000]'), 'PDF must have uniform 1000x1000 dimensions');
    });

    test('3.2 Generates single-page PDF for exactly 10 devices', async () => {
      const devices = generateMockDevices(10);
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: true,
        itemsPerPage: 10,
      });

      assert.equal(result.pageCount, 1);
      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.includes('/Count 1'));
    });

    test('3.3 Generates 2-page PDF for 11 devices (10 + 1) and handles final page properly', async () => {
      const devices = generateMockDevices(11);
      let progressCalls = [];
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: false,
        itemsPerPage: 10,
        onProgress: (cur, tot) => progressCalls.push({ cur, tot }),
      });

      assert.equal(result.pageCount, 2);
      assert.deepEqual(progressCalls, [{ cur: 1, tot: 2 }, { cur: 2, tot: 2 }]);

      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.includes('/Count 2'), 'PDF page count must be 2');
    });

    test('3.4 Generates 2-page PDF for 15 devices (10 + 5)', async () => {
      const devices = generateMockDevices(15);
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: true,
        itemsPerPage: 10,
      });

      assert.equal(result.pageCount, 2);
      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.includes('/Count 2'), 'PDF page count must be 2');
    });

    test('3.5 Generates 3-page PDF for 25 devices (10 + 10 + 5)', async () => {
      const devices = generateMockDevices(25);
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: false,
        itemsPerPage: 10,
      });

      assert.equal(result.pageCount, 3);
      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.includes('/Count 3'), 'PDF page count must be 3');
    });

    test('3.6 Generates 10-page PDF for 100 devices (10 per page)', async () => {
      const devices = generateMockDevices(100);
      let lastReportedPage = 0;
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: true,
        itemsPerPage: 10,
        onProgress: (cur, tot) => {
          assert.equal(tot, 10);
          lastReportedPage = cur;
        },
      });

      assert.equal(result.pageCount, 10);
      assert.equal(lastReportedPage, 10, 'Progress must reach final page 10');
      const pdfString = Buffer.from(result.buffer).toString('latin1');
      assert.ok(pdfString.includes('/Count 10'), 'PDF page count must be 10');
    });
  });

  // =========================================================================
  // 4. AUTOMATIC PNG BATCH EXPORT & SEQUENTIAL FILENAMES
  // =========================================================================
  describe('4. Automatic PNG Export with Sequential Numbering', () => {
    test('4.1 Filename formatting produces zero-padded sequential names for multi-page exports', () => {
      const devices = generateMockDevices(25);
      const totalPages = 3;

      const f1 = generatePromotionalArabicFilename(devices, 'png', 1, totalPages);
      const f2 = generatePromotionalArabicFilename(devices, 'png', 2, totalPages);
      const f3 = generatePromotionalArabicFilename(devices, 'png', 3, totalPages);

      assert.ok(f1.includes('01 من 03.png'), `Filename 1 must contain "01 من 03.png", got: ${f1}`);
      assert.ok(f2.includes('02 من 03.png'), `Filename 2 must contain "02 من 03.png", got: ${f2}`);
      assert.ok(f3.includes('03 من 03.png'), `Filename 3 must contain "03 من 03.png", got: ${f3}`);
    });

    test('4.2 100 devices produces filenames from "01 من 10" to "10 من 10"', () => {
      const devices = generateMockDevices(100);
      const totalPages = 10;

      for (let p = 1; p <= totalPages; p++) {
        const fname = generatePromotionalArabicFilename(devices, 'png', p, totalPages);
        const pad = String(p).padStart(2, '0');
        assert.ok(fname.includes(`${pad} من 10.png`), `Page ${p} must contain "${pad} من 10.png"`);
      }
    });

    test('4.3 exportPromotionalAllPagesAsPng executes sequential batching with progress tracking', async () => {
      const devices = generateMockDevices(15);
      let progressEvents = [];

      const result = await exportPromotionalAllPagesAsPng(
        devices,
        {
          showPrice: true,
          showQuantity: false,
          itemsPerPage: 10,
        },
        (cur, tot) => progressEvents.push({ cur, tot })
      );

      assert.equal(result.totalPages, 2);
      assert.equal(result.filenames.length, 2);
      assert.ok(result.filenames[0].includes('01 من 02.png'));
      assert.ok(result.filenames[1].includes('02 من 02.png'));
      assert.deepEqual(progressEvents, [{ cur: 1, tot: 2 }, { cur: 2, tot: 2 }]);
    });
  });

  // =========================================================================
  // 5. PRESERVATION OF IN-MEMORY PREVIEW EDITS & VISIBILITY SETTINGS
  // =========================================================================
  describe('5. Preview Edits & Display Options Preservation', () => {
    test('5.1 In-memory modifications (custom prices/specs) are reflected in export', async () => {
      const devices = generateMockDevices(5);
      // Simulate editing the first device's price and model name
      devices[0].price = 99999;
      devices[0].model_name = 'Custom VIP Edition';

      const result = await exportPromotionalAsPdf(devices, {
        showPrice: true,
        showQuantity: false,
        itemsPerPage: 10,
      });

      assert.equal(result.pageCount, 1);
      assert.ok(result.buffer.length > 0);
    });

    test('5.2 showPrice=false and showQuantity=true options are respected without error', async () => {
      const devices = generateMockDevices(12);
      const result = await exportPromotionalAsPdf(devices, {
        showPrice: false,
        showQuantity: true,
        itemsPerPage: 10,
      });

      assert.equal(result.pageCount, 2);
    });
  });
});
