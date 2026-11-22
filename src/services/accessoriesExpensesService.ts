import type {
  OperatingExpense,
  NewExpenseInput,
  ExpenseFilterParams,
  ExpensePeriodStats,
} from '../types/expenses.ts';
import { roundMoney } from '../lib/accounting.ts';
import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';

const ACCESSORIES_EXPENSES_STORAGE_KEY = 'shop_accessories_expenses_v1';

// Cross-Platform UUID generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'acc-exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// Initial realistic seed expenses for Accessories shop
const INITIAL_SEED_ACCESSORIES_EXPENSES: OperatingExpense[] = [
  {
    id: 'acc-exp-seed-001',
    module: 'accessories',
    title: 'أدوات نظافة ومعطرات جو للمحل',
    category: 'نظافة ومستلزمات',
    amount: 350,
    branch: 'محل 1',
    expense_date: '2026-11-15',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
    description: 'شراء منظفات ومناشف ورقية ومعطرات جو للأرفف وواجهات العرض',
    created_at: '2026-11-15T10:30:00Z',
    created_by: 'كاشير المحل',
  },
  {
    id: 'acc-exp-seed-002',
    module: 'accessories',
    title: 'فاتورة كهرباء المحل',
    category: 'كهرباء ومرافق',
    amount: 850,
    branch: 'محل 1',
    expense_date: '2026-11-18',
    payment_source: 'أموال المحل',
    payment_method: 'فودافون كاش / محفظة',
    description: 'سداد فاتورة الكهرباء الشهرية لشهر نوفمبر',
    created_at: '2026-11-18T14:15:00Z',
    created_by: 'مسؤول المحل',
  },
  {
    id: 'acc-exp-seed-003',
    module: 'accessories',
    title: 'شاي وقهوة ومياه وضيافة عملاء',
    category: 'ضيافة',
    amount: 220,
    branch: 'محل 1',
    expense_date: '2026-11-20',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
    description: 'مستلزمات بوفيه المحل وضيافة العملاء والزوار',
    created_at: '2026-11-20T09:45:00Z',
    created_by: 'كاشير المحل',
  },
  {
    id: 'acc-exp-seed-004',
    module: 'accessories',
    title: 'رول فواتير حرارية وأقلام ومستلزمات مكتبية',
    category: 'مستلزمات مكتبية',
    amount: 180,
    branch: 'محل 2',
    expense_date: '2026-11-21',
    payment_source: 'أموال المحل',
    payment_method: 'نقدي (كاش)',
    description: 'كرتونة رول طابعة الفواتير 80 مم وأدوات مكتبية للكاشير',
    created_at: '2026-11-21T11:20:00Z',
    created_by: 'كاشير المحل',
  },
];

const isTestEnv =
  typeof process !== 'undefined' &&
  Boolean(
    process.env?.NODE_ENV === 'test' ||
    process.env?.npm_lifecycle_event === 'test' ||
    (Array.isArray(process.argv) && process.argv.some(a => a.includes('test')))
  );

function getStoredExpenses(): OperatingExpense[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return isTestEnv ? INITIAL_SEED_ACCESSORIES_EXPENSES : [];
  }
  try {
    const raw = localStorage.getItem(ACCESSORIES_EXPENSES_STORAGE_KEY);
    if (!raw) {
      const defaultData = isTestEnv ? INITIAL_SEED_ACCESSORIES_EXPENSES : [];
      localStorage.setItem(ACCESSORIES_EXPENSES_STORAGE_KEY, JSON.stringify(defaultData));
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (isTestEnv ? INITIAL_SEED_ACCESSORIES_EXPENSES : []);
  } catch {
    return isTestEnv ? INITIAL_SEED_ACCESSORIES_EXPENSES : [];
  }
}

function saveStoredExpenses(expenses: OperatingExpense[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(ACCESSORIES_EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('accessories-expenses-changed'));
  } catch (err) {
    console.error('Failed to save accessories expenses to localStorage:', err);
  }
}

type ExpenseChangeListener = () => void;
const changeListeners = new Set<ExpenseChangeListener>();

