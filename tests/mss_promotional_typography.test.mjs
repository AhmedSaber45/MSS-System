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

    // Processor fitted text with natural word-boundary wrap
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.processor || '---', cellCenterX, cellCenterY, col.width - 8, true);`),
      'Processor must draw fitted text'
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
      generatorContent.includes(`table className="w-full text-[18.5px] text-left border-collapse border border-slate-300 font-bold"`),
      'Table must have base 18.5px and font-bold'
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
    assert.ok(generatorContent.includes('truncate max-w-full'), 'DOM model name must have truncate max-w-full');
  });

  await t.test('4. Horizontal and vertical centering are preserved across all columns', () => {
    assert.ok(serviceContent.includes(`const cellCenterX = cellX + col.width / 2;`), 'Canvas calculates cellCenterX');
    assert.ok(serviceContent.includes(`const cellCenterY = rowY + rowHeight / 2;`), 'Canvas calculates cellCenterY');
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
});
