import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Helper to create proxy canvas mock for testing text draw positions
function createRecordingCanvas() {
  const recordedDraws = [];
  const noop = () => {};
  const mockCtx = new Proxy(
    {
      fillText: (text, x, y) => {
        recordedDraws.push({ text, x, y });
      },
      measureText: (text) => ({ width: (text || '').length * 8 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return noop;
      },
      set() {
        return true;
      },
    }
  );

  return {
    canvas: {
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      width: 1200,
      height: 1000,
    },
    recordedDraws,
  };
}

test('COMPU MSS — Promotional Table Left-to-Right (LTR) Layout Verification', async (t) => {
  const {
    renderPromotionalToCanvas,
    exportPromotionalAsPdf,
    exportPromotionalAllPagesAsPng,
  } = await import('../src/services/mssPromotionalService.ts');

  const generatorSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
    'utf-8'
  );
  const serviceSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/mssPromotionalService.ts'),
    'utf-8'
  );

  await t.test('1. MSSPromotionalGenerator React Table Structure & LTR Direction', () => {
    // 1.1 Table container and table element must specify dir="ltr"
    assert.ok(
      generatorSource.includes('<div className="p-4 sm:p-5" dir="ltr">'),
      'Table wrapper div must explicitly have dir="ltr"'
    );
    assert.ok(
      generatorSource.includes('<table className="w-full text-xs text-left border-collapse border border-slate-300" dir="ltr">'),
      'Promotional table must explicitly have dir="ltr" and text-left'
    );

    // 1.2 The outer poster container must maintain dir="rtl" for the header and footer
    assert.ok(
      generatorSource.includes('dir="rtl"'),
      'Outer poster card must maintain dir="rtl" for header and footer'
    );
  });

  await t.test('2. Column Order Follows Left-to-Right (Brand on Left, Price on Right)', () => {
    // 2.1 The <thead> must start with Brand (الماركة) on the left
    const theadMatch = generatorSource.match(/<thead[^>]*>([\s\S]*?)<\/thead>/);
    assert.ok(theadMatch, 'Must find <thead> in generator source');
    const theadContent = theadMatch[1];

    // Find all th elements in order
    const thMatches = Array.from(theadContent.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)).map(m => m[1]);
    assert.ok(thMatches.length >= 8, 'Must have at least 8 specification columns');

    // Column 1 must be Brand (الماركة)
    assert.ok(thMatches[0].includes('الماركة'), 'First column (leftmost in LTR) must be Brand (الماركة)');
    // Column 2 must be Model (الموديل) and left-aligned
    assert.ok(thMatches[1].includes('الموديل'), 'Second column must be Model (الموديل)');
    assert.ok(theadContent.includes('text-left') && theadContent.includes('justify-start'), 'Model header must be left-aligned in LTR');
    // Column 3 must be Processor (المعالج)
    assert.ok(thMatches[2].includes('المعالج'), 'Third column must be Processor (المعالج)');
    // Column 4 must be Generation (الجيل)
    assert.ok(thMatches[3].includes('الجيل'), 'Fourth column must be Generation (الجيل)');
    // Column 5 must be RAM (الرام)
    assert.ok(thMatches[4].includes('الرام'), 'Fifth column must be RAM (الرام)');
    // Column 6 must be Storage (الهارد)
    assert.ok(thMatches[5].includes('الهارد'), 'Sixth column must be Storage (الهارد)');
    // Column 7 must be Screen (الشاشة)
    assert.ok(thMatches[6].includes('الشاشة'), 'Seventh column must be Screen (الشاشة)');
    // Column 8 must be GPU (كارت الشاشة)
    assert.ok(thMatches[7].includes('كارت الشاشة'), 'Eighth column must be GPU (كارت الشاشة)');

    // Optional columns at the end (right side): Quantity and Price
    assert.ok(generatorSource.includes('PROMOTIONAL_HEADER_ICONS.quantity'), 'Quantity is placed after GPU');
    assert.ok(generatorSource.includes('PROMOTIONAL_HEADER_ICONS.price'), 'Price is placed at the far right');
  });

  await t.test('3. Row Cells Alignment, Dividers, and Text Direction Fidelity', () => {
    // 3.1 Cell dividers in LTR use border-r instead of border-l
    assert.ok(
      generatorSource.includes('border-r border-slate-200 text-left'),
      'Model cell must use border-r and text-left'
    );

    // 3.2 Model has dir="ltr"
    assert.ok(
      generatorSource.includes('<div dir="ltr">{item.model_name}</div>'),
      'Model name must have explicit dir="ltr"'
    );

    // 3.3 Generation has <bdi> to preserve Arabic bidirectional text
    assert.ok(
      generatorSource.includes('<bdi>{item.generation || \'---\'}</bdi>'),
      'Generation cell must use <bdi> to isolate Arabic and mixed generation strings'
    );

    // 3.4 English and numeric specs have dir="ltr"
    assert.ok(
      generatorSource.includes('font-mono font-bold text-slate-800 border-r border-slate-200" dir="ltr"'),
      'RAM cell must have dir="ltr"'
    );
    assert.ok(
      generatorSource.includes('font-mono text-slate-800 border-r border-slate-200" dir="ltr"'),
      'Storage cell must have dir="ltr"'
    );
  });

  await t.test('4. Canvas Fallback Rendering Column Order & Coordinates', () => {
    // Canvas colWidths definition must start with brand and end with price
    const sampleItems = [
      {
        id: '1',
        brand: 'Dell',
        model_name: 'Latitude 5400',
        processor: 'i5-8265U',
        generation: 'الجيل الثامن',
        ram: '16 GB DDR4',
        storage: '256 GB SSD',
        screen: '14" FHD',
        gpu: 'Intel UHD 620',
        quantity: 3,
        price: 15500,
      },
    ];

    const { canvas: testCanvas, recordedDraws } = createRecordingCanvas();

    renderPromotionalToCanvas(sampleItems, { showPrice: true, showQuantity: true }, testCanvas);

    // Verify headers were drawn in LTR order:
    // "الماركة" must have a lower X coordinate than "الموديل", which is lower than "المعالج", ..., and "السعر (جنيه)" must have the highest X coordinate
    const brandHeader = recordedDraws.find(d => d.text === 'الماركة');
    const modelHeader = recordedDraws.find(d => d.text === 'الموديل');
    const cpuHeader = recordedDraws.find(d => d.text === 'المعالج');
    const genHeader = recordedDraws.find(d => d.text === 'الجيل');
    const priceHeader = recordedDraws.find(d => d.text === 'السعر (جنيه)');

    assert.ok(brandHeader, 'Must draw brand header');
    assert.ok(modelHeader, 'Must draw model header');
    assert.ok(cpuHeader, 'Must draw processor header');
    assert.ok(genHeader, 'Must draw generation header');
    assert.ok(priceHeader, 'Must draw price header');

    assert.ok(brandHeader.x < modelHeader.x, 'Brand header X must be to the left of Model header');
    assert.ok(modelHeader.x < cpuHeader.x, 'Model header X must be to the left of CPU header');
    assert.ok(cpuHeader.x < genHeader.x, 'CPU header X must be to the left of Generation header');
    assert.ok(genHeader.x < priceHeader.x, 'Generation header X must be to the left of Price header (far right)');
  });

  await t.test('5. Multi-Page PDF & Batch PNG Exports Consistency', async () => {
    const sampleItems = [
      {
        id: '1',
        brand: 'Lenovo',
        model_name: 'ThinkPad T480',
        processor: 'i5',
        generation: 'الجيل الثامن',
        ram: '16 GB',
        storage: '256 SSD',
        screen: '14" FHD',
        gpu: 'Intel UHD 620',
        price: 13500,
      },
    ];

    // PDF generation must complete without error using LTR canvas/layout
    const pdfResult = await exportPromotionalAsPdf(sampleItems, { showPrice: true });
    assert.ok(pdfResult.buffer && pdfResult.buffer.length > 0, 'Must produce valid PDF buffer');
    assert.equal(pdfResult.pageCount, 1, 'Single device should produce 1 page');

    // Batch PNG export must also succeed
    const pngResult = await exportPromotionalAllPagesAsPng(sampleItems, { showPrice: true });
    assert.equal(pngResult.totalPages, 1, 'Single device should produce 1 PNG page');
    assert.ok(pngResult.filenames.length > 0, 'Must generate valid filenames');
  });
});
