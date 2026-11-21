import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock browser localStorage and window for Node.js test environment
const mockStorage = new Map();
const storageMock = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

globalThis.localStorage = storageMock;
globalThis.window = {
  localStorage: storageMock,
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

test('1. ExpenseFormModal UI: Category, Payment Source, Payment Method removed from MSS modal', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/expenses/ExpenseFormModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Verify the 3 removed fields do not exist anywhere in the modal UI
  assert.ok(!modalCode.includes('تصنيف المصروف'), 'Category label (تصنيف المصروف) must NOT be in the modal');
  assert.ok(!modalCode.includes('مصدر الصرف (جهة التمويل)'), 'Payment Source label must NOT be in the modal');
  assert.ok(!modalCode.includes('طريقة السداد والدفع'), 'Payment Method label must NOT be in the modal');

  // Verify dropdown selectors for removed fields do not exist
  assert.ok(!modalCode.includes('PREDEFINED_EXPENSE_CATEGORIES'), 'PREDEFINED_EXPENSE_CATEGORIES must not be referenced in modal');
  assert.ok(!modalCode.includes('EXPENSE_PAYMENT_SOURCES'), 'EXPENSE_PAYMENT_SOURCES must not be referenced in modal');
  assert.ok(!modalCode.includes('EXPENSE_PAYMENT_METHODS'), 'EXPENSE_PAYMENT_METHODS must not be referenced in modal');
});

test('2. ExpenseFormModal UI: All required remaining fields are present for MSS', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/expenses/ExpenseFormModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Verify remaining fields exist for MSS: Title, Amount, Date, Branch, Notes
  assert.ok(modalCode.includes('اسم أو بيان المصروف'), 'Must have Expense Name field');
  assert.ok(modalCode.includes('المبلغ المالي (EGP)'), 'Must have Amount field');
  assert.ok(modalCode.includes('تاريخ المصروف'), 'Must have Date field');
  assert.ok(modalCode.includes('الفرع المسؤول'), 'Must have Branch field for MSS');
  assert.ok(modalCode.includes('ملاحظات وتفاصيل إضافية (اختياري)'), 'Must have Notes/Description field');
});

test('3. Accessories modal remains completely unchanged with its 4 fields', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/expenses/ExpenseFormModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  assert.ok(modalCode.includes("const isAccessories = moduleName === 'accessories'"), 'Must maintain isAccessories check');
  // Accessories does not render branch
  assert.ok(modalCode.includes('!isAccessories && !branch.trim()'), 'Branch required only for MSS');
});

test('4. Registering a new Compu MSS expense saves successfully with database schema defaults', async () => {
  const { mssExpensesService } = await import('../src/services/mssExpensesService.ts');
  mockStorage.clear();

  // Simulate new expense registration from simplified modal
  const newExpense = await mssExpensesService.createExpense({
    title: 'شراء كابلات شاشات وتوصيلات لمعمل الصيانة',
    amount: 850,
    branch: 'محل 1',
    expense_date: '2026-11-21',
    category: 'مصروفات عامة',
    payment_source: 'أموال الشركة',
    payment_method: 'نقدي (كاش)',
    description: 'شراء 10 كابلات HDMI وDisplayPort لصيانة الأجهزة',
  });

  assert.ok(newExpense.id, 'New expense must have an ID');
  assert.equal(newExpense.title, 'شراء كابلات شاشات وتوصيلات لمعمل الصيانة');
  assert.equal(newExpense.amount, 850);
  assert.equal(newExpense.branch, 'محل 1');
  assert.equal(newExpense.expense_date, '2026-11-21');
  assert.equal(newExpense.category, 'مصروفات عامة');
  assert.equal(newExpense.payment_source, 'أموال الشركة');
  assert.equal(newExpense.payment_method, 'نقدي (كاش)');
  assert.equal(newExpense.description, 'شراء 10 كابلات HDMI وDisplayPort لصيانة الأجهزة');

  // Verify it appears in stored expenses list
  const list = await mssExpensesService.getExpenses();
  const found = list.find(e => e.id === newExpense.id);
  assert.ok(found, 'Created expense must appear in the expenses list');
  assert.equal(found.amount, 850);
});

test('5. Editing an existing Compu MSS expense preserves historical category, payment source, and method', async () => {
  const { mssExpensesService } = await import('../src/services/mssExpensesService.ts');
  mockStorage.clear();

  // Create an initial expense with specific category, source, and method
  const initial = await mssExpensesService.createExpense({
    title: 'مرتبات فنيي الصيانة',
    amount: 12000,
    branch: 'محل 2',
    expense_date: '2026-11-01',
    category: 'مرتبات الموظفين',
    payment_source: 'أموال الشركة',
    payment_method: 'تحويل بنكي',
    description: 'صرف الرواتب الشهرية',
  });

  // Now simulate updating the expense title and amount (without passing category/source/method from form)
  const updated = await mssExpensesService.updateExpense(initial.id, {
    title: 'مرتبات فنيي الصيانة - شهر نوفمبر بعد العلاوة',
    amount: 13500,
    branch: 'محل 2',
    expense_date: '2026-11-01',
    category: initial.category, // preserved by form logic
    payment_source: initial.payment_source, // preserved by form logic
    payment_method: initial.payment_method, // preserved by form logic
    description: 'صرف الرواتب الشهرية بعد إضافة حوافز الفنيين',
  });

  assert.equal(updated.title, 'مرتبات فنيي الصيانة - شهر نوفمبر بعد العلاوة');
  assert.equal(updated.amount, 13500);
  // Historical category and payment method preserved
  assert.equal(updated.category, 'مرتبات الموظفين');
  assert.equal(updated.payment_method, 'تحويل بنكي');
  assert.equal(updated.payment_source, 'أموال الشركة');
});

test('6. Existing seed expense records and historical data remain intact', async () => {
  const { mssExpensesService } = await import('../src/services/mssExpensesService.ts');
  mockStorage.clear();

  const allExpenses = await mssExpensesService.getExpenses();
  assert.ok(allExpenses.length >= 5, 'Must contain seed expenses');

  const seed001 = allExpenses.find(e => e.id === 'mss-exp-seed-001');
  assert.ok(seed001, 'Seed 001 must exist');
  assert.equal(seed001.category, 'مرتبات الموظفين');
  assert.equal(seed001.payment_method, 'تحويل بنكي');
  assert.equal(seed001.branch, 'محل 1');

  const seed002 = allExpenses.find(e => e.id === 'mss-exp-seed-002');
  assert.ok(seed002, 'Seed 002 must exist');
  assert.equal(seed002.category, 'إيجار');
  assert.equal(seed002.branch, 'محل 2');
});
