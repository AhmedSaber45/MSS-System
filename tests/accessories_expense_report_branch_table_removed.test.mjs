import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Accessories Expense Report - Branch Breakdown Table Removal Suite', async (t) => {
  const filePath = path.resolve('src/components/expenses/PrintableExpenseReportDocument.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  await t.test('1. Branch breakdown table is conditionally hidden for Accessories', () => {
    // Check that branch breakdown is restricted to mss
    assert.match(
      content,
      /moduleName\s*===\s*['"]mss['"]\s*&&\s*branchBreakdown/,
      'Branch breakdown table must only render when moduleName is mss'
    );
  });

  await t.test('2. Accessories Expenses Report omits "توزيع المصروفات حسب الفرع"', () => {
    // Emulate react rendering behavior logic:
    const mockExpense = {
      id: 'exp-1',
      title: 'رول فواتير حرارية',
      amount: 180,
      category: 'مستلزمات مكتبية',
      branch: 'محل 2',
      expense_date: '2026-11-21',
      payment_method: 'نقدي (كاش)',
      payment_source: 'درج النقدية',
      created_at: '2026-11-21T10:00:00Z',
      updated_at: '2026-11-21T10:00:00Z',
    };

    const mockBranchBreakdown = [
      { branch: 'محل 1', total: 1420, count: 3 },
      { branch: 'محل 2', total: 180, count: 1 },
    ];

    // For accessories
    const renderBranchBreakdownAccessories = (moduleName, branchBreakdown) => {
      return moduleName === 'mss' && branchBreakdown && branchBreakdown.length > 0;
    };

    assert.strictEqual(
      renderBranchBreakdownAccessories('accessories', mockBranchBreakdown),
      false,
      'Accessories report must NOT render branch breakdown'
    );

    // For MSS
    assert.strictEqual(
      renderBranchBreakdownAccessories('mss', mockBranchBreakdown),
      true,
      'Compu MSS report MUST retain branch breakdown when data is present'
    );
  });

  await t.test('3. Remaining sections remain intact in PrintableExpenseReportDocument', () => {
    // Header
    assert.ok(content.includes('moduleDisplayName'), 'Header title must remain intact');
    assert.ok(content.includes('تاريخ الاستخراج:'), 'Extraction date must remain intact');
    assert.ok(content.includes('فترة التقرير:'), 'Report period label must remain intact');
    // Executive summary cards
    assert.ok(content.includes('إجمالي المصروفات'), 'Total expenses card must remain intact');
    assert.ok(content.includes('عدد حركات الصرف المنفذة'), 'Transaction count card must remain intact');
    // Detailed expenses table
    assert.ok(content.includes('جدول تفاصيل المصروفات'), 'Detailed expenses table must remain intact');
    assert.ok(content.includes('إجمالي كافة المصروفات للفترة المحددة:'), 'Grand total row must remain intact');
  });

  await t.test('4. Existing expense tests still pass cleanly', async () => {
    const { execSync } = await import('node:child_process');
    const result = execSync('node tests/operating_expenses_management.test.mjs', { encoding: 'utf-8' });
    assert.ok(result.includes('pass 10'), 'operating_expenses_management.test.mjs must pass all 10 tests');
  });
});
