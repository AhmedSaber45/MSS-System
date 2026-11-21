import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Pagination } from '@/components/common/Pagination';
import { Input } from '@/components/common/Input';
import { Spinner } from '@/components/common/Spinner';
import { Modal } from '@/components/common/Modal';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { useNotification } from '@/context/NotificationContext';
import { useMSSLocations } from '@/hooks/useMSSLocations';
import { accessoriesExpensesService } from '@/services/accessoriesExpensesService';
import { ExpenseFormModal } from '@/components/expenses/ExpenseFormModal';
import { PrintExpenseReportModal } from '@/components/expenses/PrintExpenseReportModal';
import { PrintableExpenseReportDocument } from '@/components/expenses/PrintableExpenseReportDocument';
import { formatCurrency } from '@/lib/utils';
import { getTodayLocalDateString, useDateRangeFilter } from '@/lib/dateValidation';
import type { OperatingExpense, NewExpenseInput, ExpensePeriodStats } from '@/types/expenses';
import {
  ReceiptText,
  Plus,
  Printer,
  Search,
  Trash2,
  Edit2,
  Calendar,
  RotateCcw,
  TrendingDown,
  Clock,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';

export const AccessoriesExpensesView: React.FC = () => {
  const { showNotification } = useNotification();
  const { locations } = useMSSLocations();

  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [stats, setStats] = useState<ExpensePeriodStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters state (Category and Branch filters removed for Accessories)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  const todayStr = getTodayLocalDateString();
  const dateValidation = useDateRangeFilter({
    initialStart: todayStr,
    initialEnd: todayStr,
    allowFuture: true,
  });

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<OperatingExpense | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [deletingExpense, setDeletingExpense] = useState<OperatingExpense | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Derive date bounds
  const activeDateRange = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    if (period === 'today') {
      return { start: todayISO, end: todayISO, label: 'اليوم' };
    }
    if (period === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return { start: weekAgo.toISOString().split('T')[0], end: todayISO, label: 'آخر 7 أيام' };
    }
    if (period === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setDate(today.getDate() - 30);
      return { start: monthAgo.toISOString().split('T')[0], end: todayISO, label: 'آخر 30 يوماً' };
    }
    if (period === 'custom') {
      return {
        start: dateValidation.startDate,
        end: dateValidation.endDate,
        label: `فترة مخصصة (${dateValidation.startDate} إلى ${dateValidation.endDate})`,
      };
    }
    return { label: 'كافة الفترات' };
  }, [period, dateValidation.startDate, dateValidation.endDate]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterParams = {
        startDate: activeDateRange.start,
        endDate: activeDateRange.end,
        category: 'ALL',
        branch: 'ALL',
        searchQuery,
      };

      const [items, periodStats] = await Promise.all([
        accessoriesExpensesService.getExpenses(filterParams),
        accessoriesExpensesService.getStats(filterParams),
      ]);

      setExpenses(items);
      setStats(periodStats);
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'خطأ في تحميل المصروفات',
        message: err?.message || 'تعذر تحميل بيانات مصروفات المحل.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeDateRange, searchQuery, showNotification]);

  useEffect(() => {
    loadData();
    const unsub = accessoriesExpensesService.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  // Handle Save (Create / Update)
  const handleSaveExpense = async (input: NewExpenseInput) => {
    if (editingExpense) {
      await accessoriesExpensesService.updateExpense(editingExpense.id, input);
      showNotification({
        type: 'success',
        title: 'تم تحديث المصروف',
        message: `تم تحديث بيانات المصروف (${input.title}) بنجاح.`,
      });
    } else {
      await accessoriesExpensesService.createExpense(input);
      showNotification({
        type: 'success',
        title: 'تم تسجيل المصروف',
        message: `تم تسجيل المصروف الجديد (${input.title}) بمبلغ ${formatCurrency(input.amount)} بنجاح.`,
      });
    }
    await loadData();
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    try {
      await accessoriesExpensesService.deleteExpense(deletingExpense.id);
      showNotification({
        type: 'info',
        title: 'تم حذف المصروف',
        message: `تم حذف المصروف (${deletingExpense.title}) وتحديث الحسابات المالية.`,
      });
      setDeletingExpense(null);
      await loadData();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل حذف المصروف',
        message: err?.message || 'تعذر حذف المصروف.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Sorted items
  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime();
      }
      if (sortBy === 'amount_desc') {
        return b.amount - a.amount;
      }
      if (sortBy === 'amount_asc') {
        return a.amount - b.amount;
      }
      return 0;
    });
  }, [expenses, sortBy]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 9;

  // Reset pagination on search query, period, date range, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, period, dateValidation.startDate, dateValidation.endDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Auto-correct if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Paginated items
  const paginatedExpenses = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return sortedExpenses.slice(startIndex, startIndex + pageSize);
  }, [sortedExpenses, validCurrentPage, pageSize]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* 1. Page Header */}
      <PageHeader
        title="مصروفات المحل"
        subtitle=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsPrintModalOpen(true)}
              leftIcon={<Printer className="w-4 h-4 text-slate-600" />}
              className="font-bold border-slate-300"
            >
              طباعة تقرير المصروفات
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setEditingExpense(null);
                setIsFormModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold shadow-xs bg-blue-600 hover:bg-blue-700"
            >
              تسجيل مصروف جديد
            </Button>
          </div>
        }
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="bg-white border-slate-300 shadow-2xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مصروفات اليوم</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-mono font-bold text-slate-900 text-lg tabular-nums">
            {formatCurrency(stats?.todayTotal || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">تاريخ اليوم: {todayStr}</span>
        </Card>

        <Card className="bg-white border-slate-300 shadow-2xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مصروفات هذا الأسبوع</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-mono font-bold text-slate-900 text-lg tabular-nums">
            {formatCurrency(stats?.weekTotal || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">آخر 7 أيام عمل</span>
        </Card>

        <Card className="bg-white border-slate-300 shadow-2xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">مصروفات هذا الشهر</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-mono font-bold text-slate-900 text-lg tabular-nums">
            {formatCurrency(stats?.monthTotal || 0)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">آخر 30 يوماً</span>
        </Card>

        <Card className="bg-white border-slate-300 shadow-2xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">عدد العمليات للفترة</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-mono font-bold text-slate-900 text-lg tabular-nums">
            {stats?.transactionsCount || 0} حركة
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">حركات الصرف المسجلة</span>
        </Card>

        <Card className="bg-rose-50/70 border border-rose-200 shadow-2xs p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">إجمالي مصروفات الفترة</span>
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 font-mono font-bold text-rose-700 text-xl tabular-nums">
            {formatCurrency(stats?.periodTotal || 0)}
          </div>
          <span className="text-[11px] text-rose-800 mt-1 block font-semibold truncate">
            {activeDateRange.label}
          </span>
        </Card>
      </div>

      {/* 3. Filter & Search Controls Card */}
      <Card className="bg-white border-slate-300 shadow-2xs p-4">
        <div className="space-y-3.5">
          {/* Top Row: Search and Sorting (Category and Branch filters removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Input
                type="text"
                placeholder="بحث بالاسم أو البيان أو الوصف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-9 h-10 text-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            {/* Sorting */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="w-full h-10 px-3 pr-8 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium text-slate-900"
              >
                <option value="date_desc">التاريخ: الأحدث أولاً</option>
                <option value="date_asc">التاريخ: الأقدم أولاً</option>
                <option value="amount_desc">المبلغ: الأعلى أولاً</option>
                <option value="amount_asc">المبلغ: الأقل أولاً</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Bottom Row: Period Tabs & Custom Dates */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-700 ml-1">فترة العرض:</span>
              <div className="inline-flex rounded-xl border border-slate-300 p-1 bg-slate-100 gap-1">
                {[
                  { id: 'today', label: 'اليوم' },
                  { id: 'week', label: 'آخر 7 أيام' },
                  { id: 'month', label: 'آخر 30 يوماً' },
                  { id: 'all', label: 'كافة الفترات' },
                  { id: 'custom', label: 'فترة مخصصة' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPeriod(opt.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      period === opt.id
                        ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-300'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {period === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <DateRangeInputs
                  startDate={dateValidation.startDate}
                  endDate={dateValidation.endDate}
                  maxStartDate={dateValidation.maxStartDate}
                  minEndDate={dateValidation.minEndDate}
                  maxEndDate={dateValidation.maxEndDate}
                  error={dateValidation.error}
                  onStartDateChange={dateValidation.setStartDate}
                  onEndDateChange={dateValidation.setEndDate}
                  onClear={dateValidation.clearDateRange}
                />
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="font-bold text-xs"
            >
              تحديث
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Expenses Management Table */}
      <Card className="bg-white border-slate-300 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center">
            <Spinner size="lg" />
            <p className="mt-3 text-sm text-slate-600 font-medium">جارٍ تحميل سجل مصروفات المحل...</p>
          </div>
        ) : sortedExpenses.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">لا توجد مصروفات مسجلة</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              لم يتم العثور على أي مصروفات تطابق معايير الفلترة المحددة. يمكنك إضافة مصروف جديد بالضغط على الزر أعلاه.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingExpense(null);
                setIsFormModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-2"
            >
              تسجيل أول مصروف
            </Button>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                  <tr>
                    <th className="py-3 px-3.5 text-center w-12">#</th>
                    <th className="py-3 px-3.5">اسم أو بيان المصروف</th>
                    <th className="py-3 px-3.5 text-left">المبلغ المالي</th>
                    <th className="py-3 px-3.5">تاريخ الصرف</th>
                    <th className="py-3 px-3.5 text-center w-28">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedExpenses.map((exp, idx) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 text-center font-mono text-slate-500">
                        {(validCurrentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 text-sm">{exp.title}</div>
                        {exp.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{exp.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-left font-mono font-bold text-rose-700 text-sm tabular-nums">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600">{exp.expense_date}</td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingExpense(exp);
                              setIsFormModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 border-slate-300 hover:text-blue-600"
                            title="تعديل المصروف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingExpense(exp)}
                            className="h-8 w-8 p-0 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
                            title="حذف المصروف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {sortedExpenses.length > 0 && (
              <Pagination
                currentPage={validCurrentPage}
                totalItems={sortedExpenses.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </Card>

      {/* 5. Add / Edit Expense Form Modal */}
      <ExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingExpense(null);
        }}
        onSave={handleSaveExpense}
        initialData={editingExpense}
        moduleName="accessories"
        availableBranches={locations}
      />

      {/* 6. Print Report Modal */}
      <PrintExpenseReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        moduleName="accessories"
        allExpenses={expenses}
        availableBranches={locations}
      />

      {/* 7. Delete Confirmation Dialog */}
      {deletingExpense && (
        <Modal
          isOpen={true}
          onClose={() => setDeletingExpense(null)}
          title="تأكيد حذف المصروف التشغيلي"
          size="sm"
        >
          <div className="space-y-4 text-sm" dir="rtl">
            <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">هل أنت متأكد من رغبتك في حذف هذا المصروف؟</p>
                <p className="mt-1">
                  سيتم حذف المصروف <strong>{deletingExpense.title}</strong> بمبلغ <strong>{formatCurrency(deletingExpense.amount)}</strong> وتعديل صافي الأرباح فوراً.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="outline" onClick={() => setDeletingExpense(null)} disabled={isDeleting}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'نعم، حذف المصروف'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. Hidden Pristine Printable Element for PDF / Print */}
      <div className="hidden" aria-hidden="true">
        <PrintableExpenseReportDocument
          moduleName="accessories"
          expenses={expenses}
          periodLabel={activeDateRange.label}
          selectedBranch="محل الإكسسوارات"
          totalExpenses={stats?.periodTotal || 0}
          transactionsCount={stats?.transactionsCount || 0}
          categoryBreakdown={stats?.categoryBreakdown || []}
          branchBreakdown={stats?.branchBreakdown || []}
        />
      </div>
    </div>
  );
};
