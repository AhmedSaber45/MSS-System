import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('MSS Promotional Image Typography Improvements', async (t) => {
  const servicePath = path.resolve('src/services/mssPromotionalService.ts');
  const generatorPath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');
  const typesPath = path.resolve('src/types/mssPromotional.ts');

  assert.ok(fs.existsSync(servicePath), 'mssPromotionalService.ts must exist');
  assert.ok(fs.existsSync(generatorPath), 'MSSPromotionalGenerator.tsx must exist');
  assert.ok(fs.existsSync(typesPath), 'mssPromotional.ts must exist');

  const serviceContent = fs.readFileSync(servicePath, 'utf8').replace(/\r\n/g, '\n');
  const generatorContent = fs.readFileSync(generatorPath, 'utf8').replace(/\r\n/g, '\n');
  const typesContent = fs.readFileSync(typesPath, 'utf8').replace(/\r\n/g, '\n');

  await t.test('1. Canvas table data rows render with bold (700) and refined font sizes', () => {
    // Model, Processor, RAM, Quantity: 22px
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 22px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas model/processor/ram/quantity text must be bold 22px'
    );

    // Processor fitted text with natural word-boundary wrap and strict inner padding
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.processor || '---', cellCenterX, cellCenterY, col.width - 16, true, true);`),
      'Processor must draw fitted text with horizontal inner padding and no truncation'
    );

    // Generation, Storage, GPU: 21px
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 21px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas generation/storage/gpu text must be bold 21px'
    );

    // RAM fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.ram || '---', cellCenterX, cellCenterY, col.width - 8, true);`),
      'RAM must draw fitted text'
    );

    // Storage fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.storage || '---', cellCenterX, cellCenterY, col.width - 10, true);`),
      'Storage must draw fitted text'
    );

    // Screen: 20px
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 20px "Segoe UI", Cairo, Arial, sans-serif';`) &&
      serviceContent.includes(`drawFittedText(ctx, item.screen || '---', cellCenterX, cellCenterY, col.width - 10, true);`),
      'Canvas screen text must be bold 20px'
    );

    // GPU fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.gpu || '---', cellCenterX, cellCenterY, col.width - 10, true);`),
      'GPU must draw fitted text'
    );

    // Quantity centered text
    assert.ok(
      serviceContent.includes(`ctx.fillText(String(item.quantity || 1), cellCenterX, cellCenterY);`),
      'Quantity must draw centered text'
    );

    // Price: 25px
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 25px "Segoe UI", Arial, sans-serif';`),
      'Canvas price text must be bold 25px'
    );
  });

  await t.test('2. DOM preview table renders all data cells in bold with refined font size and single-line/word-boundary wrapping', () => {
    assert.ok(
      generatorContent.includes(`table className="w-full table-fixed text-[18.5px] text-left border-collapse border border-slate-300 font-bold"`),
      'Table must have base 18.5px, table-fixed, and font-bold'
    );
    assert.ok(
      generatorContent.includes(`tbody className="divide-y divide-slate-200 font-bold text-[18.5px]"`),
      'Tbody must have font-bold and text-[18.5px]'
    );
    assert.ok(generatorContent.includes('whitespace-nowrap'), 'Short/normal spec values must stay on a single line');
    assert.ok(generatorContent.includes('break-normal [overflow-wrap:normal]'), 'Long values must wrap at natural word boundaries');
    assert.ok(generatorContent.includes('text-[18.5px]'), 'Standard cells must be text-[18.5px]');
    assert.ok(generatorContent.includes('text-[18px]'), 'Screen cell must be text-[18px]');
    assert.ok(generatorContent.includes('text-[20.5px] tabular-nums'), 'Price cell must be font-extrabold text-[20.5px]');
  });

  await t.test('3. Text fitting, row density (7 rows max), and boundary protection against overflow', () => {
    assert.ok(serviceContent.includes('function drawFittedText('), 'drawFittedText must exist');
    assert.ok(serviceContent.includes(`truncated = truncated.slice(0, -1);`), 'drawFittedText must shrink text gracefully');
    assert.ok(serviceContent.includes(`ctx.fillText(truncated + '...', x, y);`), 'drawFittedText must append ellipsis on overflow');
    assert.ok(serviceContent.includes('const rowHeight = 76;'), 'Canvas rowHeight must be increased to 76px for +5px fonts');
    assert.ok(typesContent.includes('export const PROMOTIONAL_MAX_DEVICES_PER_PAGE = 7;'), 'Max devices per page adjusted to 7 for readable spacing');
    assert.ok(!generatorContent.includes('truncate max-w-full'), 'DOM model name must NOT truncate with ellipsis');
    assert.ok(generatorContent.includes('measureAndWrapPromotionalText('), 'DOM preview must use shared text wrapping logic');
  });

  await t.test('4. Horizontal and vertical centering are preserved across all columns', () => {
    assert.ok(serviceContent.includes(`const cellCenterX = cellX + col.width / 2;`), 'Canvas calculates cellCenterX');
    assert.ok(serviceContent.includes(`const cellCenterY = rowY + itemRowHeight / 2;`), 'Canvas calculates cellCenterY');
    assert.ok(serviceContent.includes(`ctx.textBaseline = 'middle';`), 'Canvas uses middle baseline');
    assert.ok(serviceContent.includes(`ctx.textAlign = 'center';`), 'Canvas uses center alignment');

    assert.ok(generatorContent.includes('text-center'), 'DOM cells use text-center');
    assert.ok(generatorContent.includes('align-middle'), 'DOM cells use align-middle');
  });

  await t.test('5. Table column headers remain visually balanced', () => {
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 16px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas header font must be bold 16px'
    );
    assert.ok(
      generatorContent.includes('font-bold text-center border-b-2 border-slate-400 text-[13.5px]'),
      'DOM header must preserve distinct font-bold text-[13.5px]'
    );
  });

  await t.test('6. Runtime Canvas rendering: All data cells render bold with +5px font sizes and proper isolation', async () => {
    const { renderPromotionalToCanvas } = await import('../src/services/mssPromotionalService.ts');

    const capturedFonts = new Map();

    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: function (text) {
        if (typeof text === 'string') {
          capturedFonts.set(text, this.font);
        }
      },
      measureText: (txt) => ({ width: (txt || '').length * 8 }),
      _font: '',
      set font(val) { this._font = val; },
      get font() { return this._font; },
      _fillStyle: '',
      set fillStyle(val) { this._fillStyle = val; },
      get fillStyle() { return this._fillStyle; },
      _textAlign: '',
      set textAlign(val) { this._textAlign = val; },
      get textAlign() { return this._textAlign; },
      _textBaseline: '',
      set textBaseline(val) { this._textBaseline = val; },
      get textBaseline() { return this._textBaseline; },
      _direction: '',
      set direction(val) { this._direction = val; },
      get direction() { return this._direction; },
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/png;base64,mock',
    };

    const testItem = {
      brand: 'Dell',
      model_name: 'Latitude 5420',
      processor: 'Core i5-1145G7',
      generation: '11th',
      ram: '16GB',
      storage: '512GB SSD',
      screen: '15.6" FHD IPS',
      gpu: 'Intel Iris Xe',
      quantity: 5,
      price: 18500,
    };

    renderPromotionalToCanvas([testItem], { showPrice: true, showQuantity: true }, mockCanvas);

    assert.strictEqual(capturedFonts.get('15.6" FHD IPS'), 'bold 20px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('Latitude 5420'), 'bold 22px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('16GB'), 'bold 22px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('512GB SSD'), 'bold 21px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('18,500'), 'bold 25px "Segoe UI", Arial, sans-serif');

    // Verify natural word-boundary wrapping for extra-long multi-word value
    capturedFonts.clear();
    renderPromotionalToCanvas([{
      ...testItem,
      storage: '512GB NVMe Gen4',
    }], { showPrice: true, showQuantity: true }, mockCanvas);
    assert.ok(
      !Array.from(capturedFonts.keys()).some(k => k.includes('NVMe Gen4...')),
      'Multi-word long storage value should wrap cleanly at word boundary instead of mid-word split'
    );
  });

  await t.test('7. Model & Generation wrap naturally onto 2 lines without ellipsis and expand row height', async () => {
    const {
      renderPromotionalToCanvas,
      wrapPromotionalCellText,
      measureAndWrapPromotionalText,
    } = await import('../src/services/mssPromotionalService.ts');

    // Short values stay on 1 line
    assert.deepStrictEqual(
      wrapPromotionalCellText('Latitude 5420', 200, s => s.length * 10),
      ['Latitude 5420']
    );

    // Long model names wrap cleanly at word boundaries without truncation
    const wrappedModel = wrapPromotionalCellText(
      'SURFACE LAPTOP STUDIO 2',
      150,
      s => s.length * 10
    );
    assert.ok(wrappedModel.length >= 2, 'Long model name should wrap onto multiple lines');
    assert.strictEqual(wrappedModel.join(' '), 'SURFACE LAPTOP STUDIO 2', 'Complete model name must be preserved');
    assert.ok(!wrappedModel.some(line => line.includes('...')), 'Must never truncate model name with ellipsis');

    // Long generation values wrap cleanly at word boundaries
    const wrappedGen = wrapPromotionalCellText(
      'الجيل الحادي عشر برو',
      110,
      s => s.length * 10
    );
    assert.ok(wrappedGen.length >= 2, 'Long generation value should wrap onto multiple lines');
    assert.strictEqual(wrappedGen.join(' '), 'الجيل الحادي عشر برو', 'Complete generation value must be preserved');

    // Shared DOM/Canvas helper returns array of lines
    const sharedLines = measureAndWrapPromotionalText('LATITUDE 5420 BUSINESS EDITION', 124);
    assert.ok(sharedLines.length >= 2);
    assert.strictEqual(sharedLines.join(' '), 'LATITUDE 5420 BUSINESS EDITION');

    // Runtime canvas test: long model & generation never emit "..." and increase row height when needed
    const drawnTexts = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: function (text, x, y) {
        if (typeof text === 'string') {
          drawnTexts.push({ text, x, y });
        }
      },
      measureText: (txt) => ({ width: (txt || '').length * 10 }),
      font: 'bold 22px "Segoe UI", Cairo, Arial, sans-serif',
      fillStyle: '',
      textAlign: 'center',
      textBaseline: 'middle',
      direction: 'ltr',
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/png;base64,mock',
    };

    const shortCanvas = { ...mockCanvas, width: 0, height: 0 };
    renderPromotionalToCanvas(
      [{ brand: 'Dell', model_name: '5420', processor: 'i5', generation: '11th', ram: '8GB', storage: '256GB', gpu: 'Intel', screen: '14.1', quantity: 1, price: 10000 }],
      { showPrice: true, showQuantity: true, itemsPerPage: 1 },
      shortCanvas
    );

    const longCanvas = { ...mockCanvas, width: 0, height: 0 };
    drawnTexts.length = 0;
    renderPromotionalToCanvas(
      [{ brand: 'Microsoft', model_name: 'SURFACE LAPTOP STUDIO 2', processor: 'i7', generation: 'الجيل الحادي عشر', ram: '16GB', storage: '512GB', gpu: 'INTEL IRIS', screen: '13', quantity: 2, price: 22000 }],
      { showPrice: true, showQuantity: true, itemsPerPage: 1 },
      longCanvas
    );

    assert.ok(longCanvas.height > shortCanvas.height, 'Row height and total canvas height must expand for wrapped rows');
    assert.ok(!drawnTexts.some(d => d.text.includes('...')), 'Model and Generation must never be truncated with ellipsis');
    const modelLinesDrawn = drawnTexts.filter(d => d.text === 'SURFACE LAPTOP' || d.text === 'STUDIO 2');
    assert.ok(modelLinesDrawn.length === 2, 'Long model name must draw across wrapped lines');
  });

  await t.test('8. Processor column keeps short values on 1 line, wraps long values without ellipsis, and never intrudes into Generation', async () => {
    const {
      renderPromotionalToCanvas,
      wrapPromotionalCellText,
    } = await import('../src/services/mssPromotionalService.ts');

    // Short values fit on 1 line within inner width
    for (const shortProc of ['CI 5', 'CI 7', 'core i7', 'RYZEN 7', 'CI7 H']) {
      assert.deepStrictEqual(
        wrapPromotionalCellText(shortProc, 88, s => s.length * 10),
        [shortProc],
        `${shortProc} should stay on a single line`
      );
    }

    // Long Processor value wraps naturally without ellipsis or mid-word split
    const longProc = 'Core Ultra 7 155H';
    const wrappedProc = wrapPromotionalCellText(longProc, 88, s => s.length * 10);
    assert.ok(wrappedProc.length >= 2, 'Long processor value should wrap onto multiple lines');
    assert.strictEqual(wrappedProc.join(' '), longProc, 'Complete processor value must be preserved');
    assert.ok(!wrappedProc.some(l => l.includes('...')), 'Processor must never truncate with ellipsis');

    // Runtime canvas test: long processor expands row height and does not truncate
    const drawnTexts = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arc: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      clip: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      clearRect: () => {},
      fillText: function (text, x, y) {
        if (typeof text === 'string') {
          drawnTexts.push({ text, x, y });
        }
      },
      measureText: (txt) => ({ width: (txt || '').length * 10 }),
      font: 'bold 22px "Segoe UI", Cairo, Arial, sans-serif',
      fillStyle: '',
      textAlign: 'center',
      textBaseline: 'middle',
      direction: 'ltr',
    };
    const shortCanvas = { width: 0, height: 0, getContext: () => mockCtx, toDataURL: () => 'data:image/png;base64,mock' };
    renderPromotionalToCanvas(
      [{ brand: 'Dell', model_name: '5420', processor: 'CI 5', generation: '11th', ram: '8GB', storage: '256GB', gpu: 'Intel', screen: '14.1', quantity: 1, price: 10000 }],
      { showPrice: true, showQuantity: true, itemsPerPage: 1 },
      shortCanvas
    );

    const longCanvas = { width: 0, height: 0, getContext: () => mockCtx, toDataURL: () => 'data:image/png;base64,mock' };
    drawnTexts.length = 0;
    renderPromotionalToCanvas(
      [{ brand: 'Dell', model_name: '5420', processor: 'Core Ultra 7 155H', generation: '14th', ram: '16GB', storage: '512GB', gpu: 'INTEL IRIS', screen: '14.1', quantity: 1, price: 25000 }],
      { showPrice: true, showQuantity: true, itemsPerPage: 1 },
      longCanvas
    );

    assert.ok(longCanvas.height > shortCanvas.height, 'Row height must expand when Processor wraps');
    assert.ok(!drawnTexts.some(d => d.text.includes('...')), 'Long Processor must not truncate with ellipsis');
  });
});
