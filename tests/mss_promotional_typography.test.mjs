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

  await t.test('1. Canvas table data rows render with bold (700) and +5px increased font sizes', () => {
    // Model, Processor, RAM, Quantity: 19px -> 24px (+5px)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 24px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas model/processor/ram/quantity text must be bold 24px'
    );

    // Processor fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.processor || '---', cellCenterX, cellCenterY, col.width - 8);`),
      'Processor must draw fitted text'
    );

    // Generation, Storage, GPU: 18px -> 23px (+5px)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 23px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas generation/storage/gpu text must be bold 23px'
    );

    // RAM fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.ram || '---', cellCenterX, cellCenterY, col.width - 8);`),
      'RAM must draw fitted text'
    );

    // Storage fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.storage || '---', cellCenterX, cellCenterY, col.width - 10);`),
      'Storage must draw fitted text'
    );

    // Screen: 17px -> 22px (+5px)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 22px "Segoe UI", Cairo, Arial, sans-serif';`) &&
      serviceContent.includes(`drawFittedText(ctx, item.screen || '---', cellCenterX, cellCenterY, col.width - 10);`),
      'Canvas screen text must be bold 22px'
    );

    // GPU fitted text
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.gpu || '---', cellCenterX, cellCenterY, col.width - 10);`),
      'GPU must draw fitted text'
    );

    // Quantity centered text
    assert.ok(
      serviceContent.includes(`ctx.fillText(String(item.quantity || 1), cellCenterX, cellCenterY);`),
      'Quantity must draw centered text'
    );

    // Price: 22px -> 27px (+5px)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 27px "Segoe UI", Arial, sans-serif';`),
      'Canvas price text must be bold 27px'
    );
  });

  await t.test('2. DOM preview table renders all data cells in bold with +5px increased font size', () => {
    assert.ok(
      generatorContent.includes(`table className="w-full text-[20px] text-left border-collapse border border-slate-300 font-bold"`),
      'Table must have base 20px and font-bold'
    );
    assert.ok(
      generatorContent.includes(`tbody className="divide-y divide-slate-200 font-bold text-[20px]"`),
      'Tbody must have font-bold and text-[20px]'
    );

    assert.ok(generatorContent.includes('font-bold text-slate-900 border-r border-slate-200 text-center align-middle text-[20px]'), 'Model cell must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-800 border-r border-slate-200 font-mono text-[20px]'), 'Processor cell must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-800 border-r border-slate-200 text-[20px]'), 'Generation cell must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-mono font-bold text-slate-800 border-r border-slate-200 text-[20px]'), 'RAM & Storage cells must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-mono font-bold text-slate-800 border-r border-slate-200 text-[19.5px]'), 'Screen cell must be font-bold text-[19.5px]');
    assert.ok(generatorContent.includes('text-center font-bold text-[20px]'), 'GPU cell must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-900 text-[20px]'), 'Quantity cell must be font-bold text-[20px]');
    assert.ok(generatorContent.includes('text-center font-extrabold text-[#0a2558] text-[22px] tabular-nums'), 'Price cell must be font-extrabold text-[22px]');
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
      serviceContent.includes(`ctx.font = 'bold 17px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas header font must be bold 17px'
    );
    assert.ok(
      generatorContent.includes('font-bold text-center border-b-2 border-slate-400 text-[14px]'),
      'DOM header must preserve distinct font-bold text-[14px]'
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

    assert.strictEqual(capturedFonts.get('15.6" FHD IPS'), 'bold 22px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('Latitude 5420'), 'bold 24px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('16GB'), 'bold 24px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('512GB SSD'), 'bold 23px "Segoe UI", Cairo, Arial, sans-serif');
    assert.strictEqual(capturedFonts.get('18,500'), 'bold 27px "Segoe UI", Arial, sans-serif');
  });
});
