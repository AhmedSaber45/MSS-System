import React from 'react';
import type {
  FinancialSummary,
  DailySalesSummary,
  TopSellingProduct,
  InventoryValuation,
} from '@/types/reports.ts';
import { formatCurrency } from '@/lib/utils';

export interface PrintableProfitReportProps {
  summary: FinancialSummary;
  dailySummaries: DailySalesSummary[];
  topProducts: TopSellingProduct[];
  valuation?: InventoryValuation | null;
  periodLabel: string;
  dateRangeText?: string;
  reportTitle?: string;
  businessName?: string;
}

export const PrintableProfitReport: React.FC<PrintableProfitReportProps> = ({
  summary,
  dailySummaries,
  topProducts,
  valuation,
  periodLabel,
  dateRangeText,
  reportTitle = 'كشف الأرباح والأداء المالي والتشغيلي',
  businessName = 'MSS System — نظام إدارة الأعمال والمبيعات',
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

  // Calculate daily totals
  const dailyTotalRevenue = dailySummaries.reduce((sum, d) => sum + d.revenue, 0);
  const dailyTotalCogs = dailySummaries.reduce((sum, d) => sum + d.cogs, 0);
  const dailyTotalRefunds = dailySummaries.reduce((sum, d) => sum + d.refunds, 0);
  const dailyTotalProfit = dailySummaries.reduce((sum, d) => sum + d.grossProfit, 0);
  const dailyTotalInvoices = dailySummaries.reduce((sum, d) => sum + d.invoicesCount, 0);

  // Calculate top products totals
  const topProductsQty = topProducts.reduce((sum, p) => sum + p.quantitySold, 0);
  const topProductsRevenue = topProducts.reduce((sum, p) => sum + p.totalRevenue, 0);
  const topProductsCost = topProducts.reduce((sum, p) => sum + p.totalCost, 0);
  const topProductsProfit = topProducts.reduce((sum, p) => sum + p.grossProfit, 0);

  return (
    <div
      id="printable-profit-report"
      className="bg-white text-slate-900 p-8 sm:p-12 w-full max-w-[210mm] mx-auto space-y-6 text-sm"
      dir="rtl"
      style={{ minHeight: 'auto', boxSizing: 'border-box' }}
    >
      {/* 1. Formal Document Header */}
      <div className="border-b-2 border-slate-900 pb-5">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-950 tracking-tight">
              {businessName}
            </h1>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              قسم الإكسسوارات والمبيعات — التقارير المالية المعتمدة
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
              <span>تاريخ الاستخراج: {currentDate} ({currentTime})</span>
              <span>•</span>
              <span>العملة: الجنيه المصري (EGP)</span>
            </div>
          </div>

          <div className="text-left border border-slate-300 bg-slate-50 p-3 rounded-lg text-xs space-y-1 print:bg-white print:border-slate-400">
            <span className="font-bold text-slate-900 block">وثيقة مالية معتمدة</span>
            <p className="text-slate-600 font-mono">رقم المرجع: REP-{Date.now().toString(36).toUpperCase()}</p>
            <p className="text-slate-600 font-medium">الحالة: قيد محاسبي نظامي</p>
          </div>
        </div>

        {/* Report Title Banner */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex justify-between items-center bg-slate-100 p-3.5 rounded-lg print:bg-slate-50 print:border print:border-slate-300">
          <div>
            <h2 className="text-base font-bold text-slate-900">{reportTitle}</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              بيان شامل للإيرادات وتكلفة البضاعة المباعة وهوامش الربح المحققة
            </p>
          </div>
          <div className="text-left font-mono text-xs font-bold text-slate-800">
            فترة التقرير: <span className="bg-white px-2 py-1 rounded border border-slate-300">{periodLabel} {dateRangeText ? `(${dateRangeText})` : ''}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive Financial KPI Summary Table */}
      <div className="space-y-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          أولاً: ملخص المؤشرات المالية والأرباح
        </h3>

        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-4">البند المالي</th>
                <th className="py-2.5 px-4 text-center">البيان / الحجم</th>
                <th className="py-2.5 px-4 text-left">المبلغ المالي (EGP)</th>
                <th className="py-2.5 px-4 text-left">الأثر المالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">إجمالي المبيعات (Gross Sales)</td>
                <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-700">{summary.invoicesCount} فاتورة مسددة</td>
                <td className="py-2.5 px-4 text-left font-bold font-mono tabular-nums text-slate-900">{formatCurrency(summary.totalRevenue)}</td>
                <td className="py-2.5 px-4 text-left text-xs font-medium text-slate-600">إجمالي حركة المبيعات</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">المرتجعات والمسحوبات (Returns & Refunds)</td>
                <td className="py-2.5 px-4 text-center font-mono tabular-nums text-slate-700">{summary.returnsCount} عمليات استرجاع</td>
                <td className="py-2.5 px-4 text-left font-bold font-mono tabular-nums text-rose-700">- {formatCurrency(summary.totalRefunds)}</td>
                <td className="py-2.5 px-4 text-left text-xs font-medium text-rose-700">خصم من إجمالي المبيعات</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-2.5 px-4 text-slate-900">صافي المبيعات المحققة (Net Sales)</td>
                <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-600">المبيعات - المرتجعات</td>
                <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-950 text-base">{formatCurrency(summary.netSales)}</td>
                <td className="py-2.5 px-4 text-left text-xs text-slate-700">الأساس الفعلي لاحتساب الربح</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">تكلفة البضاعة المباعة (Net COGS)</td>
                <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-600">التكلفة التاريخية الدقيقة</td>
                <td className="py-2.5 px-4 text-left font-bold font-mono tabular-nums text-slate-700">{formatCurrency(summary.costOfGoodsSold)}</td>
                <td className="py-2.5 px-4 text-left text-xs font-medium text-slate-600">تكلفة شراء المنتجات المباعة</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">إجمالي الخصومات الممنوحة للعملاء</td>
                <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-600">خصومات الأصناف والفواتير</td>
                <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-700">{formatCurrency(summary.totalDiscounts)}</td>
                <td className="py-2.5 px-4 text-left text-xs font-medium text-slate-600">وفر للعملاء خلال الفترة</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-900">متوسط قيمة الفاتورة (AOV)</td>
                <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-600">متوسط العملية الواحدة</td>
                <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-800">{formatCurrency(summary.avgInvoiceValue)}</td>
                <td className="py-2.5 px-4 text-left text-xs font-medium text-slate-600">معدل إنفاق العميل</td>
              </tr>
              {/* Gross Profit Highlight Row */}
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold print:bg-slate-50">
                <td className="py-3 px-4 text-slate-950 text-base">مجمل الأرباح التشغيلية (Gross Profit)</td>
                <td className="py-3 px-4 text-center font-mono text-sm text-slate-900">
                  هامش الربح: {summary.profitMarginPercent.toFixed(1)}%
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums text-emerald-800 text-lg print:text-slate-950">
                  {formatCurrency(summary.grossProfit)}
                </td>
                <td className="py-3 px-4 text-left text-xs font-bold text-emerald-800 print:text-slate-900">
                  صافي الربح التشغيلي المحقق
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Daily Sales & Profit Breakdown Table (Phase 5.D: repeated header across pages) */}
      <div className="space-y-2 pt-2">
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          ثانياً: حركة المبيعات والأرباح اليومية
        </h3>

        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead
              className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300"
              style={{ display: 'table-header-group' }}
            >
              <tr>
                <th className="py-2.5 px-3.5">التاريخ</th>
                <th className="py-2.5 px-3.5 text-center">الفواتير</th>
                <th className="py-2.5 px-3.5 text-left">المبيعات</th>
                <th className="py-2.5 px-3.5 text-left">التكلفة</th>
                <th className="py-2.5 px-3.5 text-left">المرتجعات</th>
                <th className="py-2.5 px-3.5 text-left">مجمل الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dailySummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 text-sm">
                    لا توجد حركات مبيعات مسجلة في هذه الفترة
                  </td>
                </tr>
              ) : (
                dailySummaries.map(d => (
                  <tr
                    key={d.date}
                    className="hover:bg-slate-50"
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                  >
                    <td className="py-2.5 px-3.5 font-mono text-slate-800 font-semibold tabular-nums text-xs">
                      {d.date}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono text-slate-700 tabular-nums text-xs">
                      {d.invoicesCount}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-bold font-mono tabular-nums text-slate-900 text-xs">
                      {formatCurrency(d.revenue)}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-mono text-slate-600 tabular-nums text-xs">
                      {formatCurrency(d.cogs)}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-mono font-semibold text-rose-700 tabular-nums text-xs">
                      {d.refunds > 0 ? formatCurrency(d.refunds) : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-left font-bold font-mono tabular-nums text-xs ${
                        d.grossProfit >= 0 ? 'text-emerald-800 print:text-slate-950' : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(d.grossProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {dailySummaries.length > 0 && (
              <tfoot
                className="bg-slate-100 border-t-2 border-slate-900 font-bold text-xs"
                style={{ display: 'table-footer-group' }}
              >
                <tr>
                  <td className="py-2.5 px-3.5 text-slate-900">الإجمالي العام للحركة:</td>
                  <td className="py-2.5 px-3.5 text-center font-mono tabular-nums">{dailyTotalInvoices}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums">{formatCurrency(dailyTotalRevenue)}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums">{formatCurrency(dailyTotalCogs)}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums text-rose-700">{formatCurrency(dailyTotalRefunds)}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums text-emerald-800 print:text-slate-950">
                    {formatCurrency(dailyTotalProfit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 4. Top Selling Products Breakdown Table */}
      <div className="space-y-2 pt-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
          ثالثاً: الأصناف الأكثر مبيعاً وتحقيقاً للأرباح
        </h3>

        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead
              className="bg-slate-100 text-xs font-bold text-slate-700 border-b border-slate-300"
              style={{ display: 'table-header-group' }}
            >
              <tr>
                <th className="py-2.5 px-3.5">الصنف</th>
                <th className="py-2.5 px-3.5 text-center">الكمية المباعة</th>
                <th className="py-2.5 px-3.5 text-left">إجمالي الإيراد</th>
                <th className="py-2.5 px-3.5 text-left">إجمالي التكلفة</th>
                <th className="py-2.5 px-3.5 text-left">الربح المحقق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500 text-sm">
                    لا توجد مبيعات أصناف في الفترة المحددة
                  </td>
                </tr>
              ) : (
                topProducts.map(p => (
                  <tr
                    key={p.productId}
                    className="hover:bg-slate-50"
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                  >
                    <td className="py-2.5 px-3.5">
                      <span className="font-bold text-slate-900 text-xs block">{p.productName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{p.productCode}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-mono font-bold tabular-nums text-slate-800 text-xs">
                      {p.quantitySold}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-mono font-bold text-slate-900 tabular-nums text-xs">
                      {formatCurrency(p.totalRevenue)}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-mono text-slate-600 tabular-nums text-xs">
                      {formatCurrency(p.totalCost)}
                    </td>
                    <td className="py-2.5 px-3.5 text-left font-mono font-bold text-emerald-800 print:text-slate-950 tabular-nums text-xs">
                      {formatCurrency(p.grossProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {topProducts.length > 0 && (
              <tfoot
                className="bg-slate-100 border-t-2 border-slate-900 font-bold text-xs"
                style={{ display: 'table-footer-group' }}
              >
                <tr>
                  <td className="py-2.5 px-3.5 text-slate-900">إجمالي الأصناف المتصدرة:</td>
                  <td className="py-2.5 px-3.5 text-center font-mono tabular-nums">{topProductsQty}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums">{formatCurrency(topProductsRevenue)}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums">{formatCurrency(topProductsCost)}</td>
                  <td className="py-2.5 px-3.5 text-left font-mono tabular-nums text-emerald-800 print:text-slate-950">
                    {formatCurrency(topProductsProfit)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 5. Inventory Valuation Snapshot (if provided) */}
      {valuation && (
        <div className="space-y-2 pt-2 avoid-break" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <h3 className="font-bold text-sm text-slate-900 border-r-4 border-slate-900 pr-2">
            رابعاً: تقييم المخزون الحالي ورأس المال العامل
          </h3>

          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs print:bg-white print:border-slate-400">
            <div>
              <span className="text-slate-500 block mb-1">إجمالي الأصناف والقطع:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                {valuation.totalItemsCount} صنف ({valuation.totalUnitsCount} قطعة)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">قيمة المخزون بسعر التكلفة:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                {formatCurrency(valuation.totalCostValue)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">قيمة المخزون بسعر البيع:</span>
              <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                {formatCurrency(valuation.totalRetailValue)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">الربح التقديري للمخزون:</span>
              <span className="font-bold text-emerald-800 print:text-slate-950 font-mono tabular-nums text-sm">
                {formatCurrency(valuation.potentialProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Signatures & Official Audit Certification */}
      <div
        className="pt-8 border-t-2 border-slate-900 space-y-6 avoid-break"
        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
      >
        <div className="grid grid-cols-3 gap-6 text-xs text-slate-700 font-semibold text-center">
          <div className="p-3 border border-slate-200 rounded-lg">
            <p className="mb-8">إعداد وتدقيق الحسابات:</p>
            <p className="font-mono text-slate-400">________________________</p>
          </div>
          <div className="p-3 border border-slate-200 rounded-lg">
            <p className="mb-8">اعتماد الإدارة المالية:</p>
            <p className="font-mono text-slate-400">________________________</p>
          </div>
          <div className="p-3 border border-slate-200 rounded-lg">
            <p className="mb-8">ختم المنشأة الرسمي:</p>
            <p className="font-mono text-slate-400">________________________</p>
          </div>
        </div>

        {/* Legal & Ownership Footer */}
        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 border-t border-slate-200">
          <span>نظام MSS System — تم إنشاء التقرير إلكترونياً وهو معتمد بدون تعديل يدوي</span>
          <span>© 2026 Ahmed Saber. All rights reserved. • Contact: 01030137635</span>
        </div>
      </div>
    </div>
  );
};