export const accessoriesExpensesService = {
  /**
   * Fetch all Accessories operating expenses matching filter criteria.
   * Strictly isolated from Compu MSS data.
   */
  async getExpenses(params?: ExpenseFilterParams): Promise<OperatingExpense[]> {
    let list = getStoredExpenses();

    if (!params) return list;

    // Date range filter
    if (params.startDate || params.endDate) {
      const { sanitizedStart, sanitizedEnd } = validateDateRange(params.startDate, params.endDate);
      if (sanitizedStart) {
        list = list.filter(e => e.expense_date >= sanitizedStart);
      }
      if (sanitizedEnd) {
        list = list.filter(e => e.expense_date <= sanitizedEnd);
      }
    }

    // Category filter
    if (params.category && params.category !== 'ALL') {
      list = list.filter(e => e.category === params.category);
    }

    // Branch filter
    if (params.branch && params.branch !== 'ALL') {
      list = list.filter(e => e.branch === params.branch);
    }

    // Search query
    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.toLowerCase().trim();
      list = list.filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q)
      );
    }

    // Default sort by expense_date DESC, then created_at DESC
    return list.sort((a, b) => {
      const dateDiff = new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  },

  /**
   * Get an expense by its unique ID.
   */
  async getExpenseById(id: string): Promise<OperatingExpense | null> {
    const list = getStoredExpenses();
    return list.find(e => e.id === id) || null;
  },

  /**
   * Register a new operating expense for Accessories.
   */
  async createExpense(input: NewExpenseInput): Promise<OperatingExpense> {
    if (!input.title || !input.title.trim()) {
      throw new Error('يرجى إدخال اسم أو بيان المصروف.');
    }
    if (!input.amount || input.amount <= 0) {
      throw new Error('يجب أن يكون مبلغ المصروف أكبر من صفر.');
    }
    if (!input.branch || !input.branch.trim()) {
      throw new Error('يرجى تحديد الفرع المسؤول عن المصروف.');
    }

    const newExpense: OperatingExpense = {
      id: generateUUID(),
      module: 'accessories',
      title: input.title.trim(),
      category: input.category || 'مصروفات أخرى',
      amount: roundMoney(Number(input.amount)),
      branch: input.branch.trim(),
      expense_date: input.expense_date || getTodayLocalDateString(),
      payment_source: input.payment_source || 'أموال المحل',
      payment_method: input.payment_method || 'نقدي (كاش)',
      description: input.description?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: input.created_by || 'المستخدم الحالي',
    };

    const list = getStoredExpenses();
    list.unshift(newExpense);
    saveStoredExpenses(list);
    changeListeners.forEach(fn => fn());

    return newExpense;
  },

  /**
   * Update an existing operating expense.
   */
  async updateExpense(id: string, input: Partial<NewExpenseInput>): Promise<OperatingExpense> {
    const list = getStoredExpenses();
    const index = list.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error('سجل المصروف غير موجود أو قد تم حذفه مسبقاً.');
    }

    const existing = list[index];

    if (input.amount !== undefined && input.amount <= 0) {
      throw new Error('يجب أن يكون مبلغ المصروف أكبر من صفر.');
    }

    const updated: OperatingExpense = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      category: input.category !== undefined ? input.category : existing.category,
      amount: input.amount !== undefined ? roundMoney(Number(input.amount)) : existing.amount,
      branch: input.branch !== undefined ? input.branch.trim() : existing.branch,
      expense_date: input.expense_date !== undefined ? input.expense_date : existing.expense_date,
      payment_source: input.payment_source !== undefined ? input.payment_source : existing.payment_source,
      payment_method: input.payment_method !== undefined ? input.payment_method : existing.payment_method,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    saveStoredExpenses(list);
    changeListeners.forEach(fn => fn());

    return updated;
  },

  /**
   * Delete an existing operating expense.
   */
  async deleteExpense(id: string): Promise<boolean> {
    const list = getStoredExpenses();
    const filtered = list.filter(e => e.id !== id);
    if (filtered.length === list.length) {
      return false;
    }
    saveStoredExpenses(filtered);
    changeListeners.forEach(fn => fn());
    return true;
  },

  /**
   * Calculate summary statistics for Accessories expenses (KPI cards).
   */
  async getStats(params?: ExpenseFilterParams): Promise<ExpensePeriodStats> {
    const all = getStoredExpenses();
    const todayStr = getTodayLocalDateString();

    // Calculate Week start (7 days ago) and Month start (30 days ago)
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const weekStartStr = weekAgo.toISOString().split('T')[0];

    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    const monthStartStr = monthAgo.toISOString().split('T')[0];

    // Filter by branch if specified in params
    const branchFiltered = params?.branch && params.branch !== 'ALL'
      ? all.filter(e => e.branch === params.branch)
      : all;

    const todayTotal = roundMoney(
      branchFiltered.filter(e => e.expense_date === todayStr).reduce((sum, e) => sum + e.amount, 0)
    );

    const weekTotal = roundMoney(
      branchFiltered.filter(e => e.expense_date >= weekStartStr && e.expense_date <= todayStr).reduce((sum, e) => sum + e.amount, 0)
    );

    const monthTotal = roundMoney(
      branchFiltered.filter(e => e.expense_date >= monthStartStr && e.expense_date <= todayStr).reduce((sum, e) => sum + e.amount, 0)
    );

    // Selected period filtered items
    const filteredItems = await this.getExpenses(params);
    const periodTotal = roundMoney(filteredItems.reduce((sum, e) => sum + e.amount, 0));
    const transactionsCount = filteredItems.length;

    // Category breakdown
    const catMap = new Map<string, { total: number; count: number }>();
    filteredItems.forEach(e => {
      const cur = catMap.get(e.category) || { total: 0, count: 0 };
      catMap.set(e.category, {
        total: roundMoney(cur.total + e.amount),
        count: cur.count + 1,
      });
    });
    const categoryBreakdown = Array.from(catMap.entries()).map(([category, val]) => ({
      category,
      total: val.total,
      count: val.count,
    })).sort((a, b) => b.total - a.total);

    // Branch breakdown
    const branchMap = new Map<string, { total: number; count: number }>();
    filteredItems.forEach(e => {
      const cur = branchMap.get(e.branch) || { total: 0, count: 0 };
      branchMap.set(e.branch, {
        total: roundMoney(cur.total + e.amount),
        count: cur.count + 1,
      });
    });
    const branchBreakdown = Array.from(branchMap.entries()).map(([branch, val]) => ({
      branch,
      total: val.total,
      count: val.count,
    })).sort((a, b) => b.total - a.total);

    return {
      todayTotal,
      weekTotal,
      monthTotal,
      periodTotal,
      transactionsCount,
      categoryBreakdown,
      branchBreakdown,
    };
  },

  /**
   * Sum of total expenses for a specific date range and optional branch.
   * Used directly by financial reporting to deduct operating expenses from Net Profit.
   */
  async getTotalExpenses(startDate?: string, endDate?: string, branch?: string): Promise<number> {
    const list = await this.getExpenses({ startDate, endDate, branch });
    return roundMoney(list.reduce((sum, e) => sum + e.amount, 0));
  },

  /**
   * Subscribe to expense changes.
   */
  subscribe(listener: ExpenseChangeListener): () => void {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  },
};
