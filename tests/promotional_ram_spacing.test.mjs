import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderPromotionalToCanvas,
  getFittedSingleLineFontSize,
  formatScreenValue,
} from '../src/services/mssPromotionalService.ts';

test('Promotional Image Table - RAM Column Spacing & Single-Line Suite', async (t) => {
  await t.test('1. colWidths preserves total table width (1140px) while expanding RAM width', () => {
    const serviceContent = fs.readFileSync(path.resolve('src/services/mssPromotionalService.ts'), 'utf8');

    // Case 1: showPrice && showQty
    assert.ok(serviceContent.includes("{ id: 'ram', label: 'الرام', icon: 'ram', width: 86 }"), 'RAM width should be 86px in showPrice && showQty');
    
    // Case 2: showPrice && !showQty
    assert.ok(serviceContent.includes("{ id: 'ram', label: 'الرام', icon: 'ram', width: 90 }"), 'RAM width should be 90px in showPrice && !showQty');
    
    // Case 3: !showPrice && showQty
    assert.ok(serviceContent.includes("{ id: 'ram', label: 'الرام', icon: 'ram', width: 96 }"), 'RAM width should be 96px in !showPrice && showQty');
    
    // Case 4: !showPrice && !showQty
    assert.ok(serviceContent.includes("{ id: 'ram', label: 'الرام', icon: 'ram', width: 100 }"), 'RAM width should be 100px in !showPrice && !showQty');
  });

  await t.test('2. DOM layout enforces RAM width (w-[72px]) and horizontal padding', () => {
    const generatorContent = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
      'utf8'
    );

    // RAM Header must be w-[72px]
    assert.ok(
      generatorContent.includes('w-[72px] text-center'),
      'DOM header for RAM must have w-[72px]'
    );

    // RAM Cell must have horizontal padding and single-line containment
    assert.ok(
      generatorContent.includes('py-3.5 px-2 text-center align-middle font-mono font-bold text-slate-800 border-r border-slate-200 box-border overflow-hidden'),
      'DOM RAM cell must have px-2 horizontal padding and box-border overflow-hidden'
    );

    assert.ok(
      generatorContent.includes('getFittedSingleLineFontSize('),
      'DOM RAM cell must use getFittedSingleLineFontSize for dynamic scaling'
    );
  });

  await t.test('3. Canvas rendering uses drawSingleLineFittedText for RAM with safe padding buffer', () => {
    const serviceContent = fs.readFileSync(path.resolve('src/services/mssPromotionalService.ts'), 'utf8');

    // Look for RAM branch using drawSingleLineFittedText
    assert.ok(
      serviceContent.includes("col.id === 'ram'"),
      'Canvas must have dedicated col.id === ram branch'
    );
    assert.ok(
      serviceContent.includes('col.width - 16'),
      'RAM canvas drawing must provide at least col.width - 16 inner padding buffer'
    );
  });

  await t.test('4. Runtime Canvas execution: 8 GB, 16 GB, 32 GB render centered on exactly ONE line without wrapping or ellipsis', () => {
    const drawnTexts = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      quadraticCurveTo: () => {},
      arcTo: () => {},
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
          drawnTexts.push({ text, x, y, font: this.font, textAlign: this.textAlign });
        }
      },
      measureText: (txt) => ({ width: (txt || '').length * 8.5 }),
      font: 'bold 20px "Segoe UI", Cairo, Arial, sans-serif',
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

    const ramTestCases = ['8 GB', '16 GB', '32 GB', '64 GB', '4 GB', '16GB DDR4'];

    const testItems = ramTestCases.map((ramVal, idx) => ({
      id: `ram_test_${idx}`,
      brand: 'Dell',
      model_name: 'Latitude 5420',
      processor: 'Core i5-1145G7',
      generation: '11th',
      ram: ramVal,
      storage: 'SSD 256 GB',
      screen: '14',
      gpu: 'Intel Iris Xe',
      quantity: 1,
      price: 15000,
    }));

    renderPromotionalToCanvas(testItems, { showPrice: true, showQuantity: true, itemsPerPage: 10 }, mockCanvas);

    for (const ramVal of ramTestCases) {
      const ramDrawn = drawnTexts.find(d => d.text === ramVal);
      assert.ok(ramDrawn, `RAM value "${ramVal}" must be drawn on a single line`);
      assert.ok(!ramDrawn.text.includes('...'), `RAM value "${ramVal}" must not contain ellipsis`);
      assert.strictEqual(ramDrawn.textAlign, 'center', `RAM value "${ramVal}" must be horizontally centered`);
    }
  });

  await t.test('5. RAM values calculate expected single-line font size without clipping', () => {
    // 8 GB, 16 GB, 32 GB at 56px maxWidth
    const size8 = getFittedSingleLineFontSize('8 GB', 56, 18, 12.5, 'ui-monospace, monospace');
    const size16 = getFittedSingleLineFontSize('16 GB', 56, 18, 12.5, 'ui-monospace, monospace');
    const size32 = getFittedSingleLineFontSize('32 GB', 56, 18, 12.5, 'ui-monospace, monospace');

    assert.strictEqual(size8, '18px', '8 GB should retain full 18px size');
    assert.strictEqual(size16, '18px', '16 GB should retain full 18px size');
    assert.strictEqual(size32, '18px', '32 GB should retain full 18px size');

    // A very long RAM string scales down smoothly
    const sizeLong = getFittedSingleLineFontSize('32GB DDR5 4800MHz', 56, 18, 12.5, 'ui-monospace, monospace');
    const numericSize = parseFloat(sizeLong);
    assert.ok(numericSize < 18, 'Long RAM string should scale down');
    assert.ok(numericSize >= 12.5, 'Long RAM string should not drop below minimum font size');
  });
});
