import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Compu MSS - Device Reservations Table Layout & Sizing Suite', async (t) => {
  const filePath = path.resolve('src/components/placeholders/mss/ReservationsView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  await t.test('1. All 10 reservation columns are present and well-defined', () => {
    const requiredColumns = [
      'reservation_number',
      'serial_number',
      'model_name',
      'customer_name',
      'deposit_amount',
      'agreed_price',
      'branch',
      'expiry_date',
      'status',
      'actions',
    ];

    for (const colKey of requiredColumns) {
      assert.ok(
        content.includes(`key: '${colKey}'`),
        `Column ${colKey} must be present in the table definition`
      );
    }
  });

  await t.test('2. "model_name" does NOT have "w-full" forcing horizontal overflow', () => {
    // Look at model_name column definition
    const modelColMatch = content.match(/key:\s*'model_name'[\s\S]*?className:\s*'([^']+)'/);
    assert.ok(modelColMatch, 'model_name column must have a className defined');
    const className = modelColMatch[1];

    assert.ok(
      !className.includes('w-full'),
      'model_name must not have w-full which causes tables to overflow'
    );
    assert.ok(
      className.includes('min-w-') && className.includes('max-w-'),
      'model_name must have bounded min-w and max-w for predictable layout'
    );
  });

  await t.test('3. Column width distribution fits within standard 1000px container', () => {
    // Extract column min-width definitions
    const minWidthMatches = [...content.matchAll(/min-w-\[(\d+)px\]/g)].map(m => parseInt(m[1], 10));
    assert.ok(minWidthMatches.length >= 8, 'Most columns must have explicit min-w constraints');

    const totalMinWidth = minWidthMatches.reduce((sum, w) => sum + w, 0);
    assert.ok(
      totalMinWidth <= 1050,
      `Sum of column min-widths (${totalMinWidth}px) must comfortably fit container <= 1050px without horizontal scrollbar`
    );
  });

  await t.test('4. Action buttons have whitespace-nowrap and clean action handlers', () => {
    assert.ok(content.includes('setIsFulfillModalOpen(true)'), 'Fulfill action must remain wired');
    assert.ok(content.includes('handleOpenEdit(item)'), 'Edit action must remain wired');
    assert.ok(content.includes('setIsCancelModalOpen(true)'), 'Cancel action must remain wired');
    assert.ok(content.includes('whitespace-nowrap'), 'Buttons must have whitespace-nowrap to prevent stacked text');
  });

  await t.test('5. Table container removes redundant double-border wrapper', () => {
    assert.ok(
      content.includes('<div className="rounded-xl overflow-hidden shadow-2xs">'),
      'Outer container must be clean without duplicate border-slate-300 around Table component'
    );
  });
});
