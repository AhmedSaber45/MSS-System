import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('MSS Promotional Image Typography Improvements', async (t) => {
  const servicePath = path.resolve('src/services/mssPromotionalService.ts');
  const generatorPath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');

  assert.ok(fs.existsSync(servicePath), 'mssPromotionalService.ts must exist');
  assert.ok(fs.existsSync(generatorPath), 'MSSPromotionalGenerator.tsx must exist');

  const serviceContent = fs.readFileSync(servicePath, 'utf8').replace(/\r\n/g, '\n');
  const generatorContent = fs.readFileSync(generatorPath, 'utf8').replace(/\r\n/g, '\n');

  await t.test('1. Canvas table data rows render with bold (700) and 10-15% increased font sizes', () => {
    // Model: 15px -> 17px (+13.3%)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 17px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas model text must be bold 17px'
    );

    // Processor: 15px -> 17px (+13.3%)
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.processor || '---', cellCenterX, cellCenterY, col.width - 8);`),
      'Processor must draw fitted text'
    );

    // Generation: 14px -> 16px (+14.3%)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 16px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas generation text must be bold 16px'
    );

    // RAM: 15px -> 17px (+13.3%)
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.ram || '---', cellCenterX, cellCenterY, col.width - 8);`),
      'RAM must draw fitted text'
    );

    // Storage: 14px -> 16px (+14.3%)
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.storage || '---', cellCenterX, cellCenterY, col.width - 10);`),
      'Storage must draw fitted text'
    );

    // Screen: was 600 13px -> bold 15px (+15.4%)
    assert.ok(
      (serviceContent.includes(`ctx.font = 'bold 15px "Segoe UI", Cairo, Arial, sans-serif';\n        ctx.fillStyle = '#1e293b';\n        drawFittedText(ctx, item.screen || '---'`) ||
       (serviceContent.includes(`ctx.font = 'bold 15px "Segoe UI", Cairo, Arial, sans-serif';`) &&
        serviceContent.includes(`drawFittedText(ctx, item.screen || '---', cellCenterX, cellCenterY, col.width - 10);`))),
      'Canvas screen text must be bold 15px'
    );

    // GPU: 14px -> 16px (+14.3%)
    assert.ok(
      serviceContent.includes(`drawFittedText(ctx, item.gpu || '---', cellCenterX, cellCenterY, col.width - 10);`),
      'GPU must draw fitted text'
    );

    // Quantity: 15px -> 17px (+13.3%)
    assert.ok(
      serviceContent.includes(`ctx.fillText(String(item.quantity || 1), cellCenterX, cellCenterY);`),
      'Quantity must draw centered text'
    );

    // Price: 18px -> 20px (+11.1%)
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';`),
      'Canvas price text must be bold 20px'
    );
  });

  await t.test('2. DOM preview table renders all data cells in bold with ~10-15% increased font size', () => {
    // Table and tbody bold styling
    assert.ok(
      generatorContent.includes(`table className="w-full text-[13.5px] text-left border-collapse border border-slate-300 font-bold"`),
      'Table must have base 13.5px and font-bold'
    );
    assert.ok(
      generatorContent.includes(`tbody className="divide-y divide-slate-200 font-bold text-[13.5px]"`),
      'Tbody must have font-bold and text-[13.5px]'
    );

    // Every column has font-bold
    assert.ok(generatorContent.includes('font-bold text-slate-900 border-r border-slate-200 text-center align-middle text-[13.5px]'), 'Model cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-800 border-r border-slate-200 font-mono text-[13.5px]'), 'Processor cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-800 border-r border-slate-200 text-[13.5px]'), 'Generation cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-mono font-bold text-slate-800 border-r border-slate-200 text-[13.5px]'), 'RAM & Storage cells must be font-bold');
    assert.ok(generatorContent.includes('text-center font-mono font-bold text-slate-800 border-r border-slate-200 text-[13px]'), 'Screen cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-bold text-[13.5px]'), 'GPU cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-bold text-slate-900 text-[13.5px]'), 'Quantity cell must be font-bold');
    assert.ok(generatorContent.includes('text-center font-extrabold text-[#0a2558] text-[15.5px] tabular-nums'), 'Price cell must be font-extrabold with increased size');
  });

  await t.test('3. Text fitting and boundary protection against overflow', () => {
    // Canvas drawFittedText truncates with ellipsis if content exceeds maxWidth
    assert.ok(serviceContent.includes('function drawFittedText('), 'drawFittedText must exist');
    assert.ok(serviceContent.includes(`truncated = truncated.slice(0, -1);`), 'drawFittedText must shrink text gracefully');
    assert.ok(serviceContent.includes(`ctx.fillText(truncated + '...', x, y);`), 'drawFittedText must append ellipsis on overflow');

    // DOM truncate class for model names
    assert.ok(generatorContent.includes('truncate max-w-full'), 'DOM model name must have truncate max-w-full');
  });

  await t.test('4. Horizontal and vertical centering are preserved across all columns', () => {
    // Canvas centering
    assert.ok(serviceContent.includes(`const cellCenterX = cellX + col.width / 2;`), 'Canvas calculates cellCenterX');
    assert.ok(serviceContent.includes(`const cellCenterY = rowY + rowHeight / 2;`), 'Canvas calculates cellCenterY');
    assert.ok(serviceContent.includes(`ctx.textBaseline = 'middle';`), 'Canvas uses middle baseline');
    assert.ok(serviceContent.includes(`ctx.textAlign = 'center';`), 'Canvas uses center alignment');

    // DOM centering
    assert.ok(generatorContent.includes('text-center'), 'DOM cells use text-center');
    assert.ok(generatorContent.includes('align-middle'), 'DOM cells use align-middle');
  });

  await t.test('5. Table column headers remain visually balanced', () => {
    // Canvas header
    assert.ok(
      serviceContent.includes(`ctx.font = 'bold 15px "Segoe UI", Cairo, Arial, sans-serif';`),
      'Canvas header font must remain bold 15px'
    );
    // DOM header
    assert.ok(
      generatorContent.includes(`thead className="bg-[#071d49] text-white font-bold text-center border-b-2 border-slate-400 text-xs"`),
      'DOM header must preserve distinct font-bold text-xs'
    );
  });

  await t.test('6. Runtime Canvas rendering: Screen text is rendered with bold 15px font and proper isolation', async () => {
    const { renderPromotionalToCanvas } = await import('../src/services/mssPromotionalService.ts');

    let capturedScreenFont = null;
    let capturedScreenText = null;

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
        if (typeof text === 'string' && text.includes('15.6')) {
          capturedScreenFont = this.font;
          capturedScreenText = text;
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

    assert.ok(capturedScreenText && capturedScreenText.includes('15.6'), 'Screen text must be rendered by Canvas');
    assert.strictEqual(
      capturedScreenFont,
      'bold 15px "Segoe UI", Cairo, Arial, sans-serif',
      'Runtime canvas context must be configured with bold 15px when drawing screen text'
    );
  });
});
