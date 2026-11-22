import { supabase } from '../lib/supabase.ts';
import { mssSyncService } from './mssSyncService.ts';
import type {
  OperatingExpense,
  NewExpenseInput,
  ExpenseFilterParams,
  ExpensePeriodStats,
} from '../types/expenses.ts';
import { roundMoney } from '../lib/accounting.ts';
import { getTodayLocalDateString, validateDateRange } from '../lib/dateValidation.ts';

const MSS_EXPENSES_STORAGE_KEY = 'shop_mss_expenses_v1';

// Cross-Platform UUID generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return 'mss-exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// Initial realistic seed expenses for Compu MSS business
const INITIAL_SEED_MSS_EXPENSES: OperatingExpense[] = [
  {
    id: 'mss-exp-seed-001',
    module: 'mss',
    title: 'مرتبات الفنيين ومسؤولي مبيعات اللابتوب',
    category: 'مرتبات الموظفين',
    amount: 14500,
    branch: 'محل 1',
    expense_date: '2026-11-01',
    payment_source: 'أموال الشركة',
    payment_method: 'تحويل بنكي',
    description: 'صرف الرواتب الشهرية لفنيي الصيانة ومسؤولي المبيعات عن شهر أكتوبر',
    created_at: '2026-11-01T09:00:00Z',
    created_by: 'المدير المالي',
  },
  {
    id: 'mss-exp-seed-002',
    module: 'mss',
    title: 'إيجار مقر ومخزن فرع محل 2',
    category: 'إيجار',
    amount: 6000,
    branch: 'محل 2',
    expense_date: '2026-11-01',
    payment_source: 'أموال الشركة',
    payment_method: 'نقدي (كاش)',
    description: 'سداد القيمة الإيجارية الشهرية لفرع ومخزن محل 2',
    created_at: '2026-11-01T11:00:00Z',
    created_by: 'المدير المالي',
  },
  {
    id: 'mss-exp-seed-003',
    module: 'mss',
    title: 'بنزين وانتقالات شحن واستلام شحنة أجهزة',
    category: 'بنزين ومواصلات',
    amount: 750,
    branch: 'محل 1',
    expense_date: '2026-11-12',
    payment_source: 'أموال الشركة',
    payment_method: 'نقدي (كاش)',
    description: 'مصاريف بنزين وانتقالات سيارة الشركة لاستلام شحنة لابتوبات وارد ميناء الإسكندرية',
    created_at: '2026-11-12T16:30:00Z',
    created_by: 'مسؤول المشتريات',
  },
  {
    id: 'mss-exp-seed-004',
    module: 'mss',
    title: 'معجون حراري وأدوات تنظيف وصيانة أجهزة',
    category: 'صيانة وإصلاحات',
    amount: 450,
    branch: 'محل 2',
    expense_date: '2026-11-17',
    payment_source: 'أموال الشركة',
    payment_method: 'نقدي (كاش)',
    description: 'شراء معجون حراري احترافي Arctic MX-4 وكحول أيزوبروبيل لصيانة أجهزة الفرز',
    created_at: '2026-11-17T13:20:00Z',
    created_by: 'فني الصيانة',
  },
  {
    id: 'mss-exp-seed-005',
    module: 'mss',
    title: 'فاتورة إنترنت فايبر عالي السرعة للسيرفرات والمزامنة',
    category: 'كهرباء ومرافق',
    amount: 650,
    branch: 'محل 1',
    expense_date: '2026-11-19',
    payment_source: 'أموال الشركة',
    payment_method: 'فودافون كاش / محفظة',
    description: 'سداد اشتراك الإنترنت الفايبر الشهري لمزامنة النظام السحابي وكاميرات المراقبة',
    created_at: '2026-11-19T10:00:00Z',
    created_by: 'مسؤول النظام',
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
    return isTestEnv ? INITIAL_SEED_MSS_EXPENSES : [];
  }
  try {
    const raw = localStorage.getItem(MSS_EXPENSES_STORAGE_KEY);
    if (!raw) {
      const defaultData = isTestEnv ? INITIAL_SEED_MSS_EXPENSES : [];
      localStorage.setItem(MSS_EXPENSES_STORAGE_KEY, JSON.stringify(defaultData));
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (isTestEnv ? INITIAL_SEED_MSS_EXPENSES : []);
  } catch {
    return isTestEnv ? INITIAL_SEED_MSS_EXPENSES : [];
  }
}

function saveStoredExpenses(expenses: OperatingExpense[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(MSS_EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('mss-expenses-changed'));
  } catch (err) {
    console.error('Failed to save MSS expenses to localStorage:', err);
  }
}

type ExpenseChangeListener = () => void;
const changeListeners = new Set<ExpenseChangeListener>();

export const mssExpensesService = {
  /**
   * Fetch all Compu MSS operating expenses matching filter criteria.
   * Pulls from Supabase if online, updates local cache, and supports offline access.
   */
  async getExpenses(params?: ExpenseFilterParams): Promise<OperatingExpense[]> {
    // 1. Try fetching live from Supabase if online
    try {
      const isOnline = await mssSyncService.checkConnectivity();
      if (isOnline) {
        let query = supabase.from('mss_expenses').select('*');

        if (params?.startDate) {
          query = query.gte('expense_date', params.startDate);
        }
        if (params?.endDate) {
          query = query.lte('expense_date', params.endDate);
        }
        if (params?.category && params.category !== 'ALL') {
          query = query.eq('category', params.category);
        }
        if (params?.branch && params.branch !== 'ALL') {
          query = query.eq('branch', params.branch);
        }

        const { data, error } = await query.order('expense_date', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: OperatingExpense[] = data.map((row: any) => ({
            id: row.id,
            module: 'mss',
            title: row.title,
            category: row.category,
            amount: Number(row.amount),
            branch: row.branch,
            expense_date: row.expense_date,
            payment_source: row.payment_source,
            payment_method: row.payment_method,
            description: row.description,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by: row.created_by,
          }));

          // Merge with local cache (preserve any locally created outbox items not yet on cloud)
          const localList = getStoredExpenses();
          const outbox = await mssSyncService.getOutbox();
          const pendingExpenseIds = new Set(
            outbox
              .filter(op => op.type === 'EXPENSE_CREATE' && op.status === 'PENDING')
              .map(op => op.payload.id)
          );

          const pendingLocal = localList.filter(e => pendingExpenseIds.has(e.id));
          const combined = [...pendingLocal, ...mapped.filter(m => !pendingExpenseIds.has(m.id))];
          saveStoredExpenses(combined);
          return this.applyLocalFilters(combined, params);
        }
      }
    } catch (e) {
      console.warn('Supabase getExpenses query failed, using offline cache:', e);
    }

    // 2. Fallback to local storage cache
    const list = getStoredExpenses();
    return this.applyLocalFilters(list, params);
  },

  /**
   * Helper to filter in-memory list
   */
  applyLocalFilters(list: OperatingExpense[], params?: ExpenseFilterParams): OperatingExpense[] {
    let result = [...list];
    if (!params) return result;

    if (params.startDate || params.endDate) {
      const { sanitizedStart, sanitizedEnd } = validateDateRange(params.startDate, params.endDate);
      if (sanitizedStart) {
        result = result.filter(e => e.expense_date >= sanitizedStart);
      }
      if (sanitizedEnd) {
        result = result.filter(e => e.expense_date <= sanitizedEnd);
      }
    }

    if (params.category && params.category !== 'ALL') {
      result = result.filter(e => e.category === params.category);
    }

    if (params.branch && params.branch !== 'ALL') {
      result = result.filter(e => e.branch === params.branch);
    }

    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.toLowerCase().trim();
      result = result.filter(
        e =>
          e.title.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => {
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
   * Register a new operating expense for Compu MSS.
   * Writes to local storage immediately and syncs with Supabase or queues in Outbox.
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

    const expenseId = generateUUID();
    const newExpense: OperatingExpense = {
      id: expenseId,
      module: 'mss',
      title: input.title.trim(),
      category: input.category || 'مصروفات أخرى',
      amount: roundMoney(Number(input.amount)),
      branch: input.branch.trim(),
      expense_date: input.expense_date || getTodayLocalDateString(),
      payment_source: input.payment_source || 'أموال الشركة',
      payment_method: input.payment_method || 'نقدي (كاش)',
      description: input.description?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: input.created_by || 'مسؤول MSS',
    };

    // 1. Save to local cache first (guarantees offline availability)
    const list = getStoredExpenses();
    list.unshift(newExpense);
    saveStoredExpenses(list);
    changeListeners.forEach(fn => fn());

    // 2. Queue in Outbox for offline synchronization tracking
    try {
      await mssSyncService.queueOperation(
        'EXPENSE_CREATE',
        newExpense,
        `تسجيل مصروف تشغيلي: ${newExpense.title} (${newExpense.amount} ج.م)`,
        newExpense.branch as any
      );
    } catch (e) {
      console.warn('Failed to queue expense in Outbox:', e);
    }

    // 3. If online, attempt direct write to Supabase
    try {
      const isOnline = await mssSyncService.checkConnectivity();
      if (isOnline) {
        await supabase.from('mss_expenses').insert({
          id: newExpense.id,
          title: newExpense.title,
          category: newExpense.category,
          amount: newExpense.amount,
          branch: newExpense.branch,
          expense_date: newExpense.expense_date,
          payment_source: newExpense.payment_source,
          payment_method: newExpense.payment_method,
          description: newExpense.description,
          created_by: newExpense.created_by,
          created_at: newExpense.created_at,
          updated_at: newExpense.updated_at,
        });
      }
    } catch (err) {
      console.warn('Direct Supabase insert failed, operation remains queued in Outbox:', err);
    }

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

    // Queue update in outbox
    try {
      await mssSyncService.queueOperation(
        'EXPENSE_UPDATE',
        updated,
        `تعديل مصروف تشغيلي: ${updated.title} (${updated.amount} ج.م)`,
        updated.branch as any
      );
    } catch (e) {
      console.warn('Failed to queue expense update in Outbox:', e);
    }

    // Direct cloud update if online
    try {
      const isOnline = await mssSyncService.checkConnectivity();
      if (isOnline) {
        await supabase
          .from('mss_expenses')
          .update({
            title: updated.title,
            category: updated.category,
            amount: updated.amount,
            branch: updated.branch,
            expense_date: updated.expense_date,
            payment_source: updated.payment_source,
            payment_method: updated.payment_method,
            description: updated.description,
            updated_at: updated.updated_at,
          })
          .eq('id', id);
      }
    } catch (err) {
      console.warn('Direct Supabase update failed, operation remains queued in Outbox:', err);
    }

    return updated;
  },

  /**
   * Delete an existing operating expense.
   */
  async deleteExpense(id: string): Promise<boolean> {
    const list = getStoredExpenses();
    const existing = list.find(e => e.id === id);
    if (!existing) return false;

    const filtered = list.filter(e => e.id !== id);
    saveStoredExpenses(filtered);
    changeListeners.forEach(fn => fn());

    // Queue delete in Outbox
    try {
      await mssSyncService.queueOperation(
        'EXPENSE_DELETE',
        { id, title: existing.title },
        `حذف مصروف تشغيلي: ${existing.title}`,
        existing.branch as any
      );
    } catch (e) {
      console.warn('Failed to queue expense delete in Outbox:', e);
    }

    // Direct cloud delete if online
    try {
      const isOnline = await mssSyncService.checkConnectivity();
      if (isOnline) {
        await supabase.from('mss_expenses').delete().eq('id', id);
      }
    } catch (err) {
      console.warn('Direct Supabase delete failed, operation remains queued in Outbox:', err);
    }

    return true;
  },

  /**
   * Calculate summary statistics for Compu MSS expenses (KPI cards).
   */
  async getStats(params?: ExpenseFilterParams): Promise<ExpensePeriodStats> {
    const all = await this.getExpenses();
    const todayStr = getTodayLocalDateString();

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const weekStartStr = weekAgo.toISOString().split('T')[0];

    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    const monthStartStr = monthAgo.toISOString().split('T')[0];

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

    const filteredItems = await this.getExpenses(params);
    const periodTotal = roundMoney(filteredItems.reduce((sum, e) => sum + e.amount, 0));
    const transactionsCount = filteredItems.length;

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
