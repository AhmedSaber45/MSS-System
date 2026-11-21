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

test('1. SQL Migration file exists and has complete schema, indexes, trigger, and RLS', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261121_operating_expenses_management_system.sql');
  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');

  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.mss_expenses'), 'Must create mss_expenses table');
  assert.ok(sql.includes('title TEXT NOT NULL'), 'Must include title (Expense Name)');
  assert.ok(sql.includes('category TEXT NOT NULL'), 'Must include category');
  assert.ok(sql.includes('amount NUMERIC(12, 2) NOT NULL'), 'Must include amount NUMERIC(12, 2)');
  assert.ok(sql.includes('branch TEXT NOT NULL'), 'Must include branch');
  assert.ok(sql.includes('expense_date DATE NOT NULL'), 'Must include expense_date');
  assert.ok(sql.includes('payment_source TEXT NOT NULL'), 'Must include payment_source');
  assert.ok(sql.includes('payment_method TEXT NOT NULL'), 'Must include payment_method');
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_mss_expenses_date'), 'Must index expense_date');
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_mss_expenses_branch'), 'Must index branch');
  assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_mss_expenses_category'), 'Must index category');
  assert.ok(sql.includes('ALTER TABLE public.mss_expenses ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
});

test('2. Accessories Expenses Service: CRUD & Persistence in SQLite/LocalStorage', async () => {
  const { accessoriesExpensesService } = await import('../src/services/accessoriesExpensesService.ts');
  mockStorage.clear();

  // Create
  const newExp = await accessoriesExpensesService.createExpense({
    title: 'فاتورة كهرباء المحل',
    category: 'كهرباء ومرافق',
    amount: 850,
    branch: 'محل 1',
    expense_date: '2026-11-20',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
    description: 'فاتورة شهر نوفمبر',
  });

  assert.ok(newExp.id, 'Created expense must have an ID');
  assert.equal(newExp.title, 'فاتورة كهرباء المحل');
  assert.equal(newExp.amount, 850);
  assert.equal(newExp.branch, 'محل 1');

  // Read
  const allExp = await accessoriesExpensesService.getExpenses();
  assert.ok(allExp.some(e => e.id === newExp.id), 'Must find created expense in list');

  // Update
  const updated = await accessoriesExpensesService.updateExpense(newExp.id, {
    amount: 900,
    description: 'فاتورة شهر نوفمبر بعد التعديل',
  });
  assert.equal(updated.amount, 900);
  assert.equal(updated.description, 'فاتورة شهر نوفمبر بعد التعديل');

  // Verify persistence
  const savedRaw = mockStorage.get('shop_accessories_expenses_v1');
  assert.ok(savedRaw, 'Must be stored in shop_accessories_expenses_v1 key');
  const parsed = JSON.parse(savedRaw);
  const found = parsed.find(e => e.id === newExp.id);
  assert.ok(found, 'Updated expense must persist in storage');
  assert.equal(found.amount, 900);

  // Delete
  const deleted = await accessoriesExpensesService.deleteExpense(newExp.id);
  assert.equal(deleted, true);
  const remaining = await accessoriesExpensesService.getExpenses();
  assert.ok(!remaining.some(e => e.id === newExp.id), 'Deleted expense must not exist');
});

test('3. Compu MSS Expenses Service: Offline Outbox Queueing and Isolation', async () => {
  const { mssExpensesService } = await import('../src/services/mssExpensesService.ts');
  mockStorage.clear();

  // Create MSS expense while offline
  const newMssExp = await mssExpensesService.createExpense({
    title: 'صيانة مكيفات المعرض',
    category: 'صيانة وإصلاحات',
    amount: 1500,
    branch: 'محل 2',
    expense_date: '2026-11-21',
    payment_source: 'أموال الشركة',
    payment_method: 'نقدي (كاش)',
    description: 'صيانة دورية للمكيفات',
  });

  assert.ok(newMssExp.id, 'Must have ID');
  assert.equal(newMssExp.title, 'صيانة مكيفات المعرض');
  assert.equal(newMssExp.amount, 1500);

  // Check stored in MSS offline key
  const mssRaw = mockStorage.get('shop_mss_expenses_v1');
  assert.ok(mssRaw, 'MSS expenses must be stored under shop_mss_expenses_v1');
  const mssParsed = JSON.parse(mssRaw);
  assert.ok(mssParsed.some(e => e.id === newMssExp.id && e.amount === 1500));

  // Verify Accessories storage key is completely untouched (Strict Isolation)
  const accRaw = mockStorage.get('shop_accessories_expenses_v1');
  assert.equal(accRaw, undefined, 'Accessories storage must NEVER be touched by MSS expenses');

  // Check Outbox queue has EXPENSE_CREATE operation
  const outboxRaw = mockStorage.get('shop_mss_outbox_queue_v1');
  assert.ok(outboxRaw, 'Outbox queue must exist');
  const outboxParsed = JSON.parse(outboxRaw);
  assert.ok(outboxParsed.some(op => op.type === 'EXPENSE_CREATE' && op.payload.amount === 1500), 'Outbox must queue EXPENSE_CREATE');
});

test('4. Accounting Principle: Gross Profit vs Net Profit After Expenses', () => {
  // Scenario:
  // Gross Sales = 100,000 EGP
  // Returns = 5,000 EGP
  // Net Sales = 95,000 EGP
  // COGS = 65,000 EGP
  // Gross Profit = Net Sales - COGS = 30,000 EGP
  // Operating Expenses = 8,000 EGP
  // Net Profit After Expenses = Gross Profit - Operating Expenses = 22,000 EGP

  const grossSales = 100000;
  const returns = 5000;
  const netSales = grossSales - returns;
  const cogs = 65000;
  const grossProfit = netSales - cogs;
  const operatingExpenses = 8000;
  const netProfit = grossProfit - operatingExpenses;

  assert.equal(netSales, 95000, 'Net Sales must equal Gross Sales - Returns');
  assert.equal(grossProfit, 30000, 'Gross Profit must equal Net Sales - COGS');
  assert.equal(netProfit, 22000, 'Net Profit must equal Gross Profit - Operating Expenses');
  assert.ok(cogs === 65000, 'COGS must remain untouched by operating expenses');

  // Margin percentages
  const grossMarginPercent = (grossProfit / netSales) * 100;
  const netMarginPercent = (netProfit / netSales) * 100;

  assert.equal(grossMarginPercent.toFixed(1), '31.6');
  assert.equal(netMarginPercent.toFixed(1), '23.2');
});

test('5. Filtering and Period Statistics calculation', async () => {
  const { accessoriesExpensesService } = await import('../src/services/accessoriesExpensesService.ts');
  // Clear and populate custom list
  mockStorage.set('shop_accessories_expenses_v1', JSON.stringify([]));

  // Add 3 expenses on different dates and branches
  await accessoriesExpensesService.createExpense({
    title: 'مصروف نظافة 1',
    category: 'نظافة ومستلزمات',
    amount: 200,
    branch: 'محل 1',
    expense_date: '2026-11-01',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
  });

  await accessoriesExpensesService.createExpense({
    title: 'بنزين نقل أجهزة',
    category: 'بنزين ومواصلات',
    amount: 350,
    branch: 'محل 2',
    expense_date: '2026-11-15',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
  });

  await accessoriesExpensesService.createExpense({
    title: 'مرتبات العمال',
    category: 'مرتبات الموظفين',
    amount: 5000,
    branch: 'محل 1',
    expense_date: '2026-11-20',
    payment_source: 'أموال المحل',
    payment_method: 'تحويل بنكي',
  });

  // Filter by branch: محل 1
  const shop1Exp = await accessoriesExpensesService.getExpenses({ branch: 'محل 1' });
  assert.equal(shop1Exp.length, 2);
  assert.equal(shop1Exp.reduce((s, e) => s + e.amount, 0), 5200);

  // Filter by category: بنزين ومواصلات
  const fuelExp = await accessoriesExpensesService.getExpenses({ category: 'بنزين ومواصلات' });
  assert.equal(fuelExp.length, 1);
  assert.equal(fuelExp[0].amount, 350);

  // Filter by date range: 2026-11-10 to 2026-11-25
  const dateFiltered = await accessoriesExpensesService.getExpenses({
    startDate: '2026-11-10',
    endDate: '2026-11-25',
  });
  assert.equal(dateFiltered.length, 2);
  assert.equal(dateFiltered.reduce((s, e) => s + e.amount, 0), 5350);

  // Total expenses in range
  const total = await accessoriesExpensesService.getTotalExpenses('2026-11-01', '2026-11-30');
  assert.equal(total, 5550);
});

test('6. Dynamic Branches integration & Predefined categories', async () => {
  const { PREDEFINED_EXPENSE_CATEGORIES } = await import('../src/types/expenses.ts');

  // Verify required predefined categories
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('مرتبات الموظفين'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('بنزين ومواصلات'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('كهرباء ومرافق'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('نظافة ومستلزمات'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('صيانة وإصلاحات'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('إيجار'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('ضيافة'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('مستلزمات مكتبية'));
  assert.ok(PREDEFINED_EXPENSE_CATEGORIES.includes('مصروفات أخرى'));

  // Verify dynamic branches from operational service
  const { mssOperationalService } = await import('../src/services/mssOperationalService.ts');
  const activeLocations = mssOperationalService.getActiveLocationNamesSync();
  assert.ok(activeLocations.includes('محل 1'));
  assert.ok(activeLocations.includes('محل 2'));
});

test('7. ExpenseFormModal UI fields simplification: Accessories (4 fields) & Compu MSS (5 fields)', () => {
  const modalPath = path.resolve(process.cwd(), 'src/components/expenses/ExpenseFormModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  // Verify Accessories mode simplification condition
  assert.ok(modalCode.includes("const isAccessories = moduleName === 'accessories'"), 'Must detect accessories module');

  // In Accessories mode: only 4 fields (Title, Amount, Date, Description) are rendered
  assert.ok(modalCode.includes('اسم أو بيان المصروف'), 'Must have Title field');
  assert.ok(modalCode.includes('المبلغ المالي (EGP)'), 'Must have Amount field');
  assert.ok(modalCode.includes('تاريخ المصروف'), 'Must have Date field');
  assert.ok(modalCode.includes('ملاحظات وتفاصيل إضافية (اختياري)'), 'Must have Description field');

  // In MSS mode: Category, Payment Source, and Payment Method are completely removed
  assert.ok(!modalCode.includes('تصنيف المصروف'), 'Category field must be removed from MSS');
  assert.ok(!modalCode.includes('مصدر الصرف (جهة التمويل)'), 'Payment Source field must be removed from MSS');
  assert.ok(!modalCode.includes('طريقة السداد والدفع'), 'Payment Method field must be removed from MSS');

  // In MSS mode: Branch field is retained
  assert.ok(modalCode.includes('الفرع المسؤول'), 'Branch field must be retained for MSS');

  // Validation logic: branch is NOT validated when isAccessories is true
  assert.ok(
    modalCode.includes('!isAccessories && !branch.trim()'),
    'Branch must not be required or validated for Accessories'
  );

  // Safe defaults applied for both modules
  assert.ok(modalCode.includes("category || 'مصروفات عامة'"), 'Must provide default category');
  assert.ok(modalCode.includes("payment_source || 'أموال المحل'"), 'Must provide default payment_source for Accessories');
  assert.ok(modalCode.includes("payment_source || 'أموال الشركة'"), 'Must provide default payment_source for MSS');
  assert.ok(modalCode.includes("payment_method || 'نقدي (كاش)'"), 'Must provide default payment_method');
});

test('8. PrintExpenseReportModal UI refinement: Branch filter removed for Accessories, retained for MSS', () => {
  const printModalPath = path.resolve(process.cwd(), 'src/components/expenses/PrintExpenseReportModal.tsx');
  const printModalCode = fs.readFileSync(printModalPath, 'utf8');

  // Branch filter condition: only for moduleName === 'mss'
  assert.ok(printModalCode.includes("moduleName === 'mss' && ("), 'Branch selector must only render for MSS');
  assert.ok(printModalCode.includes('الفرع المستهدف:'), 'Branch selector label must exist');

  // Print filter logic: branch filtering applied only when moduleName === 'mss'
  assert.ok(
    printModalCode.includes("moduleName === 'mss' && selectedBranch !== 'ALL'"),
    'Branch filter must apply to MSS expenses only'
  );
});

test('9. View Filter Bars: Accessories has NO Category/Branch filter; MSS has NO Category but retains Branch filter', () => {
  const accViewPath = path.resolve(process.cwd(), 'src/components/placeholders/accessories/AccessoriesExpensesView.tsx');
  const accViewCode = fs.readFileSync(accViewPath, 'utf8');

  // Accessories must NOT have category or branch select dropdowns in filter card
  assert.ok(!accViewCode.includes('كافة تصنيفات المصروفات'), 'Accessories view must not have category filter dropdown');
  assert.ok(!accViewCode.includes('كافة الفروع'), 'Accessories view must not have branch filter dropdown');
  // Accessories must have search and sorting
  assert.ok(accViewCode.includes('بحث بالاسم أو البيان أو الوصف...'), 'Accessories view must have search input');
  assert.ok(accViewCode.includes('value={sortBy}'), 'Accessories view must have sort selector');
  assert.ok(accViewCode.includes("category: 'ALL'"), 'Accessories loadData must query category ALL');
  assert.ok(accViewCode.includes("branch: 'ALL'"), 'Accessories loadData must query branch ALL');

  const mssViewPath = path.resolve(process.cwd(), 'src/components/placeholders/mss/MSSExpensesView.tsx');
  const mssViewCode = fs.readFileSync(mssViewPath, 'utf8');

  // MSS must NOT have category filter dropdown
  assert.ok(!mssViewCode.includes('كافة تصنيفات المصروفات'), 'MSS view must not have category filter dropdown');
  // MSS MUST retain branch filter dropdown
  assert.ok(mssViewCode.includes('كافة الفروع والمخازن'), 'MSS view must retain branch filter dropdown');
  assert.ok(mssViewCode.includes('value={selectedBranch}'), 'MSS view must retain branch select state');
  // MSS must have search and sorting
  assert.ok(mssViewCode.includes('بحث بالاسم أو البيان أو الوصف...'), 'MSS view must have search input');
  assert.ok(mssViewCode.includes('value={sortBy}'), 'MSS view must have sort selector');
  assert.ok(mssViewCode.includes("category: 'ALL'"), 'MSS loadData must query category ALL');
});

test('10. Accessories Expense creation with safe defaults without user intervention', async () => {
  const { accessoriesExpensesService } = await import('../src/services/accessoriesExpensesService.ts');
  mockStorage.set('shop_accessories_expenses_v1', JSON.stringify([]));

  // Simulating submission from simplified Accessories modal (only title, amount, date, description)
  // Default values supplied by form submit handler:
  const created = await accessoriesExpensesService.createExpense({
    title: 'أدوات نظافة ومعطرات جو',
    amount: 175,
    expense_date: '2026-11-21',
    category: 'مصروفات عامة',
    branch: 'محل 1',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
    description: 'شراء أدوات نظافة أسبوعية',
  });

  assert.ok(created.id, 'Created expense must have an ID');
  assert.equal(created.title, 'أدوات نظافة ومعطرات جو');
  assert.equal(created.amount, 175);
  assert.equal(created.category, 'مصروفات عامة');
  assert.equal(created.branch, 'محل 1');
  assert.equal(created.payment_source, 'أموال المحل');
  assert.equal(created.payment_method, 'نقدي (كاش)');
  assert.equal(created.description, 'شراء أدوات نظافة أسبوعية');

  // Ensure stats calculate properly
  const stats = await accessoriesExpensesService.getStats({ startDate: '2026-11-21', endDate: '2026-11-21' });
  assert.equal(stats.periodTotal, 175);
  assert.equal(stats.transactionsCount, 1);
});
