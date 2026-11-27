import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Promotional Image Table - Storage and Screen Single-Line Containment Suite', async (t) => {
  const servicePath = path.resolve('src/services/mssPromotionalService.ts');
  const generatorPath = path.resolve('src/components/placeholders/mss/MSSPromotionalGenerator.tsx');

  assert.ok(fs.existsSync(servicePath), 'mssPromotionalService.ts must exist');
  assert.ok(fs.existsSync(generatorPath), 'MSSPromotionalGenerator.tsx must exist');

  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  const generatorContent = fs.readFileSync(generatorPath, 'utf8');

  const {
    formatScreenValue,
    getFittedSingleLineFontSize,
    renderPromotionalToCanvas,
    wrapPromotionalCellText,
  } = await import('../src/services/mssPromotionalService.ts');

  await t.test('1. formatScreenValue ensures visual separation and clean formatting', () => {
    assert.strictEqual(formatScreenValue('14 تاتش'), '14 تاتش');
    assert.strictEqual(formatScreenValue('14تاتش'), '14 تاتش', 'Should separate number and Arabic word');
    assert.strictEqual(formatScreenValue('15.6 تاتش'), '15.6 تاتش');
    assert.strictEqual(formatScreenValue('15.6تاتش'), '15.6 تاتش');
    assert.strictEqual(formatScreenValue('15.6 4K'), '15.6 4K');
    assert.strictEqual(formatScreenValue('14.1'), '14.1');
    assert.strictEqual(formatScreenValue('13'), '13');
    assert.strictEqual(formatScreenValue(''), '---');
  });

  await t.test('2. getFittedSingleLineFontSize stays single-line and scales within sensible minimum', () => {
    // Normal storage values fit comfortably at base size
    const normalSize = parseFloat(getFittedSingleLineFontSize('SSD 256 GB', 104, 17.5, 12.5));
    assert.ok(normalSize >= 15 && normalSize <= 17.5, `Normal size ${normalSize} should be close to base 17.5px`);

    const normal512 = parseFloat(getFittedSingleLineFontSize('SSD 512 GB', 104, 17.5, 12.5));
    assert.ok(normal512 >= 15 && normal512 <= 17.5);

    const normalScreen = parseFloat(getFittedSingleLineFontSize('14 تاتش', 94, 17.5, 12.5));
    assert.ok(normalScreen >= 14 && normalScreen <= 17.5);

    // Extra-long storage value scales font size down rather than wrapping or overflowing
    const extraLongSize = parseFloat(getFittedSingleLineFontSize('SSD 1024 GB NVMe PCIe Gen4 HighSpeed', 104, 17.5, 12.5));
    assert.ok(extraLongSize >= 12.5 && extraLongSize < normalSize, 'Should smoothly scale down for long text');
  });

  await t.test('3. DOM table layout enforces single-line containment without wrapping in Storage and Screen', () => {
    // Header widths increased to prevent cramped cells
    assert.ok(generatorContent.includes('w-[116px] text-center'), 'Storage column width must be expanded to w-[116px]');
    assert.ok(generatorContent.includes('w-[106px] text-center'), 'Screen column width must be expanded to w-[106px]');

    // Storage and Screen cell styling
    assert.ok(generatorContent.includes('getFittedSingleLineFontSize'), 'Cells must use getFittedSingleLineFontSize');
    assert.ok(generatorContent.includes('formatScreenValue(item.screen)'), 'Screen cell must use formatScreenValue');
    assert.ok(generatorContent.includes('<bdi>{formatScreenValue(item.screen)}</bdi>'), 'Screen cell must wrap formatted value in <bdi> for Arabic/numeric separation');

    // Both Storage and Screen use overflow-hidden and whitespace-nowrap
    assert.ok(generatorContent.includes('box-border overflow-hidden'), 'Cells must have box-border and overflow-hidden');
    assert.ok(generatorContent.includes('whitespace-nowrap font-bold inline-block max-w-full text-center tracking-tight'), 'Text spans must be whitespace-nowrap inline-block');
  });

  await t.test('4. Canvas rendering uses drawSingleLineFittedText for Storage and Screen (no wrap, no ellipsis)', () => {
    assert.ok(serviceContent.includes('function drawSingleLineFittedText('), 'Must define drawSingleLineFittedText');
    assert.ok(serviceContent.includes("col.id === 'storage'") && serviceContent.includes('drawSingleLineFittedText(\n          ctx,\n          item.storage'), 'Storage on canvas must use drawSingleLineFittedText');
    assert.ok(serviceContent.includes("col.id === 'screen'") && serviceContent.includes('drawSingleLineFittedText(\n          ctx,\n          screenText'), 'Screen on canvas must use drawSingleLineFittedText');
  });

  await t.test('5. Runtime Canvas execution: Storage and Screen render on exactly ONE line across all test cases', () => {
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
          drawnTexts.push({ text, x, y, font: this.font, direction: this.direction });
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

    const testCases = [
      { storage: 'SSD 256 GB', screen: '14' },
      { storage: 'SSD 512 GB', screen: '14.1' },
      { storage: 'HDD 500 GB', screen: '15.6 4K' },
      { storage: 'HDD 1TB', screen: '14 تاتش' },
      { storage: '256 SSD', screen: '15.6 تاتش' },
    ];

    const testItems = testCases.map((tc, idx) => ({
      id: `test_${idx}`,
      brand: 'Dell',
      model_name: 'Latitude 5420',
      processor: 'Core i5-1145G7',
      generation: '11th',
      ram: '16GB',
      storage: tc.storage,
      screen: tc.screen,
      gpu: 'Intel Iris Xe',
      quantity: 1,
      price: 15000,
    }));

    renderPromotionalToCanvas(testItems, { showPrice: true, showQuantity: true, itemsPerPage: 10 }, mockCanvas);

    // Verify Storage values are drawn intact on one line without ellipsis or split
    for (const tc of testCases) {
      const storageDrawn = drawnTexts.find(d => d.text === tc.storage);
      assert.ok(storageDrawn, `Storage value "${tc.storage}" must be drawn on a single line`);
      assert.ok(!storageDrawn.text.includes('...'), `Storage value "${tc.storage}" must not contain ellipsis`);

      const formattedScreen = formatScreenValue(tc.screen);
      const screenDrawn = drawnTexts.find(d => d.text === formattedScreen);
      assert.ok(screenDrawn, `Screen value "${formattedScreen}" must be drawn on a single line`);
      assert.ok(!screenDrawn.text.includes('...'), `Screen value "${formattedScreen}" must not contain ellipsis`);

      // Screen with Arabic text must have rtl direction
      if (/[\u0600-\u06FF]/.test(formattedScreen)) {
        assert.strictEqual(screenDrawn.direction, 'rtl', `Screen "${formattedScreen}" with Arabic must render with rtl direction`);
      }
    }
  });

  await t.test('6. Model and Generation multi-line wrapping continues to work while Storage and Screen stay single-line', () => {
    const wrappedModel = wrapPromotionalCellText('SURFACE LAPTOP STUDIO 2', 120, s => s.length * 10);
    assert.ok(wrappedModel.length >= 2, 'Model name should wrap onto 2 lines when long');
    assert.strictEqual(wrappedModel.join(' '), 'SURFACE LAPTOP STUDIO 2');

    const wrappedGen = wrapPromotionalCellText('الجيل الحادي عشر برو', 100, s => s.length * 10);
    assert.ok(wrappedGen.length >= 2, 'Generation should wrap onto 2 lines when long');
    assert.strictEqual(wrappedGen.join(' '), 'الجيل الحادي عشر برو');
  });
});
