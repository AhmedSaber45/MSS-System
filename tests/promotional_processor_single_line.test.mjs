import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderPromotionalToCanvas,
  getFittedSingleLineFontSize,
  wrapPromotionalCellText,
} from '../src/services/mssPromotionalService.ts';

test('Promotional Image Table - Processor Column Single-Line Suite', async (t) => {
  await t.test('1. colWidths preserves total table width (1140px) while expanding Processor width', () => {
    const serviceContent = fs.readFileSync(path.resolve('src/services/mssPromotionalService.ts'), 'utf8');

    // Case 1: showPrice && showQty
    assert.ok(serviceContent.includes("{ id: 'processor', label: 'المعالج', icon: 'cpu', width: 104 }"), 'Processor width should be 104px in showPrice && showQty');
    
    // Case 2: showPrice && !showQty
    assert.ok(serviceContent.includes("{ id: 'processor', label: 'المعالج', icon: 'cpu', width: 108 }"), 'Processor width should be 108px in showPrice && !showQty');
    
    // Case 3: !showPrice && showQty
    assert.ok(serviceContent.includes("{ id: 'processor', label: 'المعالج', icon: 'cpu', width: 114 }"), 'Processor width should be 114px in !showPrice && showQty');
    
    // Case 4: !showPrice && !showQty
    assert.ok(serviceContent.includes("{ id: 'processor', label: 'المعالج', icon: 'cpu', width: 120 }"), 'Processor width should be 120px in !showPrice && !showQty');
  });

  await t.test('2. DOM layout enforces Processor width (w-[102px]), single-line nowrap, and overflow containment', () => {
    const generatorContent = fs.readFileSync(
      path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx'),
      'utf8'
    );

    // Processor Header must be w-[102px]
    assert.ok(
      generatorContent.includes('w-[102px] text-center'),
      'DOM header for Processor must have w-[102px]'
    );

    // Processor Cell must have whitespace-nowrap and single-line font scaling
    assert.ok(
      generatorContent.includes('border-r border-slate-200 font-mono text-[18.5px] box-border overflow-hidden'),
      'DOM Processor cell must have box-border overflow-hidden'
    );
    assert.ok(
      generatorContent.includes('whitespace-nowrap font-bold inline-block max-w-full text-center tracking-tight'),
      'DOM Processor cell must be strictly single-line with whitespace-nowrap'
    );
    assert.ok(
      generatorContent.includes('getFittedSingleLineFontSize('),
      'DOM Processor cell must use getFittedSingleLineFontSize'
    );
  });

  await t.test('3. Canvas rendering uses drawSingleLineFittedText for Processor (no multi-line wrap, no ellipsis)', () => {
    const serviceContent = fs.readFileSync(path.resolve('src/services/mssPromotionalService.ts'), 'utf8');

    // Look for Processor branch using drawSingleLineFittedText
    assert.ok(
      serviceContent.includes("col.id === 'processor'"),
      'Canvas must have dedicated col.id === processor branch'
    );
    assert.ok(
      serviceContent.includes('drawSingleLineFittedText('),
      'Canvas rendering must call drawSingleLineFittedText for single-line columns'
    );
  });

  await t.test('4. Runtime Canvas execution: CI 3, CI 5, CI 7, CI 9, CORE i7, RYZEN 3, RYZEN 5, RYZEN 7, CI7 H render centered on ONE line', () => {
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

    const processorTestCases = [
      'CI 3',
      'CI 5',
      'CI 7',
      'CI 9',
      'CORE i7',
      'RYZEN 3',
      'RYZEN 5',
      'RYZEN 7',
      'CI7 H',
      'Ryzen 7 PRO',
    ];

    const testItems = processorTestCases.map((procVal, idx) => ({
      id: `proc_test_${idx}`,
      brand: 'Dell',
      model_name: 'Latitude 5420',
      processor: procVal,
      generation: '11th',
      ram: '16 GB',
      storage: 'SSD 256 GB',
      screen: '14',
      gpu: 'Intel Iris Xe',
      quantity: 1,
      price: 15000,
    }));

    renderPromotionalToCanvas(testItems, { showPrice: true, showQuantity: true, itemsPerPage: 10 }, mockCanvas);

    for (const procVal of processorTestCases) {
      const procDrawn = drawnTexts.find(d => d.text === procVal);
      assert.ok(procDrawn, `Processor value "${procVal}" must be drawn on a single line`);
      assert.ok(!procDrawn.text.includes('...'), `Processor value "${procVal}" must not contain ellipsis`);
      assert.strictEqual(procDrawn.textAlign, 'center', `Processor value "${procVal}" must be horizontally centered`);
    }
  });

  await t.test('5. Processor values retain full font size or scale smoothly without clipping', () => {
    // Standard short values at 86px maxWidth
    const sizeCi5 = getFittedSingleLineFontSize('CI 5', 86, 18, 12.5, 'ui-monospace, monospace');
    const sizeCoreI7 = getFittedSingleLineFontSize('CORE i7', 86, 18, 12.5, 'ui-monospace, monospace');
    const sizeRyzen7 = getFittedSingleLineFontSize('RYZEN 7', 86, 18, 12.5, 'ui-monospace, monospace');

    assert.strictEqual(sizeCi5, '18px', 'CI 5 should retain full 18px size');
    assert.strictEqual(sizeCoreI7, '18px', 'CORE i7 should retain full 18px size');
    assert.strictEqual(sizeRyzen7, '18px', 'RYZEN 7 should retain full 18px size');

    // A longer string scales down smoothly
    const sizeLong = getFittedSingleLineFontSize('Core i7-13700HX', 86, 18, 12.5, 'ui-monospace, monospace');
    const numericSize = parseFloat(sizeLong);
    assert.ok(numericSize < 18, 'Long Processor string should scale down');
    assert.ok(numericSize >= 12.5, 'Long Processor string should not drop below minimum font size');
  });

  await t.test('6. Model and Generation still wrap onto multiple lines while Processor remains single-line', () => {
    const wrappedModel = wrapPromotionalCellText('SURFACE LAPTOP STUDIO 2', 120, s => s.length * 10);
    assert.ok(wrappedModel.length >= 2, 'Model name should wrap onto 2 lines when long');

    const wrappedGen = wrapPromotionalCellText('الجيل الحادي عشر برو', 100, s => s.length * 10);
    assert.ok(wrappedGen.length >= 2, 'Generation should wrap onto 2 lines when long');
  });
});
