import React from 'react';
import type { OperatingExpense } from '@/types/expenses';
import { formatCurrency } from '@/lib/utils';

export interface PrintableExpenseReportProps {
  moduleName: 'accessories' | 'mss';
  expenses: OperatingExpense[];
  periodLabel: string;
  selectedBranch?: string;
  totalExpenses: number;
  transactionsCount: number;
  categoryBreakdown: { category: string; total: number; count: number }[];
  branchBreakdown: { branch: string; total: number; count: number }[];
}

export const PrintableExpenseReportDocument: React.FC<PrintableExpenseReportProps> = ({
  moduleName,
  expenses,
  periodLabel,
  selectedBranch = 'كافة الفروع',
  totalExpenses,
  transactionsCount,
  categoryBreakdown,
  branchBreakdown,
}) => {
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const moduleDisplayName =
    moduleName === 'accessories' ? 'قسم الإكسسوارات — محل الإكسسوارات' : 'Compu MSS — استيراد اللابتوب والكمبيوتر';

  return (
    <div
      id="printable-expenses-report-root"
      className="bg-white text-slate-900 p-8 sm:p-12 w-full max-w-[210mm] mx-auto space-y-6 text-sm"
      dir="rtl"
      style={{ minHeight: 'auto', boxSizing: 'border-box' }}
    >
      {/* 1. Header */}
      <div className="border-b-2 border-slate-900 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-950 tracking-tight">
              {moduleDisplayName}
            </h1>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              تقرير المصروفات التشغيلية المعتمد
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
              <span>تاريخ الاستخراج: {currentDate} ({currentTime})</span>
              <span>•</span>
              <span>العملة: الجنيه المصري (EGP)</span>
            </div>
          </div>

          <div className="text-left border border-slate-300 bg-slate-50 p-3 rounded-lg text-xs space-y-1 print:bg-white print:border-slate-400">
            <span className="font-bold text-slate-900 block">كشف مصروفات رسمي</span>
            <p className="text-slate-600 font-mono">رقم المرجع: EXP-{Date.now().toString(36).toUpperCase()}</p>
            <p className="text-slate-600 font-medium">الفرع: {selectedBranch}</p>
          </div>
        </div>

        {/* Title Banner */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-100 p-3.5 rounded-lg print:bg-slate-50 print:border print:border-slate-300">
          <div>
            <h2 className="text-base font-bold text-slate-900">تقرير المصروفات</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              بيان تفصيلي بالمصروفات التشغيلية اليومية المستقطعة من أرباح النشاط
            </p>
          </div>
          <div className="text-left font-mono text-xs font-bold text-slate-800">
            فترة التقرير: <span className="bg-white px-2 py-1 rounded border border-slate-300">{periodLabel}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive Summary Cards */}
      <div className="grid grid-cols-2 gap-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
          <span className="text-xs text-slate-500 block mb-1 font-semibold">إجمالي المصروفات التشغيلية</span>
          <span className="text-lg font-bold font-mono text-rose-700 tabular-nums">
            {formatCurrency(totalExpenses)}
          </span>
        </div>
        <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
          <span className="text-xs text-slate-500 block mb-1 font-semibold">عدد حركات الصرف المنفذة</span>
          <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
            {transactionsCount} عمليات
          </span>
        </div>
      </div>

      {/* 3. Category & Branch Breakdown */}
      <div className="grid grid-cols-2 gap-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {/* Category Breakdown */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 font-bold text-xs text-slate-800 border-b border-slate-300">
            توزيع المصروفات حسب التصنيف
          </div>
          <table className="w-full text-xs text-right">
            <tbody className="divide-y divide-slate-200">
              {categoryBreakdown.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-1.5 px-3 font-medium text-slate-900">{c.category}</td>
                  <td className="py-1.5 px-3 text-center text-slate-500 font-mono">{c.count}</td>
                  <td className="py-1.5 px-3 text-left font-bold font-mono text-slate-900">{formatCurrency(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Branch Breakdown */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-2 font-bold text-xs text-slate-800 border-b border-slate-300">
            توزيع المصروفات حسب الفرع
          </div>
          <table className="w-full text-xs text-right">
            <tbody className="divide-y divide-slate-200">
              {branchBreakdown.map((b, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-1.5 px-3 font-medium text-slate-900">{b.branch}</td>
                  <td className="py-1.5 px-3 text-center text-slate-500 font-mono">{b.count}</td>
                  <td className="py-1.5 px-3 text-left font-bold font-mono text-slate-900">{formatCurrency(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Detailed Expenses Table */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          جدول تفاصيل المصروفات المنفذة
        </h3>

        <div className="border border-slate-300 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
              <tr>
                <th className="py-2 px-3 text-center w-10">#</th>
                <th className="py-2 px-3">بيان / اسم المصروف</th>
                <th className="py-2 px-3">التصنيف</th>
                <th className="py-2 px-3">الفرع</th>
                <th className="py-2 px-3">التاريخ</th>
                <th className="py-2 px-3">طريقة الدفع</th>
                <th className="py-2 px-3 text-left">المبلغ (EGP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {expenses.map((e, index) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-center font-mono text-slate-500">{index + 1}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">
                    <div>{e.title}</div>
                    {e.description && (
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1">{e.description}</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-700">{e.category}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{e.branch}</td>
                  <td className="py-2 px-3 font-mono text-slate-600">{e.expense_date}</td>
                  <td className="py-2 px-3 text-slate-600">{e.payment_method}</td>
                  <td className="py-2 px-3 text-left font-bold font-mono text-rose-700 tabular-nums">
                    {formatCurrency(e.amount)}
                  </td>
                </tr>
              ))}

              {/* Grand Total Row */}
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-950">
                <td colSpan={6} className="py-2.5 px-3 text-right text-sm">
                  إجمالي كافة المصروفات للفترة المحددة:
                </td>
                <td className="py-2.5 px-3 text-left font-mono text-sm text-rose-700 tabular-nums">
                  {formatCurrency(totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Document Footer */}
      <div className="border-t border-slate-300 pt-4 flex justify-between items-center text-xs text-slate-500" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <span>نظام Compu MSS المتكامل لإدارة الأنشطة التجارية والمصروفات</span>
        <span>صفحة التقرير الرسمي المعتمد</span>
      </div>
    </div>
  );
};
