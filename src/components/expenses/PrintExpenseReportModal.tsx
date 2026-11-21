import React, { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { DateRangeInputs } from '@/components/common/DateRangeInputs';
import { documentPrintService } from '@/lib/documentPrintService';
import { useNotification } from '@/context/NotificationContext';
import { getTodayLocalDateString, useDateRangeFilter } from '@/lib/dateValidation';
import { Printer, Download, Calendar, Building2 } from 'lucide-react';
import type { OperatingExpense } from '@/types/expenses';

export interface PrintExpenseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: 'accessories' | 'mss';
  allExpenses: OperatingExpense[];
  availableBranches: string[];
}

export type ExpenseReportPeriodOption = 'today' | 'week' | 'month' | 'custom';

export const PrintExpenseReportModal: React.FC<PrintExpenseReportModalProps> = ({
  isOpen,
  onClose,
  moduleName,
  allExpenses,
  availableBranches,
}) => {
  const { showNotification } = useNotification();
  const [period, setPeriod] = useState<ExpenseReportPeriodOption>('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  const todayStr = getTodayLocalDateString();
  const dateValidation = useDateRangeFilter({
    initialStart: todayStr,
    initialEnd: todayStr,
    allowFuture: true,
  });

  // Calculate effective date range
  const getDateRange = (): { start?: string; end?: string; label: string } => {
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
        label: `فترة مخصصة (من ${dateValidation.startDate} إلى ${dateValidation.endDate})`,
      };
    }
    return { label: 'كافة الفترات' };
  };

  const handlePrint = async (asPdf: boolean) => {
    if (period === 'custom' && !dateValidation.isValid) {
      showNotification({
        type: 'error',
        title: 'تاريخ غير صالح',
        message: dateValidation.error || 'يرجى التأكد من أن تاريخ البدء يسبق أو يطابق تاريخ الانتهاء.',
      });
      return;
    }

    const { start, end, label } = getDateRange();

    // Filter expenses matching period & branch (branch applies to MSS only)
    let filtered = [...allExpenses];
    if (start) filtered = filtered.filter(e => e.expense_date >= start);
    if (end) filtered = filtered.filter(e => e.expense_date <= end);
    if (moduleName === 'mss' && selectedBranch !== 'ALL') {
      filtered = filtered.filter(e => e.branch === selectedBranch);
    }

    if (filtered.length === 0) {
      showNotification({
        type: 'warning',
        title: 'لا توجد بيانات',
        message:
          moduleName === 'accessories'
            ? 'لا توجد مصروفات مسجلة تطابق الفترة المحددة.'
            : 'لا توجد مصروفات مسجلة تطابق الفترة والفرع المحددين.',
      });
      return;
    }

    setIsExporting(true);

    const moduleLabel = moduleName === 'accessories' ? 'الإكسسوارات' : 'MSS';
    const filenamePeriod =
      period === 'custom' && start && end
        ? `${start}_${end}`
        : `${todayStr}_${period}`;
    const filename = `تقرير_مصروفات_${moduleLabel}_${filenamePeriod}`;

    try {
      if (asPdf) {
        await documentPrintService.exportToPdf('printable-expenses-report-root', {
          title: filename,
          format: 'report',
          orientation: 'portrait',
          exportType: moduleName === 'accessories' ? 'accessories_reports' : 'mss_reports',
        });

        showNotification({
          type: 'success',
          title: 'استخراج تقرير المصروفات كـ PDF',
          message: 'تم استخراج وتحميل تقرير المصروفات بتنسيق PDF بنجاح.',
        });
      } else {
        await documentPrintService.printElement('printable-expenses-report-root', {
          title: filename,
          format: 'report',
          orientation: 'portrait',
        });
      }
      onClose();
    } catch (err: any) {
      showNotification({
        type: 'error',
        title: 'فشل استخراج التقرير',
        message: err?.message || 'تعذر استخراج أو طباعة تقرير المصروفات.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={moduleName === 'accessories' ? 'طباعة تقرير مصروفات المحل' : 'طباعة تقرير مصروفات Compu MSS'}
      size="md"
    >
      <div className="space-y-4 text-sm" dir="rtl">

        {/* Period Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            فترة التقرير:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر' },
              { id: 'custom', label: 'فترة مخصصة' },
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id as ExpenseReportPeriodOption)}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border ${period === opt.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {period === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              تحديد تاريخ البداية والنهاية للفترة المخصصة:
            </span>
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

        {/* Branch Filter - Only for Compu MSS */}
        {moduleName === 'mss' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              الفرع المستهدف:
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 pr-9"
              >
                <option value="ALL">كافة الفروع والمخازن</option>
                {availableBranches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            إلغاء
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handlePrint(false)}
              disabled={isExporting}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              طباعة مباشرة
            </Button>
            <Button
              variant="primary"
              onClick={() => handlePrint(true)}
              disabled={isExporting}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {isExporting ? 'جارٍ الاستخراج...' : 'استخراج كـ PDF'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
